# Admin Portal - Employee Roster Specification

## Purpose
Provides Organization Admins with employee management tools including bulk CSV import, role assignment, and manual add/edit controls.

## Requirements
### Requirement: CSV Bulk Roster Onboarding
The system SHALL support importing a bulk roster of employees via a downloadable Excel/CSV template.

#### Scenario: CSV Roster Import
- **WHEN** the Admin uploads a CSV with 10 employees including branch, email, and password columns
- **THEN** 10 new user accounts are created and assigned to the specified branches

### Requirement: Manual Single Onboarding
The Admin SHALL be able to manually add individual new employees via a dashboard form.

#### Scenario: Manual Employee Add
- **WHEN** the Admin enters details for one new employee and submits
- **THEN** the employee account is created instantly and added to the roster view

### Requirement: Account Status Deactivation
The Admin SHALL be able to deactivate an employee account, preventing login.

#### Scenario: Deactivate Account
- **WHEN** the Admin clicks deactivate on an employee
- **THEN** the user's status changes to inactive and they are immediately rejected at login
