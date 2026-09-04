# AGENTS.md

Welcome to the **Multi-Tenant Desk Booking & SaaS Control Plane** repository. This document is the primary operational, behavioral, and architectural guide for AI agents and human developers contributing to this codebase.

---

## 1. System Overview & Core Philosophy

This platform is an enterprise multi-tenant desk booking, facility management, and SaaS control plane engineered with:
1. **Subdomain Multi-Tenancy:** Strict tenant isolation driven by database foreign keys (`organizationId`), Express subdomain middleware (`tenantMiddleware`), and header fallbacks (`x-tenant-subdomain`).
2. **Cascading 5-Sheet Excel Ingestion:** A streamlined ingestion pipeline allowing Organization Admins to ingest branches, buildings, floors, sections, cubicle desks, and meeting rooms via a single workbook (`templates/Workspace_FloorPlan_Template.xlsx`).
3. **Strict NO-SVG Architectural 2D Floor Plan Engine:** An interactive architectural floor plan viewer built entirely using Pure React, semantic HTML5 `<div>` elements, CSS Grid, and Tailwind CSS. Zero vector graphic elements (`<svg>`, `<path>`, `<circle>`, `<polygon>`) are permitted.
4. **Dedicated Branch Administrator Lifecycle:** Single-purpose console for physical branch assignments with instant rollback on deletion (`DELETE /api/roster/branch-admin/:id`) and Google Chrome credential breach warning neutralization.
5. **Dynamic White-Label Brand Theming:** Perceived luminance contrast calculation ($Y = 0.299R + 0.587G + 0.114B$, threshold $145$) that automatically sets navbar and dashboard banner text/badges to light or dark.

---

## 2. Monorepo Structure & Package Layout

This repository is organized as a **PNPM Workspace** monorepo:

