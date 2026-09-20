# Change Proposal: Branch Admin Customization, In-UI Cubicles & Executive Desks

**Change ID:** `2026-09-14-branch-admin-customization-and-executive-desks`  
**Status:** Implemented & Archived (100% Complete)  
**Schema:** `spec-driven`  
**Target Capabilities:** `branch-floorplan-customization`, `in-ui-cubicle-creator`, `conference-seats`, `executive-desks`, `admin-release`  

---

## 1. Context & Problem Statement
Branch Administrators need physical floor plan autonomy: the ability to re-ingest branch-specific layouts, add cubicles directly through the web UI without modifying spreadsheets, designate executive desks, make meeting room conference seats bookable, and directly release reservations when needed.

## 2. Proposed Solution
1. Provide branch-scoped floor plan Excel template generation and re-ingestion endpoints.
2. Implement in-UI `+ Add Cubicle` action with real-time 4-desk pod recalculation.
3. Make meeting room conference seats (`M-01` to `M-10`) clickable and independently bookable.
4. Support dedicated permanent executive desk assignment for branch administrators.
5. Provide direct desk release authority with audit logging and canvas state refresh.
