# Master Architecture Plan: Multi-Tenant Workspace & Floor Plan System

## 1. Project Overview & Role Scoping

This document serves as the permanent, authoritative blueprint for the Multi-Tenant Desk Booking platform's workspace setup, ingestion pipeline, and interactive floor plan booking system.

### Role Scope & Boundaries
1. **Platform Administrator (`PLATFORM_ADMIN`):**
   * **Status:** 100% Complete.
   * **Scope:** Superadmin control plane. Registers enterprise tenant organizations, manages subdomains, inspects platform-level audit logs.
2. **Global Organization Administrator (`ORGANIZATION_ADMIN`):**
   * **Status:** Core active development.
   * **Scope:** Tenant facility and workspace administrator.
   * **Workflow Shift:** Legacy individual "Create Branch" and "Workspace Tree" models are removed in favor of the unified **Excel-driven Workspace Ingestion Pipeline ("Workspace Setup")** and the **Interactive Floor Plan Explorer**.
3. **Branch Administrator (`BRANCH_ADMIN`):**
   * **Status:** Completely removed from current scope. All workspace configuration is centralized under the Global Organization Admin.
4. **Employee (`EMPLOYEE`):**
   * **Status:** Future phase.
   * **Scope:** Interactive desk and meeting room booking on the generated 2D floor plan within strictly assigned branch/building boundaries.

---

## 2. Organization Admin Navigation & Two-Page Architecture

### A. Sidebar Navigation Structure
* **Active Sidebar Items:**
  1. `Dashboard` (`/`) — Clean organizational overview.
  2. `Workspace Setup` (`/admin/workspace-setup`) — Excel template download, simulation walkthrough, and upload/validation engine.
  3. `Floor Plans` (`/admin/floor-plans`) — Interactive 2D floor plan explorer (appears in navigation after workspace ingestion).
  4. `Employee Roster` (`/admin/roster`) — Corporate user management.
  5. `Brand Settings` (`/admin/branding`) — Dynamic color wheel, logo upload, and subdomain settings.
  6. `Audit Logs` (`/admin/audit`) — Security and setup audit trails.

---

### B. Page 1: Workspace Setup (`/admin/workspace-setup`)
1. **Interactive Guided Simulation:**
   * A visual step-by-step progress guide explaining the ingestion lifecycle (Download $\rightarrow$ Fill $\rightarrow$ Upload $\rightarrow$ Validation).
2. **Template Download Engine:**
   * One-click download of `Workspace_FloorPlan_Template.xlsx` with `Organization ID` and `Organization Name` pre-filled.
3. **Upload & Verification Zone:**
   * Drag-and-drop `.xlsx` file upload.
   * Real-time validation against all 5 sheets.
   * **If Valid:** Displays green success state and unlocks the `Floor Plans` navigation.
   * **If Invalid:** Displays prominent red error banner and provides an immediate download link for the annotated Excel file containing the sheet-specific `ERRORS` column.

---

### C. Page 2: Floor Plan Explorer (`/admin/floor-plans`)
1. **Hierarchical Drill-Down Navigation:**
   * Cascade selector bar:
     $$\text{Select Branch} \longrightarrow \text{Select Building} \longrightarrow \text{Select Floor} \longrightarrow \text{Select Section}$$
2. **Focused Section View:**
   * Renders the complete architectural 2D floor plan for the selected section.
   * Quick-selector tabs at the top allow immediate toggling between sections on the active floor (`[ First North ] [ First South ] [ First East ] [ First West ]`).

---

## 3. The 5-Sheet Cascading Excel Template Specification

File: `Workspace_FloorPlan_Template.xlsx` (in project root)

### Visual Legend:
* 🔒 **Grey Cells:** Formula/System generated. Protected from direct manual edits.
* ✍️ **Yellow Cells:** Required user input fields.
* 🔽 **Yellow Dropdown Cells:** Restricted choice inputs (`Yes` / `No`).
* 🚫 **Muted Grey Cells with Auto-Lockout:** Dynamically disabled inputs when parent options are `No` or blank.

---

### Sheet 1: `Organization`
* **Col A:** 🔒 `Organization ID` (Pre-filled by backend, e.g., `ORG-2026-001`)
* **Col B:** 🔒 `Organization Name` (Pre-filled by backend, e.g., `Acme Global Corporation`)
* **Col C:** ✍️ `Number of Branches (Enter Count)` (Mandatory user input)

---

### Sheet 2: `Branches`
* **Col A:** 🔒 `Branch ID` (Auto-generated: `BR001`, `BR002`... based on Sheet 1 count)
* **Col B:** ✍️ `Branch Name` (Mandatory user input, e.g., `Mumbai`, `New York`)
* **Col C:** ✍️ `Number of Buildings` (Mandatory user input, e.g., `2`, `3`)
* *Hidden Col D: Cumulative Building indexing engine.*

---

### Sheet 3: `Buildings`
* **Col A:** 🔒 `Branch Name` (**Show Once per Group:** Appears only on the first building of that branch; subsequent rows under that branch stay visually blank)
* **Col B:** 🔒 `Building ID` (Auto-generated: `BLD001`, `BLD002`...)
* **Col C:** ✍️ `Building Name` (Mandatory user input, e.g., `Kafka Tower`, `Kubernetes Building`)
* **Col D:** ✍️ `Number of Floors` (Mandatory user input, e.g., `2`, `4`)
* *Visual Grouping: Distinct divider border line between branch groups.*
* *Hidden Cols E, F, G: Indexing and state tracking engines.*

---

### Sheet 4: `Floors`
* **Col A:** 🔒 `Branch Name` (Show Once per Branch Group)
* **Col B:** 🔒 `Building ID` (Show Once per Building Group)
* **Col C:** 🔒 `Building Name` (Show Once per Building Group)
* **Col D:** 🔒 `Floor ID` (**Building-Scoped Compound Format:** `[BuildingNum]-FL[FloorNum]`, e.g., `1-FL01`, `1-FL02`, `2-FL01`, `10-FL01`. Floor index visibly resets to `01` for each building)
* **Col E:** ✍️ `Number of Sections (Max 4: East, West, North, South)` (Mandatory user input: integer `1` to `4`, width expanded to 56)
* *Visual Grouping: Distinct divider border between buildings.*
* *Hidden Cols F–L: Building numbering, floor numbering, and section index engines.*

