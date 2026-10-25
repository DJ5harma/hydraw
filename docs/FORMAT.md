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

Board manifests, per-board recovery copies and immutable image assets live in
`hydraw-board-v2` (IndexedDB schema 1), under the `boards` and `assets` stores.
Keys are `[boardId, "primary" | "recovery"]` and `[boardId, assetId]`. Writer locks
are `hydraw-board-v2-writer:<boardId>`, so independent boards can open concurrently.
The current UI uses board ID `local`; the repository/session APIs accept other IDs.
Storage manifests use `assetFormat: 1` and image asset IDs instead of embedded PNG
sources. The asset codec hydrates portable semantic records on read and stores
SHA-256-addressed pixels separately. Manifests, pixels and recovery commit in one
transaction; unreferenced per-board assets are collected in that transaction.
Unreadable recovery manifests prevent collection until explicit replacement.
Personal library items live in
`hydraw-library-v1` (IndexedDB schema 1). Both databases start fresh after the reset.
The refactor starts a fresh board database. The app does not open, migrate or delete old development databases. Existing
browser data stays isolated; it cannot reappear through autosave or recovery.

## Colors

Fill accepts `transparent` or an opaque six-digit HEX color. Stroke, text, labels,
connectors and ink use opaque six-digit HEX. Decoding normalizes hexadecimal
letters to lowercase and rejects arbitrary CSS, short hex and alpha encodings.
The UI may expand short hex before committing. Preset palette values follow the
board theme; colors outside the preset palettes retain their exact values.

Recent custom colors are a separate UI preference under localStorage key
`hydraw-recent-colors-v1`, bounded to eight validated HEX entries. Preference
storage failures keep recents in memory and do not affect board persistence.

Images may carry boolean `flipX` and `flipY` reflection flags. Missing flags mean
unreflected pixels; false flags are omitted when decoding. Bounds remain positive.
Image crops always refer to original source pixels, with display coordinates
reflected for crop editing and source-bound recovery. Freehand reflections are
stored directly in normalized stroke points.

Text bounds are canonical semantic geometry. Opening, importing or receiving a
document validates those bounds without recalculating them from local font metrics.
User text/style/width changes explicitly commit updated bounds through the editor's
measurement adapter. Font rendering may still differ between platforms.
