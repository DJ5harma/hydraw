# Hydraw milestone log

## Milestone 1 — local editor foundation

Implemented on 20 October 2026:

- Pinned Vite+ / pnpm / Node setup with explicit workspace dependencies and strict TypeScript.
- Owned rectangle document model, validation, hit-testing, gesture lifecycle, local history, camera and Canvas rendering.
- React editor shell, fill controls, object list, keyboard creation/movement, deletion and JSON export.
- IndexedDB save/reload with transaction acknowledgements, recovery warnings and a single-writer tab lock.
- Hono health API, production static serving and navigation fallback.
- Automated unit/server/browser checks, CI and dependency-boundary verification.

This is the first runnable slice of the plan. It does not complete the foundation prototype or the local alpha described in PLAN.md.

## Milestone 2 — resizing, transactions and one container

Implemented on 20 October 2026:

- Eight-handle rectangle resizing with screen-space hit targets, anchored edges, crossing normalization and cancellation.
- Editable X/Y/width/height fields with validation and undo/redo.
- Reversible document transactions that retain changed records, validate preconditions and apply atomically. Unchanged records are shared; history no longer retains whole-board copies.
- Document model, validation, transactions and geometry separated into focused modules. Editor coordination, gestures, history and browser input/rendering separated as well.
- App composition split from board-session/save hooks, toolbar, canvas, controls, inspector and geometry fields.
- Simplified server: a mounted `/api` router followed by static frontend serving and a React fallback.
- Multi-stage Docker packaging: built frontend plus a self-contained Hono bundle, one non-root Node process. No frontend runtime server or production dependency installation.
- Regression coverage for inverse transactions, atomic failure, all resize handles, geometry limits, development/production browser flows and container startup/routing/assets.

## Milestone 3 — reviewed import and previous-board recovery

Implemented on 20 October 2026:

- Version 0 JSON import with file-size and UTF-8 byte limits, document validation, name/object-count review, cancellation and an export-current action.
- One retained previous board, restored through the same review flow. Restoring swaps current and previous boards, allowing another restore to reverse it.
- A framework-independent persistence controller serializes autosaves and replacements. IndexedDB writes primary and recovery records atomically before publishing the new editor document.
- Editor mutation leases prevent edits during replacement. Successful replacement resets selection, camera and undo history; failed storage writes preserve the open board and existing recovery copy.
- Unreadable recovery data does not block a valid current board. Autosaves preserve it, and replacement explicitly warns before overwriting it.
- Unit coverage for queue ordering, replacement failure and lease ownership. Development/production browser coverage for review, invalid files, cancellation, export round trips, recovery across reloads, and aborted or synchronously failed storage writes.

## Milestone 4 — standalone text editing

Implemented on 20 October 2026:

- Version 1 document model with a discriminated shape union, validated text records and explicit migration of version 0 rectangle boards. Transactions compare every text/style field and reject changing shape type under the same identity.
- Text creation through T + click, keyboard placement or the inspector. Inline multiline drafts commit as one transaction on blur or Ctrl/⌘ Enter; Escape cancels. Clearing existing text deletes it through normal history.
- Font size, weight, alignment and ink controls; selection, movement, deletion, undo/redo, save/reload, export, import and recovery share the existing paths.
- Pure word/grapheme wrapping with injected browser font measurement. Width resizing reflows text and derives its height. Imported bounds are recomputed before storage replacement so persisted and displayed text agree.
- Native textarea overlay for editing and Canvas rendering for committed text. Core code remains independent of React and browser APIs; no runtime dependencies added.
- Regression checks for Unicode, wrapping, draft lifecycle, styling, type-safe history, old document migration, pointer resizing, keyboard movement at zoom and import/export round trips. Desktop and narrow mobile editing layouts inspected.

## Milestone 5 — bound connectors

Implemented on 20 October 2026:

