# Employee Booking - Session Types Specification

## Purpose
Provides employees with session-type booking options (Full Day, Morning, Afternoon) and defines overlap conflict rules.

## Requirements
### Requirement: Session Type Options
The system SHALL support three SessionType values: FULL_DAY, FIRST_HALF, and SECOND_HALF.

#### Scenario: Select Morning Slot
- **WHEN** the employee books a desk selecting FIRST_HALF
- **THEN** the booking is created for the morning slot (9:00 AM - 1:00 PM)

### Requirement: Overlap Conflict Rules
The system SHALL allow booking the same resource for FIRST_HALF and SECOND_HALF on the same day, while blocking overlapping combinations.

#### Scenario: Co-existing Half Day Bookings
- **WHEN** Desk 1 is booked for FIRST_HALF by User 1, and User 2 tries to book Desk 1 for SECOND_HALF on the same day
- **THEN** both bookings are permitted and confirmed successfully

#### Scenario: Full Day Overlap Conflict
- **WHEN** Desk 1 is booked for FIRST_HALF by User 1, and User 2 tries to book Desk 1 for FULL_DAY on the same day
- **THEN** the system rejects User 2's request with a booking conflict error
