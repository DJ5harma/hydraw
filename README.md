# Hydraw

An owned visual workspace, built incrementally. The current increment is a local visual editor with shapes, text, images, freehand drawing and bound connectors with a React shell and a framework-independent Canvas 2D engine. See [PLAN.md](PLAN.md) for the larger product direction, [the milestone log](docs/PROGRESS.md) for what actually exists, and [the code audit](docs/CODE_REVIEW.md) for cleanup findings.

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

- Save editable selections through Save to library in properties/context actions. Open My library from Board menu or Insert to search, rename, delete or reinsert them with fresh identities and internal bindings preserved. The local library survives board replacement/reload, holds up to 50 items and 50 MB total, and reports storage/quota errors without changing the board.

- Double-click an unlocked image or choose Crop image in its properties/context menu. Drag an edge, or focus a crop handle and use arrows (Shift for larger steps); Apply commits one undoable crop. Cancel/Escape discards the draft. Reopen to adjust it or Reset crop to recover the original picture. Native files and SVG retain the original image; PNG exports and clipboard copies contain the visible crop.

- E selects an object eraser. Sweep across ink, shapes, text, pictures or connectors to remove them together in one undo step. Frames erase at their borders. Locked objects/groups stay protected; Escape cancels an unfinished sweep.

- Copy selected objects or a frame directly as a crisp 2× PNG from selection properties or the context menu. Board menu → Copy as image also copies whole boards, with board-style or transparent backgrounds. Clipboard failures are visible and leave document/history unchanged.

- Freehand drawing with P or Draw: choose ink color and width, scribble over images or blank canvas, then select, move, resize, group or lock strokes. Hold a roughly closed rectangle or ellipse for half a second to straighten it; moving again continues the original ink. Escape cancels an unfinished stroke. Dots and straight marks work too. Paths persist and export, with up to 4096 points per stroke and 100,000 per board.

- Insert PNG, JPEG or WebP pictures with Insert → Image, paste with the canvas focused, or drag files onto the canvas. Move/resize images, draw over them and attach connectors. Pictures stay embedded through reload, clipboard and native/SVG/PNG export. Files up to 12 MB/40 megapixels are normalized to PNG at up to 4096 pixels per side; encoded data is limited to 4 million characters per picture and 24 million per board.
- Drag the small connection handles on a selected shape to another object or empty space. Empty drops create a matching connected shape and start label editing. The ordinary C connector tool still supports free arrows.
- Choose Clean, Notebook or Blueprint in Board menu → Board style. Colors, fonts and canvas background change together, persist, export and undo without replacing editable objects.

- Full-window canvas with a compact tool dock and board menu. Selecting an object immediately shows its relevant styling in a floating properties panel; precise geometry, objects and help open on request. Toolbar shortcuts remain visible. Object navigation searches and pages large boards without a permanent sidebar. Fit board/selection brings offscreen content into view.

