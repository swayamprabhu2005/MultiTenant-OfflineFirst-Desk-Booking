# System Specification: Multi-Tenant Desk Booking & SaaS Control Plane

**Specification Identifier:** `SPEC-SYS-001`  
**Version:** `1.0.0` (Production Complete)  
**Status:** Approved & Implemented  
**Scope:** Core Architecture, Modules, Database Schema, REST API Directory, and Security Invariants  

---

## 1. System Overview & Architectural Topology

The **Multi-Tenant Desk Booking & SaaS Control Plane** is a distributed web platform that unifies multi-tenant facility management, spreadsheet-driven physical workspace ingestion, interactive 2D floor plan exploration without vector graphics, and dedicated branch administrator provisioning.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT USER AGENT                               │
│           (Google Chrome / Edge / Firefox on Desktop & Tablets)             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / WebSocket (Port 3000)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                    VITE REVERSE PROXY & WEB APPLICATION                     │
│  - React 18 SPA + React Router DOM v6                                       │
│  - Tailwind CSS + Lucide React                                              │
│  - Proxy: /api/* ──> http://127.0.0.1:4000/api/* (IPv4 Direct Binding)      │
│  - Error Fallback: 503 Service Unavailable during backend boot              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ JSON REST API (Port 4000)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                        EXPRESS APPLICATION SERVER                           │
│  - Helmet Security Headers & Rate Limiter (500 req / 15 min)                │
│  - Dynamic CORS (Subdomain Origin Mirroring with Credentials)                │
│  - tenantMiddleware (Subdomain / Header / Query Resolution)                 │
│  - authMiddleware & requireRole RBAC Guard                                  │
│  - Ingestion Engine (JSZip In-Place Patching + ExcelJS Multi-Sheet Parser)  │
│  - Prisma ORM Query Engine & Transaction Coordinator                        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ TCP Connection Pool (Port 5432)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                     POSTGRESQL 15 PERSISTENCE STORE                         │
│  - Organizations, Branches, Buildings, Floors, Sections, Desks, Rooms       │
│  - Users, Bookings, Tenant-Scoped Audit Logs                                │
│  - Foreign Key Cascades & Compound Unique Constraints                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architectural Principles & System Boundaries

### A. Subdomain Multi-Tenant Isolation
* **Tenant Discriminator:** Every entity table (except the root `Organization` table itself) stores an indexed `organizationId` foreign key.
* **Resolution Pipeline:**
  1. `tenantMiddleware` inspects `req.headers['x-tenant-subdomain']`.
  2. If absent, it parses the host header (e.g., `acme.deskbooking.com` $\implies$ `acme`).
  3. If still absent, it inspects `req.query.tenant`.
  4. Resolves the database record `Organization.findUnique({ where: { subdomain } })` and attaches `req.organizationId` and `req.tenantSubdomain`.
* **System Tenant Safeguard:** The root organization with subdomain `system` and code `SYSTEM` represents the global platform administration tenant and is permanently protected against deletion.

### B. Strict Zero-SVG Architectural Floor Plan Mandate
* **Core Rule:** The floor plan visualizer ([`FloorPlansPage.tsx`](file:///apps/web/src/pages/admin/FloorPlansPage.tsx)) strictly prohibits vector graphics (`<svg>`, `<path>`, `<circle>`, `<polygon>`, `<g>`).
* **Implementation:** Walls, walkways, pod clusters, cubicles, and meeting rooms are constructed entirely using semantic HTML5 `<div>` and `<button>` elements styled with Tailwind CSS (`border-4`, `rounded-xl`, `grid`, `flex`).
* **Sanitized Selectors:** User-facing dropdown menus hide all database keys (`BR001`, `BLD001`, `1-FL01`) and render only clean, human-readable labels (`Pune`, `Bhaskar`, `Floor 1`).

### C. Cascading 5-Sheet Excel Ingestion Engine
* **Pre-Filled Template Streaming:** `GET /api/workspace/template` dynamically injects the requesting tenant's ID and name into cells `A5` and `B5` of Sheet 1 inside `templates/Workspace_FloorPlan_Template.xlsx` using in-place `JSZip` XML editing.
* **OpenXML Range Integrity:** `ExcelJS` serialization is strictly bypassed for template generation, preventing alphabetical cell sorting (`"H10"` before `"H2"`) from corrupting Sheet 5 DataValidation ranges.
* **Dynamic Row-Anchored Data Validation:** Data validation formulas use dynamic row resolution:
  * `=UPPER(TRIM(INDIRECT("G" & ROW())))="YES"`
  * `=AND(UPPER(TRIM(INDIRECT("G" & ROW())))="YES", INDIRECT("I" & ROW())<=INDIRECT("H" & ROW()))`
  * Eliminates case sensitivity, trailing whitespace, and relative coordinate drift across different spreadsheet applications.
* **Sheet-Specific Red Error Feedback:** When validation fails, the server injects a bright red **`ERRORS & FIXES`** column (`#DC2626` header, `#FEE2E2` fill) **only into sheets containing errors**. Clean sheets remain untouched.

### D. Dedicated Branch Administrator Lifecycle Management
* **Single-Purpose Model:** Employee roster controls focus exclusively on physical branch administrator assignment (generic employee directory tabs removed).
* **Prerequisite Gatekeeper:** Roster view locks if 0 branches exist in the database, guiding the admin to `/admin/workspace-setup`.
* **Instant State Rollback:** Deleting an administrator (`DELETE /api/roster/branch-admin/:id`) revokes access and immediately resets the branch row to `Pending Assignment` (amber badge, `+ Assign` button).
* **Chrome Breach Alert Prevention:** Modals use non-form containers (`<div>`), mask inputs via `style={{ WebkitTextSecurity: showPassword ? 'none' : 'disc' }}`, and set `autoComplete="new-password"` to avoid false-positive browser credential leak alerts.

### E. Dynamic White-Label Brand Theming with Intelligent Contrast
* **Dynamic Color Adaptation:** The top navbar and dashboard welcome banner adapt to `activeOrg.themeColor`.
* **Automated Luminance Calculation:**
  $$Y = 0.299 \times R + 0.587 \times G + 0.114 \times B$$
  * If $Y < 145$: Switches text to `text-white` and badges to translucent white (`bg-white/20 text-white`).
  * If $Y \ge 145$: Switches text to `text-slate-950` and badges to translucent dark slate (`bg-black/10 text-slate-900`).

---

## 3. Database Schema & Prisma Models

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
  code           String       // e.g. "1-FL01", "2-FL01"
  floorNumber    Int
  name           String       // e.g. "Floor 1", "Floor 2"
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
  name              String       // e.g. "First North", "First South"
  direction         String       // "NORTH", "SOUTH", "EAST", "WEST"
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
  deskCode       String       // e.g. "C-01", "C-02"
  deskNumber     Int
  hasHdmi        Boolean      @default(false)
  isMeetingRoom  Boolean      @default(false)
  status         String       @default("AVAILABLE") // "AVAILABLE", "BOOKED"
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
  name           String       // e.g. "Meeting Room (8 Seats)"
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
  baseBuildingId     String?
  scopedBranchId     String?
  scopedBranch       Branch?      @relation("UserScopedBranch", fields: [scopedBranchId], references: [id], onDelete: SetNull)
  teamLeadId         String?
  teamLead           User?        @relation("TeamLead", fields: [teamLeadId], references: [id], onDelete: SetNull)
  teamMembers        User[]       @relation("TeamLead")
  mustChangePassword Boolean      @default(false)
  status             String       @default("ACTIVE")
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt
  auditLogs          AuditLog[]
  bookings           Booking[]
}

model Booking {
  id             String       @id @default(uuid())
  organizationId String
  deskId         String
  desk           Desk         @relation(fields: [deskId], references: [id], onDelete: Cascade)
  userId         String
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  startTime      DateTime
  endTime        DateTime
  status         String       @default("CONFIRMED") // "CONFIRMED", "CANCELLED"
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
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

## 4. REST API Specification

All protected endpoints require an `Authorization: Bearer <jwt>` header and an optional `x-tenant-subdomain` header.

### 4.1 Authentication Endpoints (`/api/auth`)

#### `POST /api/auth/login`
* **Access:** Public
* **Request Body:**
  ```json
  {
    "email": "admin@deskbooking.com",
    "password": "DeskBook$2026#SecureOps!X9"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid",
      "name": "Platform Administrator",
      "email": "admin@deskbooking.com",
      "role": "PLATFORM_ADMIN",
      "organizationId": "uuid",
      "organization": { "id": "uuid", "name": "DeskBooking System", "subdomain": "system", "themeColor": "#16a34a" }
    },
    "organization": { "id": "uuid", "name": "DeskBooking System", "subdomain": "system", "themeColor": "#16a34a" }
  }
  ```
* **Error (401 Unauthorized):** `{"error": "Invalid email or password"}`

#### `POST /api/auth/signup`
* **Access:** Public
* **Request Body:**
  ```json
  {
    "name": "Jane Doe",
    "email": "jane@acmecorp.com",
    "password": "HighEntropyPassword123!",
    "orgName": "Acme Corporation",
    "orgCode": "ACME",
    "subdomain": "acme"
  }
  ```
* **Behavior:** Executes `prisma.$transaction` creating Organization, Organization Admin User (`role: ORGANIZATION_ADMIN`, `mustChangePassword: false`), and `AuditLog` (`action: CREATE_ORGANIZATION`).
* **Response (201 Created):** Returns generated JWT token, user record, and organization record.

#### `GET /api/auth/me`
* **Access:** Authenticated
* **Response (200 OK):** Returns current user record and associated organization metadata.

#### `POST /api/auth/change-password`
* **Access:** Authenticated
* **Request Body:**
  ```json
  {
    "currentPassword": "OldPassword123!",
    "newPassword": "NewHighEntropyPassword456!"
  }
  ```
* **Response (200 OK):** `{"message": "Password changed successfully"}`

#### `GET /api/auth/organizations`
* **Access:** Public
* **Response (200 OK):** Returns array of active organizations `[{ "id": "uuid", "name": "Acme", "code": "ACME", "subdomain": "acme" }]`.

---

### 4.2 Organization & Platform Administration (`/api/organizations`)

#### `GET /api/organizations`
* **Access:** Authenticated (`PLATFORM_ADMIN` or `ORGANIZATION_ADMIN`)
* **Behavior:** If `PLATFORM_ADMIN`, returns all registered tenant organizations with user counts. If `ORGANIZATION_ADMIN`, returns only their scoped organization.
* **Response (200 OK):** Array of `Organization` objects.

#### `POST /api/organizations`
* **Access:** `PLATFORM_ADMIN`
* **Request Body:**
  ```json
  {
    "name": "Omega Corp",
    "code": "OMEGA",
    "subdomain": "omega",
    "themeColor": "#2563eb",
    "timezone": "UTC"
  }
  ```
* **Response (201 Created):** Created `Organization` object.

#### `PATCH /api/organizations/:id/branding`
* **Access:** `PLATFORM_ADMIN` or `ORGANIZATION_ADMIN` (scoped to own tenant)
* **Request Body:**
  ```json
  {
    "themeColor": "#7c3aed",
    "logoUrl": "https://example.com/logo.png",
    "name": "Omega Global"
  }
  ```
* **Response (200 OK):** Updated `Organization` object. Logs `UPDATE_BRANDING` in audit table.

#### `DELETE /api/organizations/:id`
* **Access:** `PLATFORM_ADMIN`
* **Behavior:** Permanently purges tenant data in an atomic `prisma.$transaction`:
  1. `tx.booking.deleteMany({ where: { organizationId: id } })`
  2. `tx.meetingRoom.deleteMany({ where: { organizationId: id } })`
  3. `tx.desk.deleteMany({ where: { organizationId: id } })`
  4. `tx.section.deleteMany({ where: { organizationId: id } })`
  5. `tx.floor.deleteMany({ where: { organizationId: id } })`
  6. `tx.building.deleteMany({ where: { organizationId: id } })`
  7. `tx.branch.deleteMany({ where: { organizationId: id } })`
  8. `tx.user.deleteMany({ where: { organizationId: id } })`
  9. `tx.auditLog.deleteMany({ where: { organizationId: id } })`
  10. `tx.organization.delete({ where: { id } })`
* **Protection Guard:** Blocks deletion if `subdomain === 'system'` or `code === 'SYSTEM'`.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Organization \"Acme Corp\" and all associated resources have been permanently deleted."
  }
  ```

---

### 4.3 Workspace Ingestion & Floor Plans (`/api/workspace`)

#### `GET /api/workspace/template`
* **Access:** `PLATFORM_ADMIN`, `ORGANIZATION_ADMIN`
* **Behavior:** Loads `templates/Workspace_FloorPlan_Template.xlsx` from disk, uses `JSZip` to update cells `A5` (Organization ID) and `B5` (Organization Name) in `xl/worksheets/sheet1.xml`, and streams the `.xlsx` binary buffer to the client.
* **Response Headers:**
  * `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
  * `Content-Disposition: attachment; filename="Workspace_FloorPlan_ACME.xlsx"`

#### `POST /api/workspace/import`
* **Access:** `PLATFORM_ADMIN`, `ORGANIZATION_ADMIN`
* **Content-Type:** `multipart/form-data` (`file` field, max 10MB)
* **Validation Pipeline:**
  1. Validates presence of all 5 sheets (`Organization`, `Branches`, `Buildings`, `Floors`, `Sections & Cubicles`).
  2. Sheet 1: Validates branch count $> 0$.
  3. Sheet 2: Validates branch names and building counts $> 0$.
  4. Sheet 3: Validates building names and floor counts $> 0$.
  5. Sheet 4: Validates floor names and section counts between 1 and 4.
  6. Sheet 5: Validates standard desk count $> 0$, HDMI $\le$ total cubicles, Meeting Room (`Yes`/`No`), Meeting Room capacity $> 0$ if `Yes`, Meeting Room HDMI $\le$ capacity.
* **On Success (200 OK):**
  Executes atomic `prisma.$transaction`: deletes existing branches and child entities for the tenant, recreates the entire hierarchy, generates numbered cubicle desks (`C-01`, `C-02`...), generates meeting rooms, logs `IMPORT_WORKSPACE_FLOORPLAN`, and returns:
  ```json
  {
    "success": true,
    "stats": {
      "branches": 2,
      "buildings": 3,
      "floors": 6,
      "sections": 18,
      "desks": 144,
      "meetingRooms": 6
    }
  }
  ```
* **On Error (422 Unprocessable Entity):**
  Appends bright red `ERRORS & FIXES` column ONLY to sheets containing validation issues and returns:
  ```json
  {
    "success": false,
    "errorCount": 3,
    "errorsSummary": [
      "[Sections & Cubicles Row 8] Number of Cubicals Having HDMI (12) cannot exceed total cubicles (8)."
    ],
    "errorWorkbookBase64": "UEsDBBQAAAAIA..."
  }
  ```

#### `GET /api/workspace/hierarchy`
* **Access:** Authenticated
* **Behavior:** Returns nested physical hierarchy:
  $$\text{Branch} \longrightarrow \text{Building} \longrightarrow \text{Floor} \longrightarrow \text{Section} \longrightarrow \text{Desks} + \text{MeetingRoom}$$
* **Response (200 OK):** Array of `BranchDTO` objects with populated relational children.

#### `POST /api/workspace/book-desk`
* **Access:** Authenticated
* **Request Body:** `{"deskId": "uuid", "startTime": "ISO", "endTime": "ISO"}`
* **Behavior:** Validates desk availability, updates `Desk.status = 'BOOKED'`, creates `Booking` record (`status: CONFIRMED`), and writes `BOOK_DESK` audit log within a transaction.
* **Response (200 OK):** `{"desk": { ... }, "booking": { ... }}`

#### `POST /api/workspace/cancel-booking`
* **Access:** Authenticated
* **Request Body:** `{"deskId": "uuid"}`
* **Behavior:** Updates `Desk.status = 'AVAILABLE'`, updates confirmed bookings to `CANCELLED`, logs `CANCEL_BOOKING`.
* **Response (200 OK):** `{"success": true, "deskId": "uuid", "status": "AVAILABLE"}`

---

### 4.4 Dedicated Branch Administrator Roster (`/api/roster`)

#### `GET /api/roster/branch-admins`
* **Access:** `PLATFORM_ADMIN`, `ORGANIZATION_ADMIN`
* **Response (200 OK):**
  ```json
  [
    {
      "branchId": "uuid-1",
      "branchCode": "BR001",
      "branchName": "Pune Headquarters",
      "admin": {
        "id": "uuid-user",
        "name": "Rajesh Sharma",
        "email": "rajesh@acmecorp.com",
        "role": "BRANCH_ADMIN",
        "createdAt": "2026-09-04T12:00:00.000Z"
      }
    },
    {
      "branchId": "uuid-2",
      "branchCode": "BR002",
      "branchName": "Goa Branch",
      "admin": null
    }
  ]
  ```

#### `GET /api/roster/branch-admin-template`
* **Access:** `PLATFORM_ADMIN`, `ORGANIZATION_ADMIN`
* **Behavior:** Filters out branches that already have assigned administrators; generates Excel workbook containing only **unassigned branches** with Navy headers for `Branch ID` and `Branch Name`, and Yellow user inputs for `Administrator Full Name`, `Administrator Email`, and `Initial Password`.
* **Response (200 OK):** `.xlsx` file download.

#### `POST /api/roster/branch-admin-import`
* **Access:** `PLATFORM_ADMIN`, `ORGANIZATION_ADMIN`
* **Content-Type:** `multipart/form-data`
* **Behavior:** Parses Excel rows, verifies RFC 5322 email regex (`/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/`), hashes passwords with bcrypt (cost factor 10), upserts users with `role: BRANCH_ADMIN`, associates them to `scopedBranchId`, and creates `IMPORT_BRANCH_ADMINS` audit log.

#### `POST /api/roster/branch-admin`
* **Access:** `PLATFORM_ADMIN`, `ORGANIZATION_ADMIN`
* **Request Body:**
  ```json
  {
    "branchId": "uuid-2",
    "name": "Anita Desai",
    "email": "anita@acmecorp.com",
    "password": "HighEntropyPassword123!"
  }
  ```
* **Response (201 Created):** Created user object and audit log `ASSIGN_BRANCH_ADMIN`.

#### `PUT /api/roster/branch-admin/:id`
* **Access:** `PLATFORM_ADMIN`, `ORGANIZATION_ADMIN`
* **Request Body:** `{"name": "Anita D.", "email": "anita.d@acmecorp.com", "branchId": "uuid-2"}`
* **Response (200 OK):** Updated user object.

#### `DELETE /api/roster/branch-admin/:id`
* **Access:** `PLATFORM_ADMIN`, `ORGANIZATION_ADMIN`
* **Behavior:** Permanently deletes the branch administrator user record and records `REVOKE_BRANCH_ADMIN` in `AuditLog`. The branch instantly rolls back to `Pending Assignment`.
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Administrator \"Anita Desai\" removed from branch \"Goa Branch\". Branch has been reverted to Pending Assignment."
  }
  ```

---

### 4.5 Security Audit Logging (`/api/audit`)

#### `GET /api/audit`
* **Access:** Authenticated
* **Query Parameters:** `page` (default 1), `limit` (default 50), `q` (text search across action/entityType)
* **Response (200 OK):** Paginated audit log records with associated `actorUser` names and emails.

---

### 4.6 System Health Probe (`/api/health`)

#### `GET /api/health`
* **Access:** Public
* **Response (200 OK):**
  ```json
  {
    "status": "UP",
    "tenantSubdomain": "system",
    "organizationId": "uuid",
    "timestamp": "2026-09-05T02:50:42.000Z"
  }
  ```
