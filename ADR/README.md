# Architecture Decision Records (ADR)

This directory contains the Architectural Decision Records (ADRs) for the Multi-Tenant Offline-First Desk Booking platform. Each ADR documents a significant architectural decision, its context, the alternatives considered, and the consequences of the chosen approach.

ADRs follow the [Michael Nygard template](http://thinkrelevance.com/blog/2011/11/15/documenting-architecture-decisions) format with sections for **Status**, **Context**, **Decision**, and **Consequences**.

> **Reference**: [architecture-decision-record/architecture-decision-record](https://github.com/architecture-decision-record/architecture-decision-record)

---

## Decision Log

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [ADR-001](001-use-pnpm-monorepo-architecture.md) | Use pnpm Monorepo Architecture | Accepted | 2026-09-01 |
| [ADR-002](002-adopt-multi-tenant-subdomain-isolation.md) | Adopt Multi-Tenant Architecture with Subdomain Isolation | Accepted | 2026-09-01 |
| [ADR-003](003-use-postgresql-with-prisma-orm.md) | Use PostgreSQL with Prisma ORM | Accepted | 2026-09-01 |
| [ADR-004](004-implement-four-tier-rbac-hierarchy.md) | Implement Four-Tier Role-Based Access Control Hierarchy | Accepted | 2026-09-01 |
| [ADR-005](005-use-jwt-bearer-token-authentication.md) | Use JWT Bearer Token Authentication with Stateless Sessions | Accepted | 2026-09-01 |
| [ADR-006](006-render-floor-plans-with-zero-svg-css.md) | Render Floor Plans with Zero-SVG CSS Architecture | Accepted | 2026-09-01 |
| [ADR-007](007-use-excel-driven-workspace-ingestion.md) | Use Excel-Driven Workspace Ingestion with ExcelJS | Accepted | 2026-09-01 |
| [ADR-008](008-implement-offline-first-indexeddb-outbox.md) | Implement Offline-First with IndexedDB Outbox Pattern | Accepted | 2026-09-18 |
| [ADR-009](009-use-react-vite-tailwind-frontend.md) | Use React with Vite and Tailwind CSS for Frontend | Accepted | 2026-09-01 |
| [ADR-010](010-use-expressjs-rest-api-backend.md) | Use Express.js REST API Backend | Accepted | 2026-09-01 |
| [ADR-011](011-derive-notifications-from-domain-events.md) | Derive Notifications from Domain Events Without Dedicated Storage | Accepted | 2026-09-18 |
| [ADR-012](012-implement-branch-scoped-office-presence.md) | Implement Branch-Scoped Office Presence from Booking Data | Accepted | 2026-09-18 |

---

## How to Add a New ADR

1. Create a new markdown file in this directory with the next sequential number: `NNN-short-imperative-title.md`
2. Use the template structure: **Status**, **Date**, **Context**, **Decision**, **Consequences**
3. Set the status to `Proposed` until the team reviews and accepts the decision
4. Commit the ADR alongside the code that implements the decision
