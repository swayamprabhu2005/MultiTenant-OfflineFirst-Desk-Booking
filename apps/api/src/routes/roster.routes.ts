import { Router, Response } from 'express';
import { parse } from 'csv-parse/sync';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.middleware';
import { Role } from '@deskbooking/shared';

const router = Router();

// GET list of users in organization
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { organizationId: req.organizationId! },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        baseBuildingId: true,
        status: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
    return res.json(users);
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

    const buildings = await prisma.building.findMany({
      where: { organizationId: orgId },
    });
    const buildingMap = new Map(buildings.map((b: any) => [b.code.toUpperCase(), b.id]));

    let importedCount = 0;

    for (const record of records) {
      const name = record.Name || record.name;
      const email = (record.Email || record.email || '').toLowerCase();
      const department = record.Department || record.department || null;
      const bCode = (record.BaseOfficeBuildingCode || record.baseOfficeBuildingCode || record.BuildingCode || '').toUpperCase();
      const roleStr = (record.Role || record.role || 'EMPLOYEE').toUpperCase();

      if (!name || !email) continue;

      let role: Role = Role.EMPLOYEE;
      if (roleStr.includes('ADMIN')) role = Role.ORGANIZATION_ADMIN;

      const baseBuildingId = buildingMap.get(bCode) || (buildings.length > 0 ? buildings[0].id : null);

      await prisma.user.upsert({
        where: { email },
        update: {
          name,
          department,
          baseBuildingId,
          role: role as any,
        },
        create: {
          organizationId: orgId,
          name,
          email,
          passwordHash,
          department,
          baseBuildingId,
          role: role as any,
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
    const { name, email, password, role, department, baseBuildingId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
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
        baseBuildingId: baseBuildingId || null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        baseBuildingId: true,
        createdAt: true,
      },
    });

    return res.status(201).json(user);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
