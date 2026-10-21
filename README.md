# Hydraw

An owned visual workspace, built incrementally. The current increment is a local visual editor with rectangles, text and bound connectors with a React shell and a framework-independent Canvas 2D engine. See [PLAN.md](PLAN.md) for the larger product direction, [the milestone log](docs/PROGRESS.md) for what actually exists, and [the code audit](docs/CODE_REVIEW.md) for cleanup findings.

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

The Dockerfile builds React and Hono together. The runtime image contains the bundled backend and frontend assets; it does not install workspace dependencies or run a separate frontend server. A single Hono process listens on port 3000: `/api` and `/api/*` belong to the backend, and other GET/HEAD paths serve frontend files or React's entry point. Missing built assets return 404 instead of HTML. Frontend deep links may contain dots.

## Current slice

- Full-window canvas with a compact tool dock and board menu. Selecting an object immediately shows its relevant styling in a floating properties panel; precise geometry, objects and help open on request. Toolbar shortcuts remain visible. Object navigation searches and pages large boards without a permanent sidebar. Fit board/selection brings offscreen content into view.

- Draw rectangles, ellipses and diamonds using direct toolbar buttons; select and move them, change background/stroke colors, border width/style, opacity and square/rounded corners, and delete them. Transparent backgrounds are supported.
- Resize with eight edge/corner handles or edit X, Y, width and height through More properties. Dragging across the opposite edge keeps dimensions positive. Invalid numeric edits stay out of saved documents.
- Shift-click objects on the canvas or in the object list to toggle selection. Drag empty canvas to select fully enclosed nodes and arrows; Shift + drag adds enclosed objects. Ctrl/⌘ A or Select all objects selects the whole board.
- Drag a selected object or use arrow keys to move a selection together. Bindings stay attached, and one common movement delta preserves spacing at coordinate limits.
- Duplicate selection with Ctrl/⌘ D or the selection shelf button. Copies get fresh identities and a 24-unit offset. Connections between copied nodes are included automatically; copied connections to unselected nodes become free endpoints.
- Arrange selected rectangles and text directly in the multiple-selection properties: align edges or centers with two or more shapes, or distribute centers horizontally/vertically with three or more. Outer centers stay fixed during distribution; attached arrows follow their shapes. Selected arrows do not affect the layout targets.
- Copy/cut/paste selections with Ctrl/⌘ C/X/V. Internal connections and labels travel with the selection; external references detach safely. Pasted objects get fresh identities at the viewport center. Native text clipboard shortcuts retain their normal behavior.
- Export whole boards or explicit selections as SVG or 2× PNG from Board menu → Export image. Editable JSON export remains available.
- Undo/redo committed local actions. Group movement, duplication, deletion, alignment and distribution each create one undo step. Escape cancels a gesture; cancelling a marquee restores the prior selection, while Escape outside a gesture clears selection.
- Pan using the hand tool, wheel, middle mouse button, or Space + drag. Zoom using the controls or Ctrl/⌘ + wheel.
- Choose R/O/D then Enter to create a centered rectangle/ellipse/diamond. Enter or double-click on a selected shape or connector edits its attached label. Move a selection with arrow keys; Shift moves by 10. V/R/O/D/C/T/H switch tools.
- Create wrapped multiline text with T + click or T then Enter on the canvas. Double-click text, press Enter with it selected, or use Edit text in the floating text properties to edit. Enter inserts a new line; Ctrl/⌘ Enter or clicking away commits one undoable edit; Escape cancels it.
- Style text with 12–96 px font sizes, regular/bold weight, three alignments and five ink colors. Resize its width using side handles or More properties; height grows with content. Each text object supports up to 2,000 characters.
- Draw straight connectors with C + drag between objects or canvas points. Bound endpoints follow rectangle movement/resizing and text reflow. Select the line or its object-list entry, then drag endpoint handles to reconnect.
- Change connector ink, toggle arrowheads, reverse direction or detach endpoints in the selected connector’s properties. Free arrows move by dragging or arrow keys; bound arrows move through their endpoints or attached objects. C + Enter creates a centered free arrow.
- Deleting a shape removes its attached connectors in one undoable action. Clearing an existing text object follows the same rule.
- Rename the board and export version 4 semantic JSON as `.hydraw.json`. Existing version 0–3 boards migrate when opened.
- Recover the current board from IndexedDB after reload. Save status changes only after the storage transaction commits.
- Import version 0, 1 or 2 `.hydraw.json` files up to 80 MB, with validation and a name/object-count preview before opening. Export the current board directly from the review dialog.
- Keep one previous board when importing or restoring. The current board and recovery copy change in one storage transaction; failed imports preserve both. Restore is reversible by restoring again.

One tab owns the local writer lock. Additional tabs enter an explicitly unsaved session instead of overwriting that board. If storage fails or saved data cannot be decoded, the app preserves existing storage and offers in-memory editing/export. Browser storage can still be cleared or evicted; export valuable work.

