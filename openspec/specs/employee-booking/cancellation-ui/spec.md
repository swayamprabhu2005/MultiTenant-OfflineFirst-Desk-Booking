# Employee Booking - Cancellation UI Specification

## Purpose
Governs the My Bookings history interface, individual cancellation, multi-select cancellation (`Cancel Selected`), and bulk cancellation of future reservations.

## Requirements
### Requirement: Multi-Select & Bulk Cancellation
Employees SHALL be able to cancel individual bookings, selected multi-bookings, or all future confirmed reservations in one action.

#### Scenario: Bulk Cancel Future Bookings
- **WHEN** clicking 'Cancel All Upcoming' and confirming
- **THEN** all future confirmed bookings for the employee are marked `CANCELLED` atomically with instant UI update.
