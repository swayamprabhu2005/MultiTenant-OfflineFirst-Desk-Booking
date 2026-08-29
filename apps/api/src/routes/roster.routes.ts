import { Router, Response } from 'express';
import { parse } from 'csv-parse/sync';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.middleware';
import { Role } from '@deskbooking/shared';

const router = Router();

// GET list of users in organization (with search & pagination)
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { page = 1, limit = 25, q } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const currentUser = req.user!;
    const where: any = {
      organizationId: req.organizationId!,
    };

    // Scoped branch admin check
    if (currentUser.role === Role.ORGANIZATION_ADMIN && currentUser.scopedBranchId) {
      where.baseBranchId = currentUser.scopedBranchId;
    }

    if (q) {
      const searchStr = String(q).toLowerCase();
      where.OR = [
        { name: { contains: searchStr, mode: 'insensitive' } },
        { email: { contains: searchStr, mode: 'insensitive' } },
        { department: { contains: searchStr, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          department: true,
          baseBranchId: true,
          baseBranch: { select: { name: true } },
          baseBuildingId: true,
          scopedBranchId: true,
          scopedBranch: { select: { name: true } },
          teamLeadId: true,
          teamLead: { select: { name: true, email: true } },
          status: true,
          mustChangePassword: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({
      users,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// CSV Roster Import
router.post('/import-csv', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { csvContent, defaultPassword } = req.body;

    if (!csvContent || typeof csvContent !== 'string') {
      return res.status(400).json({ error: 'csvContent is required' });
    }

    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or formatted invalidly' });
    }

    const initialPassword = defaultPassword || 'Welcome123!';
    const passwordHash = await bcrypt.hash(initialPassword, 10);
    const orgId = req.organizationId!;

    let importedCount = 0;

    for (const record of records) {
      const name = record.Name || record.name;
      const email = (record.Email || record.email || '').toLowerCase();
      const department = record.Department || record.department || null;
      const bCode = (record.BaseOfficeBuildingCode || record.baseOfficeBuildingCode || '').toUpperCase();
      const branchCode = (record.BaseBranchCode || record.baseBranchCode || '').toUpperCase();
      const teamLeadEmail = (record.TeamLeadEmail || record.teamLeadEmail || '').toLowerCase();
      const roleStr = (record.Role || record.role || 'EMPLOYEE').toUpperCase();

      if (!name || !email) continue;

      let role: Role = Role.EMPLOYEE;
      if (roleStr === 'ORGANIZATION_ADMIN' || roleStr === 'ADMIN') role = Role.ORGANIZATION_ADMIN;
      else if (roleStr === 'TECH_LEAD' || roleStr === 'LEAD') role = Role.TECH_LEAD;

      // Find or create branch
      let baseBranchId: string | null = null;
      if (branchCode) {
        let branch = await prisma.branch.findUnique({
          where: { organizationId_code: { organizationId: orgId, code: branchCode } }
        });
        if (!branch) {
          branch = await prisma.branch.create({
            data: { organizationId: orgId, code: branchCode, name: `${branchCode} Branch` }
          });
        }
        baseBranchId = branch.id;
      }

      // Find building
      let baseBuildingId: string | null = null;
      if (bCode) {
        const building = await prisma.building.findUnique({
          where: { organizationId_code: { organizationId: orgId, code: bCode } }
        });
        baseBuildingId = building ? building.id : null;
      }

      // Find team lead
      let teamLeadId: string | null = null;
      if (teamLeadEmail) {
        const teamLead = await prisma.user.findFirst({
          where: { email: teamLeadEmail, organizationId: orgId }
        });
        teamLeadId = teamLead ? teamLead.id : null;
      }

      await prisma.user.upsert({
        where: { email },
        update: {
          name,
          department,
          baseBranchId,
          baseBuildingId,
          role: role as any,
          teamLeadId,
        },
        create: {
          organizationId: orgId,
          name,
          email,
          passwordHash,
          department,
          baseBranchId,
          baseBuildingId,
          role: role as any,
          teamLeadId,
          mustChangePassword: true,
        },
      });

      importedCount++;
    }

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorUserId: req.user!.id,
        action: 'CSV_EMPLOYEE_ROSTER_IMPORT',
        entityType: 'User',
        entityId: orgId,
        metadata: { importedRecords: importedCount },
      },
    });

    return res.json({
      message: `Successfully imported ${importedCount} employees from CSV.`,
      count: importedCount,
      defaultPassword: initialPassword,
    });
  } catch (error: any) {
    console.error('Roster import error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Create single user
router.post('/', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, email, password, role, department, baseBranchId, baseBuildingId, scopedBranchId, teamLeadId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Scoped branch admin check
    const currentUser = req.user!;
    if (currentUser.role === Role.ORGANIZATION_ADMIN && currentUser.scopedBranchId) {
      if (baseBranchId && baseBranchId !== currentUser.scopedBranchId) {
        return res.status(403).json({ error: 'Forbidden: Scoped Branch Admins can only create users in their branch' });
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        organizationId: req.organizationId!,
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: (role || Role.EMPLOYEE) as any,
        department: department || null,
        baseBranchId: baseBranchId || null,
        baseBuildingId: baseBuildingId || null,
        scopedBranchId: scopedBranchId || null,
        teamLeadId: teamLeadId || null,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        baseBranchId: true,
        baseBuildingId: true,
        scopedBranchId: true,
        teamLeadId: true,
        createdAt: true,
      },
    });

    return res.status(201).json(user);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
