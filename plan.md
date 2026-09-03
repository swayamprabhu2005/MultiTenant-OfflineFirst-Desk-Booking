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

## 7. Employee Booking Boundary Rules
* **Locked Hierarchy:** Employees are strictly scoped to their assigned **Branch** and **Building** (cross-branch and cross-building bookings are disabled).
* **Switchable Navigation:** Employees can freely switch between **Floors** and **Sections** using quick-toggle tabs.
* **Focused View:** The floor plan viewer renders the exact section selected, keeping the experience clean, uncluttered, and responsive.
