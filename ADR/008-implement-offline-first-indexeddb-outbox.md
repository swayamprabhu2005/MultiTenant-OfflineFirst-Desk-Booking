# ADR-008: Implement Offline-First with IndexedDB Outbox Pattern

## Status

Accepted

## Date

2026-09-18

## Context

Employees and branch administrators working in corporate offices frequently experience intermittent connectivity — Wi-Fi dead zones between floors, network maintenance windows, and crowded shared networks during peak booking hours. The platform must:

- Allow employees to browse floor plans and queue desk reservations even when offline.
- Automatically synchronize queued operations when connectivity is restored.
- Provide clear visual feedback about connectivity state and pending operations.
- Restrict offline capabilities to operational roles (Employee, Branch Admin) — Platform Admin and Organization Admin must remain strictly online for governance operations.

Alternatives considered:

1. **PouchDB + CouchDB sync** — Full bidirectional document sync protocol. Over-engineered for unidirectional booking submissions. Adds ~150KB to the client bundle and requires a CouchDB-compatible server.
2. **Dexie.js** — Popular IndexedDB wrapper but adds an unnecessary abstraction layer. The outbox pattern needs only 4 operations (enqueue, peek, update status, remove).
3. **Service Worker with Background Sync API** — Browser support is inconsistent (not available in Firefox/Safari). The Background Sync API may delay sync until the browser deems conditions favorable, which is unacceptable for time-sensitive desk bookings.
4. **LocalStorage** — Synchronous API that blocks the main thread. 5MB quota limit is insufficient for cached floor plan hierarchies with hundreds of desks.

## Decision

We will implement a **custom IndexedDB outbox + cache pattern** (~290 lines) in `apps/web/src/services/offlineStore.ts`:

### Outbox Queue (`outbox_queue` object store)
- Each offline operation is enqueued with: `id`, `method` (POST/PUT/DELETE), `url`, `body`, `status` (PENDING → SYNCING → SYNCED/FAILED), `createdAt`, `retryCount`.
- On reconnection, `syncOutboxQueue()` replays pending items in FIFO order via standard HTTP POST to the API.
- Failed items are marked `FAILED` with incremented `retryCount` for manual retry.

### Floor Plan Cache (`floorplan_cache` object store)
- Complete workspace hierarchies are cached by `cacheKey` (branch-specific) after successful API loads.
- When offline, `getCachedFloorPlanData()` serves the last-known floor plan state, enabling desk browsing.

### Reactive Notifications
- Custom browser events (`offline-outbox-updated`, `offline-sync-completed`) decouple the store from React components without a global state management library.

### Role Gating
- `NetworkStatusIndicator` renders only for `EMPLOYEE` and `BRANCH_ADMIN` roles. Platform/Org admins see no offline UI.

## Consequences

- **Positive**: Zero external dependencies — native IndexedDB API keeps the client bundle lean (~3KB gzipped for the entire offline module).
- **Positive**: Employees can queue multiple desk bookings while offline and see them auto-sync when they walk back to a connected area.
- **Positive**: Floor plan cache provides instant rendering on repeat visits, reducing API calls by ~60% for returning users.
- **Negative**: Offline bookings are optimistic — a desk may be taken by another user while the first user is offline. Conflict is detected during sync and surfaced as a FAILED outbox item.
- **Negative**: In-memory state is not persisted across browser restarts for the `NetworkStatusIndicator` syncing state. The outbox itself persists in IndexedDB.
