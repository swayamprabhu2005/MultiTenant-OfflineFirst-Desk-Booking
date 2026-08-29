## Purpose

Displays a building-scoped live presence list and headcount showing who has confirmed bookings for today.

## ADDED Requirements

### Requirement: Building Scoped Occupancy List
Employees SHALL only see occupancy data and colleague desk numbers for the building they are currently assigned to.

#### Scenario: View Occupancy List
- **WHEN** the employee views the "Who's in office today" dashboard widget
- **THEN** the widget lists the names, desk codes, and sections of all colleagues booked in their building today

### Requirement: Confirmed Booking Filter
The presence list and headcount SHALL only include bookings with a confirmed status.

#### Scenario: Filter Confirmed Bookings
- **WHEN** Desk 1 has a confirmed booking and Desk 2 has a pending offline booking
- **THEN** only the user of Desk 1 appears on the "Who's in office" list