## Workspace

| Package                 | Responsibility                                                                                                                                |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `@hydraw/document`      | Version 4 shape/connector/label records, earlier-version migration, validation, geometry and reversible transactions; no runtime dependencies |
| `@hydraw/editor`        | Local editor state, gestures, hit testing, transaction history and camera; depends only on the document package                               |
| `@hydraw/editor/canvas` | Explicit browser adapter for Canvas rendering and pointer input                                                                               |
| `@hydraw/web`           | React controls, contextual properties and object navigation, keyboard shortcuts, inline text input, IndexedDB and file transfer               |
| `@hydraw/server`        | Hono API, static assets and SPA navigation fallback                                                                                           |

Internal packages expose TypeScript source to the toolchain. They are private workspace packages, not published libraries. The web build bundles them; Vite+ `pack` bundles Hono and its adapter into the backend output.

Within packages, code is separated by responsibility: document model/validation/graph geometry/transactions; editor coordination/geometry/gestures/connector interactions/history; browser input/rendering/lifecycle; and React board persistence/components/editor controls. `App.tsx` only composes the session and workspace. Source and manifest checks enforce package direction, and editor core modules cannot import browser adapters.

Runtime dependencies are limited to the chosen React/Hono foundations and the Hono Node adapter. There is no editor, drawing, state-store, geometry, history or collaboration library. Oxc is used only by a development-time dependency-boundary check; Playwright is used only for browser verification.

## Verify

```sh
pnpm exec playwright install chromium
pnpm run ready
```

`ready` runs Vite+ formatting/lint checks, strict TypeScript checks, package-boundary checks, unit/server tests, a production build, and Chromium browser journeys. On Linux CI, install Chromium with `--with-deps`. Browser tests start a dedicated Hono server on port 4173 and a Vite server on port 4174, then exercise both production and development builds, including React StrictMode storage lifecycles and the development API proxy.

Individual commands: `pnpm run check`, `pnpm test`, `pnpm run build`, and `pnpm run test:e2e`. The e2e command builds before running; unit tests and browser tests have separate discovery configuration. `pnpm run test:docker` builds and runs the actual image, verifies backend routes, React deep links, built assets and a non-root runtime, and removes its test container. CI runs both suites and is defined in `.github/workflows/ci.yml`.

## Current limits

This milestone supports one local board, rectangles/ellipses/diamonds, attached labels, standalone text, straight connectors, clipboard reuse and visual export. Import requires writable local storage to preserve a recovery copy. Cloud storage, authentication, collaboration and hosted deployment are still planned. Undo history is session-local and resets after reload, import or restore. History retains at most 100 transactions containing changed records rather than full-board snapshots. Transaction application is atomic and checks expected prior values. These are local edit preconditions; server revisions, authorization and collaborative rebase are not implemented yet.

An already loaded page can edit without network access. Offline application startup is not supported yet. Desktop Chromium is verified; other browsers, pen/touch behavior and accessibility need further testing. The responsive layout is an early shell, not a claim of full mobile editor support.

Text has one system font family; custom fonts, rich text and automatic camera scrolling during long edits are future work. Whitespace-only text drafts are discarded; clearing standalone text removes it as an undoable edit; clearing an attached label retains its owner. Font metrics can vary across platforms, so text height is recalculated on opening/import.

Connector routing is straight, with automatic perimeter attachments. Elbow routing, custom ports and self-loops are future work. Edges render beneath nodes and share a separate collection; no arbitrary node/edge stacking controls yet. Current limits are 5,000 shapes, 5,000 connectors and 80 MB imported files.

Selection currently supports translation, duplication, deletion, alignment and center distribution. Group resizing/rotation and bulk styling are future work. Distribution uses equal center spacing rather than equal edge gaps; it does not prevent overlaps. Selection itself is transient and is not persisted or recorded in document history.

Next product milestone: smart placement guides, followed by groups, locking and object ordering. Attached labels, direct ellipse/diamond tools, SVG/PNG export and clipboard reuse are implemented. See [the current product sequence](docs/NEXT.md) and [the workspace UX plan](docs/UX_PLAN.md). See [ADR 0002](docs/adr/0002-container-and-transactions.md) for packaging and editor transactions, and [ADR 0003](docs/adr/0003-local-import-and-recovery.md) for import and persistence boundaries. [ADR 0004](docs/adr/0004-text-and-document-versioning.md) covers text layout and editing; [ADR 0005](docs/adr/0005-bound-connectors.md) defines connector bindings, graph transactions and deletion. [ADR 0006](docs/adr/0006-selection-and-duplication.md) defines selection and graph duplication. [ADR 0007](docs/adr/0007-alignment-and-distribution.md) covers alignment and center distribution.
