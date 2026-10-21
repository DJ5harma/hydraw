# 0008: Rectangle appearance and native format version 3

Accepted 21 October 2026.

Rectangles support optional semantic `appearance`: a six-digit hexadecimal
stroke color, stroke width (0.5–12 world units), solid/dashed/dotted stroke,
opacity (0–100) and corner radius (0–50 world units). Fill also supports
`transparent`. An absent appearance uses the earlier renderer's defaults:
slate stroke, 1.5 width, solid, full opacity and radius 8. Legacy rectangles retain
their records without materializing redundant default fields.

New documents and exports use version 3. Versions 0–2 migrate at decode without
mutating their source; styled fields require version 3. Older builds reject the
new version rather than silently discarding styling. Appearance is validated,
serialized and compared in transaction preconditions, and follows normal
movement, resizing and duplication. Styling is one undoable command per commit.

The renderer saves/restores drawing state per rectangle so dash patterns and
opacity cannot leak into other records or selection handles. Width and radius
scale with the camera. Invisible/transparent rectangles retain their semantic
bounds and can be selected through the object navigator.

This increment does not add rough/sketch rendering, patterned fills, rotation,
groups, layering controls, new shape families or attached labels. Those require
their own geometry/rendering/transaction contracts, not inactive property buttons.
