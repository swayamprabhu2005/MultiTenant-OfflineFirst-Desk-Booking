# 🏢 Multi-Tenant Offline-First Desk Booking

> An enterprise-grade, multi-tenant SaaS platform for desk booking, facility administration, and workspace orchestration — engineered with strict subdomain isolation, a 5-sheet automated Excel ingestion engine, an interactive 2D architectural floor plan explorer, and a complete employee self-service workplace portal.

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.x-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-4.x-000000?style=flat-square&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=flat-square&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-Monorepo-F69220?style=flat-square&logo=pnpm&logoColor=white)

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    classDef platform fill:#1e1b4b,stroke:#818cf8,stroke-width:2px,color:#ffffff;
    classDef org fill:#075985,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef branch fill:#065f46,stroke:#34d399,stroke-width:2px,color:#ffffff;
    classDef employee fill:#1e293b,stroke:#94a3b8,stroke-width:1.5px,color:#ffffff;
    classDef database fill:#0f172a,stroke:#6366f1,stroke-width:2px,color:#ffffff;

    subgraph Tier1["Tier 1 - Platform Superadmin Control Plane (subdomain: system)"]
        SA["Platform Superadmin\n(admin@deskbooking.com)"]:::platform
        SA -->|"Tenant Provisioning &\nSubdomain Management"| OP["Organization Creation"]:::platform
        SA -->|"Atomic Cascade Purge"| CP["Tenant Cascade Deletion"]:::platform
        SA -->|"Global SaaS Stream"| AL1["Platform Audit Logs"]:::platform
    end

    subgraph Tier2["Tier 2 - Global Organization Admin (e.g. acme.deskbooking.com)"]
        OA["Global Organization Admin"]:::org
        OA -->|"5-Sheet Excel Engine"| WS["Workspace Ingestion"]:::org
        OA -->|"Branch Admin Assignment"| BA_Prov["Branch Admin Management"]:::org
        OA -->|"Multi-Sheet Workforce Hub"| WF["Workforce Directory"]:::org
        OA -->|"Global Architectural View"| FP_Oversight["Floor Plan Oversight (Read-only)"]:::org
    end

    subgraph Tier3["Tier 3 - Branch Administrator (e.g. Goa HQ / Pune HQ)"]
        BA["Branch Administrator\n(Scoped via scopedBranchId)"]:::branch
        BA -->|"Floor Plan Management"| FP_EXP["Floor Plan Editor (Layout Only)"]:::branch
        BA -->|"In-UI Workstation Creation"| ADD_CUB["+ Add Cubicle Modal"]:::branch
        BA -->|"Spatial Workstation Booking"| BA_RES["Reserve Workstation (Floor Plan)"]:::branch
        BA -->|"Calendar Orchestration"| BA_CAL["Outlook Workspace Calendar"]:::branch
        BA -->|"Personal & Proxy History"| BA_BK["My Bookings Hub"]:::branch
        BA -->|"Direct Inline Hub"| PWD_HUB["Default Temporary Password Hub"]:::branch
        BA -->|"3-Column Dynamic Template"| BATCH["Formula Excel Ingestion"]:::branch
        BA -->|"Facility-Scoped Access"| BA_AUDIT["Branch Audit Logs"]:::branch
    end

    subgraph Tier4["Tier 4 - End Users (Employees)"]
        EMP["Staff / Employees"]:::employee
        EMP -->|"Workplace Portal"| DASH["Employee Dashboard"]:::employee
        EMP -->|"Interactive 2D Canvas"| BOOKING["Floor Plan Explorer"]:::employee
        EMP -->|"Team Pod Mode"| BULK["Bulk Pod Reservations"]:::employee
        EMP -->|"Reservation History"| MY_BK["My Bookings History"]:::employee
        EMP -->|"Multi-Day Booking"| MULTIDAY["Multi-Day Availability Matrix"]:::employee
        EMP -->|"Booking Management"| CANCEL["Cancel Selected / Bulk Cancel"]:::employee
    end

    subgraph Storage["SQLite Offline-First Storage Layer"]
        DB[("Multi-Tenant Relational Schema\n- Organization, Branch, Building\n- Floor, Section, Desk, MeetingRoom\n- User, Booking, AuditLog")]:::database
    end

    Tier1 -->|"Provisions Tenant"| Tier2
    Tier2 -->|"Configures Facilities"| Storage
    Tier2 -->|"Assigns Branch Scope"| Tier3
    Tier3 -->|"Provisions Accounts"| Tier4
    Tier3 -->|"Manages Workstations"| Storage
    Tier4 -->|"Books Workstations"| Storage
