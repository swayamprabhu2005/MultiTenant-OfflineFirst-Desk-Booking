# Auth - Authentication Specification

## Purpose
Enforces JWT authentication, tenant isolation via subdomains, and RBAC route guards across API and UI.

## Requirements
### Requirement: RBAC Frontend Route Guards
The React router SHALL inspect user role metadata and block navigation to admin routes for regular employees.

#### Scenario: Admin URL Block
- **WHEN** an EMPLOYEE attempts to navigate to /admin/buildings
- **THEN** the router redirects them to the employee dashboard with an access denied toast

### Requirement: Scoped createdById Audit
The Booking model SHALL support tracking both the booking recipient (userId) and the booking creator (createdById) for audit logging.

#### Scenario: Tech Lead Booking Audit
- **WHEN** a Tech Lead creates a booking for a team subordinate
- **THEN** the Booking record is saved with userId = subordinate.id and createdById = techLead.id
