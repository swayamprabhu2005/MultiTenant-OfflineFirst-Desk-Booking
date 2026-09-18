# ADR-001: Use pnpm Monorepo Architecture

## Status

Accepted

## Date

2026-09-01

## Context

The Desk Booking platform consists of two primary applications — a React frontend (`apps/web`) and an Express.js backend (`apps/api`) — along with a shared TypeScript types package (`packages/shared`). We needed a project structure that:

- Allows both applications to share types, enums (e.g., `Role`, `SlotType`), and interfaces without manual synchronization.
- Supports a single `pnpm dev` command to start both API and web servers concurrently.
- Keeps dependency trees isolated per workspace while allowing cross-workspace references.
- Enables atomic commits and unified CI pipelines across the entire stack.

Alternatives considered:

1. **Multirepo (separate repositories)** — Would require a private npm registry or git submodules for shared types, adding deployment complexity and breaking atomic cross-stack refactors.
2. **npm workspaces** — Functional but lacks pnpm's strict dependency isolation (hoisting avoidance) and disk-efficient content-addressable storage.
3. **Turborepo / Nx** — Adds a build orchestration layer with caching, but introduces complexity disproportionate to a two-app workspace.

## Decision

We will use **pnpm workspaces** with the following layout:

```
MultiTenant-OfflineFirst-DeskBooking/
├── apps/
│   ├── api/          # Express.js + Prisma backend
│   └── web/          # React + Vite frontend
├── packages/
│   └── shared/       # Shared TypeScript interfaces & enums
├── pnpm-workspace.yaml
└── package.json      # Root scripts (dev, build, db:*)
```

The root `package.json` defines workspace-level scripts (`pnpm dev`, `pnpm --filter api build`, `pnpm --filter web build`) that target individual workspaces.

## Consequences

- **Positive**: Single `git clone` + `pnpm install` bootstraps the entire platform. Shared types in `packages/shared` are referenced directly without publishing.
- **Positive**: pnpm's strict hoisting prevents phantom dependency issues that arise in npm/yarn flat installs.
- **Positive**: The `run.bat` startup script can orchestrate all workspaces with a single `pnpm dev` invocation.
- **Negative**: Contributors must have pnpm installed globally (`npm install -g pnpm`). Standard npm/yarn workflows will not work.
- **Negative**: All workspaces share a single git history, which may complicate independent versioning if the project scales to many microservices.
