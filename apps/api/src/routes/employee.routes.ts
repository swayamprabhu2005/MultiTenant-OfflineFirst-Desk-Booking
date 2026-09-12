import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { Role } from '@deskbooking/shared';

const router = Router();

// All employee routes require authentication
router.use(authMiddleware);

/**
 * GET /api/employee/colleagues
 * Returns list of active colleagues in the organization/branch for "Book on behalf of" selection
 */
router.get('/colleagues', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const branchId = req.user!.scopedBranchId || req.user!.baseBranchId;

    const where: any = {
      organizationId: orgId,
      status: 'ACTIVE',
    };

    // If employee is assigned to a specific branch, prioritize or filter to branch colleagues
    if (branchId) {
      where.OR = [
        { scopedBranchId: branchId },
        { baseBranchId: branchId },
      ];
    }

    const colleagues = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        role: true,
        baseBranch: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return res.json(colleagues);
  } catch (error: any) {
    console.error('Failed to get colleagues:', error);
    return res.status(500).json({ error: error.message });
  }
});

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
        (d: any) => d.isMeetingRoom || d.deskCode.startsWith('M-')
      );

      if (existingMeetingDesks.length < mr.capacity) {
        const existingCodes = new Set(existingMeetingDesks.map((d: any) => d.deskCode));
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
 * GET /api/employee/dashboard-summary
 * Returns active booking, branch metrics, and recent activity for the employee
 */
router.get('/dashboard-summary', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const userId = req.user!.id;
    const branchId = req.user!.scopedBranchId || req.user!.baseBranchId;

    // Auto-sync meeting room desks if needed
    await ensureMeetingRoomDesks(orgId);

    // 1. Find active confirmed booking
    const now = new Date();
    const activeBooking = await prisma.booking.findFirst({
      where: {
        userId,
        status: 'CONFIRMED',
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
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    // 2. Count total personal bookings
    const totalBookings = await prisma.booking.count({
      where: { userId },
    });

    // 3. Get recent bookings (last 5)
    const recentBookings = await prisma.booking.findMany({
      where: { userId },
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
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // 4. Calculate branch statistics
    let assignedBranch: any = null;
    let branchStats = {
      totalDesks: 0,
      availableDesks: 0,
      occupiedDesks: 0,
      meetingRoomCount: 0,
    };

    const targetBranchWhere: any = { organizationId: orgId };
    if (branchId) {
      targetBranchWhere.id = branchId;
    }

    const branch = await prisma.branch.findFirst({
      where: targetBranchWhere,
      include: {
        buildings: {
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
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (branch) {
      assignedBranch = {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        address: branch.address,
        status: branch.status,
      };

      branch.buildings.forEach((bld: any) => {
        bld.floors.forEach((fl: any) => {
          fl.sections.forEach((sec: any) => {
            branchStats.totalDesks += sec.desks.length;
            sec.desks.forEach((d: any) => {
              if (d.status === 'AVAILABLE') {
                branchStats.availableDesks++;
              } else {
                branchStats.occupiedDesks++;
              }
            });
            if (sec.meetingRoom) {
              branchStats.meetingRoomCount++;
            }
          });
        });
      });
    }

    return res.json({
      activeBooking,
      totalBookings,
      assignedBranch,
      branchStats,
      recentBookings,
    });
  } catch (error: any) {
    console.error('Failed to get employee dashboard summary:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/employee/floor-plans
 * Returns 2D floor plans scoped to the employee's branch
 */
router.get('/floor-plans', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const userId = req.user!.id;
    const branchId = req.user!.scopedBranchId || req.user!.baseBranchId;

    // Auto-sync meeting room desks if needed
    await ensureMeetingRoomDesks(orgId);

    const where: any = { organizationId: orgId };
    if (branchId) {
      where.id = branchId;
    }

    const branches = await prisma.branch.findMany({
      where,
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
                          where: { status: 'CONFIRMED' },
                          select: {
                            id: true,
                            userId: true,
                            startTime: true,
                            endTime: true,
                            user: {
                              select: {
                                name: true,
                                email: true,
                              },
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

    // Annotate desks with whether current user holds the active reservation
    const enrichedBranches = branches.map((b: any) => ({
      ...b,
      buildings: b.buildings.map((bld: any) => ({
        ...bld,
        floors: bld.floors.map((fl: any) => ({
          ...fl,
          sections: fl.sections.map((sec: any) => ({
            ...sec,
            desks: sec.desks.map((desk: any) => {
              const activeBooking = desk.bookings[0] || null;
              const isMyBooking = desk.bookings.some(
                (bk: any) => bk.userId === userId
              );
              return {
                id: desk.id,
                organizationId: desk.organizationId,
                sectionId: desk.sectionId,
                deskCode: desk.deskCode,
                deskNumber: desk.deskNumber,
                hasHdmi: desk.hasHdmi,
                isMeetingRoom: desk.isMeetingRoom,
                status: desk.status,
                isMyBooking,
                bookingId: activeBooking?.id || null,
                bookedForName: activeBooking?.user?.name || null,
              };
            }),
          })),
        })),
      })),
    }));

    return res.json(enrichedBranches);
  } catch (error: any) {
    console.error('Failed to get employee floor plans:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/employee/bookings
 * Returns all bookings made by or for the authenticated employee
 */
router.get('/bookings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const userId = req.user!.id;

    const bookings = await prisma.booking.findMany({
      where: {
        organizationId: orgId,
        userId,
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
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(bookings);
  } catch (error: any) {
    console.error('Failed to get employee bookings:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/employee/bookings
 * Atomically reserve a single desk for self or on behalf of a colleague
 */
router.post('/bookings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const currentUserId = req.user!.id;
    const { deskId, targetUserId, startTime, endTime } = req.body;

    if (!deskId) {
      return res.status(400).json({ error: 'deskId is required' });
    }

    // Determine target user (defaults to current user, or proxy booking for colleague)
    const effectiveUserId = targetUserId || currentUserId;

    // Verify target user exists in the organization
    const targetUser = await prisma.user.findFirst({
      where: { id: effectiveUserId, organizationId: orgId, status: 'ACTIVE' },
    });

    if (!targetUser) {
      return res.status(400).json({ error: 'Target user not found or inactive in organization' });
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

    if (desk.status === 'BOOKED') {
      return res.status(400).json({ error: 'This desk is already reserved. Please select another station.' });
    }

    // Full Day defaults to 9:00 AM - 6:00 PM (9 Hours)
    const bookingStart = startTime ? new Date(startTime) : new Date();
    const bookingEnd = endTime
      ? new Date(endTime)
      : new Date(bookingStart.getTime() + 9 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx: any) => {
      const updatedDesk = await tx.desk.update({
        where: { id: deskId },
        data: { status: 'BOOKED' },
      });

      const booking = await tx.booking.create({
        data: {
          organizationId: orgId,
          deskId,
          userId: effectiveUserId,
          startTime: bookingStart,
          endTime: bookingEnd,
          status: 'CONFIRMED',
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
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          actorUserId: currentUserId,
          action: targetUserId && targetUserId !== currentUserId ? 'PROXY_BOOK_DESK' : 'EMPLOYEE_BOOK_DESK',
          entityType: 'Booking',
          entityId: booking.id,
          metadata: {
            deskCode: desk.deskCode,
            deskId,
            bookedForUserId: effectiveUserId,
            bookedForName: targetUser.name,
            bookedByUserId: currentUserId,
            sectionName: desk.section.name,
            floorCode: desk.section.floor.code,
            startTime: bookingStart,
            endTime: bookingEnd,
          },
        },
      });

      return { desk: updatedDesk, booking };
    });

    return res.status(201).json(result);
  } catch (error: any) {
    console.error('Failed to reserve desk:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/employee/bulk-bookings
 * Atomically reserve multiple desks simultaneously (e.g. for team pods or multi-desk bookings)
 */
router.post('/bulk-bookings', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const currentUserId = req.user!.id;
    const { deskIds, targetUserId, startTime, endTime } = req.body;

    if (!Array.isArray(deskIds) || deskIds.length === 0) {
      return res.status(400).json({ error: 'deskIds must be a non-empty array of desk IDs' });
    }

    const effectiveUserId = targetUserId || currentUserId;
    const targetUser = await prisma.user.findFirst({
      where: { id: effectiveUserId, organizationId: orgId, status: 'ACTIVE' },
    });

    if (!targetUser) {
      return res.status(400).json({ error: 'Target user not found or inactive' });
    }

    // Verify all desks belong to organization
    const desks = await prisma.desk.findMany({
      where: {
        id: { in: deskIds },
        organizationId: orgId,
      },
      include: {
        section: {
          include: {
            floor: true,
          },
        },
      },
    });

    if (desks.length !== deskIds.length) {
      return res.status(400).json({ error: 'One or more selected desks do not exist' });
    }

    // Check if any desk is already booked
    const alreadyBooked = desks.filter((d: any) => d.status === 'BOOKED');
    if (alreadyBooked.length > 0) {
      return res.status(400).json({
        error: `The following desks are already reserved: ${alreadyBooked.map((d: any) => d.deskCode).join(', ')}`,
      });
    }

    const bookingStart = startTime ? new Date(startTime) : new Date();
    const bookingEnd = endTime
      ? new Date(endTime)
      : new Date(bookingStart.getTime() + 9 * 60 * 60 * 1000);

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Mark all desks as BOOKED
      await tx.desk.updateMany({
        where: { id: { in: deskIds } },
        data: { status: 'BOOKED' },
      });

      // 2. Create bookings for each desk
      const createdBookings: any[] = [];
      for (const desk of desks) {
        const bk = await tx.booking.create({
          data: {
            organizationId: orgId,
            deskId: desk.id,
            userId: effectiveUserId,
            startTime: bookingStart,
            endTime: bookingEnd,
            status: 'CONFIRMED',
          },
        });
        createdBookings.push(bk);
      }

      // 3. Log bulk audit event
      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          actorUserId: currentUserId,
          action: 'BULK_DESK_BOOKING',
          entityType: 'Booking',
          entityId: orgId,
          metadata: {
            deskCount: deskIds.length,
            deskCodes: desks.map((d: any) => d.deskCode),
            bookedForUserId: effectiveUserId,
            bookedForName: targetUser.name,
            bookedByUserId: currentUserId,
            startTime: bookingStart,
            endTime: bookingEnd,
          },
        },
      });

      return {
        count: createdBookings.length,
        bookings: createdBookings,
        desks: desks.map((d: any) => ({ ...d, status: 'BOOKED' })),
      };
    });

    return res.status(201).json({
      success: true,
      message: `Successfully booked ${result.count} workstations!`,
      data: result,
    });
  } catch (error: any) {
    console.error('Failed bulk booking:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/employee/cancel-booking
 * Cancel a single active reservation and release the desk
 */
router.post('/cancel-booking', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orgId = req.organizationId!;
    const userId = req.user!.id;
    const { bookingId, deskId } = req.body;

    if (!bookingId && !deskId) {
      return res.status(400).json({ error: 'Either bookingId or deskId is required' });
    }

    const whereBooking: any = {
      organizationId: orgId,
      status: 'CONFIRMED',
    };

    if (bookingId) {
      whereBooking.id = bookingId;
    } else if (deskId) {
      whereBooking.deskId = deskId;
    }

    const booking = await prisma.booking.findFirst({
      where: whereBooking,
      include: {
        desk: true,
      },
    });

    if (!booking) {
      return res.status(404).json({ error: 'Active booking reservation not found' });
    }

    await prisma.$transaction(async (tx: any) => {
      await tx.desk.update({
        where: { id: booking.deskId },
        data: { status: 'AVAILABLE' },
      });

      await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED' },
      });

      await tx.auditLog.create({
        data: {
          organizationId: orgId,
          actorUserId: userId,
          action: 'EMPLOYEE_CANCEL_BOOKING',
          entityType: 'Booking',
          entityId: booking.id,
          metadata: {
            deskCode: booking.desk.deskCode,
            deskId: booking.deskId,
          },
        },
      });
    });

    return res.json({
      success: true,
      message: 'Desk reservation successfully cancelled and released.',
      deskId: booking.deskId,
    });
  } catch (error: any) {
    console.error('Failed to cancel booking:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/employee/bulk-cancel
 * Cancel multiple bookings simultaneously and release all selected desks
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
      include: { desk: true },
    });

    if (targetBookings.length === 0) {
      return res.status(404).json({ error: 'No active confirmed bookings found for the selected IDs' });
    }

    const targetDeskIds = targetBookings.map((b: any) => b.deskId);
    const targetBookingIds = targetBookings.map((b: any) => b.id);

    await prisma.$transaction(async (tx: any) => {
      // 1. Mark desks as AVAILABLE
      await tx.desk.updateMany({
        where: { id: { in: targetDeskIds } },
        data: { status: 'AVAILABLE' },
      });

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
      message: `Successfully cancelled and released ${targetBookings.length} desk reservation(s).`,
      count: targetBookings.length,
      deskIds: targetDeskIds,
    });
  } catch (error: any) {
    console.error('Failed bulk cancel:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
