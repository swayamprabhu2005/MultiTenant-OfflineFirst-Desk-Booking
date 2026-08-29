## Purpose

Provides a search and batch cancellation interface for employees and Tech Leads to manage and cancel bookings.

## ADDED Requirements

### Requirement: Checkbox Batch Selection
The My Bookings page SHALL support selecting multiple bookings via checkboxes to perform batch cancellation.

#### Scenario: Batch Cancel
- **WHEN** the employee checks 3 bookings and clicks "Cancel Selected"
- **THEN** all 3 bookings are cancelled simultaneously

### Requirement: Search Filters in My Bookings
The My Bookings page SHALL include a search bar to filter bookings by desk code, date, section name, and employee name.

#### Scenario: Search by Desk
- **WHEN** the user types "FS-32" in the search box
- **THEN** only bookings matching desk code "FS-32" are displayed

### Requirement: Cancel Confirm vs Cancel Series Modal
When cancelling a booking that belongs to a recurring series, the system SHALL prompt the user to choose between cancelling that occurrence only or all future occurrences in the series.

#### Scenario: Cancel Recurring Selection
- **WHEN** the user clicks cancel on a recurring desk booking
- **THEN** a modal appears offering the choice between "Cancel this date only" and "Cancel all future dates in series"
