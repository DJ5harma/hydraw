# Hydraw

An owned visual workspace, built incrementally. The current increment is a local rectangle editor with a React shell and a framework-independent Canvas 2D engine. See [PLAN.md](PLAN.md) for the larger product direction and [the milestone log](docs/PROGRESS.md) for what actually exists.

## Run locally

Use Node **24.22.x** and pnpm **12.14.0**. Vite+ **1.3.0** is pinned in the workspace; a global `vp` installation is optional.

```sh
pnpm install --frozen-lockfile
pnpm run dev
```

Open **http://127.0.0.1:5173**. Vite provides hot reload and forwards `/api` to Hono on port 3000. With the global Vite+ CLI, `vp install` and `vp run dev` are equivalent entry points.

To run the production build, with React served by Hono:

```sh
pnpm run build
pnpm start
```

Open **http://127.0.0.1:3000**. `PORT` and `HOST` configure the server. No account, database, environment file, or external service is needed for this milestone.

## Docker

```sh
docker build -t hydraw .
docker run --rm -p 3000:3000 hydraw
```

The Dockerfile builds React and Hono together. The runtime image contains the bundled backend and frontend assets; it does not install workspace dependencies or run a separate frontend server. A single Hono process listens on port 3000: `/api` and `/api/*` belong to the backend, and other GET/HEAD paths serve frontend files or React's entry point. Frontend deep links may contain dots.

## Current slice

- Draw rectangles, select and move them, change their fill, and delete them.
- Resize with eight edge/corner handles or edit X, Y, width and height in the inspector. Dragging across the opposite edge keeps dimensions positive. Invalid numeric edits stay out of saved documents.
- Undo/redo committed local actions. A continuous drag creates one undo step; Escape cancels it.
- Pan using the hand tool, wheel, middle mouse button, or Space + drag. Zoom using the controls or Ctrl/⌘ + wheel.
- Create a centered rectangle with Enter on the canvas or Add rectangle in the inspector. Move a selection with arrow keys; Shift moves by 10. V/R/H switch tools.
- Rename the board and export version 0 semantic JSON as `.hydraw.json`.
- Recover the current board from IndexedDB after reload. Save status changes only after the storage transaction commits.

One tab owns the local writer lock. Additional tabs enter an explicitly unsaved session instead of overwriting that board. If storage fails or saved data cannot be decoded, the app preserves existing storage and offers in-memory editing/export. Browser storage can still be cleared or evicted; export valuable work.

## Workspace

| Package                 | Responsibility                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `@hydraw/document`      | Version 0 semantic records, validation, geometry and reversible transactions; no runtime dependencies           |
| `@hydraw/editor`        | Local editor state, gestures, hit testing, transaction history and camera; depends only on the document package |
| `@hydraw/editor/canvas` | Explicit browser adapter for Canvas rendering and pointer input                                                 |
| `@hydraw/web`           | React controls, object inspector, keyboard shortcuts, IndexedDB and downloads                                   |
| `@hydraw/server`        | Hono API, static assets and SPA navigation fallback                                                             |

Internal packages expose TypeScript source to the toolchain. They are private workspace packages, not published libraries. The web build bundles them; Vite+ `pack` bundles Hono and its adapter into the backend output.

Within packages, code is separated by responsibility: document model/validation/reducers; editor coordination/geometry/gestures/history; browser input/rendering/lifecycle; and React board persistence/components/editor controls. `App.tsx` only composes the session and workspace. Source and manifest checks enforce package direction, and editor core modules cannot import browser adapters.

Runtime dependencies are limited to the chosen React/Hono foundations and the Hono Node adapter. There is no editor, drawing, state-store, geometry, history or collaboration library. Oxc is used only by a development-time dependency-boundary check; Playwright is used only for browser verification.

## Verify

```sh
pnpm exec playwright install chromium
pnpm run ready
```

`ready` runs Vite+ formatting/lint checks, strict TypeScript checks, package-boundary checks, unit/server tests, a production build, and Chromium browser journeys. On Linux CI, install Chromium with `--with-deps`. Browser tests start a dedicated Hono server on port 4173 and a Vite server on port 4174, then exercise both production and development builds, including React StrictMode storage lifecycles and the development API proxy.

Individual commands: `pnpm run check`, `pnpm test`, `pnpm run build`, and `pnpm run test:e2e`. The e2e command builds before running; unit tests and browser tests have separate discovery configuration. `pnpm run test:docker` builds and runs the actual image, verifies backend routes, React deep links, built assets and a non-root runtime, and removes its test container. CI runs both suites and is defined in `.github/workflows/ci.yml`.

## Current limits

This milestone supports one local board and rectangles. JSON export exists; importing it is a subsequent slice. Text, connectors, multiselection, SVG/PNG export, cloud storage, authentication, collaboration and hosted deployment are still planned. Undo history is session-local and resets after reload. History retains at most 100 transactions containing changed records rather than full-board snapshots. Transaction application is atomic and checks expected prior values. These are local edit preconditions; server revisions, authorization and collaborative rebase are not implemented yet.

An already loaded page can edit without network access. Offline application startup is not supported yet. Desktop Chromium is verified; other browsers, pen/touch behavior and accessibility need further testing. The responsive layout is an early shell, not a claim of full mobile editor support.

Next milestone: JSON import with recovery, then text and bound connectors. See [ADR 0002](docs/adr/0002-container-and-transactions.md) for the current packaging and transaction boundaries.
