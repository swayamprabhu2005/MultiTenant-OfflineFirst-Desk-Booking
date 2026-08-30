## Purpose

Defines a sequential grid-coordinate allocation and drag-and-drop movement algorithm to place hot desks in sections without overlaps.

## ADDED Requirements

### Requirement: Sequential Slot Desk Allocation
The system SHALL dynamically calculate the first unoccupied slot index for new desks to prevent overlaps in the layout grid.

#### Scenario: Generate Desks on Free Slots
- **WHEN** the Admin adds or generates desks in a section where some slots are already occupied
- **THEN** the system skips occupied index slots and creates the new resources in the next sequential free slots

### Requirement: Drag and Drop Coordinate Reordering
The system SHALL support drag-and-drop hot desk sorting on grid positions, saving slot coordinates as sortOrder indices in the database.

#### Scenario: Move Desk to Empty Slot
- **WHEN** the Admin drags a desk element and drops it onto an unoccupied dashed cell
- **THEN** the desk's sortOrder is updated to the target slot index and persists to the database
