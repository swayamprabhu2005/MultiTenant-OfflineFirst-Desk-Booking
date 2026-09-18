# ADR-011: Derive Notifications from Domain Events Without Dedicated Storage

## Status

Accepted

## Date

2026-09-18

## Context

The platform needs a notification system to surface recent activity (bookings, cancellations, admin actions) to users. Traditional notification architectures use a dedicated `Notification` table where each event writes a corresponding notification record. This creates:

- **Write amplification**: Every booking creates an additional INSERT into the notifications table.
- **Data synchronization risk**: Notification records can become stale or inconsistent with the source booking/audit data.
- **Storage overhead**: Notification tables grow linearly with activity volume and require periodic purge jobs.

The platform already maintains two authoritative event sources:
1. `Booking` table — all reservation lifecycle events (confirmed, cancelled, released).
2. `AuditLog` table — all administrative actions (cubicle additions, roster imports, floor plan uploads).

## Decision

We will use an **event-derived projection model** where notifications are dynamically computed from existing domain tables:

- `GET /api/notifications` queries `Booking` and `AuditLog` tables, filters by `organizationId`, and projects results into a unified notification stream sorted by `createdAt` descending.
- **Read/clear state** is tracked via in-memory JavaScript `Map` objects (`userLastReadMap`, `userClearedBeforeMap`), keyed by user ID.
- **Role-tailored feeds**: Employees see personal bookings and proxy reservations; Branch Admins additionally see facility management alerts.
- **Polling interval**: Frontend polls every 25 seconds — sufficient for desk booking activity cadence.

## Consequences

- **Positive**: Zero write amplification — no additional database writes when bookings or audit events occur.
- **Positive**: 100% data consistency guaranteed — notifications always reflect the current state of bookings and audit logs.
- **Positive**: No table purge maintenance — notification "history" is naturally bounded by booking and audit log retention.
- **Negative**: Read/clear state is in-memory and resets on server restart. Acceptable for non-critical read markers; users simply see all recent activity again after restart.
- **Negative**: Notification queries join across `Booking` and `AuditLog` tables on every poll. Mitigated by composite indexes on `[organizationId, createdAt]`.
- **Negative**: Cannot support push notifications (email, mobile push) without an additional event dispatch layer. This is acceptable for the current web-only scope.
