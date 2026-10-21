# The next useful Hydraw release

Updated 21 October 2026 after implementing the canvas-first workspace. This refines
PLAN.md; the owned-engine boundaries and broader direction remain in force.

## Product focus

Make architecture diagrams easy to sketch, name, tidy and put into documentation
without rebuilding them elsewhere. Finish that workflow before expanding into a
general whiteboard, workshop platform or design suite.

Today rectangles, standalone text, bound straight connectors, multiselection,
alignment, duplication, history, native JSON and local recovery work. Attached
labels, visual export and clipboard reuse are still missing. The
new [canvas-first workspace](UX_PLAN.md) and fit navigation are implemented.

## Ordered increments

| Order | Increment                                 | Exit condition                                                                                                                                                                                                        |
| ----- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Done  | Canvas-first workspace and fit navigation | No reserved header/default sidebar. Contextual actions preserve every existing workflow; fit board/selection makes offscreen content recoverable. Keyboard, responsive, persistence and interaction regressions pass. |
| Next  | Labels attached to rectangles             | Type directly; label follows movement, resize, duplication, save and undo. Existing files migrate without losing standalone text or bindings.                                                                         |
| Then  | SVG, then PNG export                      | Board/selection exports faithfully include geometry and text, use predictable bounds/padding, and open in ordinary viewers. Editable native files remain available.                                                   |
| Then  | Selection clipboard                       | Copy/cut/paste connected selections with fresh identities and one undo step. Internal bindings survive; external references detach safely. Native input clipboard remains untouched.                                  |
| Then  | Placement and connector clarity           | Predictable snapping with feedback, then connector labels. Add elbow routing only when real diagrams demonstrate the need and its behavior can be specified.                                                          |
| Gate  | Local alpha evaluation                    | Fresh users finish the workflow; latency, text input, persistence, keyboard and browser evidence support the release claim.                                                                                           |

Fit moves into the workspace increment because a canvas without a permanent object
list needs excellent navigation immediately. Visual export moves before clipboard
because a named diagram that cannot leave the app as an image does not complete
the handoff. Clipboard is valuable once that end-to-end workflow works.

Each row spans small, runnable milestones. Include migrations, documentation and
regressions with the behavior they verify; commit verified milestones separately.
Do not combine this entire table into one implementation branch-sized change.

## Attached-label contract

Write an ADR before changing the portable format. Start with plain text contained
by a rectangle, sharing existing text metrics and native input integration. Own
label content and placement on the shape rather than simulating attachment to an
independent text record. Specify wrapping, padding, overflow and minimum size;
avoid automatic resizing that unexpectedly moves neighboring geometry.

Preserve rectangle/text/connector identities during migration. Label editing is
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

Defer shape catalog expansion, templates, groups, sketch styles, AI, presentation,
cloud dashboards and realtime presence until observed use supports them. Cloud
saving needs its own correctness prototype: authorized durable admission,
idempotent retries, commit-ordered catch-up, local outbox/recovery, conflicts and
two-client conditional undo. Current local transaction preconditions are not that
protocol. A hosted local-only preview is separate from cloud saving; publication
is not part of this request.
