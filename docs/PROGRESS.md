# Current implementation

Architecture refactor, 26 October 2026: a framework-independent `DocumentSession`
owns committed state and history. Editor tools submit transactions to that session;
persistence observes explicit commit events rather than camera/gesture updates.
Commit origins distinguish local edits, undo, redo and board replacement.

Updated 25 October 2026. Git history records the development milestones.

Hydraw is a local canvas editor for architecture diagrams. It supports geometric
shapes, attached labels, standalone text, bound straight and elbow connectors, embedded
images and nondestructive crops, freehand ink, frames and editable presets.

Selection supports alignment, distribution, duplication, clipboard reuse, groups,
locks and stacking. A personal library stores reusable selections. Board themes,
SVG/PNG export, image copy, native JSON import/export, undo/redo and a previous-board
recovery copy complete the local workflow. Image insertion is a direct toolbar
action; the library has a separate launcher. Contextual panels expose visual style
controls, opacity and drawing-width sliders, and precise geometry fields.

The document format is reset to version 1 with no earlier-format migration. See
[the format contract](FORMAT.md), [the next product work](NEXT.md) and the ADRs for
current behavioral and architectural decisions. Package versions remain `0.0.0`.

Verification commands are documented in the root README. Keep checks and related
tests with each cohesive change; record results in the commit or change report.

Elbow connectors use automatic or manually positioned middle segments. Routing,
canvas/SVG/PNG, hit testing, erasing, labels, framing and selection bounds share
polyline geometry. Bend dragging previews without saving, commits one undo step,
and cancels without changing history. Straight/elbow, end direction and reset
controls live in connector properties.

Custom HEX colors are available beside preset swatches for fills, strokes, text,
connectors and freehand ink. A shared picker stages edits until Apply, accepts
short HEX input and keeps eight recent colors in browser-local preferences.
Transparency remains a separate fill choice. Invalid CSS never reaches records.

Freehand strokes and images preserve their orientation when resize handles cross
the opposite edge. Image reflections remain consistent through crop editing, reset,
history and canvas/SVG/PNG rendering; text and labels remain readable.

Resizing freehand ink across its opposite edge reflects its normalized points.
The fixed edge stays anchored, drag handles follow the crossing, and moving back
restores the source orientation before committing one undo step.
