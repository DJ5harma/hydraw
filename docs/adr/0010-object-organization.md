# 0010 — Flat groups, locks and a shared object stack

Accepted 21 October 2026.

Native format v5 adds optional `groupId`, `locked` and finite `zIndex` metadata
to shapes and connectors. Earlier versions migrate without changing identities,
bindings or geometry. Metadata participates in transaction preconditions and undo.

Groups are flat: selecting a member expands to its entire group. Movement and
nudging preserve the members' relative positions. Regrouping merges whole groups;
ungrouping removes membership. Group resizing, nested groups and arranging members
are deferred. Duplication and clipboard paste create fresh, unlocked groups and
preserve their internal stack order above existing objects.

Locks protect direct edits, marquee selection and Select All. A later UX revision
allows clicking locked records on the canvas to expose Unlock, while blocking
dragging, resizing and editing. The object navigator also permits selection. Bindings still
follow their nodes; deleting a node retains the existing dependent-edge deletion
rule. Locks are editing conveniences, not access control.

One stable back-to-front scene order governs rendering, hit testing and image
export. Missing ranks preserve the previous connector-before-shape baseline.
Front/back moves the selection together; forward/backward advances each selected
run by one adjacent object. Ordering renormalizes ranks in one undoable transaction.

Smart guides apply to translation only, using the combined selection bounds.
Edges, centers and neighboring equal gaps snap within six screen pixels at any
zoom. Alt temporarily bypasses snapping. Guides are transient editor state, never
persisted or exported. Arrow-key nudges remain exact; drawing and resizing do not
snap in this increment.
