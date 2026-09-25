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
  generateBranchFloorPlanTemplate,
  parseAndValidateBranchFloorPlan,
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

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      const orgDomain = `${org?.subdomain || 'company'}.com`;
      const defaultPassword = branch.defaultEmployeePassword || org?.name || 'Welcome123!';

      return res.json({
        branch: {
          id: branch.id,
          name: branch.name,
          code: branch.code,
          defaultEmployeePassword: branch.defaultEmployeePassword,
        },
        corporateDomain: orgDomain,
        defaultPassword,
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
 * GET /api/branch-roster/config
 * Returns branch metadata, corporate domain, and active default password
 */
router.get(
  '/config',
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
      const orgDomain = `${org?.subdomain || 'company'}.com`;
      const defaultPassword = branch.defaultEmployeePassword || org?.name || 'Welcome123!';

      return res.json({
        branch: {
          id: branch.id,
          name: branch.name,
          code: branch.code,
          defaultEmployeePassword: branch.defaultEmployeePassword,
        },
        corporateDomain: orgDomain,
        defaultPassword,
      });
    } catch (error: any) {
      console.error('Failed to load branch config:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * PATCH /api/branch-roster/default-password
 * Set or update the branch default temporary employee password
 */
router.patch(
  '/default-password',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN, Role.BRANCH_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const branch = await resolveBranch(req);

      if (!branch) {
        return res.status(404).json({ error: 'Assigned branch not found.' });
      }

      const { defaultPassword } = req.body;
      if (!defaultPassword || typeof defaultPassword !== 'string' || defaultPassword.trim().length < 4) {
        return res.status(400).json({ error: 'Default password must be at least 4 characters long.' });
      }

      const trimmedPassword = defaultPassword.trim();
      const updatedBranch = await prisma.branch.update({
        where: { id: branch.id },
        data: { defaultEmployeePassword: trimmedPassword },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorUserId: req.user!.id,
          action: 'UPDATE_BRANCH_DEFAULT_PASSWORD',
          entityType: 'Branch',
          entityId: branch.id,
          metadata: {
            branchCode: branch.code,
            branchName: branch.name,
            updatedAt: new Date().toISOString(),
          },
        },
      });

      return res.json({
        success: true,
        message: 'Default employee temporary password updated successfully.',
        defaultPassword: updatedBranch.defaultEmployeePassword,
      });
    } catch (error: any) {
      console.error('Failed to update branch default password:', error);
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
      const orgDomain = `${org?.subdomain || 'company'}.com`;
      const orgNameClean = org?.name ? org.name.toLowerCase().replace(/[^a-z0-9]/g, '') : orgDomain;
      const fallbackPassword = branch.defaultEmployeePassword || orgNameClean || org?.defaultBranchAdminPassword || orgDomain;
      const targetPassword = password && password.trim().length >= 4 ? password.trim() : fallbackPassword;
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
      const queryPassword = (req.query.defaultPassword as string)?.trim();
      const defaultPassword = queryPassword || branch.defaultEmployeePassword || org?.name || 'Welcome123!';

      const buffer = await generateBranchEmployeeTemplate(
        corporateDomain,
        branch.code,
        branch.name,
        defaultPassword
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

      // Read domain and default password from Config sheet if available
      const configSheet = workbook.getWorksheet('Config');
      // In new 3-col format: B2 is Corporate Email Domain, B5 is Default Initial Password
      // In legacy format: B1 was CorporateDomain
      const corporateDomain =
        configSheet?.getCell('B2').text?.trim() ||
        configSheet?.getCell('B1').text?.trim() ||
        orgDomain;

      const defaultPasswordFromConfig =
        configSheet?.getCell('B5').text?.trim() ||
        branch.defaultEmployeePassword ||
        corporateDomain;

      const sheet = workbook.getWorksheet('Employee Roster') || workbook.worksheets[0];
      if (!sheet) {
        return res.status(400).json({ error: 'Invalid file: Missing Employee Roster worksheet.' });
      }

      // Detect modern 3-column layout vs legacy 6-column layout
      const headerRow = sheet.getRow(1);
      const h1 = headerRow.getCell(1).text?.trim().toLowerCase();
      const isModern3Col = h1.includes('full name') || h1.includes('employee');

      let importedCount = 0;
      let updatedCount = 0;
      const errors: string[] = [];

      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const fullName = isModern3Col ? row.getCell(1).text?.trim() : row.getCell(3).text?.trim();

        // Email: Col 2 in modern 3-col, Col 5 in legacy 6-col
        let email = (isModern3Col ? row.getCell(2).text : row.getCell(5).text)?.trim().toLowerCase();
        // If blank or formula uncomputed by client software, calculate dynamically
        if (!email && fullName) {
          email = `${fullName.toLowerCase().replace(/\s+/g, '.')}@${corporateDomain}`.toLowerCase();
        }

        // Password: Col 3 in modern 3-col, Col 6 in legacy 6-col
        let rawPassword = (isModern3Col ? row.getCell(3).text : row.getCell(6).text)?.trim();
        if (!rawPassword && fullName) {
          rawPassword = defaultPasswordFromConfig;
        }

        // Skip completely empty rows
        if (!fullName && !email) continue;

        if (!fullName) {
          errors.push(`Row ${r}: Employee Full Name is missing.`);
          continue;
        }

        if (!email || !EMAIL_REGEX.test(email)) {
          errors.push(`Row ${r}: '${email || ''}' is not a valid email address.`);
          continue;
        }

        const targetPassword = rawPassword && rawPassword.length >= 4 ? rawPassword : defaultPasswordFromConfig;
        const passwordHash = await bcrypt.hash(targetPassword, 10);

        const existingUser = await prisma.user.findUnique({
          where: { email },
        });

        if (existingUser) {
          // Idempotent update: synchronize name and branch without wiping existing password
          await prisma.user.update({
            where: { email },
            data: {
              name: fullName,
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
              department: null,
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
          entityType: 'Branch',
          entityId: branch.id,
          metadata: {
            branchCode: branch.code,
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

/**
 * GET /api/branch-roster/floor-plan-template
 * Download branch-scoped floor plan configuration Excel template
 */
router.get(
  '/floor-plan-template',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN, Role.BRANCH_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const branch = await resolveBranch(req);

      if (!branch) {
        return res.status(404).json({ error: 'Assigned branch not found.' });
      }

      const branchWithHierarchy = await prisma.branch.findFirst({
        where: { id: branch.id, organizationId: orgId },
        include: {
          buildings: {
            include: {
              floors: {
                include: {
                  sections: {
                    include: {
                      meetingRoom: true,
                    },
                    orderBy: { name: 'asc' },
                  },
                },
                orderBy: { floorNumber: 'asc' },
              },
            },
            orderBy: { code: 'asc' },
          },
        },
      });

      if (!branchWithHierarchy) {
        return res.status(404).json({ error: 'Branch data not found.' });
      }

      const formattedBranch = {
        code: branchWithHierarchy.code,
        name: branchWithHierarchy.name,
        buildings: branchWithHierarchy.buildings.map((bld) => ({
          code: bld.code,
          name: bld.name,
          floors: bld.floors.map((fl) => ({
            code: fl.code,
            name: fl.name,
            floorNumber: fl.floorNumber,
            sections: fl.sections.map((sec) => ({
              name: sec.name,
              direction: sec.direction,
              standardDeskCount: sec.standardDeskCount,
              hdmiDeskCount: sec.hdmiDeskCount,
              hasMeetingRoom: !!sec.meetingRoom,
              meetingRoomCapacity: sec.meetingRoom?.capacity || 0,
              meetingRoomHdmi: sec.meetingRoom?.hdmiCount || 0,
            })),
          })),
        })),
      };

      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      const orgName = org?.name || 'Enterprise Organization';

      const buffer = await generateBranchFloorPlanTemplate(orgName, formattedBranch);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Floor_Plan_Template_${branch.code}.xlsx"`
      );
      return res.send(buffer);
    } catch (error: any) {
      console.error('Failed to generate branch floor plan template:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/branch-roster/floor-plan-import
 * Ingests branch-scoped floor plan configuration spreadsheet for active branch
 */
router.post(
  '/floor-plan-import',
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
      const validation = await parseAndValidateBranchFloorPlan(req.file.buffer, branch.code, org?.name);
      if (!validation.success || !validation.data) {
        return res.status(400).json({
          error: 'Floor plan spreadsheet validation failed.',
          errors: validation.errorsSummary,
        });
      }

      const parsedData = validation.data;
      let totalBuildings = 0;
      let totalFloors = 0;
      let totalSections = 0;
      let totalDesks = 0;
      let totalMeetingRooms = 0;

      await prisma.$transaction(async (tx) => {
        // Cascade delete existing buildings and child entities for this branch
        await tx.building.deleteMany({
          where: { branchId: branch.id },
        });

        // Insert fresh buildings, floors, sections, desks, and meeting rooms
        for (const bld of parsedData.buildings) {
          totalBuildings++;
          const building = await tx.building.create({
            data: {
              organizationId: orgId,
              branchId: branch.id,
              name: bld.name,
              code: bld.code,
              status: 'ACTIVE',
            },
          });

          for (const fl of bld.floors) {
            totalFloors++;
            const floor = await tx.floor.create({
              data: {
                organizationId: orgId,
                buildingId: building.id,
                code: fl.code,
                floorNumber: fl.floorNumber,
                name: fl.name,
              },
            });

            for (const sec of fl.sections) {
              totalSections++;
              const section = await tx.section.create({
                data: {
                  organizationId: orgId,
                  floorId: floor.id,
                  name: sec.name,
                  direction: sec.direction,
                  standardDeskCount: sec.standardDeskCount,
                  hdmiDeskCount: sec.hdmiDeskCount,
                },
              });

              // Generate Standard Workstations: C-01, C-02, ...
              const deskData = [];
              for (let i = 1; i <= sec.standardDeskCount; i++) {
                totalDesks++;
                const hasHdmi = i <= sec.hdmiDeskCount;
                deskData.push({
                  organizationId: orgId,
                  sectionId: section.id,
                  deskCode: `C-${String(i).padStart(2, '0')}`,
                  deskNumber: i,
                  hasHdmi,
                  isMeetingRoom: false,
                  status: 'AVAILABLE',
                });
              }
              if (deskData.length > 0) {
                await tx.desk.createMany({ data: deskData });
              }

              // Conference / Meeting Room
              if (sec.hasMeetingRoom && sec.meetingRoomCapacity > 0) {
                totalMeetingRooms++;
                await tx.meetingRoom.create({
                  data: {
                    organizationId: orgId,
                    sectionId: section.id,
                    name: `${sec.name} Meeting Room (${sec.meetingRoomCapacity} Seats)`,
                    capacity: sec.meetingRoomCapacity,
                    hasHdmi: sec.meetingRoomHdmi > 0,
                    hdmiCount: sec.meetingRoomHdmi,
                  },
                });
              }
            }
          }
        }

        // Touch branch record
        await tx.branch.update({
          where: { id: branch.id },
          data: { updatedAt: new Date() },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            organizationId: orgId,
            actorUserId: req.user!.id,
            action: 'IMPORT_BRANCH_FLOOR_PLAN',
            entityType: 'Branch',
            entityId: branch.id,
            metadata: {
              branchCode: branch.code,
              branchName: branch.name,
              totalBuildings,
              totalFloors,
              totalSections,
              totalDesks,
              totalMeetingRooms,
            },
          },
        });
      });

      return res.json({
        success: true,
        message: `Successfully configured floor plan for ${branch.name}: ${totalBuildings} building(s), ${totalFloors} floor(s), ${totalSections} section(s), ${totalDesks} desk(s).`,
        summary: {
          buildings: totalBuildings,
          floors: totalFloors,
          sections: totalSections,
          desks: totalDesks,
          meetingRooms: totalMeetingRooms,
        },
      });
    } catch (error: any) {
      console.error('Failed to import branch floor plan:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/branch-roster/cubicle
 * In-UI manual workstation creation for branch admin
 */
router.post(
  '/cubicle',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN, Role.BRANCH_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const user = req.user!;
      const { sectionId, hasHdmi = false, isMeetingRoom = false } = req.body;

      if (!sectionId || typeof sectionId !== 'string') {
        return res.status(400).json({ error: 'Valid sectionId is required.' });
      }

      // Fetch section with its floor, building, and branch
      const section = await prisma.section.findFirst({
        where: { id: sectionId, organizationId: orgId },
        include: {
          floor: {
            include: {
              building: true,
            },
          },
          meetingRoom: true,
          desks: true,
        },
      });

      if (!section) {
        return res.status(404).json({ error: 'Target section not found.' });
      }

      // Scoping check for branch admin
      if (user.role === Role.BRANCH_ADMIN && user.scopedBranchId) {
        if (section.floor.building.branchId !== user.scopedBranchId) {
          return res.status(403).json({
            error: 'Unauthorized: You can only add cubicles within your assigned branch.',
          });
        }
      }

      if (isMeetingRoom) {
        // Find existing meeting room desks or meeting room record
        const existingMeetingDesks = section.desks.filter((d) => d.isMeetingRoom);
        const deskNumber = existingMeetingDesks.length + 1;
        const deskCode = `M-${String(deskNumber).padStart(2, '0')}`;

        const [desk] = await prisma.$transaction([
          prisma.desk.create({
            data: {
              organizationId: orgId,
              sectionId,
              deskCode,
              deskNumber,
              hasHdmi: !!hasHdmi,
              isMeetingRoom: true,
              status: 'AVAILABLE',
            },
          }),
          ...(section.meetingRoom
            ? [
                prisma.meetingRoom.update({
                  where: { id: section.meetingRoom.id },
                  data: {
                    capacity: { increment: 1 },
                    ...(hasHdmi
                      ? {
                          hasHdmi: true,
                          hdmiCount: { increment: 1 },
                        }
                      : {}),
                  },
                }),
              ]
            : [
                prisma.meetingRoom.create({
                  data: {
                    organizationId: orgId,
                    sectionId,
                    name: `${section.name} Meeting Room (1 Seat)`,
                    capacity: 1,
                    hasHdmi: !!hasHdmi,
                    hdmiCount: hasHdmi ? 1 : 0,
                  },
                }),
              ]),
        ]);

        await prisma.auditLog.create({
          data: {
            organizationId: orgId,
            actorUserId: user.id,
            action: 'ADD_MEETING_CUBICLE',
            entityType: 'Desk',
            entityId: desk.id,
            metadata: {
              sectionId,
              deskCode: desk.deskCode,
              hasHdmi: desk.hasHdmi,
              isMeetingRoom: true,
            },
          },
        });

        return res.status(201).json({
          success: true,
          desk,
          message: `Meeting room seat ${deskCode} added successfully.`,
        });
      }

      // Standard cubicle addition
      const existingStandardDesks = section.desks.filter((d) => !d.isMeetingRoom);
      const deskNumber = existingStandardDesks.length + 1;
      const deskCode = `C-${String(deskNumber).padStart(2, '0')}`;

      const [desk, updatedSection] = await prisma.$transaction([
        prisma.desk.create({
          data: {
            organizationId: orgId,
            sectionId,
            deskCode,
            deskNumber,
            hasHdmi: !!hasHdmi,
            isMeetingRoom: false,
            status: 'AVAILABLE',
          },
        }),
        prisma.section.update({
          where: { id: sectionId },
          data: {
            standardDeskCount: { increment: 1 },
            ...(hasHdmi ? { hdmiDeskCount: { increment: 1 } } : {}),
          },
        }),
      ]);

      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorUserId: user.id,
          action: 'ADD_CUBICLE',
          entityType: 'Desk',
          entityId: desk.id,
          metadata: {
            sectionId,
            deskCode: desk.deskCode,
            hasHdmi: desk.hasHdmi,
            standardDeskCount: updatedSection.standardDeskCount,
          },
        },
      });

      return res.status(201).json({
        success: true,
        desk,
        section: updatedSection,
        message: `Workstation ${deskCode} created successfully (${hasHdmi ? 'HDMI Enabled' : 'Standard'}).`,
      });
    } catch (error: any) {
      console.error('Failed to create cubicle:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/branch-roster/assign-dedicated
 * Assign or release a permanent dedicated workstation for executive/director
 */
router.post(
  '/assign-dedicated',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN, Role.BRANCH_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const user = req.user!;
      const { deskId, employeeId, notes, release } = req.body;

      if (!deskId) {
        return res.status(400).json({ error: 'deskId is required.' });
      }

      const desk = await prisma.desk.findFirst({
        where: { id: deskId, organizationId: orgId },
        include: {
          section: {
            include: {
              floor: {
                include: {
                  building: true,
                },
              },
            },
          },
        },
      });

      if (!desk) {
        return res.status(404).json({ error: 'Desk not found.' });
      }

      // Branch admin check
      if (user.role === Role.BRANCH_ADMIN && user.scopedBranchId) {
        if (desk.section.floor.building.branchId !== user.scopedBranchId) {
          return res.status(403).json({ error: 'Cannot assign desks outside your assigned branch.' });
        }
      }

      if (release) {
        // Cancel all DEDICATED bookings for this desk
        await prisma.booking.updateMany({
          where: {
            deskId,
            status: 'CONFIRMED',
            slotType: 'DEDICATED',
          },
          data: {
            status: 'CANCELLED',
          },
        });

        // Set desk status to AVAILABLE if no other bookings
        await prisma.desk.update({
          where: { id: deskId },
          data: { status: 'AVAILABLE' },
        });

        await prisma.auditLog.create({
          data: {
            organizationId: orgId,
            actorUserId: user.id,
            action: 'RELEASE_DEDICATED_DESK',
            entityType: 'Desk',
            entityId: deskId,
            metadata: { deskCode: desk.deskCode },
          },
        });

        return res.json({
          success: true,
          message: `Dedicated desk assignment for ${desk.deskCode} released successfully.`,
        });
      }

      if (!employeeId) {
        return res.status(400).json({ error: 'employeeId is required to assign dedicated desk.' });
      }

      const targetEmployee = await prisma.user.findFirst({
        where: { id: employeeId, organizationId: orgId, isActive: true },
      });

      if (!targetEmployee) {
        return res.status(404).json({ error: 'Target employee/executive not found.' });
      }

      // Cancel existing dedicated booking on this desk if any
      await prisma.booking.updateMany({
        where: {
          deskId,
          status: 'CONFIRMED',
          slotType: 'DEDICATED',
        },
        data: {
          status: 'CANCELLED',
        },
      });

      // Create permanent dedicated booking (1 year duration)
      const now = new Date();
      const oneYearAhead = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

      const dedicatedBooking = await prisma.booking.create({
        data: {
          organizationId: orgId,
          deskId,
          userId: targetEmployee.id,
          bookedByUserId: user.id,
          slotType: 'DEDICATED',
          startTime: now,
          endTime: oneYearAhead,
          status: 'CONFIRMED',
          notes: notes || `Permanent Dedicated Executive Station: ${targetEmployee.name}`,
        },
      });

      await prisma.desk.update({
        where: { id: deskId },
        data: { status: 'BOOKED' },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorUserId: user.id,
          action: 'ASSIGN_DEDICATED_DESK',
          entityType: 'Desk',
          entityId: deskId,
          metadata: {
            deskCode: desk.deskCode,
            assignedToUserId: targetEmployee.id,
            assignedToName: targetEmployee.name,
            notes,
          },
        },
      });

      return res.json({
        success: true,
        booking: dedicatedBooking,
        message: `Workstation ${desk.deskCode} permanently dedicated to ${targetEmployee.name}.`,
      });
    } catch (error: any) {
      console.error('Failed to assign dedicated desk:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

export default router;
