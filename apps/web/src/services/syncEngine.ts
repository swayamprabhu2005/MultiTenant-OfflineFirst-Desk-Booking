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
    // Register online event listener for auto background sync (fallback)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🌐 Network restored! Fallback outbox flush...');
        this.requestSync();
      });
    }
  }

  async requestSync(): Promise<void> {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register('outbox-sync');
        console.log('[SyncEngine] SW Background Sync registered.');
      } catch (err) {
        console.warn('[SyncEngine] SW Sync registration failed. Fallback to direct flush.', err);
        if (navigator.onLine) {
          this.flushOutbox();
        }
      }
    } else {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        this.flushOutbox();
      }
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

    // 3. Attempt sync or register sync manager tag
    await this.requestSync();
  }

  // Queue booking cancellation operation
  async queueCancelOperation(bookingId: string, operationId: string, organizationId: string, cancelSeries?: boolean): Promise<void> {
    const createdAt = new Date().toISOString();

    // Update local booking status to CANCELLED locally first
    const local = await db.localBookings.get(bookingId);
    if (local) {
      if (cancelSeries && local.recurringGroupId) {
        const futureBookings = await db.localBookings
          .where('recurringGroupId')
          .equals(local.recurringGroupId)
          .toArray();
        for (const fb of futureBookings) {
          if (new Date(fb.startAt) >= new Date(local.startAt)) {
            await db.localBookings.update(fb.id, { status: 'CANCELLED' });
          }
        }
      } else {
        await db.localBookings.update(bookingId, { status: 'CANCELLED' });
      }
    }

    const outboxItem: OutboxItem = {
      operationId,
      operationType: 'CANCEL_BOOKING',
      payload: { bookingId, cancelSeries: !!cancelSeries },
      requestHash: `CANCEL-${bookingId}-${cancelSeries ? 'series' : 'single'}`,
      createdAt,
      status: 'PENDING',
      retryCount: 0,
    };

    await db.outbox.put(outboxItem);

    await this.requestSync();
  }

  // Queue Profile Update operation (Task 4.6)
  async queueProfileUpdateOperation(baseBranchId: string, baseBuildingId?: string): Promise<void> {
    const createdAt = new Date().toISOString();
    const operationId = `PROFILE-UPDATE-${Date.now()}`;

    // Update local cached user profile immediately
    const cached = await db.cachedUser.toArray();
    if (cached.length > 0) {
      await db.cachedUser.update(cached[0].id, {
        baseBranchId,
        ...(baseBuildingId ? { baseBuildingId } : {}),
      });
    }

    const outboxItem: OutboxItem = {
      operationId,
      operationType: 'UPDATE_PROFILE',
      payload: { baseBranchId, baseBuildingId },
      requestHash: `PROFILE-UPDATE-${baseBranchId}`,
      createdAt,
      status: 'PENDING',
      retryCount: 0,
    };

    await db.outbox.put(outboxItem);
    await this.requestSync();
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
            if (res.user) {
              const cached = await db.cachedUser.toArray();
              if (cached.length > 0) {
                await db.cachedUser.update(cached[0].id, res.user);
              }
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
