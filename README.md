# Multi-Tenant Offline-First Desk & Cubicle Booking SaaS Platform

An enterprise-grade, multi-tenant Software-as-a-Service (SaaS) Progressive Web Application (PWA) built for workplace resource allocation (cubicles, hot desks, boardrooms, and meeting rooms).

Designed for network-constrained building basements or offline enterprise environments, the platform features:
- **Offline-First PWA Storage**: Powered by Dexie.js (IndexedDB wrapper) & `vite-plugin-pwa` Workbox Service Worker.
- **First-to-Sync Wins Protocol**: Conflict resolution using transactional database validation (`tsrange` / time-range overlap checks).
- **Multi-Tenant Subdomain Routing**: Dynamic organization scoping (`acme.deskbooking.com`) & dynamic CSS white-label brand token injection.
- **Enterprise Features**: Daily quota ceilings (max 1/day), Base Office building restrictions, Supervisor/Proxy booking on behalf of team members, Bulk CSV Space Inventory import, Bulk CSV Employee Roster import, and Manual Numeric Counter Fallback space generator.

---

## ⚙️ Advanced Features (Phase 2 & Phase 3 Complete)

### 1. Visual Floor Map Navigation & Date Filters
- **Interactive Section Map**: View live office section layout maps in a grid view matching actual desk coords.
- **Advance Calendar Bound**: Strict, hardcoded 30-day booking calendar limit.
- **Pre-Flight Conflict Warnings**: Immediate warnings displayed in the confirmation modal if a selected date overlaps with an existing reservation.
- **Weekday Picker**: Filter specific booking occurrences by selecting individual weekdays (e.g. Mon, Wed, Fri only).
- **Session Slots**: Support for `FULL_DAY`, `FIRST_HALF` (Morning), and `SECOND_HALF` (Afternoon) slots with non-conflicting time overlaps on the same desk.

### 2. Team Booking & Business Validations
- **Required Comments**: Form comments are strictly validated and required for boardroom reservations and same-day multi-desk booking occurrences.
- **Search & Batch Cancellations**: A search bar on the "My Bookings" page with checklist checkboxes allows batch cancellations.
- **Series Cancellation**: Option to delete "This date only" or "All future occurrences in the series" for recurring chains.
- **Tech Lead Bulk Booking**: Tech Leads can select multiple team subordinates simultaneously, run bulk bookings, and get a **Partial-Success Execution Receipt** showing succeeded slots and conflict errors.

### 3. User Security & Custom Onboarding
- **Forced Password Reset**: Any CSV-imported roster accounts with `mustChangePassword: true` are blocked from dashboard entry and redirected to a password reset guard.
- **One-Time Branch Assignment**: Employees logging in without a base office branch are prompted via a modal selector to assign a home branch. Updates sync immediately or queue offline in the IndexedDB Outbox.
- **In-App Notifications**: Real-time bell notification dropdown list showing reading alerts (with batch mark-as-read triggers) and background synchronization on reconnect.

---

## 🛠️ Tech Stack Architecture

- **Frontend (`apps/web`)**: React 18, TypeScript, Vite, Tailwind CSS (Emerald & Slate theme design system), TanStack Query (`@tanstack/react-query`), React Router DOM v6, Lucide React Icons.
- **Offline & PWA**: Dexie.js (IndexedDB client database), `vite-plugin-pwa` Workbox Service Worker shell caching & background sync.
- **Backend API (`apps/api`)**: Node.js with Express & TypeScript, Passport/JWT Authentication, Rate Limiting (`express-rate-limit`), CSV parsers.
- **Database & ORM**: PostgreSQL 16 with Prisma ORM, featuring range exclusion logic to guarantee transactional reservation integrity.
- **Package Manager & Monorepo**: PNPM workspaces (`packages/shared`, `apps/api`, `apps/web`).

---

## 🚀 Quick Start Guide

### Prerequisites
1. **Node.js**: v18+ installed.
2. **PNPM**: Installed globally (`npm i -g pnpm`).
3. **Docker Desktop**: Running (for PostgreSQL database container).

### One-Click Launch (Windows)
Double-click or run `run.bat` in the terminal:
```cmd
.\run.bat
```
This script will:
1. Launch PostgreSQL 16 container via Docker Compose on port `5432`.
2. Wait 6 seconds for the database service to be fully healthy.
3. Install PNPM workspace dependencies.
4. Generate Prisma client & apply database schema/seed.
5. Start both API server (`http://localhost:4000`) and Vite Web PWA client (`http://localhost:3000`) in parallel.

### Manual Step-by-Step Launch

1. **Start PostgreSQL Container**:
   ```bash
   pnpm db:up
   ```

2. **Install Workspace Dependencies**:
   ```bash
   pnpm install
   ```

3. **Generate Prisma Client & Seed Demo Data**:
   ```bash
   pnpm db:generate
   pnpm db:push
   pnpm db:seed
   ```

4. **Start Development Servers**:
   ```bash
   pnpm dev
   ```

- **Frontend Client**: `http://localhost:3000` (or `http://acme.localhost:3000`)
- **Backend API**: `http://localhost:4000`

---

## 🔑 Demo Account Credentials

Default Password for all accounts: **`Password123!`**

| User Role | Email | Organization / Subdomain |
|---|---|---|
| **Employee** | `employee@acme.com` | Acme Corp (`acme`) |
| **Supervisor** | `supervisor@acme.com` | Acme Corp (`acme`) |
| **Org Admin** | `admin@acme.com` | Acme Corp (`acme`) |
| **Platform Admin** | `admin@deskbooking.com` | Global SaaS Admin |

---

## 📁 Repository Structure

```
MultiTenant OfflineFirst DeskBooking/
├── apps/
│   ├── api/                   # Express + TypeScript API Server & Prisma ORM
│   │   ├── prisma/            # Schema & Seed script
│   │   └── src/               # Controllers, Middleware, Routes
│   └── web/                   # React 18 + Vite PWA Client
│       ├── src/
│       │   ├── components/    # AppLayout, Header, Sidebar, Toast, OfflineBanner
│       │   ├── context/       # AuthContext, TenantContext
│       │   ├── db/            # Dexie.js IndexedDB client schema
│       │   ├── pages/         # Employee & Admin portal views
│       │   └── services/      # SyncEngine & API client
│       └── vite.config.ts     # PWA & Workbox configuration
├── packages/
│   └── shared/                # Shared TypeScript types, DTOs, & Enums
├── docker-compose.yml         # PostgreSQL 16 container definition
├── run.bat                    # Startup script for Windows (optimized with startup delays)
├── pnpm-workspace.yaml
├── package.json
└── README.md
```
