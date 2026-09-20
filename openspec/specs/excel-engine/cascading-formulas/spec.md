# Excel Engine - Dynamic Cascading Formulas Specification

## Purpose
Generates Excel floor plan templates with dynamic uppercase cascading formulas, visual protection, and meeting room conditional lockout.

## Requirements
### Requirement: Dynamic Cascading Excel Formulas
Workbook sheets SHALL be linked via uppercase Excel formulas (`=UPPER(TRIM(...))`, `=IF(...)`, `=VLOOKUP(...)`).

#### Scenario: Formula Cascade
- **WHEN** entering building codes on the Floors sheet
- **THEN** the Branch Code auto-populates via formula from the Buildings sheet without manual re-entry.

### Requirement: Meeting Room Conditional Lockout
Setting Meeting Room to 'Yes' SHALL conditionally lock and highlight capacity requirements.

#### Scenario: Meeting Room Lockout
- **WHEN** Meeting Room is marked 'Yes' in Sections & Cubicles
- **THEN** Standard Desk Count is locked out and Meeting Room Capacity becomes required.
