# Employee Booking - Visual Floor Map Specification

## Purpose
Enables employees to visually navigate their branch, choose a floor section, and pick a desk from an interactive grid showing occupancy colors.

## Requirements
### Requirement: Default Branch Mapping
Upon logging in, an employee SHALL be auto-directed to their assigned branch/building view.

#### Scenario: Auto Navigate to Branch
- **WHEN** the employee logs in
- **THEN** the UI displays the floor plan navigation scoped to their baseBranchId and baseBuildingId

### Requirement: Interactive occupancy Colors
The visual grid SHALL color-code cubicles based on booking status over the selected date range.

#### Scenario: Grid Color Code
- **WHEN** a cubicle is booked on at least one day in the range
- **THEN** it displays as red in the visual layout grid

### Requirement: Booking Info on Click
Clicking a booked (red) cubicle SHALL show a status overlay displaying which days in the range it is occupied.

#### Scenario: Click Occupied Desk
- **WHEN** the user clicks a red desk card
- **THEN** an overlay displays Mon–Sun with a cross mark on the booked days
