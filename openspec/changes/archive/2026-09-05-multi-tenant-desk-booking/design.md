# Technical Design: Multi-Tenant Desk Booking Platform

**Design Identifier:** `DES-ARCH-001`  
**Parent Change:** `2026-09-05-multi-tenant-desk-booking`  
**Status:** Implemented & Verified  

---

## 1. Architectural Decision Records (ADRs)

### ADR-1: Pure React + HTML5 `<div>` Architectural Rendering (STRICT NO-SVG Mandate)
* **Context:** Enterprise users required floor plan visualizations that render consistently across desktop browsers and tablets without vector distortion, coordinate scaling drift, or complex canvas dependencies. Furthermore, client requirements established a strict **NO-SVG mandate** prohibiting all vector graphics (`<svg>`, `<path>`, `<polygon>`, etc.).
* **Decision:** Build the entire interactive 2D architectural floor plan using Pure React, semantic HTML5 `<div>` and `<button>` elements, CSS Grid, Flexbox, and Tailwind CSS.
* **Consequences:**
  * Zero external rendering libraries or SVG overhead.
  * Instant DOM updates and seamless styling using standard Tailwind utility classes.
  * Workstations, pod dividers, outer boundary walls, and conference rooms participate naturally in the browser layout flow.

---

### ADR-2: Non-Destructive In-Place Template Serving via JSZip
* **Context:** Serving `templates/Workspace_FloorPlan_Template.xlsx` pre-filled with tenant credentials via `ExcelJS` caused severe OpenXML corruption. `ExcelJS`'s internal serializer sorted cell addresses alphabetically using `strcmp` (`"H10"` before `"H2"`). This serialized two overlapping DataValidation ranges (`H10:H401` and `H2:H401`), causing relative formula offsets where Excel evaluated row 15 by checking cell G(15 - 8) = **G7** instead of G15, locking valid rows.
* **Decision:** Bypass `ExcelJS` when serving `GET /api/workspace/template`. Use `JSZip` to load the template binary, modify only cells `A5` and `B5` inside `xl/worksheets/sheet1.xml` via targeted XML regex substitution, and stream the resulting buffer.
* **Consequences:**
  * Sheets 2, 3, 4, and 5 remain 100% untouched at the binary OpenXML level.
  * All conditional formatting and data validation formulas are preserved byte-for-byte as authored.

---

### ADR-3: Dynamic Row-Anchored Data Validation Formulas
* **Context:** Standard Excel validation formulas like `=$G2="Yes"` failed when users entered `"yes "`, `"YES"`, or when localized Excel engines adjusted relative coordinates.
* **Decision:** Formulate all data validations and conditional formattings with uppercase, trimmed, and row-anchored formulas:
  * Column H (Meeting Room Capacity): `=UPPER(TRIM(INDIRECT("G" & ROW())))="YES"`
  * Column I (Meeting Room HDMI): `=AND(UPPER(TRIM(INDIRECT("G" & ROW())))="YES", INDIRECT("I" & ROW())<=INDIRECT("H" & ROW()))`
  * Column F (Workstation HDMI): `=INDIRECT("F" & ROW())<=INDIRECT("E" & ROW())`
* **Consequences:**
  * `ROW()` returns the exact evaluating row dynamically, making the formula immune to coordinate offsets or active selection states.
  * `UPPER(TRIM(...))` guarantees complete case-insensitivity and whitespace tolerance.

---

