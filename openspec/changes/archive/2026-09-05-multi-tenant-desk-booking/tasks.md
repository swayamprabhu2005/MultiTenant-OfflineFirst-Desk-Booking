# Tasks: Multi-Tenant Desk Booking Platform & SaaS Control Plane

**Change ID:** `2026-09-05-multi-tenant-desk-booking`  
**Status:** 100% Completed  
**Verification:** Fully Verified & Deployed  

---

## 1. Monorepo Infrastructure & Workspace Setup

- [x] Configure PNPM workspace root (`pnpm-workspace.yaml`) linking `apps/*` and `packages/*`.
- [x] Setup root `package.json` with scripts: `dev`, `dev:api`, `dev:web`, `build`, `db:up`, `db:down`, `db:generate`, `db:push`, and `db:seed`.
- [x] Configure root and workspace `tsconfig.json` files for TypeScript v5.3.3 strict mode.
- [x] Create `@deskbooking/shared` package in `packages/shared` with type definitions:
  - [x] Define `Role` enum (`PLATFORM_ADMIN`, `ORGANIZATION_ADMIN`, `BRANCH_ADMIN`, `TECH_LEAD`, `EMPLOYEE`).
  - [x] Define DTOs: `OrganizationDTO`, `BranchDTO`, `BuildingDTO`, `FloorDTO`, `SectionDTO`, `DeskDTO`, `MeetingRoomDTO`, `UserDTO`, and `AuditLogDTO`.
- [x] Setup Docker Compose file (`docker-compose.yml`) defining PostgreSQL 15 (`postgres:15-alpine`) on port 5432 with volume persistence.
- [x] Configure environment templates (`.env.example` and `.env`) specifying `DATABASE_URL`, `PORT=4000`, `JWT_SECRET`, and `VITE_API_BASE_URL`.

---

## 2. Relational Database Modeling & Prisma Configuration

- [x] Initialize Prisma in `apps/api/prisma/schema.prisma` with PostgreSQL datasource provider.
- [x] Model `Organization` entity with unique `code`, unique `subdomain`, `logoUrl`, `themeColor`, `timezone`, and `status`.
- [x] Model `Branch` entity with `organizationId` foreign key (cascade delete), `name`, `code`, and compound unique index `[organizationId, code]`.
- [x] Model `Building` entity with `branchId` and `organizationId` foreign keys, and compound unique index `[organizationId, code]`.
- [x] Model `Floor` entity with `buildingId` foreign key, `code` (e.g. `1-FL01`), `floorNumber`, `name`, and compound unique index `[buildingId, code]`.
- [x] Model `Section` entity with `floorId` foreign key, `direction` (`NORTH`, `SOUTH`, `EAST`, `WEST`), `standardDeskCount`, `hdmiDeskCount`, and unique index `[floorId, name]`.
- [x] Model `Desk` entity with `sectionId` foreign key, `deskCode` (e.g. `C-01`), `deskNumber`, `hasHdmi`, `isMeetingRoom`, `status` (`AVAILABLE`, `BOOKED`), and unique index `[sectionId, deskCode]`.
- [x] Model `MeetingRoom` entity with 1-to-1 relation to `Section`, `name`, `capacity`, `hasHdmi`, and `hdmiCount`.
- [x] Model `User` entity with unique `email`, `passwordHash`, `role`, relation to `baseBranch`, relation to `scopedBranch`, and self-relation for `teamLead`.
- [x] Model `Booking` entity with `deskId`, `userId`, `startTime`, `endTime`, and `status` (`CONFIRMED`, `CANCELLED`).
- [x] Model `AuditLog` entity with `organizationId`, `actorUserId`, `action`, `entityType`, `entityId`, and `metadata` JSON field.
- [x] Implement database seeding script in `apps/api/prisma/seed.ts`:
  - [x] Ensure idempotent creation of `system` organization (`subdomain: 'system'`, `code: 'SYSTEM'`).
  - [x] Seed platform administrator (`admin@deskbooking.com`) with high-entropy passphrase `DeskBook$2026#SecureOps!X9`.
  - [x] Update password hash idempotently on duplicate seed executions.

---

## 3. Multi-Tenancy & Authentication Subsystem

- [x] Implement `tenantMiddleware` in `apps/api/src/middleware/tenant.middleware.ts`:
  - [x] Extract tenant from `x-tenant-subdomain` HTTP header.
  - [x] Parse subdomain from Host header (`subdomain.deskbooking.com`).
  - [x] Extract fallback tenant from `?tenant=` query parameter.
  - [x] Query database for organization and attach `req.organizationId` and `req.tenantSubdomain`.