- Version 2 adds a separate connector collection with point or shape-bound endpoints, ink color and optional arrowheads. Version 0 and version 1 boards migrate without losing rectangles, text or style.
- Straight arrows derive automatic perimeter attachments from current node bounds, including temporary rectangle move/resize and text editing previews. No coordinate caches or binding rewrites per pointer frame.
- C + drag creates a connection with binding highlights. Screen-space endpoint handles reconnect to nodes or canvas points. Centered free arrows can be added by keyboard or the inspector.
- Connector selection, color/arrowhead controls, reversal, detaching, free-arrow movement, deletion and normal history. Attached arrow bodies remain fixed until detached.
- Node deletion and empty-text completion remove incident edges in one transaction. Undo restores nodes and connectors in their original order. Completed graph validation rejects dangling references, duplicate identities and unsupported self-bindings atomically.
- Save/reload, export, reviewed import and recovery retain connectors. Invalid imported graphs preserve the current board.
- 52 unit/server tests and 42 development/production browser checks passed. Connector domain and interaction logic received focused Luna review; desktop drawing and narrow-screen toolbar layouts were visually inspected. No runtime dependencies added.

## Milestone 6 — multiselection and duplication

Implemented on 20 October 2026:

- Canonical immutable selection identities with a derived single-object identity, keeping geometry, text and connector tools restricted to exactly one selected object.
- Shift-click toggles membership on canvas or in the object list. Marquee selection supports either drag direction and additive Shift + drag; cancellation restores prior membership. Select All has both keyboard and visible controls.
- Group drag previews stay separate from the document; pointer completion or a keyboard nudge applies one transaction. A common constrained delta preserves group spacing at coordinate limits, and connectors resolve against all moved node previews.
- Independent graph duplication through Ctrl/⌘ D or the inspector. Fresh node/edge identities, copied internal connections, remapped bindings and detached external endpoints. One undo removes the entire copy; capacity or identity failures preserve the existing document.
- Mixed selection deletion cascades incident edges once and restores original collection order through one inverse. Selection is pruned when objects disappear and cleared on board replacement.
- Focused selection geometry/gesture helpers and a separate renderer for selection outlines and marquees. Inspector sections now retain their content height and scroll without the footer overlapping object-list entries; the keyboard-reference panel also scrolls in short viewports.
- 65 unit/server tests and 50 development/production browser checks cover graph operations, Shift-click, reverse/additive marquees, group move/cancel, duplicate/undo/redo, text-input shortcut isolation and saved copies after reload. Focused Luna reviews found no remaining operation or interaction defects. No runtime dependencies added.

## Milestone 7 — alignment and center distribution

Implemented on 20 October 2026:

- Six shape alignment modes use selected node bounds: left, horizontal center, right, top, vertical center and bottom. At least two rectangles/text objects are required; selected connectors do not influence targets.
- Horizontal and vertical center distribution keep the two outer centers fixed, order tied centers by document order and preserve collection stacking. At least three shapes are required; sizes and text layout remain unchanged.
- Every action uses one reversible transaction. Bound endpoints follow the moved nodes without rewriting edge records, while unselected nodes and free arrows remain in place.
- Layouts exceeding coordinate limits reject the entire operation with a dismissible error. Insufficient selections and repeated layouts preserve history and redo; numeric comparisons account for cancellation error from large or fractional bounds.
- Focused inspector controls receive values and callbacks, with accessible names, disabled states based on shape count, and explicit center-spacing guidance. Editor commands share the existing replacement lock and gesture cancellation paths.
- 81 unit/server tests and 58 development/production browser checks passed, including all alignment modes, distribution, text/binding preservation, undo/redo, reload and coordinate-error recovery. Desktop and narrower inspector layouts visually checked. No runtime dependencies or schema version changes.

Next: clipboard copy/paste. Keep each slice runnable and verified before expanding.

## Maintenance — code audit and simplification

Completed on 20 October 2026 after milestone 7. See [the audit](CODE_REVIEW.md) for
all eleven findings and their resolution.

- Native export now uses validated compact JSON. The import envelope is 80 MB so
  supported text-heavy boards can reopen their backups; shape, connector and text
  limits are unchanged.
- Shared atomic collection application removes duplicated transaction rules and
  retains untouched arrays. Connector batches use a derived shape index; canvas
  text layouts use a per-renderer weak cache.
- Pure gesture planning is separate from editor coordination. Single-object and
  group drags share translation constraints. Failed completions clear previews,
  and pointer cleanup respects the owning pointer.
- A board-session factory owns startup resources independently of React.
  Initialization failures release storage, cancellation does not publish stale
  sessions, and unavailable canvas support produces an explicit startup error.
