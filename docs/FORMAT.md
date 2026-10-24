# Native document format

Hydraw supports one native format: `format: "hydraw"`, `version: 1`.
The pre-release format was reset on 24 October 2026. Earlier development files
are unsupported; there is no migration or compatibility decoder.

Every document requires `name`, `theme`, `shapes` and `connectors`. Theme is one of
`clean`, `notebook` or `blueprint`. Empty collections are explicit arrays.
Version 1 includes rectangle/ellipse/diamond/frame records, standalone text,
embedded PNG images with optional crop rectangles, freehand ink, bound or free
connectors, attached labels, groups, locks and stacking metadata.

Connectors are straight unless `route` is present. An elbow route is
`{ type: "elbow", axis: "x" | "y", position?: number }`. Axis `x` uses horizontal
end segments and a vertical middle segment; `y` uses vertical ends. The optional
position is the middle segment’s world coordinate, bounded like free endpoints.
Absent position chooses an automatic trunk. Routing keeps the trunk clear of
endpoint bodies; it does not avoid unrelated objects. Route edits participate in
transaction preconditions, undo, native round trips and selection reuse.

Optional appearance and organization fields express defaults or absent features;
they are part of the current schema, not migration fallbacks. The decoder copies
known fields, validates geometry, identities, bindings, styles and resource limits,
and freezes the result. Unknown versions fail explicitly. Import and export use
the same decoder and a 200 MB UTF-8 envelope limit.

Clipboard selections use the `hydraw/selection` version-1 envelope containing a
complete native document. Saved library items use those same validated fragments.
Undo/redo, atomic board replacement, recovery copies and cross-tab writer locks
remain current product features.

Package versions remain `0.0.0` until a release. Document, clipboard, IndexedDB and
package versions describe different contracts; they are not release counters.

## Local storage

The board and its recovery copy live in `hydraw-board-v1` (IndexedDB schema 1).
The writer lock is `hydraw-board-v1-writer`. Personal library items live in
`hydraw-library-v1` (IndexedDB schema 1). Both databases start fresh after the reset.
The app does not open, migrate or delete the old development databases. Existing
browser data stays isolated; it cannot reappear through autosave or recovery.
