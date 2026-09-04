# Multi-Tenant Desk Booking & SaaS Control Plane

An enterprise-grade, multi-tenant desk booking and facility management platform engineered with robust subdomain tenant isolation, a cascading 5-sheet Excel workspace ingestion pipeline, and an interactive 2D architectural floor plan explorer built under a **strict NO-SVG mandate** using Pure React, semantic HTML5 elements, and Tailwind CSS.

---

## 🚀 Key Highlights & Architecture

### 1. Multi-Tenant SaaS Isolation & Platform Administration
* **Unified Platform Administrator Console (`system` subdomain):** Global superadmin dashboard (`/`) to provision enterprise tenant organizations, manage subdomain routing, search active tenants, inspect registration audit trails, and manage the full tenant lifecycle directly from a consolidated interface.
* **Tenant Organization Deletion & Cascade Purge (`DELETE /api/organizations/:id`):**
  * Platform Administrators have one-click deletion access to decommission tenant organizations created by Organization Administrators.
  * **Atomic Database Purge:** Executes an atomic `prisma.$transaction` that cascades deletion across all child resources: bookings, meeting rooms, cubicle desks, floor sections, building floors, corporate buildings, physical office branches, employee users, and tenant-scoped audit logs.
  * **System Tenant Safeguard:** The primary `system` platform administration organization is permanently locked against deletion to prevent accidental console lockout.
  * **Destruction Warning Modal:** High-visibility confirmation dialog detailing the irreversible destruction of all facility layouts and user rosters before execution.
* **Global Organization Administrator:** Tenant-level control plane to ingest corporate physical infrastructure, manage employee rosters, configure dynamic brand themes, and review tenant-specific audit trails.

### 2. Cascading 5-Sheet Excel Workspace Ingestion Engine
* **Template Generation:** Pre-filled with active tenant credentials via `GET /api/workspace/template` served directly from `templates/Workspace_FloorPlan_Template.xlsx` using in-place `JSZip` XML injection.
* **Case-Insensitive Conditional Formatting & Auto-Lockout:**
  * In Sheet 5 (`Sections & Cubicles`), Columns H & I (*Meeting Room Capacity* & *Meeting Room HDMI*) utilize case-insensitive, trimmed, and row-anchored formulas: `=UPPER(TRIM(INDIRECT("G" & ROW())))="YES"`.
  * Cells turn muted gray (`#E2E8F0`) with native Excel data validation lockouts if Meeting Room is `"No"`, lowercase `"no"`, or blank. When set to `"Yes"` (or `"YES"` / `"yes"`), cells unlock and illuminate in bright yellow (`#FFF2CC`).
  * In-sheet HDMI validation guarantees HDMI workstations never exceed total cubicles.
* **Stateful Grouped Parser:** Resolves "Show Once per Group" branches and buildings, validating counts, types, and constraints.
* **Sheet-Specific Red Error Feedback:** If an invalid spreadsheet is uploaded, the parser injects a bright red **`ERRORS & FIXES`** column **ONLY** into the sheets containing errors, detailing exact row-by-row descriptions for instant re-download and rectification.
* **Atomic Transaction:** Saves Branches, Buildings, Floors, Sections, Desks (`C-01`, `C-02`...), and Meeting Rooms in a single PostgreSQL `prisma.$transaction`.

### 3. Interactive 2D Floor Plan Explorer (STRICT NO-SVG Mandate)
* **Zero-SVG Architecture:** Entirely constructed using standard HTML5 `<div>` elements, CSS Grid, and Flexbox (strictly no `<svg>`, `<path>`, or vector graphics).
* **Sanitized Selectors (Zero Database IDs):** Branch, Building, and Floor dropdowns display exclusively human-readable names (`Pune`, `Bhaskar`, `Floor 1`, `Floor 2`), stripping away all database IDs (`BR001`, `BLD001`, `1-FL01`) from the user interface.
* **Atomic 4-Desk Pod Clusters:** Desks are grouped into ergonomic pods of 4 (2 top cubicles facing 2 bottom cubicles with curved corners `rounded-xl`).
* **Column-Wise Placement Order:**
  * **Cluster 1 (Desks 1–4):** Top-Left (Row 0, Col 0)
  * **Cluster 3 (Desks 5–8):** Bottom-Left (Row 1, Col 0)
  * **Cluster 2 (Desks 9–12):** Top-Right (Row 0, Col 1)
  * **Cluster 4 (Desks 13–16):** Bottom-Right (Row 1, Col 1)
  * **Cluster 5 & 6:** Column 2 (Top & Bottom)
  * New clusters expand rightward column-by-column as cubicle counts increase.