- [x] Implement `authMiddleware` in `apps/api/src/middleware/auth.middleware.ts` verifying Bearer JWTs and attaching decoded user payload.
- [x] Implement `requireRole(roles: Role[])` RBAC guard checking authorized roles.
- [x] Build authentication endpoints in `apps/api/src/routes/auth.routes.ts`:
  - [x] `POST /api/auth/login`: verify bcrypt password hash, generate 7-day signed JWT, return user and organization profile.
  - [x] `POST /api/auth/signup`: execute atomic `prisma.$transaction` creating `Organization`, `User` (`role: ORGANIZATION_ADMIN`), and `AuditLog` (`action: CREATE_ORGANIZATION`).
  - [x] `GET /api/auth/me`: return authenticated user profile with organization details.
  - [x] `POST /api/auth/change-password`: update user password and reset `mustChangePassword` to `false`.
  - [x] `GET /api/auth/organizations`: public list of active organizations for tenant switching.
- [x] Build client-side authentication context in `apps/web/src/context/AuthContext.tsx` managing token persistence in `localStorage`.
- [x] Build tenant resolution context in `apps/web/src/context/TenantContext.tsx` tracking active organization, subdomain, and branding tokens.

---

## 4. Platform Administration Control Plane & Tenant Lifecycle

- [x] Build `GET /api/organizations` returning all tenant organizations with user counts for `PLATFORM_ADMIN`.
- [x] Build `POST /api/organizations` allowing Platform Admins to provision new enterprise organizations.
- [x] Build `PATCH /api/organizations/:id/branding` allowing updates to `themeColor`, `logoUrl`, and `name`.
- [x] Build `DELETE /api/organizations/:id` in `apps/api/src/routes/organizations.routes.ts`:
  - [x] Block deletion of system tenant (`subdomain === 'system'` or `code === 'SYSTEM'`).
  - [x] Execute atomic `prisma.$transaction` cascade deleting bookings $\rightarrow$ meeting rooms $\rightarrow$ desks $\rightarrow$ sections $\rightarrow$ floors $\rightarrow$ buildings $\rightarrow$ branches $\rightarrow$ users $\rightarrow$ audit logs $\rightarrow$ organization.
  - [x] Record platform-level `DELETE_ORGANIZATION` audit log.
- [x] Build `PlatformAdminDashboard.tsx` in `apps/web/src/components/dashboard/PlatformAdminDashboard.tsx`:
  - [x] Render platform dashboard banner with tenant count and quick actions.
  - [x] Provide real-time search input filtering tenants by name, code, or subdomain.
  - [x] Implement high-visibility deletion confirmation modal warning of irreversible physical layout destruction.
  - [x] Connect deletion modal to `DELETE /api/organizations/:id` with instant table re-fetching.
- [x] Streamline navigation: remove obsolete `/admin/organizations` route and consolidate all platform operations into `PlatformAdminDashboard.tsx`.

---

## 5. Cascading 5-Sheet Excel Workspace Ingestion Engine

- [x] Author master 5-sheet workbook `templates/Workspace_FloorPlan_Template.xlsx`:
  - [x] Sheet 1 (`Organization`): Pre-filled Organization ID (Col A), Organization Name (Col B), Number of Branches (Col C).
  - [x] Sheet 2 (`Branches`): Branch ID (`BR001`), Branch Name, Number of Buildings.
  - [x] Sheet 3 (`Buildings`): Branch Name ("Show Once per Group"), Building ID (`BLD001`), Building Name, Number of Floors.
  - [x] Sheet 4 (`Floors`): Branch Name, Building ID, Building Name, Floor ID (`1-FL01`), Number of Sections (Max 4).
  - [x] Sheet 5 (`Sections & Cubicles`): Floor ID, Section Name, Number of Cubicles, HDMI Cubicles, Meeting Room (`Yes`/`No`), Meeting Room Capacity, Meeting Room HDMI.
- [x] Implement dynamic row-anchored data validation formulas in Sheet 5:
  - [x] Column H (Capacity) Data Validation: `=UPPER(TRIM(INDIRECT("G" & ROW())))="YES"`.
  - [x] Column I (HDMI) Data Validation: `=AND(UPPER(TRIM(INDIRECT("G" & ROW())))="YES", INDIRECT("I" & ROW())<=INDIRECT("H" & ROW()))`.
  - [x] Column F (Workstation HDMI) Data Validation: `=INDIRECT("F" & ROW())<=INDIRECT("E" & ROW())`.
