## MODIFIED Requirements

### Requirement: CSV Bulk Roster Onboarding
The system SHALL support importing a bulk roster of employees via a template, assigning default passwords to the organization name with star representation.

#### Scenario: CSV Roster Import
- **WHEN** the Admin uploads a CSV with 10 employees including branch and email details
- **THEN** 10 new user accounts are created, their passwords default to the organization name (represented as asterisks), and they are assigned to the specified branches

### Requirement: Manual Single Onboarding
The Admin SHALL be able to manually add individual new employees via a dashboard form where the employee's default password is set to the organization subdomain name.

#### Scenario: Manual Employee Add
- **WHEN** the Admin enters details for one new employee and submits
- **THEN** the employee account is created instantly with a default password set to the organization subdomain name, and added to the roster view
