import { Router, Response } from 'express';
import multer from 'multer';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.middleware';
import { Role } from '@deskbooking/shared';
import { generateOrgTemplate, parseAndValidateWorkspace } from '../services/excel.service';
import { ensureMeetingRoomDesks } from './employee.routes';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/**
 * GET /api/workspace/template
 * Download the customized Excel template pre-filled with the current Organization's ID and Name
 */
router.get(
  '/template',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
      });

      const orgName = org?.name || 'My Organization';
      const fileBuffer = await generateOrgTemplate(orgId, orgName);

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Workspace_FloorPlan_${org?.code || 'Template'}.xlsx"`
      );
      return res.send(fileBuffer);
    } catch (error: any) {
      console.error('Failed to generate template:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/workspace/import
 * Upload, validate, and persist the workspace floor plan hierarchy
 */
router.post(
  '/import',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]),
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ error: 'Please upload a valid Excel (.xlsx) file.' });
      }

      const orgId = req.organizationId!;
      const org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org) return res.status(404).json({ error: 'Organization not found.' });

      // 72-Hour Grace Period Check
      if (org.workspaceSetupAt) {
        const elapsedMs = Date.now() - new Date(org.workspaceSetupAt).getTime();
        const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
        if (elapsedMs > SEVENTY_TWO_HOURS_MS) {
          return res.status(403).json({
            error: 'The 72-hour workspace modification grace period has expired. Facility structures cannot be edited. If architectural changes are required, please contact a Platform Administrator to decommission and re-provision.',
          });
        }
      }

      const validation = await parseAndValidateWorkspace(req.file.buffer, orgId, org.name);

      // If validation failed, return the error summary and base64-encoded annotated Excel
      if (!validation.success || !validation.data) {
        return res.status(422).json({
          success: false,
          errorCount: validation.errorCount,
          errorsSummary: validation.errorsSummary,
          errorWorkbookBase64: validation.errorWorkbookBuffer
            ? validation.errorWorkbookBuffer.toString('base64')
            : null,
        });
      }

      const parsedData = validation.data;
      let totalBranches = 0;
      let totalBuildings = 0;
      let totalFloors = 0;
      let totalSections = 0;
      let totalDesks = 0;
      let totalMeetingRooms = 0;

      // ATOMIC TRANSACTION: Delete existing workspace hierarchy, persist fresh, and record setup timestamp
      await prisma.$transaction(async (tx: any) => {
        // Clear out existing branches and related entities for this organization
        await tx.branch.deleteMany({
          where: { organizationId: orgId },
        });

        // Record or preserve workspaceSetupAt and store latest workbook buffer
        await tx.organization.update({
          where: { id: orgId },
          data: {
            workspaceSetupAt: org.workspaceSetupAt || new Date(),
            workspaceSetupExcel: req.file!.buffer,
          },
        });

        // Insert Branches -> Buildings -> Floors -> Sections -> Desks & Meeting Rooms
        for (const b of parsedData.branches) {
          totalBranches++;
          const branch = await tx.branch.create({
            data: {
              organizationId: orgId,
              name: b.name,
              code: b.branchId,
              status: 'ACTIVE',
            },
          });

          for (const bld of b.buildings) {
            totalBuildings++;
            const building = await tx.building.create({
              data: {
                organizationId: orgId,
                branchId: branch.id,
                name: bld.name,
                code: bld.buildingId,
                status: 'ACTIVE',
              },
            });

            for (const fl of bld.floors) {
              totalFloors++;
              const floor = await tx.floor.create({
                data: {
                  organizationId: orgId,
                  buildingId: building.id,
                  code: fl.floorId,
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

                // Generate Standard Desks: C-01, C-02, ...
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

                // Generate Meeting Room if configured
                if (sec.hasMeetingRoom && sec.meetingRoomCapacity > 0) {
                  totalMeetingRooms++;
                  await tx.meetingRoom.create({
                    data: {
                      organizationId: orgId,
                      sectionId: section.id,
                      name: `Meeting Room (${sec.meetingRoomCapacity} Seats)`,
                      capacity: sec.meetingRoomCapacity,
                      hasHdmi: sec.meetingRoomHdmi > 0,
                      hdmiCount: sec.meetingRoomHdmi,
                    },
                  });
                }
              }
            }
          }
        }

        // Create Audit Log
        await tx.auditLog.create({
          data: {
            organizationId: orgId,
            actorUserId: req.user!.id,
            action: 'IMPORT_WORKSPACE_FLOORPLAN',
            entityType: 'Organization',
            entityId: orgId,
            metadata: {
              totalBranches,
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
        stats: {
          branches: totalBranches,
          buildings: totalBuildings,
          floors: totalFloors,
          sections: totalSections,
          desks: totalDesks,
          meetingRooms: totalMeetingRooms,
        },
      });
    } catch (error: any) {
      console.error('Failed to import workspace:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/workspace/hierarchy
 * Returns the entire workspace hierarchy (Branch -> Building -> Floor -> Section -> Desks & Meeting Rooms)
 * Enriched with confirmed active bookings and employee identity for accurate occupancy display
 */
router.get(
  '/hierarchy',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const startDateQuery = req.query.startDate as string | undefined;
      const endDateQuery = req.query.endDate as string | undefined;
      const branchIdQuery = req.query.branchId as string | undefined;

      // Ensure all meeting room seats exist as Desk records
      await ensureMeetingRoomDesks(orgId);

      let rangeStart: Date;
      let rangeEnd: Date;

      if (startDateQuery && endDateQuery) {
        const sParts = startDateQuery.split('-').map(Number);
        const eParts = endDateQuery.split('-').map(Number);
        rangeStart = new Date(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0);
        rangeEnd = new Date(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999);
      } else {
        const now = new Date();
        rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59, 999);
      }

      const branchWhere: any = { organizationId: orgId };
      if (branchIdQuery) {
        branchWhere.id = branchIdQuery;
      }

      const branches = await prisma.branch.findMany({
        where: branchWhere,
        include: {
          buildings: {
            include: {
              floors: {
                orderBy: { floorNumber: 'asc' },
                include: {
                  sections: {
                    orderBy: { name: 'asc' },
                    include: {
                      desks: {
                        orderBy: { deskNumber: 'asc' },
                        include: {
                          bookings: {
                            where: {
                              status: 'CONFIRMED',
                              startTime: { lte: rangeEnd },
                              endTime: { gte: rangeStart },
                            },
                            select: {
                              id: true,
                              userId: true,
                              slotType: true,
                              startTime: true,
                              endTime: true,
                              notes: true,
                              bookedByUser: {
                                select: { id: true, name: true, email: true },
                              },
                              user: {
                                select: { id: true, name: true, email: true, department: true },
                              },
                            },
                          },
                        },
                      },
                      meetingRoom: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { code: 'asc' },
      });

      return res.json(branches);
    } catch (error: any) {
      console.error('Failed to fetch hierarchy:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/workspace/setup-status
 * Returns 72-hour timer status, remaining milliseconds, and lock condition
 */
router.get(
  '/setup-status',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { workspaceSetupAt: true, workspaceSetupExcel: true },
      });

      if (!org || !org.workspaceSetupAt) {
        return res.json({
          hasSetup: false,
          workspaceSetupAt: null,
          isLocked: false,
          remainingMs: 0,
          hoursLeft: 0,
          hasConfigurationFile: false,
        });
      }

      const elapsedMs = Date.now() - new Date(org.workspaceSetupAt).getTime();
      const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000;
      const remainingMs = Math.max(0, SEVENTY_TWO_HOURS_MS - elapsedMs);
      const isLocked = remainingMs <= 0;
      const hoursLeft = Math.ceil(remainingMs / (1000 * 60 * 60));

      return res.json({
        hasSetup: true,
        workspaceSetupAt: org.workspaceSetupAt,
        isLocked,
        remainingMs,
        hoursLeft,
        hasConfigurationFile: Boolean(org.workspaceSetupExcel),
      });
    } catch (error: any) {
      console.error('Failed to get setup status:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/workspace/current-configuration
 * Allows downloading the current populated workspace Excel workbook during the 72-hour grace window
 */
router.get(
  '/current-configuration',
  authMiddleware,
  requireRole([Role.PLATFORM_ADMIN, Role.ORGANIZATION_ADMIN]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          code: true,
          workspaceSetupAt: true,
          workspaceSetupExcel: true,
        },
      });

      if (!org || !org.workspaceSetupExcel) {
        return res.status(404).json({ error: 'No populated workspace configuration file found for this organization.' });
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="Current_Workspace_Configuration_${org.code}.xlsx"`);
      return res.send(Buffer.from(org.workspaceSetupExcel));
    } catch (error: any) {
      console.error('Failed to download current configuration:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/workspace/book-desk
 * Click-to-book workstation endpoint
 */
router.post(
  '/book-desk',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const user = req.user!;
      const { deskId, startTime, endTime } = req.body;

      if (!deskId) {
        return res.status(400).json({ error: 'deskId is required' });
      }

      // Organization Admins have global oversight and are restricted from booking physical desks
      if (user.role === Role.ORGANIZATION_ADMIN) {
        return res.status(403).json({
          error: 'Organization Administrators have global oversight and cannot book physical desks. Desk reservation is restricted to branch personnel.',
        });
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
        return res.status(404).json({ error: 'Desk not found' });
      }

      // Branch Admins can only reserve desks in their assigned branch
      if (user.role === Role.BRANCH_ADMIN) {
        if (!user.scopedBranchId) {
          return res.status(403).json({ error: 'You do not have an assigned branch.' });
        }
        if (desk.section.floor.building.branchId !== user.scopedBranchId) {
          return res.status(403).json({
            error: 'Branch Administrators may only reserve desks within their assigned branch.',
          });
        }
      }

      if (desk.status === 'BOOKED') {
        return res.status(400).json({ error: 'This desk is already reserved.' });
      }

      const bookingStart = startTime ? new Date(startTime) : new Date();
      const bookingEnd = endTime
        ? new Date(endTime)
        : new Date(Date.now() + 8 * 60 * 60 * 1000); // Default 8 hrs

      const result = await prisma.$transaction(async (tx: any) => {
        const updatedDesk = await tx.desk.update({
          where: { id: deskId },
          data: { status: 'BOOKED' },
        });

        const booking = await tx.booking.create({
          data: {
            organizationId: orgId,
            deskId,
            userId: user.id,
            startTime: bookingStart,
            endTime: bookingEnd,
            status: 'CONFIRMED',
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId: orgId,
            actorUserId: user.id,
            action: 'BOOK_DESK',
            entityType: 'Desk',
            entityId: deskId,
            metadata: { deskCode: desk.deskCode, bookingId: booking.id },
          },
        });

        return { desk: updatedDesk, booking };
      });

      return res.json(result);
    } catch (error: any) {
      console.error('Failed to book desk:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/workspace/cancel-booking
 */
router.post(
  '/cancel-booking',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const user = req.user!;
      const { deskId } = req.body;

      if (!deskId) {
        return res.status(400).json({ error: 'deskId is required' });
      }

      if (user.role === Role.ORGANIZATION_ADMIN) {
        return res.status(403).json({
          error: 'Organization Administrators have global oversight and cannot modify physical desk bookings.',
        });
      }

      const desk = await prisma.desk.findFirst({
        where: { id: deskId, organizationId: orgId },
      });

      if (!desk) {
        return res.status(404).json({ error: 'Desk not found' });
      }

      await prisma.$transaction(async (tx: any) => {
        await tx.desk.update({
          where: { id: deskId },
          data: { status: 'AVAILABLE' },
        });

        await tx.booking.updateMany({
          where: { deskId, status: 'CONFIRMED' },
          data: { status: 'CANCELLED' },
        });

        await tx.auditLog.create({
          data: {
            organizationId: orgId,
            actorUserId: user.id,
            action: 'CANCEL_BOOKING',
            entityType: 'Desk',
            entityId: deskId,
            metadata: { deskCode: desk.deskCode },
          },
        });
      });

      return res.json({ success: true, deskId, status: 'AVAILABLE' });
    } catch (error: any) {
      console.error('Failed to cancel booking:', error);
      return res.status(500).json({ error: error.message });
    }
  }
);

export default router;
