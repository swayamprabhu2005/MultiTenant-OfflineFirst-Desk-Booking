import { Router, Response } from 'express';
import { prisma } from '../prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { BookingStatus, BookingSource, SyncOperationStatus } from '@deskbooking/shared';

const router = Router();

router.post('/operations', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { operations } = req.body;

    if (!Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({ error: 'Array of operations is required' });
    }

    const results = [];
    const orgId = req.organizationId!;
    const currentUserId = req.user!.id;

    for (const op of operations) {
      const { operationId, operationType, payload, requestHash } = op;

      if (!operationId || !operationType) {
        results.push({
          operationId: operationId || 'unknown',
          status: SyncOperationStatus.FAILED,
          error: 'Missing operationId or operationType',
        });
        continue;
      }

      // Check if sync operation was already processed (Idempotency)
      const existingOp = await prisma.syncOperation.findUnique({
        where: { operationId },
      });

      if (existingOp && existingOp.status === SyncOperationStatus.SUCCESS) {
        const existingBooking = await prisma.booking.findUnique({
          where: { operationId },
          include: { resource: true },
        });
        results.push({
          operationId,
          status: SyncOperationStatus.SUCCESS,
          booking: existingBooking,
        });
        continue;
      }

      // Record SyncOperation in DB as PENDING
      await prisma.syncOperation.upsert({
        where: { operationId },
        update: { status: SyncOperationStatus.PENDING as any },
        create: {
          organizationId: orgId,
          userId: currentUserId,
          operationId,
          operationType,
          requestHash: requestHash || 'hash',
          status: SyncOperationStatus.PENDING as any,
        },
      });

      if (operationType === 'CREATE_BOOKING') {
        const { resourceId, targetUserId, startAt, endAt } = payload;
        const effectiveUserId = targetUserId || currentUserId;
        const parsedStart = new Date(startAt);
        const parsedEnd = new Date(endAt);

        try {
          const booking = await prisma.$transaction(async (tx: any) => {
            const user = await tx.user.findUnique({ where: { id: effectiveUserId } });
            const resource = await tx.resource.findUnique({
              where: { id: resourceId },
              include: { floor: true },
            });

            if (!resource || !user) {
              throw new Error('Resource or user not found');
            }

            if (user.baseBuildingId && user.baseBuildingId !== resource.floor.buildingId) {
              throw new Error('BASE_OFFICE_MISMATCH: Resource is outside assigned base office');
            }

            const dayStart = new Date(parsedStart);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(parsedStart);
            dayEnd.setHours(23, 59, 59, 999);

            const existingDaily = await tx.booking.findFirst({
              where: {
                userId: effectiveUserId,
                status: BookingStatus.CONFIRMED as any,
                startAt: { gte: dayStart, lte: dayEnd },
                operationId: { not: operationId },
              },
            });

            if (existingDaily) {
              throw new Error('DAILY_QUOTA_EXCEEDED: Employee already holds a booking for this day');
            }

            const overlap = await tx.booking.findMany({
              where: {
                resourceId,
                status: BookingStatus.CONFIRMED as any,
                startAt: { lt: parsedEnd },
                endAt: { gt: parsedStart },
                operationId: { not: operationId },
              },
            });

            if (overlap.length > 0) {
              throw new Error('SLOT_CONFLICT: Space already reserved by another user during offline window');
            }

            return await tx.booking.create({
              data: {
                organizationId: orgId,
                resourceId,
                userId: effectiveUserId,
                createdById: currentUserId,
                startAt: parsedStart,
                endAt: parsedEnd,
                status: BookingStatus.CONFIRMED as any,
                source: BookingSource.OFFLINE as any,
                operationId,
              },
              include: { resource: true },
            });
          });

          await prisma.syncOperation.update({
            where: { operationId },
            data: { status: SyncOperationStatus.SUCCESS as any, responseData: booking as any },
          });

          results.push({
            operationId,
            status: SyncOperationStatus.SUCCESS,
            booking,
          });
        } catch (err: any) {
          const isConflict = err.message?.includes('SLOT_CONFLICT') || err.message?.includes('DAILY_QUOTA');
          const finalStatus = isConflict ? SyncOperationStatus.REJECTED : SyncOperationStatus.FAILED;

          await prisma.syncOperation.update({
            where: { operationId },
            data: { status: finalStatus as any, responseData: { error: err.message } },
          });

          results.push({
            operationId,
            status: finalStatus,
            error: err.message || 'Booking conflict or validation failure',
          });
        }
      } else if (operationType === 'CANCEL_BOOKING') {
        const { bookingId } = payload;
        try {
          const updated = await prisma.booking.update({
            where: { id: bookingId },
            data: { status: BookingStatus.CANCELLED as any, cancelledAt: new Date() },
          });

          await prisma.syncOperation.update({
            where: { operationId },
            data: { status: SyncOperationStatus.SUCCESS as any, responseData: updated as any },
          });

          results.push({
            operationId,
            status: SyncOperationStatus.SUCCESS,
            booking: updated,
          });
        } catch (err: any) {
          results.push({
            operationId,
            status: SyncOperationStatus.FAILED,
            error: err.message,
          });
        }
      }
    }

    return res.json({ results });
  } catch (error: any) {
    console.error('Sync error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// GET Sync Operations log for user/admin
router.get('/history', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ops = await prisma.syncOperation.findMany({
      where: {
        organizationId: req.organizationId!,
        ...(req.user?.role === 'EMPLOYEE' ? { userId: req.user.id } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json(ops);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
