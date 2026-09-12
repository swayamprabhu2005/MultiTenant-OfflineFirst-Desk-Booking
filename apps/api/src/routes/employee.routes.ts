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
async function ensureMeetingRoomDesks(orgId: string) {
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
    const bookingDate = req.query.bookingDate as string | undefined;
    const slotType = (req.query.slotType as string | undefined) || 'FULL_DAY';
    const reqBranchId = req.query.branchId as string | undefined;

    await ensureMeetingRoomDesks(orgId);

    const { startTime, endTime } = computeSlotTimes(bookingDate, slotType);

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
                            startTime: { lt: endTime },
                            endTime: { gt: startTime },
                          },
                          select: {
                            id: true,
                            userId: true,
                            slotType: true,
                            startTime: true,
                            endTime: true,
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
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      include: {
        desk: {
          include: {
            section: true,
          },
        },
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
              const activeBooking = desk.bookings[0] || null;
              const isMyBooking = desk.bookings.some((bk) => bk.userId === user.id);
              const isReserved = !!activeBooking;

              return {
                id: desk.id,
                deskCode: desk.deskCode,
                deskNumber: desk.deskNumber,
                hasHdmi: desk.hasHdmi,
                isMeetingRoom: desk.isMeetingRoom,
                status: isReserved ? 'BOOKED' : 'AVAILABLE',
                isReserved,
                isMyBooking,
                activeBooking: activeBooking
                  ? {
                      id: activeBooking.id,
                      slotType: activeBooking.slotType,
                      startTime: activeBooking.startTime,
                      endTime: activeBooking.endTime,
                      user: activeBooking.user,
                      bookedByUser: activeBooking.bookedByUser,
                    }
                  : null,
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
        slotType: slotType.toUpperCase(),
        startTime,
        endTime,
      },
      myActiveBooking: myActiveBookingInSlot
        ? {
            id: myActiveBookingInSlot.id,
            deskCode: myActiveBookingInSlot.desk.deskCode,
            deskId: myActiveBookingInSlot.deskId,
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

/**
 * POST /api/employee/bookings
 * Atomic desk reservation supporting 3 time-slots and overlap prevention
 */
router.post('/bookings', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const callerUser = req.user!;
    const { deskId, slotType = 'FULL_DAY', bookingDate, notes, colleagueUserId } = req.body;

    if (!deskId) {
      return res.status(400).json({ error: 'Workstation deskId is required.' });
    }

    const { startTime, endTime, normalizedSlotType } = computeSlotTimes(bookingDate, slotType);

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

    // Atomic transaction for double-booking concurrency check and booking creation
    const booking = await prisma.$transaction(async (tx) => {
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
        throw new Error(
          `Desk ${desk.deskCode} is already reserved for the ${normalizedSlotType.replace('_', ' ')} slot.`
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
        include: {
          desk: true,
        },
      });

      if (conflictingUserBooking) {
        throw new Error(
          `User already has an active reservation for Desk ${conflictingUserBooking.desk.deskCode} in this time window.`
        );
      }

      // 3. Create booking record
      return await tx.booking.create({
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
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorUserId: callerUser.id,
        action: bookedByUserId ? 'PROXY_BOOK_DESK' : 'BOOK_DESK',
        entityType: 'Booking',
        entityId: booking.id,
        metadata: {
          deskCode: desk.deskCode,
          slotType: normalizedSlotType,
          targetUserId,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: `Workstation ${desk.deskCode} confirmed successfully for ${normalizedSlotType.replace('_', ' ')}.`,
      booking: {
        id: booking.id,
        slotType: booking.slotType,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        notes: booking.notes,
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
        user: booking.user,
        bookedByUser: booking.bookedByUser,
      },
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
      },
    });

    const bookedUserMap = new Map<string, string>();
    for (const b of activeBookingsToday) {
      bookedUserMap.set(b.userId, b.desk.deskCode);
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
        const conflictCodes = conflicts.map((c) => c.desk.deskCode).join(', ');
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
 * POST /api/employee/cancel-booking
 * Releases reserved workstation and marks reservation as CANCELLED
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
      return res.status(403).json({ error: 'Unauthorized: You can only cancel your own desk bookings.' });
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
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorUserId: user.id,
        action: 'CANCEL_BOOKING',
        entityType: 'Booking',
        entityId: booking.id,
        metadata: {
          deskCode: booking.desk.deskCode,
          slotType: booking.slotType,
          startTime: booking.startTime.toISOString(),
          endTime: booking.endTime.toISOString(),
          reason: reason || null,
        },
      },
    });

    return res.json({
      success: true,
      message: `Reservation for Desk ${booking.desk.deskCode} successfully released.`,
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
      slotType: b.slotType,
      startTime: b.startTime,
      endTime: b.endTime,
      status: b.status,
      notes: b.notes,
      createdAt: b.createdAt,
      desk: {
        id: b.desk.id,
        deskCode: b.desk.deskCode,
        hasHdmi: b.desk.hasHdmi,
        isMeetingRoom: b.desk.isMeetingRoom,
        sectionName: b.desk.section.name,
        floorCode: b.desk.section.floor.code,
        floorName: b.desk.section.floor.name,
        buildingName: b.desk.section.floor.building.name,
        branchName: b.desk.section.floor.building.branch.name,
      },
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

export default router;
