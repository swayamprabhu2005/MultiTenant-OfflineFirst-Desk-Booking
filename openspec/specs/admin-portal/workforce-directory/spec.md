# Admin Portal - Workforce Directory Specification

## Purpose
Governs organization-wide employee management across physical branches, multi-sheet Excel roster generation, bulk database upsert, and domain configuration.

## Requirements
### Requirement: Dynamic Multi-Branch Employee Template
The system SHALL generate an Excel workbook with dedicated tabs for each physical branch defined in the organization.

#### Scenario: Roster Template Generation
- **GIVEN** an organization with defined branches
- **WHEN** the administrator requests `GET /api/workforce/template`
- **THEN** the server returns an Excel workbook where each tab corresponds to a branch name, containing employee name, email, department, role, and auto-generated temporary password columns.

### Requirement: Bulk Roster Import with Bcrypt Precomputation
The system SHALL parse multi-branch employee rosters and persist users atomically.

#### Scenario: Bulk Employee Import
- **WHEN** an administrator uploads a completed workforce roster via `POST /api/workforce/import`
- **THEN** the server precomputes bcrypt password hashes, validates unique email constraints, and upserts employee records in an atomic database transaction within 30 seconds.
