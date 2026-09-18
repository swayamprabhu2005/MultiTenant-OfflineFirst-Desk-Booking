# ADR-003: Use PostgreSQL with Prisma ORM

## Status

Accepted

## Date

2026-09-01

## Context

The platform requires a relational data store capable of handling a complex hierarchical schema: Organizations → Branches → Buildings → Floors → Sections → Desks → Bookings, with transactional integrity for operations like cascade deletion and bulk imports.

Alternatives considered:

1. **SQLite** — Used in early prototyping (reflected in the README badge) for its zero-config nature. However, SQLite lacks concurrent write support, row-level locking, and production-grade connection pooling, making it unsuitable for a multi-tenant SaaS platform.
2. **MongoDB** — Flexible schema, but the deeply relational nature of the workspace hierarchy (foreign keys, cascade deletes, composite unique constraints) favours a relational database.
3. **MySQL/MariaDB** — Viable, but PostgreSQL offers superior JSON support, advanced indexing, and a richer feature set for complex queries.
4. **Raw SQL / Knex.js** — Maximum query control but sacrifices type safety, auto-generated migrations, and developer experience.

## Decision

We will use **PostgreSQL** as the primary database and **Prisma ORM** as the data access layer.

- The Prisma schema (`apps/api/prisma/schema.prisma`) defines all models with `@relation`, `onDelete: Cascade`, `@@unique`, and `@@index` directives.
- Database management commands are exposed as pnpm scripts: `pnpm db:generate` (Prisma Client), `pnpm db:push` (schema sync), `pnpm db:seed` (initial data).
- PostgreSQL is provisioned via Docker Compose (`docker compose up -d postgres`) or an existing local instance on port 5432.

## Consequences

- **Positive**: Prisma provides fully typed queries — `prisma.desk.findMany({ where: { sectionId } })` returns typed `Desk[]` objects, eliminating runtime type errors.
- **Positive**: Cascade deletes are declarative (`onDelete: Cascade`) — deleting an Organization atomically purges all child records across 9 related tables.
- **Positive**: Composite unique constraints (`@@unique([organizationId, code])`) enforce data integrity at the database level.
- **Positive**: Composite indexes (`@@index([deskId, startTime, endTime, status])`) optimize booking conflict queries.
- **Negative**: Prisma's query abstraction can generate suboptimal SQL for complex joins. Mitigated by using raw queries (`prisma.$queryRaw`) where needed.
- **Negative**: PostgreSQL requires a running server instance (Docker or native), adding a dependency compared to SQLite's file-based approach.
