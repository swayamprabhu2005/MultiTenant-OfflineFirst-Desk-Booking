# Change Proposal: Offline-First Synchronization Engine & Office Presence

**Change ID:** `2026-09-16-offline-first-sync-and-presence`  
**Status:** Implemented & Archived (100% Complete)  
**Schema:** `spec-driven`  
**Target Capabilities:** `offline-indexeddb-outbox`, `background-sync-engine`, `sync-pending-state`, `whos-in-office`, `notifications-center`  

---

## 1. Context & Problem Statement
In enterprise facilities with intermittent Wi-Fi or basement office areas, employees and branch administrators face network dropouts. Inability to book or release workstations while offline causes frustration. Furthermore, team members lack real-time visibility into which colleagues are working on site today.

## 2. Proposed Solution
1. Implement client-side mutation interception using IndexedDB (`desk_booking_offline_db`) for bookings and releases made while offline.
2. Build an automatic background sync engine listening to network reconnection events (`online`).
3. Render an amber/yellow `Sync Pending` workstation state on the floor plan canvas and cache layout data locally.
4. Create a branch-scoped 'Who's in Office' presence endpoint and interactive dashboard modal.
5. Provide an in-app notification center with an unread badge counter and real-time activity stream.
