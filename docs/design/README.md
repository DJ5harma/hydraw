# Workspace design studies

`canvas-concepts.html` is the interactive source for the canvas-first proposal.
Production React components have not been replaced by this study. See
[the interaction specification](../UX_PLAN.md) and [the release sequence](../NEXT.md).
`WORKSPACE_V1.md` preserves the previous implemented shell's design/verification.

Compare **Quiet canvas** (stable selection shelf, recommended) and **Direct
editing** (actions near the selection). Select and move shapes, Shift-select,
change fill, open precise properties, edit a label, connect objects, undo, and open
the board menu/object navigator. Design controls expose diagram states and a
phone-sized view. The two alternatives deliberately share the same action model.

The study has an independent, simplified interaction simulation. Attached rectangle
labels and fit navigation are proposed features. Handles are selection adornments,
not a resize implementation. It does not exercise production document rules,
storage, browser text measurement or history. Its editable-file export represents
labels as standalone text to use the existing v2 format; that is not the proposed
attached-label model. No production-ready fidelity is implied.

The source is an HTML fragment for the conversation preview runtime (Lucide,
variant carousel and optional Tweak controls). To inspect outside the conversation,
wrap it using the installed visualization skill's `scripts/render.py`; do not open
the fragment alone and expect the preview runtime. Keep generated wrappers and
screenshots out of the repository.

Review checks on 20 October 2026: Chromium loaded without script errors; selection,
fill, precise geometry, multiselection/arrangement, inline rename and object
navigation were exercised. Desktop and narrow layouts and both alternatives were
inspected. These prototype checks do not replace the production acceptance gates.
