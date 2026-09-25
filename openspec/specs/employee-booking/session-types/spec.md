# Employee Booking - Session Types Specification

## Purpose
Defines time-slot windows for workstation reservations, supporting flexible hybrid working patterns.

## Requirements
### Requirement: Configurable Session Windows
The system SHALL support three distinct booking session types:
1. `FULL_DAY`: Standard business day (9:00 AM – 6:00 PM)
2. `MORNING`: First half day (9:00 AM – 1:30 PM)
3. `AFTERNOON`: Second half day (1:30 PM – 6:00 PM)

#### Scenario: Slot Reservation
- **WHEN** an employee reserves a desk with `slotType: 'MORNING'`
- **THEN** the booking records the corresponding start and end timestamps and prevents overlapping reservations for that specific window.
