# 0015: Shared orthogonal connector paths

Accepted 24 October 2026.

Connectors remain separate semantic edges. An optional elbow route defines the
axis of the middle segment and an optional bounded world position. Without a
position, the trunk is automatic. Horizontal ends use a vertical trunk and
vertical ends use a horizontal trunk. Endpoint attachment follows the actual
rectangle, ellipse or diamond perimeter. The trunk stays outside the bounds of
both endpoint bodies with a small clearance. Unrelated objects are not routing
obstacles; obstacle avoidance is a separate future contract.

The document resolver returns endpoints, polyline vertices and the editable bend
handle. Canvas and SVG use the same vertices, with arrowheads tangent to the last
nonzero segment. PNG derives from SVG. Captions follow the midpoint by travelled
path length. Hit tests, eraser sweeps, marquee selection, framing and export/fit
bounds all use the full path, including bends beyond endpoint extents.

A square handle moves the trunk along its axis. The Bend X/Y numeric field also
supports precise keyboard editing with validation. Pointer previews never alter
persisted records; release commits one transaction, Escape/cancellation restores
the source, and clicks without movement add no history. Locked objects cannot be
edited. Direction changes reset the automatic trunk; switching to Straight removes
the route. Reset bend removes only the manual position.

Manual positions translate with selected edges; automatic positions derive from
current endpoint geometry. Moving an attached node alone leaves a manual trunk at
its world position. Reversing keeps the route and swaps endpoints. Detaching or
copying external bindings materializes the resolved trunk so the silhouette stays
stable. Duplication and clipboard/library reuse translate manual bends alongside
free endpoints and shapes. Route fields participate in validation and stale-edit
preconditions. The pre-release document remains version 1.
