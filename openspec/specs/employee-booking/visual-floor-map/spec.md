# Employee Booking - Visual CAD Floor Plan Map Specification

## Purpose
Renders interactive 2D architectural floor plans using pure HTML5 and CSS Grid, satisfying the zero-SVG mandate with 3-color contextual booking parity and fixed 100% scale.

## Requirements
### Requirement: Strict Zero-SVG Mandate
All walls, corridors, pod clusters, workstations, and meeting rooms SHALL be rendered without `<svg>`, `<canvas>`, or vector graphics.

#### Scenario: Rendering Architectural Canvas
- **WHEN** the employee opens the floor plan explorer
- **THEN** the layout renders using semantic HTML5 `<div>` and `<button>` elements styled with CSS Grid and Tailwind CSS at native 100% scale without zoom controls.

### Requirement: 3-Color Contextual Booking Parity
Workstations SHALL reflect four consistent status colors:
- **Emerald Green**: Available for booking
- **Indigo Blue**: Booked by the currently authenticated user
- **Rose Red**: Booked by another colleague
- **Amber Yellow**: Offline Sync Pending in local Outbox
