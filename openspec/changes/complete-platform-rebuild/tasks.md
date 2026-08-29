## 1. Phase 0: Schema Migration, Auth Scoping, and Background Sync API

- [x] 1.1 Create Prisma schema migrations adding Branch and Section models, modifying Building, User, Resource, Booking, and creating Notification tables. Verify database schema updates and type-safety by running `prisma generate` and checking Prisma types.
- [x] 1.2 Implement the Platform Admin bootstrap seed script in `prisma/seed.ts`. Verify by running `prisma db seed` and checking that the first Organization and its Global Org Admin are successfully inserted.
- [x] 1.3 Update the JWT auth token verification on the API server to incorporate `scopedBranchId` and `teamLeadId`. Verify by writing a test script that decodes a scoped token and checks that correct parameters are populated.
- [x] 1.4 Implement API middleware checks for `scopedBranchId` to restrict cross-branch access for ORGANIZATION_ADMIN branch-scoped users. Verify by sending a request to a scoped route with a mismatched branch ID and observing a 403 response.
- [x] 1.5 Re-enable `createdById` field on `Booking` model and restrict it on the server: regular employees must have `createdById = userId`, only Tech Leads and Org Admins may set it to a subordinate's ID. Verify by attempting to set a mismatch `createdById` / `targetUserId` from a normal user account and observing a validation error.
- [x] 1.6 Implement the Service Worker Background Sync API registration inside `syncEngine.ts` and the Service Worker setup. Verify by mock-disconnecting, queueing a booking, and verifying the 'outbox-sync' event tag is registered via `navigator.serviceWorker.ready`.
- [x] 1.7 Exclude POST, PATCH, and DELETE requests from Workbox runtime caching in `vite.config.ts`. Verify by inspecting the built PWA cache list and confirming only GET requests are routed through the NetworkFirst caching strategy.

## 2. Phase 1: Branch Management, Visual Floor plan Editor, and Employee Roster

- [x] 2.1 Build API routes for Branch CRUD (`/api/branches`) and Section CRUD (`/api/sections`). Verify using REST client scripts to execute list, create, update, and delete actions.
- [x] 2.2 Rebuild the Dexie IndexedDB schema to version-up and add `branches`, `sections`, and `notifications` tables. Verify by checking local IndexedDB tables in the browser developer tools after page load.
- [x] 2.3 Implement the visual floor plan editor for Organization Admins, rendering sections as grids based on the columns count. Verify by creating a section with 4 columns and 12 desks and observing the visual grid layout wraps after every 4 elements.
- [x] 2.4 Add automatic desk code generation using the section code prefix in the Admin panel. Verify by generating 10 desks for section "FS" and verifying they appear as "FS-01" through "FS-10".
- [x] 2.5 Add boardroom placement within the section grid, supporting customizable `columnSpan` visual layout. Verify by placing a boardroom with `columnSpan = 2` and observing it spans 2 columns in the visual grid.
- [x] 2.6 Implement the employee roster table with pagination, search, manual user creation, and CSV bulk import using the downloadable template. Verify by importing a sample CSV and verifying that newly registered users display in the roster view with their correct roles and scopes.
- [x] 2.7 Build the organization guided setup onboarding wizard for new organizations. Verify by logging in as a brand-new Org Admin and confirming that the setup wizard triggers and blocks entry to the main dashboard until complete.
- [x] 2.8 Update the white-label branding loader to derive primary, light, and dark shades using HSL CSS variables from the single brand hex color. Verify by setting #10B981 and checking that elements use the correct darker hover color.

## 3. Phase 2: Employee Visual Booking Map and Advanced Booking Dialog

- [x] 3.1 Implement visual floor map navigation for employees, mapping their route from branch selection down to section grid view. Verify by navigating from a selected branch down to a floor section and seeing the live interactive grid.
- [x] 3.2 Implement live color states for visual grid resources based on selected date ranges. Verify by setting a range, confirming that booked desks turn red, and clicking a red desk displays the correct Mon–Sun booked occurrences overlay.
- [x] 3.3 Build the date range selector and weekday picker dialog (Mon–Sun, disabling days outside the range). Verify by picking a Friday-to-Monday range and confirming that Tuesday-to-Thursday selectors are grayed out.
- [x] 3.4 Implement pre-flight conflict warnings in the booking confirmation modal before submission. Verify by selecting a date where the user already has a booking and seeing a warning banner appear.
- [x] 3.5 Implement SessionType bounds (FULL_DAY, FIRST_HALF, SECOND_HALF) and add non-conflicting session booking checks to both the direct booking API and sync route. Verify by checking that a morning booking and an afternoon booking on the same desk do not conflict.
- [x] 3.6 Require a booking comment on boardroom reserves and multi-desk same-day bookings. Verify that empty comment fields block confirmation in these cases.
- [x] 3.7 Implement the My Bookings search bar and checkbox-based cancellation UI. Verify by checking multiple bookings and clicking cancel, confirming they are deleted (for pending outbox items) or queued for deletion (for confirmed bookings).
- [x] 3.8 Add the recurring cancellation confirmation modal offering a choice between "Cancel this date only" and "Cancel all future dates in series". Verify by selecting a recurring booking, clicking cancel, choosing all future, and confirming future bookings are removed.

## 4. Phase 3: In-App Notifications, Occupancy View, and Tech Lead Bulk Booking

- [x] 4.1 Implement the Notification model API endpoints and the local Dexie notification cache sync on reconnect. Verify by creating a mock notification, reconnecting, and confirming the bell icon unread badge updates.
- [x] 4.2 Build the header notifications dropdown list, with individual and batch mark-as-read triggers. Verify that clicking "Mark all as read" resets the badge to zero.
- [x] 4.3 Create the building-scoped "Who's in office today" live occupancy grid widget showing colleagues' names and desk locations. Verify by confirming that confirmed bookings show up in the list while pending bookings do not.
- [x] 4.4 Implement Tech Lead bulk booking, adding a subordinate search selection dropdown and partial-success execution logic. Verify by bulk booking 3 desks for subordinates, and confirming that the booking completes for available employees while showing an error for already-booked subordinates.
- [x] 4.5 Build the forced password reset redirect view on the employee dashboard for accounts with `mustChangePassword = true`. Verify by logging in with a new CSV-generated account and checking that navigation is blocked until a password is changed online.
- [x] 4.6 Build the one-time branch selector modal for employees lacking a `baseBranchId`. Verify by logging in as an unassigned employee, picking a branch, and confirming it persists to the profile on sync.