---

### Sheet 5: `Sections & Cubicles`
* **Col A:** 🔒 `Branch Name` (Show once per branch group)
* **Col B:** 🔒 `Building Name` (Show once per building group)
* **Col C:** 🔒 `Floor ID` (Show once per floor group, e.g., `1-FL01`)
* **Col D:** 🔒 `Section Name` (Auto-generated compound name, e.g., `First North`, `First South`, `Second East`...)
* **Col E:** ✍️ `Number of Cubicals (Excluding Meeting Room)` (Mandatory user input)
* **Col F:** ✍️ `Number of Cubicals Having HDMI` (Mandatory user input; Validation rule: $\le \text{Col E}$)
* **Col G:** 🔽 `Meeting Room (Yes or No)` (Mandatory dropdown: `Yes` or `No`)
* **Col H:** ✍️ `Number of Cubicals Inside Meeting Room` (Dynamic Lockout & Conditional Formatting)
* **Col I:** ✍️ `Number of Cubicals Having HDMI (Meeting Room)` (Dynamic Lockout & Conditional Formatting; Validation rule: $\le \text{Col H}$, width expanded to 54)
* *Visual Grouping: Distinct divider border between floors and buildings.*
* *Hidden Cols J–M: Real hierarchy mapping engines.*

---

### D. Implemented Native Excel Meeting Room Dynamic Lockout & Formatting
* **Dynamic Conditional Formatting:**
  * When `Meeting Room = "No"` (or empty):
    * Columns H & I are automatically formatted in **muted disabled grey (`#E2E8F0`) with grey italic text**.
  * When `Meeting Room = "Yes"`:
    * Columns H & I **instantly illuminate in bright yellow (`#FFF2CC`)** indicating active editable fields.
* **Strict Excel Data Validation Auto-Lockout:**
  * **Col H Validation:** Custom formula `=$G2="Yes"`. If the user attempts to enter a number when Meeting Room is "No", Excel displays an immediate error alert: *"Meeting Room is set to 'No' or blank. Set 'Meeting Room (Yes or No)' to 'Yes' to enter meeting room cubicles."*
  * **Col I Validation:** Custom formula `=AND($G2="Yes", I2<=H2)`. Enforces both `Meeting Room = "Yes"` and $\text{Meeting Room HDMI} \le \text{Meeting Room Capacity}$.

---

## 4. Excel Parser & Error-Handling Engine

### A. Ingestion Workflow
1. Admin uploads completed `.xlsx` on `/admin/workspace-setup`.
2. Backend Excel parser initiates multi-tier validation across all 5 sheets.

### B. Validation Rules
* **Mandatory Field Presence:** No required yellow cell left empty.
* **Data Type Consistency:** Counts must be positive integers ($> 0$).
* **HDMI Constraints:**
  $$\text{HDMI Cubicles} \le \text{Number of Cubicals (Excluding Meeting Room)}$$
  $$\text{Meeting Room HDMI} \le \text{Number of Cubicals Inside Meeting Room}$$
* **Meeting Room Consistency:** If `Meeting Room` = `Yes`, meeting room capacity must be $> 0$. If `No`, capacity and meeting room HDMI must be $0$ or blank.
* **Parent-Child Integrity:** Expanded row totals must match parent sheet counts.

### C. Error Annotation & Re-Download Loop
* **If Successful:**
  * Commits Organization $\rightarrow$ Branches $\rightarrow$ Buildings $\rightarrow$ Floors $\rightarrow$ Sections $\rightarrow$ Desks/Meeting Rooms in a single atomic transaction.
  * Displays green success banner: *"Workspace structure and floor plan successfully generated."*
* **If Errors Exist:**
  * Database transaction is completely aborted (0 dirty records saved).
  * Web portal displays prominent red alert banner: *"Upload failed: X errors found. Please re-download the annotated file to inspect issues."*
  * **Sheet-Specific Error Column:**
    * An extra column called **`ERRORS`** is appended **only to sheets where errors occurred**.
    * Sheets without errors remain completely clean.
    * Inside the `ERRORS` column, row-by-row plain-text descriptions specify the exact issue.
  * User downloads the annotated file, rectifies the mistakes, and re-uploads until validation passes.

---

## 5. Sub-Database Architecture (Prisma & PostgreSQL)

```
┌────────────────────────────────────────────────────────────────────────┐
│ Organization                                                           │
│  ├── id (UUID, PK)                                                     │
│  ├── name (String)                                                     │
│  ├── code (String, Unique)                                             │
│  └── subdomain (String, Unique)                                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1 : N
┌───────────────────────────────────▼────────────────────────────────────┐
│ Branch                                                                 │
│  ├── id (UUID, PK)                                                     │
│  ├── organizationId (FK)                                               │
│  ├── name (String)                                                     │
│  └── code (String, e.g., "BR001")                                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1 : N
┌───────────────────────────────────▼────────────────────────────────────┐
│ Building                                                               │
│  ├── id (UUID, PK)                                                     │
│  ├── branchId (FK)                                                     │
│  ├── name (String)                                                     │
│  └── code (String, e.g., "BLD001")                                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1 : N
┌───────────────────────────────────▼────────────────────────────────────┐
│ Floor                                                                  │
│  ├── id (UUID, PK)                                                     │
│  ├── buildingId (FK)                                                   │
│  ├── code (String, e.g., "1-FL01")                                      │
│  ├── floorNumber (Int)                                                 │
│  └── name (String, e.g., "First Floor")                                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1 : N
┌───────────────────────────────────▼────────────────────────────────────┐
│ Section                                                                │
│  ├── id (UUID, PK)                                                     │
│  ├── floorId (FK)                                                      │
│  ├── name (String, e.g., "First North")                                │
│  ├── direction (Enum: NORTH, SOUTH, EAST, WEST)                        │
│  ├── standardDeskCount (Int)                                           │
│  └── hdmiDeskCount (Int)                                               │
└───────────────────────┬────────────────────────────────┬───────────────┘
                        │ 1 : N                          │ 1 : 1
┌───────────────────────▼────────────────────────┐ ┌─────▼───────────────┐
│ Desk / Cubicle                                 │ │ MeetingRoom         │
│  ├── id (UUID, PK)                             │ │  ├── id (UUID, PK)  │
│  ├── sectionId (FK)                            │ │  ├── sectionId (FK) │
│  ├── deskCode (String, e.g., "C-01")           │ │  ├── name (String)  │
│  ├── hasHdmi (Boolean)                         │ │  ├── capacity (Int) │
│  └── status (Enum: AVAILABLE, BOOKED)          │ │  └── hasHdmi (Bool) │
└───────────────────────┬────────────────────────┘ └─────────────────────┘
                        │ 1 : N
┌───────────────────────▼────────────────────────┐
│ Booking                                        │
│  ├── id (UUID, PK)                             │
│  ├── deskId (FK)                               │
│  ├── userId (FK)                               │
│  ├── startTime (DateTime)                      │
│  ├── endTime (DateTime)                        │
│  └── status (Enum: CONFIRMED, CANCELLED)       │
└────────────────────────────────────────────────┘
```

