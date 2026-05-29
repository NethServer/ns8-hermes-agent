---
name: update-hermes-image
description: 'Update, bump, pin, or refresh the upstream Hermes base image tag or digest used by the wrapper container. Use when changing docker.io/nousresearch/hermes-agent in containers/hermes/Containerfile and keeping the related test and docs in sync.'
argument-hint: 'Provide the new Hermes tag or digest, or say to look up the latest upstream release or image digest first.'
user-invocable: true
---

# Update Hermes Image

Use this skill when the task is to change the upstream Hermes base image reference used by the wrapper container.

## Required files

Always update these files together:

- `containers/hermes/Containerfile`
- `tests/test_runtime_validation.py`
- `README.md`
- `NS8-MODULE.md`
- `STRUCTURE.md`

## Compatibility checks

After choosing the new image, inspect these files for assumptions that may need follow-up edits if the upstream image layout changed:

- `containers/hermes/entrypoint.sh`
- `imageroot/bin/ensure-agent-home-ownership`

Confirm that the upstream image still provides:

- the `hermes` user
- `/opt/hermes`
- `/opt/data`
- the virtual environment at `/opt/hermes/.venv`
- bundled dashboard assets consumed by the wrapper

## Procedure

1. Confirm the target tag or digest with the user. If none is provided, use `HERMES_RESOURCE_MAP.md` for source links and verify the current upstream release or image digest from the authoritative upstream release page or registry before editing.
2. Update the `FROM docker.io/nousresearch/hermes-agent...` line in `containers/hermes/Containerfile`.
3. Update the exact-string assertion in `tests/test_runtime_validation.py`.
4. Update the matching upstream-image reference in `README.md`, `NS8-MODULE.md`, and `STRUCTURE.md`.
5. Search the repo for `docker.io/nousresearch/hermes-agent` and replace any remaining stale references that describe the wrapper base image.
6. Inspect `containers/hermes/entrypoint.sh` and `imageroot/bin/ensure-agent-home-ownership` for upstream layout or user or permission assumptions. Only edit them if the new upstream image requires it.
7. Run the narrow validation command: `pytest tests/test_runtime_validation.py -k hermes_containerfile_uses_expected_base_image`
8. If the bump changes runtime assumptions, run broader validation that matches the touched surface.

## Constraints

- Prefer digest pinning when the user asks for it or when a temporary freeze or workaround is needed.
- Keep the change minimal. Do not refactor unrelated container or module logic as part of the bump.
- Keep docs aligned with the checked-in `Containerfile`.

## Output Expectations

After completing the bump, report:

- the new upstream tag or digest
- whether the change was tag-based or digest-based
- which files were updated
- what validation ran
- any follow-up compatibility risk that still needs manual testing