# Auth - Authentication & Tenant Resolution Specification

## Purpose
Provides secure JWT authentication, password hashing with bcrypt, and dynamic multi-tenant subdomain resolution.

## Requirements
### Requirement: Multi-Tenant Subdomain Resolution
The system SHALL resolve the tenant organization from the host header, `x-tenant-subdomain` header, or query parameters.

#### Scenario: Tenant Context Binding
- **WHEN** an incoming HTTP request arrives at `/api/*`
- **THEN** `tenantMiddleware` resolves the tenant subdomain, fetches the `Organization` record, and attaches `req.organizationId` and `req.tenantSubdomain` to the request context.