---

## 6. Interactive 2D Floor Plan Engine: Pure React + HTML5 Divs + CSS (STRICT NO-SVG)

### A. Architectural Constraint: NO SVG
* **Client / Academic Requirement:** Absolutely **zero SVG elements** (`<svg>`, `<path>`, `<circle>`, `<polygon>`, etc.) may be used in the floor plan generator or anywhere in the workspace viewer.
* **Solution:** The entire architectural floor plan is engineered using **Pure React + Semantic HTML5 `<div>` Elements + Tailwind CSS (CSS Grid & Flexbox)**.

---

### B. Layout Architecture Using Semantic HTML & CSS

1. **Outer Boundary Walls (Rectangular Structural Enclosure):**
   * An outer `<div>` container styled with crisp, solid architectural borders:
     `border-4 border-slate-900 bg-slate-100/40 p-6 rounded-none relative`
   * **Entry Gap:** An architectural break at the bottom perimeter representing the floor entrance:
     A bottom center `<div>` with `border-t-0 bg-white px-6 py-1 text-[11px] font-black tracking-widest text-slate-700 uppercase`.

2. **Central Walkway / Corridor:**
   * A clean rectangular hallway dividing the floor sections using standard CSS flex/grid dividers:
     `border-dashed border-2 border-slate-300 bg-slate-50/80` with a centered `CORRIDOR` label.

3. **Walled Private / Meeting Room Blocks:**
   * Pure rectangular containers positioned along the perimeter:
     `border-2 border-slate-700 bg-white p-4 shadow-sm relative`
   * Doorway represented by a designated break in the border (`border-r-0` or open doorway gap).
   * Displays room title (e.g. `MEETING ROOM (8 SEATS)`) and houses individual curved cubicles.

4. **Cubicle & Workstation Geometry (Rectangles with Curved Corners):**
   * Each workstation is a rectangular/square button or `<div>`:
     `w-16 h-14 rounded-xl border-2 font-bold flex flex-col items-center justify-center transition-all duration-150 cursor-pointer shadow-sm`
   * **Curved Corners:** Rounded with `rounded-xl` or `rounded-2xl` (just like modern UI action buttons).
   * **Dynamic Grid Scaling:** Workstations are arranged into pod clusters using standard CSS Grid:
     `grid grid-cols-4 gap-3` (e.g. 2 rows $\times$ 4 columns facing each other).

---

### C. Desk Color Coding & Badges (No SVG)
* 🟢 **Available Workstation:** `bg-emerald-100 border-emerald-400 text-emerald-900 hover:bg-emerald-200 hover:shadow-md`
* 🔴 **Reserved / Occupied Workstation:** `bg-red-100 border-red-300 text-red-700 opacity-90 cursor-not-allowed`
* 🔵 **Current User Reservation:** `bg-blue-100 border-blue-500 text-blue-900 ring-2 ring-blue-400`
* 🖥️ **HDMI Badge (Pure CSS / Text Glyph):**
  * A micro badge underneath the desk code (`C-01`):
    `text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 font-extrabold flex items-center gap-1`
    *(Utilizes pure HTML/Unicode/text glyphs, zero SVG)*.

---

---

## 8. Platform Administrator Login Error: Root Cause Analysis & Resolved Fix

### A. Issue Description
When attempting to log in as Platform Administrator (`admin@deskbooking.com`) via Autofill, the console displayed:
> `Request failed with status 500`
> Terminal log: `[vite] http proxy error: /api/auth/login AggregateError [ECONNREFUSED]`

### B. Root Causes
1. **Startup Race Condition on Windows:**
   * In `run.bat`, the browser was set to open automatically after only 4 seconds (`timeout /t 4`).
   * On Windows, `ts-node-dev` in `apps/api` took approximately 60–90 seconds to compile and bind to port 4000.
   * When the user clicked "Autofill" and "Sign In to Console", Vite's proxy at `localhost:3000` attempted to forward the request to `http://localhost:4000`. Since the backend was still booting up, Node's proxy threw `AggregateError [ECONNREFUSED]` and returned HTTP status 500 to the browser.
2. **IPv6 vs IPv4 Resolution Latency:**
   * In Vite's proxy configuration, `target: 'http://localhost:4000'` resolved to IPv6 `::1` before IPv4 `127.0.0.1`, causing connection retry stalls on Windows.
3. **Database Seed Password Persistence:**
   * In `apps/api/prisma/seed.ts`, the `user.upsert` for `admin@deskbooking.com` only updated the `role` field on duplicate runs, leaving any previously mismatched password hash unchanged.

### C. Resolution Implemented (Code Fixed)
1. **Vite Proxy Target:** Updated `apps/web/vite.config.ts` to `http://127.0.0.1:4000` (direct IPv4 binding, avoiding IPv6 timeout errors).
2. **Seed Idempotency:** Updated `apps/api/prisma/seed.ts` so that `passwordHash` and `mustChangePassword: false` are explicitly updated every time `pnpm db:seed` runs.
3. **Startup Delay:** Increased browser launch timer in `run.bat` to 10 seconds (`timeout /t 10`) to allow `apps/api` to initialize before browser requests arrive.
4. **Verification:** Re-seeded the database (`pnpm db:seed`) to guarantee active credentials for `admin@deskbooking.com` with `DeskBook#2026!AdminSec`.

