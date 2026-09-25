# Functional Specifications: Workforce Directory & Multi-Branch Roster

## Requirement: Per-Branch Spreadsheet Generation
The system SHALL generate an Excel workbook with dynamic per-branch tabs containing preformatted employee columns.

#### Scenario: Template Download
- **WHEN** the Organization Admin requests `GET /api/workforce/template`
- **THEN** an Excel workbook is returned with a tab for every branch in the tenant organization.

## Requirement: Bulk Employee Ingestion
The system SHALL parse employee entries across all sheets and persist user records with role `EMPLOYEE`.

#### Scenario: Roster Upload
- **WHEN** the completed roster is submitted via `POST /api/workforce/import`
- **THEN** all valid employees are persisted with their assigned branch IDs and temporary password hashes.
