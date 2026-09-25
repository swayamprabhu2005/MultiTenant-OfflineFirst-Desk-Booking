# Auth - Password Management Specification

## Purpose
Enforces initial login password changes for newly provisioned users and enables self-service password updates.

## Requirements
### Requirement: Forced Password Change Guard
Users with `mustChangePassword: true` SHALL be restricted until their password is updated.

#### Scenario: Initial Login Password Reset
- **GIVEN** an imported employee logging in with a default password
- **WHEN** login succeeds
- **THEN** the client redirects to the password update dialog and requires `POST /api/auth/change-password` before granting system access.
