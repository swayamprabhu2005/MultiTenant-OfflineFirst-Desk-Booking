# ADR-004: Implement Four-Tier Role-Based Access Control Hierarchy

## Status

Accepted

## Date

2026-09-01

## Context

The platform serves four distinct user personas with progressively scoped access:

1. **Platform Superadmin** — Manages all organizations (tenants) across the entire platform.
2. **Global Organization Admin** — Manages branches, workforce, and workspace configuration within a single organization.
3. **Branch Admin** — Manages floor plans, employee accounts, and bookings within a single branch.
4. **Employee** — Self-service desk booking, team pod reservations, and booking management.

Each tier must have strict boundaries: a Branch Admin cannot access another branch's data, and an Employee cannot see another branch's floor plan.

Alternatives considered:

1. **Flat role system (Admin/User)** — Too coarse. Cannot differentiate between platform-level and organization-level admin capabilities.
2. **Attribute-Based Access Control (ABAC)** — Flexible but adds complexity with policy engines. The hierarchical nature of the data naturally maps to a tier-based model.
3. **External IAM service (Auth0, Firebase Auth)** — Adds external dependency and cost for a custom role hierarchy that is tightly coupled to the data model.

## Decision

We will use a **four-tier RBAC hierarchy** defined as a Prisma enum:

```prisma
enum Role {
  PLATFORM_ADMIN
  ORGANIZATION_ADMIN
  BRANCH_ADMIN
  TECH_LEAD
  EMPLOYEE
}
```

Access control is enforced at two levels:

1. **API middleware**: Every authenticated route extracts the user's `role` and `organizationId` from the JWT payload. Route handlers verify role authorization before processing.
2. **Frontend routing**: The React router renders role-specific page sets — Platform Admin sees the tenant management console, Organization Admin sees workforce/workspace tools, Branch Admin sees branch floor plans and employee management, and Employee sees the booking portal.

Branch scoping is implemented via `scopedBranchId` on the `User` model, which restricts Branch Admins and Employees to their assigned branch's data.

## Consequences

- **Positive**: Clear separation of concerns — each role sees only relevant UI pages and can only access scoped API endpoints.
- **Positive**: The `TECH_LEAD` role provides a natural extension point for team-level features (e.g., team booking approval, team pod allocation).
- **Positive**: Branch scoping via `scopedBranchId` provides a single, consistent mechanism for data isolation within an organization.
- **Negative**: Adding a new role requires schema changes (Prisma enum), API route guards, and frontend routing updates — a coordinated cross-stack change.
- **Negative**: The RBAC model does not support dynamic permissions (e.g., "this specific Branch Admin can also view another branch"). Such requirements would need an additional permissions table.
