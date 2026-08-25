import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { BookingStatus, BookingSource, Role } from '@deskbooking/shared';

const router = Router();

// Helper to check if two date ranges overlap
export const checkOverlap = (start1: Date, end1: Date, start2: Date, end2: Date): boolean => {
  return start1 < end2 && end1 > start2;
};

// GET bookings (for employee or admin)
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { userId, resourceId, startDate, endDate } = req.query;

    const where: any = {
      organizationId: req.organizationId!,
    };

    const currentUser = req.user!;

    // Non-admin users can only view their own bookings or bookings created by them (proxy)
    if (currentUser.role === Role.EMPLOYEE) {
      where.OR = [
        { userId: currentUser.id },
        { createdById: currentUser.id },
      ];
    } else if (userId) {
      where.userId = String(userId);
    }

    if (resourceId) {
      where.resourceId = String(resourceId);
    }

    if (startDate && endDate) {
      where.startAt = { gte: new Date(String(startDate)) };
      where.endAt = { lte: new Date(String(endDate)) };
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        resource: {
          include: {
            floor: {
              include: { building: true },
            },
          },
        },
        user: {
          select: { id: true, name: true, email: true, department: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { startAt: 'desc' },
    });

    return res.json(bookings);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST Create Single Booking
router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { resourceId, targetUserId, startAt, endAt, operationId, source } = req.body;
    const currentUser = req.user!;

    if (!resourceId || !startAt || !endAt) {
      return res.status(400).json({ error: 'resourceId, startAt, and endAt are required' });
    }

    const parsedStart = new Date(startAt);
    const parsedEnd = new Date(endAt);

    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime()) || parsedStart >= parsedEnd) {
      return res.status(400).json({ error: 'Invalid startAt or endAt timeframe' });
    }

    // Determine target user (Proxy booking check)
    const effectiveUserId = targetUserId || currentUser.id;
    const createdById = currentUser.id;

    // 1. Fetch resource and floor/building details
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        floor: {
          include: { building: true },
        },
      },
    });

    if (!resource || resource.floor.building.organizationId !== req.organizationId!) {
      return res.status(404).json({ error: 'Resource not found or organization mismatch' });
    }

    // 2. Base Office Restriction Check
    const targetUser = await prisma.user.findUnique({
      where: { id: effectiveUserId },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    if (targetUser.baseBuildingId && targetUser.baseBuildingId !== resource.floor.buildingId) {
      return res.status(403).json({
        error: `Base Office Restriction: User ${targetUser.name} can only book resources in their assigned building (${resource.floor.building.name} mismatch)`,
      });
    }

    // 3. Daily Quota Ceiling Check (Max 1 active booking per day per employee)
    const dayStart = new Date(parsedStart);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(parsedStart);
    dayEnd.setHours(23, 59, 59, 999);

    const existingDailyBooking = await prisma.booking.findFirst({
      where: {
        userId: effectiveUserId,
        status: BookingStatus.CONFIRMED as any,
        startAt: { gte: dayStart, lte: dayEnd },
      },
    });

    if (existingDailyBooking) {
      return res.status(422).json({
        error: 'Daily Quota Exceeded: Employee already holds an active reservation for this date (Max 1/day)',
      });
    }

    // 4. Transactional Exclusion Check (First-to-sync wins conflict resolution)
    const opId = operationId || uuidv4();

    const bookingResult = await prisma.$transaction(async (tx: any) => {
      // Check idempotency: if operationId already processed
      const existingOpBooking = await tx.booking.findUnique({
        where: { operationId: opId },
      });
      if (existingOpBooking) {
        return existingOpBooking;
      }

      // Check time range overlap for the resource
      const conflictingBookings = await tx.booking.findMany({
        where: {
          resourceId,
          status: BookingStatus.CONFIRMED as any,
          startAt: { lt: parsedEnd },
          endAt: { gt: parsedStart },
        },
      });

      if (conflictingBookings.length > 0) {
        throw new Error('SLOT_CONFLICT: The selected slot has already been booked by another user');
      }

      // Commit confirmed booking
      return await tx.booking.create({
        data: {
          organizationId: req.organizationId!,
          resourceId,
          userId: effectiveUserId,
          createdById,
          startAt: parsedStart,
          endAt: parsedEnd,
          status: BookingStatus.CONFIRMED as any,
          source: (source === 'OFFLINE' ? BookingSource.OFFLINE : BookingSource.ONLINE) as any,
          operationId: opId,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        organizationId: req.organizationId!,
        actorUserId: currentUser.id,
        action: 'CREATE_BOOKING',
        entityType: 'Booking',
        entityId: bookingResult.id,
        metadata: {
          resourceId,
          userId: effectiveUserId,
          startAt: parsedStart,
          endAt: parsedEnd,
          source,
        },
      },
    });

    return res.status(201).json(bookingResult);
  } catch (error: any) {
    if (error.message && error.message.startsWith('SLOT_CONFLICT')) {
      return res.status(409).json({
        error: 'Booking Conflict',
        message: 'The selected space and time slot was booked by another employee. Please select another slot.',
        status: BookingStatus.CONFLICT,
      });
    }
    return res.status(400).json({ error: error.message });
  }
});

// Cancel Booking
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentUser = req.user!;

    const booking = await prisma.booking.findUnique({
      where: { id },
    });

    if (!booking || booking.organizationId !== req.organizationId!) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Employees can only cancel their own or created proxy bookings unless Admin
    if (
      currentUser.role === Role.EMPLOYEE &&
      booking.userId !== currentUser.id &&
      booking.createdById !== currentUser.id
    ) {
      return res.status(403).json({ error: 'Forbidden: Cannot cancel another user booking' });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED as any,
        cancelledAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: req.organizationId!,
        actorUserId: currentUser.id,
        action: 'CANCEL_BOOKING',
        entityType: 'Booking',
        entityId: id,
      },
    });

    return res.json({ message: 'Booking successfully cancelled', booking: updated });
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
