# Change Proposal: Multi-Tenant Desk Booking & SaaS Control Plane

**Change ID:** `2026-09-05-multi-tenant-desk-booking`  
**Status:** Implemented & Archived (100% Complete)  
**Schema:** `spec-driven`  
**Target Capabilities:** `tenant-management`, `workspace-ingestion`, `floor-plans-no-svg`, `branch-admin-roster`, `dynamic-branding`  

---

## 1. Context & Problem Statement

Modern enterprise organizations operating across multiple corporate campuses, office towers, and regional office branches struggle with fragmented facility management, manual desk reservations, and rigid configuration tools. Existing facility booking solutions suffer from several critical shortcomings:

1. **Brittle Floor Plan Visualization:** Legacy solutions rely on complex vector graphic rendering engines (`<svg>`, `<canvas>`, WebGL) that suffer from cross-browser scaling inconsistencies, visual clipping on mobile/tablet viewports, and high DOM reflow overhead when rendering large floor plans with hundreds of cubicles.
2. **Error-Prone Workspace Setup:** Establishing multi-tier physical infrastructure (Branches $\rightarrow$ Buildings $\rightarrow$ Floors $\rightarrow$ Sections $\rightarrow$ Cubicles $\rightarrow$ Meeting Rooms) via individual web forms is slow, repetitive, and error-prone. Conversely, naive CSV/Excel imports fail to preserve parent-child relational constraints, lack in-sheet dynamic validation, and provide vague upload error messages that frustrate facility managers.
3. **Weak Tenant Isolation & High Admin Friction:** SaaS platforms often compromise security by co-mingling tenant resources without strict subdomain boundaries or fail to provide platform-level superadmins with atomic tenant lifecycle controls (such as cascade purges).
4. **Browser Credential False Positives:** User management forms frequently trigger intrusive Google Chrome password manager "data breach compromised password" warning modals due to standard HTML `<form>` credential interception.

---

## 2. Proposed Solution & Core Pillars

This proposal specifies the end-to-end architecture and implementation of the **Multi-Tenant Desk Booking & SaaS Control Plane**, driven by four core engineering tenets:

### A. Subdomain Multi-Tenant SaaS Isolation
* Deploy an Express + Prisma architecture where every resource is tagged with `organizationId`.
* Resolve tenants dynamically via `tenantMiddleware` using subdomains (`tenant.deskbooking.com`), `x-tenant-subdomain` HTTP headers, or query parameters.
* Provide a consolidated **Platform Administrator Console** (`system` subdomain) equipped with atomic cascade tenant deletion (`DELETE /api/organizations/:id`), permanently safeguarding the core system organization.

### B. Cascading 5-Sheet Excel Ingestion Engine
* Provide a downloadable, pre-filled master workbook (`templates/Workspace_FloorPlan_Template.xlsx`) containing 5 interconnected sheets: `Organization`, `Branches`, `Buildings`, `Floors`, and `Sections & Cubicles`.
* Implement dynamic, case-insensitive, whitespace-tolerant row-anchored validation formulas (`=UPPER(TRIM(INDIRECT("G" & ROW())))="YES"`) with automatic cell unlocking and yellow highlighting (`#FFF2CC`) when Meeting Room is `"Yes"`.
* Stream customized templates non-destructively using `JSZip` to edit only cells `A5` and `B5` of Sheet 1, bypassing `ExcelJS`'s destructive OpenXML re-serialization.
* Return actionable, sheet-specific error feedback by injecting a bright red **`ERRORS & FIXES`** column (`#DC2626`) **only into sheets with errors**, allowing immediate re-download, correction, and re-upload.

### C. Strict NO-SVG Architectural 2D Floor Plan Explorer
* Satisfy an absolute **zero-SVG architectural mandate**: construct all outer boundary walls, corridors, pod clusters, desks, and meeting rooms using Pure React, semantic HTML5 `<div>` elements, CSS Grid, and Tailwind CSS.
* Sanitize user dropdowns by displaying exclusively human-readable names (`Pune`, `Bhaskar`, `Floor 1`), completely stripping raw database IDs (`BR001`, `BLD001`, `1-FL01`).
* Group workstations into ergonomic **4-desk pod clusters** (2 facing 2 setup) arranged in a 2-row matrix that expands column-by-column to the right.
* Distribute HDMI display monitors evenly using a symmetrical round-robin balancing algorithm across active pods.
* Include an interactive slide-over drawer for real-time workstation status inspection and click-to-book / cancel reservations.

### D. Dedicated Branch Administrator Lifecycle Management
* Gate the employee roster page so that organizations must complete workspace ingestion before assigning branch administrators.
* Streamline the interface exclusively for physical branch administrator assignments, eliminating extraneous general employee directory tabs.
* Enable one-click deletion (`DELETE /api/roster/branch-admin/:id`) that revokes administrator privileges and immediately rolls back the branch row to its unassigned state (`Pending Assignment`, amber badge, `+ Assign` button).
* Neutralize Google Chrome credential breach alerts by using non-form React containers, `name="provision_access_credential"`, `autoComplete="new-password"`, `data-lpignore="true"`, and masked text styling with an eye toggle.

### E. Dynamic White-Label Brand Theming with Intelligent Contrast
* Compute perceived luminance from the active organization's brand hex color ($Y = 0.299R + 0.587G + 0.114B$, threshold $145$).
* Automatically style the top navbar and dashboard welcome banner, toggling between light text/badges (`text-white`, `bg-white/20`) for dark themes and dark text/badges (`text-slate-950`, `bg-black/10`) for light themes.
* Render 4 facility capacity KPI summary cards (Branches & Campuses, Workstations, HDMI Desks, Meeting Rooms & Seating Capacity) dynamically computed from the workspace hierarchy.

---

## 3. Scope & Non-Goals

### In-Scope
* PNPM monorepo structure (`apps/api`, `apps/web`, `packages/shared`, `templates`).
* PostgreSQL database with Prisma schema (10 models: `Organization`, `Branch`, `Building`, `Floor`, `Section`, `Desk`, `MeetingRoom`, `User`, `Booking`, `AuditLog`).
* Automated 5-stage Windows startup script (`run.bat`) with native PowerShell TCP socket polling for port 4000.
* Platform Admin tenant management with 10-tier atomic cascade deletion.
* Organization Admin 5-sheet cascading Excel ingestion with sheet-specific error workbook feedback.
* Interactive 2D floor plan explorer under a strict NO-SVG constraint.
* Dedicated Branch Administrator assignment, Excel template generation (unassigned only), and deletion rollback.
* Dynamic white-label brand theming with automated luminance contrast calculation.
* Collapsible navigation sidebar (`w-64` to `w-20` with hamburger toggle).

### Non-Goals
* Separate dedicated portal for Branch Administrators (all workspace controls are centralized under Global Organization Administrators).
* Complex 3D or WebGL floor plan rendering.
* Generic employee directories and team hierarchies (focused strictly on branch facility managers).
* External calendar integrations (e.g., Google Calendar, Microsoft Exchange) — reserved for future roadmap phases.

---

## 4. Architectural Impact & Operational Readiness

* **Zero Data Loss:** All infrastructure operations run in atomic `prisma.$transaction` blocks.
* **OpenXML Resilience:** Byte-for-byte template preservation via `JSZip` guarantees template formulas remain valid across all versions of Microsoft Excel, LibreOffice, and Google Sheets.
* **Deterministic Startup:** Eliminates Windows race conditions (`ECONNREFUSED`) through PowerShell socket health checks and Vite proxy error interception.
