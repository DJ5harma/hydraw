# ADR 0016: committed document sessions and ID-addressed operations

Status: implemented, 26 October 2026. This replaces the editor-owned history portion
of ADR 0002. It does not introduce a hosted service or finalize a network protocol.

`DocumentSession` owns committed semantic state, history and a local monotonic
change counter. Tools and camera/gesture state remain in `Editor`. Persistence
observes immutable commit events, with local, remote, undo, redo and replacement
origins, an operation identity and changed object IDs. Replacement invalidates
prepared operations from the previous session epoch.

Existing pure transaction builders are local edit planners. At the session boundary
they become ID-addressed operations, with ID-based insertion anchors. Applying an
operation resolves current collection positions and validates the entire candidate
graph atomically. Collection arrays remain the portable document representation;
an unrelated deletion does not invalidate another object's position. Concurrent
appends and equal stacking ranks use authoritative acceptance order as the tie
breaker. Reordering depends on a scene-order version.

Prepared operations capture record versions and relationship dependencies. Node
deletion checks incident-connector dependencies; grouped edits check membership;
connector creation checks bound targets. Independent object edits combine, while
stale same-record edits fail, including when intervening edits restore old values.
This is intentionally conservative: concurrent geometry and label edits to one node
still conflict. Rejected proposals remain available to their caller for review.

Only local actions enter personal history. Undo/redo produce new ID-addressed
operations. A remote operation removes history entries depending on its changed
records/relationships and exposes a warning, keeping unrelated actions available.
It never applies another user's edit as a local history action. History remains
bounded to 100 actions. Recent duplicate deliveries are suppressed within a bounded
100-operation window; older deliveries fail stale version checks. This is an
in-process collaboration boundary, not durable exactly-once delivery.

The local test relay delivers operations in canonical order. Version preconditions
reject dependent out-of-order proposals without mutation. A future sync adapter
must sequence accepted revisions, catch gaps, persist pending drafts and reconstruct
confirmed/optimistic state. It must also bind board identity and authenticate the
actor; the session alone is not a network authorization boundary. Operations carry
a board ID and sessions reject cross-board delivery before applying changes.

Tests cover independent concurrent proposals, duplicate delivery, stale conflicts,
personal undo, ABA protection, replacement epochs, shifted array positions, group
membership and both connector-creation/node-deletion orderings. No React, Hono,
browser or remote service is needed for these tests.

External operations preserve camera, selection and unrelated gestures. A change
to a gesture's dependencies cancels it with feedback; conflicting text drafts are
queued for explicit recovery/dismissal, including across board replacement.
Loading/importing preserves canonical text geometry; only user edits measure and
commit new bounds. The session's replacement lease prevents both local and remote
writes during durable board replacement. Nested event publication retains revision
order for observers.

The browser board repository owns per-board IndexedDB writer leases. Stored
documents use a separate asset codec and immutable SHA-256-addressed images;
portable records continue to embed pixels. Asset checksums are verified on load.
Repeated geometry saves reuse stored pixels. Assets, manifests and recovery update
atomically; collection retains recovery references and preserves unreadable data.
The board database starts fresh without legacy migration, as requested.
