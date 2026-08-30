## Purpose

Provides self-service organization signup and tenant configuration tools for new global organization administrators.

## ADDED Requirements

### Requirement: Unified Onboarding Signup
The system SHALL support creating a new tenant organization and its global administrator account in a single unified registration transaction.

#### Scenario: Successful Organization Signup
- **WHEN** the user submits the sign-up form with Name, Email, Password, Organization Name, Subdomain, and Tenant Code
- **THEN** a new Organization and User record are created, and the user is authenticated and logged in instantly
