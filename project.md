# project.md - Multi-Tenant Desk Booking & SaaS Control Plane

## 1. Executive Summary & Vision

The **Multi-Tenant Desk Booking & SaaS Control Plane** is an enterprise-grade cloud facility management and workspace orchestration platform. It enables enterprise organizations to administer multi-tenant corporate real estate, dynamically ingest physical infrastructure through a cascading 5-sheet Excel workbook, explore interactive 2D architectural floor plans under a **strict NO-SVG mandate**, and manage dedicated branch administrator rosters with seamless security guardrails.

The platform provides a strict, two-tier administrative hierarchy:
1. **Platform Administrator (`PLATFORM_ADMIN`):** Global superadmin managing tenant onboarding, custom subdomain routing, active tenant directory, tenant lifecycle with atomic cascade purge, and platform-level security audit logs.
2. **Organization Administrator (`ORGANIZATION_ADMIN`):** Tenant-level administrator orchestrating corporate physical layouts through the 5-sheet Excel pipeline, reviewing interactive 2D floor plans, assigning branch administrators, customizing brand themes, and viewing tenant-scoped audit trails.

---

## 2. Core Architectural Pillars

### A. Subdomain Multi-Tenancy & Tenant Isolation
* **Discriminator-Based Multi-Tenancy:** All child resources (branches, buildings, floors, sections, desks, meeting rooms, users, bookings, audit logs) are indexed and secured by the tenant's `organizationId`.
* **Dynamic Subdomain Resolution:** The backend `tenantMiddleware` resolves tenant organizations via incoming HTTP headers (`x-tenant-subdomain`), subdomains (`tenant.deskbooking.com`), or query parameters (`?tenant=subdomain`).
* **Platform System Safeguard:** The primary `system` organization is permanently locked against deletion to prevent accidental lockout from the global control plane.
* **Atomic Cascade Tenant Purge:** Deleting an organization (`DELETE /api/organizations/:id`) triggers an atomic database transaction that cascades deletion through 10 entity layers, leaving zero orphaned records.

### B. Cascading 5-Sheet Excel Ingestion Pipeline
* **Master Workbook (`templates/Workspace_FloorPlan_Template.xlsx`):** Ingests hierarchical corporate real estate in a single upload across 5 connected sheets:
  1. `Organization`: Tenant metadata and branch count.
  2. `Branches`: Regional office branches (`BR001`, `BR002`...).
  3. `Buildings`: Campuses and towers (`BLD001`, `BLD002`...) with "Show Once per Group" visual formatting.
  4. `Floors`: Vertical levels (`1-FL01`, `1-FL02`...) with section counts (maximum 4: North, South, East, West).
  5. `Sections & Cubicles`: Workstation capacities, HDMI counts, and meeting room specifications.
* **Dynamic Row-Anchored Data Validation & Formatting:**
  * Uses case-insensitive, whitespace-tolerant formulas: `=UPPER(TRIM(INDIRECT("G" & ROW())))="YES"`.
  * Meeting room capacity (Col H) and HDMI (Col I) dynamically unlock and highlight yellow (`#FFF2CC`) when Meeting Room is `"Yes"`. When `"No"` or blank, cells are locked and styled in disabled gray (`#E2E8F0`).
  * In-sheet validation guarantees that workstation HDMI $\le$ total cubicles and meeting room HDMI $\le$ meeting room capacity.
* **Non-Destructive In-Place Template Serving:** Utilizes `JSZip` to update only cells `A5` and `B5` inside `xl/worksheets/sheet1.xml`, preventing `ExcelJS` from corrupting or splitting OpenXML validation ranges.
* **Sheet-Specific Red Error Feedback:** If an invalid spreadsheet is uploaded, the parser injects a bright red **`ERRORS & FIXES`** header (`#DC2626`) and row-by-row descriptions (`#FEE2E2`) **ONLY** on sheets containing errors.

### C. Strict NO-SVG Architectural 2D Floor Plan Engine
* **Zero-SVG Architecture:** The architectural floor plan explorer is constructed 100% using Pure React, semantic HTML5 `<div>` and `<button>` elements, CSS Grid, Flexbox, and Tailwind CSS. Absolutely no `<svg>`, `<path>`, `<polygon>`, or vector shapes are permitted.
* **Sanitized Selectors:** User-facing dropdowns display clean human names (`Pune`, `Bhaskar`, `Floor 1`), completely hiding raw database identifiers (`BR001`, `BLD001`, `1-FL01`).
* **Atomic 4-Desk Ergonomic Pod Clusters:** Desks are grouped into ergonomic pods of 4 (2 top cubicles facing 2 bottom cubicles with curved corners `rounded-xl`).
* **Column-Wise Placement Order:**
  * Cluster 1 (Desks 1–4): Top-Left (Row 0, Col 0)
  * Cluster 3 (Desks 5–8): Bottom-Left (Row 1, Col 0)
  * Cluster 2 (Desks 9–12): Top-Right (Row 0, Col 1)
  * Cluster 4 (Desks 13–16): Bottom-Right (Row 1, Col 1)
  * Cluster 5 & 6: Expand rightward into Column 2, and so on.