### ADR-4: 4-Desk Ergonomic Pod Clustering & Column-Wise Placement Order
* **Context:** Flat linear desk rows appear cramped and lack realistic corporate ergonomics. The physical corridor label (`═ CENTRAL CORRIDOR WALKWAY ═`) consumed valuable space.
* **Decision:** Group workstations into ergonomic **4-desk pods** (2 facing 2 setup with `rounded-xl` corners). Remove the artificial corridor strip; corridors are formed naturally by spacing between pods. Arrange pods in a **2-row matrix** that expands column-by-column to the right:
  * Pod 1 (Desks 1–4): Top-Left (Row 0, Col 0)
  * Pod 3 (Desks 5–8): Bottom-Left (Row 1, Col 0)
  * Pod 2 (Desks 9–12): Top-Right (Row 0, Col 1)
  * Pod 4 (Desks 13–16): Bottom-Right (Row 1, Col 1)
  * Pod 5 & 6: Top & Bottom of Column 2 (Row 0 & 1, Col 2), expanding rightward as cubicle counts increase.
* **Consequences:**
  * Logical circulation aisles form between pods.
  * When counts exceed 16 desks, additional clusters expand horizontally rather than vertically, fitting wide landscape viewports up to `1600px`.

```
                  ┌───────────────────────────────────────────────────────────┐
                  │                 OUTER BOUNDARY WALLS                      │
                  │                                                           │
                  │   ┌───────────────┐   ┌───────────────┐   ┌─────────────┐ │
                  │   │ CLUSTER 1     │   │ CLUSTER 2     │   │ CLUSTER 5   │ │
                  │   │ (Top-Left)    │   │ (Top-Col 2)   │   │ (Top-Col 3) │ │
                  │   │ [C-01] [C-02] │   │ [C-09] [C-10] │   │ [C-17] [C-18│ │
                  │   │ [C-03] [C-04] │   │ [C-11] [C-12] │   │ [C-19] [C-20│ │
                  │   └───────────────┘   └───────────────┘   └─────────────┘ │
                  │                                                           │
                  │   ┌───────────────┐   ┌───────────────┐   ┌─────────────┐ │
                  │   │ CLUSTER 3     │   │ CLUSTER 4     │   │ CLUSTER 6   │ │
                  │   │ (Bottom-Left) │   │ (Bottom-Col 2)│   │ (Bottom-Col3│ │
                  │   │ [C-05] [C-06] │   │ [C-13] [C-14] │   │ [C-21] [C-22│ │
                  │   │ [C-07] [C-08] │   │ [C-15] [C-16] │   │ [C-23] [C-24│ │
                  │   └───────────────┘   └───────────────┘   └─────────────┘ │
                  │                                                           │
                  │                     🚪 MAIN ENTRY                         │
                  └───────────────────────────────────────────────────────────┘
```

---

### ADR-5: Symmetrical Round-Robin HDMI Distribution Algorithm
* **Context:** Naive sequential assignment placed all HDMI displays in the first cluster, leaving remaining clusters without monitors.
* **Decision:** Balance HDMI distribution evenly across all active pods:
  * Total pods $P = \lceil N / 4 \rceil$, total HDMI stations $H$.
  * Base per pod $b = \lfloor H / P \rfloor$, remainder $r = H \pmod P$.
  * Pod $i$ receives $k_i = b + (i < r ? 1 : 0)$ HDMI desks.
  * Inside each pod, assign HDMI diagonally (e.g., slot 0 and slot 3 when $k_i = 2$) to achieve balanced facing workstation displays.

---

### ADR-6: Atomic Cascade Tenant Deletion with System Safeguard
* **Context:** Deleting a tenant organization without purging child records leaves orphaned foreign keys. Deleting the `system` tenant locks administrators out of the global control plane.
* **Decision:**
  1. Enforce permanent protection for `subdomain === 'system'` and `code === 'SYSTEM'`.
  2. Implement an atomic `prisma.$transaction` purging all 10 entity models sequentially before removing the organization record.
  3. Write a platform-level `DELETE_ORGANIZATION` audit log.

---

### ADR-7: Multi-Tenant Subdomain Routing with Header Fallback
* **Context:** In production, tenants access the app via subdomains (`acme.deskbooking.com`). In local development and automated testing, all traffic routes through `localhost`.
* **Decision:** Support a multi-tier tenant resolution hierarchy:
  1. Header: `x-tenant-subdomain`
  2. Hostname: parse subdomain from Host header
  3. Query param: `?tenant=<subdomain>`
