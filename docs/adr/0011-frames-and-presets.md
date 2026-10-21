# 0011 — Named frames and editable architecture presets

Accepted 21 October 2026.

Native v6 adds the semantic rectangle kind `frame`. A frame reuses shape bounds,
identity, lock, label and history rules. Its label is a name above its border.
Earlier documents migrate without identity changes. Frames cannot be connector
binding targets. They remain transparent and do not intercept their empty interior.

Frame contents are spatial: fully enclosed nodes and edges travel when the frame
moves. A group crossing its boundary is excluded as a whole. Membership is resolved
at gesture start; resizing changes the boundary and never scales contents. Nested
frames are excluded. A frame containing a locked member cannot move until that
member is unlocked. Deleting a frame leaves its contents. Copying or exporting a
frame includes enclosed contents, with bindings resolved against the full board.

Presets insert ordinary labeled shapes and bound edges in a fresh flat group.
There are three initial architecture flows; each is one atomic undoable insertion
with fresh identities, validated bounds/capacity and placement above existing
objects. They are editable diagrams, without a separate runtime template system.

Frames and presets use one transient Insert surface, preserving direct basic
shape tools. Named frame navigation stays in the existing on-demand navigator.
