# Multi-Tenant Offline-First Desk & Cubicle Booking SaaS Platform

An enterprise-grade, multi-tenant Software-as-a-Service (SaaS) Progressive Web Application (PWA) built for workplace resource allocation (cubicles, hot desks, boardrooms, and meeting rooms).

Designed for network-constrained building basements or offline enterprise environments, the platform features:
- **Offline-First PWA Storage**: Powered by Dexie.js (IndexedDB wrapper) & `vite-plugin-pwa` Workbox Service Worker.
- **First-to-Sync Wins Protocol**: Conflict resolution using transactional database validation (`tsrange` / time-range overlap checks).
- **Multi-Tenant Subdomain Routing**: Dynamic organization scoping (`acme.deskbooking.com`) & dynamic CSS white-label brand token injection.
- **Enterprise Features**: Daily quota ceilings (max 1/day), Base Office building restrictions, Supervisor/Proxy booking on behalf of team members, Bulk CSV Space Inventory import, Bulk CSV Employee Roster import, and Manual Numeric Counter Fallback space generator.

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
2. Install PNPM workspace dependencies.
3. Generate Prisma client & apply database schema/seed.
4. Start both API server (`http://localhost:4000`) and Vite Web PWA client (`http://localhost:3000`) in parallel.

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

## ⚡ Core Business Logic & Offline Flow

### 1. Offline Booking & IndexedDB Outbox
When an employee creates a reservation while offline:
- The reservation is immediately stored in local Dexie IndexedDB with status `PENDING`.
- An execution record is queued in the Dexie `outbox` table.
- The UI reflects the pending desk reservation instantly.

### 2. Auto-Sync & "First to Sync Wins" Protocol
When network connection is restored (or via the manual "Sync Outbox Now" button in Sync Center):
- The `SyncEngine` batches queued outbox operations and sends them to `/api/sync/operations`.
- The backend evaluates time overlap inside a database transaction:
  - If the slot is available: status commits as `CONFIRMED` and returns `SUCCESS`.
  - If another employee synced an overlapping booking first: the transaction rejects, sets status to `CONFLICT` / `REJECTED`, and dispatches an in-app Toast Alert prompting the user to select another desk!

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
├── run.bat                    # One-click startup script for Windows
├── pnpm-workspace.yaml
├── package.json
└── README.md
```