* **Symmetrical Round-Robin HDMI Distribution:** HDMI displays are distributed evenly across active pods and placed diagonally within pods rather than clustered in the first pod.
* **Dynamic Auto-Zoom Containment:** Pod and cubicle dimensions scale down dynamically (`colGridClass`) for 3–4 columns ($24–32+$ desks) to remain perfectly contained within outer boundary walls without overflow.
* **Interactive Slide-Over Drawer:** Real-time cubicle specification drawer with click-to-book and cancel reservation capabilities.

### D. Dedicated Branch Administrator Lifecycle Management
* **Prerequisite Gatekeeping:** If 0 branches exist in the database, the roster page displays an educational locked card pointing the administrator to the workspace setup ingestion pipeline.
* **Dedicated Console:** Streamlined exclusively for physical branch administrator assignment (extraneous employee directory tabs removed).
* **Deletion & Instant State Rollback (`DELETE /api/roster/branch-admin/:id`):** Deleting an administrator permanently deletes the user account, audit logs the revocation, and immediately rolls back the branch row to its unassigned state (`Pending Assignment`, `—`, `Pending`, `+ Assign` button).
* **Unassigned-Only Template Filtering:** `GET /api/roster/branch-admin-template` dynamically filters out already-assigned branches, pre-filling only unassigned locations in downloaded Excel templates.
* **Google Chrome Data Breach Alert Neutralization:**
  * Modal uses non-form React containers (`<div>`), bypassing browser credential interceptors that trigger false-positive leak warnings.
  * Inputs use `name="provision_access_credential"`, `autoComplete="new-password"`, `data-lpignore="true"`, and masked text styling `style={{ WebkitTextSecurity: showPassword ? 'none' : 'disc' }}` with an interactive eye toggle.

### E. Dynamic White-Label Brand Theming with Intelligent Contrast
* **Dynamic Navbar & Banner Theming:** The top navigation bar and dashboard welcome banner dynamically adapt to the organization's selected brand `themeColor`.
* **Automated Luminance Contrast Formulation:**
  $$Y = 0.299 \times R + 0.587 \times G + 0.114 \times B$$
  * **Dark Themes ($Y < 145$):** Switches text, badges, and icons to crisp white and translucent white containers (`bg-white/20 text-white`).
  * **Light Themes ($Y \ge 145$):** Switches text, badges, and icons to crisp dark slate and translucent black containers (`bg-black/10 text-slate-900`).

### F. Facility Capacity KPI Summary Cards & Navigation UX
* **Real-Time Facility Metrics:** 4 summary tiles on the Organization Admin Dashboard computed from `/api/workspace/hierarchy`:
  1. *Branches & Campuses*
  2. *Total Workstations*
  3. *HDMI Display Desks*
  4. *Meeting Rooms & Seating Capacity*
* **Collapsible Navigation Sidebar:** Hamburger toggle collapses the navigation rail from `w-64` to `w-20` with tooltips on hover, maximizing horizontal real estate up to `1600px` for floor plan inspection.

---

## 3. Technology Stack & Monorepo Topology

| Layer | Technologies |
|---|---|
| **Monorepo Architecture** | PNPM Workspaces (`apps/*`, `packages/*`) |
| **Backend API** | Node.js, Express, TypeScript, Prisma ORM, ExcelJS, JSZip, Multer, Bcrypt, JWT, Helmet |
| **Frontend Web** | React 18, Vite, TypeScript, Tailwind CSS, Lucide React, React Router DOM v6 |
| **Database** | PostgreSQL 15 (Dockerized via Docker Compose or native on port `5432`) |
| **Shared Contracts** | `@deskbooking/shared` (TypeScript interfaces, DTOs, Enums) |

---

## 4. Database Schema (Prisma Models)

```
Organization (1) ───< (N) Branch (1) ───< (N) Building (1) ───< (N) Floor (1) ───< (N) Section
                                                                                         │
                                                    ┌────────────────────────────────────┴──────────────────────────────────┐
                                                    │ (1 : N)                                                               │ (1 : 1)
                                                    ▼                                                                       ▼
                                              Desk / Cubicle                                                           MeetingRoom
                                                    │ (1 : N)
                                                    ▼
                                                 Booking
```

