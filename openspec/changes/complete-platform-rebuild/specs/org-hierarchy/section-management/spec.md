## Purpose

Manages the Section entity to subdivide floors into visual grids and automatically generate numbered cubicles and boardrooms.

## ADDED Requirements

### Requirement: Section-Based Grid Config
The system SHALL support configuring a Section under a Floor with a specific name, unique code, and column width (columns count).

#### Scenario: Create Section
- **WHEN** the Organization Admin creates a section with code "FS" and columns = 4
- **THEN** the section is saved in the database under that floor

### Requirement: Automatic Cubicle Generation
The system SHALL support generating N cubicles under a section automatically using the section code as a prefix.

#### Scenario: Generate Desks
- **WHEN** the Admin requests generation of 12 desks for section "FS"
- **THEN** 12 Resource records are created with codes "FS-01" through "FS-12"

### Requirement: Boardroom Grid Span
A Resource of type "BOARD_ROOM" SHALL support custom column spanning in the visual layout grid.

#### Scenario: Boardroom Span
- **WHEN** a boardroom is created under a section
- **THEN** it is saved with a default columnSpan = 2 (or custom value)
