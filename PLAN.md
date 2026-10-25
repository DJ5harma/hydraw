# Hydraw: local product and engineering plan

Updated 26 October 2026. This plan covers the browser-local editor and its
packaged application. See [the milestone log](docs/PROGRESS.md) for implemented
work and [the next-step plan](docs/NEXT.md) for the current focus. The proposed
[cloud and collaboration plan](docs/CLOUD_PLAN.md) extends this local foundation
with accounts, cloud boards, sharing, live editing and an ordered rollout.
First complete the [editor architecture redesign](docs/EDITOR_ARCHITECTURE.md)
and its local two-session acceptance gate before implementing cloud services.

## Product direction

Hydraw is a visual workspace for making architecture diagrams and technical
explanations. Open a board, sketch components, connect and label them, tidy the
layout, then export the same editable work for documentation.

The current product is local-first: board data and the personal library live in
browser storage, and portable `.hydraw.json` files provide explicit backup and
transfer. The editor does not require an account or external service.

### Product principles

- Start directly in a usable canvas.
- Keep pointer gestures responsive and undoable as single actions.
- Reveal controls in context so the canvas stays central.
- Keep board records portable and validate imported data.
- Make local save state and recovery behavior clear.
- Keep the document and editor engine independent of React and browser adapters.

## Current product sequence

Canvas navigation, attached labels, SVG/PNG export, selection clipboard,
placement guides, groups, locks, stacking, frames, presets, elbow routing,
images, crops, freehand ink, board styles and a personal library are implemented.
See [docs/NEXT.md](docs/NEXT.md) for the current solo evaluation and quality work.

The next increment is a lightweight solo pass through the main diagram workflow:
create and name components, connect them, tidy a layout, find offscreen content,
export, and reopen it. Try representative larger boards and record friction or
slow interactions. Improve the largest observed problem, then repeat.

Subsequent work should follow observed needs in local editing: larger-board
responsiveness, keyboard and accessibility quality, text behavior, recovery,
navigation, and export fidelity. Broader tools and visual modes should wait until
the existing diagram workflow feels dependable.

## Runtime and package boundaries

Hydraw uses TypeScript, React, Hono, Vite+ and a pnpm workspace. One Hono process
serves `/api` and the built React application. Docker packages the server and web
build into a non-root Node runtime image.

| Package                 | Responsibility                                                      |
| ----------------------- | ------------------------------------------------------------------- |
| `@hydraw/document`      | Portable records, validation, geometry and reversible transactions  |
| `@hydraw/editor`        | Local editor state, gestures, hit testing, history and camera       |
| `@hydraw/editor/canvas` | Browser Canvas rendering and pointer input                          |
| `@hydraw/web`           | React controls, browser persistence, file transfer and workspace UI |
| `@hydraw/server`        | Hono API, static assets and application navigation fallback         |

Keep document rules and transactions independent of React, Hono and browser
adapters. Keep editor coordination, geometry, gestures, history, rendering and
input separated by responsibility. Board storage and session lifecycles belong
in their feature modules. Add a package only when it owns real behavior and has
a useful boundary.

## Document and local storage

The `.hydraw.json` format is version 1 and stores semantic records, including
embedded images. The current decoder rejects unsupported formats; no pre-release
migration is provided. See [docs/FORMAT.md](docs/FORMAT.md).

IndexedDB stores the current board and one previous-board recovery copy. A
browser writer lock prevents another tab from overwriting the active local board.
When storage is unavailable or data cannot be decoded, preserve existing records
and offer in-memory editing and export. Browser storage can be cleared or evicted,
so users should export important work.

Undo history is session-local and retains up to 100 transactions of changed
records. It resets after reload, import or restore. These transactions provide
local stale-state checks.

## Deferred editor work

Nested frames, group resizing and rotation, rich text, custom fonts, camera
scrolling during long text edits, custom connector ports, self-loops, and equal
edge-gap distribution remain future possibilities. Prioritize them only when
actual use demonstrates a need.

Desktop Chromium is the verified browser target. Other browser engines,
pen/touch behavior, screen-reader usage and broad mobile editing need further
evaluation before making compatibility claims.

## Development checks

Use the pinned Node and pnpm versions in the repository. `pnpm run ready` runs
format and lint checks, TypeScript, package-boundary checks, unit/server tests,
production builds and Chromium browser journeys. `pnpm run test:docker` verifies
the packaged runtime. Keep focused regressions and related documentation with
each cohesive change.
