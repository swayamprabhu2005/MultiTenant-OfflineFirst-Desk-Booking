# Admin Portal - Visual Floor Plan Customization Specification

## Purpose
Empowers Branch Administrators to customize their branch floor plan, add workstations in-UI with automatic pod recalculation, assign executive desks, and release reservations.

## Requirements
### Requirement: In-UI Cubicle Addition & Pod Recalculation
The system SHALL allow Branch Admins to add workstations directly and dynamically rebalance 4-desk pod clusters.

#### Scenario: Adding Standard Cubicle
- **GIVEN** an active branch floor and section
- **WHEN** the Branch Admin submits `POST /api/branch-roster/cubicle` with workstation category and HDMI toggle
- **THEN** the desk is created in PostgreSQL and the 2D CAD canvas recalculates 4-desk pod clusters with balanced HDMI distribution.

### Requirement: Direct Desk Release Authority
The Branch Admin SHALL possess authority to release any active workstation reservation in their branch.

#### Scenario: Releasing Booked Workstation
- **WHEN** the Branch Admin confirms release in the Workstation Inspector
- **THEN** the active booking is marked `CANCELLED`, an audit record `RELEASE_DESK_ADMIN` is created, and the desk reverts to available immediately.
