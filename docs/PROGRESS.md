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

Next: alignment and distribution. Keep each slice runnable and verified before expanding.
