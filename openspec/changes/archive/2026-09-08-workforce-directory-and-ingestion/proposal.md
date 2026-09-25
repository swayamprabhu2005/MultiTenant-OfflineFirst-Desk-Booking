# Change Proposal: Enterprise Workforce Directory & Multi-Branch Ingestion

**Change ID:** `2026-09-08-workforce-directory-and-ingestion`  
**Status:** Implemented & Archived (100% Complete)  
**Schema:** `spec-driven`  
**Target Capabilities:** `workforce-management`, `multi-branch-roster`, `excel-generator`, `bcrypt-precomputation`  

---

## 1. Context & Problem Statement
Following the baseline workspace physical setup, organizations need to onboard hundreds of employees distributed across regional branches. Creating employee accounts one-by-one is unscalable, while generic CSV imports lack branch scoping and trigger server timeouts when hashing hundreds of passwords on the fly.

## 2. Proposed Solution
1. Provide a dedicated Enterprise Workforce Directory page (`/admin/workforce`) separate from Branch Administrator provisioning.
2. Build dynamic multi-branch Excel template generator (`GET /api/workforce/template`) creating a separate worksheet for each branch in the organization.
3. Implement bulk Excel ingestion parser (`POST /api/workforce/import`) with bcrypt hash precomputation and atomic transaction batch upserts.
4. Add corporate domain and default temporary password configuration card to prefill employee formulas.
