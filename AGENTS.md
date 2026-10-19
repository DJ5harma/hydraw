# Working on Hydraw

- Work in small, complete increments. Commit each cohesive, verified milestone as it lands; do not accumulate unrelated milestones into one final commit.
- Use descriptive Conventional Commit messages. Include related tests and documentation in the same increment, and run checks appropriate to the changes before committing.
- Stage only files belonging to the increment. Preserve unrelated user changes, exclude secrets and generated artifacts, and push only when requested.
- Keep document rules and transactions independent of React, Hono and browser adapters. Separate editor coordination, geometry, gestures, history, rendering and input by responsibility.
- Keep React components focused on presentation and interaction. Board storage and session lifecycles belong in their feature modules.
- Keep server composition simple: backend routes under `/api`, built React everywhere else, packaged together by the Dockerfile.
