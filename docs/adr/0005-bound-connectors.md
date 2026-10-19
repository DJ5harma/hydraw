# 0005: Bound connectors and document graph integrity

Status: accepted, 20 October 2026.

## Records and migration

Version 2 adds a separate connector collection. Shape records remain rectangles or text with bounds; connectors contain identity, two endpoints, ink color and an arrowhead setting. A connector is not a rectangle with fabricated bounds. IDs are unique across both collections.

An endpoint is either an explicit canvas point or a reference to a rectangle/text identity. Bound positions are derived rather than persisted: a ray from the target's center toward the other endpoint intersects the target's bounds. If both centers coincide, deterministic opposite horizontal sides avoid invalid arithmetic. Shape movement, resizing and text reflow therefore change attachment positions without modifying the edge record. Straight segments are the first routing policy; custom ports, self-loops, bends and obstacle avoidance are separate work.

The decoder migrates version 0 rectangle boards and version 1 rectangle/text boards into version 2 with no connectors. Legacy versions carrying nonempty connector data are rejected instead of silently dropping edges. Unsupported versions, malformed endpoints, duplicate identities, missing targets and both ends bound to the same shape fail validation.

## Transactions and deletion

Connector changes retain before/after records and collection positions, with the same stale-state preconditions as shape changes. Endpoint references are checked against the completed transaction candidate, allowing nodes and edges to change atomically. A failed graph check does not publish any partial changes.

Deleting a shape removes its incident edges in descending collection order, then removes the shape. Inversion restores the shape first and re-inserts edges in ascending order, preserving all collection positions. Unrelated edges are shared. Clearing an existing text object follows the same deletion contract. Direct connector deletion only removes that edge.

## Verification

Domain tests cover migration, immutable decoding, invalid references and identities, perimeter geometry, coincident centers, line-distance hit testing, cascade deletion with interleaved unrelated edges, inverse ordering and stale connector changes.