```
MultiTenant OfflineFirst DeskBooking/
├── apps/
│   ├── api/                              # Backend REST API (Node.js, Express, TypeScript, Prisma)
│   │   ├── prisma/
│   │   │   ├── schema.prisma             # PostgreSQL schema (Org, Branch, Building, Floor, Section, Desk, User, Booking, AuditLog)
│   │   │   └── seed.ts                   # Idempotent database seeder with high-entropy credentials
│   │   ├── src/
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts    # JWT verification & requireRole() RBAC guards
│   │   │   │   └── tenant.middleware.ts  # Extracts tenant from subdomain, x-tenant-subdomain, or query param
│   │   │   ├── routes/
│   │   │   │   ├── audit.routes.ts       # GET /api/audit (searchable audit trails)
│   │   │   │   ├── auth.routes.ts        # POST /api/auth/login, signup, me, change-password, organizations
│   │   │   │   ├── branches.routes.ts    # GET, PUT, DELETE /api/branches (manual creation retired)
│   │   │   │   ├── buildings.routes.ts   # GET /api/buildings
│   │   │   │   ├── organizations.routes.ts # GET, POST, DELETE /api/organizations, PATCH /:id/branding
│   │   │   │   ├── roster.routes.ts      # Branch Admin CRUD, unassigned template generation & bulk import
│   │   │   │   └── workspace.routes.ts   # GET /template, POST /import, GET /hierarchy, POST /book-desk, cancel-booking
│   │   │   ├── services/
│   │   │   │   └── excel.service.ts      # JSZip in-place XML template injector & 5-sheet validator
│   │   │   ├── prisma.ts                 # PrismaClient singleton instance
│   │   │   └── server.ts                 # Express initialization, helmet, rate-limiting, route mounting
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                              # Frontend Application (React 18, Vite, TypeScript, Tailwind CSS)
│       ├── src/
│       │   ├── components/
│       │   │   ├── common/Toast.tsx
│       │   │   ├── dashboard/
│       │   │   │   ├── OrganizationAdminDashboard.tsx # 4 Facility KPI cards & dynamic contrast banner
│       │   │   │   └── PlatformAdminDashboard.tsx     # Tenant management & atomic cascade deletion modal
│       │   │   └── layout/
│       │   │       ├── AppLayout.tsx     # Shell layout combining Header, Sidebar, and Toast container
│       │   │       ├── Header.tsx        # Top navbar with dynamic background & luminance contrast
│       │   │       └── Sidebar.tsx       # Collapsible navigation rail (w-64 to w-20 with hamburger toggle)
│       │   ├── context/
│       │   │   ├── AuthContext.tsx       # User session state, token persistence, login/logout
│       │   │   └── TenantContext.tsx     # Active organization, subdomain resolution, branding state
│       │   ├── pages/
│       │   │   ├── admin/
│       │   │   │   ├── AuditLogsPage.tsx        # System audit log viewer with metadata inspector
│       │   │   │   ├── BrandSettingsPage.tsx    # Live color picker, logo URL, organization renaming
│       │   │   │   ├── CreateBranchPage.tsx     # Legacy redirect / warning
│       │   │   │   ├── EmployeeRosterPage.tsx   # Dedicated Branch Admin lifecycle & eye password toggle
│       │   │   │   ├── FloorPlansPage.tsx       # Strict NO-SVG 2D Floor Plan Explorer & booking drawer
│       │   │   │   └── WorkspaceSetupPage.tsx   # Action Hub, template download, import & error feedback
│       │   │   └── auth/
│       │   │       ├── ChangePasswordPage.tsx
│       │   │       ├── LoginPage.tsx
│       │   │       └── SignupPage.tsx
│       │   ├── services/api.ts           # Centralized fetch wrapper with JWT & tenant header injection
│       │   ├── App.tsx                   # React Router DOM v6 route table & ProtectedRoute wrapper
│       │   ├── main.tsx                  # React DOM entry point
│       │   └── index.css                 # Tailwind CSS directives
│       ├── package.json
│       ├── vite.config.ts                # Vite config with IPv4 proxy to http://127.0.0.1:4000
│       └── tsconfig.json
├── packages/
│   └── shared/                           # Shared library package (@deskbooking/shared)
│       ├── src/
│       │   └── index.ts                  # Role enum, DTO interfaces (Organization, Branch, Desk, etc.)
│       ├── package.json
│       └── tsconfig.json
├── templates/
│   └── Workspace_FloorPlan_Template.xlsx # Master 5-sheet cascading workbook template
├── docker-compose.yml                    # PostgreSQL 15 database container definition
├── run.bat                               # Automated 5-stage startup batch script
├── package.json                          # Monorepo root scripts & pnpm configuration
└── pnpm-workspace.yaml                   # Monorepo workspace configuration
```

---

## 3. Technology Stack & Key Dependencies

| Domain | Technology / Library | Version / Details | Purpose |
|---|---|---|---|
| **Package Manager** | PNPM Workspaces | `^8.x / ^9.x` | Monorepo dependency management and package filtering |
| **Runtime** | Node.js | `>= 18.x` (Recommended: v20 LTS) | Server-side JavaScript runtime |
| **Backend Framework**| Express | `^4.18.2` | REST API routing and middleware execution |
| **Language** | TypeScript | `^5.3.3` | End-to-end static type safety |
| **Database ORM** | Prisma | `^5.9.1` | PostgreSQL schema modeling, migrations, client generation |
| **Database** | PostgreSQL | `15-alpine` | Relational persistent store (port `5432`) |
| **Excel Ingestion** | ExcelJS (`^4.4.0`) + JSZip (`^3.10.1`) | High-speed processing | Non-destructive template serving & multi-sheet parsing |
| **File Upload** | Multer | `^1.4.5-lts.1` | In-memory buffer upload handling (10MB limit) |
| **Auth & Security** | JWT (`jsonwebtoken ^9.0.2`), Bcrypt (`bcryptjs ^2.4.3`), Helmet (`^7.1.0`), Express Rate Limit (`^7.1.5`) | Standard suite | Authentication, password hashing, security headers, DDoS throttling |
| **Frontend Framework**| React | `^18.2.0` | Declarative UI rendering |
| **Build Tool** | Vite | `^5.1.0` | Ultra-fast HMR and frontend bundling |
| **Routing** | React Router DOM | `^6.22.0` | Client-side routing with guarded layouts |
| **Styling** | Tailwind CSS | `^3.4.1` | Utility-first styling, responsive grids, custom palettes |
| **Icons** | Lucide React | `^0.330.0` | Semantic UI icons (strictly non-floorplan UI elements) |

