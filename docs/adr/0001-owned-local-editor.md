# 0001: Start with an owned local editor

Status: accepted for milestone 1, 20 October 2026. The history and packaging decisions are updated by [ADR 0002](0002-container-and-transactions.md).

## Context

Hydraw should own its core systems and develop without a release deadline. We need a working editor journey to expose geometry, history, input and persistence requirements before designing the full product. The requested application foundations are React, Hono, Vite+, Drizzle and Supabase PostgreSQL. Cloud behavior is not needed for this first local slice.

## Decision

Use a pnpm/Vite+ workspace with four active packages: document, editor, web and server. Do not create empty UI, database, contracts or collaboration packages. Extract those when they own real behavior.

The document package owns versioned rectangle records and untrusted-data decoding. Editor methods own committed local edits, interaction previews and a subscribed immutable snapshot. The Canvas browser adapter owns drawing, input capture and resource cleanup. React owns the controls and local persistence integration. Pointer previews do not alter saved records; completion commits once. Selection and camera are outside document history.

Canvas 2D draws derived geometry directly. No editor SDK, rendering wrapper, geometry library, history library or state-store library is used. Hono and its Node adapter serve the production React build, with distinct API/asset errors and navigation fallback. No infrastructure is provisioned.

IndexedDB stores the current semantic board using transaction completion as the save acknowledgement. A native Web Lock grants one writer per origin. When a lock or storage is unavailable, the session clearly reports that changes are unsaved and retains export. Invalid/future data is never replaced automatically. This is a single-writer local milestone, not multi-tab synchronization.

History initially uses up to 100 immutable document snapshots. This makes local gesture behavior reviewable while the shape model is small. It has O(shape count × history depth) memory cost and performs whole-document validation per commit. Before large documents or collaboration, replace that implementation with explicit reversible transactions/operations, preserve these gesture tests, and measure memory and latency. Do not treat snapshot restoration as a collaborative undo protocol.

Portable JSON version 0 is deliberately limited to rectangles. Export serializes semantic records rather than canvas state. Future unsupported versions fail explicitly; version migrations require fixtures.

## Verification and revisit triggers

Unit tests cover decoding, drawing normalization, hit order, zoom math, gesture history, cancellation, redo invalidation and view/content separation. Server tests cover navigation fallback, health, API errors and immutable assets. Browser journeys exercise the production Hono build, pointer and keyboard input, reload recovery, export, single-writer locking and storage failures.

Revisit history before large shape counts or richer edit operations; revisit write ownership before shared local tabs or multiple boards; revisit storage/schema before import and migration. Add database/authorization and synchronization packages only with a cloud milestone that can exercise their policies end to end.
