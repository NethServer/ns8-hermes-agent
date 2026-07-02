# NS8 Module Notes

This document summarizes the current checked-in NS8 behavior for `ns8-hermes-agent`.

## Overview

`ns8-hermes-agent` is now a simple per-agent Hermes NS8 module with one Podman pod for each configured agent.

- No OpenViking runtime
- No hidden system agent
- No shared backend API service
- No standalone dashboard sidecar runtime; the per-agent Hermes container runs dashboard and gateway together
- One configured agent equals one primary `hermes@<id>.service`, one per-agent pod owner unit, one pod, and one Hermes container, plus the shared auth service and container when publishing is active

The implementation keeps the module lifecycle explicit:

- `create-module`: initialize module state only
- `configure-module`: validate agent input, persist shared dashboard settings plus one metadata file per agent, bind the selected user domain, seed first-time agent home content, and reconcile routes and services
- `get-configuration`: report the shared dashboard host, shared `user_domain`, shared `lets_encrypt` flag, and configured agents, preserving desired status only
- `get-agent-runtime`: report live per-agent runtime state derived from systemd
- `destroy-module`: stop services, remove managed routes, and remove generated state

## NS8 guideline alignment

The checked-in behavior follows the normal NS8 module model: rootless module payload in `imageroot/`, administrator UI in `ui/`, long-running services managed by user systemd units, public HTTP through Traefik, and lifecycle automation in numbered action steps.

Action steps keep the NS8 contract: stdin JSON, machine-readable stdout for public read actions, diagnostics on stderr, JSON schemas beside public actions, idempotent configure/destroy/restore behavior, and early validation failures that report `validation-failed`.

Important module-specific exceptions:

- Hermes runtime isolation uses `secrets/shared.env` plus `secrets/<id>.env` files instead of one generic `secrets.env`.
- The module is not a service provider and does not publish `srv` Redis keys.
- The module exposes no direct public TCP/UDP firewall service; Traefik forwards to one loopback auth listener reserved by `TCP_PORT`.
- No user-domain change event handler is currently shipped. Changes to LDAP relation details are reconciled by running `configure-module` again.
- No Redis dump/restore action is needed because the canonical restored state is in files and the shared Podman volume.

## Podman compatibility

The current runtime layout requires Podman volume `subpath` support.

It is used both when seeding a new agent home and when mounting the per-agent subdirectory from the shared `hermes-agents-home` volume into the live `hermes@<id>` service. Older Podman releases that do not support `subpath` are therefore unsupported by design.

Known example: Debian 12's stock Podman 4.3.x is too old and fails with `subpath: invalid mount option` during agent creation.

## Images

The module publishes:

- `ghcr.io/nethserver/hermes-agent`: the NS8 module image
- `ghcr.io/nethserver/hermes-agent-auth`: the shared dashboard auth proxy image
- `ghcr.io/nethserver/hermes-agent-hermes`: the Hermes wrapper image built from `docker.io/nousresearch/hermes-agent:v2026.7.1` (`Hermes Agent v0.18.0`) with the optional Edge TTS and Feishu/Lark runtime dependencies baked in
- `ghcr.io/nethserver/hermes-agent-socket`: the per-agent dashboard socket relay image

`build-images.sh` builds all four images.

The module image reserves one TCP port and declares `cluster:accountconsumer traefik@node:routeadm node:portsadm` authorizations so it can bind one NS8 user domain, publish one shared auth route, and receive a loopback listener port. It intentionally does not request `node:fwadm` because no direct public firewall service is exposed.

## Input model

`configure-module` accepts:

```json
{
  "base_virtualhost": "agents.example.org",
  "user_domain": "example.org",
  "lets_encrypt": true,
  "agents": [
    {
      "id": 1,
      "name": "Foo Bar",
      "role": "developer",
      "status": "start",
      "allowed_user": "alice"
    }
  ]
}
```

Rules:

