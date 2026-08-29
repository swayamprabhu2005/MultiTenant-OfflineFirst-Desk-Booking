import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { db } from './db/indexedDB';

declare const self: ServiceWorkerGlobalScope;

// 1. Precache static assets compiled by Vite
precacheAndRoute(self.__WB_MANIFEST || []);

// 2. Cache external Unsplash images
registerRoute(
  ({ url }) => url.host === 'images.unsplash.com',
  new CacheFirst({
    cacheName: 'external-images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// 3. Cache API GET requests with NetworkFirst strategy (Task 1.7: Excludes POST, PATCH, DELETE mutations)
registerRoute(
  ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
  new NetworkFirst({
    cacheName: 'api-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 24 Hours
      }),
    ],
  })
);

// 4. Service Worker Background Sync Event Listener (Task 1.6)
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'outbox-sync') {
    console.log('[SW] ⚡ Background Sync triggered for tag "outbox-sync"');
    event.waitUntil(flushOutboxViaSW());
  }
});

// Flush local Dexie outbox queue via fetch requests using auth token from db.cachedUser
async function flushOutboxViaSW(): Promise<void> {
  try {
    // 1. Fetch pending outbox operations
    const pendingOps = await db.outbox.where('status').equals('PENDING').toArray();
    if (pendingOps.length === 0) {
      console.log('[SW] Outbox is empty, sync skipped.');
      return;
    }

    // 2. Fetch cached user credentials to retrieve auth token
    const cachedUsers = await db.cachedUser.toArray();
    if (cachedUsers.length === 0 || !cachedUsers[0].token) {
      console.warn('[SW] No valid auth token found in IndexedDB. Cannot sync.');
      return;
    }
    const token = cachedUsers[0].token;

    console.log(`[SW] Syncing ${pendingOps.length} offline operations...`);

    const payload = {
      operations: pendingOps.map(op => ({
        operationId: op.operationId,
        operationType: op.operationType,
        payload: op.payload,
        requestHash: op.requestHash,
        createdAt: op.createdAt,
      })),
    };

    // Perform sync fetch
    const response = await fetch('/api/sync/operations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Sync server responded with status: ${response.status}`);
    }

    const data = await response.json();
    if (data && Array.isArray(data.results)) {
      for (const res of data.results) {
        const { operationId, status, booking, error } = res;

        if (status === 'SUCCESS') {
          // Update local outbox item status
          await db.outbox.update(operationId, { status: 'SUCCESS' });

          // Update local bookings cache
          if (booking) {
            await db.localBookings.put({
              id: booking.id,
              organizationId: booking.organizationId,
              resourceId: booking.resourceId,
              resourceName: booking.resource?.name || 'Reserved Space',
              buildingName: booking.resource?.section?.floor?.building?.name || 'Office',
              floorName: booking.resource?.section?.floor?.name || 'Floor', // Resolves floorName sync bug
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

          // Trigger BOOKING_CONFIRMED notification
          if (booking) {
            await db.notifications.put({
              id: crypto.randomUUID(),
              userId: booking.userId,
              type: 'BOOKING_CONFIRMED',
              message: `Sync success: Desk ${booking.resource?.code || 'reserved'} confirmed for ${new Date(booking.startAt).toLocaleDateString()}`,
              bookingId: booking.id,
              isRead: false,
              createdAt: new Date().toISOString(),
            });
          }
        } else if (status === 'REJECTED' || status === 'CONFLICT') {
          await db.outbox.update(operationId, { status: 'REJECTED', lastError: error });
          
          await db.localBookings.update(operationId, {
            status: 'CONFLICT',
            syncError: error || 'Conflict: Slot taken while offline.',
          });

          // Trigger BOOKING_CONFLICT notification
          const local = await db.localBookings.get(operationId);
          if (local) {
            await db.notifications.put({
              id: crypto.randomUUID(),
              userId: local.userId,
              type: 'BOOKING_CONFLICT',
              message: `Sync conflict: Desk booking on ${new Date(local.startAt).toLocaleDateString()} failed due to conflict.`,
              bookingId: null,
              isRead: false,
              createdAt: new Date().toISOString(),
            });
          }
        } else {
          await db.outbox.update(operationId, {
            status: 'FAILED',
            lastError: error,
            retryCount: (await db.outbox.get(operationId))?.retryCount || 1,
          });
        }
      }
    }
  } catch (err) {
    console.error('[SW] Sync error:', err);
  }
}