* **Consequences:**
  * Seamless local development on `localhost:3000` while preserving strict production subdomain isolation.

---

### ADR-8: Automated Relative Luminance Formulation
* **Context:** Custom brand colors can be very dark (Navy `#1e3a8a`, Forest `#065f46`) or very bright (Yellow `#facc15`, Cream `#fef08a`). Fixed text colors lead to unreadable interfaces.
* **Decision:** Implement relative luminance calculation:
  $$Y = 0.299 \times R + 0.587 \times G + 0.114 \times B$$
  * If $Y < 145$: Apply dark theme styling (`text-white`, `text-white/85`, `bg-white/20 text-white border-white/25`).
  * If $Y \ge 145$: Apply light theme styling (`text-slate-950`, `text-slate-800`, `bg-black/10 text-slate-900 border-black/15`).

---

### ADR-9: Chrome Data Breach Alert Neutralization
* **Context:** Standard HTML `<form>` wrappers around email and password inputs cause Google Chrome to intercept submissions and check passwords against public leak databases, triggering alarming "Change your password: Found in a data breach" warnings.
* **Decision:**
  * Eliminate the `<form>` wrapper; use container `<div>` elements with standard button `onClick` handlers.
  * Apply `name="provision_access_credential"`, `autoComplete="new-password"`, `data-lpignore="true"`.
  * Use masked text styling `style={{ WebkitTextSecurity: showPassword ? 'none' : 'disc' }}` with an interactive eye toggle.

---

## 2. Component Hierarchy & State Flow

```
App.tsx
├── TenantProvider (TenantContext.tsx)
└── AuthProvider (AuthContext.tsx)
    └── AppLayout.tsx
        ├── Header.tsx (Dynamic orgColor background & luminance contrast)
        ├── Sidebar.tsx (Collapsible navigation rail w-64 / w-20)
        └── Main Content Area (Route Outlet)
            ├── PlatformAdminDashboard.tsx (Tenant management & cascade deletion modal)
            ├── OrganizationAdminDashboard.tsx (4 KPI metric tiles & dynamic contrast welcome banner)
            ├── WorkspaceSetupPage.tsx (Action Hub at top, 4-step walkthrough below, error banner)
            ├── FloorPlansPage.tsx (Strict NO-SVG 2D Floor Plan Explorer, pod clustering, booking drawer)
            ├── EmployeeRosterPage.tsx (Dedicated Branch Admin table, eye toggle, unassigned template)
            ├── BrandSettingsPage.tsx (Live color picker, logo URL, organization rename)
            └── AuditLogsPage.tsx (Searchable audit trail inspector)
```

---

## 3. Data Flow & Sequence Diagrams

### Sequence 1: 5-Sheet Excel Ingestion & Error Feedback Loop

```
User (Org Admin)          WorkspaceSetupPage            API Server (workspace.routes)        excel.service
       │                          │                                  │                            │
       ├─ Click "Download" ───────┼─ GET /api/workspace/template ────┼─ generateOrgTemplate() ───┤
       │                          │                                  │  (JSZip edits Sheet 1)     │
       │<─ Streams .xlsx ─────────┼<─ Binary File Buffer ────────────┼<─ Returns Buffer ──────────┘
       │
       ├─ Fills 5 Sheets
       ├─ Drops .xlsx File ───────┼─ POST /api/workspace/import ─────┼─ parseAndValidateWorkspace()
       │                          │  (multipart/form-data)           │  (Validates 5 sheets)
       │                          │                                  │
       │                          │                                  │  [IF VALIDATION FAILS]
       │                          │                                  ├─ Inject red ERRORS column
       │                          │<─ HTTP 422 (JSON + Base64) ──────┼<─ Return annotated workbook
       │<─ Red Error Banner ──────┤                                  │
       │<─ Download Annotated ────┤
       │
       │                          │                                  │  [IF VALIDATION PASSES]
       │                          │                                  ├─ prisma.$transaction()
       │                          │                                  │   - Delete old branches
       │                          │                                  │   - Insert hierarchy
       │                          │                                  │   - Create desks & rooms
       │                          │<─ HTTP 200 (Success Stats) ──────┼<─ Return Stats
       │<─ Green Success Card ────┤
       │<─ Unlock Floor Plans ────┤
```