```

---

## 💎 Core Feature Modules

### 1. 🌐 Multi-Tenant Platform Superadmin Console
- **Unified Superadmin Hub** (`system` subdomain): Aurora Spectrum gradient control plane for `admin@deskbooking.com`.
- **Tenant Lifecycle & Cascade Purge** (`DELETE /api/organizations/:id`): Atomic transaction that purges all child bookings, desks, floors, buildings, branches, employees, and audit logs in one operation.
- **Root System Safeguard**: The `system` organization is permanently immutable — protected against accidental deletion to prevent platform lockout.

---

### 2. 📋 Global Workforce Directory & Multi-Branch Excel Roster Engine
- **Separation of Concerns**: `/admin/roster` manages Branch Admins exclusively; `/admin/workforce` is the cross-branch staff visibility hub with total staff count, search, and pagination.
- **Dynamic Multi-Sheet Excel Generator** (`GET /api/roster/multi-branch-template`):
  - **Sheet 1 (Branches & Counts)**: Auto-lists all active branches with employee counts.
  - **Sheets 2..N (Per Branch)**: Pre-formatted sheets with live email and password column formulas.
- **Bulk Multi-Branch Parser & Upsert** (`POST /api/roster/multi-branch-import`): Atomic transaction parsing across all branch sheets — auto-assigns domain passwords and validates unique corporate emails.
- **Corporate Domain & Password Config**: Configurable per-organization domain and temporary password injected into every branch Excel sheet formula automatically.

---

### 3. 🏗️ Branch Admin Floor Plan Editor & Layout Tools
- **Strict Separation of Concerns**: `/admin/floor-plans` is purely an administrative layout editor and facility manager for Branch Admins and Organization Admins — eliminating conflicting booking overlays from layout management.
- **Branch-Scoped Floor Plan Export & Re-Ingest**:
  - `GET /api/branch-roster/floor-plan-template`: Branch-specific workbook pre-populated with buildings, floors, sections, and workstations.
  - `POST /api/branch-roster/floor-plan-import`: Validates and synchronizes workstation data from spreadsheet uploads.
- **In-UI `+ Add Cubicle` Modal**: Direct workstation creation from the Branch Floor Plans UI with real-time pod recalculation, dynamic zoom adjustment, and symmetrical HDMI redistribution.
- **View-Only Workstation Inspector**: Inspect desk code, amenities (HDMI included), current active reservations, and 7-day occupancy strip without booking form clutter.
- **Dedicated Desk Management**: Direct authority to view and release dedicated executive desk assignments.

---

### 4. 🗺️ Interactive 2D Floor Plan Explorer (Zero-SVG Architecture)
- **Strict No-SVG Mandate**: Built exclusively with semantic HTML5 `<div>` containers, CSS Grid, Flexbox, and Tailwind CSS border-radius — no `<svg>`, `<canvas>`, or vector graphics.
- **Ergonomic 4-Desk Pod Clusters**: Workstations render in facing 2x2 clusters with central circulation aisles and colour-coded availability states.
- **Symmetrical HDMI Distribution**: HDMI badges distributed diagonally across pods.
- **Dynamic Zoom Controls**: Smooth scale zoom transforms (70% to 140%) with responsive recalculation.
- **Colour-Coded Desk States**:
  - 🟢 **Green** — Available for booking
  - 🔵 **Blue** — Booked by the current user
  - 🔴 **Red** — Booked by someone else

---

### 5. 👨‍💼 Employee & Branch Admin Workspace Portal
- **Role-Unified Booking Access**: Both Employees and Branch Admins enjoy full access to Reserve Workstation, Outlook Calendar, and My Bookings.
- **Employee Dashboard** (`/`):
  - Personalized greeting with facility metrics (Total Desks, Available Desks, HDMI Monitors, Meeting Rooms).
  - Active Booking Hero Card with desk code, slot window, location hierarchy, and instant **Release Workstation** action.
- **Workstation Reservation** (`/employee/floor-plan`):
  - **3 Shift Window Slots**: Full Day (09:00–18:00), Morning (09:00–13:30), Afternoon (13:30–18:00).
  - **Whole Meeting Room Booking**: Reserve entire conference rooms with start time, duration in hours & minutes (minimum 15m enforced), title, and attendee headcount.
  - **Workstation Inspector Drawer**: Book for Myself or proxy-book on behalf of a colleague with live directory search.
- **Team Pod Mode (Bulk Multi-Desk Booking)**: Select up to 8 desks simultaneously or reserve entire 4-desk pod clusters in one click with an atomic sprint batch confirmation.
- **My Bookings History** (`/employee/my-bookings`):
  - Tabbed filtering: `ALL`, `CONFIRMED`, `PAST`, `CANCELLED`.
  - **Cancel Selected**: Checkbox-based multi-select for selective cancellation.
  - **Bulk Cancel**: One-click cancellation of all future confirmed bookings.

---

### 6. 📅 Outlook Workspace Calendar & Dynamic Cascade Booking Engine
- **Streamlined Outlook Ribbon**:
  - Clean calendar navigation with Month/Year picker arrows (`< Month Year >`).
  - Resource type toggles (`All` | `Cubicles` | `Meeting Rooms`).
  - Live filter search across event codes, colleague names, meeting titles, and buildings.
  - Non-overlapping sticky layout ensuring ribbon controls remain neatly underneath the navigation bar.
- **Date-Click Single-Day Reservation Modal**:
  - Clicking any date cell in the Month view opens a focused reservation modal pre-set to that single day.
  - **Horizontal Cascade Bar**: `[ Building ▾ ]  [ Floor ▾ ]  [ Section ▾ ]` with intelligent defaults.
  - **Dynamic Availability Filtering**:
    - **Cubicles Dropdown**: Displays **ONLY** cubicles with zero confirmed bookings on that clicked date. If completely booked, an informative alert is displayed: `"No cubicles available in this section on [Date]"`.
    - **Meeting Rooms Dropdown**: Displays available conference rooms with capacity and HDMI specifications, or warns if already booked on that date.
  - **Shift Slots & Durations**:
    - Cubicle slots: `Full Day (09:00 - 18:00)`, `Morning Half (09:00 - 13:30)`, `Evening Half (13:30 - 18:00)`.
    - Meeting room reservations: Start time picker + numeric hours & minutes duration (strictly requiring at least 15 minutes).
  - **Beneficiary Selection**: Seamlessly choose `For Myself` or `On Behalf of Colleague` with live directory search.
  - **Single Event Inspector**: Clicking an event chip reveals full reservation details, proxy attribution, and provides instant single-click cancellation authority for personal or branch bookings.

---

### 7. 📝 Audit Logs & Security Governance

| Audit Event | Description |
|---|---|
| `BOOK_DESK` | Self-booking a workstation with slot type |
| `PROXY_BOOK_DESK` | Proxy reservation on behalf of a colleague |
| `BULK_BOOK_POD` | Multi-workstation team sprint reservation |
| `CANCEL_BOOKING` | Workstation release with optional cancellation reason |
| `ADD_CUBICLE` | Manual workstation addition by a branch admin |
| `IMPORT_WORKFORCE_ROSTER` | Multi-branch bulk employee onboarding event |
| `RELEASE_DESK` | Branch admin direct desk release with audit trail |
| `UPLOAD_BRANCH_FLOOR_PLAN` | Branch floor plan re-ingestion from spreadsheet |

---

### 8. 📡 Offline-First Engine & Background Sync
- **Role-Gated Offline Support**: Offline capabilities are exclusively available to **Employee** and **Branch Admin** roles. Platform and Organization Admins remain strictly online for governance integrity.
- **IndexedDB Outbox Queue**: Desk reservations and cancellations made while offline are queued in an IndexedDB `outbox_queue` store with FIFO replay upon reconnection.
- **Floor Plan Cache**: Complete workspace hierarchies are cached in IndexedDB `floorplan_cache`, enabling desk browsing without network connectivity.
- **Network Status Indicator**: A real-time connectivity pill in the header shows Online/Offline/Syncing states with pending operation count badges.
- **Automatic Background Sync**: On network restoration, queued operations are automatically replayed via standard HTTP POST to the API server.

---

### 9. 🔔 In-App Notification Center
- **Event-Derived Activity Stream**: Notifications are dynamically projected from `Booking` and `AuditLog` tables — no dedicated notification storage table required.
- **Bell Icon with Unread Badge**: Real-time unread count badge with 25-second polling interval.
- **Domain-Categorized Notifications**: Visual categorization with dedicated icons for booking confirmations, proxy reservations, cancellations, and admin broadcasts.
- **Mark Read & Clear Actions**: One-click mark-all-as-read and clear notification history.

---

### 10. 👥 Branch-Scoped Office Presence ("Who is in Office")
- **Software-Inferred Presence**: Derives real-time office occupancy from confirmed desk bookings for the current day — no hardware badges or RFID required.
- **Branch Isolation**: Employees and Branch Admins can only see presence within their assigned branch.
- **Searchable Colleague Directory**: Instant client-side search across name, email, department, and desk code with department-level count groupings.
- **Identity Attribution**: Current user "YOU" badge and proxy booking attribution ("Proxy by: Lead Name").

---

### 11. 🔐 Enterprise Single Sign-On (Microsoft Entra ID) & Hybrid Auth
- **Dual Authentication Modes**: Seamless coexistence of traditional corporate email + password login and enterprise Single Sign-On (SSO) via Microsoft Entra ID (OIDC / OAuth 2.0).
- **Microsoft Entra ID Integration**:
  - One-click **"Sign in with Microsoft (Entra SSO)"** button with official branding.
  - Multi-tenant application registration (`common` endpoint) supporting both corporate enterprise tenants and personal Microsoft test accounts.
- **Zero-Password Footprint for SSO**: SSO users authenticate against their corporate directory; no user passwords are stored or hashed for SSO logins.
- **Strict Authorization Safeguard**: Microsoft authentication strictly establishes identity; entry into the SaaS requires that the verified email is pre-registered in an organization's employee roster.
- **Dynamic Scoping on Sign-In**: Automatically assigns tenant `organizationId`, branch `scopedBranchId`, and role upon callback, steering users to their designated platform console.
- **SSO Sandbox Tester**: Built-in developer/demo simulation tool to test and demonstrate SSO sign-in flows with any registered corporate email without requiring external IdP sessions.

---

## 📦 Project Structure

```
MultiTenant-OfflineFirst-DeskBooking/
├── ADR/                               # Architecture Decision Records
├── apps/
│   ├── api/                           # Express.js + Prisma ORM Backend
│   │   ├── prisma/
│   │   │   └── schema.prisma          # Multi-tenant relational schema
│   │   └── src/
│   │       ├── routes/                # Modular API endpoints
│   │       │   ├── auth.routes.ts
│   │       │   ├── audit.routes.ts
│   │       │   ├── branches.routes.ts
│   │       │   ├── buildings.routes.ts
│   │       │   ├── employee.routes.ts
│   │       │   ├── notification.routes.ts
│   │       │   ├── organizations.routes.ts
│   │       │   ├── roster.routes.ts
│   │       │   ├── branch-roster.routes.ts
│   │       │   └── workspace.routes.ts
│   │       └── services/              # Excel engines, hashing, auth services
│   └── web/                           # React 18 + Vite + Tailwind CSS Frontend
│       └── src/
│           ├── components/
│           │   ├── dashboard/         # Role-specific dashboards
│           │   ├── layout/            # Header, Sidebar, AppLayout, ProtectedRoute
│           │   ├── NetworkStatusIndicator.tsx
│           │   ├── NotificationBell.tsx
│           │   └── OfficePresenceModal.tsx
│           ├── pages/
│           │   ├── admin/             # FloorPlans, Workforce, BranchAdmins, AuditLogs
│           │   ├── branch/            # BranchEmployeeRoster, BranchAuditLogs, FloorPlans
│           │   └── employee/          # EmployeeFloorPlanPage, OutlookCalendarPage, MyBookingsPage, Dashboard
│           └── services/
│               ├── api.ts             # Centralized fetchApi client with retry
│               └── offlineStore.ts    # IndexedDB outbox queue & floor plan cache
└── packages/
    └── shared/                        # Shared TypeScript interfaces, Role & Slot enums
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite 5, TypeScript 5, Tailwind CSS 3 |
| **Backend** | Express.js 4, TypeScript, Node.js |
| **ORM & Database** | Prisma ORM, PostgreSQL 16 |
| **Auth** | JWT Bearer tokens, bcrypt, Microsoft Entra ID (OIDC / OAuth 2.0) |
| **Excel Engine** | ExcelJS + JSZip — multi-sheet generation with live column formulas |
| **Offline-First** | IndexedDB (native) — outbox queue & floor plan cache |
| **Containerization** | Docker Compose — PostgreSQL 16 Alpine |
| **Monorepo** | pnpm Workspaces |
| **Build Tooling** | Vite (web), tsc (API), pnpm |

