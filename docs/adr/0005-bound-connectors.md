# 0005: Bound connectors and document graph integrity

Status: accepted, 20 October 2026.

## Records and validation

The current format has a separate connector collection. Shape records have bounds; connectors contain identity, two endpoints, ink color and an arrowhead setting. A connector is not a rectangle with fabricated bounds. IDs are unique across both collections.

An endpoint is either an explicit canvas point or a reference to a rectangle/text identity. Bound positions are derived rather than persisted: a ray from the target's center toward the other endpoint intersects the target's bounds. If both centers coincide, deterministic opposite horizontal sides avoid invalid arithmetic. Shape movement, resizing and text reflow therefore change attachment positions without modifying the edge record. Straight segments are the first routing policy; custom ports, self-loops, bends and obstacle avoidance are separate work.

Unsupported versions, malformed endpoints, duplicate identities, missing targets and both ends bound to the same shape fail validation. Free endpoints allow a larger coordinate range than node origins so detaching a perimeter beyond an origin limit preserves its location. Whole-arrow movement clamps both endpoint extents together.

## Transactions and deletion

Connector changes retain before/after records and collection positions, with the same stale-state preconditions as shape changes. Endpoint references are checked against the completed transaction candidate, allowing nodes and edges to change atomically. A failed graph check does not publish any partial changes.

Deleting a shape removes its incident edges in descending collection order, then removes the shape. Inversion restores the shape first and re-inserts edges in ascending order, preserving all collection positions. Unrelated edges are shared. Clearing an existing text object follows the same deletion contract. Direct connector deletion only removes that edge.

## Interaction and rendering

The Editor coordinates normal history and document commands. A focused connector interaction module owns endpoint picking, line hit-testing, free-arrow translation and gesture previews. Binding tolerance and handles use screen-space distances across zoom levels. Renderers consume derived node previews and edge snapshots without dispatching commands. Connector rendering is separate from node/text rendering, with edges beneath nodes and selection handles above them.

C + drag creates an arrow between any mix of objects and canvas points. Drawing and endpoint reconnection publish transient previews, then commit once on pointer completion. Escape, lost capture, blur, tool changes and document replacement cancel those previews. Tiny free arrows and self-bound drawing are discarded. Reconnecting both ends to the same node leaves the original edge untouched.

Clicking a bound line selects it without moving its endpoints. Endpoint handles reconnect it; explicit detachment preserves current positions and enables whole-arrow dragging or keyboard movement. Inspector controls change color, toggle arrowheads, reverse direction and delete the connector through the same transaction path. Object-list entries provide selection even when a segment is obscured by overlapping nodes. Reviewed import shows connector counts and persists the complete graph through the existing replacement queue.

## Verification

Domain tests cover round trips, immutable decoding, invalid references and identities, perimeter geometry, coincident centers, line-distance hit testing, cascade deletion with interleaved unrelated edges, inverse ordering and stale connector changes. Interaction tests cover zoom, preview stability, live attachment geometry, reconnection, cancellation, free movement, coordinate limits, replacement locks and text-clear cascades. Browser journeys exercise drawing, node edits, endpoint dragging, styling, undo, reload, import and recovery against development and production builds.
