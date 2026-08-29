## Purpose

Introduces the Tech Lead role to support team-based bulk bookings and hierarchical subordinate relationships.

## ADDED Requirements

### Requirement: Tech Lead Team Association
The system SHALL support associating employees with a Tech Lead using a nullable teamLeadId foreign key on the User model.

#### Scenario: Set Subordinate Lead
- **WHEN** the Admin assigns User 2's teamLeadId to User 1 (who is a TECH_LEAD)
- **THEN** User 2 is registered as a direct subordinate of User 1

### Requirement: Bulk Booking for Subordinates
A Tech Lead SHALL be permitted to bulk-book desks only for users who are their direct subordinates.

#### Scenario: Tech Lead Bulk Booking
- **WHEN** the Tech Lead bulk-books 3 desks for 3 team members
- **THEN** bookings are created under each team member's name, with createdById set to the Tech Lead ID

### Requirement: Tech Lead Booking View
A Tech Lead SHALL be able to view all active bookings they created for their team subordinates.

#### Scenario: View Team Bookings
- **WHEN** a Tech Lead queries their bookings history
- **THEN** the system returns both their own bookings and any bookings they created for subordinates
