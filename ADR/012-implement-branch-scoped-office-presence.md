# ADR-012: Implement Branch-Scoped Office Presence from Booking Data

## Status

Accepted

## Date

2026-09-18

## Context

Employees in hybrid work environments frequently need to know "who is in the office today" to coordinate in-person meetings, find available teammates, or locate colleagues on specific floors. The platform must:

- Show real-time office presence without requiring hardware (badge readers, RFID, IoT sensors).
- Restrict visibility to the user's assigned branch — employees and branch admins should not see presence data from other branches.
- Provide search and filtering by name, department, and desk location.

Alternatives considered:

1. **Hardware badge/RFID integration** — Requires physical infrastructure investment, API integration with access control systems, and ongoing maintenance. Not feasible for a software-only SaaS platform.
2. **GPS/location tracking** — Privacy-invasive, battery-draining on mobile devices, and inaccurate indoors.
3. **Manual check-in/check-out** — Relies on employee compliance, prone to stale data (forgot to check out).
4. **Dedicated presence table with WebSocket updates** — Adds write overhead and requires persistent connections.

## Decision

We will **infer office presence from confirmed desk bookings** for the current day:

- `GET /api/employee/presence` queries confirmed bookings for today where `startTime <= now < endTime`, scoped to the requesting user's branch via `scopedBranchId` or `baseBranchId`.
- The response includes: employee name, email, department, desk code, floor/section location, slot type, and proxy booking attribution.
- **Branch isolation**: Queries are filtered by `branchId`, ensuring employees and branch admins only see presence within their assigned branch.
- **UI**: An `OfficePresenceModal` (React Portal) renders a searchable, department-grouped colleague directory with real-time filtering and a "YOU" badge for the current user's entry.

## Consequences

- **Positive**: Zero hardware investment — presence is derived entirely from existing booking data.
- **Positive**: Branch scoping enforces organizational privacy — employees cannot see other branches' presence.
- **Positive**: Presence data is always consistent with booking state — cancellations immediately remove the user from the presence list.
- **Negative**: Presence accuracy depends on booking compliance — an employee who books a desk but works from home will appear as "in office." Mitigated by the platform's desk release feature.
- **Negative**: Only shows presence for the current day — cannot query historical or future presence without date parameter extension.