---

## 9. Google Password Manager "Change Your Password" Alert: Explanation & Handling

### A. Issue Description (Image 3)
After signing in or signing up as Organization Admin, Google Chrome displayed a browser popup:
> *"Change your password: The password you just used was found in a data breach. Google Password Manager recommends changing your password now."*

### B. Explanation
* This is **NOT an application modal or code bug**; it is Google Chrome's native client-side credential protection feature.
* Chrome intercepts password submissions and hashes them to check against the public HaveIBeenPwned database of compromised passwords.
* Standard demo passwords like `DeskBook#2026!AdminSec`, `Password123!`, or simple passwords commonly used in corporate defaults trigger this warning because they have appeared in historical data leaks.

### C. Mitigation Strategy in Planning
1. **Demo Credentials:** Use higher-entropy default demo passphrases that have never appeared in public breach databases (e.g., `DbK#98$mX!vP2026`).
2. **User Guidance:** Add a brief tip in the UI informing admins that when creating real tenant accounts, they should choose unique personal passwords to avoid browser breach warnings.
3. **Application Password Flag:** Ensure that `mustChangePassword` is set to `false` for self-registered Organization Admins so the internal `/change-password` page is never triggered inappropriately.

---

## 10. Dynamic Floor Plan Pod Clustering & Column-Wise Expansion Algorithm

### A. Architectural Goals & Cluster Geometry
1. **Eliminate the Physical Corridor Strip:** Remove the `═ CENTRAL CORRIDOR WALKWAY ═` text container completely. Circulation walkways are formed naturally by open spacing between pods.
2. **Atomic 4-Desk Pod Unit (2 $\times$ 2 Facing Setup):**
   * Desks are grouped into ergonomic pods of 4: 2 facing 2 across a central desk divider:
     ```
     ┌──────────────┐  ┌──────────────┐
     │  Desk C-01   │  │  Desk C-02   │  <- Row 1 (Facing South)
     ├──────────────┤  ├──────────────┤
     │  Desk C-03   │  │  Desk C-04   │  <- Row 2 (Facing North)
     └──────────────┘  └──────────────┘
     ```
   * Enclosed in an architectural pod container with subtle border and curved corners.

### B. Column-Wise Placement & Expansion Order
Pods are arranged in a **2-row matrix** (Top Row & Bottom Row) that fills column-by-column, expanding horizontally to the right:

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

1. **First 4 Clusters ($\le 16$ Desks):**
   * **Cluster 1 (Desks 1–4):** Top-Left (Row 0, Col 0)
   * **Cluster 3 (Desks 5–8):** Bottom-Left (Row 1, Col 0)
   * **Cluster 2 (Desks 9–12):** Top-Right (Row 0, Col 1)
   * **Cluster 4 (Desks 13–16):** Bottom-Right (Row 1, Col 1)
2. **Rightward Expansion ($> 16$ Desks):**
   * If more than 16 desks are defined, additional clusters are added to the right:
     * **Cluster 5 (Desks 17–20):** Placed to the right of Cluster 2 (Row 0, Col 2).
     * **Cluster 6 (Desks 21–24):** Placed to the right of Cluster 4 (Row 1, Col 2).
     * **Cluster 7 & 8:** Placed in Column 3, and so on.
3. **Dynamic Zoom / Scale Containment:**
   * When more columns are generated (e.g. 3 or 4 columns for 24–32 desks), the layout dynamically scales down the pod and cubicle dimensions (e.g. `scale-90`, `scale-75` or compact width/padding classes) so that all clusters remain perfectly contained inside the outer rectangular walls without overflow.
4. **Handling Less Than 8 Desks:**
   * If 4 desks are entered: Only Cluster 1 (Top-Left, or centered) is rendered.
   * If 8 desks are entered: Cluster 1 (Top-Left) and Cluster 3 (Bottom-Left) are rendered, balanced symmetrically so they don't look cramped or leave awkward empty gaps.

### C. Symmetrical Round-Robin HDMI Distribution
* **Goal:** Avoid clustering all HDMI stations in the first pod.
* **Algorithm:**
  * Let total active pods $P = \lceil N / 4 \rceil$ and total HDMI count $H$.
  * Base HDMI per pod: $b = \lfloor H / P \rfloor$, remainder $r = H \pmod P$.
  * Each pod $i$ receives $k_i = b + (i < r ? 1 : 0)$ HDMI desks.
  * Inside each pod, HDMI badges are placed diagonally/symmetrically (e.g. 1 on top row, 1 on bottom row) so team pods have balanced monitor distribution.
  * *Example:* 16 desks (4 pods) and 8 HDMI $\implies$ Exactly 2 HDMI in each of the 4 clusters.

---

## 11. Collapsible Sidebar (Hamburger Menu Toggle)

### A. Purpose
To maximize the horizontal viewing area for the 2D floor plan and workspace management, the left-hand navigation bar can be collapsed into a compact icon-only strip.

### B. Implementation Specifications
1. **Hamburger Button:** Placed at the top of the Sidebar next to the navigation title.
2. **Expanded State (`w-64`):** Default full view displaying both icons and labels:
   * Dashboard (`LayoutDashboard`)
   * Workspace Setup (`FileSpreadsheet`)
   * Floor Plans (`MapPin`)
   * Employee Roster (`Users`)
   * Brand Settings (`Palette`)
   * Audit Logs (`ShieldCheck`)
3. **Collapsed State (`w-16` / `w-20`):** Compact vertical rail displaying only icons centered horizontally.
   * Hover tooltips display the page title.
   * Smooth transition animation (`transition-all duration-200`).
4. **Interactive Toggle:** Clicking the hamburger icon toggles between expanded and collapsed states smoothly.

---

## 12. Dynamic White-Label Brand Theming with Intelligent Contrast Adaptation

### A. Purpose
When an Organization Admin customizes their brand color in Brand Settings (`/admin/branding`), the **entire topmost navigation bar** (`Navbar.tsx`) should dynamically reflect the selected color, while all text, icons, and badges automatically adjust to maintain optimal readability.

