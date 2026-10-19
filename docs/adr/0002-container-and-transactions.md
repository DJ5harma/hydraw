# 0002: One container and reversible local transactions

Status: accepted, 20 October 2026. Updates the history and packaging portions of ADR 0001.

## Deployment contract

Build both applications in a multi-stage Dockerfile. Bundle the backend's Hono dependencies, including subpath imports, into its ESM output. Copy that output and the React build into a non-root Node runtime image. The runtime needs neither pnpm nor node_modules.

The server composition mounts the API router at `/api`, then serves frontend files and React's entry point. The API router owns its own not-found response. Frontend routing does not guess based on dots in a path. Keep Node startup and shutdown in the entry point, HTTP composition in app.ts, and backend endpoints in routes/.

No hosted resources are provisioned. A provider-specific adapter, CDN deployment or serverless execution model is not a prerequisite for the application. The Docker smoke test builds the real image and exercises its API, deep links and static assets.

## Document transactions

Each local edit creates an immutable transaction with a label and ordered changes. A shape change retains before/after records and its stacking index; a rename retains before/after strings. Applying a transaction validates preconditions and changed records against a separate candidate, then publishes the new document only on complete success. Unchanged shape records are shared.

Undo applies inverse changes in reverse order. Redo reapplies the original transaction. History stacks change only after successful application. No-op edit builders return no transaction, preserving redo. History remains bounded to 100 transactions, with memory proportional to changed records rather than whole-board copies. Input arrays still require copying per application; this does not claim constant-time edits on large boards.

Preconditions compare whole affected records and stacking positions. They protect against stale inverses locally but are not yet field revisions, authorization or a collaborative synchronization protocol. Introduce those explicitly when cloud editing is implemented.

## Interaction and UI boundaries

The Editor coordinates gestures and commits transactions. Geometry helpers compute handle positions, hit targets and normalized resize results. Gesture functions compute temporary previews. Browser input owns pointer capture and cursor behavior; rendering consumes snapshots and cannot dispatch edits. The canvas mount owns resource cleanup.

The React application composes board session/persistence hooks and focused editor components. BoardHeader receives values and callbacks instead of accessing the editor runtime. Geometry fields keep drafts separate from committed values and use the same engine transaction path as pointer resizing. Invalid drafts do not reach the document or storage.

A drag produces previews until pointer completion, then one transaction. Escape, capture loss and blur cancel the gesture. Eight resize handles keep their hit areas in screen pixels across zoom levels. Opposite edges remain anchored; crossing an edge normalizes geometry with a minimum size of one world unit. Rotation and aspect-ratio modifiers are separate future work.

## Verification

Tests cover transaction round trips, ordered inverses, stale state rejection, atomic failure, structural sharing, no-op history behavior, all eight handles, coordinate limits, zoom, cancellation, numeric fields and reload recovery. Browser journeys run against both production Hono and development Vite/StrictMode. Container verification catches missing runtime dependencies that a workspace launch can hide.