- [x] Implement conditional formatting in Sheet 5:
  - [x] Disabled Muted Gray Rule: `=UPPER(TRIM(INDIRECT("G" & ROW())))<>"YES"` styles Columns H & I in `#E2E8F0`.
  - [x] Unlocked Yellow Rule: `=UPPER(TRIM(INDIRECT("G" & ROW())))="YES"` illuminates Columns H & I in `#FFF2CC`.
- [x] Implement non-destructive template streaming in `apps/api/src/services/excel.service.ts`:
  - [x] `generateOrgTemplate(orgId, orgName)`: Load template archive via `JSZip`, modify only cells `A5` and `B5` inside `xl/worksheets/sheet1.xml`, and stream buffer without ExcelJS re-serialization.
- [x] Build `GET /api/workspace/template` endpoint streaming pre-filled template with tenant code.
- [x] Implement stateful 5-sheet validator `parseAndValidateWorkspace(fileBuffer, expectedOrgId)`:
  - [x] Validate mandatory headers across all 5 sheets.
  - [x] Validate positive branch, building, floor, section, and cubicle counts.
  - [x] Validate HDMI workstations $\le$ total cubicles.
  - [x] Validate meeting room capacity $> 0$ and meeting room HDMI $\le$ capacity when Meeting Room is `"Yes"`.
  - [x] Validate meeting room capacity is cleared when Meeting Room is `"No"`.
- [x] Implement sheet-specific error feedback:
  - [x] Inject red header `ERRORS & FIXES` (`#DC2626`) and row-level descriptions (`#FEE2E2`, font `#B91C1C`) only into sheets containing errors.
  - [x] Leave error-free sheets completely clean.
- [x] Build `POST /api/workspace/import` endpoint:
  - [x] On error: return HTTP 422 with summary and Base64-encoded annotated Excel file.
  - [x] On success: execute atomic `prisma.$transaction` deleting existing tenant branches, creating new hierarchy, generating desks (`C-01`, `C-02`...), generating meeting rooms, and logging `IMPORT_WORKSPACE_FLOORPLAN`.
- [x] Design `WorkspaceSetupPage.tsx` in `apps/web/src/pages/admin/WorkspaceSetupPage.tsx`:
  - [x] Position dynamic result container (red error banner / green success card) at the top of the page.
  - [x] Render 2-column Action Hub (Download Template & Upload Spreadsheet) directly at the top.
  - [x] Position 4-step Ingestion Lifecycle Walkthrough (cards 1, 2, 3, 4) below the Action Hub.

---

## 6. Interactive 2D Floor Plan Engine (STRICT NO-SVG Mandate)

- [x] Enforce 100% zero-SVG mandate in `FloorPlansPage.tsx`:
  - [x] Build outer boundary walls using `border-4 border-slate-900 bg-slate-100/40 p-6`.
  - [x] Render entrance doorway using bottom center break with label `🚪 ENTRY`.
  - [x] Render meeting rooms using rectangular container `border-2 border-slate-700 bg-white p-4`.
  - [x] Construct cubicle workstations using HTML5 buttons with `rounded-xl` corners.
- [x] Implement sanitized dropdown selectors:
  - [x] Branch selector displays `{b.name}` (e.g. `Pune`), hiding `(BR001)`.
  - [x] Building selector displays `{bld.name}` (e.g. `Bhaskar`), hiding `(BLD001)`.
  - [x] Floor selector displays clean name via `formatFloorDisplayName(fl)` (e.g. `Floor 1`), hiding `1-FL01 •`.
  - [x] Level badge in header displays clean floor name (`LEVEL: FLOOR 1`).
- [x] Implement 4-desk pod clustering algorithm:
  - [x] Split section desks into pods of 4 (`podClusters`), with 2 top cubicles facing 2 bottom cubicles.
  - [x] Add dashed empty placeholders (`EMPTY`) for partial pods to maintain rectangular balance.
- [x] Implement column-wise pod placement and horizontal rightward expansion order:
  - [x] Cluster 1: Top-Left (Row 0, Col 0).
  - [x] Cluster 3: Bottom-Left (Row 1, Col 0).
  - [x] Cluster 2: Top-Right (Row 0, Col 1).
  - [x] Cluster 4: Bottom-Right (Row 1, Col 1).
  - [x] Cluster 5 & 6: Expand rightward into Column 2 (Row 0 & 1, Col 2).
- [x] Implement symmetrical round-robin HDMI distribution algorithm:
  - [x] Compute base HDMI per pod $b = \lfloor H / P \rfloor$ and remainder $r = H \pmod P$.
  - [x] Place HDMI desks diagonally within pods (slots 0 and 3) for 2-HDMI allocations.
  - [x] Render HDMI badges using pure HTML/CSS text glyphs (`text-[8.5px] font-mono bg-slate-900 text-emerald-400`).
