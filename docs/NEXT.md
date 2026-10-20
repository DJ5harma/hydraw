# The next useful Hydraw release

Updated 20 October 2026, after the local engine and code cleanup. This refines the
near-term sequence in PLAN.md; its broader product direction and owned-engine
constraints remain in force.

## Release goal

A developer opens Hydraw, draws and names a few components, connects them, cleans
up the layout, reuses a section and exports a diagram into documentation. The board
remains editable and recoverable throughout. This is the first workflow to make
excellent before adding more tools or cloud administration.

The current editor already supports creation, bindings, layout and local recovery.
Three missing capabilities interrupt this workflow: box labels are independent
text objects, selection reuse stops at duplication, and export is native JSON
rather than a diagram people can publish.

## Ordered increments

| Priority | Increment                       | Exit condition                                                                                                                                                                          |
| -------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Now      | Canvas workspace usability      | Compact, coherent shell; inspector remains reachable at narrow widths; existing journeys and responsive/focus regressions pass                                                          |
| 1        | Labels attached to rectangles   | Type a label directly; it moves, resizes, duplicates, saves and undoes with its shape; existing files migrate without losing standalone text or bindings                                |
| 2        | Selection clipboard             | Copy/cut/paste connected selections with fresh identities and one undo step; preserve internal bindings and detach external references safely; native input clipboard remains untouched |
| 3        | SVG, then PNG export            | Whole-board and selection export match current geometry/text; bounds and padding are predictable; exported files can be reopened in ordinary viewers                                    |
| 4        | Navigation and placement polish | Fit board/selection, predictable snapping and alignment feedback improve a real architecture exercise without surprising movement                                                       |
| 5        | Connector clarity               | Connector labels and a deliberately scoped elbow-routing increment, with movement/reflow/undo regressions                                                                               |
| Gate     | Local alpha evaluation          | Fresh users complete the target workflow; measured latency, persistence, keyboard, text input and browser checks support the release claim                                              |

Each row is a direction, not a single oversized commit. Split it into cohesive,
runnable domain/editor/UI increments, include migrations and regressions with the
behavior they verify, and update the milestone log as evidence arrives.

## Next implementation: attached labels

Write an ADR before changing the portable format. Start with plain text contained
by a rectangle, sharing the existing font metrics and native input integration.
Keep label content and placement owned by the shape rather than simulating a
binding to a standalone text object. Define overflow, wrapping, padding and
minimum size explicitly; avoid automatic resizing that changes neighboring
geometry unexpectedly.

Preserve current rectangle/text/connector identities through migration. Label
editing is one undoable action; movement/resizing and graph duplication carry the
label with the rectangle. Empty labels keep their rectangle. Standalone text stays
useful for independent notes. Verify exports, reload, import/recovery, cancellation,
IME composition and coordinate limits before marking the increment complete.

## Clipboard and export boundaries

Build clipboard fragments from the same graph rules as duplication, with explicit
format/version and validation. Handle denied/unavailable clipboard access visibly,
without losing a selection or intercepting clipboard events inside form controls.
Copy has no history entry; cut/paste each apply one atomic transaction. Avoid
silently accepting arbitrary JSON as editor commands.

Use shared semantic geometry and text layout for SVG; derive PNG through a tested
render/export path. Export semantic content, not selection outlines or the canvas
UI. Start without images/fonts/assets that introduce separate packaging concerns.

## Evidence before cloud work

Use a small reproducible architecture exercise with named services, notes and
connections, then representative 100-, 1,000- and limit-sized fixtures. Measure
pointer-to-render latency, text editing, layout, export and memory on stated
hardware; a record-count allowance is not a performance guarantee. Test keyboard
navigation, 200% browser zoom, high DPI, IME input and another browser engine.

Cloud saving follows the local workflow gate. It needs its own protocol prototype:
authorized durable admission, operation IDs and retries, commit-ordered catch-up,
local outbox/recovery, explicit conflicts and two-client conditional undo. The
current local transaction preconditions are not that protocol. Keep Supabase,
auth, dashboards, realtime presence and team sharing out of this UI increment.

A hosted local-only preview can be evaluated separately when useful; publication
is not part of this request. Templates, additional shape families, sketch styles,
AI, and presentation features follow observed needs instead of competing with the
first complete drawing workflow.
