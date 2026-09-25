# Technical Design: Offline Outbox, Sync Protocol & Presence Tracking

## 1. IndexedDB Offline Architecture (`offlineStore.ts`)
- Database: `desk_booking_offline_db` (version 2)
- Stores:
  - `outbox`: `{ id, action, endpoint, payload, timestamp, status }`
  - `floorplan_cache`: `{ key, data, cachedAt }`
  - `my_bookings_cache`: `{ key, bookings, cachedAt }`
- Interception hooks: `enqueueOutboxItem()`, `isAppOnline()`, `flushPendingOutbox()`.

## 2. Background Sync Engine
- Binds to `window.addEventListener('online', flushPendingOutbox)`.
- Replays mutations sequentially: `CREATE_BOOKING`, `CANCEL_BOOKING`, `BULK_BOOKING`.
- Emits custom events: `offline-outbox-updated`, `offline-sync-completed`.

## 3. Presence & Notification Endpoints
- `GET /api/employee/office-presence`: Aggregates active bookings for today in the user's branch.
- `GET /api/notifications`: Retrieves user-scoped activity stream with read status tracking.
