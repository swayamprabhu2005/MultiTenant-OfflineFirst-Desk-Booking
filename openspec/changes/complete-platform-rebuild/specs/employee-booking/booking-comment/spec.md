## Purpose

Requires employees to provide a description comment when booking boardrooms or multiple desks on the same day.

## ADDED Requirements

### Requirement: Boardroom Comment Enforcement
The system SHALL require a comment describing the client or purpose when booking a BOARD_ROOM.

#### Scenario: Boardroom Missing Comment
- **WHEN** the employee tries to confirm a boardroom booking with an empty comment field
- **THEN** the system blocks the submission and requests a comment

### Requirement: Multi-Desk Comment Enforcement
An employee booking more than one cubicle under their account on the same day SHALL provide a comment explaining the reason.

#### Scenario: Multi-Desk Booking Comment
- **WHEN** the employee books a second desk for today and enters a comment
- **THEN** the second booking is accepted and saved with the comment