- Draw rectangles, ellipses and diamonds using direct toolbar buttons; select and move them, change background/stroke colors, border width/style, opacity and square/rounded corners, and delete them. Transparent backgrounds are supported.
- Resize with eight edge/corner handles or edit X, Y, width and height through More properties. Dragging across the opposite edge keeps dimensions positive. Invalid numeric edits stay out of saved documents.
- Shift-click objects on the canvas or in the object list to toggle selection. Drag empty canvas to select fully enclosed nodes and arrows; Shift + drag adds enclosed objects. Ctrl/⌘ A or Select all objects selects unlocked objects.
- Drag a selected object or use arrow keys to move a selection together. Bindings stay attached, and one common movement delta preserves spacing at coordinate limits.
- Duplicate selection with Ctrl/⌘ D or the selection shelf button. Copies get fresh identities and a 24-unit offset. Connections between copied nodes are included automatically; copied connections to unselected nodes become free endpoints.
- Smart guides align selection edges/centers and neighboring gaps while dragging. Hold Alt to bypass snapping; arrow-key nudges stay exact.
- Group/ungroup with Ctrl/⌘ G / Ctrl/⌘ Shift G. Selecting one member selects the whole flat group; moves preserve relative positions. Copies form independent groups.
- Lock/unlock with Ctrl/⌘ Shift L. Click a locked object directly on the canvas to show Unlock; dragging, resizing and editing stay protected. Marquee and Select All skip locked objects.
- Right-click objects, frame borders/titles or empty canvas for relevant commands. More actions (⋯), Shift F10 / Menu key and touch long-press open the same menu. Escape dismisses it; arrows/Home/End navigate. Styling and Unlock remain directly visible on selection.
- Change stacking from the context menu: Bring to front/forward or Send backward/back. Ctrl/⌘ ] or [ moves one step; add Shift for front/back. Shapes and connectors share one stack.
- Arrange ungrouped rectangles and text directly in the multiple-selection properties: align edges or centers with two or more shapes, or distribute centers horizontally/vertically with three or more. Outer centers stay fixed during distribution; attached arrows follow their shapes. Selected arrows do not affect the layout targets.
- Copy/cut/paste selections with Ctrl/⌘ C/X/V. Internal connections and labels travel with the selection; external references detach safely. Pasted objects get fresh identities at the viewport center. Native text clipboard shortcuts retain their normal behavior.
- Insert editable Request flow, Async worker and Service boundary presets with the toolbar’s + button. Each is a fresh group of labeled nodes and bound arrows, inserted in one undo step and fitted into view.
- Choose Frame selection from the context menu or Insert (+), insert an Empty frame, or press F and drag. Name frames, drag their border/title to carry fully enclosed objects, and resize their boundary without scaling contents. Deleting a frame keeps its objects. Frames only in Objects provides search and jump navigation; selected frames export their enclosed graph as SVG or PNG.
- Export whole boards or explicit selections as SVG or 2× PNG from Board menu → Export image. Editable JSON export remains available.
- Undo/redo committed local actions. Group movement, duplication, deletion, alignment and distribution each create one undo step. Escape cancels a gesture; cancelling a marquee restores the prior selection, while Escape outside a gesture clears selection.
- Pan using the hand tool, wheel, middle mouse button, or Space + drag. Zoom using the controls or Ctrl/⌘ + wheel.
- Choose R/O/D then Enter to create a centered rectangle/ellipse/diamond. Enter or double-click on a selected shape or connector edits its attached label. Move a selection with arrow keys; Shift moves by 10. V/R/O/D/C/T/P/H switch tools.
- Create wrapped multiline text with T + click or T then Enter on the canvas. Double-click text, press Enter with it selected, or use Edit text in the floating text properties to edit. Enter inserts a new line; Ctrl/⌘ Enter or clicking away commits one undoable edit; Escape cancels it.
- Style text with 12–96 px font sizes, regular/bold weight, three alignments and five ink colors. Resize its width using side handles or More properties; height grows with content. Each text object supports up to 2,000 characters.
- Draw connectors with C + drag between objects or canvas points. Choose Straight or Elbow in connector properties; elbow routes offer horizontal/vertical ends and a draggable square bend handle. Reset bend returns to automatic routing. Bound endpoints follow rectangle movement/resizing and text reflow. Select the line or its object-list entry, then drag endpoint handles to reconnect.
- Choose preset swatches or a custom color for shape fill/stroke, text, connectors and ink. The custom picker supports a native color spectrum, HEX entry and recent colors saved in this browser. Apply commits one edit; Escape or outside click discards the draft.
- Change connector ink, toggle arrowheads, reverse direction or detach endpoints in the selected connector’s properties. Free arrows move by dragging or arrow keys; bound arrows move through their endpoints or attached objects. C + Enter creates a centered free arrow.
- Deleting a shape removes its attached connectors in one undoable action. Clearing an existing text object follows the same rule.
- Rename the board and export version 1 semantic JSON as `.hydraw.json`. Only the current format is supported; see [the format contract](docs/FORMAT.md).
- Recover the current board from IndexedDB after reload. Save status changes only after the storage transaction commits.
- Import version 1 `.hydraw.json` files up to 200 MB, with validation and a name/object-count preview before opening. Export the current board directly from the review dialog.
- Keep one previous board when importing or restoring. The current board and recovery copy change in one storage transaction; failed imports preserve both. Restore is reversible by restoring again.

One tab owns the local writer lock. Additional tabs enter an explicitly unsaved session instead of overwriting that board. If storage fails or saved data cannot be decoded, the app preserves existing storage and offers in-memory editing/export. Browser storage can still be cleared or evicted; export valuable work.

## Workspace

| Package                 | Responsibility                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@hydraw/document`      | Version 1 shape/image/ink/connector/label/frame/group/lock/order/theme records, validation, geometry and reversible transactions; no runtime dependencies |
| `@hydraw/editor`        | Local editor state, gestures, hit testing, transaction history and camera; depends only on the document package                                           |
| `@hydraw/editor/canvas` | Explicit browser adapter for Canvas rendering and pointer input                                                                                           |
| `@hydraw/web`           | React controls, contextual properties and object navigation, keyboard shortcuts, inline text input, IndexedDB and file transfer                           |
| `@hydraw/server`        | Hono API, static assets and SPA navigation fallback                                                                                                       |

Internal packages expose TypeScript source to the toolchain. They are private workspace packages, not published libraries. The web build bundles them; Vite+ `pack` bundles Hono and its adapter into the backend output.

Within packages, code is separated by responsibility: document model/validation/graph geometry/transactions; editor coordination/geometry/gestures/connector interactions/history; browser input/rendering/lifecycle; and React board persistence/components/editor controls. `App.tsx` only composes the session and workspace. Source and manifest checks enforce package direction, and editor core modules cannot import browser adapters.

Runtime dependencies are limited to the chosen React/Hono foundations and the Hono Node adapter. There is no editor, drawing, state-store, geometry or history library. Oxc is used only by a development-time dependency-boundary check; Playwright is used only for browser verification.

## Verify

```sh
pnpm exec playwright install chromium
pnpm run ready
```

`ready` runs Vite+ formatting/lint checks, strict TypeScript checks, package-boundary checks, unit/server tests, a production build, and Chromium browser journeys. On Linux CI, install Chromium with `--with-deps`. Browser tests start a dedicated Hono server on port 4173 and a Vite server on port 4174, then exercise both production and development builds, including React StrictMode storage lifecycles and the development API proxy.

Individual commands: `pnpm run check`, `pnpm test`, `pnpm run build`, and `pnpm run test:e2e`. The e2e command builds before running; unit tests and browser tests have separate discovery configuration. `pnpm run test:docker` builds and runs the actual image, verifies backend routes, React deep links, built assets and a non-root runtime, and removes its test container. CI runs both suites and is defined in `.github/workflows/ci.yml`.

## Current limits

Hydraw supports one local board with rectangles, ellipses, diamonds, attached labels, standalone text, images and nondestructive crops, freehand ink, straight and elbow connectors, frames, presets, groups, organization controls, clipboard reuse, a personal library, board styles, and visual export. Import requires writable local storage to preserve a recovery copy. Undo history is session-local and resets after reload, import or restore. History retains at most 100 transactions containing changed records rather than full-board snapshots. Transaction application is atomic and checks expected prior values.

An already loaded page can edit without network access. Offline application startup is not supported yet. Desktop Chromium is verified; other browsers, pen/touch behavior and accessibility need further testing. The responsive layout is an early shell, not a claim of full mobile editor support.

Text uses the board style’s system font family; custom fonts, rich text and automatic camera scrolling during long edits are future work. Whitespace-only text drafts are discarded; clearing standalone text removes it as an undoable edit; clearing an attached label retains its owner. Opening/import preserves canonical text geometry. Text, style and width edits explicitly update bounds using the local measurement adapter; font rendering may vary across platforms.

Connector routing supports straight and elbow routes with automatic perimeter attachments. Custom ports and self-loops are future work. Shapes and connectors share an explicit stack. Current limits are 5,000 shapes, 5,000 connectors and 200 MB native files.

Selection currently supports translation, duplication, deletion, alignment and center distribution. Group resizing/rotation and bulk styling are future work. Distribution uses equal center spacing rather than equal edge gaps; it does not prevent overlaps. Selection itself is transient and is not persisted or recorded in document history.

The next product milestone is local alpha evaluation, focused on fresh-user completion and measured larger-board interaction quality. See [the current product sequence](docs/NEXT.md) and [the workspace UX plan](docs/UX_PLAN.md). See [ADR 0002](docs/adr/0002-container-and-transactions.md) for packaging and editor transactions, and [ADR 0003](docs/adr/0003-local-import-and-recovery.md) for import and persistence boundaries. [ADR 0004](docs/adr/0004-text-and-document-versioning.md) covers text layout and editing; [ADR 0005](docs/adr/0005-bound-connectors.md) defines connector bindings, graph transactions and deletion. [ADR 0006](docs/adr/0006-selection-and-duplication.md) defines selection and graph duplication. [ADR 0007](docs/adr/0007-alignment-and-distribution.md) covers alignment and center distribution.
