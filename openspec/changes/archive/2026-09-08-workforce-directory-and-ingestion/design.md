# Technical Design: Workforce Directory & Multi-Branch Roster Ingestion

## 1. Architecture & Component Interaction
- **Template Generator (`workforceController.ts`):** Queries all branches under `req.organizationId`. Creates an Excel workbook where each sheet title is sanitized to the branch name. Injects formulas linking corporate domain and default password.
- **Roster Ingestion Pipeline:** Multer parses file buffer -> validates columns across all branch sheets -> collects raw password strings -> deduplicates and precomputes bcrypt hashes -> batch executes `prisma.user.upsert` in an atomic transaction.

## 2. API Endpoints
- `GET /api/workforce/template`
- `POST /api/workforce/import`
- `GET /api/workforce/config`
- `POST /api/workforce/config`

## 3. Data Integrity & Constraints
- RFC 5322 regex validation on all emails.
- Email uniqueness across the tenant organization.
- Transaction timeout extended to 30s to comfortably handle 1,000+ employee records.