- Persistence observation reconciles missed revisions on reconnect and ignores
  obsolete write failures when reporting the current save state.
- Inspector object navigation, color swatches and validated numeric controls have
  focused components. Missing built assets return 404 while frontend navigation
  retains its SPA fallback.
- `pnpm run ready` passed: lint/format, strict types, package boundaries, 95
  unit/server tests, production builds and 62 Chromium browser journeys.
  Desktop/narrow numeric-error layouts were inspected. No dependencies added;
  Docker and other browsers were not rerun.

The next product milestone remains clipboard copy/paste.

## Milestone 8 — canvas workspace usability

Implemented on 20 October 2026 with Luna agents owning the header, inspector and
canvas controls, plus primary-agent layout integration and product sequencing.

- Compact 56 px header keeps board identity, local save feedback and file actions
  visible. Enter commits a rename; Escape cancels it. An inspector toggle expands
  the desktop canvas without changing selection or content.
- Relevant properties and compact selection actions replace decorative inspector
  copy. Bounded object navigation and a short insertion row remain accessible.
- A smaller tool dock, quiet empty state, stable zoom controls and dismissible
  keyboard reference give the canvas a clearer hierarchy. The reference supports
  close, Escape and outside-pointer dismissal with focus restoration. Escape
  belongs to the active dialog rather than an underlying shortcuts reference.
- Below 900 px the inspector opens as a drawer with an explicit close control,
  contained keyboard focus and an inactive background. Closing restores the
  trigger; starting text editing releases the drawer and focuses the native input.
- Text added from insertion controls or the keyboard is centered in the current
  viewport; text-tool clicks retain direct placement. Narrow-screen regression
  checks verify that the initial text box fits inside the canvas.
- Header, inspector and canvas controls own their stylesheets over shared design
  tokens. No production dependencies or document schema changes were added.
- `pnpm run ready` passed formatting/lint, strict types, package boundaries,
  production builds, 96 unit/server tests and 76
  development/production Chromium browser journeys passed. Blank, selected, text
  connector, multiselection, narrow drawer and short-window layouts were visually inspected. Docker and other browsers
  were not rerun.

See [the original UX record](design/WORKSPACE_V1.md) for this milestone's design
decisions. Subsequent feedback rejected the permanent header/sidebar hierarchy;
the replacement proposal below supersedes that direction.

## Design study — canvas-first workspace

Prepared on 20 October 2026 after feedback on milestone 8. Production behavior
is unchanged. Luna critiques informed the interaction hierarchy and product
sequence; the study compares a stable selection shelf with actions anchored near
selected objects. The default sidebar and reserved header disappear in both.

[The proposal](UX_PLAN.md) specifies selection states, responsive placement,
focus/dismissal contracts, component responsibilities and implementation gates.
[The interactive study](design/README.md) records prototype scope and checks.
[The revised release sequence](NEXT.md) puts fit navigation with the workspace,
then attached labels, visual export, clipboard and placement/connector polish.

`pnpm run check` passes formatting, lint, types and dependency boundaries.
Chromium prototype interactions and both alternatives were checked at 320, 390,
736 and 1024 px, including dark appearance. No horizontal overflow or script
errors were observed in those checks. Production unit/browser suites were not
rerun because production code did not change; the milestone 8 results remain
the latest full-suite baseline.

## Milestone 9a — fit navigation foundation

Implemented on 21 October 2026. Editor-level fit navigation frames board or
selection bounds, including resolved connectors, within an adapter-supplied safe
screen rectangle. Camera changes preserve document revision, selection and undo
history. Empty-board fit resets the camera. Overview zoom supports the portable
coordinate range; ordinary zoom remains anchored to the pointer.

`pnpm exec vp test --run packages/editor/src` passes 49 editor tests, including
negative coordinates, offset safe areas, connector bounds, large documents and
history preservation. Editor type checking passes. The following workspace
increment exposes this navigation through its floating controls.

## Milestone 9b — canvas-first workspace

Implemented on 21 October 2026, with Luna agents handling the board menu,
selection controls, canvas controls and browser-journey migration. Primary-agent
integration and an independent Luna review covered interaction and focus rules.

- Completely removed the reserved topbar, right inspector, drawer lifecycle and
  permanent object/insertion list. The canvas fills the window at desktop and
  narrow widths. No production dependencies were added.
