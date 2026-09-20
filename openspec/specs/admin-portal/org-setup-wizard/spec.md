# Admin Portal - Organization Setup Wizard Specification

## Purpose
Governs the 5-sheet master Excel workbook template download, in-place JSZip tenant injection, structural validation, and atomic database hierarchy ingestion.

## Requirements
### Requirement: Master Template Ingestion
The system SHALL provide a downloadable 5-sheet Excel template containing Organization, Branches, Buildings, Floors, and Sections & Cubicles sheets.

#### Scenario: Template Download
- **GIVEN** an authenticated Organization Administrator or Platform Administrator
- **WHEN** the user requests `GET /api/workspace/template`
- **THEN** the system streams `templates/Workspace_FloorPlan_Template.xlsx` with the requesting tenant's ID and Name injected into Sheet 1 cells A5/B5 using in-place JSZip XML modification without re-serializing via ExcelJS.

### Requirement: Structural Validation & Red Error Feedback
The system SHALL validate relational constraints and append a red `ERRORS & FIXES` column exclusively to sheets containing errors.

#### Scenario: Ingestion Error Feedback
- **WHEN** an uploaded workbook violates validation constraints (e.g. HDMI count exceeds total cubicles in a section)
- **THEN** the API returns status 422 with a base64-encoded workbook where only invalid sheets contain `#DC2626` red headers and actionable feedback.
