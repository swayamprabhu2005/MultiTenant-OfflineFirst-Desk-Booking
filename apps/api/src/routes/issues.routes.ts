import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.middleware';
import { Role, IssueStatus, IssuePriority } from '@deskbooking/shared';
import { EmailService } from '../services/email.service';

const router = Router();

// Ensure upload directory exists for screenshots
const uploadDir = path.join(__dirname, '../../uploads/screenshots');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage for disk file upload
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `issue-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowed.includes(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image file format. Only PNG, JPEG, JPG, and WEBP are supported.'));
    }
  },
});

// 1. Submit a New Issue Report (Accessible to all authenticated users across all roles)
router.post(
  '/report',
  authMiddleware,
  upload.single('screenshot'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { 
        title, description, category, priority, 
        base64Screenshot, clientVersion, deviceInfo, systemDiagnostics 
      } = req.body;

      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'Issue title is required.' });
      }

      if (!description || typeof description !== 'string' || !description.trim()) {
        return res.status(400).json({ error: 'Issue description is required.' });
      }

      let screenshotUrl: string | null = null;

      // Handle file upload from multipart form
      if (req.file) {
        screenshotUrl = `/uploads/screenshots/${req.file.filename}`;
      } else if (base64Screenshot && typeof base64Screenshot === 'string') {
        // Handle Base64 screenshot fallback
        const matches = base64Screenshot.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (matches) {
          const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
          const buffer = Buffer.from(matches[2], 'base64');
          const filename = `issue-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
          const filePath = path.join(uploadDir, filename);
          fs.writeFileSync(filePath, buffer);
          screenshotUrl = `/uploads/screenshots/${filename}`;
        }
      }

      // Valid priority check
      const validPriority = Object.values(IssuePriority).includes(priority as IssuePriority)
        ? (priority as IssuePriority)
        : IssuePriority.MEDIUM;

      // Fetch user organization details for cross-tenant visibility
      const userOrg = await prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { id: true, name: true, subdomain: true, code: true },
      });

      if (!userOrg) {
        return res.status(404).json({ error: 'Organization not found for reporter.' });
      }

      // Fetch reporter branch context for hierarchical escalation
      const reporterUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, baseBranchId: true, scopedBranchId: true, role: true },
      });

      const effectiveBranchId = reporterUser?.scopedBranchId || reporterUser?.baseBranchId || null;
      let targetLevel = 'BRANCH_ADMIN';
      if (user.role === Role.BRANCH_ADMIN || !effectiveBranchId) {
        targetLevel = 'ORGANIZATION_ADMIN';
      }
      if (user.role === Role.ORGANIZATION_ADMIN || user.role === Role.PLATFORM_ADMIN) {
        targetLevel = 'PLATFORM_ADMIN';
      }

      // Create issue report in database with clean metadata
      const issueReport = await prisma.issueReport.create({
        data: {
          title: title.trim(),
          description: description.trim(),
          category: category ? String(category).trim() : 'GENERAL',
          priority: validPriority,
          screenshotUrl,
          targetLevel,
          branchId: effectiveBranchId,
          status: IssueStatus.OPEN,
          reporterId: user.id,
          organizationId: userOrg.id,
        },
        include: {
          reporter: {
            select: { id: true, name: true, email: true, role: true },
          },
          organization: {
            select: { id: true, name: true, code: true, subdomain: true },
          },
        },
      });

      // Audit Log for the issue submission
      await prisma.auditLog.create({
        data: {
          organizationId: userOrg.id,
          actorUserId: user.id,
          action: 'REPORT_ISSUE',
          entityType: 'IssueReport',
          entityId: issueReport.id,
          metadata: {
            title: issueReport.title,
            priority: issueReport.priority,
            category: issueReport.category,
            targetLevel: issueReport.targetLevel,
          },
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Issue report submitted successfully.',
        issue: issueReport,
      });
    } catch (error: any) {
      console.error('Failed to submit issue report:', error);
      return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
  }
);

// 2. Get Platform Issue Statistics (Superadmin Only)
router.get(
  '/stats',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN]),
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const [total, open, inProgress, resolved, critical] = await Promise.all([
        prisma.issueReport.count(),
        prisma.issueReport.count({ where: { status: IssueStatus.OPEN } }),
        prisma.issueReport.count({ where: { status: IssueStatus.IN_PROGRESS } }),
        prisma.issueReport.count({ where: { status: IssueStatus.RESOLVED } }),
        prisma.issueReport.count({
          where: {
            priority: IssuePriority.CRITICAL,
            status: { not: IssueStatus.RESOLVED },
          },
        }),
      ]);

      return res.json({
        total,
        open,
        inProgress,
        resolved,
        critical,
      });
    } catch (error: any) {
      console.error('Failed to fetch issue statistics:', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch statistics.' });
    }
  }
);

