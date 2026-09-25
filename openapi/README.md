# OpenAPI 3.0 Specification — Multi-Tenant Desk Booking Platform

This directory contains the official **OpenAPI 3.0.3** contract definitions for the Multi-Tenant Offline-First Desk Booking & Pod Allocation platform.

---

## 📁 Files

| File | Format | Purpose |
| :--- | :--- | :--- |
| [`openapi.yaml`](./openapi.yaml) | YAML | Human-readable primary OpenAPI 3.0.3 specification |
| [`openapi.json`](./openapi.json) | JSON | Machine-readable specification for Swagger UI, Redoc, Postman, and automated codegen |

---

## 🚀 Key Functional Modules Covered

1. **Authentication & Identity (`/api/auth`)**
   - Register tenant administrators and employees
   - Authenticate credentials and receive scoped JWTs
   - Retrieve current caller profile, role, and tenant boundary

2. **Multi-Tenancy & Brand Customization (`/api/organizations`)**
   - Tenant isolation and switching
   - Dynamic organizational branding (`primaryColor`, `accentColor`)
   - Operating Mode configuration (`CENTRALIZED` vs `DELEGATED`)

3. **Workspace Ingestion & Building Hierarchy (`/api/workspace`, `/api/branches`, `/api/buildings`)**
   - Multi-sheet Excel workbook batch ingestion (`.xlsx`)
   - Hierarchical structure: Branches &rarr; Buildings &rarr; Floors &rarr; Sections &rarr; Workstations &amp; Meeting Rooms

4. **Interactive 2D Workstations & Floor Plans (`/api/employee/floor-plans`)**
   - Scalable 2D floor plans with live workstation coordinates
   - Real-time availability matrix across sliding 7-day windows

5. **Desk Reservations & Team Pod Bookings (`/api/employee/bookings`, `/api/employee/bulk-bookings`)**
   - Single-day and multi-day range workstation bookings
   - Atomic mass workstation bookings (pod allocation) with per-desk teammate/colleague assignment
   - Meeting room reservations with duration and attendee management

6. **Cancellations & Bulk Operations (`/api/employee/cancel-booking`, `/api/employee/bulk-cancel`)**
   - Individual reservation cancellation
   - Mass multi-reservation cancellation with role scoping (Employees restricted to own bookings; Branch Admins restricted to branch bookings; Org Admin tenant-wide)

7. **Team Presence & Colleagues (`/api/employee/colleagues`, `/api/employee/presence`)**
   - Colleague search by name, email, or department
   - 30-day Outlook-style office presence calendar

8. **Defect & Issue Reporting (`/api/issues`)**
   - Workstation defect logging (hardware, AV, facility) with offline queue sync
   - Lifecycle management (`OPEN` &rarr; `IN_PROGRESS` &rarr; `RESOLVED`)

9. **Governance, Roster & Permissions (`/api/roster`, `/api/roster/permissions`)**
   - User directory and branch admin assignment
   - Centralized vs Delegated mode privilege matrix management

10. **Audit Trail & System Health (`/api/audit`, `/api/system/health`)**
    - Immutable audit logs for compliance tracking
    - Real-time health telemetry

---

## 🛠️ Viewing the API Documentation

### Option 1: Swagger UI (Docker / Local)
```bash
docker run -p 8080:8080 -e SWAGGER_JSON=/spec/openapi.json -v $(pwd)/openapi:/spec swaggerapi/swagger-ui
```
Then visit `http://localhost:8080` in your browser.

### Option 2: Redoc CLI (Zero Install via npx)
```bash
npx @redocly/cli preview-docs openapi/openapi.yaml
```

### Option 3: Import into Postman / Insomnia
1. Open **Postman** or **Insomnia**.
2. Click **Import**.
3. Select `openapi/openapi.json` or `openapi/openapi.yaml`.
4. All routes, request schemas, parameters, and documentation will automatically generate as an organized collection.
