# Change Proposal: Employee CAD Floor Plan Explorer & Self-Service Booking

**Change ID:** `2026-09-11-employee-booking-and-floorplan-explorer`  
**Status:** Implemented & Archived (100% Complete)  
**Schema:** `spec-driven`  
**Target Capabilities:** `employee-cad-floorplan`, `time-slot-windows`, `proxy-booking`, `multi-day-matrix`, `my-bookings`  

---

## 1. Context & Problem Statement
Employees require an intuitive self-service portal to explore their branch's architectural floor plan, locate available workstations, book desks for themselves or colleagues across full or half days, and manage their reservations without administrative intervention.

## 2. Proposed Solution
1. Build interactive 2D Architectural CAD Floor Plan Explorer without SVG using semantic HTML5 and Tailwind CSS.
2. Provide 3 time-slot session windows: Full Day (9:00-18:00), Morning (9:00-13:30), Afternoon (13:30-18:00).
3. Support colleague search and proxy booking for teammates.
4. Implement multi-day booking availability schedule matrix with local timezone boundary normalization.
5. Create Employee Dashboard with active reservation hero card and My Bookings management with multi-select cancellation.
