# ADR-009: Use React with Vite and Tailwind CSS for Frontend

## Status

Accepted

## Date

2026-09-01

## Context

The frontend must deliver a rich, interactive experience — real-time floor plan exploration, multi-step booking flows, drag-to-select pod clusters, and role-specific dashboards. The technology choice must:

- Support component-based architecture for reusable UI elements across roles.
- Provide fast development iteration with hot module replacement (HMR).
- Minimize production bundle size for fast initial load times.
- Offer a large ecosystem of compatible libraries (icons, portals, date pickers).

Alternatives considered:

1. **Next.js** — Server-side rendering adds complexity but provides no benefit here — the platform is a single-page application behind authentication. SSR of authenticated pages requires session hydration, adding latency.
2. **Angular** — Steeper learning curve, larger bundle baseline, and TypeScript decorators add ceremony without proportional benefit for this application size.
3. **Vue 3** — Excellent developer experience but a smaller component ecosystem compared to React. The team's existing React proficiency favoured continuity.
4. **Create React App (CRA)** — Deprecated and slow. Webpack-based bundling is significantly slower than Vite's ESBuild-powered dev server and Rollup production builds.

## Decision

We will use:

- **React 18** with TypeScript for the component framework.
- **Vite 5** as the build tool — ESBuild for development transforms, Rollup for optimized production bundles.
- **Tailwind CSS 3** for utility-first styling — eliminating CSS file proliferation and enabling rapid prototyping with consistent design tokens.
- **Lucide React** for the icon library — tree-shakeable SVG icons with consistent stroke widths.
- **React Portal** (`createPortal`) for modals and overlays — preventing z-index stacking issues in deeply nested component trees.

The Vite dev proxy configuration routes `/api/*` requests to `localhost:4000`, with custom `ECONNREFUSED → 503` translation for cold-start resilience.

## Consequences

- **Positive**: Vite's HMR provides sub-100ms update cycles during development, enabling rapid iteration on floor plan layouts.
- **Positive**: Tailwind CSS keeps all styles co-located in JSX — no context-switching between component files and stylesheets.
- **Positive**: Production bundle is ~526KB gzipped (~129KB compressed), acceptable for an enterprise SPA.
- **Positive**: React's component model maps naturally to the facility hierarchy: `FloorSection` → `PodCluster` → `DeskCard`.
- **Negative**: Tailwind utility classes can make JSX verbose with long `className` strings. Mitigated by extracting repeated patterns into component-level constants.
- **Negative**: No server-side rendering means the initial HTML payload is a shell. Acceptable for an authenticated enterprise application where SEO is irrelevant.
