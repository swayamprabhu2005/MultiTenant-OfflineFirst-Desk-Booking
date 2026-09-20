# Functional Specifications: Multi-Tenant Desk Booking Platform

**Specification Identifier:** `SPEC-FUNC-001`  
**Parent Change:** `2026-09-05-multi-tenant-desk-booking`  
**Status:** Implemented & Verified  

---

## Capability 1: Multi-Tenant Subdomain Control Plane & Platform Administration

### Requirement 1.1: Dynamic Subdomain & Header Tenant Resolution
The system must resolve the requesting organization for every incoming HTTP request without requiring hardcoded route prefixes.
* **Scenario 1.1.1 (Header Resolution):** When a request carries `x-tenant-subdomain: acme`, the middleware matches the database organization record where `subdomain = 'acme'` and binds `req.organizationId` and `req.tenantSubdomain`.
* **Scenario 1.1.2 (Subdomain Resolution):** When a request arrives from host `acme.deskbooking.com`, the middleware parses the hostname prefix `acme` and resolves the tenant.
* **Scenario 1.1.3 (Query Param Resolution):** In development or testing, when a request specifies `?tenant=acme`, the middleware resolves the tenant accordingly.

### Requirement 1.2: Core System Tenant Protection
The root platform administration organization must be permanently locked against destructive actions.
* **Scenario 1.2.1:** When an administrator attempts `DELETE /api/organizations/:id` where `subdomain === 'system'` or `code === 'SYSTEM'`, the system returns HTTP 400 Bad Request with `"Cannot delete the core platform administration organization"`.

### Requirement 1.3: Atomic Cascade Tenant Deletion
Platform administrators must be able to decommission tenant organizations with 100% cascade purge across all child entities.
* **Scenario 1.3.1:** When a valid tenant deletion is requested via `DELETE /api/organizations/:id`, the system executes an atomic `prisma.$transaction` deleting in order:
  1. Bookings (`where: { organizationId: id }`)
  2. Meeting Rooms (`where: { organizationId: id }`)
  3. Desks (`where: { organizationId: id }`)
  4. Sections (`where: { organizationId: id }`)
  5. Floors (`where: { organizationId: id }`)
  6. Buildings (`where: { organizationId: id }`)
  7. Branches (`where: { organizationId: id }`)
  8. Users (`where: { organizationId: id }`)
  9. Audit Logs (`where: { organizationId: id }`)
  10. Organization (`where: { id }`)
* **Scenario 1.3.2:** If any step in the cascade fails, the entire transaction rolls back cleanly, leaving 0 partially deleted records.

---

## Capability 2: Cascading 5-Sheet Excel Workspace Ingestion Engine

### Requirement 2.1: Pre-Filled Template Generation via JSZip In-Place Patching
The system must stream customized Excel templates pre-filled with the active tenant's metadata without corrupting OpenXML DataValidation definitions.
* **Scenario 2.1.1:** When `GET /api/workspace/template` is called, the server loads `templates/Workspace_FloorPlan_Template.xlsx` from disk, uses `JSZip` to update cells `A5` (Organization ID) and `B5` (Organization Name) inside `xl/worksheets/sheet1.xml`, and streams the archive as binary `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
* **Scenario 2.1.2:** Sheets 2 through 5 remain untouched at the binary level, preserving DataValidation ranges (`H2:H401`, `I2:I401`) and conditional formatting byte-for-byte.

### Requirement 2.2: Dynamic Row-Anchored Data Validation & Visual Conditional Formatting
The template must enforce dynamic locking and unlocking of meeting room inputs based on user selection.
* **Scenario 2.2.1 (Locked State):** In Sheet 5 (`Sections & Cubicles`), when Column G (`Meeting Room`) is `"No"`, lowercase `"no"`, or blank, Columns H (Capacity) and I (HDMI) are styled in disabled muted gray (`#E2E8F0`). Entering numbers into Column H triggers an Excel validation warning.
* **Scenario 2.2.2 (Unlocked State):** When Column G is set to `"Yes"` (or `"YES"` / `"yes"`), Columns H and I immediately illuminate in bright yellow (`#FFF2CC`) and allow positive integer input.
* **Scenario 2.2.3 (Formula Anchoring):** Data validation formulas use `=UPPER(TRIM(INDIRECT("G" & ROW())))="YES"`, making validation immune to trailing spaces, letter casing, or cell coordinate shifts.

