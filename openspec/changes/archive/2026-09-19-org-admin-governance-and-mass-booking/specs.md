# Functional Specifications: Governance & Mass Booking Modal

## Requirement: Global Org Admin Read-Only Governance
Global Organization Administrators SHALL NOT be able to book desks or alter physical floor plans.

#### Scenario: Global Org Admin Floor Plan Inspection
- **GIVEN** a user with role `ORGANIZATION_ADMIN`
- **WHEN** inspecting any branch floor plan
- **THEN** the UI is view-only, editing actions are stripped, and clicking a desk opens a read-only inspector.

## Requirement: Strict 7-Day Sliding Matrix Window
Schedule matrices SHALL render strictly 7 consecutive days with week navigation.

#### Scenario: Week Navigation
- **WHEN** clicking the `>` arrow
- **THEN** the matrix shifts to the next 7 calendar days.

## Requirement: Mass Booking Multi-Desk Conflict Detection
If ANY selected cubicle is booked on a date, the date SHALL be marked as a Red conflict and disabled.

#### Scenario: Batch Collision
- **WHEN** viewing dates in the Mass Booking modal for 4 selected cubicles
- **THEN** any date where 1 or more cubicles are already reserved renders as `✕ Conflict` and prevents reservation.
