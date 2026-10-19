# 0006: Atomic selection operations and independent graph copies

Status: accepted, 20 October 2026.

## Document operations

Selection identities are editor state, not document records. Version 2 remains unchanged. Focused document operation builders accept identities and return ordinary reversible transactions. Movement can also produce temporary record updates without validating or committing an entire board on every pointer frame.

All selected node origins and selected free connector endpoints constrain one shared movement delta. Group movement preserves relative positions when any member reaches its coordinate limit. Bindings remain references: selected nodes move their attached ends automatically, while explicit free endpoints move once. An attached end referencing an unselected node remains attached to it.

Mixed deletion removes selected connectors and edges incident to selected nodes once, in descending connector order, then removes nodes in descending shape order. Reversing the transaction restores nodes before edges in their original collection positions. Existing single-node deletion delegates to this same operation.

## Duplication

Duplicate appends selected nodes and explicitly selected connectors, plus any edge whose two bound targets are selected nodes. Internal bindings are remapped to new node identities. A copied binding to an unselected node becomes an independent canvas point at its resolved position before the common copy offset is applied. Copying an arrow alone therefore creates a free arrow rather than another connection to the original nodes.

Copies preserve text, styling, arrow direction and relative collection order. New identities are checked against all original and newly allocated identities. Capacity is checked for the entire node/edge set before building a transaction; failures cannot create partial copies. The default displacement is 24 world units on each axis, constrained as one delta at document limits. One undo removes the whole copy operation.

## Editor state and gestures

`selectedIds` is the canonical immutable editor selection. The singular `selectedId` is derived only when exactly one identity is selected; existing single-object tools never act on an arbitrary member of a group. Document changes prune missing identities, and replacement clears selection. Selection and camera changes do not create document revisions, autosaves or history entries.

Shift-click toggles membership on the canvas or object list. Dragging empty canvas selects fully enclosed shape bounds and straight segments whose endpoints are both inside the marquee. Shift + marquee unions that result with the previous selection. Marquees work in either drag direction. Cancelling restores the pre-gesture selection; completion keeps the result without a document transaction.

Dragging a selected member of a multiselection preserves the group and generates temporary record updates in a focused selection module. Rendering resolves connectors against all candidate node bounds; pointer completion commits those same updates once. Cancelling a move preserves selection and saved records. Native canvas Escape stops propagation for an active gesture so the workspace's idle Escape handler cannot immediately clear a restored selection. A second idle Escape clears selection.

Group geometry exposes an outline, not resize handles. Translation, duplication and deletion are the supported group actions in this slice. Inspector and keyboard controls use the same Editor commands. Shortcut handling leaves inputs, textareas and contenteditable controls to native editing; Ctrl/Command A in text does not select the document. Duplication errors surface in a dismissible workspace alert, without partially created objects.

Undo/redo apply document transactions and prune selected identities that no longer exist. Redo restores records with their existing identities but does not restore an old selection. This avoids conflating transient focus with document history. After reload or import, records remain while selection starts empty.

## Verification

Domain tests cover mixed movement, shared records, common clamping, internal graph cloning, explicit boundary edges, free-arrow copying, mixed cascade deletion, transaction inverses and capacity/identity failures. Editor tests cover selection membership, derived identity, zoomed group previews, cancellation, marquee containment and direction, selection bounds, replacement leases and undo/redo pruning. Browser journeys cover canvas/list Shift-click, additive/reverse marquee, native Escape propagation, group history, graph copies after reload and input shortcut isolation in both development and production.
