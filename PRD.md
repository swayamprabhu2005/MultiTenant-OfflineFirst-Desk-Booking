# Product Requirements Document
## Multi-Tenant Offline-First Desk Booking SaaS
### Enterprise Workplace Resource Allocation & Offline Sync Platform

| Field | Value |
|---|---|
| Version | 1.0 |
| Status | Initial Draft |
| Date | August 25, 2026 |
| Platform | Multi-Tenant SaaS (Custom Subdomains) |
| Audience | Engineering Leads / Product Architecture |
| Delivery | Progressive Web Application (PWA) |

---

## 1. Executive Summary

The Multi-Tenant Offline-First Desk Booking Platform is a cloud-native Software-as-a-Service (SaaS) Progressive Web Application (PWA) designed to streamline workspace, cubicle, and boardroom reservations for enterprise organizations. The platform isolates client organizations using dedicated custom subdomains (e.g., cme.deskbooking.com) and provides localized white-label branding.

Engineered for real-world office environments where connectivity can be intermittent (such as basements or subterranean parking areas), the application operates in an offline-first capacity. Employees can search available desks, select slots, and submit booking requests offline. Local browser database storage (IndexedDB via Dexie.js) queues transactions and auto-synchronizes with the backend API upon network restoration using a strict **first-to-sync wins** optimistic conflict resolution protocol.

---

## 2. Problem Statement

Modern hybrid organizations face operational friction managing flexible workspace allocation, particularly across multi-tenant environments and network-constrained corporate premises:

- **Cross-Tenant Data Exfiltration Risks:** Traditional single-instance booking tools fail to maintain strict cryptographic and logical boundaries between different enterprise clients.
- **Network Instability Overhead:** Standard web applications freeze or crash when employees lose cellular/Wi-Fi connection inside office buildings, preventing desk reservations.
- **Over-Complicated Setup Friction:** Architectural blueprint parsing (CAD/SVG) can create setup bottlenecks for organizations lacking vector floor plans.
- **Double-Booking Conflicts:** Disconnected offline users attempting to reserve the same physical space can corrupt state without deterministic server reconciliation.

---

## 3. Goals & Non-Goals

### 3.1 Goals

- **Custom Subdomain Multi-Tenancy:** Provide complete data isolation per organization via dedicated subdomains.
- **Offline-First Progressive Web App:** Allow full offline capability to view cached desks and queue booking requests locally in IndexedDB.
- **Deterministic Conflict Resolution:** Enforce server-side optimistic locking where the first offline client to sync successfully claims the slot, marking later overlapping requests as REJECTED.
- **Streamlined Space Onboarding:** Support rapid setup via CSV/Excel template import for floors and cubicle numbers for MVP, eliminating complex SVG CAD blueprint requirements.
- **Bulk Employee Provisioning:** Support CSV roster uploads for employee onboarding, designed with extensibility for enterprise SSO (Microsoft Active Directory / Entra ID).
- **Base Office Restriction:** Enforce strict geographic access control where employees can only book resources located within their assigned base office.
- **Supervisor / Proxy Booking:** Enable Team Leads and Supervisors to reserve cubicles on behalf of their team members.

### 3.2 Non-Goals (MVP Scope Boundary)

- **Interactive SVG CAD Floor Plans:** Vector blueprint parsing and interactive drag-and-drop spatial coordinate mapping are deferred to Phase 2.
- **Real-Time WebSockets:** Socket.io live push updates are not required for V1; standard client state sync and manual refresh triggers will be used.
- **Cross-Branch Roaming:** Employees will not be permitted to book resources in non-home branch locations for V1.
- **Manager Approval Gateways:** Manual booking review gates are excluded; all bookings are auto-confirmed on a first-come, first-served basis.

---

## 4. Users & Personas

| Persona | Role | Key Responsibilities & Needs |
|---|---|---|
| Platform Administrator | System Admin | Provisions new enterprise tenant organizations, assigns subdomains, and monitors global SaaS health. |
| Organization Admin | Tenant Facility Admin | Imports floor/cubicle inventory via CSV, uploads employee rosters, configures branding, and views tenant audit logs. |
| Employee / Desk Booker | End User / Team Member | Searches available cubicles, creates offline/online bookings for self or team members (max 1 desk/day), and cancels reservations. |

---

## 5. Features & Requirements

### 5.1 Subdomain Multi-Tenancy & White-Labeling

- **Subdomain Routing:** The application router automatically extracts the host subdomain (e.g., acme.deskbooking.com) to establish tenant context before authentication.
- **Isolated Data Boundaries:** All backend database queries are strictly partitioned by organizationId derived from the authenticated request token.
- **Custom Tenant Branding:** Organizations can configure primary brand color palettes (Emerald, Blue, Slate), upload corporate logos, and customize automated notification templates.

### 5.2 Floor & Cubicle Inventory Onboarding (CSV / Excel Template)

- **CSV Data Import:** Organization Admins can download a standard Excel/CSV template, fill in building names, floor numbers, and cubicle codes/features, and upload the file to seed space inventory.
- **Manual Numeric Counter Fallback:** Admins can alternatively use a numerical spinner input (e.g., 50 cubicles) to auto-generate a grid of bookable space nodes dynamically.
- **Resource Categorization:** Supports tagging resources as CUBICLE, DESK, BOARD_ROOM, or MEETING_ROOM with capacity attributes.

### 5.3 Employee Onboarding & Authentication

