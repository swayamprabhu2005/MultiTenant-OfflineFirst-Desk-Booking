## Why

The initial generated codebase covers basic booking and offline sync, but diverges significantly from the full product requirements established in the PRD and subsequent design sessions. Critical gaps include a missing organization hierarchy (Branch and Section models), a partial offline sync implementation that only works while the browser tab is open, absent role-based UI guards, a card-list booking UI instead of the required visual floor-map experience, and no support for recurring bookings, bulk booking, notifications, or the "who's in office today" view. This rebuild aligns the platform with all 32 locked design decisions and introduces the complete feature set needed for an enterprise-ready MVP.

## What Changes

**BREAKING — Data model restructure:**
- **BREAKING**: `Building` gains a required `branchId` foreign key (new `Branch` model inserted between `Organization` and `Building`)
- **BREAKING**: `Resource` moves from `Floor` → `Resource` to `Floor` → `Section` → `Resource` (new `Section` model; `floorId` on `Resource` replaced by `sectionId`)
- **BREAKING**: `Booking.createdById` reintroduced with changed semantics (Tech Lead bulk booking only; self-bookings have `createdById = userId`)
- **BREAKING**: Proxy booking (`targetUserId` flow) removed; all bookings are in the booker's name unless created by a Tech Lead for a subordinate

**New capabilities:**
- `Branch` model and full CRUD API (`/api/branches`)
- `Section` model with column-count grid layout and auto-code generation (`/api/sections`, `/api/sections/:id/generate`)
- `TECH_LEAD` role with building scope, subordinate tracking (`teamLeadId`), and bulk booking rights
- `ORGANIZATION_ADMIN` branch-scoping via `scopedBranchId` (global vs. branch-level admin in one role)
- Visual floor plan editor for admins: Branch → Building → Floor → Section → Cubicle grid with boardroom placement
- Visual booking map for employees: floor-map navigation, cubicle grid with live color states across a date range
- Recurring weekly booking (online only): day-of-week picker, date range, partial-success conflict resolution, `recurringGroupId` grouping
- Bulk booking flow for Tech Lead: select multiple cubicles, assign to subordinates, one confirm action
- `SessionType` enum: FULL_DAY, FIRST_HALF (9–13:00), SECOND_HALF (13–17:00)
- Booking comment: mandatory for boardroom bookings and multi-cubicle same-day bookings
- Real Service Worker Background Sync API replacing `window.addEventListener('online')` — syncs outbox tab-closed
- In-app notification system: bell icon, three types (BOOKING_ASSIGNED, BOOKING_CONFLICT, BOOKING_CONFIRMED)
- "Who's in office today" view: building-scoped, full name + desk number, headcount
- Multi-shade white-label theme token system via HSL derivation from a single brand color
- Guided org setup wizard: Branch → Building → Floor → Section → Generate Cubicles → Import Employees
- Change password flow (forced on first online session)
- Branch selector for employees with no base branch set (one-time, saved on sync)
- Employee roster enhancements: search, edit, deactivate, manual single-add
- Downloadable CSV template for bulk employee import
- RBAC route guards on all admin frontend routes
- Cancellation UI: checkbox multi-select + search, cancel single / cancel all future in series
- Platform Admin seed script for first-boot bootstrap

**Fixes to existing code:**
- Workbox config: exclude POST/DELETE mutations from `NetworkFirst` retry (double-submission risk)
- `floorName` lost from `LocalBooking` after sync (IndexedDB bug)
- Rate limit is general-API only (login-specific brute-force guard removed from requirements)
- JWT remains Bearer token in localStorage — HTTP-only cookies explicitly out of scope (service worker needs token access for offline ops)

## Capabilities

### New Capabilities

- `org-hierarchy/branch-management`: Branch entity CRUD, branch-scoped Org Admin, Platform Admin provisioning flow that creates Org + Global Admin in one action
- `org-hierarchy/section-management`: Section entity under Floor, column-count grid config, auto-code-prefixed cubicle generation
- `roles/tech-lead`: TECH_LEAD role, `teamLeadId` subordinate relation, building scope, bulk booking permissions
- `admin-portal/visual-floor-plan-editor`: Admin UI for building visual floor maps — section grid builder, boardroom placement, cubicle status management
- `admin-portal/employee-roster`: Full roster table with search, edit, deactivate, manual add, CSV import with downloadable template, role assignment
- `admin-portal/org-setup-wizard`: Guided onboarding wizard for new organizations
- `employee-booking/visual-floor-map`: Employee floor navigation UI (Branch → Building → Floor → Section), cubicle grid with color states
- `employee-booking/date-range-booking`: Date range picker, grid color recalculation across range, pre-flight conflict warnings
- `employee-booking/recurring-bookings`: Day-of-week picker (Mon–Sun, disabled outside range), recurring series generation, `recurringGroupId` grouping, online-only enforcement
- `employee-booking/bulk-booking`: Tech Lead multi-cubicle selection, subordinate assignment, partial-success handling
- `employee-booking/session-types`: FULL_DAY / FIRST_HALF / SECOND_HALF session selection with time bounds
- `employee-booking/booking-comment`: Mandatory comment for boardroom and multi-cubicle same-day bookings
- `employee-booking/cancellation-ui`: Checkbox multi-select, search bar, cancel-single vs cancel-group modal
- `offline/background-sync-api`: Real SW Background Sync API registration and outbox flush handler
- `notifications/in-app-notifications`: Notification DB table, Dexie cache, bell icon UI, three notification types
- `office-presence/whos-in-office`: Building-scoped occupancy view with names, desk codes, headcount
- `white-label/multi-shade-tokens`: HSL-derived shade system from single brand hex; CSS custom properties for primary, light, dark shades
- `auth/change-password`: Forced password change on first online session; branch selector for unassigned employees

### Modified Capabilities

- `offline/sync-engine`: Background Sync API replaces `window.online` listener; recurring and cancel-group operations added to outbox; floorName bug fixed; notification events unified into notification system
- `auth/authentication`: `createdById` reintroduced with new semantics; proxy booking (`targetUserId`) removed; RBAC UI route guards added

## Impact

- **Database**: Two new models (`Branch`, `Section`), five modified models (`Building`, `User`, `Resource`, `Booking`, new `Notification`), two new enums (`SessionType`, extended `Role`)
- **API**: 12 new endpoints; modifications to `/api/bookings`, `/api/roster`, `/api/sync/operations`, `/api/organizations`
- **Frontend**: 6 pages rebuilt from scratch, 6 new pages/panels added, 3 pages enhanced
- **IndexedDB**: Two new Dexie tables (`branches`, `sections`, `notifications`); extended `LocalResource`, `LocalBooking` interfaces; version bump required
- **Service Worker**: Workbox config updated; Background Sync API event handler registered
- **Prisma**: Migration required — breaking schema changes need careful sequencing (Branch insert, Section insert, Resource re-parent, Booking field changes)
- **Packages**: No new external dependencies expected; existing stack (React, NestJS/Express, Prisma, Dexie, vite-plugin-pwa, Workbox) is sufficient
