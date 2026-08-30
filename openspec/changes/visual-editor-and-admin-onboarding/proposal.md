## Why

This change addresses gaps in organization onboarding and physical workspace design workflows:
1. **Self-Service Sign-Up**: Currently, there is no sign-up page for new Organization Admins, requiring platform administrators to manually seed every customer organization and admin account.
2. **Visual Floor Editor Limitations**: Desks generated in the visual manager do not appear in the grid due to a query exclusion bug, and admins have no way to physically arrange, sort, or drag-and-drop desks into custom coordinates or grid cells. Additionally, the side-by-side columns have no visual grouping or breadcrumb context indicating how buildings and floors are linked.
3. **Role Scope Separation**: Platform admins can access employee rosters and visual managers, violating tenant-provider role scoping rules, while current auth pages do not match the white-label branding layout.

## What Changes

* **Organization Admin Sign-Up**: Add a self-service signup screen that creates both the organization profile and the first global organization admin account in a single transaction.
* **White-Label Auth Branding**: Restyle both sign-in and sign-up portals to use the clean light-background emerald-green brand theme instead of dark slate.
* **Hierarchical Floor Linking Tree**: Replace the multi-card layout in the floor manager with an interactive collapsible tree navigation displaying branches, buildings, floors, and sections.
* **Sequential Drag-and-Drop Editor**: Build a drag-and-drop desk editor using slot-index positions (`sortOrder`) that automatically prevents overlaps, generates items in sequential free cells, and renders empty slots.
* **Role Scoping Restrictions**: Restrict Platform Admins from accessing visual space managers and employee rosters, reserving those solely for Org Admins.
* **Bug Fixes**:
  - Fix the GET `/sections` query to include resource records in the returned collection.
  - Implement a click-outside listener to automatically close the notifications bell dropdown.

## Capabilities

### New Capabilities
- `auth/onboarding-signup`: Self-service signup and organization onboarding creation flows for new global organization admins.
- `employee-booking/visual-drag-placement`: Sequential drag-and-drop hot desk layout placement coordinate system for visual floor editors.

### Modified Capabilities
- `admin-portal/visual-floor-plan-editor`: Group floor selection assets under a visual collapsible tree hierarchy linking branches, buildings, floors, and sections.
- `notifications/in-app-notifications`: Close the notification list container automatically when a click occurs outside its boundary.
- `auth/authentication`: Redesign sign-in pages to match the light-background emerald-green theme.
- `employee-booking/visual-floor-map`: Restrict interactive drag-and-drop desk placement to the admin portal, keeping the employee layout view read-only.
- `admin-portal/employee-roster`: Hide employee passwords in the roster list and default default passwords to the organization name upon roster creation/import.

## Impact

* **Frontend (`apps/web`)**: New routing for `/signup`, restyled login view, redesigned visual layout editor, new sidebar links filtering, and document click-outside triggers.
* **Backend (`apps/api`)**: New `POST /auth/signup` endpoint, updated database seeding script (`seed.ts`), and corrected section-query joins.
* **Database**: Updates to default database seeding configurations.
