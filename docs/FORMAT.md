# Native document format

Hydraw supports one native format: `format: "hydraw"`, `version: 1`.
The pre-release format was reset on 24 October 2026. Earlier development files
are unsupported; there is no migration or compatibility decoder.

Every document requires `name`, `theme`, `shapes` and `connectors`. Theme is one of
`clean`, `notebook` or `blueprint`. Empty collections are explicit arrays.
Version 1 includes rectangle/ellipse/diamond/frame records, standalone text,
embedded PNG images with optional crop rectangles, freehand ink, bound or free
connectors, attached labels, groups, locks and stacking metadata.

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
