# Change Proposal: Org Admin Governance, 7-Day Matrix Navigation & Mass Booking Modal

**Change ID:** `2026-09-19-org-admin-governance-and-mass-booking`  
**Status:** Implemented & Archived (100% Complete)  
**Schema:** `spec-driven`  
**Target Capabilities:** `org-admin-governance`, `zoom-elimination`, `7-day-sliding-matrix`, `mass-booking-modal`, `multi-desk-conflict-detection`  

---

## 1. Context & Problem Statement
1. Global Organization Administrators require oversight across all physical branch floor plans but must be restricted from booking desks (governance policy restricts reservations to branch-affiliated personnel).
2. Dynamic zoom controls (`- 100% +`) and CSS transforms caused visual clipping and misalignment across different screen resolutions.
3. Availability schedule matrices showed awkward 8-day wrapping instead of strict weekly views.
4. Mass booking previously fired immediate reservations upon selection without allowing review or conflict detection.

## 2. Proposed Solution
1. Enforce read-only governance for Global Org Admins: view-only floor plans, stripped action controls, and a dedicated view-only workstation inspector modal.
2. Completely remove zoom controls and CSS scale transforms for fixed 100% native scale rendering.
3. Compact sidebar network status spacing and restructure Employee action bar into a right-aligned 3-tier hierarchy.
4. Standardize schedule matrices to a strict 7-day sliding window with interactive `<` and `>` week navigation arrows.
5. Create an interactive Multi-Workstation Mass Booking Modal with removable cubicle chips, multi-desk conflict detection (red conflict / green free), single-day selection, and backdrop click dismissal.