- [x] Implement dynamic auto-zoom containment:
  - [x] Apply dynamic column grid classes (`colGridClass`): 1 col, 2 cols, 3 cols, or 4 cols.
  - [x] Scale down pod heights (`h-13 sm:h-14`) and font sizes (`text-[10px]`) for sections with $24+$ desks.
- [x] Build interactive slide-over drawer:
  - [x] Clicking any cubicle sets `activeDesk` and opens slide-over specifications drawer.
  - [x] Connect "Reserve This Desk" button to `POST /api/workspace/book-desk`.
  - [x] Connect "Cancel Reservation" button to `POST /api/workspace/cancel-booking`.
- [x] Build `GET /api/workspace/hierarchy` endpoint returning fully populated Branch $\rightarrow$ Building $\rightarrow$ Floor $\rightarrow$ Section $\rightarrow$ Desk/MeetingRoom hierarchy.

---

## 7. Dedicated Branch Administrator Lifecycle Management

- [x] Implement prerequisite gatekeeper in `EmployeeRosterPage.tsx`:
  - [x] If 0 branches exist in database, display locked card directing admin to `/admin/workspace-setup`.
  - [x] If branches exist, unlock the branch administrator management table.
- [x] Streamline employee roster: remove "All Employees Directory" tab and convert page to dedicated Branch Administrator console.
- [x] Build `GET /api/roster/branch-admins` in `apps/api/src/routes/roster.routes.ts` returning branches with assigned branch administrators.
- [x] Build `GET /api/roster/branch-admin-template`:
  - [x] Query branches with no assigned administrator (`scopedBranchId not in assignedBranchIds`).
  - [x] Return error if all branches already have administrators assigned.
  - [x] Generate Excel workbook with Navy headers for Branch ID / Name and Yellow inputs for Administrator Name, Email, and Password.
- [x] Build `POST /api/roster/branch-admin-import`:
  - [x] Parse uploaded Excel file and validate branch IDs.
  - [x] Validate emails with RFC 5322 regex `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/`.
  - [x] Hash passwords with bcrypt (cost factor 10) and upsert users with `role: BRANCH_ADMIN`.
  - [x] Log `IMPORT_BRANCH_ADMINS` in audit table.
- [x] Build `POST /api/roster/branch-admin` for manual single-branch administrator assignment.
- [x] Build `PUT /api/roster/branch-admin/:id` for editing administrator details.
- [x] Build `DELETE /api/roster/branch-admin/:id`:
  - [x] Delete user record from database.
  - [x] Log `REVOKE_BRANCH_ADMIN` in audit table.
  - [x] Return confirmation message.
- [x] Implement instant state rollback in `EmployeeRosterPage.tsx`:
  - [x] Re-fetch branch list upon deletion, reverting row to `Pending Assignment`, `—`, amber badge, and `+ Assign` button.
- [x] Neutralize Google Chrome data breach leak alerts:
  - [x] Replace modal `<form>` with a `<div>` container.
  - [x] Set `autoComplete="new-password"` and `data-lpignore="true"`.
  - [x] Name password field `name="provision_access_credential"`.
  - [x] Mask password with `style={{ WebkitTextSecurity: showPassword ? 'none' : 'disc' }}` and provide interactive eye toggle (`Eye`/`EyeOff`).
- [x] Conceal Branch IDs: hide raw branch codes in all roster tables and modals, displaying only clean branch names.

---

## 8. Dynamic White-Label Brand Theming & Luminance Contrast Engine

- [x] Implement relative luminance calculation function `isColorDark(hex)`:
  - [x] Parse RGB components from hex string.
  - [x] Compute $Y = 0.299 \times R + 0.587 \times G + 0.114 \times B$.
  - [x] Return `true` if $Y < 145$, `false` if $Y \ge 145$.
- [x] Update `Header.tsx` in `apps/web/src/components/layout/Header.tsx`:
  - [x] Set header background to dynamic `style={{ backgroundColor: orgColor }}`.
  - [x] If dark theme: apply `text-white`, `text-white/80`, and `bg-white/20 text-white border-white/30`.
  - [x] If light theme: apply `text-slate-950`, `text-slate-700`, and `bg-black/10 text-slate-900 border-black/20`.
- [x] Update `OrganizationAdminDashboard.tsx` in `apps/web/src/components/dashboard/OrganizationAdminDashboard.tsx`:
  - [x] Replace static green welcome banner with dynamic `style={{ backgroundColor: orgColor }}`.
  - [x] Automatically toggle welcome banner text, subtitle, and badge contrast based on `isColorDark(orgColor)`.
