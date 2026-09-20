# Functional Specifications: Employee Floor Plan & Booking Engine

## Requirement: Atomic Workstation Reservation
The system SHALL prevent overlapping reservations for the same desk and time-slot window.

#### Scenario: Slot Collision Check
- **WHEN** an employee attempts to book a desk already confirmed for that slot
- **THEN** the system returns 409 Conflict with an explicit collision error.

## Requirement: Proxy Booking for Colleague
The system SHALL allow employees to book desks on behalf of branch colleagues.

#### Scenario: Proxy Reservation
- **WHEN** `colleagueUserId` is supplied in the booking request
- **THEN** the booking records the colleague as `userId` and the caller as `bookedByUserId`.
