# Employee Booking - Multi-Workstation Mass Booking Specification

## Purpose
Enables batch selection of multiple cubicles with interactive modal confirmation, chip dismissal, multi-desk conflict detection, and single-day allocation constraints.

## Requirements
### Requirement: Interactive Mass Booking Modal
Selecting multiple cubicles and clicking 'Proceed to Book' SHALL open an interactive configuration modal via React Portal.

#### Scenario: Mass Booking Modal Launch
- **GIVEN** 2 or more cubicles selected in Mass Booking Mode
- **WHEN** clicking 'Proceed to Book (N Desks)'
- **THEN** the Mass Booking Modal opens displaying removable badge chips for each desk, a 7-day multi-desk availability matrix, and session dropdown.

### Requirement: Multi-Desk Conflict Detection & Single-Day Constraint
If ANY selected workstation is booked on a date, that date SHALL be marked with a Red `✕ Conflict` badge and disabled. Mass booking SHALL restrict selection to a single date.

#### Scenario: Conflict Detection
- **WHEN** viewing the 7-day matrix in the mass booking modal
- **THEN** dates where all selected cubicles are free render in Green (`Available`), while dates with any existing booking render in Red (`✕ Conflict`).