- [x] Build Brand Settings page in `apps/web/src/pages/admin/BrandSettingsPage.tsx`:
  - [x] Provide HTML color picker input and hex text input.
  - [x] Provide logo URL input and organization rename input.
  - [x] Connect save action to `PATCH /api/organizations/:id/branding`.

---

## 9. Facility Capacity KPI Summary Cards & Navigation UX

- [x] Implement facility KPI calculation in `OrganizationAdminDashboard.tsx`:
  - [x] Fetch `/api/workspace/hierarchy` on component mount.
  - [x] Sum total branches and total corporate buildings.
  - [x] Sum total workstations across all sections.
  - [x] Sum total HDMI workstations (`hasHdmi === true`).
  - [x] Sum total meeting rooms and aggregate seating capacity.
- [x] Render 4 responsive facility KPI summary cards above workspace launch section:
  - [x] Card 1: *Branches & Campuses* (e.g. `2 Branches • 3 Corporate Buildings`).
  - [x] Card 2: *Total Workstations* (e.g. `144 Desks`).
  - [x] Card 3: *HDMI Workstations* (e.g. `48 HDMI Display Desks`).
  - [x] Card 4: *Meeting Rooms & Capacity* (e.g. `6 Rooms • 48 Total Seats`).
- [x] Build collapsible sidebar navigation in `apps/web/src/components/layout/Sidebar.tsx`:
  - [x] Add hamburger toggle button (`Menu` / `ChevronLeft`) in sidebar header.
  - [x] Support expanded state (`w-64`) with full navigation labels and icons.
  - [x] Support collapsed state (`w-20`) with centered icons and hover tooltips.
  - [x] Add smooth transition animation (`transition-all duration-300`).

---

## 10. Audit Logging & Security Subsystem

- [x] Implement audit log creation across all administrative and operational mutations:
  - [x] `CREATE_ORGANIZATION` on self-service signup or platform admin creation.
  - [x] `DELETE_ORGANIZATION` on platform admin cascade deletion.
  - [x] `UPDATE_BRANDING` on theme or logo updates.
  - [x] `IMPORT_WORKSPACE_FLOORPLAN` on successful spreadsheet ingestion.
  - [x] `BOOK_DESK` on workstation reservation.
  - [x] `CANCEL_BOOKING` on workstation reservation cancellation.
  - [x] `ASSIGN_BRANCH_ADMIN` on manual branch assignment.
  - [x] `IMPORT_BRANCH_ADMINS` on Excel roster import.
  - [x] `REVOKE_BRANCH_ADMIN` on branch administrator deletion.
- [x] Build `GET /api/audit` in `apps/api/src/routes/audit.routes.ts` with pagination and search.
- [x] Build `AuditLogsPage.tsx` in `apps/web/src/pages/admin/AuditLogsPage.tsx` displaying searchable table, timestamps, actor information, and JSON metadata viewer.
- [x] Configure Helmet security headers and Express rate limiting (500 req / 15 min) in `server.ts`.

---

## 11. System Hardening, Startup Automation & End-to-End Verification

- [x] Resolve Windows Vite proxy `ECONNREFUSED` startup race condition:
  - [x] Bind Vite proxy target to direct IPv4 address `http://127.0.0.1:4000` in `vite.config.ts`.
  - [x] Add proxy error listener intercepting `ECONNREFUSED` and returning HTTP 503 JSON payload.
  - [x] Implement native PowerShell TCP socket polling loop in `run.bat` that verifies port 4000 is accepting connections before launching Google Chrome.
- [x] Implement automated 5-stage batch script in `run.bat`:
  - [x] `[1/5]` Verify and start PostgreSQL database on port 5432.
  - [x] `[2/5]` Verify and kill lingering background tasks on ports 3000 and 4000.
  - [x] `[3/5]` Install PNPM workspace dependencies.
  - [x] `[4/5]` Generate Prisma client, push database schema, and seed credentials.
  - [x] `[5/5]` Start API and Web servers in parallel and auto-launch Google Chrome.
- [x] Move production master workbook to `templates/Workspace_FloorPlan_Template.xlsx` and remove scratch diagnostic files.
- [x] Verify full end-to-end integration across all roles: Platform Admin login, organization deletion cascade, self-service tenant signup, 5-sheet workspace upload, red error feedback, NO-SVG 2D floor plan rendering, desk booking drawer, branch admin lifecycle, dynamic branding, and audit trails.
