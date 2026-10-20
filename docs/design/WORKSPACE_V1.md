> Historical record: this shell shipped, but its information hierarchy was rejected.
> Superseded by [the canvas-first proposal](../UX_PLAN.md).

# Canvas workspace redesign

20 October 2026. Scope: the existing local editor shell, without changing document
semantics or adding controls for unimplemented features.

## Problems to resolve

- An 82 px header, large wordmark and milestone slogan compete with the board.
- Inspector decoration, repeated instructions and vertically stacked actions bury
  the object list and relevant properties.
- Controls are visually small despite taking substantial space. Styling and
  spacing lack a consistent hierarchy.
- The inspector disappears on small screens, taking properties and object
  navigation with it.
- The shortcut reference lacks explicit dismissal and keyboard focus handling.

## Interaction and visual decisions

A quiet neutral canvas with one green action accent. System typography, readable
labels, visible focus rings, consistent borders and modest shadows replace the
editorial serif copy and decorative footer. Colors and dimensions live in shared
CSS tokens; header, inspector and canvas controls each own their stylesheet.

| Surface              | Decision                                                                                                        | Expected benefit                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Header               | 56 px; small identity mark; editable board name and explicit local save status                                  | More drawing area and clear ownership/save feedback                  |
| File actions         | Import, export and recovery retain their current behavior; accessible icon controls on narrow screens           | File portability stays discoverable                                  |
| Tool dock            | Five real tools and undo/redo; compact centered dock with shortcuts and tooltips                                | Drawing actions stay together                                        |
| Inspector            | Relevant properties, compact selection actions, bounded object navigation, one-row insertion                    | Less scrolling and fewer distractions                                |
| Inspector visibility | Desktop collapse toggle; narrow screens use an overlay with explicit close, Escape and contained keyboard focus | Editing controls remain reachable without consuming the small canvas |
| Empty canvas         | One short task-oriented prompt and a draw action                                                                | Explain the first action without presenting a marketing page         |
| Navigation/help      | Zoom stays in the lower left; contextual instructions and dismissible shortcuts                                 | Persistent controls have stable locations                            |

Opening or closing the inspector must not modify the board, selection or history.
The drawer blocks background interaction while open, and closing restores focus
to its trigger. Numeric drafts and text inputs retain their native shortcuts.
Document shortcuts still work from ordinary inspector buttons. Escape in an input
cancels that input before acting on surrounding UI.

## Implementation ownership

Luna agents implement the header, inspector and canvas controls in separate files.
The primary agent owns layout integration, responsive drawer behavior, product
sequencing, browser validation and incremental commits. A Luna follow-up adds
workspace interaction regressions. No new production dependencies are required.

## Acceptance checks

- All existing draw/connect/style/arrange/undo/import/recovery journeys work.
- Header rename supports Enter to commit and Escape to cancel.
- Closing the inspector expands the desktop canvas and preserves work.
- At 390 px, tools fit and inspector properties remain reachable through the drawer.
- Drawer focus cannot escape into the inactive canvas; closing restores its trigger.
- Help closes via its button, Escape and outside pointer interaction.
- Inspect blank, rectangle, text, connector and multiple-selection layouts at
  desktop and narrow widths, including short viewports and long object names.
- Run `pnpm run ready`; record the result in the milestone log.

This is a responsive shell improvement, not a claim of complete touch/mobile or
screen-reader editing support. The owned canvas still needs broader input and
accessibility testing.

## Verification result

Implemented and verified on 20 October 2026. `pnpm run ready` passes formatting,
lint, types, package boundaries, builds, 96 unit/server tests and 76 Chromium
browser journeys across development and production. Browser regressions cover
rename commit/cancel, inspector visibility, drawer focus, mobile text placement,
help dismissal and Escape ownership when dialogs overlap. Blank, selected shape,
text, connector, multiselection, mobile and short-window layouts were inspected.
Docker, other browser engines and complete touch editing were not verified here.
