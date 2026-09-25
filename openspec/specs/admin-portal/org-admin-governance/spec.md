# Admin Portal - Organization Admin Governance Specification

## Purpose
Enforces read-only governance for Global Organization Administrators across physical floor plans, restricting booking actions and providing a dedicated inspector modal.

## Requirements
### Requirement: Read-Only CAD Canvas Governance
Global Organization Admins SHALL view floor plans across all branches without modification or booking authority.

#### Scenario: Org Admin Viewing Floor Plan
- **GIVEN** an authenticated user with role `ORGANIZATION_ADMIN`
- **WHEN** navigating to floor plans
- **THEN** workstation creation (+ Add Cubicle), floor plan export/import, mass booking mode, and booking action buttons are stripped from the UI.

### Requirement: View-Only Workstation Inspector with Backdrop Dismissal
Clicking a workstation as Org Admin SHALL open a read-only inspector without booking forms that dismisses on backdrop click.

#### Scenario: Inspecting Workstation
- **WHEN** the Org Admin clicks a cubicle
- **THEN** a read-only inspector modal renders showing desk code, pod location, HDMI status, and active reservation details without booking inputs.
- **AND** clicking the backdrop overlay immediately dismisses the modal.