* **Symmetrical Round-Robin HDMI Distribution:** HDMI displays are balanced across active pods rather than clustered in the first pod. Within each pod, HDMI badges are positioned diagonally/symmetrically.
* **Dynamic Auto-Zoom & Sizing:** Pod dimensions automatically scale down for 3–4 columns ($24–32+$ desks) to remain perfectly contained within the outer boundary walls without overflow.
* **Small Section Centering:** Sections with $\le 8$ desks are centered symmetrically to prevent empty void spaces.
* **Interactive Slide-Over Drawer:** Click any cubicle to view real-time specifications and reserve/release desks.

### 4. Dedicated Branch Administrator Lifecycle & Security
* **Prerequisite Gatekeeper:** If zero branches exist in the database, the roster page displays an educational locked card pointing the administrator to the workspace setup ingestion pipeline.
* **Dedicated Branch Administrator Table:** Single-purpose console dedicated exclusively to branch administrators (general employee directory removed).
* **Deletion & Instant State Rollback (`DELETE /api/roster/branch-admin/:id`):**
  * Deleting an assigned administrator removes the user account, audit logs the revocation, and immediately rolls back the branch row to its unassigned state (`Pending Assignment`, `—`, `Pending`, `+ Assign` button).
* **Unassigned-Only Template Filtering:** `GET /api/roster/branch-admin-template` dynamically filters out already-assigned branches, pre-filling only unassigned locations in downloaded Excel templates.
* **Google Chrome Data Breach Alert Neutralization:**
  * Assignment modal uses non-form React containers, bypassing browser credential interceptors that trigger false-positive leak warnings.
  * Masks initial password via CSS `WebkitTextSecurity: disc` with an interactive eye toggle (`Eye` / `EyeOff`) to view or verify credentials before assignment.
* **Strict Branch ID Concealment:** In tables, modals, cards, and dropdowns, **Branch IDs are strictly hidden**; only clean Branch Names are displayed.

### 5. Facility Capacity KPI Summary Cards & Dashboard Theming
* **Real-Time Facility Metrics:** 4 summary tiles at the top of the Organization Admin Dashboard computed from `/api/workspace/hierarchy`:
  1. *Branches & Campuses*
  2. *Workstations*
  3. *HDMI Desks*
  4. *Meeting Rooms & Capacity*
* **Dynamic White-Label Brand Theming with Intelligent Contrast:**
  * The topmost navigation bar and dashboard welcome banner dynamically adapt to the organization's selected theme color.
  * **Automated Luminance Calculation:**
    $$Y = 0.299 \times R + 0.587 \times G + 0.114 \times B$$
    * **Dark Themes ($Y < 145$):** Switches text, badges, and icons to crisp white and translucent white containers.
    * **Light Themes ($Y \ge 145$):** Switches text, badges, and icons to crisp dark slate and translucent black containers.

### 6. Collapsible Navigation Sidebar
* Hamburger toggle button at the top of the Sidebar collapses the navigation rail from `w-64` to a sleek `w-20` icon strip with tooltips on hover.
* Expands horizontal viewing real estate up to `1600px` for optimal floor plan inspection.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Monorepo** | PNPM Workspaces |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide React, TanStack Query |
| **Backend API** | Node.js, Express, TypeScript, Prisma ORM, ExcelJS, Multer, Bcrypt, JWT |
| **Database** | PostgreSQL (Dockerized or Native Local) |
| **Shared Lib** | `@deskbooking/shared` (Strict TypeScript interfaces, DTOs, and Enums) |

---

## 📂 Project Structure

