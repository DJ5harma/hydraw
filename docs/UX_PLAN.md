# Canvas-first Hydraw

20 October 2026. **Design proposal, not implemented production UI.** Supersedes
[the first workspace pass](design/WORKSPACE_V1.md). The production baseline remains
`c1b927a`: a 56 px header and a 280 px inspector, open by default on desktop.
The [interactive concept](design/canvas-concepts.html) explores the replacement.

## The problem is hierarchy

The last pass improved spacing while preserving the wrong structure. A permanent
properties/object sidebar asks everyone to look at controls for occasional tasks.
Numeric geometry, object inventory, destructive board actions and repeated help
receive space even when the user is simply drawing. The header similarly makes
file administration compete with the tools. Collapsing these regions leaves users
responsible for managing the interface before managing their diagram.

At 1440 × 900, the current reserved header/sidebar leave about 75.5% of the window
for the canvas; at 1024 × 768, about 67.4%. These are illustrative calculations from
the CSS dimensions, not usability measurements. Floating controls still cover
pixels: the objective is useful, unobstructed work, not a misleading 100% claim.

## Recommended direction: quiet canvas

The canvas fills the viewport. Remove the layout header, default inspector,
permanent object inventory and persistent instruction strip. Preserve a small
visible vocabulary; hiding every action in a command palette would create a
new discovery problem.

| Surface                       | Behavior                                                                                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Board chip, upper left        | Menu, board name, truthful local persistence indicator. Rename, import, editable-file export, recovery and board actions live inside the menu. Save errors remain visible until resolved. |
| Tool dock, upper center       | Select, rectangle, connector, text, pan. One active tool; shortcuts appear in tooltips/help. No slots for future tools.                                                                   |
| View/history, lower left      | Zoom, fit board/selection, undo and redo. Disabled history controls retain their positions.                                                                                               |
| Selection shelf, lower center | Only actions applicable to the selected records. Absent when nothing is selected. Stable location, content sized to the task.                                                             |
| Help, lower right             | Discoverable shortcuts and input guidance, opened deliberately.                                                                                                                           |
| On-demand surfaces            | Objects, precise geometry, arrangement and detailed styling. One active surface at a time; opening another replaces it.                                                                   |

The alternative **Direct editing** moves the tool dock down and anchors selection
actions near the object. It reduces pointer travel but introduces collision and
movement risks. Compare it with the stable shelf in the concept; prefer the stable
shelf until real task trials demonstrate a benefit from anchoring.

Excalidraw's documented [main menu](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/children-components/main-menu)
groups occasional commands, its [welcome screen](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/children-components/welcome-screen)
disappears after drawing begins, and its [sidebar](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/children-components/sidebar)
supports dismissal and conditional docking. These support progressive disclosure;
they do not imply that Excalidraw has no sidebar. This proposal uses our own editor
and adapts the principle to Hydraw's much smaller tool set.

## Show the task, not the entire schema

| State                     | Visible contextual actions                                                              |
| ------------------------- | --------------------------------------------------------------------------------------- |
| Empty board               | One brief draw prompt; disappears after the first object.                               |
| Unselected diagram        | No property surface. Tools, board and navigation remain.                                |
| Rectangle selected        | Fill, edit label when implemented, duplicate, delete, more properties.                  |
| Text selected             | Text style, edit, duplicate, delete; no rectangle geometry form by default.             |
| Connector selected        | Stroke/arrowhead controls and delete; no unrelated fill controls.                       |
| Multiple records          | Arrange, duplicate, delete; shared styles only when semantically valid.                 |
| Dragging/resizing/panning | Suspend contextual overlays that obstruct the gesture. Retain stable tool/view anchors. |
| Editing text              | Native text editor owns typing, composition and clipboard; suspend selection actions.   |

Choosing a drawing tool can expose a compact default style control when supported;
it must not show a generic inspector with fields unrelated to that tool. Selection
changes must not silently discard a pending numeric draft. Commit or cancel using
explicit input rules and expose validation errors beside their fields.

## Placement and accessibility contracts

At narrow widths, move tools to the bottom within reach and put selection actions
in one compact row above them. Board controls remain above; navigation/history
move away from the tool stack. Precise properties use an explicitly opened sheet.
Do not automatically open a drawer whenever an object is selected. Include safe
area insets and test landscape/short windows rather than relying on one breakpoint.

Overlays must avoid resize handles, text input and the active gesture. Popovers
flip or clamp to the available rectangle; anchored controls reposition after the
gesture ends rather than following every pointer movement. Long board names
truncate with an accessible full name. No horizontal scrolling to reach tools.

All icon actions need accessible names, visible focus and hover/focus shortcut
hints. Object navigation remains available through the menu and a documented
shortcut, with a searchable list when scale justifies search. It is essential for
finding offscreen items and keyboard access; it does not need permanent space.

Escape belongs to the innermost active interaction: native edit/gesture, then the
topmost transient surface, then selection. Restore focus to the opening control;
if it disappeared, use the next meaningful stable control. Distinguish nonmodal
popovers from blocking dialogs; only blocking dialogs trap focus. Outside dismissal
must not also initiate a canvas edit. Respect IME composition and native input
shortcuts. Never interpret an input's Delete as deleting its selected shape.

## Implementation in complete increments

1. Replace the layout shell with `CanvasWorkspace`, `BoardMenu` and `ToolDock`.
   Preserve import, recovery, local save feedback and keyboard shortcuts. Add fit
   board/selection through editor viewport geometry, independent of React.
2. Replace `BoardInspector` with capability-driven `SelectionActions`, focused
   styling/arrangement/precision surfaces and an on-demand `ObjectNavigator`.
   A small `OverlayHost` owns the active surface, dismissal, placement and focus.
   Avoid a generic plugin framework or a component that owns board storage.
3. Complete narrow-window behavior and text/gesture integration. Remove obsolete
   inspector state/styles and migrate browser journeys to the new visible paths.

Keep board/session lifecycles in feature modules. Derive action availability from
typed selection data, not duplicated React document state. Geometry, transactions,
history and rendering stay in their existing owned packages. Commit each runnable
increment with its relevant regressions. Reuse existing dependencies and icon
vocabulary; this is an interaction redesign, not a framework replacement.

## Evidence required before calling it better

Verify blank, rectangle, text, connector, mixed selection, editing, dragging and
save failure at desktop, 320/390 px, short landscape and 200% browser zoom. Exercise
keyboard-only flows, focus restoration, outside dismissal, native clipboard and
IME; include another browser engine and real touch before broad mobile claims.
Existing drawing, file, recovery and undo journeys must continue to pass.

Ask fresh users to create and name components, connect them, align a selection,
find an offscreen object, export and reopen. Observe assistance, misclicks,
overlay collisions and task completion. Compare both selection placements on the
same task. A cleaner screenshot is useful evidence of hierarchy, not proof of
world-class usability.

The concept simulates interactions rather than using the production engine.
Attached labels and fit navigation illustrate planned capabilities. Its simple
geometry, selection adornments and local history do not establish production
correctness. See [prototype notes](design/README.md) for review and verification.
