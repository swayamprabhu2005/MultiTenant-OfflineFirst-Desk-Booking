# Functional Specifications: Cascading Formulas & Visual Parity

## Requirement: Excel Cascading Formula Linkage
The system SHALL inject dynamic formulas linking branch, building, floor, and section codes across workbook sheets.

#### Scenario: Building Selection
- **WHEN** selecting a building code in the Floors sheet
- **THEN** the branch code is computed automatically via formula without manual re-entry.

## Requirement: 3-Color User Contextual Status Parity
Workstations SHALL reflect the authenticated user's relationship to the reservation.

#### Scenario: Visual Parity
- **WHEN** viewing a floor plan
- **THEN** desks booked by the current user render in Indigo Blue, while desks booked by others render in Rose Red.
