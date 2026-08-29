# Admin Portal - Org Setup Wizard Specification

## Purpose
Guides new Organization Admins through step-by-step setup (wizard) of branches, buildings, sections, and initial employee roster.

## Requirements
### Requirement: Guided Org Wizard Trigger
A new Organization Admin with no branches configured SHALL be automatically redirected to the setup wizard on login.

#### Scenario: First Login Setup Wizard
- **WHEN** the Org Admin logs in for the first time
- **THEN** they are automatically taken to Step 1: Create Branch

### Requirement: Structured Wizard Progression
The wizard SHALL enforce sequential progression through: (1) Branch, (2) Building, (3) Floor, (4) Section, (5) Desks, (6) Employees.

#### Scenario: Progress Wizard Steps
- **WHEN** the Admin completes the Section definition step
- **THEN** Step 5 (Generate Cubicles) becomes active and available
