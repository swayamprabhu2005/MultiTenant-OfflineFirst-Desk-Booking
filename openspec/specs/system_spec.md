# System Specification: Multi-Tenant Offline-First Desk Booking & SaaS Platform

**Specification Identifier:** `SPEC-SYS-001`  
**Version:** `2.0.0` (Production Complete)  
**Status:** Approved & Implemented  
**Scope:** Architecture Topology, Multi-Tenant Governance, 2D Zero-SVG CAD Canvas, Offline Sync Protocol, Excel Cascading Engine, REST APIs, and Security Invariants  

---

## 1. System Overview & Architectural Topology

The **Multi-Tenant Offline-First Desk Booking Platform** unifies enterprise facility hierarchy management, spreadsheet-driven physical workspace ingestion with cascading dynamic formulas, 2D architectural CAD floor plan exploration without vector graphics, offline mutation queueing with IndexedDB, and role-governed desk reservation workflows.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT USER AGENT                               │
│           (Google Chrome / Edge / Firefox on Desktop, Laptops & Tablets)    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / WebSocket (Port 3000)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    VITE REVERSE PROXY & WEB APPLICATION                     │
│  - React 18 SPA + React Router DOM v6                                       │
│  - Tailwind CSS 3 (Architectural 2D Grid Layout, Zero <svg> Elements)       │
│  - Offline Interceptor: IndexedDB (desk_booking_offline_db Outbox Queue)     │
│  - Background Sync Engine with Window 'online' Event Listener               │
│  - Reverse Proxy: /api/* ──> http://127.0.0.1:4000/api/* (IPv4 Direct)       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ JSON REST API (Port 4000)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                        EXPRESS APPLICATION SERVER                           │
│  - Helmet Security Headers & Rate Limiter (500 req / 15 min)                │
│  - Dynamic CORS (Subdomain Origin Mirroring with Credentials)                │
│  - tenantMiddleware (Subdomain / Header / Query Tenant Resolution)          │
│  - authMiddleware & requireRole RBAC Guard (Platform, Org, Branch, Employee) │
│  - Ingestion Engine (JSZip In-Place Patching + ExcelJS Multi-Sheet Parser)  │
│  - Dynamic Excel Formula Evaluator & Structural Validation Pipeline         │
│  - Prisma ORM Query Engine & Atomic Transaction Coordinator                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ TCP Connection Pool (Port 5432)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                     POSTGRESQL 15 / SQLITE PERSISTENCE                      │
│  - Organizations, Branches, Buildings, Floors, Sections, Desks, Rooms       │
│  - Users, Bookings, Tenant-Scoped Audit Logs                                │
│  - Foreign Key Cascades & Relational Compound Unique Constraints            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Architectural Principles & Invariants

### 2.1 Subdomain Multi-Tenant Isolation
* **Tenant Discriminator:** Every database model (except the root `Organization` table) stores an indexed `organizationId` foreign key.
* **Resolution Pipeline:**
  1. Inspects `req.headers['x-tenant-subdomain']`.
  2. Parses host header (e.g. `acme.deskbooking.com` $\implies$ `acme`).
  3. Inspects `req.query.tenant`.
  4. Resolves `Organization.findUnique({ where: { subdomain } })` and attaches `req.organizationId` and `req.tenantSubdomain`.
* **System Tenant Safeguard:** The root organization with subdomain `system` and code `SYSTEM` represents global platform management and is permanently protected against deletion.

### 2.2 Strict Zero-SVG Architectural Floor Plan Mandate
* **Rule:** All floor plan visualizers strictly prohibit `<svg>`, `<canvas>`, `<path>`, or vector graphics.
* **HTML5 Semantic Rendering:** Walls, corridors, pods, cubicles, and meeting rooms are constructed entirely using semantic HTML5 `<div>` and `<button>` elements styled with CSS Grid and Tailwind CSS.
* **Native 100% Fixed Scale:** Manual zoom controls (`- 100% +`) and dynamic CSS `transform: scale(...)` are eliminated across all floor plan views, ensuring layout stability and preventing viewport clipping.
* **Sanitized Selectors:** UI selectors hide raw database IDs (`BR001`, `BLD001`, `1-FL01`) and display clean human-readable names (`Pune HQ`, `Building A`, `Floor 1`).

### 2.3 Symmetrical 4-Desk Pod Clusters & Conference Seats
* Standard workstations are grouped into ergonomic **4-desk pod clusters** (2 facing 2 setup) arranged in a 2-row matrix that expands column-by-column.
* External HDMI monitors are distributed symmetrically across active pods via round-robin allocation.
* **Meeting Room Conference Seats (`M-01` to `M-10`):** Excluded from 4-desk pod clustering and rendered as independent, clickable, and bookable conference seats.

### 2.4 3-Color Contextual Booking Parity
* Workstation card states render uniformly across all views based on the authenticated user context:
  - **Emerald Green**: Available for reservation.
  - **Indigo Blue**: Reserved by the currently authenticated user.
  - **Rose Red**: Reserved by another colleague or employee.
  - **Amber Yellow**: Offline Sync Pending in local IndexedDB Outbox.
* Cubicle cards follow a 3-line vertical hierarchy: Line 1 = Desk Code (`C-01`), Line 2 = Hardware Spec (PC monitor icon for HDMI), Line 3 = Status Label (`Available`, `Your Desk`, `Booked`).

### 2.5 Offline-First Architecture & Background Sync Engine
* **IndexedDB Outbox (`desk_booking_offline_db`):** Intercepts desk booking and cancellation mutations when offline (`navigator.onLine === false`).
* **Floor Plan Layout Caching:** Caches floor plans locally, enabling full offline inspection with amber notice pills.
* **Background Sync Engine:** Listens to `window.addEventListener('online', ...)`, flushes queued Outbox mutations in FIFO order, updates local caches, and notifies UI components via custom events.

### 2.6 Dynamic Cascading Excel Ingestion Engine
* **Multi-Sheet Workbooks:** Ingestion templates feature interconnected sheets: `Organization`, `Branches`, `Buildings`, `Floors`, and `Sections & Cubicles`.
* **Dynamic Uppercase Cascading Formulas:** Excel sheets reference parent data using uppercase formulas (`=UPPER(TRIM(...))`, `=IF(...)`, `=VLOOKUP(...)`).
* **Meeting Room Conditional Lockout:** Marking Meeting Room as `"Yes"` auto-locks standard desk capacity and requires meeting room capacity.
* **Non-Destructive In-Place Injection:** `GET /api/workspace/template` updates cells A5/B5 using `JSZip` XML editing, bypassing `ExcelJS` re-serialization.
* **Sheet-Specific Error Feedback:** When upload validation fails, a bright red `ERRORS & FIXES` column (`#DC2626`) is injected only into invalid sheets.

### 2.7 Strict 7-Day Sliding Window & Week Navigation
* All availability matrices render strictly **7 consecutive days (1 week)** at a time, eliminating awkward day wrapping.
* Navigation arrows `<` (Previous 7 Days) and `>` (Next 7 Days) allow seamless browsing across future weeks.
* Date calculations use local calendar dates to prevent UTC timezone boundary shifts.

### 2.8 Multi-Workstation Mass Booking Modal
* Selecting multiple cubicles in Mass Booking Mode and clicking `Proceed to Book (N Desks)` opens an interactive modal via React Portal.
* Selected cubicles appear as removable badge chips with individual `✕` buttons.
* **Multi-Desk Conflict Detection:** Dates where any selected cubicle is booked render in Red (`✕ Conflict`) and are disabled. Dates where all desks are free render in Green (`Available` / `✓ Selected`).
* Restricts batch reservations to a single selected date with session window selection (`Full Day`, `Morning`, `Afternoon`).
* Supports backdrop click dismissal (`e.target === e.currentTarget`).

---

## 3. Database Schema & Prisma Relational Models

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  PLATFORM_ADMIN
  ORGANIZATION_ADMIN
  BRANCH_ADMIN
  TECH_LEAD
  EMPLOYEE
}

model Organization {
  id         String       @id @default(uuid())
  name       String
  code       String       @unique
  subdomain  String       @unique
  logoUrl    String?
  themeColor String?      @default("#16a34a")
  timezone   String       @default("UTC")
  status     String       @default("ACTIVE")
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt
  branches   Branch[]
  buildings  Building[]
  users      User[]
  auditLogs  AuditLog[]
}

model Branch {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name           String
  code           String
  address        String?
  status         String       @default("ACTIVE")
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  buildings      Building[]
  users          User[]       @relation("UserBaseBranch")
  scopedUsers    User[]       @relation("UserScopedBranch")

  @@unique([organizationId, code])
}

model Building {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  branchId       String
  branch         Branch       @relation(fields: [branchId], references: [id], onDelete: Cascade)
  name           String
  code           String
  address        String?
  status         String       @default("ACTIVE")
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  floors         Floor[]

  @@unique([organizationId, code])
}

model Floor {
  id             String       @id @default(uuid())
  organizationId String
  buildingId     String
  building       Building     @relation(fields: [buildingId], references: [id], onDelete: Cascade)
  code           String
  floorNumber    Int
  name           String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  sections       Section[]

  @@unique([buildingId, code])
}

model Section {
  id                String       @id @default(uuid())
  organizationId    String
  floorId           String
  floor             Floor        @relation(fields: [floorId], references: [id], onDelete: Cascade)
  name              String
  direction         String
  standardDeskCount Int          @default(0)
  hdmiDeskCount     Int          @default(0)
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @updatedAt
  desks             Desk[]
  meetingRoom       MeetingRoom?

  @@unique([floorId, name])
}

model Desk {
  id             String       @id @default(uuid())
  organizationId String
  sectionId      String
  section        Section      @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  deskCode       String
  deskNumber     Int
  hasHdmi        Boolean      @default(false)
  isMeetingRoom  Boolean      @default(false)
  isExecutive    Boolean      @default(false)
  status         String       @default("AVAILABLE")
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  bookings       Booking[]

  @@unique([sectionId, deskCode])
}

model MeetingRoom {
  id             String       @id @default(uuid())
  organizationId String
  sectionId      String       @unique
  section        Section      @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  name           String
  capacity       Int          @default(0)
  hasHdmi        Boolean      @default(false)
  hdmiCount      Int          @default(0)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}

model User {
  id                 String       @id @default(uuid())
  organizationId     String
  organization       Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  name               String
  email              String       @unique
  passwordHash       String
  role               Role         @default(EMPLOYEE)
  department         String?
  baseBranchId       String?
  baseBranch         Branch?      @relation("UserBaseBranch", fields: [baseBranchId], references: [id], onDelete: SetNull)
  scopedBranchId     String?
  scopedBranch       Branch?      @relation("UserScopedBranch", fields: [scopedBranchId], references: [id], onDelete: SetNull)
  mustChangePassword Boolean      @default(false)
  status             String       @default("ACTIVE")
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt
  auditLogs          AuditLog[]
  bookings           Booking[]
}

model Booking {
  id               String       @id @default(uuid())
  organizationId   String
  deskId           String
  desk             Desk         @relation(fields: [deskId], references: [id], onDelete: Cascade)
  userId           String
  user             User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  bookedByUserId   String?
  startTime        DateTime
  endTime          DateTime
  slotType         String       @default("FULL_DAY") // FULL_DAY, MORNING, AFTERNOON
  notes            String?
  status           String       @default("CONFIRMED") // CONFIRMED, CANCELLED
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
}

model AuditLog {
  id             String        @id @default(uuid())
  organizationId String?
  organization   Organization? @relation(fields: [organizationId], references: [id], onDelete: SetNull)
  actorUserId    String?
  actorUser      User?         @relation(fields: [actorUserId], references: [id], onDelete: SetNull)
  action         String
  entityType     String
  entityId       String
  metadata       Json?
  createdAt      DateTime      @default(now())
}
```

---

## 4. Complete REST API Specification

### 4.1 Authentication & Profile (`/api/auth`)
* `POST /api/auth/login` -- Public user authentication with JWT token return.
* `POST /api/auth/signup` -- Organization registration and initial admin user creation.
* `GET /api/auth/me` -- Authenticated profile query with tenant metadata.
* `POST /api/auth/change-password` -- Self-service and forced initial password updates.
* `GET /api/auth/organizations` -- Public active tenant directory for tenant selection.

### 4.2 Organization Administration (`/api/organizations`)
* `GET /api/organizations` -- Tenant directory listing (Platform Admin = all tenants; Org Admin = scoped tenant).
* `POST /api/organizations` -- Platform Admin tenant creation.
* `PATCH /api/organizations/:id/branding` -- Update theme color, logo URL, and organization name.
* `DELETE /api/organizations/:id` -- Atomic cascade deletion of tenant and all child entities (protected system tenant).

### 4.3 Workspace Setup & Master Ingestion (`/api/workspace`)
* `GET /api/workspace/template` -- Streams master 5-sheet template with cells A5/B5 patched via JSZip.
* `POST /api/workspace/import` -- Multipart spreadsheet upload with multi-sheet validation and red error sheet injection.
* `GET /api/workspace/hierarchy` -- Full physical tree query with joined active desk bookings.
* `GET /api/workspace/branches` -- Lightweight branch listing for dropdowns.

### 4.4 Workforce Directory & Multi-Branch Ingestion (`/api/workforce`)
* `GET /api/workforce/template` -- Generates multi-sheet employee roster template with dynamic per-branch tabs.
* `POST /api/workforce/import` -- Parses multi-branch roster, precomputes bcrypt hashes, and batch upserts users.
* `GET /api/workforce/config` -- Fetches corporate email domain and default password configurations.
* `POST /api/workforce/config` -- Persists organization-level email domain and default password settings.

### 4.5 Dedicated Branch Admin Roster (`/api/roster`)
* `GET /api/roster/branch-admins` -- Lists branches with assigned or unassigned administrator status.
* `GET /api/roster/branch-admin-template` -- Generates Excel template filtered to unassigned branches only.
* `POST /api/roster/branch-admin-import` -- Batch provisions branch administrators from spreadsheet.
* `POST /api/roster/branch-admin` -- Manually assigns an administrator to a branch.
* `DELETE /api/roster/branch-admin/:id` -- Revokes administrator privileges and immediately reverts branch to `Pending Assignment`.

### 4.6 Branch Floor Plan Customization (`/api/branch-roster`)
* `GET /api/branch-roster/floor-plan-template` -- Generates branch-scoped floor plan Excel template.
* `POST /api/branch-roster/import-floor-plan` -- Re-ingests branch floor plan with formula evaluation.
* `POST /api/branch-roster/cubicle` -- Manually adds a workstation (+ Add Cubicle) with dynamic 4-desk pod recalculation.
* `POST /api/branch-roster/assign-executive-desk` -- Designates permanent dedicated executive desks.

### 4.7 Employee Self-Service & Booking Engine (`/api/employee`)
* `GET /api/employee/dashboard-summary` -- Facility metrics, active bookings, and branch greeting.
* `POST /api/employee/bookings` -- Atomic workstation reservation supporting slot types (`FULL_DAY`, `MORNING`, `AFTERNOON`) and multi-day booking dates.
* `GET /api/employee/colleagues` -- Live search for branch colleagues to support proxy reservations.
* `POST /api/employee/bulk-bookings` -- Multi-workstation mass reservation with atomic conflict prevention.
* `POST /api/employee/cancel-booking` -- Direct reservation release and cancellation.
* `GET /api/employee/my-bookings` -- Booking history query with status filtering (`CONFIRMED`, `CANCELLED`).
* `POST /api/employee/bulk-cancel` -- Bulk cancellation of multiple selected or all upcoming reservations.
* `GET /api/employee/office-presence` -- Branch-scoped colleague occupancy and desk location query for "Who's in Office".

### 4.8 Notifications & Audit Telemetry (`/api/notifications` & `/api/audit`)
* `GET /api/notifications` -- User-scoped in-app notification activity stream with unread counter.
* `PATCH /api/notifications/:id/read` -- Marks notification as read.
* `GET /api/audit` -- Tenant-scoped audit trail query with actor user details and action filtering.
* `GET /api/health` -- System health and database connectivity probe.

---

## 5. Security & Multi-Tenant Governance Matrix

| Role | Tenant Scope | Floor Plan Mode | In-UI Cubicle Creation | Mass Booking Mode | Proxy Booking | Export / Import |
|---|---|---|---|---|---|---|
| **PLATFORM_ADMIN** | Global / All Tenants | Superadmin Control | Disabled | Disabled | Disabled | Full Access |
| **ORGANIZATION_ADMIN** | Scoped Tenant | **View-Only** (Read-Only) | Disabled | Disabled | Disabled | Full Access (Master) |
| **BRANCH_ADMIN** | Scoped Branch | Interactive CAD Canvas | **Enabled** (+ Add Cubicle) | **Enabled** (Single Day) | Enabled | Branch Scope |
| **EMPLOYEE** | Base Branch | Interactive CAD Canvas | Disabled | **Enabled** (Single Day) | Enabled (Proxy) | None |

---

## 6. Architecture Decision Records (ADR Directory)

The system architecture is codified across 12 formal Architecture Decision Records:
* **ADR-001:** Subdomain-Based Multi-Tenant Isolation Strategy
* **ADR-002:** Relational Data Model & Cascade Purge Integrity
* **ADR-003:** Non-Destructive In-Place Excel Injection via JSZip
* **ADR-004:** Sheet-Specific Red Error Injection Pattern
* **ADR-005:** Dynamic Row-Anchored Data Validation Formulas
* **ADR-006:** Pure HTML5 & CSS Grid CAD Floor Plan (Zero-SVG Mandate)
* **ADR-007:** Dedicated Branch Administrator Lifecycle Management
* **ADR-008:** Automated Perceived Luminance Brand Theming
* **ADR-009:** IndexedDB Outbox Queue & Offline Interception Protocol
* **ADR-010:** Background Synchronization Engine & Network Listeners
* **ADR-011:** Symmetrical 4-Desk Pod Clustering & Independent Conference Pods
* **ADR-012:** Multi-Workstation Mass Booking Modal & Multi-Desk Conflict Engine
