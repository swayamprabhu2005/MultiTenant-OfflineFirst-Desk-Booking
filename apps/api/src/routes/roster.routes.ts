import { Router, Response } from 'express';
import { parse } from 'csv-parse/sync';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.middleware';
import { Role } from '@deskbooking/shared';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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
    if (currentUser.role === Role.BRANCH_ADMIN && currentUser.scopedBranchId) {
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

    const orgId = req.organizationId!;
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { subdomain: true },
    });
    const initialPassword = org?.subdomain || defaultPassword || 'Welcome123!';
    const passwordHash = await bcrypt.hash(initialPassword, 10);

    let importedCount = 0;

    for (const record of records) {
      const name = record.Name || record.name;
      const email = (record.Email || record.email || '').toLowerCase();
      const department = record.Department || record.department || null;
      const branchCode = (record.BaseBranchCode || record.baseBranchCode || '').toUpperCase();
      const roleStr = (record.Role || record.role || 'EMPLOYEE').toUpperCase();

      if (!name || !email) continue;

      let role: Role = Role.EMPLOYEE;
      if (roleStr === 'ORGANIZATION_ADMIN' || roleStr === 'ADMIN') role = Role.ORGANIZATION_ADMIN;
      else if (roleStr === 'BRANCH_ADMIN') role = Role.BRANCH_ADMIN;
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

      await prisma.user.upsert({
        where: { email },
        update: {
          name,
          department,
          baseBranchId,
          role: role as any,
        },
        create: {
          organizationId: orgId,
          name,
          email,
          passwordHash,
          department,
          baseBranchId,
          role: role as any,
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

    const org = await prisma.organization.findUnique({
      where: { id: req.organizationId! },
      select: { subdomain: true },
    });
    const targetPassword = password && password !== 'Welcome123!' ? password : (org?.subdomain || 'Welcome123!');

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(targetPassword, 10);
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
        scopedBranchId: true,
        baseBranchId: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: req.organizationId!,
        actorUserId: req.user!.id,
        action: 'CREATE_USER',
        entityType: 'User',
        entityId: user.id,
        metadata: { name: user.name, email: user.email, role: user.role, scopedBranchId: user.scopedBranchId },
      },
    });

    return res.status(201).json(user);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/roster/branch-admins
 * Returns all branches for the organization with their assigned branch administrator
 */
router.get('/branch-admins', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const branches = await prisma.branch.findMany({
      where: { organizationId: orgId },
      include: {
        scopedUsers: {
          where: { role: Role.BRANCH_ADMIN, status: 'ACTIVE' },
          select: { id: true, name: true, email: true, role: true, createdAt: true },
        },
      },
      orderBy: { code: 'asc' },
    });

    const result = branches.map(b => ({
      branchId: b.id,
      branchCode: b.code,
      branchName: b.name,
      admin: b.scopedUsers.length > 0 ? b.scopedUsers[0] : null,
    }));

    return res.json(result);
  } catch (error: any) {
    console.error('Failed to load branch admins:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/roster/branch-admin-template
 * Generates an Excel template with pre-filled Branch IDs and Branch Names
 */
router.get('/branch-admin-template', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const org = await prisma.organization.findUnique({ where: { id: orgId } });
    const branches = await prisma.branch.findMany({
      where: { organizationId: orgId },
      orderBy: { code: 'asc' },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Branch Administrators');
    sheet.views = [{ showGridLines: true }];

    const headerRow = sheet.getRow(1);
    headerRow.values = [
      'Branch ID',
      'Branch Name',
      'Administrator Full Name',
      'Administrator Email',
      'Initial Password',
    ];
    headerRow.font = { name: 'Segoe UI', size: 10, bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    // Navy Read-Only for Col A & B
    headerRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    headerRow.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
    headerRow.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };

    // Yellow User-Input for Col C, D, E
    for (let c = 3; c <= 5; c++) {
      headerRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
      headerRow.getCell(c).font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF002060' } };
    }

    branches.forEach((b, idx) => {
      const row = sheet.getRow(idx + 2);
      row.getCell(1).value = b.code;
      row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } };
      row.getCell(1).font = { name: 'Segoe UI', size: 10, bold: true };
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      row.getCell(2).value = b.name;
      row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F4F7' } };
      row.getCell(2).font = { name: 'Segoe UI', size: 10, bold: true };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

      for (let c = 3; c <= 5; c++) {
        row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
        row.getCell(c).font = { name: 'Segoe UI', size: 10 };
        row.getCell(c).alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });

    sheet.getColumn(1).width = 18;
    sheet.getColumn(2).width = 30;
    sheet.getColumn(3).width = 32;
    sheet.getColumn(4).width = 36;
    sheet.getColumn(5).width = 26;

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Branch_Admin_Roster_${org?.code || 'Template'}.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('Failed to generate branch admin template:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/roster/branch-admin-import
 * Bulk upload and assignment of branch administrators via Excel
 */
router.post('/branch-admin-import', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Please upload a valid Excel (.xlsx) file.' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer as any);

    const sheet = workbook.getWorksheet('Branch Administrators') || workbook.worksheets[0];
    if (!sheet) {
      return res.status(400).json({ error: 'Invalid file format: Worksheet missing.' });
    }

    const branches = await prisma.branch.findMany({ where: { organizationId: orgId } });
    const branchMap = new Map(branches.map(b => [b.code.toUpperCase(), b]));

    let assignedCount = 0;
    const errors: string[] = [];

    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const branchCode = row.getCell(1).text?.trim().toUpperCase();
      const adminName = row.getCell(3).text?.trim();
      const adminEmail = row.getCell(4).text?.trim().toLowerCase();
      const rawPassword = row.getCell(5).text?.trim();

      if (!branchCode && !adminName && !adminEmail) continue;

      if (!branchCode || !branchMap.has(branchCode)) {
        errors.push(`Row ${r}: Branch ID '${branchCode}' is invalid or does not belong to your organization.`);
        continue;
      }

      if (!adminName) {
        errors.push(`Row ${r}: Administrator Name is missing for branch ${branchCode}.`);
        continue;
      }

      if (!adminEmail || !EMAIL_REGEX.test(adminEmail)) {
        errors.push(`Row ${r}: '${adminEmail || ''}' is not a valid email address.`);
        continue;
      }

      const branch = branchMap.get(branchCode)!;
      const targetPassword = rawPassword && rawPassword.length >= 8 ? rawPassword : 'DeskBook$2026#BranchOps';
      const passwordHash = await bcrypt.hash(targetPassword, 10);

      await prisma.user.upsert({
        where: { email: adminEmail },
        update: {
          name: adminName,
          role: Role.BRANCH_ADMIN,
          scopedBranchId: branch.id,
          passwordHash,
          mustChangePassword: false,
          status: 'ACTIVE',
        },
        create: {
          organizationId: orgId,
          name: adminName,
          email: adminEmail,
          passwordHash,
          role: Role.BRANCH_ADMIN,
          scopedBranchId: branch.id,
          mustChangePassword: false,
          status: 'ACTIVE',
        },
      });

      assignedCount++;
    }

    if (errors.length > 0 && assignedCount === 0) {
      return res.status(400).json({ error: errors.join(' | ') });
    }

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorUserId: req.user!.id,
        action: 'IMPORT_BRANCH_ADMINS',
        entityType: 'User',
        entityId: orgId,
        metadata: { assignedCount, errorsCount: errors.length },
      },
    });

    return res.json({
      success: true,
      count: assignedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully assigned ${assignedCount} branch administrator(s).`,
    });
  } catch (error: any) {
    console.error('Failed to import branch admins:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/roster/branch-admin
 * Manually assign a single branch administrator
 */
router.post('/branch-admin', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const { branchId, name, email, password } = req.body;

    if (!branchId || !name || !email) {
      return res.status(400).json({ error: 'Branch, Administrator Name, and Email are required.' });
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId: orgId },
    });
    if (!branch) {
      return res.status(404).json({ error: 'Branch not found in your organization.' });
    }

    const targetPassword = password && password.trim().length >= 8 ? password.trim() : 'DeskBook$2026#BranchOps';
    const passwordHash = await bcrypt.hash(targetPassword, 10);

    const user = await prisma.user.upsert({
      where: { email: email.trim().toLowerCase() },
      update: {
        name: name.trim(),
        role: Role.BRANCH_ADMIN,
        scopedBranchId: branch.id,
        passwordHash,
        mustChangePassword: false,
        status: 'ACTIVE',
      },
      create: {
        organizationId: orgId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role: Role.BRANCH_ADMIN,
        scopedBranchId: branch.id,
        mustChangePassword: false,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        scopedBranchId: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorUserId: req.user!.id,
        action: 'ASSIGN_BRANCH_ADMIN',
        entityType: 'User',
        entityId: user.id,
        metadata: { name: user.name, email: user.email, branchName: branch.name },
      },
    });

    return res.status(201).json({ success: true, user });
  } catch (error: any) {
    console.error('Failed to assign branch admin:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/roster/branch-admin/:id
 * Manually update branch administrator details
 */
router.put('/branch-admin/:id', authMiddleware, requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const { id } = req.params;
    const { name, email, branchId } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and Email are required.' });
    }

    if (!EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const user = await prisma.user.findFirst({
      where: { id, organizationId: orgId },
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        ...(branchId ? { scopedBranchId: branchId } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        scopedBranchId: true,
      },
    });

    return res.json({ success: true, user: updatedUser });
  } catch (error: any) {
    console.error('Failed to update branch admin:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
