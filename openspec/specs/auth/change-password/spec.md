# Auth - Change Password Specification

## Purpose
Forces a password change on first online login and provides a profile-scoped change password flow.

## Requirements
### Requirement: First Login Password Reset Redirection
The system SHALL intercept user sessions and force redirection to the Change Password screen if the user has mustChangePassword = true.

#### Scenario: Force Password Change
- **WHEN** the employee logs in with a demo password and connects to the internet
- **THEN** they are redirected to the Change Password page and blocked from entering the main app until the password is changed

### Requirement: Online Only Password Action
Password changes SHALL require an active internet connection to execute on the server.

#### Scenario: Offline Password Change Blocked
- **WHEN** the user attempts to change their password while offline
- **THEN** the system displays a connection error message and disables the change button
