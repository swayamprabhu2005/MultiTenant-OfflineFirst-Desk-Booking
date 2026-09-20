# Technical Design: Employee Floor Plan Explorer & Booking Engine

## 1. Architectural CAD Grid Engine
- Renders outer boundary walls, corridors, and 4-desk pod clusters in semantic HTML5 `<div>` containers.
- Displays workstation cards with desk code (`C-01`), external HDMI status icon, and live reservation tag.
- Central Glassmorphic Modal mounted via `createPortal` to document.body, covering the navbar.

## 2. Backend Booking Controller (`employeeBookingController.ts`)
- Atomic reservation endpoint (`POST /api/employee/bookings`) verifying double-booking constraints across overlapping time windows.
- Proxy booking lookup endpoint (`GET /api/employee/colleagues`) filtering active users in the branch.
- Multi-day booking dates array support creating transactional reservations.
- Bulk cancellation endpoint (`POST /api/employee/bulk-cancel`).
