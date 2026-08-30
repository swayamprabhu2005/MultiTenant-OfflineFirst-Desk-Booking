## MODIFIED Requirements

### Requirement: RBAC Frontend Route Guards
The React router SHALL inspect user role metadata and block navigation to admin routes for regular employees, and the authentication forms (Sign In, Sign Up) SHALL render using the light-background emerald green brand theme.

#### Scenario: Admin URL Block
- **WHEN** an EMPLOYEE attempts to navigate to /admin/buildings
- **THEN** the router redirects them to the employee dashboard with an access denied toast

#### Scenario: Emerald Brand Authentication Theme
- **WHEN** any user visits the Sign-In or Sign-Up page
- **THEN** the UI displays in the clean light-background white card layout styled with emerald-green borders and buttons