```
MultiTenant OfflineFirst DeskBooking/
├── apps/
│   ├── api/                     # Express REST API Server
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # Data models (Org, Branch, Building, Floor, Section, Desk, Booking)
│   │   │   └── seed.ts          # Idempotent seeding script
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── auth.routes.ts          # Authentication & Registration
│   │       │   ├── organizations.routes.ts # Org CRUD, Delete Cascade, Branding
│   │       │   ├── roster.routes.ts        # Dedicated Branch Admin management & deletion rollback
│   │       │   ├── workspace.routes.ts     # Template generation, Excel import, hierarchy & booking
│   │       │   └── ...
│   │       ├── services/
│   │       │   └── excel.service.ts        # Dynamic JSZip template generator & multi-sheet validator
│   │       └── server.ts
│   └── web/                     # React + Vite Frontend Application
│       └── src/
│           ├── components/
│           │   ├── dashboard/   # Platform Admin (with Delete Cascade) & Org Admin Dashboards
│           │   └── layout/      # Navbar (Dynamic Contrast), Collapsible Sidebar, Layout
│           └── pages/
│               ├── admin/
│               │   ├── WorkspaceSetupPage.tsx   # Top result banner, Action Hub & 4-step simulation
│               │   ├── FloorPlansPage.tsx       # Strict NO-SVG floor plans (sanitized names, no IDs)
│               │   ├── EmployeeRosterPage.tsx   # Branch Admin lifecycle, eye toggle & Chrome breach fix
│               │   └── ...
│               └── auth/
├── packages/
│   └── shared/                  # Shared TypeScript types, DTOs, and enums (@deskbooking/shared)
├── templates/
│   └── Workspace_FloorPlan_Template.xlsx # Master 5-sheet cascading workbook template
├── docker-compose.yml           # PostgreSQL database service definition
├── run.bat                      # 1-click startup script (auto-launches in Google Chrome)
└── README.md
```

---

## ⚡ Quick Start Guide

### 1. Prerequisites
* **Node.js**: v18 or v20+
* **PNPM**: Installed globally (`npm i -g pnpm`)
* **Google Chrome**: Recommended browser for automated launch
* **Docker Desktop** (Optional, or native PostgreSQL running on port 5432)

### 2. Launch with One-Click Script
Run the automated batch script:
```cmd
.\run.bat
```

The script executes 5 sequential stages:
1. `[1/5]` Verifying & starting PostgreSQL on port 5432.
2. `[2/5]` Verifying and cleaning port allocations (Ports 3000 & 4000).
3. `[3/5]` Installing PNPM workspace dependencies across all monorepo packages.
4. `[4/5]` Generating Prisma client, pushing database schema, and seeding credentials.
5. `[5/5]` Starting Backend API (`http://localhost:4000`) and Vite Web Portal (`http://localhost:3000`), automatically opening the web portal in a new **Google Chrome** tab as soon as the servers are ready.

---

## 🔑 Default Credentials

| Persona | Subdomain | Email | Password | Role |
|---|---|---|---|---|
| **Platform Administrator** | `system` | `admin@deskbooking.com` | `DeskBook$2026#SecureOps!X9` | `PLATFORM_ADMIN` |
| **Organization Administrator** | Custom | Created via `/signup` | User-defined | `ORGANIZATION_ADMIN` |

> [!NOTE]
> The platform admin default password uses a high-entropy passphrase to ensure full compatibility with modern browser credential managers (preventing Google Chrome breach alerts).

---

## 📊 The 5-Sheet Ingestion Structure

| Sheet | Purpose | Key Columns |
|---|---|---|
| **1. Organization** | Pre-filled Organization Metadata | `Organization ID`, `Organization Name`, `Number of Branches` |
| **2. Branches** | Regional Office Branches | `Branch ID` (`BR001`), `Branch Name`, `Number of Buildings` |
| **3. Buildings** | Corporate Campuses & Towers | `Branch Name` (Show Once), `Building ID` (`BLD001`), `Building Name`, `Number of Floors` |
| **4. Floors** | Vertical Floor Levels | `Building ID`, `Floor ID` (`1-FL01`, `2-FL01`), `Floor Name`, `Number of Sections` (Max 4) |
| **5. Sections & Cubicles** | Floor Layout & Workstation Specs | `Floor ID`, `Section Direction`, `Number of Cubicles`, `HDMI Cubicles`, `Meeting Room (Yes/No)`, `Meeting Room Capacity`, `Meeting Room HDMI` |