### B. Technical Specifications
1. **Full Navbar Background Theming:**
   * The top navigation bar adopts `style={{ backgroundColor: activeOrg.themeColor }}` instead of a simple border strip.
2. **Intelligent Automatic Contrast Calculation:**
   * Compute the perceived luminance $Y$ of the hex theme color:
     $$Y = 0.299 \times R + 0.587 \times G + 0.114 \times B$$
   * **If $Y < 140$ (Dark Theme Color, e.g., Deep Purple `#6b21a8`, Navy `#1e3a8a`, Slate `#0f172a`, Forest Green `#065f46`):**
     * Text switches to pre-coded **Crisp Light Shade** (`text-white` / `text-slate-100`).
     * Subtitles and icons switch to soft white (`text-white/80`).
     * Badges switch to semi-transparent white containers (`bg-white/15 text-white border-white/20`).
   * **If $Y \ge 140$ (Light Theme Color, e.g., Yellow `#facc15`, Cream `#fef08a`, Pastel Lavender, Soft Cyan):**
     * Text switches to pre-coded **Crisp Dark Shade** (`text-slate-950` / `text-slate-900`).
     * Subtitles and icons switch to dark slate (`text-slate-700`).
     * Badges switch to semi-transparent dark containers (`bg-black/10 text-slate-900 border-black/15`).
3. **Instant Live Preview:**
   * Updates immediately in real time as the admin moves the color picker in Brand Settings.

---

## 13. Resolution: Vite Proxy ECONNREFUSED Terminal Error Fix

### A. Root Cause Analysis
* When launching the platform via `run.bat`, `apps/web dev` (Vite) initialized in ~8.7 seconds on port 3000.
* The previous batch script opened the browser via `timeout /t 10`.
* However, on Windows, `apps/api dev` (`ts-node-dev`) took approximately 60–75 seconds to compile all TypeScript files and bind to port 4000.
* Consequently, when the browser loaded `http://localhost:3000`, the React application mounted and `TenantContext` immediately requested `/api/auth/organizations`.
* Because port 4000 was not yet listening, Vite's reverse proxy emitted:
  `[vite] http proxy error: /api/auth/organizations`
  `Error: connect ECONNREFUSED 127.0.0.1:4000`
* Once the backend finished booting, subsequent requests succeeded completely, leaving the app functioning normally.

### B. Implementation Fix
1. **Intelligent Port Polling in `run.bat`:**
   * Replaced the static `timeout /t 10` with a lightweight, native PowerShell TCP socket loop:
     ```cmd
     powershell -NoProfile -Command "$c = New-Object System.Net.Sockets.TcpClient; while (-not $c.Connected) { try { $c.Connect('127.0.0.1', 4000) } catch { Start-Sleep -Milliseconds 800 } }; $c.Close(); Start-Process 'http://localhost:3000'"
     ```
   * The browser is now launched **only after** the backend server has bound to port 4000 and is ready to accept incoming HTTP requests.
2. **Vite Proxy Error Handler in `vite.config.ts`:**
   * Added a graceful error event listener to Vite's proxy configuration:
     ```ts
     configure: (proxy) => {
       proxy.on('error', (err, _req, res) => {
         if ((err as any).code === 'ECONNREFUSED') {
           if (res && typeof (res as any).writeHead === 'function' && !(res as any).headersSent) {
             (res as any).writeHead(503, { 'Content-Type': 'application/json' });
             res.end(JSON.stringify({ error: 'API Server is initializing, please retry.' }));
           }
         }
       });
     }
     ```
   * Prevents noisy unhandled error stack traces in the terminal during startup.

---

## 14. Investigation & Solution: Excel Meeting Room Lockout Glitch (Image 1)

### A. Problem Observed in Image 1
* In Sheet 5 (`Sections & Cubicles`), row 21 has Column G set to `yes`.
* However, cell H21 remained muted gray (disabled styling), and entering `21` into cell H21 triggered the Excel alert modal:
  *"Meeting Room Disabled: Meeting Room is set to 'No' or blank. Set 'Meeting Room (Yes or No)' to 'Yes' to enter meeting room cubicles."*
* Other rows (e.g., rows 10, 11, 17, 18) functioned normally and allowed capacity input.

### B. Root Cause
* In `Workspace_FloorPlan_Template.xlsx`, Data Validation and Conditional Formatting were defined with:
  * Data Validation: `formula1='=$G2="Yes"'`
  * Conditional Formatting: `formula=['$G2="Yes"']`
* In Excel, string comparison `=$G2="Yes"` is vulnerable to subtle user input variations:
  1. **Trailing Whitespace:** If a user types `yes ` (with a trailing space before hitting Enter or via autocomplete), `"yes "` does not equal `"Yes"`.
  2. **Leading Whitespace:** If copied from external data with a leading space (`" yes"`), the condition fails.
  3. **Case Variations in Certain Locale/Excel Engines:** While standard Excel `=A1="Yes"` is generally case-insensitive, custom Data Validation rules in certain localized desktop Excel builds enforce strict matching against the formula literal.

### C. Proposed Solution (For Implementation Phase)
* Upgrade both the Data Validation rule and the Conditional Formatting rule to be completely case-insensitive and whitespace-tolerant:
  * **Column H (Capacity) Data Validation:**
    `=UPPER(TRIM($G2))="YES"`
  * **Column I (HDMI) Data Validation:**
    `=AND(UPPER(TRIM($G2))="YES", I2<=H2)`
  * **Conditional Formatting Rules:**
    * Unlocked Yellow Rule: `=UPPER(TRIM($G2))="YES"`
    * Disabled Gray Rule: `=UPPER(TRIM($G2))<>"YES"`
* This guarantees that whether a user selects from the dropdown or manually types `yes`, `Yes`, `YES`, or `yes ` (with whitespace), Excel will always recognize the field as enabled.

---

## 15. Dynamic Welcome Banner Theming in Organization Admin Dashboard (Image 2)

### A. Requirement
* In `OrganizationAdminDashboard.tsx`, the top welcome banner currently uses a static green gradient:
  `bg-gradient-to-r from-emerald-800 to-teal-700 text-white`
* It must dynamically update to match the organization's selected brand `themeColor` configured in Brand Settings.