### Requirement 2.3: In-Sheet Capacity and HDMI Ratio Verification
Workstations and meeting room inputs must strictly enforce hardware bounds.
* **Scenario 2.3.1:** Workstation HDMI count (Col F) must not exceed total cubicles (Col E): `=INDIRECT("F" & ROW())<=INDIRECT("E" & ROW())`.
* **Scenario 2.3.2:** Meeting Room HDMI count (Col I) must not exceed Meeting Room capacity (Col H): `=AND(UPPER(TRIM(INDIRECT("G" & ROW())))="YES", INDIRECT("I" & ROW())<=INDIRECT("H" & ROW()))`.

### Requirement 2.4: Sheet-Specific Red Error Feedback Injection
When an invalid workbook is uploaded, the parser must annotate only the offending sheets.
* **Scenario 2.4.1:** If errors are found during `POST /api/workspace/import`, the database transaction is aborted.
* **Scenario 2.4.2:** The server appends a bright red header **`ERRORS & FIXES`** (`#DC2626`) and light-red highlighted cells (`#FEE2E2`, font `#B91C1C`) only to sheets containing errors. Clean sheets remain untouched.
* **Scenario 2.4.3:** The response returns HTTP 422 with `errorCount`, `errorsSummary`, and `errorWorkbookBase64` allowing one-click download of the annotated spreadsheet.

### Requirement 2.5: Atomic Database Transaction Persistence
When a valid workbook is uploaded, the server must atomically replace the workspace layout.
* **Scenario 2.5.1:** In a single `prisma.$transaction`, the server deletes all existing branches for the tenant, recreates branches $\rightarrow$ buildings $\rightarrow$ floors $\rightarrow$ sections, generates standard desks (`C-01`, `C-02`...), generates meeting rooms, logs `IMPORT_WORKSPACE_FLOORPLAN`, and returns HTTP 200 with aggregate creation statistics.

---

## Capability 3: Strict NO-SVG Architectural 2D Floor Plan Explorer

