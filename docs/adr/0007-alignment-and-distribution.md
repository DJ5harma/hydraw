# 0007: Alignment and center distribution

Status: accepted, 20 October 2026.

## Shape-only layout

Alignment and distribution act on selected rectangles and text. Connector identities are ignored when calculating targets; edge records are unchanged, and attached endpoints follow moved node bounds through existing binding resolution. Free arrows retain their canvas positions. No document version change is required.

The six alignment modes use the selected shapes' bounding union: left edge, horizontal center, right edge, top edge, vertical center and bottom edge. At least two shapes are required. Text moves without changing content, width, height or typography. Unselected nodes and all stacking positions remain unchanged.

Distribution spaces shape centers equally along the chosen axis. At least three shapes are required. Shapes are sorted by center position, with document order breaking ties. The two outer centers stay fixed; only interior positions change. This is explicitly center distribution, not equal gaps between edges or collision avoidance. Different-sized shapes may retain overlapping bounds.

## Atomicity and precision

Each action builds one ordinary reversible transaction, retaining only changed records. A coordinate-limit failure rejects the entire layout rather than clamping individual nodes and breaking alignment. No-op and insufficient-shape selections produce no history entry and preserve redo.

Floating-point cancellation can otherwise make repeated alignment generate microscopic position changes. Results within sixteen machine-epsilon units scaled to the selected geometry on that axis keep the exact prior coordinate. Scaling includes the operand positions and dimensions, so cancellation to an origin near zero remains stable even for very large shapes. This prevents spurious history without rounding the layout to a visible grid.

## Verification

Domain checks cover all six modes, selected bounds, text/style preservation, ignored connector identities, unselected structural sharing, transaction inverses, variable-sized shape centers, stable ties, fractional coordinates, repeated no-ops and coordinate-limit rejection.
