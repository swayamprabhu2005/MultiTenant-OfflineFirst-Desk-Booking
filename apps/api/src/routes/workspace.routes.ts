import { Router, Response } from 'express';
import multer from 'multer';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.middleware';
import { Role } from '@deskbooking/shared';
import { generateOrgTemplate, parseAndValidateWorkspace } from '../services/excel.service';

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
      const validation = await parseAndValidateWorkspace(req.file.buffer, orgId);

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

      // ATOMIC TRANSACTION: Delete existing workspace hierarchy and create fresh
      await prisma.$transaction(async (tx: any) => {
        // Clear out existing branches and related entities for this organization
        await tx.branch.deleteMany({
          where: { organizationId: orgId },
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
 */
router.get(
  '/hierarchy',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const branches = await prisma.branch.findMany({
        where: { organizationId: orgId },
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
 * POST /api/workspace/book-desk
 * Click-to-book workstation endpoint
 */
router.post(
  '/book-desk',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const orgId = req.organizationId!;
      const userId = req.user!.id;
      const { deskId, startTime, endTime } = req.body;

      if (!deskId) {
        return res.status(400).json({ error: 'deskId is required' });
      }

      const desk = await prisma.desk.findFirst({
        where: { id: deskId, organizationId: orgId },
      });

      if (!desk) {
        return res.status(404).json({ error: 'Desk not found' });
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
            userId,
            startTime: bookingStart,
            endTime: bookingEnd,
            status: 'CONFIRMED',
          },
        });

        await tx.auditLog.create({
          data: {
            organizationId: orgId,
            actorUserId: userId,
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
      const userId = req.user!.id;
      const { deskId } = req.body;

      if (!deskId) {
        return res.status(400).json({ error: 'deskId is required' });
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
            actorUserId: userId,
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
