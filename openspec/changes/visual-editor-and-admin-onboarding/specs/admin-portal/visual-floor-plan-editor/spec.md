## MODIFIED Requirements

### Requirement: visual Grid Layout Setup
The system SHALL render section resources in a structured grid layout driven by the Section's columns count, grouped under a visual collapsible tree hierarchy linking branches, buildings, floors, and sections.

#### Scenario: Visual Grid Render
- **WHEN** the Admin views a section with columns = 4 and 8 desks
- **THEN** the desks are displayed in a 4-column wide grid wrapping to 2 rows

#### Scenario: Visual Hierarchical Linked Selection
- **WHEN** the Admin expands a branch in the visual navigation tree
- **THEN** they see its child buildings, floors, and sections grouped in nested layers
