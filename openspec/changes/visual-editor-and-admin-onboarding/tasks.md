## 1. Database & API Routes Setup

- [x] 1.1 Update `seed.ts` to only seed the Platform Admin user (`admin@deskbooking.com`). Verify by running `pnpm db:seed` and confirming that no organization or employee accounts exist in the database.
- [x] 1.2 Create the backend signup route `POST /api/auth/signup` implementing a Prisma transaction that creates the new Organization and the owner User record atomically. Verify using a REST client script to execute signup and check that both rows are inserted.
- [x] 1.3 Fix the GET `/api/sections` endpoint inside `sections.routes.ts` to include the `resources` relation ordered by `sortOrder`. Verify by sending a GET request and confirming the resources collection is present.

## 2. Onboarding & Auth Frontends

- [x] 2.1 Build the `SignupPage.tsx` form component for Organization Admin registration and register the `/signup` route in `App.tsx`. Verify compilation and navigation.
- [x] 2.2 Re-style both `LoginPage.tsx` and `SignupPage.tsx` using the light-background, emerald-green brand CSS color token theme instead of the dark slate theme. Verify visual presentation in the browser.
- [x] 2.3 Implement role-based navigation links filtering in `Sidebar.tsx`. Verify that logged-in Platform Admins only see the Organizations and Audit Logs tabs in the menu panel.

## 3. Hierarchical Layout Selector

- [x] 3.1 Rebuild the space directory panel in `BuildingsManagementPage.tsx` to display branches, buildings, floors, and sections in a single nested collapsible directory tree layout. Verify that selecting a section correctly loads the layout canvas.

## 4. Drag-and-Drop Sequential Grid Editor

- [x] 4.1 Implement React HTML5 drag-and-drop hot desk editor.
- [x] 4.2 Build sequential unoccupied index generator algorithm for desks.
- [x] 4.3 Keep employee-facing visual maps read-only. Verify dragging a desk updates its `sortOrder` index in the database.

## 5. Roster Adjustments & Bug Fixes

- [x] 5.1 Mask passwords in Roster list and default manual password. For manually added or imported employee credentials, default the password to the organization name or subdomain. Verify by registering a new employee with a blank password, and ensuring the database writes the correct hashed subdomain password.
- [x] 5.2 Add a document click handler in `Header.tsx` to automatically close the notifications bell dropdown when a click is detected outside the notification panel. Verify that clicking on the header background closes the active pop-up.
