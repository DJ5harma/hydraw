# 0009: Shape kinds and attached labels

Accepted 21 October 2026.

The current format supports optional rectangle `kind` (rectangle, ellipse, diamond, frame) and
optional `label` to nodes and connectors. Existing rectangle identity/type is
preserved; absent kind is rectangle. Labels own plain text, font size/weight and
ink color, with the existing text limits. Clearing a label retains its owner.

One native text draft handles standalone text and labels. Owner identity routes
commit/cancel to an atomic owner update; the synthetic text layout never enters
the shape list. Enter on a selected object or double-click edits its label. The
label moves, resizes, duplicates, serializes and undoes with its owner. The text
tool can still create standalone notes on empty canvas.

A shared pure label layout centers text in a padded content area, inscribed for
ellipse/diamond. Overflow clips at that area; editing reveals the full draft.
Labels do not automatically resize objects. Connector labels use a bounded box
at the midpoint of resolved endpoints with a white backing for legibility.
Canvas and SVG export share text layout and clipping geometry.

Hit testing and connector perimeter intersections respect ellipse/diamond
silhouettes. Geometry remains an axis-aligned bounding box for resizing, alignment
and selection. Rotation, arbitrary ports and elbow routing remain separate work.