- `base_virtualhost` is optional and must be a valid FQDN when present
- `user_domain` is optional while dashboard publishing is disabled; when `base_virtualhost` is set and at least one agent exists it becomes required and must resolve through `agent.ldapproxy`
- `lets_encrypt` is optional and must be boolean when present
- `id` must be an integer between `1` and `30`
- `name` accepts letters and spaces only
- `role` must match the shipped role list
- `status` is `start` or `stop`
- `allowed_user` is a bare username from the selected `user_domain`; it is required for each published agent, validated against LDAP, and must be unique across the published agent set

## Output model

`get-configuration` returns:

```json
{
  "base_virtualhost": "agents.example.org",
  "user_domain": "example.org",
  "lets_encrypt": true,
  "agents": [
    {
      "id": 1,
      "name": "Foo Bar",
      "role": "developer",
      "status": "start",
      "allowed_user": "alice"
    }
  ]
}
```

`base_virtualhost` is the shared Traefik host for the module's shared auth entrypoint.
`lets_encrypt` controls whether Traefik should request a Let's Encrypt certificate for that shared host.
`status` is the persisted desired state.

`get-agent-runtime` returns:

```json
{
  "agents": [
    {
      "id": 1,
      "runtime_status": "start"
    }
  ]
}
```

`runtime_status` is derived from `systemctl --user is-active hermes@<id>.service`.

## State files

Module-wide state:

- `environment`
- `secrets/shared.env`

`environment` stores non-secret module settings and core-managed image or port values. Secrets must stay in `secrets/shared.env`, generated per-agent `secrets/<id>.env`, or generated shared auth secret files, and must not be printed to stdout, stderr, or logs.

Per-agent state files:

- `agents/<id>/metadata.json`
- `agents/<id>/agent.env`
- `secrets/<id>.env`

Shared Podman volume:

- `hermes-agents-home`, mounted as a shared named volume with one live Hermes home subdir per agent at `/opt/data` and the full volume available at `/opt/agents` for maintenance flows
- bootstrap-managed content inside each per-agent subdir includes the seeded `SOUL.md`, `.env`, and `config.yaml`, plus the runtime directory skeleton used by Hermes
- ownership is repaired by a one-shot root helper from the configured Hermes image so `/opt/data` matches that image's dynamic `hermes` UID/GID rather than a hardcoded UID

The active managed Traefik route instance is `<module_id>-hermes-auth`. The shared Hermes home volume name is `hermes-agents-home`.

Shared auth state files (generated, not backed up):

- `authproxy.env`
- `authproxy_secrets.env`
- `authproxy_agents.json`

Shared SMTP values come from `discover-smarthost`:

- public SMTP keys are merged into `environment`
- `SMTP_PASSWORD` is written into `secrets/shared.env`

`sync-agent-runtime` copies the relevant shared SMTP values into each generated Hermes env file and per-agent secrets file, generates or preserves a unique per-agent `API_SERVER_KEY` in each `secrets/<id>.env`, generates the shared auth runtime files, and ensures `HERMES_AUTH_SESSION_SECRET` exists in `secrets/shared.env`.
When `USER_DOMAIN` is configured, `sync-agent-runtime` also writes these public env keys into each generated `agents/<id>/agent.env` file:

- `AGENT_ALLOWED_USER`
- `USER_DOMAIN`
- `LDAP_HOST`
- `LDAP_PORT`
- `LDAP_BASE_DN`
- `LDAP_SCHEMA`

and these LDAP bind values into each generated `secrets/<id>.env` file:

- `LDAP_BIND_DN`
- `LDAP_BIND_PASSWORD`

## Service model

The shipped units are:

- `imageroot/systemd/user/hermes@.service`
- `imageroot/systemd/user/hermes-socket@.service`
- `imageroot/systemd/user/hermes-auth.service`
- `imageroot/systemd/user/hermes-pod@.service`

For agent `1`, the runtime looks like:

- primary systemd service: `hermes@1.service`
- per-agent socket relay service: `hermes-socket@1.service`
- Podman pod: `hermes-pod-1`
- Hermes container: `hermes-1`
- dashboard socket relay container: `hermes-socket-1`
- shared Hermes home named volume: `hermes-agents-home`, with the live agent home mounted from the matching subdir at `/opt/data`
- shared auth listener: `127.0.0.1:${TCP_PORT}` forwarded to auth proxy port `9119`
- dashboard socket: `%S/state/dashboard-sockets/agent-1.sock`, mounted into the auth container as `/sockets/agent-1.sock`
- shared auth proxy service: `hermes-auth.service`
- Hermes auth proxy container: `hermes-auth`

