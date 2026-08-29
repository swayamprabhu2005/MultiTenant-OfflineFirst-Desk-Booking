## Context

See `proposal.md` for motivation. The existing codebase is a pnpm monorepo with `apps/api` (Express + Prisma + PostgreSQL) and `apps/web` (React + Vite + Tailwind + Workbox PWA). It was AI-generated and has never been fully tested. Key constraints:

- **Offline-first is non-negotiable**: the service worker must be able to flush the outbox even with the browser tab closed. This eliminates HTTP-only cookie auth (service workers can't access cookies on mutation requests) and requires Bearer token in localStorage.
- **Multi-tenancy via subdomain**: every DB query is scoped by `organizationId` extracted from the authenticated JWT. This must be preserved through all schema changes.
- **No migration rollback available**: the database has no production data yet, so breaking schema changes can be applied in a single migration. However, migration ordering matters (Branch before Building FK, Section before Resource FK).

## Goals / Non-Goals

**Goals:**
- Insert `Branch` (between Organization and Building) and `Section` (between Floor and Resource) without disrupting the existing query patterns
- Replace the `window.online` sync trigger with real SW Background Sync API
- Deliver a visual floor-plan editor for admins and a visual cubicle-grid booking experience for employees
- Support recurring weekly bookings, Tech Lead bulk booking, and in-app notifications
- Keep all offline-first guarantees: Dexie outbox, idempotent sync, partial-success conflict resolution

**Non-Goals:**
- Drag-and-drop cubicle positioning (Phase 2)
- Push notifications (OS-level, not in-app)
- Email notifications
- Multi-organization membership for a single user
- Configurable advance booking window (hardcoded 30 days)
- HTTP-only cookies or session-based auth

## Decisions

### D1: Branch inserts above Building (not replacing it)

**Decision:** Add a `Branch` model with `Organization → Branch → Building` hierarchy. `Building` retains its own model.

**Alternatives:**
- Rename `Building` to `Branch` — rejected because some branches have multiple buildings; flattening conflates two distinct concepts.
- Remove Building entirely — rejected; Cipla Verna has Building A and Building B, each with separate floors.

**Rationale:** The reference use case (Cipla Verna with multiple buildings) requires both layers. Branch = geographic location. Building = physical structure at that location.

---

### D2: Section between Floor and Resource (not a tag/label)

**Decision:** `Section` is a first-class model with `floorId`, `name`, `code`, `columns` (grid width). Resources belong to a Section, not directly to a Floor.

**Alternatives:**
- Keep Floor → Resource, add a `sectionLabel` string on Resource — rejected because this prevents querying all resources in a section and computing grid layout from a single record.
- Make Section a virtual grouping (client-only) — rejected because the columns count and section code (used for auto-generating desk codes) must be server-authoritative.

**Rationale:** Grid rendering needs server-side `columns` count. Desk codes like "GN1-04" derive from the section code. Both require Section as a DB entity.

---

### D3: ORGANIZATION_ADMIN scoping via `scopedBranchId` field (not a new role)

**Decision:** A single `ORGANIZATION_ADMIN` role with an optional `scopedBranchId`. If null = Global Org Admin; if set = Branch Admin. UI labels differ; permissions differ via middleware scope check.

**Alternatives:**
- Add `BRANCH_ADMIN` to the Role enum — rejected to avoid maintaining a fourth role throughout all permission guards and the frontend role-check logic.
- Use separate tables for admin scopes — over-engineered for MVP.

**Rationale:** Scope is a runtime attribute, not a fundamental identity. The same Org Admin might later be promoted from branch-scoped to global without changing their role.

---

### D4: Tech Lead bulk booking uses `createdById ≠ userId`

**Decision:** Reintroduce `createdById` (removed with proxy booking). For Tech Lead bulk bookings: `userId = subordinate`, `createdById = Tech Lead`. For self-bookings: `createdById = userId`.

**Alternatives:**
- Remove `createdById` entirely and store bulk booking metadata in a separate `BulkBookingGroup` table — more normalized but adds a join on every booking query.
- Use a booking `comment` or `metadata` JSON field — loses referential integrity and audit trail.

**Rationale:** The Tech Lead needs an audit trail and the ability to see/cancel all bookings they created. A FK on `createdById` is the cleanest way to support `WHERE createdById = :techLeadId` queries. The distinction from the old proxy booking is that this is role-gated: only TECH_LEAD and ORGANIZATION_ADMIN may set `createdById ≠ userId`.

---

### D5: SW Background Sync API with Workbox Background Sync plugin

**Decision:** Register a background sync tag (`'outbox-sync'`) via `navigator.serviceWorker.ready.then(sw => sw.sync.register('outbox-sync'))` whenever the outbox gains a new PENDING item. The service worker handles the `sync` event and calls `syncEngine.flushOutbox()`.

**Alternatives:**
- Keep `window.addEventListener('online')` — rejected because sync doesn't fire when tab is closed.
- Use Workbox Background Sync plugin automatically on every POST — rejected because it retries at the Workbox level, bypassing the custom outbox idempotency and conflict logic.

**Rationale:** The custom outbox handles idempotency via `operationId`. The SW only needs to wake up and call `flushOutbox()` — it doesn't need to know what's in the outbox. This keeps the sync logic in one place (`syncEngine.ts`) while giving the SW the trigger authority.

**Note on browser support:** Background Sync API is not supported in Firefox and Safari. Fallback: `window.addEventListener('online')` remains as a secondary trigger for unsupported browsers (detected via `'SyncManager' in window`).

---

### D6: Workbox `NetworkFirst` scoped to GET requests only

**Decision:** Update `vite.config.ts` Workbox `runtimeCaching` to match only GET requests to `/api/*`. POST, PATCH, DELETE go through the outbox only.

**Alternatives:**
- Disable Workbox runtime caching for `/api/*` entirely — loses offline reads of buildings, floors, sections.
- Use Workbox Background Sync plugin for mutations — conflicts with custom outbox idempotency.

**Rationale:** GET requests benefit from NetworkFirst caching (stale data beats no data for offline navigation). Mutations must not be retried by Workbox because the outbox already handles retry with conflict detection.

---

### D7: Recurring bookings are online-only

**Decision:** The recurring booking dialog is only shown / submittable when `navigator.onLine` is true. Single-day bookings remain offline-capable via the outbox.

**Alternatives:**
- Allow recurring booking offline, queue all N records in outbox — rejected because partial-success conflict feedback is delayed until sync; the UX of "9 offline bookings, 4 failed" is confusing.

**Rationale:** Recurring bookings span days that may already be booked. The user benefits from immediate conflict feedback. The trade-off (must be online to create a series) is acceptable because recurring bookings are a planning activity, not a last-minute action.

---

### D8: Notification system — Dexie-backed, pull on reconnect

**Decision:** `Notification` DB table on the server. `notifications` Dexie table on client. On reconnect, client fetches all unread notifications for the current user and merges into Dexie. Bell icon shows Dexie live query count. No WebSockets or polling.

**Alternatives:**
- WebSocket push notifications — rejected; adds server complexity (socket management) and doesn't work offline anyway.
- Poll every N seconds — rejected; wasteful and adds requests.

**Rationale:** Notifications are low-urgency (booking assigned by TL, sync result). Pulling on reconnect is sufficient. The offline-first model means the user isn't always connected anyway.

---

### D9: Visual floor plan grid — CSS Grid, not Canvas

**Decision:** The cubicle grid is rendered as a CSS Grid where `grid-template-columns` is driven by the Section's `columns` value. Each cubicle is a `<div>` or button. Boardrooms use `grid-column: span <columnSpan>`.

**Alternatives:**
- HTML Canvas — more control over layout and drawing, but much harder to make accessible, interactive, and responsive.
- SVG — good for static maps, but event handling and dynamic updates are more complex than CSS Grid.

**Rationale:** CSS Grid with `columns` from the Section model gives pixel-perfect control, full accessibility (tab focus, ARIA roles), and zero additional dependencies. The fixed-column-count approach (no drag-drop) makes this the obvious choice for MVP.

---

### D10: Session-type conflict rules (FIRST_HALF + SECOND_HALF don't conflict)

**Decision:** The overlap query in `bookings.routes.ts` and `sync.routes.ts` checks session type: FULL_DAY conflicts with everything; FIRST_HALF and SECOND_HALF coexist on the same resource on the same day.

**Implementation note:** The existing Prisma overlap query checks `startAt < endAt_requested AND endAt > startAt_requested`. Replace with a session-type-aware check: FIRST_HALF ends at 13:00, SECOND_HALF starts at 13:00 — no overlap.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| **SW Background Sync API not supported in Firefox/Safari** | Fallback `window.addEventListener('online')` kept as secondary trigger. Feature-detected via `'SyncManager' in window`. |
| **Breaking migration (Branch + Section insert)** | No production data yet; single migration acceptable. Migration script order: (1) create Branch, (2) add branchId to Building, (3) create Section, (4) add sectionId to Resource, (5) drop floorId from Resource. |
| **Dexie schema version bump** | Add Branch, Section, Notification tables; update Resource and LocalBooking interfaces. Increment Dexie version number. Existing data in dev IndexedDB may need manual clear during development. |
| **FIRST_HALF/SECOND_HALF non-conflict logic** | Session-type-aware overlap check must be added to BOTH the direct booking route and the sync route to avoid inconsistency. |
| **Partial-success recurring booking UX** | Clear UI feedback required: list confirmed dates (green) vs. conflicted dates (red) after submission. Without this, users won't understand which dates were rejected. |
| **Tech Lead seeing subordinates' data** | Requires a subordinate lookup before bulk booking; must validate that each assigned employee has `teamLeadId = techLead.id`. Server-side validation is the gate; UI dropdown just filters. |

## Migration Plan

1. **Schema migration** (one Prisma migration):
   - Create `Branch` table
   - Add `branchId` (nullable first) to `Building`
   - Backfill: create one default Branch per Organization, assign all Buildings to it
   - Make `branchId` NOT NULL
   - Create `Section` table
   - Add `sectionId` (nullable first) to `Resource`
   - Backfill: create one default Section per Floor, assign all Resources to it
   - Make `sectionId` NOT NULL, drop `floorId` from `Resource`
   - Add `createdById` back to `Booking` (nullable)
   - Add `sessionType`, `comment`, `recurringGroupId` to `Booking`
   - Add `TECH_LEAD` to Role enum
   - Add `teamLeadId`, `scopedBranchId`, `mustChangePassword`, `baseBranchId` to `User`
   - Create `Notification` table

2. **IndexedDB migration**: bump Dexie version, add `branches`, `sections`, `notifications` tables, update `resources` and `localBookings` interfaces.

3. **Service worker update**: add Background Sync event handler, update Workbox config.

4. **Seed script**: create Platform Admin user (`prisma/seed.ts`).

**Rollback**: No production data; rollback = drop new tables and revert migration. Dev environments clear IndexedDB manually.