---

## 4. Environment Variables & Ports

### Port Allocations
* **PostgreSQL:** Port `5432` (`localhost:5432`)
* **Backend API:** Port `4000` (`http://localhost:4000` or `http://127.0.0.1:4000`)
* **Frontend Web:** Port `3000` (`http://localhost:3000`)

### Environment Configuration (`.env` in root)
```env
# API Server Configuration
PORT=4000

# Database Configuration (PostgreSQL + Prisma)
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/deskbooking_db?schema=public"
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgrespassword
POSTGRES_DB=deskbooking_db
POSTGRES_PORT=5432

# Authentication (JWT)
JWT_SECRET="super-secret-jwt-key-for-multi-tenant-desk-booking-saas"
JWT_EXPIRES_IN="7d"

# Frontend Configuration
VITE_API_BASE_URL="http://localhost:4000/api"
```

---

## 5. Standard Run, Test, and Lifecycle Commands

All commands are executed from the monorepo root:

### Automated 1-Click Launch
```cmd
.\run.bat
```
The automated batch script executes 5 sequential stages:
1. `[1/5]` Verifies/starts PostgreSQL on port `5432` (via Docker Desktop or native service).
2. `[2/5]` Kills lingering background processes on ports `3000` and `4000`.
3. `[3/5]` Runs `pnpm install` across all workspaces.
4. `[4/5]` Runs `pnpm db:generate`, `pnpm db:push`, and `pnpm db:seed`.
5. `[5/5]` Starts parallel development servers and runs a native PowerShell TCP socket polling loop that automatically opens `http://localhost:3000` in Google Chrome as soon as port `4000` is accepting connections.

### Manual Granular Commands
* **Install dependencies:**
  ```bash
  pnpm install
  ```
* **Start both API and Web concurrently:**
  ```bash
  pnpm dev
  ```
* **Start API only:**
  ```bash
  pnpm dev:api
  ```
* **Start Web only:**
  ```bash
  pnpm dev:web
  ```
* **Build all packages:**
  ```bash
  pnpm build
  ```
* **Database Management:**
  ```bash
  pnpm db:up        # docker compose up -d postgres
  pnpm db:down      # docker compose down
  pnpm db:generate  # pnpm --filter api run prisma:generate
  pnpm db:push      # pnpm --filter api run prisma:push
  pnpm db:seed      # pnpm --filter api run prisma:seed
  ```

---

## 6. Seed Credentials & Personas

| Persona | Subdomain | Email | Password | Role |
|---|---|---|---|---|
| **Platform Administrator** | `system` | `admin@deskbooking.com` | `DeskBook$2026#SecureOps!X9` | `PLATFORM_ADMIN` |
| **Organization Administrator** | User-defined | Created via `/signup` | User-defined | `ORGANIZATION_ADMIN` |
| **Branch Administrator** | Assigned | Set in Roster modal / Excel | User-defined (default: `DeskBook$2026#BranchOps`) | `BRANCH_ADMIN` |

> [!IMPORTANT]
> The platform admin password uses a high-entropy passphrase (`DeskBook$2026#SecureOps!X9`) to ensure modern browser credential managers (Google Password Manager) do not display false-positive "data breach compromised password" alerts.

---

## 7. Strict Architectural Invariants & Rules for Agents

When creating, updating, or debugging code in this repository, agents MUST respect the following non-negotiable architectural rules:

