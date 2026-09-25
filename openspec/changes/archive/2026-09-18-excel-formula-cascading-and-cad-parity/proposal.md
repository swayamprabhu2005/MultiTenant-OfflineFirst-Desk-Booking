# Change Proposal: Excel Cascading Formulas, Parser Hardening & CAD Visual Parity

**Change ID:** `2026-09-18-excel-formula-cascading-and-cad-parity`  
**Status:** Implemented & Archived (100% Complete)  
**Schema:** `spec-driven`  
**Target Capabilities:** `excel-cascading-formulas`, `meeting-room-lockout`, `hardened-parser`, `cad-visual-parity`, `3-color-parity`  

---

## 1. Context & Problem Statement
Manual entry across multi-sheet floor plan templates resulted in mismatched codes, typo discrepancies, and broken relational references. Furthermore, the 2D CAD canvas visual presentation lacked uniform design consistency, resulting in unclear workstation ownership.

## 2. Proposed Solution
1. Inject dynamic uppercase cascading formulas (`=UPPER(TRIM(...))`, `=IF(...)`, `=VLOOKUP(...)`) across all branch template sheets.
2. Add conditional formatting to lock out standard desk capacity when Meeting Room is `"Yes"`.
3. Harden the server-side Excel parser to evaluate formulas and validate structural integrity.
4. Establish 3-color contextual booking parity: Emerald Green (Available), Indigo Blue (Your Desk), and Rose Red (Booked by Others).
5. Restructure cubicles into an ergonomic 3-line vertical hierarchy with standardized PC station icons.
6. Formalize 12 Architecture Decision Records (ADRs).
