# Hydraw milestone log

## Milestone 1 — local editor foundation

Implemented on 20 October 2026:

- Pinned Vite+ / pnpm / Node setup with explicit workspace dependencies and strict TypeScript.
- Owned rectangle document model, validation, hit-testing, gesture lifecycle, local history, camera and Canvas rendering.
- React editor shell, fill controls, object list, keyboard creation/movement, deletion and JSON export.
- IndexedDB save/reload with transaction acknowledgements, recovery warnings and a single-writer tab lock.
- Hono health API, production static serving and navigation fallback.
- Automated unit/server/browser checks, CI and dependency-boundary verification.

This is the first runnable slice of the plan. It does not complete the foundation prototype or the local alpha described in PLAN.md.

## Milestone 2 — resizing, transactions and one container

Implemented on 20 October 2026:

- Eight-handle rectangle resizing with screen-space hit targets, anchored edges, crossing normalization and cancellation.
- Editable X/Y/width/height fields with validation and undo/redo.
- Reversible document transactions that retain changed records, validate preconditions and apply atomically. Unchanged records are shared; history no longer retains whole-board copies.
- Document model, validation, transactions and geometry separated into focused modules. Editor coordination, gestures, history and browser input/rendering separated as well.
- App composition split from board-session/save hooks, toolbar, canvas, controls, inspector and geometry fields.
- Simplified server: a mounted `/api` router followed by static frontend serving and a React fallback.
- Multi-stage Docker packaging: built frontend plus a self-contained Hono bundle, one non-root Node process. No frontend runtime server or production dependency installation.
- Regression coverage for inverse transactions, atomic failure, all resize handles, geometry limits, development/production browser flows and container startup/routing/assets.

## Milestone 3 — reviewed import and previous-board recovery

Implemented on 20 October 2026:

- Version 0 JSON import with file-size and UTF-8 byte limits, document validation, name/object-count review, cancellation and an export-current action.
- One retained previous board, restored through the same review flow. Restoring swaps current and previous boards, allowing another restore to reverse it.
- A framework-independent persistence controller serializes autosaves and replacements. IndexedDB writes primary and recovery records atomically before publishing the new editor document.
- Editor mutation leases prevent edits during replacement. Successful replacement resets selection, camera and undo history; failed storage writes preserve the open board and existing recovery copy.
- Unreadable recovery data does not block a valid current board. Autosaves preserve it, and replacement explicitly warns before overwriting it.
- Unit coverage for queue ordering, replacement failure and lease ownership. Development/production browser coverage for review, invalid files, cancellation, export round trips, recovery across reloads, and aborted or synchronously failed storage writes.

## Milestone 4 — standalone text editing

Implemented on 20 October 2026:

- Version 1 document model with a discriminated shape union, validated text records and explicit migration of version 0 rectangle boards. Transactions compare every text/style field and reject changing shape type under the same identity.
- Text creation through T + click, keyboard placement or the inspector. Inline multiline drafts commit as one transaction on blur or Ctrl/⌘ Enter; Escape cancels. Clearing existing text deletes it through normal history.
- Font size, weight, alignment and ink controls; selection, movement, deletion, undo/redo, save/reload, export, import and recovery share the existing paths.
- Pure word/grapheme wrapping with injected browser font measurement. Width resizing reflows text and derives its height. Imported bounds are recomputed before storage replacement so persisted and displayed text agree.
- Native textarea overlay for editing and Canvas rendering for committed text. Core code remains independent of React and browser APIs; no runtime dependencies added.
- Regression checks for Unicode, wrapping, draft lifecycle, styling, type-safe history, old document migration, pointer resizing, keyboard movement at zoom and import/export round trips. Desktop and narrow mobile editing layouts inspected.

## Milestone 5 — bound connectors

Implemented on 20 October 2026:

- Version 2 adds a separate connector collection with point or shape-bound endpoints, ink color and optional arrowheads. Version 0 and version 1 boards migrate without losing rectangles, text or style.
- Straight arrows derive automatic perimeter attachments from current node bounds, including temporary rectangle move/resize and text editing previews. No coordinate caches or binding rewrites per pointer frame.
- C + drag creates a connection with binding highlights. Screen-space endpoint handles reconnect to nodes or canvas points. Centered free arrows can be added by keyboard or the inspector.
- Connector selection, color/arrowhead controls, reversal, detaching, free-arrow movement, deletion and normal history. Attached arrow bodies remain fixed until detached.
- Node deletion and empty-text completion remove incident edges in one transaction. Undo restores nodes and connectors in their original order. Completed graph validation rejects dangling references, duplicate identities and unsupported self-bindings atomically.
- Save/reload, export, reviewed import and recovery retain connectors. Invalid imported graphs preserve the current board.
- 52 unit/server tests and 42 development/production browser checks passed. Connector domain and interaction logic received focused Luna review; desktop drawing and narrow-screen toolbar layouts were visually inspected. No runtime dependencies added.

## Milestone 6 — multiselection and duplication

Implemented on 20 October 2026:

