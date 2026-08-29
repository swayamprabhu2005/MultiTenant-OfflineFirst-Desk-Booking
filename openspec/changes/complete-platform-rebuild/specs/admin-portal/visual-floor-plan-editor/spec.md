## Purpose

Provides Organization Admins with a visual interface to design floor plan grids and configure desks/boardrooms online.

## ADDED Requirements

### Requirement: visual Grid Layout Setup
The system SHALL render section resources in a structured grid layout driven by the Section's columns count.

#### Scenario: Visual Grid Render
- **WHEN** the Admin views a section with columns = 4 and 8 desks
- **THEN** the desks are displayed in a 4-column wide grid wrapping to 2 rows

### Requirement: Resource Equipment Marking
The Admin SHALL be able to mark individual cubicles as possessing a PC, displaying an HDMI symbol.

#### Scenario: Mark HDMI
- **WHEN** the Admin toggles the hasPC option on a cubicle to true
- **THEN** the cubicle card renders the HDMI symbol in the visual view

### Requirement: Online Only Admin Editor
The visual floor plan editor features and API endpoints SHALL only be accessible when the administrator is online.

#### Scenario: Offline Visual Access Block
- **WHEN** the Admin is offline
- **THEN** the visual map editing features are disabled
