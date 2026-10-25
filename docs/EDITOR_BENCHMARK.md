# Editor architecture verification

Recorded 26 October 2026 after the local architecture refactor.

## Functional checks

`pnpm run ready` passes formatting, lint, strict TypeScript, dependency boundaries,
233 unit/server tests, production builds and 157 Chromium browser journeys.
Five browser cases intentionally run only against development source modules:
four repository API scenarios and the existing library race scenario. Their
production project entries are skipped; ordinary UI journeys run in both builds.
`pnpm run test:docker` also passes against the final code: packaged API, React deep
links, built assets and non-root runtime.

Core two-session tests run without React, Hono, DOM or external services. They
cover concurrent proposals, stale conflicts, board identity, replacement epochs,
dependent out-of-order delivery/catch-up, duplicates, personal history, group
membership and connector/deletion races. Editor tests verify interaction
reconciliation and geometry preservation across different text measurement adapters.
Storage browser tests cover independent board leases, asset deduplication,
atomic rollback, recovery retention, collection, missing pixels and checksum damage.

## Reproducible editor measurements

Run `node tooling/benchmark-editor.mjs` with the pinned Node 24 runtime. To compare
against another checkout with its workspace dependencies linked, supply its path:
`node tooling/benchmark-editor.mjs /path/to/baseline`.

This comparison uses pre-refactor commit `9fbd8b2`, extracted into a temporary
directory with its `@hydraw/document` dependency linked to its own document package.
The final run was performed without concurrent builds or browser tests. Hardware:
13th Gen Intel Core i7-13620H, Linux x64, Node v24.22.0.

Fixtures contain the listed shape count and one fewer bound connector. Mixed
fixtures use 10% images and 10% ink strokes with 20 points each. Images share a
small PNG, so this measures record/graph work rather than large-image decoding.
Five warmups precede each measurement; p95 uses 30 samples for preview/single
commits and 10 for whole-selection commits. These small sample sizes make results
advisory, not CI thresholds or a general device/browser speed claim.

| Shapes / connectors | Fixture      | Preview p95, before → after (ms) | Single commit p95, before → after (ms) | Whole-selection commit p95, before → after (ms) |
| ------------------- | ------------ | -------------------------------- | -------------------------------------- | ----------------------------------------------- |
| 100 / 99            | Rectangles   | 0.08 → 0.08                      | 0.23 → 0.26                            | 1.43 → 1.26                                     |
| 100 / 99            | Images + ink | 0.03 → 0.06                      | 0.36 → 0.27                            | 1.77 → 1.92                                     |
| 1,000 / 999         | Rectangles   | 0.58 → 0.37                      | 0.94 → 1.15                            | 64.12 → 9.14                                    |
| 1,000 / 999         | Images + ink | 0.22 → 0.24                      | 0.83 → 1.24                            | 60.44 → 11.52                                   |
| 5,000 / 4,999       | Rectangles   | 1.34 → 1.29                      | 6.53 → 5.97                            | 1,359.08 → 46.69                                |
| 5,000 / 4,999       | Images + ink | 1.37 → 1.21                      | 6.26 → 6.05                            | 1,343.68 → 38.92                                |

The main improvement removes repeated shape searches from frame-selection expansion.
ID resolution also uses indexed positions for ordinary updates, and local commits
validate their candidate once rather than reapplying it through the external path.
The refactor adds version/dependency and inverse-operation work; small single-edit
costs are consequently not uniformly faster. Whole-selection commits at the limit
still exceed a frame budget, while gesture previews avoid committing on every move.

Timings exclude DOM, Canvas drawing, snapping, persistence, media decoding and
networking. Full browser rendering/interaction profiling, cross-browser fidelity
and human evaluation of same-record conflict UX remain separate product checks.