Restart supervision is owned by `hermes@<id>.service` and `hermes-auth.service`; `hermes@<id>.service` keeps `Restart=always` so in-agent `/restart` messages can restart the gateway, while sidecar/auth services use failure-oriented restart policies. The Podman pod and container launches do not set container-level restart policies.
The services invoke Podman and the runtime uses one shared named volume, `hermes-agents-home`, with per-agent live homes mounted from subdirs under `/opt/data`. During module updates, `update-module.d/30ensure-agent-home-ownership` best-effort stops any active `hermes@<id>.service` and `hermes-socket@<id>.service` pair, resets failed state, and runs `ensure-agent-home-ownership` before `update-module.d/80restart` restarts the enabled `hermes@<id>.service`, `hermes-socket@<id>.service`, and `hermes-auth.service` units so the refreshed images are actually used.
Managed `SOUL.md` and the default Hermes home `.env` are seeded in `configure-module/75seed-agent-home` before `hermes@<id>.service` starts. Later configure runs preserve existing files inside the volume.
The Hermes container reads `agents/<id>/agent.env` and `secrets/<id>.env`, including the generated per-agent `API_SERVER_KEY`, and keeps the upstream `/init` entrypoint so s6-overlay remains the service manager inside the container. `hermes@<id>.service` enables the bundled dashboard by passing `HERMES_DASHBOARD=true`, `HERMES_DASHBOARD_HOST=127.0.0.1`, `HERMES_DASHBOARD_PORT=9120`, and `HERMES_DASHBOARD_INSECURE=true` before invoking `hermes gateway run`. `hermes-socket@.service` joins the same pod, relays `127.0.0.1:9120` onto `%S/state/dashboard-sockets/agent-<id>.sock`, and the shared auth service mounts `%S/state/dashboard-sockets:/sockets:z`. The shared auth service listens on `9119`, authenticates access against the shared `user_domain` plus the generated `authproxy_agents.json` registry, preserves the dashboard upstream `Authorization` header, injects a trusted `X-Hermes-Authenticated-User` header derived from the authenticated session username while ignoring any client-supplied value for that header, and logs auth attempts plus outcomes to stdout while proxying to each assigned dashboard upstream.
The Hermes wrapper no longer patches or rebuilds the upstream dashboard sources at container start and no longer replaces the upstream s6 entrypoint with a custom bootstrap script.
If `base_virtualhost` is set, Traefik forwards `https://<base_virtualhost>/` to the shared auth listener on `TCP_PORT` using the route instance `<module>-hermes-auth`.

The route is owned by `configure-module` because it depends on administrator input. `destroy-module` removes the managed route and performs one-time certificate cleanup when `lets_encrypt` was enabled. Backend traffic from Traefik to the module remains plaintext HTTP on loopback behind Traefik TLS termination.

## Template seeding

The runtime manages two files inside each agent volume:

- `SOUL.md`, from `imageroot/templates/SOUL/<role>.md.in`
- `.env`, from `imageroot/templates/home.env.in`

Placeholder replacement is performed inside the one-shot `configure-module/75seed-agent-home` container by mounting the checked-in templates at `/templates` and the per-agent volume at `/opt/data`.
The seed step consumes only the generated public `agents/<id>/agent.env` file plus `AGENT_ID`, `AGENT_NAME`, and `AGENT_ROLE` substitutions.
Seeding is strict first-write only: later agent edits preserve existing `SOUL.md` and `.env` content in the volume.

## Action flow

### `create-module`

- loads JSON input and ignores its content
- `05check-podman-version`: rejects Podman releases older than 5.1 before any state is initialized, with a clear error that the module requires volume `subpath` mounts
- `10initialize-state`: persists `TIMEZONE` and creates `agents/` plus `secrets/shared.env`
- `20discover-smarthost`: refreshes shared SMTP settings
- does not create or start any agent runtime
- relies on the module image label to reserve the shared auth listener `TCP_PORT`

