## Context

See proposal.md - Why.
We are introducing a self-service signup system, green-themed authentication flows, a visual tree directory for the floor plan manager, a lightweight sequential drag-and-drop React coordinate grid, and strict platform admin scope boundaries.

## Goals / Non-Goals

**Goals:**
* Perform Organization and Global Org Admin creation atomically in a single backend database transaction.
* Realign login and signup styling to conform with the HSL CSS white-label brand token theme dynamically.
* Implement a grid sorting coordinate algorithm in the React frontend utilizing Native HTML5 drag events on slot index positions.
* Include resource records in section queries to resolve empty grid views.

**Non-Goals:**
* Upgrading the system to Konva.js or other canvas layout frameworks.
* Adding self-service registration links for Platform Administrators (these remain database seeded).

## Decisions

### 1. Unified Sign-Up Database Transaction
* **Approach:** Use a Prisma `$transaction` inside `POST /api/auth/signup` to create the `Organization` first and then the `User` record with `Role.ORGANIZATION_ADMIN`.
* **Rationale:** Ensures clean integrity. We cannot create a user without a valid `organizationId` due to database FK constraints.
* **Alternatives Considered:** Allowing nullable `organizationId` on the User model. Rejected, as it would weaken data integrity and tenant isolation guarantees.

### 2. Native HTML5 Drag-and-Drop for Desk Grid Coordination
* **Approach:** Render active cells and vacant slots in a flex/grid layout. Use `draggable="true"` and drop handlers (`onDragStart`, `onDragOver`, `onDrop`) directly on React components. Update `sortOrder` index on drop.
* **Rationale:** Extremely lightweight, avoids canvas library bloat, and aligns with the 4GB RAM PC constraint.
* **Alternatives Considered:** Konva.js canvas rendering. Rejected, as canvas layers increase DOM overhead and complex integration costs for simple grid alignment needs.

### 3. Hierarchical Collapsible Visual Directory Sidebar
* **Approach:** Introduce a sidebar tree component inside `BuildingsManagementPage.tsx` using recursively styled lists displaying branches, buildings, floors, and sections.
* **Rationale:** Groups items clearly to evidence linking (rather than three disconnected columns).
* **Alternatives Considered:** Keep column cards but add breadcrumbs. Rejected, as tree structures are cleaner to navigate for nesting.

## Risks / Trade-offs

* **[Risk]** Heavy custom grid updates offline could cause sync overlap delays.
  * **Mitigation:** Update the local Dexie store immediately and synchronize through the standard `syncEngine` Outbox model.
* **[Risk]** Brand theme changes might cause contrast issues.
  * **Mitigation:** Rely on standardized light cards with customizable HSL color variables for interactive highlights.