- A compact board menu owns rename, import/export and recovery. Local save status
  remains available to assistive technology; save failures stay visible on canvas.
- Five drawing tools remain in one dock. Undo/redo, zoom and fit have stable
  navigation controls. Narrow windows move tools to the bottom.
- Selection actions depend on record type/count. Styling, precision and arrangement
  open on request; unrelated properties stay absent. Contextual controls suspend
  during gestures and text input. Rectangle labels remain a future feature.
- Object navigation opens deliberately, searches and pages at most 100 rendered
  rows while retaining access to every record. Select All applies to the complete
  board. Growing documents do not grow permanent UI.
- One transient surface owns dismissal. Escape preserves native draft cancellation;
  closing restores a meaningful trigger. Outside canvas dismissal consumes the
  pointerdown, and native fields commit before their surface unmounts. Menu closure
  no longer steals focus from a subsequent canvas action.
- `pnpm run ready` passed formatting/lint, strict types, boundaries, builds, 98
  unit/server tests and 80 development/production Chromium journeys. Following the
  final short-window menu constraint, all 20 workspace checks passed across both
  modes, including the new 600 × 280 regression. Desktop, 320 px selection/style
  and help layouts were inspected. Docker, other engines, 200% browser zoom and
  complete real-touch editing were not verified in this increment.

[The UX record](UX_PLAN.md) documents visibility and scaling rules. The next
product increments are attached rectangle labels, SVG/PNG export and clipboard
reuse, in that order; see [NEXT.md](NEXT.md).

## Milestone 10a — rectangle appearance

Implemented on 21 October 2026. Rectangle records now support stroke color,
width, dash style, opacity, corner radius and transparent fill. Native format v3
preserves these properties; v0–v2 migrate without altering their plain rectangles.
Style commands use normal transactions, history and serialization. Rendering
isolates dash/opacity state per object. See [ADR 0008](adr/0008-rectangle-appearance.md).

Focused verification passed four tests covering migration, styling round-trip,
bindings, undo/redo, invalid opacity and existing text migration; editor types pass.

## Milestone 10b — automatic floating properties and visible shortcuts

Implemented on 21 October 2026 after feedback that selecting a shape should expose
its common styling directly. A Luna agent implemented the floating panel and
shortcut hints; primary-agent integration added working rectangle controls.

- Selection immediately shows rectangle, text, connector or multiple-selection
  properties without an extra Fill/Style click. No layout space is reserved and
  no focus is taken from the canvas. Precision geometry stays explicit.
- The panel flips away from selected rectangles near the left edge; narrow screens
  use a short scrollable surface above the tools with a reachable action footer.
  Gestures, text input and board/navigation/help surfaces suspend it.
- V/R/C/T/H hints are visible again. Their removal had reduced discoverability.
- Automatic properties flush native numeric drafts before an outside gesture;
  they do not consume the first canvas click like explicit popovers do.
- Updated affected browser helpers/assertions for the changed interaction contract.
  Validation is intentionally focused: type/lint/boundary checks, four domain tests
  from 10a and one Chromium styling/reload/narrow-layout journey. The full browser
  matrix was not rerun for this change, per the user's request.

## Milestone 11 — shape kinds and attached labels

Implemented on 21 October 2026. Rectangle, ellipse and diamond have direct toolbar
buttons and R/O/D shortcuts, following the user's request to avoid a shape picker.
Shape hit tests and connector perimeter geometry respect each silhouette.

Nodes and connectors own labels in native format v4. Enter/double-click or Add
label opens the native text draft; clearing retains the owner. Shared layout
wraps and clips labels without resizing owners. Movement, resize, duplication,
file round trips and history preserve labels. Versions 0–3 migrate without losing
records; see [ADR 0009](adr/0009-shape-kinds-and-labels.md).

Three focused editor checks pass for label lifecycle/migration and silhouette
geometry, and editor type checking passes. Browser integration is verified with
the following export/clipboard increment.

## Milestone 12 — SVG and PNG handoff

Implemented on 21 October 2026. Board menu exports whole-board or explicit
selection images as SVG or 2× PNG, while editable JSON export remains available.
SVG shares semantic geometry, text wrapping and label clipping with the renderer;
image exports exclude grid, selection and UI. Bound connector endpoints resolve
against the full document even for selection-only export. Background is transparent
except the connector-label backing. System fonts remain a portability limitation.