### A. STRICT NO-SVG Mandate in Floor Plans
* **Rule:** Under NO circumstances may `<svg>`, `<path>`, `<circle>`, `<rect>`, `<polygon>`, or SVG-based graphics libraries be introduced into [`FloorPlansPage.tsx`](file:///apps/web/src/pages/admin/FloorPlansPage.tsx) or any floor plan visualization component.
* **Implementation:** All walls, corridors, pod clusters, cubicle desks, and meeting rooms must be constructed exclusively from standard HTML5 `<div>` and `<button>` elements styled with Tailwind CSS (`border-4`, `rounded-xl`, `grid`, `flex`).
* **Icons:** Lucide icons are strictly confined to general navigation and standard UI action buttons. They must never be embedded inside architectural floor plan layouts.

### B. Sanitized Selectors (Zero Database IDs in UI)
* **Rule:** Dropdowns and user-facing selector controls must NEVER display raw database identifiers or primary key codes (`BR001`, `BLD001`, `1-FL01`).
* **Implementation:** Always format labels to show human-readable names only (`Pune`, `Bhaskar`, `Floor 1`). Use `formatFloorDisplayName()` to format floor levels cleanly.

### C. Non-Destructive In-Place ExcelJS / JSZip Template Serving
* **Rule:** When serving `templates/Workspace_FloorPlan_Template.xlsx` via `GET /api/workspace/template`, do NOT load and save the entire workbook with `ExcelJS`.
* **Reason:** `ExcelJS`'s internal serializer sorts cell addresses alphabetically (`"H10"` before `"H2"`), corrupting OpenXML DataValidation ranges and causing relative formula coordinate shifts.
* **Implementation:** Use `JSZip` to update ONLY cells `A5` and `B5` inside `xl/worksheets/sheet1.xml`, streaming the archive byte-for-byte intact.

### D. Dynamic Row-Anchoring in Excel Formulas
* **Rule:** All conditional formatting and data validation formulas inside `Workspace_FloorPlan_Template.xlsx` must utilize dynamic row anchoring:
  * Column H: `=UPPER(TRIM(INDIRECT("G" & ROW())))="YES"`
  * Column I: `=AND(UPPER(TRIM(INDIRECT("G" & ROW())))="YES", INDIRECT("I" & ROW())<=INDIRECT("H" & ROW()))`
  * Column F: `=INDIRECT("F" & ROW())<=INDIRECT("E" & ROW())`
* **Reason:** This completely eliminates case-sensitivity and whitespace bugs (`"yes "` vs `"Yes"`) and prevents Excel coordinate drift.

### E. Atomic Database Transactions & Cascade Purges
* **Rule:** Any operation that deletes or recreates physical infrastructure must execute within an atomic `prisma.$transaction`.
* **Tenant Deletion (`DELETE /api/organizations/:id`):** Must purge bookings $\rightarrow$ meeting rooms $\rightarrow$ desks $\rightarrow$ sections $\rightarrow$ floors $\rightarrow$ buildings $\rightarrow$ branches $\rightarrow$ users $\rightarrow$ audit logs $\rightarrow$ organization. The `system` organization is permanently protected against deletion.
* **Workspace Ingestion (`POST /api/workspace/import`):** Must delete existing branches for the organization before inserting new branches, buildings, floors, sections, desks, and meeting rooms.

### F. Dynamic Luminance Contrast Calculation
* **Rule:** Any component adopting the active organization's brand `themeColor` must dynamically compute perceived brightness:
  $$Y = 0.299 \times R + 0.587 \times G + 0.114 \times B$$
* **If $Y < 145$ (Dark Theme):** Render `text-white`, `text-white/85`, and translucent white container badges `bg-white/20`.
* **If $Y \ge 145$ (Light Theme):** Render `text-slate-950`, `text-slate-800`, and translucent dark container badges `bg-black/10`.

### G. Google Chrome Credential Breach Warning Neutralization
* **Rule:** Admin user provisioning modals in [`EmployeeRosterPage.tsx`](file:///apps/web/src/pages/admin/EmployeeRosterPage.tsx) must NOT wrap inputs in a `<form>` element.
* **Implementation:** Use container `<div>` elements, name credentials `name="provision_access_credential"`, apply `autoComplete="new-password"`, `data-lpignore="true"`, and mask passwords via `style={{ WebkitTextSecurity: showPassword ? 'none' : 'disc' }}` with an eye toggle.
