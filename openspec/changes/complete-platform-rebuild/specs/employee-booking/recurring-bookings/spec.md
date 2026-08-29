## Purpose

Defines recurring booking lifecycle mechanics, including partial sync success and group cancellation capabilities.

## ADDED Requirements

### Requirement: Independent Occurrences and Group ID
Each occurrence in a recurring series SHALL be created as an independent database Booking record linked by a common recurringGroupId.

#### Scenario: Recurring Bookings Generation
- **WHEN** the user creates a recurring series spanning 4 dates
- **THEN** 4 Booking records are generated sharing the same recurringGroupId

### Requirement: Partial Sync Success
Syncing a recurring series SHALL confirm all non-conflicting dates and reject only the specific dates that have conflict.

#### Scenario: Sync Conflict Resolution
- **WHEN** 4 offline bookings are synced and 1 date is already taken on the server
- **THEN** 3 bookings are confirmed and the 1 conflicting booking is marked as a conflict

### Requirement: Group Cancellation
Cancelling a recurring group SHALL cancel all future occurrences in that series.

#### Scenario: Cancel Future Group
- **WHEN** the employee clicks cancel series on a recurring group
- **THEN** all future bookings with that recurringGroupId are removed, while past bookings remain intact
