# ADR-005: Use JWT Bearer Token Authentication with Stateless Sessions

## Status

Accepted

## Date

2026-09-01

## Context

The platform needs an authentication mechanism that:

- Works across multiple tenant subdomains without shared session stores.
- Supports offline-first capabilities where tokens must remain valid without server roundtrips.
- Encodes role and tenant context directly in the token to avoid per-request database lookups.
- Allows horizontal scaling of the API layer without sticky sessions.

Alternatives considered:

1. **Server-side sessions (Redis/PostgreSQL)** — Requires a centralized session store, adding network hops per request and complicating horizontal scaling. Offline-first clients cannot validate sessions without connectivity.
2. **OAuth2 with external IdP (Auth0, Okta, Azure AD)** — Introduces external dependency, cost, and complexity. Not suitable for air-gapped or on-premise deployments. Bulk roster provisioning of employee accounts cannot delegate to external providers.
3. **Cookie-based authentication** — Cross-subdomain cookie sharing is complex (`*.deskbooking.com` domain cookies) and does not work well with `fetch`-based API clients or mobile apps.

## Decision

We will use **stateless JWT Bearer tokens** with the following design:

- **Token payload**: `{ id, email, role, organizationId, scopedBranchId, mustChangePassword }`.
- **Signing**: HMAC-SHA256 with a `JWT_SECRET` environment variable.
- **Expiration**: 7-day TTL, balancing security with employee convenience.
- **Password hashing**: `bcryptjs` with 10 salt rounds.
- **Transport**: `Authorization: Bearer <token>` header on every API request, injected by the centralized `fetchApi` client.
- **First-login enforcement**: `mustChangePassword: true` flag locks full access for bulk-imported employees until they set a personal password.

## Consequences

- **Positive**: Zero database lookups for token verification — `jwt.verify()` is a pure cryptographic operation, keeping response times under 1ms for auth checks.
- **Positive**: Tokens work seamlessly with the offline-first architecture — cached tokens remain valid for 7 days without server connectivity.
- **Positive**: Horizontal scaling is trivial — any API instance can verify any token without shared state.
- **Negative**: Token revocation is not instant. A compromised token remains valid until expiration. Mitigation: 7-day TTL limits the window; a future blocklist endpoint can be added if needed.
- **Negative**: Token payload size grows with embedded claims (~400 bytes), adding overhead to every HTTP request.