---

## 🚀 Running the Application

### Prerequisites
- Node.js `>= 18.x`
- pnpm `>= 8.x` (`npm install -g pnpm`)
- Docker Desktop (for PostgreSQL) or a local PostgreSQL instance on port 5432

### One-Click Startup (Windows)
```powershell
.\run.bat
```
The `run.bat` script will:
1. Detect or start PostgreSQL via Docker Compose on port `5432`.
2. Verify and clean port allocations on `3000` and `4000`.
3. Install pnpm workspace dependencies.
4. Generate the Prisma client, push the database schema, and seed initial data.
5. Start the API server on `http://localhost:4000` and the web frontend on `http://localhost:3000`.
6. Auto-launch the web console in your default browser.

### Manual Startup
```bash
# Start PostgreSQL (if using Docker)
docker compose up -d postgres

# Install all dependencies
pnpm install

# Generate Prisma client & push schema
pnpm db:generate && pnpm db:push && pnpm db:seed

# Run both API and web concurrently
pnpm dev
```

### Environment Configuration
Copy `.env.example` to `.env` and configure:
```env
PORT=4000
DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/deskbooking_db?schema=public"
JWT_SECRET="super-secret-jwt-key-for-multi-tenant-desk-booking-saas"
VITE_API_BASE_URL="http://localhost:4000/api"

# Microsoft Entra ID (SSO) Configuration
AZURE_CLIENT_ID="6ae9e86b-7736-4966-a459-708953128955"
AZURE_CLIENT_SECRET="your-azure-client-secret-value"
AZURE_TENANT_ID="common"
AZURE_REDIRECT_URI="http://localhost:3000/api/auth/sso/callback"
```