A pure serializer owns SVG; the browser adapter owns rasterization, bounded PNG
allocation and download URL cleanup. Export errors remain visible and do not
change the board. Three focused serializer checks and editor types pass; browser
SVG/PNG download verification accompanies the next integration check.

## Milestone 13 — connected-selection clipboard and release integration

Implemented on 21 October 2026. Copy/cut/paste uses validated Hydraw selection
fragments with fresh pasted identities. Internal bound edges travel with copied
nodes; external references detach to their resolved points. Paste is centered in
the viewport, bounded by document capacity, and one atomic undo step. Clipboard
fragments are limited to 1 MB. Native text controls and dialogs retain their own
clipboard behavior. Errors leave the document intact and appear visibly.

Final integration keeps native label drafts aligned to their current text layout,
allows connector-caption selection, and uses matching compact caption backings in
Canvas and SVG. Label text wrapping can clip when the owner is too small; it does
not automatically resize shapes. Direct shape tools remain visible at 320 px.

Focused verification: 13 label/shape/export/clipboard checks pass, including large
paste capacity, and formatting/lint/types/boundaries pass. One Chromium journey
covers named ellipse/diamond creation, bound connector labels, native clipboard
handlers, atomic paste undo/redo, JSON/SVG/PNG downloads, native-input clipboard
isolation and the narrow toolbar. Its completed diagram was visually inspected.
The full browser matrix, other engines and OS clipboard permissions were not
rerun. The journey dispatches ClipboardEvents to verify browser event integration.

This completes the first everyday-drawing release from the cross-platform
feature sequence. Smart guides, groups/locking/order, frames and reusable presets
remain subsequent milestones in NEXT.md, not completed features.

## Milestone 14 — placement and object organization

Implemented on 21 October 2026. Native v5 adds flat group identities, locks and
stack ranks with earlier-file migration and reversible domain transactions.
Canvas, hit testing and SVG/PNG export use a shared shape/connector stack.
Groups select/move together; duplicate/paste remaps membership and unlocks copies.
Locks protect direct edits and ordinary canvas selection; the object navigator
provides explicit selection for unlocking. Bound-edge following/deletion retains
its existing graph rules. See ADR 0010 for scope and limitations.

Translation guides snap edges, centers and neighboring gaps within six screen
pixels. Alt bypasses snapping; three screen pixels of movement distinguish a drag
from a click. Guides never enter history or exports. Floating selection properties
contain organization commands and scroll on small screens; shortcut help documents
new commands. Group resize, nested groups and resize/drawing snapping are deferred.

Focused verification covers organization transactions, snapping, clipboard and
editor history/lock/stack integration. One Chromium browser journey covers normal
and Alt drags, grouped movement, front ordering, lock protection, navigator unlock,
mobile command access and reload persistence. Its mobile layout was inspected.
Formatting, lint, workspace types and module-boundary checks pass. The full browser
matrix and performance benchmarks were not rerun.

## Regression follow-up — full test review

Reviewed on 21 October 2026. The full unit run exposed an additive-selection
ordering regression and an outdated duplicate-connector metadata expectation.
Selection publication now preserves existing selection order while appending group
members; the copy expectation includes the new unlocked stack metadata.

The full browser run passed 82 of 88 checks. The six failures represented three
workflows in production and development: the taller properties surface obstructed
selection drags, additive marquees and switching from an arrow to an adjacent node.
Panel avoidance now includes grouped/connector bounds and nearby shapes, and
recalculates after overlay dismissal. All six failed checks pass on focused reruns.
All 128 unit tests and formatting/lint/types/boundary checks pass. Existing tests
cover the fixes; no new test suite was added.

## Unlock discovery follow-up

Superseded by the direct canvas workflow below.

Implemented on 21 October 2026. Objects now has a Locked only filter and a direct
Unlock button on locked rows. Unlock selects the object/group, unlocks it in one
transaction and closes the navigator so editing can resume. The immediate locked
selection hint explains how to find it later. This removes the previous need to
select a locked row, dismiss the navigator and discover Unlock in properties.

The existing focused browser journey now reloads a locked board, filters locked
objects, unlocks a whole group from its row and verifies undo/redo. It passes;
formatting, lint, types and module boundaries pass.

