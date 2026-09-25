# ADR-007: Use Excel-Driven Workspace Ingestion with ExcelJS

## Status

Accepted

## Date

2026-09-01

## Context

Enterprise facilities teams need to provision entire workspace hierarchies — branches, buildings, floors, sections, desks, and meeting rooms — in bulk. Manual UI-based creation is impractical for organizations with hundreds of cubicles across multiple buildings. The ingestion mechanism must:

- Support multi-level hierarchical data (Organization → Branches → Buildings → Floors → Sections → Desks).
- Validate cross-sheet relational integrity (e.g., building references must match declared branches).
- Provide detailed, actionable error feedback when validation fails.
- Align with corporate IT workflows where Excel is the standard data exchange format.

Alternatives considered:

1. **CSV import** — Cannot represent multi-sheet hierarchies. No support for dropdown validations, cell formatting, or cross-sheet foreign key references.
2. **JSON/YAML upload** — Technically sound but unfamiliar to facilities managers. No built-in visual editing or validation tooling.
3. **UI-based form wizard** — Too slow for bulk provisioning. Creating 200+ cubicles via web forms is error-prone and time-consuming.
4. **Database migration scripts** — Requires developer intervention, not suitable for non-technical facilities staff.

## Decision

We will use a **5-sheet Excel workbook ingestion engine** powered by **ExcelJS** and **JSZip**:

- **Template generation**: API endpoints generate pre-formatted Excel workbooks with dropdown validations, column formulas, and conditional formatting.
- **Sheet structure**: Sheet 1 (Organization), Sheet 2 (Branches), Sheet 3 (Buildings), Sheet 4 (Floors), Sheet 5 (Sections with desk counts, HDMI allocations, and meeting room configurations).
- **Cross-sheet validation**: The parser validates referential integrity across all 5 sheets — e.g., a floor's building code must exist in Sheet 3.
- **Error workbook feedback**: On validation failure, the server returns an annotated Excel workbook with red-highlighted error cells and contextual cell comments, enabling facilities teams to fix issues directly in Excel.
- **JSZip for template injection**: Raw XML manipulation via JSZip avoids ExcelJS serialization bugs that corrupt complex data validation ranges.
- **72-hour immutability grace period**: After workspace provisioning, structural modifications are locked after 72 hours to protect booking integrity.

## Consequences

- **Positive**: Facilities teams can provision an entire 500-cubicle campus from a single Excel upload — matching their existing workflow tools.
- **Positive**: Error feedback is delivered as an annotated Excel file, not cryptic JSON error arrays, enabling non-technical users to self-correct.
- **Positive**: Template workbooks include pre-built dropdown validations, reducing user input errors at the source.
- **Negative**: ExcelJS and JSZip add ~2MB to the API bundle. Acceptable for a server-side dependency.
- **Negative**: The dual JSZip + ExcelJS pipeline adds complexity. JSZip is used for template XML surgery because ExcelJS's serializer corrupts certain validation ranges.
- **Negative**: The 72-hour lock may frustrate admins who need to fix mistakes after the grace period. Mitigation: A re-ingestion endpoint allows corrective uploads within the lock window.
