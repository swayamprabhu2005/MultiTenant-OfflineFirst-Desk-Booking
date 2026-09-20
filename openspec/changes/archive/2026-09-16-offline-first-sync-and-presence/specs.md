# Functional Specifications: Offline Engine & Presence Tracking

## Requirement: Offline Outbox Interception
When disconnected from the network, booking creation and cancellation actions SHALL be saved locally in IndexedDB.

#### Scenario: Offline Booking Creation
- **GIVEN** `isAppOnline() === false`
- **WHEN** confirming a desk reservation
- **THEN** an outbox record is stored, a notification notice displays, and the workstation turns Amber Yellow ('Sync Pending').

## Requirement: Who's in Office Presence
The system SHALL display colleagues present in the branch today.

#### Scenario: Presence Modal
- **WHEN** clicking 'Who's in Office'
- **THEN** active colleagues for the day are shown with department and workstation identifier.
