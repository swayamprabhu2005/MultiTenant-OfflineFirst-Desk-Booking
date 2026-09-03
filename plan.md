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