- Canonical immutable selection identities with a derived single-object identity, keeping geometry, text and connector tools restricted to exactly one selected object.
- Shift-click toggles membership on canvas or in the object list. Marquee selection supports either drag direction and additive Shift + drag; cancellation restores prior membership. Select All has both keyboard and visible controls.
- Group drag previews stay separate from the document; pointer completion or a keyboard nudge applies one transaction. A common constrained delta preserves group spacing at coordinate limits, and connectors resolve against all moved node previews.
- Independent graph duplication through Ctrl/⌘ D or the inspector. Fresh node/edge identities, copied internal connections, remapped bindings and detached external endpoints. One undo removes the entire copy; capacity or identity failures preserve the existing document.
- Mixed selection deletion cascades incident edges once and restores original collection order through one inverse. Selection is pruned when objects disappear and cleared on board replacement.
- Focused selection geometry/gesture helpers and a separate renderer for selection outlines and marquees. Inspector sections now retain their content height and scroll without the footer overlapping object-list entries; the keyboard-reference panel also scrolls in short viewports.
- 65 unit/server tests and 50 development/production browser checks cover graph operations, Shift-click, reverse/additive marquees, group move/cancel, duplicate/undo/redo, text-input shortcut isolation and saved copies after reload. Focused Luna reviews found no remaining operation or interaction defects. No runtime dependencies added.

## Milestone 7 — alignment and center distribution

Implemented on 20 October 2026:

- Six shape alignment modes use selected node bounds: left, horizontal center, right, top, vertical center and bottom. At least two rectangles/text objects are required; selected connectors do not influence targets.
- Horizontal and vertical center distribution keep the two outer centers fixed, order tied centers by document order and preserve collection stacking. At least three shapes are required; sizes and text layout remain unchanged.
- Every action uses one reversible transaction. Bound endpoints follow the moved nodes without rewriting edge records, while unselected nodes and free arrows remain in place.
- Layouts exceeding coordinate limits reject the entire operation with a dismissible error. Insufficient selections and repeated layouts preserve history and redo; numeric comparisons account for cancellation error from large or fractional bounds.
- Focused inspector controls receive values and callbacks, with accessible names, disabled states based on shape count, and explicit center-spacing guidance. Editor commands share the existing replacement lock and gesture cancellation paths.
- 81 unit/server tests and 58 development/production browser checks passed, including all alignment modes, distribution, text/binding preservation, undo/redo, reload and coordinate-error recovery. Desktop and narrower inspector layouts visually checked. No runtime dependencies or schema version changes.

Next: clipboard copy/paste. Keep each slice runnable and verified before expanding.

## Maintenance — code audit and simplification

Completed on 20 October 2026 after milestone 7. See [the audit](CODE_REVIEW.md) for
all eleven findings and their resolution.

- Native export now uses validated compact JSON. The import envelope is 80 MB so
  supported text-heavy boards can reopen their backups; shape, connector and text
  limits are unchanged.
- Shared atomic collection application removes duplicated transaction rules and
  retains untouched arrays. Connector batches use a derived shape index; canvas
  text layouts use a per-renderer weak cache.
- Pure gesture planning is separate from editor coordination. Single-object and
  group drags share translation constraints. Failed completions clear previews,
  and pointer cleanup respects the owning pointer.
- A board-session factory owns startup resources independently of React.
  Initialization failures release storage, cancellation does not publish stale
  sessions, and unavailable canvas support produces an explicit startup error.
- Persistence observation reconciles missed revisions on reconnect and ignores
  obsolete write failures when reporting the current save state.
- Inspector object navigation, color swatches and validated numeric controls have
  focused components. Missing built assets return 404 while frontend navigation
  retains its SPA fallback.
- `pnpm run ready` passed: lint/format, strict types, package boundaries, 95
  unit/server tests, production builds and 62 Chromium browser journeys.
  Desktop/narrow numeric-error layouts were inspected. No dependencies added;
  Docker and other browsers were not rerun.

The next product milestone remains clipboard copy/paste.

## Milestone 8 — canvas workspace usability

Implemented on 20 October 2026 with Luna agents owning the header, inspector and
canvas controls, plus primary-agent layout integration and product sequencing.

- Compact 56 px header keeps board identity, local save feedback and file actions
  visible. Enter commits a rename; Escape cancels it. An inspector toggle expands
  the desktop canvas without changing selection or content.
- Relevant properties and compact selection actions replace decorative inspector
  copy. Bounded object navigation and a short insertion row remain accessible.
- A smaller tool dock, quiet empty state, stable zoom controls and dismissible
  keyboard reference give the canvas a clearer hierarchy. The reference supports
  close, Escape and outside-pointer dismissal with focus restoration. Escape
  belongs to the active dialog rather than an underlying shortcuts reference.
- Below 900 px the inspector opens as a drawer with an explicit close control,
  contained keyboard focus and an inactive background. Closing restores the
  trigger; starting text editing releases the drawer and focuses the native input.
- Text added from insertion controls or the keyboard is centered in the current
  viewport; text-tool clicks retain direct placement. Narrow-screen regression
  checks verify that the initial text box fits inside the canvas.
- Header, inspector and canvas controls own their stylesheets over shared design
  tokens. No production dependencies or document schema changes were added.
- `pnpm run ready` passed formatting/lint, strict types, package boundaries,
  production builds, 96 unit/server tests and 76
  development/production Chromium browser journeys passed. Blank, selected, text
  connector, multiselection, narrow drawer and short-window layouts were visually inspected. Docker and other browsers
  were not rerun.

See [the UX plan](UX_PLAN.md) for design decisions and [the current product
sequence](NEXT.md) for the next milestones. Attached rectangle labels now precede
clipboard and visual export so the named-diagram workflow can be completed.