- **Bulk CSV Employee Import:** Admins upload employee rosters containing Name, Email, Department, and Base Office Location.
- **Credentials Authentication:** V1 implements standard Email and Password login scoped to the tenant organization, designed for seamless future upgrade to SAML 2.0 / Entra ID SSO.
- **Role-Based Authorization:** Enforces granular access rights across PLATFORM_ADMIN, ORGANIZATION_ADMIN, and EMPLOYEE roles.

### 5.4 Booking Business Logic & Proxy Rules

- **Daily Booking Ceiling:** An employee may hold a maximum of 1 active cubicle reservation per day (Full-Day or Half-Day slot).
- **Supervisor / Team Proxy Booking:** Supervisors and Team Leads are authorized to reserve cubicles on behalf of designated team members.
- **Home Base Office Restriction:** Employees are strictly restricted to reserving cubicles located within their assigned base office building.
- **Cancellation Policy:** Employees may cancel bookings at any time prior to end time; cancellation cutoff thresholds remain administratively configurable.

### 5.5 Offline PWA Engine & Background Sync

- **App Shell Caching:** Vite PWA plugin and Workbox Service Worker cache HTML, JS, CSS, and UI assets for instant offline app startup.
- **IndexedDB Client Store:** Local database (Dexie.js) stores cached floors, cubicles, user profile, and an Outbox queue for offline transactions.
- **Auto-Sync Engine:** Service Worker Background Sync API continuously monitors connectivity and flushes pending outbox requests automatically upon reconnection.

### 5.6 Conflict Resolution Lifecycle (First to Sync Wins)

- **Pending State:** Offline bookings are saved locally with PENDING status.
- **Transactional Optimistic Locking:** Upon backend receipt, PostgreSQL evaluates timestamp range overlap (tsrange). The first request committed to DB is marked CONFIRMED.
- **Rejection Notification:** Subsequent overlapping sync requests fail database validation and are marked REJECTED, alerting the user via toast notification.

### 5.7 Security, Rate-Limiting & Audit Logs

- **JWT Cookie Security:** Tokens are stored in HTTP-Only, Secure, SameSite cookies to protect against XSS.
- **Brute-Force Rate Limiting:** Backend API enforces IP rate limiting (maximum 5 login attempts per minute).
- **Audit Trail:** Every booking creation, cancellation, and admin CSV import is recorded in an append-only AuditLog table.

---

## 6. Technical Architecture & System Specifications

### 6.1 Approved Technology Stack

| Layer | Technology Approved | Technical Rationale |
|---|---|---|
| Frontend Client | React.js + TypeScript + Vite + Tailwind CSS | Fast, type-safe Single Page Application framework with utility-first responsive styling. |
| Offline Storage | Dexie.js (IndexedDB API Wrapper) | Structured object store for offline resource caching and outbox queue management. |
| Service Worker | vite-plugin-pwa / Workbox | Background Sync API implementation for automatic network reconnection handling. |
| Backend API | Node.js + NestJS / Express + TypeScript | Scalable REST API architecture with Passport JWT and robust guard middleware. |
| Database & ORM | PostgreSQL + Prisma ORM + GiST Extension | Relational consistency with native PostgreSQL range exclusion constraints (btree_gist). |

### 6.2 UI Color Theme Palette Specifications

The standard SaaS UI theme leverages an Emerald & Slate palette (customizable per tenant via white-label tokens):

- **Primary Brand Emerald:** Emerald 600 (#16a34a), Emerald 500 (#22c55e), Emerald 700 (#15803d), Emerald 50 (#f0fdf4)
- **Neutral Canvas & Slate:** Slate 50 (#f8fafc) Background, Slate 200 (#e2e8f0) Borders, Slate 800 (#1e293b) Headers, Slate 900 (#0f172a) High-Contrast Text
- **Status Indicator Tokens:** Confirmed/Available: Emerald 500 (#22c55e); Offline Pending: Amber 500 (#f59e0b); Conflict/Rejected: Rose 600 (#e11d48)

---

## 7. User Stories

| ID | User Story | Priority | Feature Area |
|---|---|---|---|
| US-01 | As a Tenant Admin, I want to access my portal via acme.deskbooking.com so my organization data remains isolated. | Must Have | Multi-Tenancy |
| US-02 | As an Admin, I want to upload a CSV file to seed floors and cubicle numbers so I can quickly set up my office. | Must Have | Inventory Setup |
| US-03 | As an Admin, I want to upload a CSV roster of employees so my staff can log in using their company email. | Must Have | Onboarding |
| US-04 | As an Employee, I want to reserve 1 cubicle for today or tomorrow so I have a guaranteed workspace. | Must Have | Booking Engine |
| US-05 | As a Team Lead, I want to book a cubicle for my team member so we can sit together during project sprints. | Must Have | Proxy Booking |
| US-06 | As an Employee, I want to create a booking while offline in a basement so I do not lose my selection. | Must Have | Offline PWA |
| US-07 | As an Employee, I want my offline booking to auto-sync when network returns so I do not have to manually push it. | Must Have | Background Sync |
| US-08 | As an Employee, I want to be notified if my offline booking was rejected due to a sync conflict so I can pick another desk. | Must Have | Conflict Resolution |
| US-09 | As an Employee, I want to cancel my active booking anytime so others can use the desk if my plans change. | Must Have | Cancellation |
| US-10 | As an Admin, I want to upload our corporate logo and primary brand color so the app matches our brand identity. | Should Have | White-Labeling |