---

## 📋 API Endpoints Overview

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Authenticate with email + password and receive JWT |
| `GET` | `/api/auth/sso/microsoft` | Initiate Microsoft Entra ID OIDC login redirect |
| `GET` | `/api/auth/sso/callback` | Microsoft OAuth callback, token exchange, and JWT issue |
| `POST` | `/api/auth/sso/sandbox` | Quick developer/demo SSO simulation for registered emails |
| `POST` | `/api/auth/signup` | Register new organization with admin |
| `GET` | `/api/workspace/hierarchy` | Fetch full facility hierarchy with live bookings |
| `GET` | `/api/roster/multi-branch-template` | Download multi-branch Excel roster |
| `POST` | `/api/roster/multi-branch-import` | Bulk import employee roster |
| `GET` | `/api/branch-roster/floor-plan-template` | Download branch floor plan workbook |
| `POST` | `/api/branch-roster/floor-plan-import` | Import branch floor plan changes |
| `POST` | `/api/branch-roster/cubicle` | Add a new workstation in-UI |
| `GET` | `/api/employee/dashboard-summary` | Employee dashboard stats |
| `GET` | `/api/employee/presence` | Branch-scoped office presence |
| `GET` | `/api/employee/calendar-bookings` | Fetch month bookings for Outlook calendar |
| `POST` | `/api/employee/bookings` | Create a workstation or meeting room reservation |
| `POST` | `/api/employee/bulk-bookings` | Bulk pod reservation |
| `POST` | `/api/employee/mass-booking` | Multi-day / multi-desk booking (Max 30d) |
| `POST` | `/api/employee/cancel-booking` | Cancel a single booking |
| `POST` | `/api/employee/cancel-selected` | Cancel selected bookings |
| `POST` | `/api/employee/bulk-cancel` | Bulk cancel all future bookings |
| `GET` | `/api/notifications` | Fetch notification activity stream |
| `POST` | `/api/notifications/mark-read` | Mark all notifications as read |
| `POST` | `/api/notifications/clear` | Clear notification history |
| `GET` | `/api/audit` | Fetch organization audit logs |
| `GET` | `/api/health` | API health check |

