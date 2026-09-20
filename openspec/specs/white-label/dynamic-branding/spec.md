# White-Label - Dynamic Branding Specification

## Purpose
Calculates automated relative luminance contrast from the organization's brand hex color to theme the navigation bar, welcome banners, and CTA buttons.

## Requirements
### Requirement: Automated Luminance Contrast Calculation
The client SHALL compute relative luminance ($Y = 0.299R + 0.587G + 0.114B$) to select optimal text and badge contrast.

#### Scenario: Theme Color Adaptation
- **WHEN** an organization sets `themeColor: '#1E1B4B'` ($Y < 145$, dark)
- **THEN** headers render in white text (`text-white`) with translucent white badges.
- **WHEN** an organization sets `themeColor: '#FEF08A'` ($Y \ge 145$, light)
- **THEN** headers render in dark slate text (`text-slate-950`) with translucent dark badges.
