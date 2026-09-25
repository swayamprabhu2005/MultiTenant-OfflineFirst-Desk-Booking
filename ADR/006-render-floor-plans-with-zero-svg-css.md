# ADR-006: Render Floor Plans with Zero-SVG CSS Architecture

## Status

Accepted

## Date

2026-09-01

## Context

The platform's core experience is an interactive 2D floor plan explorer where employees can visually browse facility layouts and book desks. The rendering approach must:

- Support dynamic desk states (available, booked-by-me, booked-by-others) with real-time colour updates.
- Render ergonomic 4-desk pod clusters that mirror real office cubicle arrangements.
- Work responsively across desktop and tablet screens without complex viewport calculations.
- Be maintainable by web developers without specialized SVG or Canvas expertise.

Alternatives considered:

1. **SVG-based floor plans** — Requires vector drawing tools (Figma/Illustrator) for layout authoring. SVG DOM manipulation for dynamic state updates is verbose. SVG viewBox scaling introduces coordinate mapping complexity.
2. **HTML5 Canvas / WebGL (Three.js, PixiJS)** — High rendering performance but loses DOM accessibility, CSS styling, and standard event delegation. Canvas hit-testing for click events requires manual geometry calculations.
3. **Third-party mapping libraries (Leaflet, OpenLayers)** — Designed for geographic maps, not architectural floor plans. Over-engineered for structured grid layouts.

## Decision

We will use a **strict No-SVG architecture** built exclusively with:

- Semantic HTML5 `<div>` containers for all spatial elements.
- **CSS Grid** for section and pod cluster layouts.
- **Flexbox** for desk arrangements within pods (2×2 facing clusters with central aisles).
- **Tailwind CSS** for colour-coded desk states, border-radius for pod shapes, and responsive breakpoints.
- **CSS `transform: scale()`** for zoom controls (70% to 140%).

Desk states are rendered via Tailwind utility classes:
- 🟢 `bg-green-*` — Available for booking
- 🔵 `bg-blue-*` — Booked by the current user
- 🔴 `bg-red-*` — Booked by someone else

## Consequences

- **Positive**: Any web developer can modify floor plan layouts using standard HTML/CSS — no SVG or Canvas expertise required.
- **Positive**: Desk elements are standard DOM nodes with native click handlers, keyboard navigation, ARIA attributes, and CSS hover states.
- **Positive**: Tailwind's utility-first approach makes desk state styling declarative and instantly readable in JSX.
- **Positive**: CSS Grid/Flexbox layouts are inherently responsive and adapt to container widths without manual coordinate recalculation.
- **Negative**: Complex non-rectangular floor shapes (L-shaped floors, curved walls) are harder to represent than with SVG paths. Mitigated by the directional section model (North/South/East/West) which approximates real floor layouts.
- **Negative**: Very large facilities (500+ desks per floor) may generate many DOM nodes. Mitigated by the hierarchical section/floor structure which limits visible desks per view.
