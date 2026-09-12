import { Router, Response } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth.middleware";

const router = Router();

/**
 * Helper to resolve branch for the current employee or fallback
 */
async function resolveEmployeeBranch(req: AuthenticatedRequest) {
  const orgId = req.organizationId!;
  const user = req.user!;

  const branchId = user.scopedBranchId || user.baseBranchId || (req.query.branchId as string);

  if (branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, organizationId: orgId },
    });
    if (branch) return branch;
  }

  // Fallback to first branch in the tenant organization
  return await prisma.branch.findFirst({
    where: { organizationId: orgId },
    orderBy: { code: "asc" },
  });
}

/**
 * GET /api/employee/dashboard-summary
 * Aggregates employee profile, current active booking, upcoming bookings, and facility metrics
 */
router.get("/dashboard-summary", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const user = req.user!;
    const now = new Date();

    const branch = await resolveEmployeeBranch(req);
    if (!branch) {
      return res.status(404).json({ error: "Assigned branch facility not found." });
    }

    // 1. Fetch current active booking for this employee (if any)
    const activeBooking = await prisma.booking.findFirst({
      where: {
        organizationId: orgId,
        userId: user.id,
        status: "CONFIRMED",
        endTime: { gte: now },
      },
      include: {
        desk: {
          include: {
            section: {
              include: {
                floor: {
                  include: {
                    building: {
                      include: {
                        branch: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        bookedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { startTime: "asc" },
    });

    // 2. Fetch upcoming bookings for this employee
    const upcomingBookings = await prisma.booking.findMany({
      where: {
        organizationId: orgId,
        userId: user.id,
        status: "CONFIRMED",
        startTime: { gt: now },
      },
      include: {
        desk: {
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
        },
      },
      orderBy: { startTime: "asc" },
      take: 5,
    });

    // 3. User total completed bookings count
    const totalCompletedBookings = await prisma.booking.count({
      where: {
        organizationId: orgId,
        userId: user.id,
      },
    });

    // 4. Compute live facility metrics for the employees branch
    const branchBuildings = await prisma.building.findMany({
      where: { branchId: branch.id, organizationId: orgId },
      include: {
        floors: {
          include: {
            sections: {
              include: {
                desks: true,
                meetingRoom: true,
              },
            },
          },
        },
      },
    });

    let totalDesks = 0;
    let hdmiDesks = 0;
    let meetingRoomsCount = 0;
    const allBranchDeskIds: string[] = [];

    for (const bld of branchBuildings) {
      for (const fl of bld.floors) {
        for (const sec of fl.sections) {
          if (sec.meetingRoom) meetingRoomsCount++;
          for (const d of sec.desks) {
            totalDesks++;
            if (d.hasHdmi) hdmiDesks++;
            allBranchDeskIds.push(d.id);
          }
        }
      }
    }

    // Active concurrent bookings in this branch right now
    const activeBranchBookingsCount = await prisma.booking.count({
      where: {
        organizationId: orgId,
        deskId: { in: allBranchDeskIds },
        status: "CONFIRMED",
        startTime: { lte: now },
        endTime: { gte: now },
      },
    });

    const availableDesks = Math.max(0, totalDesks - activeBranchBookingsCount);

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        role: user.role,
      },
      branch: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
      },
      activeBooking: activeBooking
        ? {
            id: activeBooking.id,
            slotType: activeBooking.slotType,
            startTime: activeBooking.startTime,
            endTime: activeBooking.endTime,
            status: activeBooking.status,
            notes: activeBooking.notes,
            desk: {
              id: activeBooking.desk.id,
              deskCode: activeBooking.desk.deskCode,
              hasHdmi: activeBooking.desk.hasHdmi,
              isMeetingRoom: activeBooking.desk.isMeetingRoom,
              sectionName: activeBooking.desk.section.name,
              floorCode: activeBooking.desk.section.floor.code,
              floorName: activeBooking.desk.section.floor.name,
              buildingName: activeBooking.desk.section.floor.building.name,
              branchName: activeBooking.desk.section.floor.building.branch.name,
            },
            bookedByColleague:
              activeBooking.bookedByUserId && activeBooking.bookedByUserId !== user.id
                ? activeBooking.bookedByUser
                : null,
          }
        : null,
      upcomingBookings: upcomingBookings.map((b) => ({
        id: b.id,
        slotType: b.slotType,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        deskCode: b.desk.deskCode,
        sectionName: b.desk.section.name,
        floorName: b.desk.section.floor.name,
        buildingName: b.desk.section.floor.building.name,
      })),
      stats: {
        totalDesks,
        availableDesks,
        reservedDesks: activeBranchBookingsCount,
        hdmiDesks,
        meetingRoomsCount,
        myBookingsCount: totalCompletedBookings,
      },
    });
  } catch (error: any) {
    console.error("Failed to load employee dashboard summary:", error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/employee/branch-metrics
 * Live branch occupancy metrics
 */
router.get("/branch-metrics", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const branch = await resolveEmployeeBranch(req);

    if (!branch) {
      return res.status(404).json({ error: "Assigned branch facility not found." });
    }

    const now = new Date();
    const branchDesks = await prisma.desk.findMany({
      where: {
        organizationId: orgId,
        section: {
          floor: {
            building: {
              branchId: branch.id,
            },
          },
        },
      },
      select: { id: true, hasHdmi: true, isMeetingRoom: true },
    });

    const deskIds = branchDesks.map((d) => d.id);
    const activeBookingsCount = await prisma.booking.count({
      where: {
        organizationId: orgId,
        deskId: { in: deskIds },
        status: "CONFIRMED",
        startTime: { lte: now },
        endTime: { gte: now },
      },
    });

    return res.json({
      branchId: branch.id,
      branchName: branch.name,
      branchCode: branch.code,
      totalDesks: branchDesks.length,
      availableDesks: Math.max(0, branchDesks.length - activeBookingsCount),
      occupiedDesks: activeBookingsCount,
      occupancyPercentage:
        branchDesks.length > 0 ? Math.round((activeBookingsCount / branchDesks.length) * 100) : 0,
      hdmiDesksCount: branchDesks.filter((d) => d.hasHdmi).length,
    });
  } catch (error: any) {
    console.error("Failed to load branch metrics:", error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
