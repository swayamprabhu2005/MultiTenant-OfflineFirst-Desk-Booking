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
        meetingRoom: {
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
        meetingRoom: {
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
            resourceType: activeBooking.resourceType || (activeBooking.meetingRoomId ? 'MEETING_ROOM' : 'DESK'),
            title: activeBooking.title,
            slotType: activeBooking.slotType,
            startTime: activeBooking.startTime,
            endTime: activeBooking.endTime,
            status: activeBooking.status,
            notes: activeBooking.notes,
            desk: activeBooking.desk
              ? {
                  id: activeBooking.desk.id,
                  deskCode: activeBooking.desk.deskCode,
                  hasHdmi: activeBooking.desk.hasHdmi,
                  isMeetingRoom: activeBooking.desk.isMeetingRoom,
                  sectionName: activeBooking.desk.section?.name,
                  floorCode: activeBooking.desk.section?.floor?.code,
                  floorName: activeBooking.desk.section?.floor?.name,
                  buildingName: activeBooking.desk.section?.floor?.building?.name,
                  branchName: activeBooking.desk.section?.floor?.building?.branch?.name,
                }
              : null,
            meetingRoom: activeBooking.meetingRoom
              ? {
                  id: activeBooking.meetingRoom.id,
                  name: activeBooking.meetingRoom.name,
                  capacity: activeBooking.meetingRoom.capacity,
                  sectionName: activeBooking.meetingRoom.section?.name,
                  floorCode: activeBooking.meetingRoom.section?.floor?.code,
                  floorName: activeBooking.meetingRoom.section?.floor?.name,
                  buildingName: activeBooking.meetingRoom.section?.floor?.building?.name,
                  branchName: activeBooking.meetingRoom.section?.floor?.building?.branch?.name,
                }
              : null,
            bookedByColleague:
              activeBooking.bookedByUserId && activeBooking.bookedByUserId !== user.id
                ? activeBooking.bookedByUser
                : null,
          }
        : null,
      upcomingBookings: upcomingBookings.map((b) => ({
        id: b.id,
        resourceType: b.resourceType || (b.meetingRoomId ? 'MEETING_ROOM' : 'DESK'),
        title: b.title,
        slotType: b.slotType,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        deskCode: b.desk ? b.desk.deskCode : b.meetingRoom ? b.meetingRoom.name : 'N/A',
        sectionName: b.desk ? b.desk.section?.name : b.meetingRoom ? b.meetingRoom.section?.name : '',
        floorName: b.desk ? b.desk.section?.floor?.name : b.meetingRoom ? b.meetingRoom.section?.floor?.name : '',
        buildingName: b.desk ? b.desk.section?.floor?.building?.name : b.meetingRoom ? b.meetingRoom.section?.floor?.building?.name : '',
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

/**
 * GET /api/employee/office-presence
 * Live in-office presence for the current calendar day strictly scoped to the user's branch
 */
router.get("/office-presence", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const user = req.user!;
    const requestedBranchId = (req.query.branchId as string)?.trim();

    // Security Check: Enforce strict branch scoping for EMPLOYEE and BRANCH_ADMIN
    const userAssignedBranchId = user.scopedBranchId || user.baseBranchId;
    if (["EMPLOYEE", "BRANCH_ADMIN"].includes(user.role)) {
      if (requestedBranchId && userAssignedBranchId && requestedBranchId !== userAssignedBranchId) {
        return res.status(403).json({ error: "Access restricted: You can only view presence for your assigned branch facility." });
      }
    }

    const branch = await resolveEmployeeBranch(req);
    if (!branch) {
      return res.status(404).json({ error: "Branch facility not found." });
    }

    // Compute start and end of current day in local server calendar
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Find all confirmed bookings in this branch today
    const bookingsToday = await prisma.booking.findMany({
      where: {
        organizationId: orgId,
        status: "CONFIRMED",
        startTime: { lte: endOfToday },
        endTime: { gte: startOfToday },
        desk: {
          section: {
            floor: {
              building: {
                branchId: branch.id,
              },
            },
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            role: true,
          },
        },
        bookedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
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
      orderBy: [
        { desk: { deskCode: "asc" } },
        { startTime: "asc" },
      ],
    });

    // Format colleague presence list
    const presenceList = bookingsToday
      .filter((b) => b.desk !== null)
      .map((b) => {
        const desk = b.desk!;
        return {
          bookingId: b.id,
          user: {
            id: b.user.id,
            name: b.user.name,
            email: b.user.email,
            department: b.user.department || "General Staff",
            role: b.user.role,
            isCurrentUser: b.user.id === user.id,
          },
          bookedBy: b.bookedByUser && b.bookedByUser.id !== b.user.id ? {
            id: b.bookedByUser.id,
            name: b.bookedByUser.name,
            email: b.bookedByUser.email,
          } : null,
          desk: {
            id: desk.id,
            deskCode: desk.deskCode,
            hasHdmi: desk.hasHdmi,
            isMeetingRoom: desk.isMeetingRoom,
          },
          location: {
            buildingId: desk.section.floor.building.id,
            buildingName: desk.section.floor.building.name,
            floorId: desk.section.floor.id,
            floorCode: desk.section.floor.code,
            floorName: desk.section.floor.name,
            sectionId: desk.section.id,
            sectionName: desk.section.name,
            direction: desk.section.direction,
          },
          slotType: b.slotType,
          startTime: b.startTime,
          endTime: b.endTime,
          notes: b.notes,
        };
      });

    // Unique headcount
    const uniqueUserIds = new Set(presenceList.map((p) => p.user.id));
    const totalPresent = uniqueUserIds.size;

    // Aggregations for filter pills
    const departmentCounts: Record<string, number> = {};
    const floorCounts: Record<string, number> = {};

    for (const p of presenceList) {
      const dept = p.user.department || "General Staff";
      departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
      const flName = p.location.floorName || p.location.floorCode;
      floorCounts[flName] = (floorCounts[flName] || 0) + 1;
    }

    return res.json({
      success: true,
      branch: {
        id: branch.id,
        name: branch.name,
        code: branch.code,
      },
      date: todayDateStr,
      totalPresent,
      departmentCounts,
      floorCounts,
      presence: presenceList,
    });
  } catch (error: any) {
    console.error("Failed to load office presence:", error);
    return res.status(500).json({ error: error.message || "Failed to retrieve office presence." });
  }
});


/**
 * Slot time computer for 3 daily options:
 * FULL_DAY (9:00 - 18:00)
 * MORNING (9:00 - 13:30)
 * AFTERNOON (13:30 - 18:00)
 */
function computeSlotTimes(bookingDateStr?: string, slotType: string = 'FULL_DAY') {
  const dateObj = bookingDateStr ? new Date(bookingDateStr) : new Date();
  if (isNaN(dateObj.getTime())) {
    throw new Error('Invalid booking date format. Expected YYYY-MM-DD.');
  }

  const y = dateObj.getFullYear();
  const m = dateObj.getMonth();
  const d = dateObj.getDate();

  let startTime: Date;
  let endTime: Date;

  switch (slotType.toUpperCase()) {
    case 'MORNING':
      startTime = new Date(y, m, d, 9, 0, 0, 0);
      endTime = new Date(y, m, d, 13, 30, 0, 0);
      break;
    case 'AFTERNOON':
      startTime = new Date(y, m, d, 13, 30, 0, 0);
      endTime = new Date(y, m, d, 18, 0, 0, 0);
      break;
    case 'FULL_DAY':
    default:
      startTime = new Date(y, m, d, 9, 0, 0, 0);
      endTime = new Date(y, m, d, 18, 0, 0, 0);
      break;
  }

  return { startTime, endTime, normalizedSlotType: slotType.toUpperCase() };
}

/**
 * Helper to ensure meeting room seats (M-01, M-02, ...) exist as Desk records
 */
export async function ensureMeetingRoomDesks(orgId: string) {
  try {
    const meetingRooms = await prisma.meetingRoom.findMany({
      where: { organizationId: orgId },
      include: {
        section: {
          include: {
            desks: true,
          },
        },
      },
    });

    for (const mr of meetingRooms) {
      if (mr.capacity <= 0) continue;
      const existingMeetingDesks = mr.section.desks.filter(
        (d) => d.isMeetingRoom || d.deskCode.startsWith('M-')
      );

      if (existingMeetingDesks.length < mr.capacity) {
        const existingCodes = new Set(existingMeetingDesks.map((d) => d.deskCode));
        const desksToCreate = [];
        for (let i = 1; i <= mr.capacity; i++) {
          const code = `M-${String(i).padStart(2, '0')}`;
          if (!existingCodes.has(code)) {
            const hasHdmi = i <= mr.hdmiCount;
            desksToCreate.push({
              organizationId: orgId,
              sectionId: mr.sectionId,
              deskCode: code,
              deskNumber: 1000 + i,
              hasHdmi,
              isMeetingRoom: true,
              status: 'AVAILABLE',
            });
          }
        }

        if (desksToCreate.length > 0) {
          await prisma.desk.createMany({
            data: desksToCreate,
            skipDuplicates: true,
          });
        }
      }
    }
  } catch (err) {
    console.error('Error ensuring meeting room desks:', err);
  }
}

/**
 * GET /api/employee/floor-plans
 * Returns 2D floor plans scoped to employee's branch with slot-specific reservation statuses
 */
router.get('/floor-plans', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const user = req.user!;
    const startDateQuery = req.query.startDate as string | undefined;
    const endDateQuery = req.query.endDate as string | undefined;
    const bookingDate = (req.query.bookingDate as string | undefined) || startDateQuery;
    const slotType = (req.query.slotType as string | undefined) || 'FULL_DAY';
    const reqBranchId = req.query.branchId as string | undefined;

    await ensureMeetingRoomDesks(orgId);

    let rangeStart: Date;
    let rangeEnd: Date;

    if (startDateQuery && endDateQuery) {
      const sParts = startDateQuery.split('-').map(Number);
      const eParts = endDateQuery.split('-').map(Number);
      rangeStart = new Date(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0, 0);
      rangeEnd = new Date(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59, 999);
    } else {
      const { startTime, endTime } = computeSlotTimes(bookingDate, slotType);
      rangeStart = startTime;
      rangeEnd = endTime;
    }

    const branchWhere: any = { organizationId: orgId };
    const targetBranchId = reqBranchId || user.scopedBranchId || user.baseBranchId;
    if (targetBranchId) {
      branchWhere.id = targetBranchId;
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

    // Check if current user already has an active reservation in this time slot
    const myActiveBookingInSlot = await prisma.booking.findFirst({
      where: {
        organizationId: orgId,
        userId: user.id,
        status: 'CONFIRMED',
        startTime: { lte: rangeEnd },
        endTime: { gte: rangeStart },
      },
      include: {
        desk: {
          include: {
            section: true,
          },
        },
        meetingRoom: true,
      },
    });

    const enrichedBranches = branches.map((b) => ({
      ...b,
      buildings: b.buildings.map((bld) => ({
        ...bld,
        floors: bld.floors.map((fl) => ({
          ...fl,
          sections: fl.sections.map((sec) => ({
            ...sec,
            desks: sec.desks.map((desk) => {
              const deskBookings = desk.bookings || [];
              const isMyBooking = deskBookings.some((bk) => bk.userId === user.id);
              const isReserved = deskBookings.length > 0;

              return {
                id: desk.id,
                deskCode: desk.deskCode,
                deskNumber: desk.deskNumber,
                hasHdmi: desk.hasHdmi,
                isMeetingRoom: desk.isMeetingRoom,
                status: isReserved ? 'BOOKED' : 'AVAILABLE',
                isReserved,
                isMyBooking,
                bookings: deskBookings,
                activeBooking: deskBookings[0] || null,
              };
            }),
          })),
        })),
      })),
    }));

    return res.json({
      branches: enrichedBranches,
      slotInfo: {
        bookingDate: bookingDate || new Date().toISOString().split('T')[0],
        startDate: startDateQuery || bookingDate || new Date().toISOString().split('T')[0],
        endDate: endDateQuery || bookingDate || new Date().toISOString().split('T')[0],
        slotType: slotType.toUpperCase(),
        startTime: rangeStart,
        endTime: rangeEnd,
      },
      myActiveBooking: myActiveBookingInSlot
        ? {
            id: myActiveBookingInSlot.id,
            deskCode: myActiveBookingInSlot.desk?.deskCode || myActiveBookingInSlot.meetingRoom?.name || 'Meeting Room',
            deskId: myActiveBookingInSlot.deskId,
            meetingRoomId: myActiveBookingInSlot.meetingRoomId,
            resourceType: myActiveBookingInSlot.resourceType || (myActiveBookingInSlot.meetingRoomId ? 'MEETING_ROOM' : 'DESK'),
            slotType: myActiveBookingInSlot.slotType,
            startTime: myActiveBookingInSlot.startTime,
            endTime: myActiveBookingInSlot.endTime,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Failed to get employee floor plans:', error);
    return res.status(500).json({ error: error.message });
  }
});

export function computeSessionTimes(bookingDateStr?: string, sessionOrSlotType: string = 'FULL_DAY') {
  const dateObj = bookingDateStr ? new Date(bookingDateStr) : new Date();
  if (isNaN(dateObj.getTime())) {
    throw new Error('Invalid booking date format. Expected YYYY-MM-DD.');
  }

  const y = dateObj.getFullYear();
  const m = dateObj.getMonth();
  const d = dateObj.getDate();

  let startTime: Date;
  let endTime: Date;
  let normalizedSessionType = 'FULL_DAY';
  let normalizedSlotType = 'FULL_DAY';

  const typeUpper = (sessionOrSlotType || 'FULL_DAY').toUpperCase().replace(/[-\s]/g, '_');

  if (typeUpper === 'SESSION_1' || typeUpper === 'MORNING' || typeUpper === 'S1') {
    startTime = new Date(y, m, d, 9, 0, 0, 0);
    endTime = new Date(y, m, d, 13, 30, 0, 0);
    normalizedSessionType = 'SESSION_1';
    normalizedSlotType = 'MORNING';
  } else if (typeUpper === 'SESSION_2' || typeUpper === 'AFTERNOON' || typeUpper === 'S2') {
    startTime = new Date(y, m, d, 13, 30, 0, 0);
    endTime = new Date(y, m, d, 18, 0, 0, 0);
    normalizedSessionType = 'SESSION_2';
    normalizedSlotType = 'AFTERNOON';
  } else {
    // FULL_DAY / ALL
    startTime = new Date(y, m, d, 9, 0, 0, 0);
    endTime = new Date(y, m, d, 18, 0, 0, 0);
    normalizedSessionType = 'FULL_DAY';
    normalizedSlotType = 'FULL_DAY';
  }

  return { startTime, endTime, normalizedSessionType, normalizedSlotType };
}

/**
 * GET /api/employee/calendar-bookings
 * Returns bookings in a date range for Outlook-style Calendar view
 */
router.get('/calendar-bookings', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const user = req.user!;
    const startDateStr = req.query.startDate as string;
    const endDateStr = req.query.endDate as string;
    const branchId = req.query.branchId as string | undefined;
    const resourceType = req.query.resourceType as string; // 'ALL' | 'DESK' | 'MEETING_ROOM'
    const sessionType = req.query.sessionType as string; // 'ALL' | 'SESSION_1' | 'SESSION_2' | 'FULL_DAY'

    const now = new Date();
    const startRange = startDateStr ? new Date(`${startDateStr}T00:00:00.000Z`) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endRange = endDateStr ? new Date(`${endDateStr}T23:59:59.999Z`) : new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999);

    const whereClause: any = {
      organizationId: orgId,
      status: 'CONFIRMED',
      startTime: { lte: endRange },
      endTime: { gte: startRange },
    };

    if (resourceType && resourceType !== 'ALL') {
      whereClause.resourceType = resourceType;
    }

    if (sessionType && sessionType !== 'ALL' && sessionType !== 'CUSTOM') {
      const { normalizedSessionType } = computeSessionTimes(undefined, sessionType);
      whereClause.OR = [
        { sessionType: normalizedSessionType },
        { sessionType: 'FULL_DAY' },
        { sessionType: 'CUSTOM' },
      ];
    }

    const bookings = await prisma.booking.findMany({
      where: whereClause,
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
        meetingRoom: {
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
        user: { select: { id: true, name: true, email: true, department: true } },
        bookedByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    const filtered = bookings.filter((b) => {
      const itemBranchId = b.desk?.section?.floor?.building?.branchId || b.meetingRoom?.section?.floor?.building?.branchId;
      if (branchId && itemBranchId && itemBranchId !== branchId) return false;
      return true;
    });

    const events = filtered.map((b) => {
      const isMeeting = b.resourceType === 'MEETING_ROOM' || !!b.meetingRoomId;
      const section = b.desk?.section || b.meetingRoom?.section;
      const floor = section?.floor;
      const building = floor?.building;
      const branch = building?.branch;

      const dateStr = b.startTime.toISOString().split('T')[0];

      return {
        id: b.id,
        resourceType: isMeeting ? 'MEETING_ROOM' : 'DESK',
        resourceId: isMeeting ? b.meetingRoomId! : b.deskId!,
        resourceCode: isMeeting ? (b.meetingRoom?.name || 'Meeting Room') : (b.desk?.deskCode || 'Desk'),
        resourceName: isMeeting ? (b.meetingRoom?.name || 'Meeting Room') : `Desk ${b.desk?.deskCode || ''}`,
        sessionType: b.sessionType || (b.slotType === 'MORNING' ? 'SESSION_1' : b.slotType === 'AFTERNOON' ? 'SESSION_2' : 'FULL_DAY'),
        slotType: b.slotType,
        bookingDate: dateStr,
        startTime: b.startTime.toISOString(),
        endTime: b.endTime.toISOString(),
        durationMinutes: b.durationMinutes || null,
        status: b.status,
        title: b.title || (isMeeting ? b.meetingRoom?.name : `Desk ${b.desk?.deskCode}`),
        attendeesCount: b.attendeesCount || (isMeeting ? b.meetingRoom?.capacity : 1),
        notes: b.notes,
        user: b.user,
        bookedByUser: b.bookedByUser,
        isMine: b.userId === user.id || b.bookedByUserId === user.id,
        location: {
          branchId: branch?.id || '',
          branchName: branch?.name || '',
          buildingId: building?.id || '',
          buildingName: building?.name || '',
          floorId: floor?.id || '',
          floorName: floor?.name || '',
          sectionId: section?.id || '',
          sectionName: section?.name || '',
        },
      };
    });

    return res.json({
      success: true,
      totalEvents: events.length,
      events,
    });
  } catch (error: any) {
    console.error('Failed to get calendar bookings:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/employee/meeting-rooms
 * Lists meeting rooms with real-time availability status
 */
router.get('/meeting-rooms', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const user = req.user!;
    const bookingDate = (req.query.bookingDate as string) || new Date().toISOString().split('T')[0];
    const sessionType = (req.query.sessionType as string) || 'FULL_DAY';
    const reqBranchId = req.query.branchId as string | undefined;

    const { startTime, endTime } = computeSessionTimes(bookingDate, sessionType);

    const meetingRooms = await prisma.meetingRoom.findMany({
      where: {
        organizationId: orgId,
        section: {
          floor: {
            building: {
              branchId: reqBranchId ? reqBranchId : undefined,
            },
          },
        },
      },
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
        bookings: {
          where: {
            status: 'CONFIRMED',
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
          include: {
            user: { select: { id: true, name: true, email: true, department: true } },
            bookedByUser: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const enrichedRooms = meetingRooms.map((mr) => {
      const activeBooking = mr.bookings[0] || null;
      const isReserved = !!activeBooking;
      const isMyBooking = mr.bookings.some((b) => b.userId === user.id);

      return {
        id: mr.id,
        name: mr.name,
        capacity: mr.capacity,
        hasHdmi: mr.hasHdmi,
        hdmiCount: mr.hdmiCount,
        sectionId: mr.sectionId,
        sectionName: mr.section.name,
        floorName: mr.section.floor.name,
        floorCode: mr.section.floor.code,
        buildingName: mr.section.floor.building.name,
        branchName: mr.section.floor.building.branch.name,
        branchId: mr.section.floor.building.branch.id,
        isReserved,
        isMyBooking,
        activeBooking: activeBooking
          ? {
              id: activeBooking.id,
              title: activeBooking.title,
              attendeesCount: activeBooking.attendeesCount,
              sessionType: activeBooking.sessionType,
              slotType: activeBooking.slotType,
              durationMinutes: activeBooking.durationMinutes,
              startTime: activeBooking.startTime,
              endTime: activeBooking.endTime,
              user: activeBooking.user,
              bookedByUser: activeBooking.bookedByUser,
              notes: activeBooking.notes,
            }
          : null,
      };
    });

    return res.json({
      success: true,
      bookingDate,
      sessionType,
      meetingRooms: enrichedRooms,
    });
  } catch (error: any) {
    console.error('Failed to get meeting rooms:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/employee/bookings
 * Atomic workstation or whole meeting room reservation
 */
router.post('/bookings', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const callerUser = req.user!;
    const { 
      deskId, 
      meetingRoomId,
      slotType = 'FULL_DAY', 
      sessionType,
      bookingDate, 
      bookingDates, 
      startHour,
      startMinute,
      durationHours,
      durationMinutes,
      startTimeStr,
      endTimeStr,
      title,
      attendeesCount,
      notes, 
      colleagueUserId,
      skipConflicts = false,
    } = req.body;

    if (!deskId && !meetingRoomId) {
      return res.status(400).json({ error: 'deskId or meetingRoomId is required.' });
    }

    // Determine target recipient (self vs colleague proxy)
    let targetUserId = callerUser.id;
    let bookedByUserId: string | null = null;

    if (colleagueUserId && colleagueUserId !== callerUser.id) {
      const colleague = await prisma.user.findFirst({
        where: { id: colleagueUserId, organizationId: orgId, isActive: true },
      });
      if (!colleague) {
        return res.status(404).json({ error: 'Colleague user not found or account is deactivated.' });
      }
      targetUserId = colleague.id;
      bookedByUserId = callerUser.id;
    }

    // ==========================================
    // 1. WHOLE MEETING ROOM RESERVATION ENGINE
    // ==========================================
    if (meetingRoomId) {
      const meetingRoom = await prisma.meetingRoom.findFirst({
        where: { id: meetingRoomId, organizationId: orgId },
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
      });

      if (!meetingRoom) {
        return res.status(404).json({ error: 'Selected meeting room not found.' });
      }

      // Base Date parsing
      const dateStr = bookingDate || (bookingDates && bookingDates[0]) || new Date().toISOString().split('T')[0];
      const dParts = dateStr.split('-').map(Number);
      if (dParts.length !== 3 || isNaN(dParts[0]) || isNaN(dParts[1]) || isNaN(dParts[2])) {
        return res.status(400).json({ error: 'Invalid booking date format. Expected YYYY-MM-DD.' });
      }

      let computedStartTime: Date;
      let computedEndTime: Date;
      let totalDurationMinutes: number;

      // Handle custom hours and minutes duration input
      const sHour = startHour !== undefined && startHour !== null ? parseInt(startHour) : 9;
      const sMinute = startMinute !== undefined && startMinute !== null ? parseInt(startMinute) : 0;
      const dHours = durationHours !== undefined && durationHours !== null ? parseInt(durationHours) : 0;
      const dMinutes = durationMinutes !== undefined && durationMinutes !== null ? parseInt(durationMinutes) : 0;

      if (startTimeStr && endTimeStr) {
        computedStartTime = new Date(startTimeStr);
        computedEndTime = new Date(endTimeStr);
        totalDurationMinutes = Math.round((computedEndTime.getTime() - computedStartTime.getTime()) / (60 * 1000));
      } else if (durationHours !== undefined || durationMinutes !== undefined || startHour !== undefined) {
        totalDurationMinutes = dHours * 60 + dMinutes;
        computedStartTime = new Date(dParts[0], dParts[1] - 1, dParts[2], sHour, sMinute, 0, 0);
        computedEndTime = new Date(computedStartTime.getTime() + totalDurationMinutes * 60 * 1000);
      } else {
        // Fallback to session slot
        const sessionInfo = computeSessionTimes(dateStr, sessionType || slotType);
        computedStartTime = sessionInfo.startTime;
        computedEndTime = sessionInfo.endTime;
        totalDurationMinutes = Math.round((computedEndTime.getTime() - computedStartTime.getTime()) / (60 * 1000));
      }

      // Rule: Minimum duration of at least 15 minutes
      if (totalDurationMinutes < 15) {
        return res.status(400).json({
          error: `Meeting rooms must be booked for at least 15 minutes. Selected duration: ${totalDurationMinutes} minutes.`,
        });
      }

      // Rule: 30-day forward horizon only
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const maxFuture = new Date(todayStart.getTime() + 30 * 24 * 60 * 60 * 1000 + (24 * 60 * 60 * 1000 - 1));

      if (computedStartTime < todayStart) {
        return res.status(400).json({
          error: 'Meeting rooms cannot be booked for past dates.',
        });
      }

      if (computedStartTime > maxFuture) {
        return res.status(400).json({
          error: 'Meeting rooms can only be booked up to 30 days in advance.',
        });
      }

      // Rule: Single Active Future Reservation ("One at a Time across 30 days")
      const activeFutureMeeting = await prisma.booking.findFirst({
        where: {
          organizationId: orgId,
          userId: targetUserId,
          status: 'CONFIRMED',
          meetingRoomId: { not: null },
          endTime: { gt: now },
        },
        include: {
          meetingRoom: true,
        },
        orderBy: { startTime: 'asc' },
      });

      if (activeFutureMeeting) {
        const activeDateStr = activeFutureMeeting.startTime.toISOString().split('T')[0];
        const activeStartStr = activeFutureMeeting.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const activeEndStr = activeFutureMeeting.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return res.status(409).json({
          error: `You already have an active future reservation for "${activeFutureMeeting.meetingRoom?.name || 'Meeting Room'}" on ${activeDateStr} (${activeStartStr} - ${activeEndStr}). You can only hold one active meeting room reservation at a time across 30 days. You can schedule another after this reservation completes.`,
        });
      }

      // Rule: Room Collision Check
      const collision = await prisma.booking.findFirst({
        where: {
          organizationId: orgId,
          meetingRoomId,
          status: 'CONFIRMED',
          startTime: { lt: computedEndTime },
          endTime: { gt: computedStartTime },
        },
        include: {
          user: { select: { name: true } },
        },
      });

      if (collision) {
        const colStart = collision.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const colEnd = collision.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return res.status(409).json({
          error: `This meeting room is already reserved from ${colStart} to ${colEnd}. Please choose another time slot.`,
        });
      }

      // Create confirmed whole-room meeting booking
      const createdMeetingBooking = await prisma.booking.create({
        data: {
          organizationId: orgId,
          meetingRoomId,
          userId: targetUserId,
          bookedByUserId,
          resourceType: 'MEETING_ROOM',
          sessionType: 'CUSTOM',
          slotType: 'CUSTOM',
          title: title?.trim() || meetingRoom.name,
          attendeesCount: attendeesCount ? parseInt(attendeesCount) : meetingRoom.capacity,
          durationMinutes: totalDurationMinutes,
          startTime: computedStartTime,
          endTime: computedEndTime,
          status: 'CONFIRMED',
          notes: notes || null,
        },
        include: {
          meetingRoom: true,
          user: { select: { id: true, name: true, email: true } },
          bookedByUser: { select: { id: true, name: true, email: true } },
        },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorUserId: callerUser.id,
          action: 'BOOK_MEETING_ROOM',
          entityType: 'Booking',
          entityId: createdMeetingBooking.id,
          metadata: {
            meetingRoomId: meetingRoom.id,
            meetingRoomName: meetingRoom.name,
            startTime: computedStartTime.toISOString(),
            endTime: computedEndTime.toISOString(),
            durationMinutes: totalDurationMinutes,
            beneficiaryUserId: targetUserId,
          },
        },
      });

      return res.status(201).json({
        success: true,
        message: `Successfully reserved ${meetingRoom.name} for ${dateStr}.`,
        booking: createdMeetingBooking,
      });
    }

    // ==========================================
    // 2. WORKSTATION DESK RESERVATION ENGINE
    // ==========================================

    const rawDates: string[] =
      Array.isArray(bookingDates) && bookingDates.length > 0
        ? bookingDates
        : bookingDate
        ? [bookingDate]
        : [new Date().toISOString().split('T')[0]];

    const uniqueDates = Array.from(new Set(rawDates)).sort();

    // Verify desk exists within caller's organization
    const desk = await prisma.desk.findFirst({
      where: { id: deskId, organizationId: orgId },
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
    });

    if (!desk) {
      return res.status(404).json({ error: 'Selected workstation desk not found.' });
    }

    const skippedDates: { date: string; reason: string }[] = [];

    // Atomic transaction for multi-day reservation creation
    const createdBookings = await prisma.$transaction(async (tx) => {
      const bookingsList: any[] = [];

      for (const dStr of uniqueDates) {
        const { startTime, endTime, normalizedSlotType } = computeSlotTimes(dStr, slotType);

        // 1. Check if desk has conflicting booking in overlapping window
        const conflictingDeskBooking = await tx.booking.findFirst({
          where: {
            organizationId: orgId,
            deskId,
            status: 'CONFIRMED',
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        });

        if (conflictingDeskBooking) {
          if (skipConflicts) {
            skippedDates.push({
              date: dStr,
              reason: `Desk ${desk.deskCode} is already reserved for ${normalizedSlotType.replace('_', ' ')} on ${dStr}`,
            });
            continue;
          }
          throw new Error(
            `Desk ${desk.deskCode} is already reserved on ${dStr} for the ${normalizedSlotType.replace('_', ' ')} slot.`
          );
        }

        // 2. Check if recipient user already has another desk reserved in this time slot
        const conflictingUserBooking = await tx.booking.findFirst({
          where: {
            organizationId: orgId,
            userId: targetUserId,
            status: 'CONFIRMED',
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
          include: { desk: true },
        });

        if (conflictingUserBooking) {
          if (skipConflicts) {
            skippedDates.push({
              date: dStr,
              reason: `Target user already has an active reservation for ${conflictingUserBooking.desk ? `Desk ${conflictingUserBooking.desk.deskCode}` : 'a resource'} on ${dStr}`,
            });
            continue;
          }
          throw new Error(
            `User already has an active reservation for ${conflictingUserBooking.desk ? `Desk ${conflictingUserBooking.desk.deskCode}` : 'a resource'} on ${dStr}.`
          );
        }

        // 3. Create booking record
        const bk = await tx.booking.create({
          data: {
            organizationId: orgId,
            deskId,
            userId: targetUserId,
            bookedByUserId,
            slotType: normalizedSlotType,
            startTime,
            endTime,
            status: 'CONFIRMED',
            notes: notes?.trim() || null,
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
            user: {
              select: { id: true, name: true, email: true, department: true },
            },
            bookedByUser: {
              select: { id: true, name: true, email: true },
            },
          },
        });

        bookingsList.push(bk);
      }

      if (bookingsList.length === 0) {
        throw new Error(
          skipConflicts && skippedDates.length > 0
            ? `All ${skippedDates.length} selected date(s) have conflicts and could not be booked.`
            : 'No valid booking dates could be scheduled.'
        );
      }

      // Update desk status to BOOKED if reservation includes current date
      const todayStr = new Date().toISOString().split('T')[0];
      const bookedDatesList = bookingsList.map((b) => b.startTime.toISOString().split('T')[0]);
      if (bookedDatesList.includes(todayStr)) {
        await tx.desk.update({
          where: { id: deskId },
          data: { status: 'BOOKED' },
        });
      }

      return bookingsList;
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorUserId: callerUser.id,
        action: bookedByUserId ? 'PROXY_BOOK_DESK' : 'BOOK_DESK',
        entityType: 'Booking',
        entityId: createdBookings[0]?.id || desk.id,
        metadata: {
          deskCode: desk.deskCode,
          slotType: slotType.toUpperCase(),
          targetUserId,
          dates: createdBookings.map((b) => b.startTime.toISOString().split('T')[0]),
          totalDays: createdBookings.length,
          skippedDates,
        },
      },
    });

    const firstBooking = createdBookings[0];
    const message = skippedDates.length > 0
      ? `Workstation ${desk.deskCode} reserved for ${createdBookings.length} day(s). Skipped ${skippedDates.length} conflicting day(s).`
      : `Workstation ${desk.deskCode} reserved successfully for ${createdBookings.length} day(s).`;

    return res.status(201).json({
      success: true,
      message,
      skippedDates,
      bookings: createdBookings.map((b) => ({
        id: b.id,
        slotType: b.slotType,
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
        notes: b.notes,
        desk: {
          id: desk.id,
          deskCode: desk.deskCode,
          hasHdmi: desk.hasHdmi,
          isMeetingRoom: desk.isMeetingRoom,
          sectionName: desk.section.name,
          floorName: desk.section.floor.name,
          buildingName: desk.section.floor.building.name,
          branchName: desk.section.floor.building.branch.name,
        },
        user: b.user,
        bookedByUser: b.bookedByUser,
      })),
      booking: firstBooking
        ? {
            id: firstBooking.id,
            slotType: firstBooking.slotType,
            startTime: firstBooking.startTime,
            endTime: firstBooking.endTime,
            status: firstBooking.status,
            notes: firstBooking.notes,
            desk: {
              id: desk.id,
              deskCode: desk.deskCode,
              hasHdmi: desk.hasHdmi,
              isMeetingRoom: desk.isMeetingRoom,
              sectionName: desk.section.name,
              floorName: desk.section.floor.name,
              buildingName: desk.section.floor.building.name,
              branchName: desk.section.floor.building.branch.name,
            },
            user: firstBooking.user,
            bookedByUser: firstBooking.bookedByUser,
          }
        : null,
    });
  } catch (error: any) {
    console.error('Failed to create booking:', error);
    return res.status(400).json({ error: error.message || 'Failed to complete desk reservation.' });
  }
});

/**
 * GET /api/employee/colleagues
 * Search and list active colleagues for proxy desk reservations
 */
router.get('/colleagues', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const user = req.user!;
    const search = (req.query.search as string)?.trim().toLowerCase();
    const branchId = (req.query.branchId as string) || user.scopedBranchId || user.baseBranchId;
    const now = new Date();

    const whereClause: any = {
      organizationId: orgId,
      id: { not: user.id },
      isActive: true,
      status: 'ACTIVE',
    };

    if (branchId) {
      whereClause.OR = [
        { scopedBranchId: branchId },
        { baseBranchId: branchId },
      ];
    }

    if (search) {
      whereClause.AND = [
        {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { department: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const colleagues = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        role: true,
        scopedBranchId: true,
        baseBranchId: true,
      },
      orderBy: { name: 'asc' },
      take: 50,
    });

    // Check who already has an active or confirmed booking today
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const activeBookingsToday = await prisma.booking.findMany({
      where: {
        organizationId: orgId,
        userId: { in: colleagues.map((c) => c.id) },
        status: 'CONFIRMED',
        startTime: { lte: endOfToday },
        endTime: { gte: startOfToday },
      },
      select: {
        userId: true,
        desk: {
          select: { deskCode: true },
        },
        meetingRoom: {
          select: { name: true },
        },
      },
    });

    const bookedUserMap = new Map<string, string>();
    for (const b of activeBookingsToday) {
      const code = b.desk?.deskCode || b.meetingRoom?.name || 'Reserved';
      bookedUserMap.set(b.userId, code);
    }

    const formattedColleagues = colleagues.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      department: c.department || 'General Staff',
      role: c.role,
      hasActiveBookingToday: bookedUserMap.has(c.id),
      reservedDeskCode: bookedUserMap.get(c.id) || null,
    }));

    return res.json({
      colleagues: formattedColleagues,
      total: formattedColleagues.length,
    });
  } catch (error: any) {
    console.error('Failed to search colleagues:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/employee/bulk-bookings
 * Atomic multi-desk pod reservation for agile team collaboration
 */
router.post('/bulk-bookings', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const callerUser = req.user!;
    const { deskIds, slotType = 'FULL_DAY', bookingDate, notes, allocations = [] } = req.body;

    if (!Array.isArray(deskIds) || deskIds.length === 0) {
      return res.status(400).json({ error: 'At least one workstation deskId must be provided for bulk booking.' });
    }

    if (deskIds.length > 8) {
      return res.status(400).json({ error: 'Bulk pod booking is limited to a maximum of 8 workstations per reservation.' });
    }

    const uniqueDeskIds = Array.from(new Set(deskIds));
    const { startTime, endTime, normalizedSlotType } = computeSlotTimes(bookingDate, slotType);

    // Verify all desks exist within the organization
    const desks = await prisma.desk.findMany({
      where: {
        id: { in: uniqueDeskIds },
        organizationId: orgId,
      },
      include: {
        section: true,
      },
    });

    if (desks.length !== uniqueDeskIds.length) {
      return res.status(404).json({ error: 'One or more selected workstation desks could not be found.' });
    }

    // Build allocation map: deskId -> targetUserId
    const allocationMap = new Map<string, { targetUserId: string; bookedByUserId: string | null }>();

    for (const alloc of allocations) {
      if (alloc.deskId && alloc.colleagueUserId) {
        allocationMap.set(alloc.deskId, {
          targetUserId: alloc.colleagueUserId,
          bookedByUserId: alloc.colleagueUserId !== callerUser.id ? callerUser.id : null,
        });
      }
    }

    // For any desk not explicitly mapped, assign to caller or unmapped
    for (const d of desks) {
      if (!allocationMap.has(d.id)) {
        allocationMap.set(d.id, {
          targetUserId: callerUser.id,
          bookedByUserId: null,
        });
      }
    }

    // Execute atomic reservation
    const createdBookings = await prisma.$transaction(async (tx) => {
      // 1. Concurrency check: Ensure none of the desks have conflicting active bookings
      const conflicts = await tx.booking.findMany({
        where: {
          organizationId: orgId,
          deskId: { in: uniqueDeskIds },
          status: 'CONFIRMED',
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        include: {
          desk: true,
        },
      });

      if (conflicts.length > 0) {
        const conflictCodes = conflicts.map((c) => c.desk?.deskCode || 'N/A').join(', ');
        throw new Error(`The following workstation(s) are already reserved: ${conflictCodes}`);
      }

      // 2. Create bookings
      const results = [];
      for (const d of desks) {
        const alloc = allocationMap.get(d.id)!;
        const b = await tx.booking.create({
          data: {
            organizationId: orgId,
            deskId: d.id,
            userId: alloc.targetUserId,
            bookedByUserId: alloc.bookedByUserId,
            slotType: normalizedSlotType,
            startTime,
            endTime,
            status: 'CONFIRMED',
            notes: notes?.trim() || 'Pod Group Reservation',
          },
          include: {
            desk: true,
            user: { select: { id: true, name: true, email: true } },
          },
        });
        results.push(b);
      }
      return results;
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorUserId: callerUser.id,
        action: 'BULK_BOOK_POD',
        entityType: 'Booking',
        entityId: createdBookings[0]?.id || 'bulk',
        metadata: {
          totalDesksBooked: createdBookings.length,
          deskCodes: desks.map((d) => d.deskCode),
          slotType: normalizedSlotType,
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: `Successfully booked ${createdBookings.length} pod workstation(s) for ${normalizedSlotType.replace('_', ' ')}.`,
      bookings: createdBookings,
      count: createdBookings.length,
    });
  } catch (error: any) {
    console.error('Failed to create bulk pod booking:', error);
    return res.status(400).json({ error: error.message || 'Failed to complete bulk pod reservation.' });
  }
});

/**
 * POST /api/employee/cancel-booking/**
 * POST /api/employee/cancel-booking
 * Releases reserved workstation or meeting room and marks reservation as CANCELLED
 */
router.post('/cancel-booking', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const user = req.user!;
    const { bookingId, reason } = req.body;

    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required to release reservation.' });
    }

    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, organizationId: orgId },
      include: {
        desk: true,
        meetingRoom: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking reservation record not found.' });
    }

    // Permission check
    const isOwner = booking.userId === user.id;
    const isProxyCreator = booking.bookedByUserId === user.id;
    const isAdmin = ['PLATFORM_ADMIN', 'ORGANIZATION_ADMIN', 'BRANCH_ADMIN'].includes(user.role);

    if (!isOwner && !isProxyCreator && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized: You can only cancel your own bookings.' });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ error: 'This booking has already been cancelled.' });
    }

    const cancellationNote = reason?.trim() ? `Cancelled: ${reason.trim()}` : 'Cancelled by user';
    const updatedNotes = booking.notes ? `${booking.notes} | ${cancellationNote}` : cancellationNote;

    const cancelledBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        notes: updatedNotes,
      },
      include: {
        desk: true,
        meetingRoom: true,
      },
    });

    const resourceName = booking.meetingRoom
      ? `Meeting Room ${booking.meetingRoom.name}`
      : `Desk ${booking.desk?.deskCode || 'N/A'}`;

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorUserId: user.id,
        action: 'CANCEL_BOOKING',
        entityType: 'Booking',
        entityId: booking.id,
        metadata: {
          resourceType: booking.resourceType,
          meetingRoomId: booking.meetingRoomId,
          meetingRoomName: booking.meetingRoom?.name,
          deskCode: booking.desk?.deskCode || null,
          slotType: booking.slotType,
          sessionType: booking.sessionType,
          startTime: booking.startTime.toISOString(),
          endTime: booking.endTime.toISOString(),
          reason: reason || null,
        },
      },
    });

    return res.json({
      success: true,
      message: `Reservation for ${resourceName} successfully released.`,
      booking: cancelledBooking,
    });
  } catch (error: any) {
    console.error('Failed to cancel booking:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/employee/my-bookings
 * Retrieves employee reservation history with pagination and status filtering
 */
router.get('/my-bookings', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const user = req.user!;
    const statusFilter = (req.query.status as string)?.trim().toUpperCase() || 'ALL';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
    const skip = (page - 1) * limit;
    const now = new Date();

    const whereClause: any = {
      organizationId: orgId,
      OR: [
        { userId: user.id },
        { bookedByUserId: user.id },
      ],
    };

    if (statusFilter === 'CONFIRMED') {
      whereClause.status = 'CONFIRMED';
      whereClause.endTime = { gte: now };
    } else if (statusFilter === 'CANCELLED') {
      whereClause.status = 'CANCELLED';
    } else if (statusFilter === 'PAST') {
      whereClause.status = 'CONFIRMED';
      whereClause.endTime = { lt: now };
    } else {
      // Default 'ALL': Exclude cancelled bookings, show all active and historical confirmed bookings
      whereClause.status = 'CONFIRMED';
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where: whereClause,
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
          meetingRoom: {
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
          user: { select: { id: true, name: true, email: true } },
          bookedByUser: { select: { id: true, name: true, email: true } },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where: whereClause }),
    ]);

    const formattedBookings = bookings.map((b) => ({
      id: b.id,
      resourceType: b.resourceType || (b.meetingRoomId ? 'MEETING_ROOM' : 'DESK'),
      sessionType: b.sessionType,
      title: b.title,
      durationMinutes: b.durationMinutes,
      attendeesCount: b.attendeesCount,
      slotType: b.slotType,
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      notes: b.notes,
      createdAt: b.createdAt,
      desk: b.desk
        ? {
            id: b.desk.id,
            deskCode: b.desk.deskCode,
            hasHdmi: b.desk.hasHdmi,
            isMeetingRoom: b.desk.isMeetingRoom,
            sectionName: b.desk.section?.name,
            floorCode: b.desk.section?.floor?.code,
            floorName: b.desk.section?.floor?.name,
            buildingName: b.desk.section?.floor?.building?.name,
            branchName: b.desk.section?.floor?.building?.branch?.name,
          }
        : null,
      meetingRoom: b.meetingRoom
        ? {
            id: b.meetingRoom.id,
            name: b.meetingRoom.name,
            capacity: b.meetingRoom.capacity,
            sectionName: b.meetingRoom.section?.name,
            floorCode: b.meetingRoom.section?.floor?.code,
            floorName: b.meetingRoom.section?.floor?.name,
            buildingName: b.meetingRoom.section?.floor?.building?.name,
            branchName: b.meetingRoom.section?.floor?.building?.branch?.name,
          }
        : null,
      isProxyBooking: !!b.bookedByUserId && b.bookedByUserId !== b.userId,
      user: b.user,
      bookedByUser: b.bookedByUser,
    }));

    return res.json({
      bookings: formattedBookings,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Failed to load my bookings:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/employee/bulk-cancel
 * Cancel multiple bookings simultaneously and release all selected desks and meeting rooms
 */
router.post('/bulk-cancel', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const userId = req.user!.id;
    const { bookingIds, deskIds } = req.body;

    if ((!bookingIds || !bookingIds.length) && (!deskIds || !deskIds.length)) {
      return res.status(400).json({ error: 'bookingIds or deskIds array is required' });
    }

    const where: any = {
      organizationId: orgId,
      status: 'CONFIRMED',
    };

    if (bookingIds && bookingIds.length > 0) {
      where.id = { in: bookingIds };
    } else if (deskIds && deskIds.length > 0) {
      where.deskId = { in: deskIds };
    }

    const targetBookings = await prisma.booking.findMany({
      where,
      include: { desk: true, meetingRoom: true },
    });

    if (targetBookings.length === 0) {
      return res.status(404).json({ error: 'No active confirmed bookings found for the selected IDs' });
    }

    const targetDeskIds = targetBookings.map((b: any) => b.deskId).filter(Boolean);
    const targetBookingIds = targetBookings.map((b: any) => b.id);

    await prisma.$transaction(async (tx: any) => {
      // 1. Mark desks as AVAILABLE if any
      if (targetDeskIds.length > 0) {
        await tx.desk.updateMany({
          where: { id: { in: targetDeskIds } },
          data: { status: 'AVAILABLE' },
        });
      }

      // 2. Mark bookings as CANCELLED
      await tx.booking.updateMany({
        where: { id: { in: targetBookingIds } },
        data: { status: 'CANCELLED' },
      });

      // 3. Create bulk cancellation audit log
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          actorUserId: userId,
          action: 'BULK_CANCEL_BOOKINGS',
          entityType: 'Booking',
          entityId: orgId,
          metadata: {
            cancelledCount: targetBookingIds.length,
            deskIds: targetDeskIds,
            bookingIds: targetBookingIds,
          },
        },
      });
    });

    return res.json({
      success: true,
      message: `Successfully cancelled and released ${targetBookingIds.length} reservation(s).`,
      count: targetBookingIds.length,
      deskIds: targetDeskIds,
    });
  } catch (error: any) {
    console.error('Failed bulk cancel:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Helper to generate and validate date lists up to 30 days
 */
export function generateDateList(
  startDateStr: string,
  endDateStr?: string,
  datesArray?: string[],
  weekdaysOnly: boolean = false
): string[] {
  if (datesArray && Array.isArray(datesArray) && datesArray.length > 0) {
    const uniqueDates = Array.from(new Set(datesArray.map((d) => d.trim()))).filter(Boolean);
    if (uniqueDates.length > 30) {
      throw new Error(`Maximum booking duration is capped at 30 days. You requested ${uniqueDates.length} days.`);
    }
    return uniqueDates;
  }

  if (!startDateStr) {
    throw new Error('Start date is required for booking.');
  }

  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) {
    throw new Error('Invalid start date format. Expected YYYY-MM-DD.');
  }

  const end = endDateStr ? new Date(endDateStr) : new Date(startDateStr);
  if (isNaN(end.getTime())) {
    throw new Error('Invalid end date format. Expected YYYY-MM-DD.');
  }

  if (end < start) {
    throw new Error('End date cannot be earlier than start date.');
  }

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  if (diffDays > 30) {
    throw new Error(`Maximum booking duration is capped at 30 days. The selected date range spans ${diffDays} days.`);
  }

  const result: string[] = [];
  const curr = new Date(start);
  while (curr <= end) {
    const dayOfWeek = curr.getDay(); // 0 = Sun, 6 = Sat
    if (!weekdaysOnly || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
      result.push(curr.toISOString().split('T')[0]);
    }
    curr.setDate(curr.getDate() + 1);
  }

  if (result.length > 30) {
    throw new Error(`Maximum booking duration is capped at 30 days. Selected days count: ${result.length}.`);
  }

  return result;
}

/**
 * POST /api/employee/mass-booking
 * Atomic multi-day, multi-desk, or meeting-room booking with max 30-day enforcement
 */
router.post('/mass-booking', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const callerUser = req.user!;
    const {
      resourceType = 'DESK',
      deskIds = [],
      meetingRoomId,
      startDate,
      endDate,
      dates = [],
      weekdaysOnly = false,
      sessionType = 'FULL_DAY',
      slotType,
      title,
      attendeesCount,
      notes,
      colleagueUserId,
      allocations = [],
    } = req.body;

    // 1. Generate & Validate Dates (Strict max 30 days)
    const targetDates = generateDateList(startDate || dates[0], endDate, dates, weekdaysOnly);

    // 2. Validate Target Recipient
    let targetUserId = callerUser.id;
    let bookedByUserId: string | null = null;
    if (colleagueUserId && colleagueUserId !== callerUser.id) {
      const colleague = await prisma.user.findFirst({
        where: { id: colleagueUserId, organizationId: orgId, isActive: true },
      });
      if (!colleague) {
        return res.status(404).json({ error: 'Colleague user not found or account is deactivated.' });
      }
      targetUserId = colleague.id;
      bookedByUserId = callerUser.id;
    }

    const isMeetingRoom = resourceType === 'MEETING_ROOM' || !!meetingRoomId;

    if (isMeetingRoom) {
      if (!meetingRoomId) {
        return res.status(400).json({ error: 'meetingRoomId is required for meeting room booking.' });
      }

      const room = await prisma.meetingRoom.findFirst({
        where: { id: meetingRoomId, organizationId: orgId },
        include: {
          section: {
            include: {
              floor: {
                include: {
                  building: {
                    include: { branch: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!room) {
        return res.status(404).json({ error: 'Selected meeting room could not be found.' });
      }

      if (attendeesCount && attendeesCount > room.capacity) {
        return res.status(400).json({
          error: `Attendees count (${attendeesCount}) exceeds meeting room maximum capacity of ${room.capacity}.`,
        });
      }

      // Rule: Single active future reservation for meeting room across 30 days!
      const now = new Date();
      if (targetDates.length > 1) {
        return res.status(400).json({
          error: `Meeting rooms can only be booked for one day/slot at a time within the 30-day horizon. You cannot book multiple days concurrently.`,
        });
      }

      const activeFutureMeeting = await prisma.booking.findFirst({
        where: {
          organizationId: orgId,
          userId: targetUserId,
          status: 'CONFIRMED',
          meetingRoomId: { not: null },
          endTime: { gt: now },
        },
        include: { meetingRoom: true },
        orderBy: { startTime: 'asc' },
      });

      if (activeFutureMeeting) {
        const activeDateStr = activeFutureMeeting.startTime.toISOString().split('T')[0];
        const activeStartStr = activeFutureMeeting.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const activeEndStr = activeFutureMeeting.endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return res.status(409).json({
          error: `You already have an active future reservation for "${activeFutureMeeting.meetingRoom?.name || 'Meeting Room'}" on ${activeDateStr} (${activeStartStr} - ${activeEndStr}). You can only hold one active meeting room reservation at a time across 30 days.`,
        });
      }

      // Execute Atomic Booking Transaction
      const createdBookings = await prisma.$transaction(async (tx) => {
        const bookingsList = [];

        for (const dateStr of targetDates) {
          const { startTime, endTime, normalizedSessionType, normalizedSlotType } = computeSessionTimes(
            dateStr,
            sessionType || slotType
          );

          // Check if meeting room is already booked
          const conflict = await tx.booking.findFirst({
            where: {
              organizationId: orgId,
              meetingRoomId: room.id,
              status: 'CONFIRMED',
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          });

          if (conflict) {
            throw new Error(
              `Meeting room ${room.name} is already booked on ${dateStr} for ${normalizedSessionType.replace('_', ' ')}.`
            );
          }

          const b = await tx.booking.create({
            data: {
              organizationId: orgId,
              meetingRoomId: room.id,
              userId: targetUserId,
              bookedByUserId,
              resourceType: 'MEETING_ROOM',
              sessionType: normalizedSessionType,
              slotType: normalizedSlotType,
              title: title?.trim() || `${room.name} Reservation`,
              attendeesCount: attendeesCount || room.capacity,
              startTime,
              endTime,
              status: 'CONFIRMED',
              notes: notes?.trim() || 'Meeting Room Reservation',
            },
            include: {
              meetingRoom: true,
              user: { select: { id: true, name: true, email: true } },
            },
          });
          bookingsList.push(b);
        }

        return bookingsList;
      });

      // Audit log
      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorUserId: callerUser.id,
          action: 'MASS_BOOK_MEETING_ROOM',
          entityType: 'Booking',
          entityId: createdBookings[0]?.id || 'mass_mr',
          metadata: {
            meetingRoomId: room.id,
            roomName: room.name,
            totalDays: targetDates.length,
            dates: targetDates,
            sessionType,
            title,
          },
        },
      });

      return res.status(201).json({
        success: true,
        message: `Successfully booked ${room.name} for ${targetDates.length} day(s) (${sessionType.replace('_', ' ')}).`,
        count: createdBookings.length,
        bookings: createdBookings,
      });
    } else {
      // Cubicle / Desk Mass Booking
      const targetDeskIds: string[] = Array.isArray(deskIds) && deskIds.length > 0 ? Array.from(new Set(deskIds)) : [];

      if (targetDeskIds.length === 0) {
        return res.status(400).json({ error: 'At least one deskId must be provided for workstation mass booking.' });
      }

      if (targetDeskIds.length > 8) {
        return res.status(400).json({ error: 'Workstation mass booking is limited to a maximum of 8 workstations.' });
      }

      const desks = await prisma.desk.findMany({
        where: { id: { in: targetDeskIds }, organizationId: orgId },
        include: {
          section: {
            include: {
              floor: {
                include: {
                  building: {
                    include: { branch: true },
                  },
                },
              },
            },
          },
        },
      });

      if (desks.length !== targetDeskIds.length) {
        return res.status(404).json({ error: 'One or more selected workstation desks could not be found.' });
      }

      // Build allocation map
      const allocationMap = new Map<string, { targetUserId: string; bookedByUserId: string | null }>();
      for (const alloc of allocations) {
        if (alloc.deskId && alloc.colleagueUserId) {
          allocationMap.set(alloc.deskId, {
            targetUserId: alloc.colleagueUserId,
            bookedByUserId: alloc.colleagueUserId !== callerUser.id ? callerUser.id : null,
          });
        }
      }

      for (const d of desks) {
        if (!allocationMap.has(d.id)) {
          allocationMap.set(d.id, {
            targetUserId,
            bookedByUserId,
          });
        }
      }

      // Atomic multi-day, multi-desk creation
      const createdBookings = await prisma.$transaction(async (tx) => {
        const bookingsList = [];

        for (const dateStr of targetDates) {
          const { startTime, endTime, normalizedSessionType, normalizedSlotType } = computeSessionTimes(
            dateStr,
            sessionType || slotType
          );

          // Check desk conflicts on this date
          const conflicts = await tx.booking.findMany({
            where: {
              organizationId: orgId,
              deskId: { in: targetDeskIds },
              status: 'CONFIRMED',
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
            include: { desk: true },
          });

          if (conflicts.length > 0) {
            const conflictCodes = conflicts.map((c) => c.desk?.deskCode || c.deskId).join(', ');
            throw new Error(
              `Workstation(s) [${conflictCodes}] already booked on ${dateStr} for ${normalizedSessionType.replace('_', ' ')}.`
            );
          }

          // Create booking for each desk on this date
          for (const d of desks) {
            const alloc = allocationMap.get(d.id)!;
            const b = await tx.booking.create({
              data: {
                organizationId: orgId,
                deskId: d.id,
                userId: alloc.targetUserId,
                bookedByUserId: alloc.bookedByUserId,
                resourceType: 'DESK',
                sessionType: normalizedSessionType,
                slotType: normalizedSlotType,
                startTime,
                endTime,
                status: 'CONFIRMED',
                notes: notes?.trim() || `Mass Booking (${targetDates.length} days)`,
              },
              include: {
                desk: true,
                user: { select: { id: true, name: true, email: true } },
              },
            });
            bookingsList.push(b);
          }
        }

        return bookingsList;
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorUserId: callerUser.id,
          action: 'MASS_BOOK_DESKS',
          entityType: 'Booking',
          entityId: createdBookings[0]?.id || 'mass_desks',
          metadata: {
            deskIds: targetDeskIds,
            deskCodes: desks.map((d) => d.deskCode),
            totalDays: targetDates.length,
            totalCreated: createdBookings.length,
            sessionType,
            dates: targetDates,
          },
        },
      });

      return res.status(201).json({
        success: true,
        message: `Successfully booked ${desks.length} workstation(s) across ${targetDates.length} day(s) (${createdBookings.length} total reservations).`,
        count: createdBookings.length,
        bookings: createdBookings,
      });
    }
  } catch (error: any) {
    console.error('Failed to create mass booking:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