### B. Intelligent Luminance Contrast
* Apply the same relative luminance algorithm ($Y = 0.299R + 0.587G + 0.114B$):
  * **If Dark Color ($Y < 145$, e.g., Purple `#6b21a8`, Navy `#1e3a8a`, Slate `#0f172a`):**
    * Background: `style={{ backgroundColor: orgColor }}`
    * Heading: `text-white`
    * Subtitle: `text-white/85`
    * Panel Badge: `bg-white/20 text-white border-white/20`
  * **If Light Color ($Y \ge 145$, e.g., Yellow `#facc15`, Cream `#fef08a`, Pale Lavender):**
    * Background: `style={{ backgroundColor: orgColor }}`
    * Heading: `text-slate-950`
    * Subtitle: `text-slate-800`
    * Panel Badge: `bg-black/10 text-slate-900 border-black/15`

---

## 16. Workspace Setup Page Layout Optimization (Image 3)

### A. Requirement
* In `WorkspaceSetupPage.tsx`, simplify the layout to bring actionable operational controls front-and-center:
  1. **Remove Decorative Banner:** Remove the large top green container displaying *"Workspace & Floor Plan Ingestion Engine"*.
  2. **Move Action Hub to the Top:** Place the 2-column Action Hub (Step 1: Download Workspace Template and Step 2: Upload Completed Spreadsheet, along with upload status, error cards, and success statistics) at the **very top** of the page.
  3. **Reposition Walkthrough Below:** Move the *"INGESTION LIFECYCLE WALKTHROUGH"* (the 4-step instructional cards: Download $\rightarrow$ Fill $\rightarrow$ Upload $\rightarrow$ Explore) directly below the Action Hub.
* **Benefit:** Admins can immediately download the template and drop files without scrolling.

---

## 17. Employee Roster & Branch Administrator Architecture

### A. Access Guard & Prerequisite Gatekeeping
* The Employee Roster page (`/admin/roster`) is accessible to Organization Administrators.
* **Prerequisite State Check:**
  * If the organization has **not yet completed workspace setup** (0 branches found in database), the page displays a locked educational state:
    * Icon: 🏢
    * Title: *"Workspace Configuration Required"*
    * Description: *"Please complete your workspace setup first. Once your physical branches are defined through the Excel ingestion pipeline, you will be able to assign branch administrators and manage the employee roster."*
    * Action Button: Linking directly to `/admin/workspace-setup`.
  * If the workspace setup has been completed, the branch roster and assignment interface unlocks automatically.

### B. Automatic Branch Extraction
* Query all branches under the organization from PostgreSQL (`GET /api/workspace/branches`).
* Displays each branch with its associated administrator information.

### C. Dual Ingestion Mode

#### Mode 1: Excel Bulk Upload (Initial Setup & Batch Provisioning)
1. **Download Branch Admin Template:**
   * Action button: *"Download Branch Admin Template"*.
   * Backend generates an Excel file: `Branch_Admin_Roster_[ORG].xlsx`.
   * Columns:
     * `Branch ID` (Pre-filled, read-only grey, e.g., `BR001`)
     * `Branch Name` (Pre-filled, read-only grey, e.g., `Mumbai HQ`)
     * `Administrator Name` (Yellow user input)
     * `Administrator Email` (Yellow user input)
     * `Default Password` (Yellow user input)
2. **Upload & Validation:**
   * Checks that all required rows have Name, Email, and Password.
   * Validates email format using universal RFC standard.
   * Atomically upserts user records in PostgreSQL with role `BRANCH_ADMIN`, linked to their respective `branchId` and `organizationId`.

#### Mode 2: In-Page Manual Entry & Table Management
1. **Interactive Data Table:**
   * Displays columns:
     * `Branch Name` (Note: `Branch ID` is hidden from the UI as requested).
     * `Administrator Name`
     * `Email Address`
     * `Status` (Active / Unassigned)
     * `Actions` (Edit / Reassign / Remove)
2. **Manual Row Addition:**
   * Button: *"Assign Administrator"*.
   * Modal or inline form allowing the admin to select the branch from a dropdown and enter Name, Email, and Password.
   * Persists directly to the database via API (`POST /api/roster/branch-admins`).
3. **Inline Editing:**
   * Admins can edit administrator details (Name, Email) and save updates with real-time feedback.

### D. Email Validation Standards & Research
* **Enterprise Email Landscape:**
  Organizations use varied email architectures:
  * Custom corporate domains: `jane.doe@acmecorp.com`, `admin@subdomain.org.uk`
  * Microsoft 365 / Entra ID: `user@acme.onmicrosoft.com`
  * Standard public providers: `@gmail.com`, `@outlook.com`, `@icloud.com`
* **Validation Strategy:**
  * Do NOT restrict to Gmail or public domains.
  * Enforce RFC 5322 standard email validation regex:
    ```regex
    ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$
    ```
  * Verification rules:
    1. Exactly one `@` symbol.
    2. Non-empty local-part containing valid characters (alphanumeric, dots, hyphens, underscores).
    3. Valid domain name with at least one dot.
    4. Top-level domain (TLD) of at least 2 alphabetic characters.

---

## 18. Recommendations for Organization Admin & Brand Settings (Scope Decisions)

### A. Excluded Recommendations (Per Explicit User Directive)
* ❌ **Brand Settings Live Theme Preview Canvas** — *Excluded from scope.*
* ❌ **Brand Settings Preset Corporate Palettes** — *Excluded from scope.*
* ❌ **Brand Settings Favicon & Tab Title Customization** — *Excluded from scope.*
* ❌ **Global Branch Quick Filter Dropdown** — *Excluded from scope.*
* ❌ **Audit Log CSV/PDF Export** — *Excluded from scope.*

### B. Approved Recommendation (Accepted for Implementation)
* ✅ **Facility Capacity KPI Summary Cards (Organization Admin Dashboard):**
  * Display 4 metric tiles on `OrganizationAdminDashboard.tsx` dynamically calculated from the ingested physical workspace:
    1. **Regional Branches & Buildings:** Total branch offices and corporate buildings.
    2. **Total Workstations:** Total number of standard + HDMI workstations across all floors.
    3. **HDMI Display Stations:** Number of desks equipped with external monitor setups.
    4. **Meeting Rooms & Capacity:** Total dedicated conference pods and cumulative seating capacity.