### `configure-module`

- `10validate-input`: validates the submitted agent list, optional shared virtualhost, optional shared `user_domain`, and optional shared `lets_encrypt`
- `20persist-shared-env`: persists `base_virtualhost`, optional shared `user_domain`, plus `lets_encrypt`, tracks previous values for route cleanup, and backfills `TIMEZONE` when missing
- `25configure-user-domain`: binds or unbinds the module relation to the selected NS8 user domain
- `30remove-deleted-routes`: reserved lifecycle slot; removed-agent route cleanup is no longer needed because the module manages only the shared Traefik route
- `40remove-deleted-agents`: stops removed services, removes removed pods and containers including `hermes-socket-<id>`, and delegates generated-state cleanup to `remove-agent-state`
- `50write-agent-metadata`: writes one `metadata.json` file per desired agent, including persisted `allowed_user`
- `60refresh-shared-settings`: runs `discover-smarthost`
- `70sync-agent-runtime`: runs `sync-agent-runtime`, which now also generates or preserves a unique per-agent `API_SERVER_KEY`, fans out `AGENT_ALLOWED_USER` plus LDAP runtime env and secrets when `USER_DOMAIN` is set, and writes `authproxy_agents.json` `upstream_socket` entries
- `75seed-agent-home`: runs a one-shot Hermes container to seed first-time `/opt/data/SOUL.md` and `/opt/data/.env` content from checked-in templates
- `80reload-systemd`: reloads the user systemd manager
- `90reconcile-desired-routes`: creates, updates, or clears the shared Traefik route instance `<module>-hermes-auth` when `base_virtualhost` is configured or explicitly changed, including `lets_encrypt` cleanup for host changes or shared TLS disable events
- `95reconcile-agent-services`: enables and starts both `hermes@<id>.service` and `hermes-socket@<id>.service` for desired `start` agents, disables or stops the rest, and manages the shared `hermes-auth.service` when publishing is active

### `list-user-domains`

- `10read`: lists user domains visible to the module through `agent.ldapproxy` for the admin UI selector

### `list-domain-users`

- `10read`: lists sorted LDAP users for the selected user domain so the admin UI can populate `allowed_user`

### `get-configuration`

- `20read`: returns the shared `base_virtualhost`, shared `user_domain`, and the configured agents with desired persisted status plus `allowed_user`

### `get-agent-runtime`

- `10read`: inspects `systemctl --user is-active hermes@<id>.service` for each configured agent and returns live `runtime_status`

### `destroy-module`

- `10remove-routes`: removes the shared Traefik route, including one-time certificate cleanup when shared `lets_encrypt` is enabled
- `20stop-services`: disables and stops every known `hermes@<id>.service`, stops each per-agent pod, removes the Hermes and auth proxy containers if present
- `30remove-agent-state`: delegates generated-state cleanup for each known agent to `remove-agent-state`
- `40remove-agents-root`: removes the top-level `agents/` directory

### `restore-module`

- `06copyenv`: restores only Hermes-managed shared keys from `request['environment']` (`TIMEZONE`, `BASE_VIRTUALHOST`, `USER_DOMAIN`, `LETS_ENCRYPT`) and intentionally ignores core-managed values.
- `20configure`: reads the restored `agents/` tree and reruns `configure-module` so NS8 restore replays user-domain binding, runtime-file generation, route reconciliation, and service reconciliation after the `hermes-agents-home` volume and canonical state are restored from restic.

## Testing contract

The checked-in tests cover:

- install with zero active agent services
- configure with zero agents
- create one started agent and verify service/container/volume/files/route
- stop the agent and verify inactive runtime with retained generated files and volume
- remove the agent and verify cleanup, including volume removal
- remove the module and verify instance cleanup

When behavior changes, keep tests aligned with the NS8 lifecycle checklist: install, configure, route reachability, reconfigure, restart or service reconciliation, uninstall, validation failures, and secret non-disclosure where relevant. Do not weaken tests to match broken behavior.