// 3. Get All Issue Reports (Superadmin Only with Filtering, Search & Pagination)
router.get(
  '/',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        status,
        priority,
        organizationId,
        q,
        page = '1',
        limit = '15',
      } = req.query;

      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 15));
      const skip = (pageNum - 1) * limitNum;

      const where: any = {};

      if (status && status !== 'ALL') {
        where.status = status;
      }

      if (priority && priority !== 'ALL') {
        where.priority = priority;
      }

      if (organizationId && organizationId !== 'ALL') {
        where.organizationId = String(organizationId);
      }

      if (q && typeof q === 'string' && q.trim()) {
        const query = q.trim();
        where.OR = [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { reporter: { name: { contains: query, mode: 'insensitive' } } },
          { reporter: { email: { contains: query, mode: 'insensitive' } } },
          { organization: { name: { contains: query, mode: 'insensitive' } } },
        ];
      }

      const [totalCount, issues] = await Promise.all([
        prisma.issueReport.count({ where }),
        prisma.issueReport.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: [
            { status: 'asc' }, // OPEN first, then IN_PROGRESS, then RESOLVED
            { createdAt: 'desc' },
          ],
          include: {
            reporter: {
              select: { id: true, name: true, email: true, role: true },
            },
            organization: {
              select: { id: true, name: true, code: true, subdomain: true },
            },
            resolvedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        }),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum) || 1;

      return res.json({
        issues,
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalCount,
          totalPages,
        },
      });
    } catch (error: any) {
      console.error('Failed to query issue reports:', error);
      return res.status(500).json({ error: error.message || 'Failed to query reports.' });
    }
  }
);

// 4. Update Issue Report Status and Resolution Note (Superadmin Only)
router.patch(
  '/:id/status',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { status, resolutionNote } = req.body;

      if (!status || !Object.values(IssueStatus).includes(status)) {
        return res.status(400).json({ error: 'Valid status (OPEN, IN_PROGRESS, RESOLVED) is required.' });
      }

      const existing = await prisma.issueReport.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Issue report not found.' });
      }

      const isResolving = status === IssueStatus.RESOLVED;

      const updated = await prisma.issueReport.update({
        where: { id },
        data: {
          status,
          resolutionNote: resolutionNote !== undefined ? String(resolutionNote).trim() : existing.resolutionNote,
          resolvedById: isResolving ? req.user!.id : (status === IssueStatus.OPEN ? null : existing.resolvedById),
        },
        include: {
          reporter: {
            select: { id: true, name: true, email: true, role: true },
          },
          organization: {
            select: { id: true, name: true, code: true, subdomain: true },
          },
          resolvedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // Audit Log status transition
      await prisma.auditLog.create({
        data: {
          organizationId: updated.organizationId,
          actorUserId: req.user!.id,
          action: isResolving ? 'RESOLVE_ISSUE' : 'UPDATE_ISSUE_STATUS',
          entityType: 'IssueReport',
          entityId: updated.id,
          metadata: {
            previousStatus: existing.status,
            newStatus: updated.status,
            resolutionNote: updated.resolutionNote,
          },
        },
      });

      return res.json({
        success: true,
        message: `Issue report status updated to ${status}.`,
        issue: updated,
      });
    } catch (error: any) {
      console.error('Failed to update issue report:', error);
      return res.status(500).json({ error: error.message || 'Failed to update issue status.' });
    }
  }
);

// 5. Delete an Issue Report (Superadmin Only - for test/spam cleanup)
router.delete(
  '/:id',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const existing = await prisma.issueReport.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Issue report not found.' });
      }

      // Remove screenshot file from disk if local
      if (existing.screenshotUrl && existing.screenshotUrl.startsWith('/uploads/screenshots/')) {
        const localPath = path.join(__dirname, '../..', existing.screenshotUrl);
        if (fs.existsSync(localPath)) {
          try {
            fs.unlinkSync(localPath);
          } catch (e) {
            console.warn('Failed to delete screenshot file from disk:', e);
          }
        }
      }

      await prisma.issueReport.delete({
        where: { id },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: existing.organizationId,
          actorUserId: req.user!.id,
          action: 'DELETE_ISSUE_REPORT',
          entityType: 'IssueReport',
          entityId: id,
          metadata: { title: existing.title },
        },
      });

      return res.json({ success: true, message: 'Issue report deleted successfully.' });
    } catch (error: any) {
      console.error('Failed to delete issue report:', error);
      return res.status(500).json({ error: error.message || 'Failed to delete issue report.' });
    }
  }
);

export default router;
