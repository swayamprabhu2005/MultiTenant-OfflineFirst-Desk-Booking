## MODIFIED Requirements

### Requirement: Default Branch Mapping
Upon logging in, an employee SHALL be auto-directed to their assigned branch/building view, and the visual floor grid they view for bookings SHALL remain strictly read-only.

#### Scenario: Auto Navigate to Branch
- **WHEN** the employee logs in
- **THEN** the UI displays the floor plan navigation scoped to their baseBranchId and baseBuildingId

#### Scenario: Read-Only Grid View for Employees
- **WHEN** the employee views a floor plan section grid to book a hot desk
- **THEN** they cannot drag, move, or reorder any of the resource cards
