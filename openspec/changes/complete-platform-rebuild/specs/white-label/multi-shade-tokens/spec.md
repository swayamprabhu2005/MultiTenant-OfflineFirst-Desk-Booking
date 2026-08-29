## Purpose

Derives three primary color CSS variables from a single brand hex color to support dynamic theme customization.

## ADDED Requirements

### Requirement: HSL Shade Derivation
The system SHALL dynamically calculate `--primary-light` and `--primary-dark` CSS custom properties by modifying the lightness parameter of the tenant's brand hex color.

#### Scenario: Set CSS Variables
- **WHEN** the tenant branding color #10B981 is loaded
- **THEN** `--primary-color` is set to #10B981, `--primary-light` lightness is increased by 15%, and `--primary-dark` lightness is decreased by 15%

### Requirement: Global theme custom properties Usage
All UI components (buttons, borders, active states) SHALL use the derived primary, light, and dark CSS custom properties instead of hardcoded tailwind color classes.

#### Scenario: Render Theme Button
- **WHEN** a primary button is rendered in the app
- **THEN** it resolves its background color via var(--primary-color) and hover state via var(--primary-dark)
