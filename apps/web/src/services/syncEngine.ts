import { db, OutboxItem } from '../db/indexedDB';
import { fetchApi } from './api';

export interface SyncEngineStatus {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingCount: number;
  lastError: string | null;
}

class SyncEngine {
  private isSyncing = false;

  constructor() {
    // Register online event listener for auto background sync
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🌐 Network restored! Auto-flushing offline outbox...');
        this.flushOutbox();
      });
    }
  }

  // Add booking operation to local Dexie Outbox & Local Bookings
  async queueBookingOperation(operation: {
    operationId: string;
    resourceId: string;
    resourceName: string;
    buildingName: string;
    floorName: string;
    targetUserId: string;
    targetUserName: string;
    createdById: string;
    startAt: string;
    endAt: string;
    organizationId: string;
  }): Promise<void> {
    const { operationId, resourceId, resourceName, buildingName, floorName, targetUserId, targetUserName, createdById, startAt, endAt, organizationId } = operation;

    const createdAt = new Date().toISOString();

    // 1. Save local booking representation immediately as PENDING
    await db.localBookings.put({
      id: operationId,
      organizationId,
      resourceId,
      resourceName,
      buildingName,
      floorName,
      userId: targetUserId,
      userName: targetUserName,
      createdById,
      startAt,
      endAt,
      status: 'PENDING',
      source: 'OFFLINE',
      operationId,
      createdAt,
    });

    // 2. Add to outbox queue
    const outboxItem: OutboxItem = {
      operationId,
      operationType: 'CREATE_BOOKING',
      payload: {
        resourceId,
        targetUserId,
        startAt,
        endAt,
      },
      requestHash: `${resourceId}-${startAt}-${endAt}`,
      createdAt,
      status: 'PENDING',
      retryCount: 0,
    };

    await db.outbox.put(outboxItem);

    // 3. Attempt immediate sync if online
    if (navigator.onLine) {
      this.flushOutbox();
    }
  }

  // Queue booking cancellation operation
  async queueCancelOperation(bookingId: string, operationId: string, organizationId: string): Promise<void> {
    const createdAt = new Date().toISOString();

    // Update local booking status to CANCELLED locally first
    const local = await db.localBookings.get(bookingId);
    if (local) {
      await db.localBookings.update(bookingId, { status: 'CANCELLED' });
    }

    const outboxItem: OutboxItem = {
      operationId,
      operationType: 'CANCEL_BOOKING',
      payload: { bookingId },
      requestHash: `CANCEL-${bookingId}`,
      createdAt,
      status: 'PENDING',
      retryCount: 0,
    };

    await db.outbox.put(outboxItem);

    if (navigator.onLine) {
      this.flushOutbox();
    }
  }

  // Flush Outbox Queue to Backend API
  async flushOutbox(): Promise<{ success: number; conflicts: number; failed: number }> {
    if (this.isSyncing) return { success: 0, conflicts: 0, failed: 0 };
    if (!navigator.onLine) return { success: 0, conflicts: 0, failed: 0 };

    this.isSyncing = true;
    let successCount = 0;
    let conflictCount = 0;
    let failedCount = 0;

    try {
      const pendingOps = await db.outbox.where('status').equals('PENDING').toArray();

      if (pendingOps.length === 0) {
        this.isSyncing = false;
        return { success: 0, conflicts: 0, failed: 0 };
      }

      console.log(`🚀 Processing ${pendingOps.length} offline operations...`);

      const payload = {
        operations: pendingOps.map(op => ({
          operationId: op.operationId,
          operationType: op.operationType,
          payload: op.payload,
          requestHash: op.requestHash,
          createdAt: op.createdAt,
        })),
      };

      const response = await fetchApi<{ results: any[] }>('/sync/operations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (response && Array.isArray(response.results)) {
        for (const res of response.results) {
          const { operationId, status, booking, error } = res;

          if (status === 'SUCCESS') {
            successCount++;
            // Update outbox
            await db.outbox.update(operationId, { status: 'SUCCESS' });
            // Update local booking
            if (booking) {
              await db.localBookings.put({
                id: booking.id,
                organizationId: booking.organizationId,
                resourceId: booking.resourceId,
                resourceName: booking.resource?.name || 'Reserved Space',
                buildingName: booking.resource?.floor?.building?.name || 'Office',
                userId: booking.userId,
                userName: booking.user?.name,
                createdById: booking.createdById,
                startAt: booking.startAt,
                endAt: booking.endAt,
                status: 'CONFIRMED',
                source: booking.source,
                operationId: booking.operationId,
                createdAt: booking.createdAt,
              });
            }
          } else if (status === 'REJECTED' || status === 'CONFLICT') {
            conflictCount++;
            await db.outbox.update(operationId, { status: 'REJECTED', lastError: error });
            // Update local booking state to CONFLICT
            const local = await db.localBookings.get(operationId);
            if (local) {
              await db.localBookings.update(operationId, {
                status: 'CONFLICT',
                syncError: error || 'Conflict: Slot was taken while offline.',
              });
            }

            // Dispatch event for UI Toast Alert
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent('booking-sync-conflict', {
                  detail: {
                    operationId,
                    message: error || 'Your offline booking request collided with another reservation. Please pick another desk.',
                  },
                })
              );
            }
          } else {
            failedCount++;
            await db.outbox.update(operationId, {
              status: 'FAILED',
              lastError: error,
              retryCount: (await db.outbox.get(operationId))?.retryCount || 1,
            });
          }
        }
      }
    } catch (err: any) {
      console.error('Outbox flush error:', err);
    } finally {
      this.isSyncing = false;
    }

    return { success: successCount, conflicts: conflictCount, failed: failedCount };
  }
}

export const syncEngine = new SyncEngine();
