# ADR-010: Use Express.js REST API Backend

## Status

Accepted

## Date

2026-09-01

## Context

The backend must serve as the API layer for the multi-tenant desk booking platform, handling:

- Multi-tenant request routing with subdomain-based tenant resolution.
- Excel file upload/download for workspace provisioning and roster management.
- Transactional booking operations with conflict detection.
- Audit logging for governance and compliance.

Alternatives considered:

1. **Fastify** — Faster raw throughput via schema-based serialization, but the Express middleware ecosystem (multer for file uploads, helmet for security headers, express-rate-limit) is more mature and better documented.
2. **NestJS** — Provides architectural opinions (modules, controllers, services, dependency injection) but adds framework lock-in and boilerplate disproportionate to the API's surface area (~10 route files).
3. **tRPC** — End-to-end type safety between client and server, but requires a tightly coupled client. The platform's offline-first `fetchApi` client needs to work with raw HTTP for outbox replay.
4. **GraphQL (Apollo Server)** — Over-engineered for predominantly CRUD operations. The facility hierarchy endpoint is the only complex nested query, handled efficiently with Prisma's `include` syntax.

## Decision

We will use **Express.js 4** with the following architecture:

- **Modular route files**: Each domain area has a dedicated route file (`auth.routes.ts`, `employee.routes.ts`, `workspace.routes.ts`, etc.) mounted in `server.ts`.
- **Middleware pipeline**: `helmet` → `cors` → `express-rate-limit` (500 req/15min) → `tenantMiddleware` → domain routes.
- **Tenant resolution**: Global `tenantMiddleware` extracts the organization from `x-tenant-subdomain` header or HTTP `Host` header before any route handler.
- **File handling**: `multer.memoryStorage()` processes Excel uploads entirely in RAM — no disk I/O or temporary file cleanup needed.
- **Cold-start resilience**: Centralized error handler catches database connection failures and returns HTTP 503 with `Retry-After`, allowing the Vite proxy and `fetchApi` client to auto-retry.

## Consequences

- **Positive**: Express's minimalist design allows full control over the request pipeline without framework abstractions.
- **Positive**: Multer's memory storage mode eliminates file system cleanup logic and works in containerized environments without persistent volumes.
- **Positive**: The middleware pipeline enforces security (helmet, rate limiting, CORS) and tenant isolation consistently across all routes.
- **Negative**: Express does not enforce architectural patterns — discipline is required to maintain consistent error handling and response formats across route files.
- **Negative**: Express 4's lack of native async error handling requires explicit `try/catch` blocks in every route handler. Express 5 would address this but is not yet stable.
