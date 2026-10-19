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

Next: text editing, then bound connectors. Keep each slice runnable and verified before expanding.