### Requirement 3.1: Complete Vector Graphic Elimination (Zero-SVG)
The floor plan explorer must render architectural floor plans without SVG.
* **Scenario 3.1.1:** The JSX tree of [`FloorPlansPage.tsx`](file:///apps/web/src/pages/admin/FloorPlansPage.tsx) must not contain any `<svg>`, `<path>`, `<circle>`, `<polygon>`, or vector graphics libraries.
* **Scenario 3.1.2:** Outer structural walls use `border-4 border-slate-900 bg-slate-100/40`, the entrance doorway displays `🚪 ENTRY` with `border-t-0 bg-white`, and meeting rooms use `border-2 border-slate-700 bg-white`.

### Requirement 3.2: Sanitized UI Selectors (Zero Raw Database IDs)
Dropdown menus must display only clean, human-readable labels.
* **Scenario 3.2.1:** The Branch selector renders `{b.name}` (e.g., `Pune`), omitting `(BR001)`.
* **Scenario 3.2.2:** The Building selector renders `{bld.name}` (e.g., `Bhaskar`), omitting `(BLD001)`.
* **Scenario 3.2.3:** The Floor selector renders `formatFloorDisplayName(fl)` (e.g., `Floor 1`, `Floor 2`), omitting `1-FL01 •`.

### Requirement 3.3: 4-Desk Ergonomic Pod Clustering (2x2 Facing Setup)
Workstations must be grouped into ergonomic pods of 4 cubicles.
* **Scenario 3.3.1:** Desks in a section are grouped into pods of 4 (`podClusters`), with 2 top cubicles facing 2 bottom cubicles across an aisle.
* **Scenario 3.3.2:** Cubicles are rendered as rectangular buttons with `rounded-xl`, colored green (`bg-emerald-100/90 border-emerald-400 text-emerald-900`) when available and red (`bg-red-100/90 border-red-300 text-red-800`) when reserved.

### Requirement 3.4: Column-Wise Horizontal Rightward Pod Expansion Order
Pods must populate column-by-column rather than row-by-row.
* **Scenario 3.4.1 (Pods 1–4, $\le 16$ Desks):**
  * Cluster 1: Top-Left (Row 0, Col 0)
  * Cluster 3: Bottom-Left (Row 1, Col 0)
  * Cluster 2: Top-Right (Row 0, Col 1)
  * Cluster 4: Bottom-Right (Row 1, Col 1)
* **Scenario 3.4.2 (Pods $> 4$, $> 16$ Desks):**
  * Cluster 5: Top-Col 2 (Row 0, Col 2)
  * Cluster 6: Bottom-Col 2 (Row 1, Col 2)
  * Additional clusters expand horizontally to the right.

### Requirement 3.5: Symmetrical Round-Robin HDMI Distribution Algorithm
HDMI badges must be evenly distributed across active pods.
* **Scenario 3.5.1:** Let total active pods $P = \lceil N / 4 \rceil$ and total HDMI stations $H$. Each pod $i$ receives $k_i = \lfloor H / P \rfloor + (i < (H \pmod P) ? 1 : 0)$ HDMI desks.
* **Scenario 3.5.2:** When a pod has 2 HDMI desks, slots 0 and 3 receive HDMI, creating a balanced diagonal placement across the team pod.
* **Scenario 3.5.3:** HDMI indicators render as pure HTML badges (`text-[8.5px] font-mono font-bold bg-slate-900 text-emerald-400 px-1 rounded`), with zero vector icons.

### Requirement 3.6: Dynamic Auto-Zoom Containment for Large Sections
Large sections must not overflow outer boundary walls.
* **Scenario 3.6.1:** When `numColumns >= 3` ($24+$ desks), the layout switches to `grid-cols-3` or `grid-cols-4` with compact cubicle heights (`h-13 sm:h-14`) and scaled font sizes (`text-[10px]`), ensuring the floor plan remains contained within viewport boundaries.

### Requirement 3.7: Interactive Workstation Slide-Over Reservation Drawer
Clicking a desk must open a slide-over specification and booking drawer.
* **Scenario 3.7.1:** Clicking any cubicle sets `activeDesk` and opens a slide-over panel showing desk code, section direction, HDMI status, and reservation actions.
* **Scenario 3.7.2:** Clicking "Reserve This Desk" sends `POST /api/workspace/book-desk`, updates desk status to `BOOKED`, writes an audit log, and refreshes the floor plan state.
* **Scenario 3.7.3:** Clicking "Cancel Reservation" sends `POST /api/workspace/cancel-booking` and reverts desk status to `AVAILABLE`.

---

## Capability 4: Dedicated Branch Administrator Lifecycle Management

### Requirement 4.1: Prerequisite Ingestion Gatekeeper
Roster access must be gated on physical infrastructure existence.
* **Scenario 4.1.1:** When an Organization Admin visits `/admin/roster` and the database contains 0 branches for that organization, the page renders a locked card: *"Workspace Configuration Required - Please complete your workspace setup first"* with a direct link to `/admin/workspace-setup`.

### Requirement 4.2: Unassigned-Only Template Generation
Downloaded roster templates must omit already-assigned branches.
* **Scenario 4.2.1:** When `GET /api/roster/branch-admin-template` is requested, the system queries branches with no active `role: BRANCH_ADMIN` user and populates only those branches in the workbook.
* **Scenario 4.2.2:** If all branches have assigned administrators, the endpoint returns HTTP 400 Bad Request explaining that all branches are already staffed.

### Requirement 4.3: Excel Bulk Import & Universal RFC 5322 Email Validation
Bulk uploaded administrators must adhere to enterprise email standards.
* **Scenario 4.3.1:** Uploading an Excel file to `POST /api/roster/branch-admin-import` validates each email against `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/`, permitting custom corporate domains (`user@company.org.uk`), standard providers, and Microsoft 365 domains.
* **Scenario 4.3.2:** Valid rows create users with `role: BRANCH_ADMIN`, `scopedBranchId: branch.id`, and `mustChangePassword: false`.

### Requirement 4.4: Manual Modal Assignment & Google Chrome Data Breach Alert Neutralization
Manual administrator assignment must not trigger browser credential breach popups.
* **Scenario 4.4.1:** The modal in [`EmployeeRosterPage.tsx`](file:///apps/web/src/pages/admin/EmployeeRosterPage.tsx) replaces `<form>` with a `<div>` container and a standard `<button type="button">`.
* **Scenario 4.4.2:** Password inputs use `name="provision_access_credential"`, `autoComplete="new-password"`, `data-lpignore="true"`, and masked text styling `style={{ WebkitTextSecurity: showPassword ? 'none' : 'disc' }}` with an interactive eye toggle.

### Requirement 4.5: Deletion with Instant State Rollback (`DELETE /api/roster/branch-admin/:id`)
Deleting an administrator must immediately roll back the branch status.
* **Scenario 4.5.1:** Sending `DELETE /api/roster/branch-admin/:id` deletes the user record and writes `REVOKE_BRANCH_ADMIN` to `AuditLog`.
* **Scenario 4.5.2:** The branch in the table immediately resets to `Pending Assignment`, with `—` for email, an amber `Pending` badge, and a `+ Assign` button.

---

## Capability 5: Dynamic White-Label Brand Theming & Facility Capacity KPIs

### Requirement 5.1: Relative Luminance Contrast Formulation
The user interface must automatically select optimal contrast for any brand color.
* **Scenario 5.1.1:** Given hex color $R, G, B$, calculate luminance $Y = 0.299R + 0.587G + 0.114B$.
* **Scenario 5.1.2:** If $Y < 145$ (e.g., `#6b21a8` Purple, `#1e3a8a` Navy, `#16a34a` Green), navbar and dashboard banner text render as `text-white` with badges `bg-white/20 text-white border-white/25`.
* **Scenario 5.1.3:** If $Y \ge 145$ (e.g., `#facc15` Yellow, `#fef08a` Cream), navbar and dashboard banner text render as `text-slate-950` with badges `bg-black/10 text-slate-900 border-black/15`.

### Requirement 5.2: Live Real-Time Brand Customization
* **Scenario 5.2.1:** When an admin adjusts the color picker on `/admin/branding` and clicks save, `PATCH /api/organizations/:id/branding` persists `themeColor`. The top navbar and welcome banner reflect the new palette instantly without a full page reload.

### Requirement 5.3: Facility Capacity KPI Metrics Calculation
* **Scenario 5.3.1:** On mount, `OrganizationAdminDashboard.tsx` fetches `/api/workspace/hierarchy` and calculates:
  1. *Branches & Campuses:* Total branches and total corporate buildings.
  2. *Total Workstations:* Total cubicle desks across all floors.
  3. *HDMI Display Stations:* Total desks with `hasHdmi === true`.
  4. *Meeting Rooms & Capacity:* Total conference pods and sum of seating capacities.

---

## Capability 6: Navigation UX & Startup Reliability

### Requirement 6.1: Collapsible Sidebar Navigation
* **Scenario 6.1.1:** Clicking the hamburger button at the top of [`Sidebar.tsx`](file:///apps/web/src/components/layout/Sidebar.tsx) toggles sidebar width between `w-64` (full labels) and `w-20` (icon-only rail with hover tooltips), maximizing the horizontal canvas up to `1600px` for floor plan viewing.

### Requirement 6.2: Vite Reverse Proxy IPv4 Direct Binding
* **Scenario 6.2.1:** `vite.config.ts` proxies `/api` requests to `http://127.0.0.1:4000` directly via IPv4, bypassing Windows IPv6 `::1` resolution delays.
* **Scenario 6.2.2:** During API server startup, if a connection is refused, the proxy intercepts `ECONNREFUSED` and returns HTTP 503 Service Unavailable with a clean JSON payload rather than crashing.

### Requirement 6.3: Native PowerShell TCP Socket Polling in `run.bat`
* **Scenario 6.3.1:** `run.bat` executes a PowerShell TCP socket polling loop against port 4000:
  `powershell -NoProfile -Command "$c = New-Object System.Net.Sockets.TcpClient; while (-not $c.Connected) { try { $c.Connect('127.0.0.1', 4000) } catch { Start-Sleep -Milliseconds 800 } }; $c.Close(); Start-Process 'chrome' 'http://localhost:3000'"`
* **Scenario 6.3.2:** Google Chrome launches only after the backend server has bound to port 4000 and is ready to handle API calls.
