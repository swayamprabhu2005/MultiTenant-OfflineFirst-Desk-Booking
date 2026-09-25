# Technical Design: Branch Admin Customization & Workstation Governance

## 1. Branch Floor Plan Controller (`branchRosterController.ts`)
- `GET /api/branch-roster/floor-plan-template`: Generates workbook scoped to the admin's assigned branch.
- `POST /api/branch-roster/import-floor-plan`: Atomically re-syncs branch hierarchy.
- `POST /api/branch-roster/cubicle`: Creates desk record (`isMeetingRoom: false`) and recalculates section counts.
- `POST /api/branch-roster/assign-executive-desk`: Sets `isExecutive: true` and links admin.

## 2. Dynamic Pod Recalculation Engine
- Client splits standard desks into chunks of 4 (`standardDesks.slice(i, i + 4)`).
- Symmetrically allocates HDMI stations across clusters based on `hdmiCount / totalPods`.
- Excludes conference room seats (`M-01` to `M-10`) from pod calculation.