## Milestone 15 — direct canvas unlock, named frames and architecture presets

Implemented on 21 October 2026 with Luna agents handling pure frame/preset modules
and the Insert surface. Locked objects are now directly clickable on the canvas
for Unlock after deselection/reload. They remain protected from movement, resize
and editing. Removed the lock filter and row unlock buttons from Objects.

Native v6 adds named transparent frames. Create from selection, insert an empty
frame or draw with F. Move the title/border to carry wholly enclosed objects; resize
only the boundary. Crossing groups are excluded, locked contents prevent movement,
and frame deletion leaves contents. Frame names participate in native label editing,
copy/paste, duplication, save and export. Frames cannot be bound connector targets.
Objects uses its existing search and pagination for Frames only navigation.

Insert (+) offers three editable grouped architecture flows with fresh identities,
bound connections and atomic history. Preset geometry leaves enough room for its
labels. Insertions fit into view; basic shape tools remain direct. Frame selection
image export includes enclosed contents and the frame name. See ADR 0011.

Verification: all 138 unit checks and lint/types/format/boundary checks pass. Two
focused Chromium journeys verify direct locked-object unlock after reload, grouped
unlock undo/redo, preset insertion, frame naming/movement/history/navigation/SVG
export/persistence, F creation and the 320 px Insert surface. Desktop and mobile
layouts were visually inspected. Full browser matrix and performance benchmarks
were not rerun.

## Milestone 16 — canvas context menus

Completed on 23 October 2026. Objects/selections, locked objects, frames and blank
canvas expose relevant right-click actions with shortcut hints. Targeting preserves
an existing multiselection and never creates a gesture or history entry. Keyboard
Menu / Shift F10, roving arrow/Home/End navigation, Escape/Tab dismissal, viewport
clamping and touch long-press are implemented. More actions provides a visible
entry without requiring a mouse. Native input context menus are preserved. Native copy/cut/paste shortcuts also
close the menu; paste uses the menu target rather than the viewport center.

Removed the long organization block from floating properties; styling, geometry,
quick duplicate/delete and direct Unlock remain. Clipboard menu commands share
native selection serialization and paste rules. Async cut writes first, verifies
the captured document/selection and then deletes atomically; denied writes and
changed selections keep the board intact. Cut includes a frame's copied contents,
while Delete frame retains them. Clipboard access errors stay visible. Pasted
connectors now receive cloned group metadata as well as nodes, preventing copies
from selecting members of the source group. Paste retains its requested world
location when the camera changes during clipboard access.

Focused checks cover context targeting and clipboard failure/stale-selection
safety. Three Chromium journeys cover real right-click selection/lock/group/paste,
keyboard focus, native-input isolation, touch long-press and viewport placement,
as well as existing frames and organization through the new menu. Desktop/mobile
menu layouts were inspected. Full browser matrix was not rerun.

## Milestone 17 — connected shape creation

Selected ordinary shapes expose four connection handles. Dragging a handle to another
shape binds an arrow between them; dropping in empty space creates a matching node
and its bound arrow in one history step, selects the node and opens its label editor.
The Connector (C) tool retains free-point drawing.

Focused Chromium journeys cover handle interaction, label editing, separate label undo
and atomic node-plus-arrow undo, existing-node connections, gesture cancellation and
the C-tool free-point flow.

## Milestone 19 — portable board images

PNG, JPEG and WebP files can be inserted from Insert → Image, pasted while the
canvas is focused, or dropped at a canvas location. The browser normalizes raster
files to embedded PNGs; no image host or backend is required. Multiple files enter
in one atomic history step. Images support movement, resizing, grouping, locks,
clipboard reuse, attached connectors and native/SVG/PNG export. Pending decoding
cannot insert into a replaced board or a disposed workspace.

Native v8 adds image records and migrates older boards. Sources are limited to
12 MB and 40 megapixels, normalized to at most 4096 pixels per side and 4 million
encoded characters per image; each board permits 24 million encoded image
characters. The native file envelope is 160 MB, allowing existing text/label limits
and embedded images to round trip. This is a file limit, not a speed guarantee.
Canvas image resources are released with their renderer. Theme font measurement,
label colors and caption backing now match inline editing and visual export;
changing themes refits text in the same undo step.
