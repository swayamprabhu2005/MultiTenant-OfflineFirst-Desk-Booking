# Technical Design: Governance Controls, Matrix Navigation & Mass Booking Modal

## 1. Global Org Admin Governance Guard
- In `FloorPlansPage.tsx`:
  ```ts
  const isGlobalOrgAdmin = user?.role === 'ORGANIZATION_ADMIN';
  ```
- When `isGlobalOrgAdmin === true`:
  - Strips + Add Cubicle, Export Plan, Import Plan, and Mass Booking Mode buttons.
  - Workstation click opens View-Only Inspector modal without session window dropdowns, notes, or reservation buttons.
  - Dismisses on backdrop click (`e.target === e.currentTarget`).

## 2. Fixed-Scale Rendering
- Removed `zoomLevel` state, zoom buttons, and `transform: scale(...)` container styles.
- Renders directly in responsive HTML5/CSS grid architectural canvas.

## 3. Strict 7-Day Sliding Window Engine
- Helper: `get7DaysWindow(baseDateStr, weekOffset)` produces exactly 7 date strings `[D0, D1, D2, D3, D4, D5, D6]`.
- Navigation controls `<` and `>` adjust `weekOffset` state dynamically.

## 4. Multi-Workstation Mass Booking Modal
- Launched via React Portal when clicking `Proceed to Book (N Desks)`.
- Chips container allows removing individual cubicles.
- Conflict detection evaluates bookings across all selected workstations:
  ```ts
  const conflictingDesks = massDesks.filter(d =>
    d.bookings?.some(b => dStr >= b.startTime.split('T')[0] && dStr <= b.endTime.split('T')[0])
  );
  ```
- Conflicted dates render red with `✕ Conflict` and cannot be clicked. Free dates render green (`Available` / `✓ Selected`).
- Restricts selection to a single date (`selectedMassDate`).
- Dismisses on backdrop click.
