# 0008: Rectangle appearance

Accepted 21 October 2026.

Rectangles support optional semantic `appearance`: a six-digit hexadecimal
stroke color, stroke width (0.5–12 world units), solid/dashed/dotted stroke,
opacity (0–100) and corner radius (0–50 world units). Fill also supports
`transparent`. An absent appearance uses the defaults:
slate stroke, 1.5 width, solid, full opacity and radius 8. Default appearance does not require materializing redundant fields.

Appearance is part of the current version-1 format. It is validated,
serialized and compared in transaction preconditions, and follows normal
movement, resizing and duplication. Styling is one undoable command per commit.

The renderer saves/restores drawing state per rectangle so dash patterns and
opacity cannot leak into other records or selection handles. Width and radius
scale with the camera. Invisible/transparent rectangles retain their semantic
bounds and can be selected through the object navigator.

Rough/sketch rendering, patterned fills and rotation remain outside this contract.