* **Organization:** `id`, `name`, `code` (unique), `subdomain` (unique), `logoUrl`, `themeColor`, `timezone`, `status`, `createdAt`, `updatedAt`.
* **Branch:** `id`, `organizationId`, `name`, `code`, `address`, `status`, `createdAt`, `updatedAt`.
* **Building:** `id`, `organizationId`, `branchId`, `name`, `code`, `address`, `status`, `createdAt`, `updatedAt`.
* **Floor:** `id`, `organizationId`, `buildingId`, `code` (`1-FL01`), `floorNumber`, `name`, `createdAt`, `updatedAt`.
* **Section:** `id`, `organizationId`, `floorId`, `name`, `direction` (`NORTH`, `SOUTH`, `EAST`, `WEST`), `standardDeskCount`, `hdmiDeskCount`, `createdAt`, `updatedAt`.
* **Desk:** `id`, `organizationId`, `sectionId`, `deskCode` (`C-01`), `deskNumber`, `hasHdmi`, `isMeetingRoom`, `status` (`AVAILABLE`, `BOOKED`), `createdAt`, `updatedAt`.
* **MeetingRoom:** `id`, `organizationId`, `sectionId` (unique), `name`, `capacity`, `hasHdmi`, `hdmiCount`, `createdAt`, `updatedAt`.
* **User:** `id`, `organizationId`, `name`, `email` (unique), `passwordHash`, `role` (`PLATFORM_ADMIN`, `ORGANIZATION_ADMIN`, `BRANCH_ADMIN`, `TECH_LEAD`, `EMPLOYEE`), `department`, `baseBranchId`, `scopedBranchId`, `mustChangePassword`, `status`, `createdAt`, `updatedAt`.
* **Booking:** `id`, `organizationId`, `deskId`, `userId`, `startTime`, `endTime`, `status` (`CONFIRMED`, `CANCELLED`), `createdAt`, `updatedAt`.
* **AuditLog:** `id`, `organizationId`, `actorUserId`, `action`, `entityType`, `entityId`, `metadata` (JSON), `createdAt`.

---

## 5. REST API Route Directory

| Method | Endpoint | Access / Role | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticates user; returns JWT, user profile, and tenant metadata |
| `POST` | `/api/auth/signup` | Public | Atomically provisions Organization, Organization Admin, and audit log |
| `GET` | `/api/auth/me` | Authenticated | Returns current authenticated user and organization details |
| `POST` | `/api/auth/change-password` | Authenticated | Updates account password and resets `mustChangePassword: false` |
| `GET` | `/api/auth/organizations` | Public | Returns list of active organizations for tenant selection |
| `GET` | `/api/organizations` | `PLATFORM_ADMIN` / `ORGANIZATION_ADMIN` | Lists all tenants (Platform Admin) or active tenant (Org Admin) |
| `POST` | `/api/organizations` | `PLATFORM_ADMIN` | Creates new tenant organization |
| `PATCH`| `/api/organizations/:id/branding`| `PLATFORM_ADMIN` / `ORGANIZATION_ADMIN` | Updates theme color, logo URL, or organization name |
| `DELETE`| `/api/organizations/:id` | `PLATFORM_ADMIN` | Executes atomic cascade deletion across all 10 entity models |
| `GET` | `/api/workspace/template` | `PLATFORM_ADMIN` / `ORGANIZATION_ADMIN` | Streams pre-filled 5-sheet workbook via in-place JSZip injection |
| `POST` | `/api/workspace/import` | `PLATFORM_ADMIN` / `ORGANIZATION_ADMIN` | Validates 5 sheets; persists hierarchy in atomic transaction or returns error workbook |
| `GET` | `/api/workspace/hierarchy` | Authenticated | Returns full branch $\rightarrow$ building $\rightarrow$ floor $\rightarrow$ section $\rightarrow$ desk tree |
| `POST` | `/api/workspace/book-desk` | Authenticated | Reserves an available cubicle desk |
| `POST` | `/api/workspace/cancel-booking`| Authenticated | Cancels existing confirmed desk reservation |
| `GET` | `/api/roster/branch-admins` | `PLATFORM_ADMIN` / `ORGANIZATION_ADMIN` | Returns all branches with assigned branch administrator details |
| `GET` | `/api/roster/branch-admin-template`| `PLATFORM_ADMIN` / `ORGANIZATION_ADMIN` | Generates Excel template pre-filled with unassigned branches only |
| `POST` | `/api/roster/branch-admin-import` | `PLATFORM_ADMIN` / `ORGANIZATION_ADMIN` | Bulk assigns branch administrators from uploaded spreadsheet |
| `POST` | `/api/roster/branch-admin` | `PLATFORM_ADMIN` / `ORGANIZATION_ADMIN` | Manually assigns administrator to a single branch |
| `PUT` | `/api/roster/branch-admin/:id`| `PLATFORM_ADMIN` / `ORGANIZATION_ADMIN` | Updates branch administrator credentials or assigned location |
| `DELETE`| `/api/roster/branch-admin/:id`| `PLATFORM_ADMIN` / `ORGANIZATION_ADMIN` | Revokes administrator and triggers instant state rollback |
| `GET` | `/api/audit` | Authenticated | Returns searchable, paginated tenant or platform audit trails |
| `GET` | `/api/health` | Public | Health probe returning database and tenant binding status |

---

## 6. Execution & Verification

### Rapid Startup
```cmd
.\run.bat
```
Starts PostgreSQL on port `5432`, cleans port allocations on `3000` and `4000`, installs monorepo dependencies, generates Prisma client, runs schema migrations and seed scripts, starts API (`4000`) and Web (`3000`), and auto-opens Google Chrome as soon as port `4000` is accepting TCP connections.
