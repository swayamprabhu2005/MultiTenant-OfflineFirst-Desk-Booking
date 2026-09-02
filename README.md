# Multi-Tenant SaaS Control Plane

Enterprise Multi-Tenant SaaS Platform featuring **Platform Administration** and **Global Organization Administration** (Tenant Management, Subdomain Isolation, White-Label Dynamic Branding, and Security Audit Logs).

---

## System Overview

- **Platform Administrator**: Global SaaS Superadmin. Accesses the `system` tenant console to register new enterprise tenant organizations, inspect registered subdomains, and monitor SaaS registration audit logs.
- **Global Organization Administrator**: Tenant Facility & Branding Admin. Created via self-service signup (`/signup`) or platform provisioning. Configures corporate white-label branding (rainbow color wheel token generator, logo upload) and monitors tenant-level security audit logs.

---

## Technology Stack

- **Monorepo**: PNPM Workspaces
- **Backend API**: Node.js + Express + TypeScript + Prisma ORM + PostgreSQL
- **Frontend Client**: React + TypeScript + Vite + Tailwind CSS + Lucide Icons + TanStack Query
- **Shared Package**: `@deskbooking/shared` (TypeScript interfaces and enums)

---

## Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18 or v20+
- **PNPM**: Installed globally (`npm i -g pnpm`)
- **Docker** (Optional): For running PostgreSQL locally

### 2. Launch with One-Click Script
Run the provided batch script on Windows:
```cmd
run.bat
```
This script will:
1. Start PostgreSQL via Docker Compose (if Docker is installed).
2. Install all workspace dependencies via `pnpm install`.
3. Generate the Prisma client and push the schema to PostgreSQL.
4. Seed the database with the default Platform Administrator.
5. Start both the Backend API (`http://localhost:4000`) and the Frontend Portal (`http://localhost:3000`).

---

## Default Credentials

| Persona | Subdomain | Email | Password | Role |
|---|---|---|---|---|
| **Platform Admin** | `system` | `admin@deskbooking.com` | `DeskBook#2026!AdminSec` | `PLATFORM_ADMIN` |

---

## Project Structure

```
Multitenant/
├── apps/
│   ├── api/          # Express API server with Prisma ORM
│   └── web/          # React + Vite Admin Portal
├── packages/
│   └── shared/       # Shared TypeScript types and enums
├── docker-compose.yml# PostgreSQL 16 container
├── package.json      # PNPM workspace root
├── run.bat           # One-click startup script
└── README.md
```
