# Code audit and cleanup

## Simplification audit — 26 October 2026

Baseline: `2dfd2a2`. Reviewed document rules, editor/session/history, rendering and
input, React interactions, board/library persistence, server composition and tooling.
The earlier audit below is historical; passing its checks did not establish that
the later architecture refactor was as simple as it could be.

| Finding                                                                    | Action / status                                                                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Editor and document session duplicate replacement flags and lease wrappers | Removed the editor flag/wrapper; the session owns the lock, including gesture entry checks                                |
| Persistence adds a flag to suppress its own already-persisted replacements | Use explicit commit origin and the existing replacement lifecycle; consume commit payloads directly                       |
| Array-index transactions and ID operations represent the same edits twice  | Removed both conversion directions; commands, validation, inverse generation and history use one ID-addressed edit format |
| Selection/group/lock checks are repeated across core and controls          | Shared object/group/lock queries now serve controls and input paths; arrangement eligibility lives in the document rules  |

Removed an unused connector-only hit-test path and the duplicate clipboard object-ID helper. The global scene hit test remains the single hit-order implementation.

Further cleanup removed duplicate segment-distance implementations, download and
filename setup, the pass-through `boardTheme()` helper, the editor's duplicate
replacement epoch, an unnecessary image-import liveness flag, a duplicated clipboard
limit and a UUID fallback inconsistent with the editor's existing platform contract.
The obsolete development-namespace browser journey was removed. Storage now retains
one recovery asset-root state instead of a raw manifest, a boolean and repeated
revalidation of the same root.
Frame appearance, naming and stacking defaults now live in one document factory
used by drag creation, command creation and framing a selection. A browser image
test now waits for replacement completion before releasing its decoder gate,
removing a timing-dependent assertion.

The server remains one small Hono composition. Renderer and SVG output share
semantic geometry while keeping their distinct output code. Native input/focus
coordination and IndexedDB transaction handling have concrete lifecycle duties;
they were reviewed without introducing a general command, state or database framework.

Checks accompany each cohesive increment. Preserve atomic graph validation,
recoverable drafts, native input behavior and durable storage acknowledgements.
Judge simplification by fewer concepts and duplicate rules, not file length alone.

Result: 236 fewer production TypeScript lines against `2dfd2a2` (431 added,
667 removed), with no new dependencies. The main reduction is the removal of
duplicate edit languages and state ownership, rather than moving code into more
files. `Editor` remains the largest coordinator: its text drafts, commands and
gesture completion still represent real behavior. Further changes there should
be driven by a specific responsibility or repeated rule.

Final verification: `pnpm run ready` passes formatting/lint, types, boundaries,
237 unit/server tests, production builds and 155 Chromium journeys. Five
development-source scenarios are intentionally skipped in production. Docker
smoke also passes. Existing PNG pixel checks caught a background-default regression
during cleanup; the final implementation preserves clean download transparency and
explicit clipboard backgrounds. [Editor measurements](EDITOR_BENCHMARK.md) record
the before/after comparison and its limits.

## Earlier audit — 20 October 2026

Review baseline: `5fb53bc` (20 October 2026). Scope: document rules and transactions,
editor coordination/gestures/rendering, React controls, local persistence, server
routing and workspace tooling. Findings below distinguish defects from structural
cleanup; missing product features are not code defects.

| Finding                                                                                             | Consequence                                                                 | Status                                                                                   |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Export has no byte limit while import caps files at 2 MB                                            | Valid local boards can produce backups that cannot be reopened              | Fixed: compact native serialization and a 200 MB envelope covering all supported records |
| Shape/connector transaction application repeats the same algorithm and copies both collections      | Duplicated invariants and unnecessary allocations on unrelated edits        | Fixed: shared application rules, indexed identities and untouched collection sharing     |
| Editor coordination contains pointer hit testing and gesture construction                           | Tool interactions are difficult to review independently of commands/history | Fixed: pure gesture planning is separate from editor commands/history                    |
| Single-object and selection movement use different coordinate constraints                           | Single-object drags can jump or stop early near the coordinate boundary     | Fixed: one translation path for all movable selections                                   |
| Failed gesture completion can leave previews and pointer capture active                             | A rejected edit can leave interaction state stuck                           | Fixed: completion and pointer cleanup use finally; cancellation checks pointer ownership |
| Connector resolution repeatedly searches shape arrays inside scene loops                            | Rendering and hit testing scale with shapes multiplied by connectors        | Fixed: indexed batch resolution for rendering, hit testing, selection and duplication    |
| Canvas rendering recomputes unchanged text layout on each repaint                                   | Panning and selection changes repeat font measurements                      | Fixed: per-canvas weak cache for immutable text records                                  |
| Session initialization couples resource acquisition and React state publication                     | Editor initialization failures can retain the writer lock and database      | Fixed: resource-owning session factory, cancellation cleanup and explicit startup errors |
| Persistence only observes future subscription events                                                | Changes made while disconnected can miss autosave after reconnect           | Fixed: reconnect reconciles revisions; obsolete saves cannot replace current status      |
| Inspector combines object navigation, styling and selection actions; palettes/numeric drafts repeat | UI responsibilities and validation behavior can drift                       | Fixed: object navigation, numeric drafts and typed palettes have focused components      |
| Missing built assets fall through to the HTML navigation fallback                                   | Stale script/style URLs report success with the wrong content type          | Fixed: missing assets return 404; dotted frontend routes still receive the SPA           |

Keep the existing package direction, atomic replacement queue, mutation lease,
strict current-format validation, native text input and gesture-scoped history. These mechanisms
have concrete correctness responsibilities and should not be removed as cosmetic
"simplification". Do not introduce a general state framework or plugin system during
this cleanup.

Verification completed on 20 October 2026:

- `pnpm run ready` passed formatting/lint, strict types, package boundaries, 95
  unit/server tests, production builds and 62 development/production Chromium
  browser journeys.
- Focused regressions cover large export round trips, worst-case JSON size,
  transaction identity changes and collection sharing, boundary movement, failed
  gestures, pointer ownership, indexed connector geometry, text layout caching,
  session cancellation/failure, persistence reconnects and missing asset routes.
- Numeric-input error layouts were visually checked at 1440×900 and 900×700.
- No new dependencies were added. Docker and other browsers were not rerun.

This closes the findings in this review; it does not establish that every possible
bug has been eliminated. Large-board latency/memory measurements, broader input
and accessibility QA, and the product roadmap remain separate work. The current
200 MB file envelope accommodates the supported record limits; it is not a
performance claim for maximum-size documents.
