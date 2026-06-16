# Repository Guidelines

This repository is an NS8 module for Hermes Agent. Follow local checked-in behavior first, official NS8 documentation second, maintained NS8 modules and `ns8-kickstart` patterns third, and clearly mark any remaining assumptions.

- Keep the NS8 model intact: rootless module payload under `imageroot/`, long-running containers managed by user systemd units, administrator UI under `ui/`, wrapper images under `containers/`, and tests under `tests/`. Do not add a separate orchestrator, daemon supervisor, or custom admin backend unless the task explicitly requires it.
- Keep changes within the current scaffold unless the task explicitly expands scope: NS8 module runtime under `imageroot/`, embedded admin UI under `ui/`, the wrapper images under `containers/`, and basic CI and test scaffolding.
- Prefer the smallest coherent change and keep related docs, tests, and build files in sync. Do as much as is needed, as little as possible.
- Put long reference material in normal docs, not in AGENTS. Use `README.md` for current status and operator-facing behavior, `STRUCTURE.md` for file maps, and `NS8-MODULE.md` for NS8 lifecycle details.
- Only `imageroot/` and `ui/` currently justify local AGENTS files. Do not add more unless a subtree gains genuinely different conventions.
- For module actions, preserve NS8 conventions: stdin JSON, machine-readable stdout, diagnostics on stderr, schemas beside public actions, idempotent configure/destroy/restore flows, and early validation failures that report `validation-failed`.
- Keep secrets out of `environment`, stdout, stderr, and logs. This module intentionally uses documented `secrets/shared.env` plus per-agent `secrets/<id>.env` files instead of one generic `secrets.env` because Hermes agents need isolated runtime secrets.
- Prefer Traefik routes over direct public ports. This module currently publishes one shared auth route and reserves one loopback `TCP_PORT`; do not add `node:fwadm`, provider `srv` keys, or direct public TCP/UDP exposure unless the implementation changes.
- When asked to commit, use the `commit` skill.
- When asked to bump or pin the upstream Hermes base image tag or digest, use the `update-hermes-image` skill.
- Before non-trivial code or documentation changes, invoke the `researcher` agent to search the relevant `*_RESOURCE_MAP.md` files, browse authoritative docs or upstream guideline files, and gather similar code patterns or prior art.
- After code or documentation changes that may affect checked-in Markdown, invoke the `docs-maintainer` custom agent to review Markdown alignment. Keep `README.md` current for humans, `AGENTS.md` files concise for agents, `STRUCTURE.md` accurate to the tree, and `NS8-MODULE.md` accurate to lifecycle behavior.
