# Repository Guidelines

- Keep changes within the current scaffold unless the task explicitly expands scope: NS8 module runtime under `imageroot/`, embedded admin UI under `ui/`, the wrapper images under `containers/`, and basic CI and test scaffolding.
- Prefer the smallest coherent change and keep related docs, tests, and build files in sync. Do as much as is needed, as little as possible.
- Put long reference material in normal docs, not in AGENTS. Use `README.md` for current status and operator-facing behavior, `STRUCTURE.md` for file maps, and `NS8-MODULE.md` for NS8 lifecycle details.
- Only `imageroot/` and `ui/` currently justify local AGENTS files. Do not add more unless a subtree gains genuinely different conventions.
- When asked to commit, use the `commit` skill
- When asked to bump or pin the upstream Hermes base image tag or digest, use the `update-hermes-image` skill
- before non-trivial code changes, invoke the `researcher` agent to search the relevant `*_RESOURCE_MAP.md` files, browse the authoritative docs, and gather similar code patterns or prior art.
- After code changes that may affect documentation, invoke the `docs-maintainer` custom agent to review checked-in Markdown files. Keep `README.md` current for humans, and keep `AGENTS.md` files plus `STRUCTURE.md` current for agents and implementation accuracy.
