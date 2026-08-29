## Purpose

Allows Tech Leads and Organization Admins to reserve multiple desks simultaneously and assign them to team subordinates.

## ADDED Requirements

### Requirement: Role Gated Bulk Booking
Only users with the TECH_LEAD or ORGANIZATION_ADMIN roles SHALL be permitted to perform bulk bookings.

#### Scenario: Unauthorized Bulk Booking Block
- **WHEN** a regular EMPLOYEE tries to select and book multiple desks
- **THEN** the action is blocked by the UI and rejected by the API

### Requirement: Tech Lead Team Scope
A Tech Lead SHALL only be able to assign bulk bookings to subordinates who have their teamLeadId set to that Tech Lead's ID.

#### Scenario: Bulk Book Subordinates Only
- **WHEN** the Tech Lead selects a desk and assigns it to an employee in another team
- **THEN** the selection dropdown blocks the assignment and the server rejects the request

### Requirement: Subordinate Notification on Assignment
When a Tech Lead assigns a desk to a subordinate, the system SHALL generate a notification for that subordinate.

#### Scenario: Subordinate Notification Trigger
- **WHEN** the Tech Lead completes a bulk booking for User 2
- **THEN** User 2 receives a BOOKING_ASSIGNED notification containing the desk code and date