### Sequence 2: Floor Plan Exploration & Workstation Booking Flow

```
User (Org Admin)           FloorPlansPage             API Server (workspace.routes)        PostgreSQL (Prisma)
       │                          │                                  │                            │
       ├─ Mounts Page ────────────┼─ GET /workspace/hierarchy ───────┼─ prisma.branch.findMany() ─┤
       │                          │<─ Returns Nested JSON Tree ──────┼<─ Return Branch/Desk data ─┘
       │                          │
       ├─ Selects Branch/Floor ───┤ (Pure React State Updates)
       │                          ├─ Computes 4-Desk Pods
       │                          ├─ Applies HDMI Round-Robin
       │<─ Renders Pure HTML5 ────┤
       │
       ├─ Clicks Desk C-03 ───────┤
       │<─ Opens Slide Drawer ────┤
       │
       ├─ Clicks "Reserve Desk" ──┼─ POST /workspace/book-desk ──────┼─ prisma.$transaction() ────┐
       │                          │  { deskId: "uuid" }              │   - Desk.status = 'BOOKED' │
       │                          │                                  │   - Create Booking         │
       │                          │                                  │   - Create AuditLog        │
       │                          │<─ Returns Booking Result ────────┼<─ Commit Transaction ──────┘
       │                          ├─ Re-fetches Hierarchy
       │<─ Desk Turns Red (Booked)┤
```

### Sequence 3: Branch Administrator Revocation & State Rollback Flow

```
User (Org Admin)         EmployeeRosterPage            API Server (roster.routes)          PostgreSQL (Prisma)
       │                          │                                  │                            │
       ├─ Clicks "Delete Admin" ──┤
       │<─ Shows Confirm Modal ───┤
       │
       ├─ Confirms Deletion ──────┼─ DELETE /roster/branch-admin/:id ┼─ prisma.user.delete() ─────┐
       │                          │                                  │  where: { id }             │
       │                          │                                  ├─ prisma.auditLog.create() ─┤
       │                          │                                  │  REVOKE_BRANCH_ADMIN       │
       │                          │<─ HTTP 200 OK ───────────────────┼<─ Deletion Confirmed ──────┘
       │                          ├─ Re-fetches Branch Admins
       │<─ Branch Rolls Back ─────┤
       │   - Admin: "Pending"     │
       │   - Email: "—"           │
       │   - Badge: Amber         │
       │   - Button: "+ Assign"   │
```

---

## 4. Security & Hardening Architecture

1. **Password Hashing:** All credentials are hashed using `bcryptjs` with a work factor of 10 rounds.
2. **Session Tokens:** Stateless JSON Web Tokens (`JWT`) signed with HMAC-SHA256 (`JWT_SECRET`), expiring in 7 days, containing `id`, `email`, `role`, and `organizationId`.
3. **DDoS & Brute-Force Throttling:** `express-rate-limit` enforces a ceiling of 500 requests per 15-minute window per IP.
4. **HTTP Security Headers:** `helmet()` injects standard security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Strict-Transport-Security`).
5. **CORS Dynamic Reflection:** `cors({ origin: true, credentials: true })` permits authenticated cross-origin requests from custom enterprise subdomains.
6. **Upload Payload Boundaries:** `multer({ limits: { fileSize: 10 * 1024 * 1024 } })` restricts uploads to 10MB in memory, preventing memory exhaustion attacks.
