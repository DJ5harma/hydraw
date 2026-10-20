# Code audit and cleanup

Review baseline: `5fb53bc` (20 October 2026). Scope: document rules and transactions,
editor coordination/gestures/rendering, React controls, local persistence, server
routing and workspace tooling. Findings below distinguish defects from structural
cleanup; missing product features are not code defects.

| Finding                                                                                             | Consequence                                                                 | Status                                                                                   |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Export has no byte limit while import caps files at 2 MB                                            | Valid local boards can produce backups that cannot be reopened              | Fixed: compact native serialization and an 80 MB envelope covering all supported records |
| Shape/connector transaction application repeats the same algorithm and copies both collections      | Duplicated invariants and unnecessary allocations on unrelated edits        | Fixed: shared application rules, indexed identities and untouched collection sharing     |
| Editor coordination contains pointer hit testing and gesture construction                           | Tool interactions are difficult to review independently of commands/history | Fixed: pure gesture planning is separate from editor commands/history                    |
| Single-object and selection movement use different coordinate constraints                           | Single-object drags can jump or stop early near the coordinate boundary     | Fixed: one translation path for all movable selections                                   |
| Failed gesture completion can leave previews and pointer capture active                             | A rejected edit can leave interaction state stuck                           | Fixed: completion and pointer cleanup use finally; cancellation checks pointer ownership |
| Connector resolution repeatedly searches shape arrays inside scene loops                            | Rendering and hit testing scale with shapes multiplied by connectors        | Fixed: indexed batch resolution for rendering, hit testing, selection and duplication    |
| Canvas rendering recomputes unchanged text layout on each repaint                                   | Panning and selection changes repeat font measurements                      | Fixed: per-canvas weak cache for immutable text records                                  |
| Session initialization couples resource acquisition and React state publication                     | Editor initialization failures can retain the writer lock and database      | Open                                                                                     |
| Persistence only observes future subscription events                                                | Changes made while disconnected can miss autosave after reconnect           | Open                                                                                     |
| Inspector combines object navigation, styling and selection actions; palettes/numeric drafts repeat | UI responsibilities and validation behavior can drift                       | Open                                                                                     |
| Missing built assets fall through to the HTML navigation fallback                                   | Stale script/style URLs report success with the wrong content type          | Open                                                                                     |

Keep the existing package direction, atomic replacement queue, mutation lease,
version migrations, native text input and gesture-scoped history. These mechanisms
have concrete correctness responsibilities and should not be removed as cosmetic
"simplification". Do not introduce a general state framework, plugin system or
speculative cloud abstractions during this cleanup.

Validation: focused regressions with each correctness change, existing browser
journeys for interaction refactors, then the complete `pnpm run ready` suite.
Docker verification is separate and should be reported explicitly if not run.
