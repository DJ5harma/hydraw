# Current implementation

Updated 24 October 2026. Git history records the development milestones.

Hydraw is a local canvas editor for architecture diagrams. It supports geometric
shapes, attached labels, standalone text, bound straight connectors, embedded
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
