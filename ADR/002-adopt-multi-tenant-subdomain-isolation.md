# ADR-002: Adopt Multi-Tenant Architecture with Subdomain Isolation

## Status

Accepted

## Date

2026-09-01

## Context

The platform serves multiple organizations (tenants), each with their own branches, employees, and workspace configurations. We needed a tenancy model that:

- Isolates each organization's data at the application level.
- Provides a unique, branded access point for each tenant (e.g., `acme.deskbooking.com`).
- Supports a shared database schema to reduce infrastructure cost and operational overhead.
- Enforces tenant boundaries at every API endpoint without relying solely on client-side guards.

Alternatives considered:

1. **Database-per-tenant** — Maximum isolation but operationally expensive: each new organization requires provisioning a new database, running separate migrations, and multiplying connection pools.
2. **Schema-per-tenant** — Good isolation within PostgreSQL but complicates migrations (each schema must be migrated independently) and is not natively supported by Prisma ORM.
3. **Shared schema with row-level filtering (chosen)** — All tenants share a single database and schema. Tenant boundaries are enforced by `organizationId` foreign keys on every table and filtered at every query.

## Decision

We will use a **shared-schema multi-tenant model** where:

- Every data model (`Branch`, `Building`, `Floor`, `Section`, `Desk`, `Booking`, `User`, `AuditLog`) carries an `organizationId` field linking to the `Organization` table.
- The `Organization` model stores a unique `subdomain` field used for frontend routing and tenant identification.
- All API endpoints extract the `organizationId` from the authenticated user's JWT and scope every Prisma query with a `where: { organizationId }` clause.
- The `system` organization (Platform Superadmin) is protected with an immutable safeguard — it cannot be deleted via the tenant cascade purge endpoint.

## Consequences

- **Positive**: Single database instance, single Prisma schema, single migration path. Provisioning a new tenant is an INSERT into the `Organization` table.
- **Positive**: Cross-tenant analytics and platform-level reporting are trivial — no need to query across multiple databases.
- **Positive**: Subdomain-based isolation provides each organization a branded experience (e.g., `acme.deskbooking.com`) without separate deployments.
- **Negative**: A single database failure affects all tenants. Mitigation: PostgreSQL replication and backups.
- **Negative**: Noisy-neighbor risk — a tenant with very high booking volume could impact query performance for others. Mitigation: Composite indexes on `[organizationId, ...]` columns.
- **Negative**: Requires disciplined query scoping — every query must include `organizationId` filtering. Missing a filter could leak data across tenants.
