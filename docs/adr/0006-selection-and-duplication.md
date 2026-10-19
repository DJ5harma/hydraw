# 0006: Atomic selection operations and independent graph copies

Status: accepted, 20 October 2026.

## Document operations

Selection identities are editor state, not document records. Version 2 remains unchanged. Focused document operation builders accept identities and return ordinary reversible transactions. Movement can also produce temporary record updates without validating or committing an entire board on every pointer frame.

All selected node origins and selected free connector endpoints constrain one shared movement delta. Group movement preserves relative positions when any member reaches its coordinate limit. Bindings remain references: selected nodes move their attached ends automatically, while explicit free endpoints move once. An attached end referencing an unselected node remains attached to it.

Mixed deletion removes selected connectors and edges incident to selected nodes once, in descending connector order, then removes nodes in descending shape order. Reversing the transaction restores nodes before edges in their original collection positions. Existing single-node deletion delegates to this same operation.

## Duplication

Duplicate appends selected nodes and explicitly selected connectors, plus any edge whose two bound targets are selected nodes. Internal bindings are remapped to new node identities. A copied binding to an unselected node becomes an independent canvas point at its resolved position before the common copy offset is applied. Copying an arrow alone therefore creates a free arrow rather than another connection to the original nodes.

Copies preserve text, styling, arrow direction and relative collection order. New identities are checked against all original and newly allocated identities. Capacity is checked for the entire node/edge set before building a transaction; failures cannot create partial copies. The default displacement is 24 world units on each axis, constrained as one delta at document limits. One undo removes the whole copy operation.

## Verification

Domain tests cover mixed movement, shared records, common clamping, internal graph cloning, explicit boundary edges, free-arrow copying, mixed cascade deletion, transaction inverses and capacity/identity failures.
