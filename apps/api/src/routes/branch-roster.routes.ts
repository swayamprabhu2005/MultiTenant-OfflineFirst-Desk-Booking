import { Router, Response } from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.middleware';
import { Role } from '@deskbooking/shared';
import {
  generateBranchEmployeeTemplate,
  exportBranchEmployeesToExcel,
} from '../services/excel.service';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Helper to resolve target branch for the request
 */
async function resolveBranch(req: AuthenticatedRequest) {
  const orgId = req.organizationId!;
  const user = req.user!;

  if (user.role === Role.BRANCH_ADMIN) {
    if (!user.scopedBranchId) return null;
    return await prisma.branch.findFirst({
      where: { id: user.scopedBranchId, organizationId: orgId },
    });
  }

  // Org Admin / Platform Admin can pass branchId in query or body
  const branchId = (req.query.branchId as string) || (req.body?.branchId as string);
  if (branchId) {
    return await prisma.branch.findFirst({
      where: { id: branchId, organizationId: orgId },
    });
  }

  // Fallback to first branch
  return await prisma.branch.findFirst({
    where: { organizationId: orgId },
    orderBy: { code: 'asc' },
  });
}

/**
 * GET /api/branch-roster/employees
 * Returns all employees belonging to the scoped branch
 */
router.get(
  '/employees',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN, Role.BRANCH_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const branch = await resolveBranch(req);

      if (!branch) {
        return res.status(404).json({ error: 'Assigned branch not found.' });
      }

      const employees = await prisma.user.findMany({
        where: {
          organizationId: orgId,
          role: Role.EMPLOYEE,
          OR: [
            { scopedBranchId: branch.id },
            { baseBranchId: branch.id },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          isActive: true,
          status: true,
          mustChangePassword: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      });

      return res.json({
        branch: {
          id: branch.id,
          name: branch.name,
          code: branch.code,
        },
        employees,
        total: employees.length,
      });
    } catch (error: any) {
      console.error('Failed to load branch employees:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/branch-roster/employee
 * Manually add a single employee to the branch
 */
router.post(
  '/employee',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN, Role.BRANCH_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const branch = await resolveBranch(req);

      if (!branch) {
        return res.status(404).json({ error: 'Assigned branch not found.' });
      }

      const { name, email, department, password } = req.body;

      if (!name || !email) {
        return res.status(400).json({ error: 'Employee Full Name and Email are required.' });
      }

      if (!EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ error: 'Please enter a valid corporate email address.' });
      }

      const existing = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      if (existing) {
        return res.status(400).json({ error: 'An account with this email address already exists.' });
      }

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      const fallbackPassword = org?.defaultBranchAdminPassword || org?.name || 'DeskBook$2026#Initial';
      const targetPassword = password && password.trim().length >= 6 ? password.trim() : fallbackPassword;
      const passwordHash = await bcrypt.hash(targetPassword, 10);

      const user = await prisma.user.create({
        data: {
          organizationId: orgId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          department: department?.trim() || null,
          role: Role.EMPLOYEE,
          scopedBranchId: branch.id,
          baseBranchId: branch.id,
          passwordHash,
          mustChangePassword: true,
          isActive: true,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          isActive: true,
          status: true,
          mustChangePassword: true,
          createdAt: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorUserId: req.user!.id,
          action: 'CREATE_BRANCH_EMPLOYEE',
          entityType: 'User',
          entityId: user.id,
          metadata: { name: user.name, email: user.email, branchName: branch.name },
        },
      });

      return res.status(201).json({ success: true, user });
    } catch (error: any) {
      console.error('Failed to create employee:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * PUT /api/branch-roster/employee/:id
 * Edit employee Name and Email
 */
router.put(
  '/employee/:id',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN, Role.BRANCH_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const { id } = req.params;
      const { name, email, department } = req.body;

      if (!name || !email) {
        return res.status(400).json({ error: 'Employee Full Name and Email are required.' });
      }

      if (!EMAIL_REGEX.test(email.trim())) {
        return res.status(400).json({ error: 'Please enter a valid corporate email address.' });
      }

      const user = await prisma.user.findFirst({
        where: { id, organizationId: orgId, role: Role.EMPLOYEE },
      });

      if (!user) {
        return res.status(404).json({ error: 'Employee record not found in your organization.' });
      }

      // If email changed, ensure no conflict
      if (email.trim().toLowerCase() !== user.email) {
        const conflict = await prisma.user.findUnique({
          where: { email: email.trim().toLowerCase() },
        });
        if (conflict) {
          return res.status(400).json({ error: 'An account with this email address already exists.' });
        }
      }

      const updated = await prisma.user.update({
        where: { id },
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          ...(department !== undefined ? { department: department ? department.trim() : null } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          department: true,
          isActive: true,
          status: true,
          mustChangePassword: true,
          createdAt: true,
        },
      });

      return res.json({ success: true, user: updated });
    } catch (error: any) {
      console.error('Failed to update employee:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * PATCH /api/branch-roster/employee/:id/toggle-status
 * Toggle employee active / deactivated state
 */
router.patch(
  '/employee/:id/toggle-status',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN, Role.BRANCH_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const { id } = req.params;

      const user = await prisma.user.findFirst({
        where: { id, organizationId: orgId, role: Role.EMPLOYEE },
      });

      if (!user) {
        return res.status(404).json({ error: 'Employee record not found.' });
      }

      const newIsActive = !user.isActive;
      const newStatus = newIsActive ? 'ACTIVE' : 'DEACTIVATED';

      const updated = await prisma.user.update({
        where: { id },
        data: {
          isActive: newIsActive,
          status: newStatus,
        },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          status: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorUserId: req.user!.id,
          action: newIsActive ? 'REACTIVATE_EMPLOYEE' : 'DEACTIVATE_EMPLOYEE',
          entityType: 'User',
          entityId: id,
          metadata: { email: user.email, name: user.name, newStatus },
        },
      });

      return res.json({
        success: true,
        user: updated,
        message: `Account for ${user.name} is now ${newStatus.toLowerCase()}.`,
      });
    } catch (error: any) {
      console.error('Failed to toggle status:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/branch-roster/template
 * Download Option A Formula-Assisted Employee Excel Template
 */
router.get(
  '/template',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN, Role.BRANCH_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const branch = await resolveBranch(req);

      if (!branch) {
        return res.status(404).json({ error: 'Assigned branch not found.' });
      }

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      const queryDomain = (req.query.domain as string)?.trim();
      const corporateDomain = queryDomain || `${org?.subdomain || 'company'}.com`;

      const buffer = await generateBranchEmployeeTemplate(
        corporateDomain,
        branch.code,
        branch.name
      );

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Employee_Roster_${branch.code}_${corporateDomain.replace(/[^a-zA-Z0-9.-]/g, '_')}.xlsx"`
      );
      return res.send(buffer);
    } catch (error: any) {
      console.error('Failed to generate employee template:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/branch-roster/import
 * Idempotent batch upload of employees via formula-assisted Excel spreadsheet
 */
router.post(
  '/import',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN, Role.BRANCH_ADMIN]),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const branch = await resolveBranch(req);

      if (!branch) {
        return res.status(404).json({ error: 'Assigned branch not found.' });
      }

      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'Please upload a valid Excel (.xlsx) file.' });
      }

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      const orgDomain = `${org?.subdomain || 'company'}.com`;

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.file.buffer as any);

      // Read domain from hidden Config sheet if available
      const configSheet = workbook.getWorksheet('Config');
      const corporateDomain = configSheet?.getCell('B1').text?.trim() || orgDomain;

      const sheet = workbook.getWorksheet('Employee Roster') || workbook.worksheets[0];
      if (!sheet) {
        return res.status(400).json({ error: 'Invalid file: Missing Employee Roster worksheet.' });
      }

      let importedCount = 0;
      let updatedCount = 0;
      const errors: string[] = [];

      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const fullName = row.getCell(3).text?.trim();
        const department = row.getCell(4).text?.trim() || null;

        // Cell 5 is Email (may contain formula or calculated text)
        let email = row.getCell(5).text?.trim().toLowerCase();
        // If blank or formula uncomputed by client software, calculate dynamically
        if (!email && fullName) {
          email = `${fullName.toLowerCase().replace(/\s+/g, '.')}@${corporateDomain}`.toLowerCase();
        }

        // Cell 6 is Password (may contain formula or calculated text)
        let rawPassword = row.getCell(6).text?.trim();
        if (!rawPassword && fullName) {
          const initials = fullName.slice(0, 3).toUpperCase();
          rawPassword = `DeskBook$${new Date().getFullYear()}#${initials}!${r}`;
        }

        if (!fullName && !email) continue;

        if (!fullName) {
          errors.push(`Row ${r}: Employee Full Name is missing.`);
          continue;
        }

        if (!email || !EMAIL_REGEX.test(email)) {
          errors.push(`Row ${r}: '${email || ''}' is not a valid email address.`);
          continue;
        }

        const targetPassword = rawPassword && rawPassword.length >= 6 ? rawPassword : `DeskBook$${new Date().getFullYear()}#Emp!${r}`;
        const passwordHash = await bcrypt.hash(targetPassword, 10);

        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          // Idempotent update: synchronize name, department, and branch without wiping existing password
          await prisma.user.update({
            where: { email },
            data: {
              name: fullName,
              department,
              scopedBranchId: branch.id,
              baseBranchId: branch.id,
              status: 'ACTIVE',
              isActive: true,
            },
          });
          updatedCount++;
        } else {
          // Create fresh account with mustChangePassword = true
          await prisma.user.create({
            data: {
              organizationId: orgId,
              name: fullName,
              email,
              department,
              role: Role.EMPLOYEE,
              scopedBranchId: branch.id,
              baseBranchId: branch.id,
              passwordHash,
              mustChangePassword: true,
              isActive: true,
              status: 'ACTIVE',
            },
          });
          importedCount++;
        }
      }

      if (errors.length > 0 && importedCount === 0 && updatedCount === 0) {
        return res.status(400).json({ error: errors.join(' | ') });
      }

      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorUserId: req.user!.id,
          action: 'IMPORT_BRANCH_EMPLOYEES',
          entityType: 'User',
          entityId: branch.id,
          metadata: {
            branchName: branch.name,
            importedCount,
            updatedCount,
            errorsCount: errors.length,
          },
        },
      });

      return res.json({
        success: true,
        importedCount,
        updatedCount,
        totalProcessed: importedCount + updatedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully processed ${importedCount + updatedCount} employee record(s) (${importedCount} new, ${updatedCount} synchronized).`,
      });
    } catch (error: any) {
      console.error('Failed to import employees:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/branch-roster/export
 * Download active and deactivated employees in .xlsx format
 */
router.get(
  '/export',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN, Role.BRANCH_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const branch = await resolveBranch(req);

      if (!branch) {
        return res.status(404).json({ error: 'Assigned branch not found.' });
      }

      const employees = await prisma.user.findMany({
        where: {
          organizationId: orgId,
          role: Role.EMPLOYEE,
          OR: [
            { scopedBranchId: branch.id },
            { baseBranchId: branch.id },
          ],
        },
        select: {
          name: true,
          email: true,
          department: true,
          status: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      });

      const buffer = await exportBranchEmployeesToExcel(branch.name, employees);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Employee_Directory_${branch.code}.xlsx"`
      );
      return res.send(buffer);
    } catch (error: any) {
      console.error('Failed to export employee directory:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

export default router;
