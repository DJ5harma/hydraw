# The next useful Hydraw release

Updated 25 October 2026 after completing connector routing, image reflection fixes,
custom colors, image crops and the personal library. This refines
PLAN.md; the owned-engine boundaries and broader direction remain in force.

## Product focus

Make architecture diagrams easy to sketch, name, tidy and put into documentation
without rebuilding them elsewhere. Finish that workflow before expanding into a
general whiteboard, workshop platform or design suite.

Today rectangles/ellipses/diamonds, attached node and connector labels, standalone
text, bound straight/elbow connectors, images and crops, freehand ink, multiselection,
alignment, duplication, native clipboard, SVG/PNG export, smart translation guides,
flat groups, locks, stacking, named frames, three editable presets, a personal library,
board styles, history, JSON and local recovery work. The local named-diagram workflow
is implemented; interaction quality and larger-board organization are the next focus.

## Ordered increments

| Order | Increment                                 | Exit condition                                                                                                                                                                                                        |
| ----- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Done  | Canvas-first workspace and fit navigation | No reserved header/default sidebar. Contextual actions preserve every existing workflow; fit board/selection makes offscreen content recoverable. Keyboard, responsive, persistence and interaction regressions pass. |
| Done  | Labels attached to shapes/connectors      | Type directly; label follows movement, resize, duplication, save and undo. Native round trips preserve standalone text and bindings.                                                                                  |
| Done  | SVG and PNG export                        | Board/selection exports faithfully include geometry and text, use predictable bounds/padding, and open in ordinary viewers. Editable native files remain available.                                                   |
| Done  | Selection clipboard                       | Copy/cut/paste connected selections with fresh identities and one undo step. Internal bindings survive; external references detach safely. Native input clipboard remains untouched.                                  |
| Done  | Smart placement and organization          | Edge/center and neighboring-gap guides during translation, Alt bypass, flat groups, direct-edit locks and cross-type ordering with atomic history.                                                                    |
| Done  | Named frames and reusable presets         | Name and navigate logical diagram regions; reuse useful technical arrangements without expanding the permanent toolbar.                                                                                               |
| Done  | Connector routing                         | Elbow routes and explicit bend edits share geometry across movement, bindings, history and exports.                                                                                                                   |
| Gate  | Local alpha evaluation                    | Fresh users finish the workflow; latency, text input, persistence, keyboard and browser evidence support the release claim.                                                                                           |

Fit moves into the workspace increment because a canvas without a permanent object
list needs excellent navigation immediately. Visual export moves before clipboard
because a named diagram that cannot leave the app as an image does not complete
the handoff. Clipboard is valuable once that end-to-end workflow works.

Each row spans small, runnable milestones. Include format validation, documentation and
regressions with the behavior they verify; commit verified milestones separately.
Do not combine this entire table into one implementation branch-sized change.

## Implemented label contract

ADR 0009 records the label contract. Labels start with plain text contained
by a rectangle, sharing existing text metrics and native input integration. Own
label content and placement on the shape rather than simulating attachment to an
independent text record. Specify wrapping, padding, overflow and minimum size;
avoid automatic resizing that unexpectedly moves neighboring geometry.

Preserve rectangle/text/connector identities during native round trips. Label editing is
one undoable action; movement/resizing and graph duplication carry the label.
Empty labels retain their rectangle. Standalone text remains available for notes.
Verify reload, native import/export/recovery, cancellation, IME composition and
coordinate limits before calling the feature complete.

## Export and clipboard contracts

Use shared semantic geometry and text layout for SVG; derive PNG through a tested
export path. Exclude selection outlines and UI. Validate multiline text, arrowheads,
negative coordinates, transparent backgrounds, bounds and high-DPI output. Begin
without external assets/fonts that require a separate packaging policy.

Reuse graph duplication rules for versioned clipboard fragments. Handle denied or
unavailable clipboard access visibly without losing selection. Copy changes no
history; cut and paste each apply an atomic transaction. Do not intercept events
inside native text controls or accept arbitrary JSON as editor commands.

## Evidence before expansion

Use a reproducible named-service exercise, then representative 100-, 1,000- and
limit-sized fixtures. Record hardware/browser and measure interaction latency,
text editing, export and memory; record-count validation is not a speed guarantee.
Include keyboard, 200% browser zoom, high DPI, IME and another browser engine.

Smart placement, flat groups, locking and front/back ordering are implemented in
ADR 0010. Named frames and three architecture presets are implemented in ADR 0011
(current native format). Frames use spatial containment and exclude partially contained
groups. Nested frames and presentation mode remain future work. Straight and elbow
routing are implemented; custom ports and self-loops remain future work. Defer broad shape
catalog expansion, templates, sketch styles, AI and presentation until observed use
supports them. Keep the current focus on the local diagram workflow and its quality.

## Board creation follow-up — 23 October 2026

Connected creation, embedded image insertion/paste/drop, freehand ink and held
rectangle/ellipse recognition, and Clean/Notebook/Blueprint styles are implemented.
See ADR 0012 for native records, image/sample budgets, undo, export and font contracts.
These additions broaden the local board and its editing workflow.

## Annotation and reuse follow-up — 24 October 2026

Copy as image completes direct PNG handoff with transparent or board-style
backgrounds. Whole-stroke erasing supports correction with gesture-scoped undo.
Native v10 adds non-destructive image crops, keyboard/drag handles, reset and
matching Canvas/SVG/PNG views. A browser-local personal library stores and reuses
named editable selections independently of board persistence. ADRs 0013 and 0014
record cropping and library contracts.