---

## 19. Final Architecture & Implementation Scope Confirmation

The following 5 components constitute the complete, approved implementation scope:

### Component 1: Excel Meeting Room Lockout & Formatting Glitch Fix (Image 1)
* **Target File:** `Workspace_FloorPlan_Template.xlsx` (via generator script / template asset).
* **Fix Applied:**
  * Update Data Validation for Column H (Meeting Room Capacity):
    `=UPPER(TRIM($G2))="YES"`
  * Update Data Validation for Column I (Meeting Room HDMI):
    `=AND(UPPER(TRIM($G2))="YES", I2<=H2)`
  * Update Conditional Formatting rules for range `H2:I401`:
    * Unlocked Yellow Fill Rule: `=UPPER(TRIM($G2))="YES"`
    * Disabled Gray Fill Rule: `=UPPER(TRIM($G2))<>"YES"`
* **Outcome:** Eliminates the case sensitivity and trailing whitespace issue shown in Image 1, guaranteeing that `yes`, `Yes`, `YES`, or `yes ` always keeps cells unlocked and yellow.

### Component 2: Dynamic Welcome Banner Theming in Organization Dashboard (Image 2)
* **Target File:** [`OrganizationAdminDashboard.tsx`](file:///d:/MyFiles/MultiTenant%20OfflineFirst%20DeskBooking/apps/web/src/components/dashboard/OrganizationAdminDashboard.tsx).
* **Fix Applied:**
  * Replaces the static green gradient with the active organization's `themeColor`.
  * Computes relative luminance ($Y = 0.299R + 0.587G + 0.114B$):
    * If $Y < 145$ (Dark Theme): White text, soft white subtitle, translucent white pill badge.
    * If $Y \ge 145$ (Light Theme): Dark slate text, soft dark subtitle, translucent dark pill badge.

### Component 3: Facility Capacity KPI Summary Cards (Approved Feature)
* **Target File:** [`OrganizationAdminDashboard.tsx`](file:///d:/MyFiles/MultiTenant%20OfflineFirst%20DeskBooking/apps/web/src/components/dashboard/OrganizationAdminDashboard.tsx).
* **Fix Applied:**
  * Fetches workspace physical stats via `/api/workspace/hierarchy`.
  * Displays 4 responsive KPI cards above the workspace launch section:
    1. **Branches & Buildings** (e.g. `2 Branches • 5 Buildings`)
    2. **Active Workstations** (e.g. `120 Desks`)
    3. **HDMI Workstations** (e.g. `32 Display Desks`)
    4. **Meeting Rooms & Capacity** (e.g. `4 Rooms • 36 Seats`)

### Component 4: Workspace Setup Page Layout Reordering (Image 3)
* **Target File:** [`WorkspaceSetupPage.tsx`](file:///d:/MyFiles/MultiTenant%20OfflineFirst%20DeskBooking/apps/web/src/pages/admin/WorkspaceSetupPage.tsx).
* **Fix Applied:**
  * Remove the top green decorative banner container (*"Workspace & Floor Plan Ingestion Engine"*).
  * Move the **Action Hub** (Step 1: Download Template and Step 2: Upload Completed Spreadsheet, including upload status, error cards, and success statistics) to the **very top** of the page.
  * Reposition the **Ingestion Lifecycle Walkthrough** (cards 1, 2, 3, 4) **below** the Action Hub.

### Component 5: Employee Roster & Branch Administrator Management
* **Target Files:**
  * Frontend: [`EmployeeRosterPage.tsx`](file:///d:/MyFiles/MultiTenant%20OfflineFirst%20DeskBooking/apps/web/src/pages/admin/EmployeeRosterPage.tsx)
  * Backend API: `apps/api/src/routes/workspace.routes.ts` or `roster.routes.ts`
* **Features:**
  1. **Prerequisite Gatekeeper:** If 0 branches exist in the database, display a locked educational banner directing the admin to `/admin/workspace-setup`.
  2. **Auto-Extract Branches:** Query all distinct branches under the organization once workspace setup is complete.
  3. **Mode A (Excel Bulk Upload):**
     * Download `Branch_Admin_Roster_[ORG].xlsx` with pre-filled `Branch ID` and `Branch Name` (read-only grey), and yellow inputs for `Administrator Name`, `Administrator Email`, and `Default Password`.
     * Upload parser validates mandatory fields, verifies email format, and atomically creates users in PostgreSQL with role `BRANCH_ADMIN`.
  4. **Mode B (In-Page Manual Entry & Table Management):**
     * Clean table displaying: `Branch Name` (**Branch ID is hidden from view**), `Administrator Name`, `Email Address`, `Status`, and `Actions` (Edit / Reassign).
     * Modal / form to manually assign a branch admin, saved directly to the database.
  5. **Universal Email Validation:**
     * Enforce RFC 5322 regex `/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/` allowing all corporate and standard email providers.

---

## 20. Refinements & Fixes: Platform Admin Cleanup, Employee Roster Flattening, Workspace Setup Layout & Excel Validation Fix

### A. Component 1: Platform Administration Cleanup (Image 1)
* **Rationale:** The Platform Administrator only needs the Dashboard (`PlatformAdminDashboard.tsx`) and Audit Logs. A separate Organizations page is redundant.
* **Actions:**
  1. Remove the `Organizations` link from `Sidebar.tsx` for `PLATFORM_ADMIN`.
  2. Remove the route `/admin/organizations` from `App.tsx` (redirect `/admin/organizations` to `/admin/dashboard`).
  3. Delete/decommission [`OrganizationsPage.tsx`](file:///d:/MyFiles/MultiTenant%20OfflineFirst%20DeskBooking/apps/web/src/pages/admin/OrganizationsPage.tsx).
  4. Retain all organization viewing, creation, and cascade deletion actions directly on `PlatformAdminDashboard.tsx`.

---

### B. Component 2: Employee Roster Flattening & Lifecycle Management (Branch Administrators Only) (Image 2)
* **Rationale:** Corporate user management at this stage exclusively pertains to assigning Branch Administrators for each physical branch. The "All Employees Directory" tab is extraneous and removed.
* **Actions:**
  1. **Remove Tab Switcher:** Remove tab toggle buttons `[ Branch Administrators ]` and `[ All Employees Directory ]` from [`EmployeeRosterPage.tsx`](file:///d:/MyFiles/MultiTenant%20OfflineFirst%20DeskBooking/apps/web/src/pages/admin/EmployeeRosterPage.tsx). Remove the "All Employees Directory" table, state, and employee-specific bulk upload actions.
  2. **Delete / Revoke Branch Administrator Action (Image 2):**
     * In the Branch Administrators table, alongside the `Edit` button, add a `Delete` button (with a confirmation modal).
     * Add backend endpoint `DELETE /api/roster/branch-admin/:id` to remove the user and disassociate the branch.
     * **Instant State Rollback:** Deleting an administrator rolls the branch back to its unassigned state:
       - `ADMINISTRATOR`: "Pending Assignment" (amber text)
       - `EMAIL ADDRESS`: "—"
       - `ASSIGNMENT STATUS`: "Pending" (amber badge)
       - `ACTIONS`: `+ Assign` button (identical to how Goa is displayed in Image 2).
  3. **Unassigned-Only Template Generation:**
     * In `GET /api/roster/branch-admin-template`, check which branches already have an assigned administrator (manually or via bulk import).
     * Only populate rows for **unassigned** branches in the generated Excel template (e.g. if Pune is already assigned, Pune is omitted from the template, and only Goa appears).
  4. **Column Parity Between Modal & Template:**
     * Manual modal fields: Branch Name, Administrator Name, Email Address, Password.
     * Excel template fields: `Branch ID` (for machine mapping), `Branch Name`, `Administrator Full Name`, `Administrator Email`, `Initial Password`.
     * Strict Privacy: `Branch ID` is never shown in the web UI table or forms.

### C. Component 3: Workspace Setup Page Result Placement (Image 3 & Image 5)
* **Clarification:** The Excel parsing, error detection, error count, and annotated workbook download functionality are 100% dynamic and working properly. Only the visual placement of the result container in the JSX is being adjusted. There is no separate page header; the page begins directly with the Action Hub.
* **Layout Order in [`WorkspaceSetupPage.tsx`](file:///d:/MyFiles/MultiTenant%20OfflineFirst%20DeskBooking/apps/web/src/pages/admin/WorkspaceSetupPage.tsx):**
  1. **[TOP POSITION] Dynamic Result Container (Conditional):**
     * **If Error:** Red Ingestion Error Banner showing error count, list of issues, and "Download Annotated File with ERRORS Column" button.
     * **If Success:** Green Ingestion Success Summary showing counts for Branches, Buildings, Floors, Sections, Desks, and Meeting Rooms, with "Proceed to Floor Plans" button.
     * *When no upload has occurred yet, this container is completely hidden.*
  2. **Action Hub (2-Column Grid):**
     * Left Column: Step 1 Download Workspace Template card.
     * Right Column: Step 2 Upload Completed Spreadsheet drag-and-drop card.
  3. **4-Step Simulation Walkthrough:** Educational step-by-step guide (cards 1, 2, 3, 4) at the bottom.

### D. Component 4: Excel Meeting Room Data Validation Bug Fix (Image 4)
* **Root Cause Diagnosis:**
  1. **ExcelJS Range Optimization Bug:** In `apps/api/src/services/excel.service.ts`, `generateOrgTemplate` was reading the template with `ExcelJS` and writing it back out. When writing, `ExcelJS`'s `optimiseDataValidations` sorts cell addresses using JavaScript string `strcmp`. In alphabetical sort, `"H10"` precedes `"H2"`. This caused `ExcelJS` to serialize two overlapping DataValidation ranges into OpenXML: `H10:H401` and `H2:H401`.
  2. **Relative Reference Coordinate Shift:** For `H10:H401`, Excel anchors the relative formula `=UPPER(TRIM($G2))="YES"` to row 10. This creates an 8-row offset ($10 - 2 = 8$). When the user edited row 15 (cell H15), Excel evaluated cell G(15 - 8) = **G7**. In Image 4, cell G7 is `"no"`, so Excel rejected the input on H15 and displayed *"Meeting Room Disabled: Meeting Room is set to 'No' or blank"*, even though cell G15 was explicitly `"yes"`!
  3. **Conditional Formatting Succeeded:** Conditional formatting worked properly because it was generated directly by `openpyxl` without passing through the corrupted `ExcelJS` serializer.
* **Two-Pronged Solution:**
  1. **Dynamic Row-Anchoring in Formulas (`openpyxl`):**
     * Column H formula: `=UPPER(TRIM(INDIRECT("G" & ROW())))="YES"`
     * Column I formula: `=AND(UPPER(TRIM(INDIRECT("G" & ROW())))="YES", INDIRECT("I" & ROW())<=INDIRECT("H" & ROW()))`
     * Column F formula: `=INDIRECT("F" & ROW())<=INDIRECT("E" & ROW())`
     * Column G dropdown: Contiguous range `dv_yes_no.add("G2:G401")` instead of cell-by-cell loop.
     * `ROW()` dynamically returns the current row number during evaluation, making `INDIRECT("G" & ROW())` 100% immune to relative offset shifts, active cell coordinates, or range splits.
  2. **Non-Destructive Template Serving (`excel.service.ts`):**
     * In `generateOrgTemplate(orgId, orgName)`, use `JSZip` to update ONLY cells A5 and B5 inside `xl/worksheets/sheet1.xml` in the template archive.
     * Sheets 2, 3, 4, and 5 remain completely untouched, ensuring OpenXML formulas, data validations, and conditional formattings are preserved byte-for-byte as generated by openpyxl without destructive ExcelJS re-serialization.

### E. Component 5: Floor Plan Architectural Entry Text (Image 1)
* **Target File:** [`FloorPlansPage.tsx`](file:///d:/MyFiles/MultiTenant%20OfflineFirst%20DeskBooking/apps/web/src/pages/admin/FloorPlansPage.tsx) (line 555).
* **Fix Applied:**
  * Update the bottom entrance door text from:
    `🚪 MAIN SECTION ENTRY`
  * To:
    `🚪 ENTRY`

