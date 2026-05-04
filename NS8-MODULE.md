# NS8 Module Notes

This document summarizes the current checked-in NS8 behavior for `ns8-hermes-agent`.

## Overview

`ns8-hermes-agent` is a per-agent Hermes NS8 module with one Podman pod for each configured agent.

- No OpenViking runtime
- No hidden system agent
- No shared backend API service
- One configured agent equals one metadata file, one generated Hermes env file, one generated Hermes secrets env file, and one Hermes home volume. Each started agent additionally owns one primary `hermes@<id>.service`, one `workspace@<id>.service`, one per-agent pod owner unit, one pod, one Hermes container, one Hermes Workspace container, and two socket relay sidecars. The shared auth service and container are module-scoped and are enabled when either `base_virtualhost` or `workspace_virtualhost` is set and at least one agent exists

The implementation keeps the module lifecycle explicit:

- `create-module`: initialize module state only
- `configure-module`: validate agent input, persist shared publishing settings plus one metadata file per agent, bind the selected user domain, seed first-time agent home content, and reconcile routes and services
- `get-configuration`: report the shared dashboard and workspace publishing hosts, shared `user_domain`, shared `lets_encrypt` flag, and configured agents, preserving desired status only
- `get-agent-runtime`: report live per-agent runtime state derived from systemd
- `destroy-module`: stop services, remove managed routes, and remove generated state

## Images

The module publishes or references:

- `ghcr.io/nethserver/hermes-agent`: the NS8 module image
- `ghcr.io/nethserver/hermes-agent-auth`: the shared auth proxy image for Hermes dashboard and Hermes Workspace publishing
- `ghcr.io/nethserver/hermes-agent-hermes`: the Hermes wrapper image built from `docker.io/nousresearch/hermes-agent:v2026.4.23`
- `ghcr.io/nethserver/hermes-agent-socket`: the per-agent dashboard and workspace socket relay image
- `ghcr.io/nethserver/hermes-agent-workspace`: the per-agent Hermes Workspace wrapper image built from `ghcr.io/outsourc-e/hermes-workspace:latest` and referenced by `HERMES_AGENT_WORKSPACE_IMAGE`

`build-images.sh` builds the local module, auth proxy, Hermes wrapper, Hermes Workspace wrapper, and socket relay images, and records them in `org.nethserver.images`.

The module image reserves one TCP port and declares `cluster:accountconsumer traefik@node:routeadm node:portsadm` authorizations so it can bind one NS8 user domain and publish shared auth routes for the dashboard and workspace hosts through one listener.

## Input model

`configure-module` accepts:

```json
{
  "base_virtualhost": "agents.example.org",
  "workspace_virtualhost": "workspace.example.org",
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
- `user_domain` is optional while publishing is disabled; when either shared virtualhost is set and at least one agent exists it becomes required and must resolve through `agent.ldapproxy`
- `lets_encrypt` is optional and must be boolean when present
- `id` must be an integer between `1` and `30`
- `name` accepts letters and spaces only
- `role` must match the shipped role list
- `status` is `start` or `stop`
- `allowed_user` is an optional persisted per-agent value while shared publishing is disabled. When either shared virtualhost is set and at least one agent exists, it becomes required, must be a bare username from the selected `user_domain`, is validated against LDAP whenever `user_domain` is set, and must be unique across the configured agent set

## Output model

`get-configuration` returns:

```json
{
  "base_virtualhost": "agents.example.org",
  "workspace_virtualhost": "workspace.example.org",
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

`base_virtualhost` is the shared Traefik dashboard host for the module's shared auth entrypoint.
`workspace_virtualhost` is the shared Traefik workspace host for the module's shared auth entrypoint.
`lets_encrypt` controls whether Traefik should request a Let's Encrypt certificate for the published shared hosts.
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

Module-wide state and runtime directories:

- `environment`
- `secrets.env`
- `authproxy.env`
- `authproxy_secrets.env`
- `authproxy_agents.json`
- `dashboard-sockets/`, created lazily by the auth or dashboard socket services
- `workspace-sockets/`, created lazily by the auth or workspace socket services

Per-agent state files:

- `agents/<id>/metadata.json`
- `agent_<id>.env`
- `agent_<id>_secrets.env`

Per-agent Podman volume:

- `hermes-agent-<id>-home`, mounted at `/opt/data` for both Hermes and Hermes Workspace
- bootstrap-managed content inside the volume includes the seeded `SOUL.md` and `.env`; `config.yaml` plus the runtime directory skeleton are created later by the Hermes wrapper entrypoint before Hermes starts for the first time
- ownership is repaired by a one-shot root helper from the configured Hermes image so `/opt/data` matches that image's dynamic `hermes` UID and GID rather than a hardcoded UID

The active managed Traefik route instances are `<module_id>-hermes-auth-dashboard` and `<module_id>-hermes-auth-workspace`. Hermes home volume names are `hermes-agent-<id>-home`.

`sync-agent-runtime` copies the relevant shared SMTP values into each generated Hermes env file and per-agent secrets file, generates the shared auth runtime files, ensures `HERMES_AUTH_SESSION_SECRET` exists in `secrets.env`, ensures each agent has a persistent `API_SERVER_KEY` for the local Hermes gateway API, and writes these auth registry fields for every agent that has `allowed_user` set:

- `dashboard_upstream_socket`
- `workspace_upstream_socket`
- `allowed_user`

When an agent has a non-empty `allowed_user`, `sync-agent-runtime` writes this public env key into the generated `agent_<id>.env` file:

- `AGENT_ALLOWED_USER`

When `USER_DOMAIN` is configured, `sync-agent-runtime` also writes these additional public env keys into each generated `agent_<id>.env` file:

- `USER_DOMAIN`
- `LDAP_HOST`
- `LDAP_PORT`
- `LDAP_BASE_DN`
- `LDAP_SCHEMA`

regardless of `USER_DOMAIN`, `sync-agent-runtime` writes this generated secret into each `agent_<id>_secrets.env` file:

- `HERMES_AGENT_SECRET`
- `API_SERVER_KEY`

When `USER_DOMAIN` is configured, `sync-agent-runtime` also writes these LDAP bind values into each generated `agent_<id>_secrets.env` file:

- `LDAP_BIND_DN`
- `LDAP_BIND_PASSWORD`

## Service model

The shipped units are:

- `imageroot/systemd/user/hermes@.service`
- `imageroot/systemd/user/workspace@.service`
- `imageroot/systemd/user/hermes-socket@.service`
- `imageroot/systemd/user/workspace-socket@.service`
- `imageroot/systemd/user/hermes-auth.service`
- `imageroot/systemd/user/hermes-pod@.service`

For agent `1`, the runtime looks like:

- primary Hermes systemd service: `hermes@1.service`
- primary Hermes Workspace systemd service: `workspace@1.service`
- dashboard socket relay service: `hermes-socket@1.service`
- workspace socket relay service: `workspace-socket@1.service`
- Podman pod: `hermes-pod-1`
- Hermes container: `hermes-1`
- Hermes Workspace container: `workspace-1`
- dashboard socket relay container: `hermes-socket-1`
- workspace socket relay container: `workspace-socket-1`
- Hermes home named volume: `hermes-agent-1-home` mounted at `/opt/data` for both `hermes-1` and `workspace-1`
- shared auth listener: `127.0.0.1:${TCP_PORT}` forwarded to auth proxy port `9119`
- dashboard socket: `%S/state/dashboard-sockets/agent-1-dashboard.sock`, mounted into the auth container as `/dashboard-sockets/agent-1-dashboard.sock`
- workspace socket: `%S/state/workspace-sockets/agent-1.sock`, mounted into the auth container as `/workspace-sockets/agent-1.sock`
- shared auth proxy service: `hermes-auth.service`
- shared auth proxy container: `hermes-auth`

Restart supervision is owned by the systemd units: `hermes@<id>.service`, `workspace@<id>.service`, `hermes-socket@<id>.service`, `workspace-socket@<id>.service`, and `hermes-auth.service`. The Podman pod and container launches do not set container-level restart policies.

During module updates, `update-module.d/30ensure-agent-home-ownership` best-effort stops any active Hermes, workspace, and relay service set, resets failed state, and runs `ensure-agent-home-ownership` before `update-module.d/80restart` restarts the enabled `hermes@<id>.service`, `workspace@<id>.service`, `hermes-socket@<id>.service`, `workspace-socket@<id>.service`, and `hermes-auth.service` units so the refreshed images are actually used.

Managed `SOUL.md` and the default Hermes home `.env` are seeded in `configure-module/75seed-agent-home` before `hermes@<id>.service` starts. Later configure runs preserve existing files inside the volume.

The Hermes container runs the gateway and exposes its local API on `127.0.0.1:8642` inside the pod. `hermes-socket@.service` joins the same pod and relays the Hermes dashboard on `127.0.0.1:9120` onto `%S/state/dashboard-sockets/agent-<id>-dashboard.sock`. `workspace@.service` joins the same pod, runs Hermes Workspace on `127.0.0.1:3000`, consumes `HERMES_API_URL=http://127.0.0.1:8642`, `HERMES_API_TOKEN=${API_SERVER_KEY}`, and `HERMES_DASHBOARD_URL=http://127.0.0.1:9120`, relies on the dashboard session-token fallback instead of forcing `HERMES_DASHBOARD_TOKEN`, mounts the same per-agent volume at `/opt/data`, stores Workspace state under `HERMES_HOME=/opt/data/.hermes`, and exposes user-editable files from `HERMES_WORKSPACE_DIR=/opt/data/workspace`. `workspace-socket@.service` relays Hermes Workspace onto `%S/state/workspace-sockets/agent-<id>.sock`.

The shared auth service mounts both socket directories, listens on `9119`, authenticates access against the shared `user_domain` plus the generated `authproxy_agents.json` registry, preserves the dashboard upstream `Authorization` header, injects a trusted `X-Hermes-Authenticated-User` header derived from the authenticated session username while ignoring any client-supplied value for that header, proxies `/hermes-<id>/dashboard` and `/hermes-<id>/workspace` to the matching per-agent socket, keeps `/hermes-<id>/` as the auth-owned landing page, defaults the host root to the assigned dashboard or workspace based on the request host, and returns HTTP 404 for requests to the removed legacy browser alias.

If `base_virtualhost` is set and at least one agent exists, Traefik forwards `https://<base_virtualhost>/` to the shared auth listener on `TCP_PORT` using the route instance `<module>-hermes-auth-dashboard`.

If `workspace_virtualhost` is set and at least one agent exists, Traefik forwards `https://<workspace_virtualhost>/` to the same shared auth listener on `TCP_PORT` using the route instance `<module>-hermes-auth-workspace`.

## Template seeding

The runtime manages two files inside each agent volume:

- `SOUL.md`, from `imageroot/templates/SOUL/<role>.md.in`
- `.env`, from `imageroot/templates/home.env.in`

Placeholder replacement is performed inside the one-shot `configure-module/75seed-agent-home` container by mounting the checked-in templates at `/templates` and the per-agent volume at `/opt/data`.
The seed step consumes only the generated public `agent_<id>.env` file plus `AGENT_ID`, `AGENT_NAME`, and `AGENT_ROLE` substitutions.
Seeding is strict first-write only: later agent edits preserve existing `SOUL.md` and `.env` content in the volume.

## Action flow

### `create-module`

- loads JSON input and ignores its content
- `10initialize-state`: persists `TIMEZONE` and creates `agents/` plus `secrets.env`
- `20discover-smarthost`: refreshes shared SMTP settings
- does not create or start any agent runtime
- relies on the module image label to reserve the shared auth listener `TCP_PORT`

### `configure-module`

- `10validate-input`: validates the submitted agent list, optional shared dashboard and workspace virtualhosts, optional shared `user_domain`, and optional shared `lets_encrypt`
- `20persist-shared-env`: persists `base_virtualhost`, optional `workspace_virtualhost`, optional shared `user_domain`, plus `lets_encrypt`, tracks previous values for route cleanup, and backfills `TIMEZONE` when missing
- `25configure-user-domain`: binds or unbinds the module relation to the selected NS8 user domain
- `30remove-deleted-routes`: reserved lifecycle slot; removed-agent route cleanup is no longer needed because the module manages only the shared Traefik auth routes
- `40remove-deleted-agents`: stops removed services, removes removed pods and containers including `workspace-<id>` and `workspace-socket-<id>`, and delegates generated-state cleanup to `remove-agent-state`
- `50write-agent-metadata`: writes one `metadata.json` file per desired agent, including persisted `allowed_user`
- `60refresh-shared-settings`: runs `discover-smarthost`
- `70sync-agent-runtime`: runs `sync-agent-runtime`, which also fans out `AGENT_ALLOWED_USER` when `allowed_user` is set, adds LDAP runtime env and secrets when `USER_DOMAIN` is set, generates one persistent `API_SERVER_KEY` per agent, and writes `authproxy_agents.json` dashboard/workspace socket entries
- `75seed-agent-home`: runs a one-shot Hermes container to seed first-time `/opt/data/SOUL.md` and `/opt/data/.env` content from checked-in templates
- `80reload-systemd`: reloads the user systemd manager
- `90reconcile-desired-routes`: creates, updates, or clears the shared Traefik route instances `<module>-hermes-auth-dashboard` and `<module>-hermes-auth-workspace` when the dashboard or workspace host is configured or explicitly changed, including `lets_encrypt` cleanup for host changes or shared TLS disable events
- `95reconcile-agent-services`: enables and starts `hermes@<id>.service`, `workspace@<id>.service`, `hermes-socket@<id>.service`, and `workspace-socket@<id>.service` for desired `start` agents, disables or stops the rest, and manages the shared `hermes-auth.service` when publishing is active

### `list-user-domains`

- `10read`: lists user domains visible to the module through `agent.ldapproxy` for the admin UI selector

### `list-domain-users`

- `10read`: lists sorted LDAP users for the selected user domain so the admin UI can populate `allowed_user`

### `get-configuration`

- `20read`: returns the shared `base_virtualhost`, shared `workspace_virtualhost`, shared `user_domain`, and the configured agents with desired persisted status plus `allowed_user`

### `get-agent-runtime`

- `10read`: inspects `systemctl --user is-active hermes@<id>.service` for each configured agent and returns live `runtime_status`

### `destroy-module`

- `10remove-routes`: removes the shared Traefik dashboard and workspace routes, including one-time certificate cleanup when shared `lets_encrypt` is enabled
- `20stop-services`: disables and stops every known `hermes@<id>.service`, `workspace@<id>.service`, relay unit, pod, and shared auth service, then removes the managed containers if present
- `30remove-agent-state`: delegates generated-state cleanup for each known agent to `remove-agent-state`
- `40remove-agents-root`: removes the top-level `agents/` directory

## Testing contract

The checked-in tests cover:

- install with zero active agent services
- configure with zero agents
- create one started agent and verify service, container, socket, volume, and file wiring
- stop the agent and verify inactive runtime with retained generated files and volume
- remove the agent and verify cleanup, including volume removal
- remove the module and verify instance cleanup