---

## 📐 Architecture Decision Records

All significant architectural decisions are documented as ADRs in the [`ADR/`](ADR/) directory.

| ADR | Decision |
|-----|----------|
| [001](ADR/001-use-pnpm-monorepo-architecture.md) | pnpm Monorepo Architecture |
| [002](ADR/002-adopt-multi-tenant-subdomain-isolation.md) | Multi-Tenant Subdomain Isolation |
| [003](ADR/003-use-postgresql-with-prisma-orm.md) | PostgreSQL with Prisma ORM |
| [004](ADR/004-implement-four-tier-rbac-hierarchy.md) | Four-Tier RBAC Hierarchy |
| [005](ADR/005-use-jwt-bearer-token-authentication.md) | JWT Bearer Token Authentication |
| [006](ADR/006-render-floor-plans-with-zero-svg-css.md) | Zero-SVG CSS Floor Plans |
| [007](ADR/007-use-excel-driven-workspace-ingestion.md) | Excel-Driven Workspace Ingestion |
| [008](ADR/008-implement-offline-first-indexeddb-outbox.md) | Offline-First IndexedDB Outbox |
| [009](ADR/009-use-react-vite-tailwind-frontend.md) | React + Vite + Tailwind Frontend |
| [010](ADR/010-use-expressjs-rest-api-backend.md) | Express.js REST API Backend |
| [011](ADR/011-derive-notifications-from-domain-events.md) | Event-Derived Notifications |
| [012](ADR/012-implement-branch-scoped-office-presence.md) | Branch-Scoped Office Presence |
| [013](ADR/013-implement-microsoft-entra-sso.md) | Implement Hybrid Authentication with Microsoft Entra ID SSO |

---

*Built with care — Multi-Tenant Offline-First Desk Booking Platform*

