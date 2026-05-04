<p align="center">
  <img alt="image" src="https://github.com/Stell0/ns8-hermes-agent/blob/main/logo.png" />
</p>

# ns8-hermes-agent

`ns8-hermes-agent` is an NS8 module that manages one or more [Hermes Agent](https://hermes-agent.nousresearch.com/) runtimes, each paired with a Hermes Workspace browser surface inside the same per-agent pod.

<img width="1397" height="761" alt="image" src="https://github.com/user-attachments/assets/631c598a-9553-4a21-8ff5-f002568f0bbe" />

## Quickstart

Install the module with:

```bash
add-module ghcr.io/stell0/hermes-agent:0.2.1 1
```

From the UI, configure:

- shared dashboard and optional workspace virtualhosts such as `hermes.example.com` and `workspace.example.com`
- a user domain, which binds the module to that domain and populates the `allowed_user` selectors for each agent
- one or more agents with unique `allowed_user` values from the selected user domain

Configuration creates the agents and can publish two shared authenticated entrypoints that both terminate on the same auth proxy listener.

Published roots and explicit app paths are:

- `https://dashboard.example.com/` -> the authenticated user's assigned Hermes dashboard
- `https://workspace.example.com/` -> the authenticated user's assigned Hermes Workspace
- `https://dashboard.example.com/hermes-<id>/dashboard` -> Hermes dashboard
- `https://workspace.example.com/hermes-<id>/workspace` -> Hermes Workspace

The shared auth proxy is the only published entrypoint. Both public virtualhosts point to the same `hermes-auth.service` listener. It authenticates the NS8 user once, ignores any client-supplied `X-Hermes-Authenticated-User` header, injects the trusted username from the session, and then proxies the request to the correct per-agent dashboard or workspace socket.

**Notes**

- When shared publishing is enabled, the module does not support multiple agents with the same `allowed_user` value.
- The Hermes image already contains the bundled dashboard assets, so startup points Hermes at the packaged `web_dist` instead of rebuilding the UI at container start.
- Changes made from the dashboard still require a service restart before they take effect in the running gateway.
- Saving changes from the NS8 UI currently restarts all agents. Smarter per-agent restart targeting can be added later.

## Command line

Normal operation is UI-driven, but first-time setup is often easier from the command line.

Configure the provider and messaging platform for agent `1`:

```bash
runagent -m hermes-agent1 podman exec -it hermes-1 hermes setup
```

**Tip**: If you have an OpenAI ChatGPT Plus subscription, you can select OpenAI Codex, authenticate with OAuth, and the agent can use GPT-5.4 without per-agent OpenAI API keys.

Open the Hermes shell for agent `1`:

```bash
runagent -m hermes-agent1 podman exec -it hermes-1 hermes
```

Restart agent `1` from the command line:

```bash
runagent -m hermes-agent1 systemctl --user restart hermes@1
```

Open the Hermes shell for agent `3`:

```bash
runagent -m hermes-agent1 podman exec -it hermes-3 hermes
```

Configure the gateway for agent `2`:

```bash
runagent -m hermes-agent1 podman exec -it hermes-2 hermes gateway setup
```

See the [Hermes Agent documentation](https://hermes-agent.nousresearch.com/docs) for the available commands and configuration details.

## Repository guidelines

The current implementation is intentionally small:

- One dedicated Podman pod per configured agent.
- One configured agent maps directly to one metadata file, one generated Hermes env file, one generated Hermes secrets env file, and one Podman-managed Hermes home volume. Each started agent additionally owns one primary `hermes@<id>.service`, one `workspace@<id>.service`, one per-agent pod owner unit, one rootless Podman pod, one rootless Hermes container, one rootless Hermes Workspace container, and two rootless socket relay sidecars for dashboard and workspace.
- A fresh install has no per-agent Hermes or workspace runtime until at least one agent is configured with `status: start`. If shared publishing is configured with a non-empty agent list, the shared auth layer can still be active while every agent is stopped.
- `SOUL.md` and the default Hermes home `.env` are seeded exactly once per agent volume during `configure-module` by a one-shot Hermes container that mounts the checked-in templates plus the generated public agent env file.
- The module supports at most 30 agents and reserves one TCP port for the shared auth listener.
- The module is an NS8 account consumer and can bind one shared `user_domain` plus one per-agent `allowed_user` for published dashboard and workspace access.

## Current behavior

- `create-module` seeds minimal module state in `environment`, `secrets.env`, and `agents/`, records `TIMEZONE`, and discovers smarthost settings.
- `configure-module` validates the submitted agent list plus the shared dashboard and workspace virtualhosts, optional shared `user_domain`, and optional shared `lets_encrypt` switch, binds the selected NS8 user domain when set, stores one metadata file per agent, generates per-agent runtime files plus shared auth runtime files, generates and persists one per-agent `API_SERVER_KEY`, seeds first-time agent home content, reconciles the shared Traefik routes, and enables or disables `hermes@<id>.service`, `workspace@<id>.service`, both relay sidecars, and the shared `hermes-auth.service` when publishing is active.
- `get-configuration` returns the shared `base_virtualhost`, shared `workspace_virtualhost`, shared `user_domain`, shared `lets_encrypt` setting, and the configured agents with their persisted desired `status` plus `allowed_user`.
- `get-agent-runtime` returns live per-agent `runtime_status` derived from current systemd service state.
- `destroy-module` stops agent services, removes agent pods and containers, stops the shared auth service, deletes the managed Traefik routes, and deletes generated per-agent files plus per-agent Hermes home volumes.
- `discover-smarthost` merges shared SMTP settings into `environment` and `secrets.env`.

## Generated state

Module-wide files and runtime directories:

- `environment`
- `secrets.env`
- `authproxy.env`
- `authproxy_secrets.env`
- `authproxy_agents.json`
- `dashboard-sockets/`, created lazily by the auth or dashboard socket services
- `workspace-sockets/`, created lazily by the auth or workspace socket services

Per-agent files:

- `agents/<id>/metadata.json`
- `agent_<id>.env`
- `agent_<id>_secrets.env`

Per-agent Podman volume:

- `hermes-agent-<id>-home`, mounted at `/opt/data` for the Hermes gateway container; Hermes Workspace bind-mounts the volume's `home/` subdirectory at `/opt/data/home`
- bootstrap-managed content inside the volume includes the seeded `SOUL.md` and `.env`; `config.yaml` plus the runtime directory skeleton are created later by the Hermes wrapper entrypoint before Hermes starts for the first time
- ownership is repaired with the Hermes image's own `hermes` UID and GID during updates so image UID changes do not leave the volume unwritable before the enabled Hermes, workspace, relay, and shared auth services are restarted to pick up refreshed images

Operator-visible runtime names are `hermes-pod@.service` for the per-agent pod owner unit, `hermes-pod-<id>` for the pod, `hermes-<id>` for the per-agent Hermes container, `workspace-<id>` for the per-agent Hermes Workspace container, `hermes-socket-<id>` for the dashboard relay container, `workspace-socket-<id>` for the workspace relay container, `hermes-auth` for the shared auth proxy container, `hermes@.service` for the per-agent primary Hermes systemd unit, `workspace@.service` for the per-agent Hermes Workspace unit, `hermes-socket@.service` for the dashboard socket sidecar unit, `workspace-socket@.service` for the workspace socket sidecar unit, and `hermes-auth.service` for the shared auth unit. The active Traefik route instances are `<module_id>-hermes-auth-dashboard` and `<module_id>-hermes-auth-workspace`, and the Hermes home volume name is `hermes-agent-<id>-home`.

## Repository layout

- `imageroot/`: NS8 actions, helper scripts, templates, event handler, state helper module, and the user systemd units.
- `containers/`: the Hermes wrapper image sources, the shared auth proxy image for dashboard and workspace publishing, and the generic socket relay image. Hermes Workspace is consumed as an external image at runtime.
- `ui/`: embedded Vue 2 admin UI.
- `tests/`: Robot Framework integration checks and focused Python unit tests.

See `STRUCTURE.md` for a file map.

## Build

Build the module image, auth proxy image, Hermes wrapper image, and socket relay image with:

```bash
bash build-images.sh
```

The Hermes wrapper image is built from `docker.io/nousresearch/hermes-agent:v2026.4.23`. Hermes Workspace is not wrapped locally; the module uses `ghcr.io/outsourc-e/hermes-workspace:latest` by default through `HERMES_AGENT_WORKSPACE_IMAGE`.

The script uses:

- `REPOBASE`, default `ghcr.io/nethserver`
- `IMAGETAG`, default `latest`
- `HERMES_AGENT_WORKSPACE_IMAGE`, default `ghcr.io/outsourc-e/hermes-workspace:latest`

## Install

Instantiate the module with:

```bash
add-module ghcr.io/nethserver/hermes-agent:latest 1
```

Example output:

```json
{"module_id": "hermes-agent1", "image_name": "hermes-agent", "image_url": "ghcr.io/nethserver/hermes-agent:latest"}
```

No agent is created during install.

## Configure

The `configure-module` payload accepts a shared `base_virtualhost`, an optional shared `workspace_virtualhost`, an optional shared `user_domain`, an optional shared `lets_encrypt` boolean, and an `agents` array.

`base_virtualhost` is the dashboard virtualhost. When set and at least one agent exists, Traefik publishes `https://<base_virtualhost>/`, and the shared auth service routes authenticated root requests on that host to the assigned Hermes dashboard.

`workspace_virtualhost` is the workspace virtualhost. When set and at least one agent exists, Traefik publishes `https://<workspace_virtualhost>/`, and the same shared auth service routes authenticated root requests on that host to the assigned Hermes Workspace.

`user_domain` is optional while publishing is disabled. When either shared virtualhost is set and at least one agent exists, `user_domain` becomes required and must match an NS8 user domain visible through `agent.ldapproxy`.

`lets_encrypt` is optional. When `true`, Traefik requests a Let's Encrypt certificate for each published shared host. The flag applies to the shared hosts, not to individual agents.

Each agent contains:

- `id`: integer starting from `1` and capped at `30`
- `name`: letters and spaces only
- `role`: one of `default`, `developer`, `marketing`, `sales`, `customer_support`, `social_media_manager`, `business_consultant`, or `researcher`
- `status`: `start` or `stop`
- `allowed_user`: optional persisted per-agent value while shared publishing is disabled. When either shared virtualhost is set and at least one agent exists, it becomes required, must be a bare username from the selected NS8 `user_domain`, is validated against LDAP whenever `user_domain` is set, and must be unique across the configured agent set

Example:

```bash
api-cli run module/hermes-agent1/configure-module --data '{"base_virtualhost":"dashboard.example.org","workspace_virtualhost":"workspace.example.org","user_domain":"example.org","lets_encrypt":true,"agents":[{"id":1,"name":"Foo Bar","role":"developer","status":"start","allowed_user":"alice"}]}'
```

That configuration will:

- store `agents/1/metadata.json`
- generate `agent_1.env` and `agent_1_secrets.env`
- bind the module to the selected NS8 user domain and validate `allowed_user` against that domain
- run a one-shot `podman run --entrypoint /bin/sh` seed step that mounts `hermes-agent-1-home:/opt/data`, mounts the checked-in templates at `/templates`, and creates `/opt/data/SOUL.md` plus `/opt/data/.env` only when they do not already exist
- create or update the shared Traefik dashboard route for `https://dashboard.example.org/`
- create or update the shared Traefik workspace route for `https://workspace.example.org/`
- enable and start `hermes@1.service`
- enable and start `workspace@1.service`
- enable and start `hermes-socket@1.service`
- enable and start `workspace-socket@1.service`
- create one rootless Podman pod, `hermes-pod-1`, containing the Hermes container `hermes-1`, the Hermes Workspace container `workspace-1`, the dashboard relay container `hermes-socket-1`, and the workspace relay container `workspace-socket-1`
- enable and start the shared auth proxy service `hermes-auth.service` when either shared virtualhost is set and at least one agent exists

Read the current configuration with:

```bash
api-cli run module/hermes-agent1/get-configuration --data '{}'
```

Example output:

```json
{"base_virtualhost": "dashboard.example.org", "workspace_virtualhost": "workspace.example.org", "user_domain": "example.org", "lets_encrypt": true, "agents": [{"id": 1, "name": "Foo Bar", "role": "developer", "status": "start", "allowed_user": "alice"}]}
```

`status` is the persisted desired state.

Read live runtime state with:

```bash
api-cli run module/hermes-agent1/get-agent-runtime --data '{}'
```

Example output:

```json
{"agents": [{"id": 1, "runtime_status": "start"}]}
```

`runtime_status` is derived from the actual systemd service state.

## Accessing the published services

If `base_virtualhost` is configured, `https://<base_virtualhost>/` is the shared dashboard entrypoint.

If `workspace_virtualhost` is configured, `https://<workspace_virtualhost>/` is the shared workspace entrypoint.

The shared auth service authenticates against the shared `user_domain`, maps the authenticated username to exactly one assigned agent whose persisted desired status is `start`, and proxies the rest of that session's requests to the selected agent dashboard or workspace. The user-to-agent assignment is shared across both hosts; the selected app is derived from the request host unless an explicit `/hermes-<id>/dashboard` or `/hermes-<id>/workspace` path is requested. If the assignment is configured with desired `stop`, the session is not admitted to the apps until that desired state is changed again.

`https://<base_virtualhost>/hermes-N/` and `https://<workspace_virtualhost>/hermes-N/` remain auth-owned login or session-status pages for agent `N`; they are not Traefik path routes to the apps themselves.

`https://<base_virtualhost>/hermes-N/dashboard`, `https://<base_virtualhost>/hermes-N/workspace`, `https://<workspace_virtualhost>/hermes-N/dashboard`, and `https://<workspace_virtualhost>/hermes-N/workspace` remain valid explicit app surfaces. The dashboard host root lands on the assigned dashboard, the workspace host root lands on the assigned workspace, and requests to the removed legacy browser alias now fail with HTTP 404.

The auth proxy logs `auth_attempt`, `auth_success`, `auth_failed`, and `proxy_failed` events to standard output for troubleshooting published access. When `DEBUG=1` or `AUTH_PROXY_DEBUG=1`, it also logs `request_received` for inbound requests and `proxy_forward` with the resolved upstream URL before forwarding.

## Runtime unit

The shipped user units are:

- `imageroot/systemd/user/hermes@.service`
- `imageroot/systemd/user/workspace@.service`
- `imageroot/systemd/user/hermes-socket@.service`
- `imageroot/systemd/user/workspace-socket@.service`
- `imageroot/systemd/user/hermes-auth.service`
- `imageroot/systemd/user/hermes-pod@.service`

Each started agent runs:

- one primary `systemctl --user` service instance: `hermes@<id>.service`
- one workspace service instance: `workspace@<id>.service`
- one dashboard socket relay service instance: `hermes-socket@<id>.service`
- one workspace socket relay service instance: `workspace-socket@<id>.service`
- one Podman pod: `hermes-pod-<id>`
- one Hermes container: `hermes-<id>`
- one Hermes Workspace container: `workspace-<id>`
- one dashboard socket relay container: `hermes-socket-<id>`
- one workspace socket relay container: `workspace-socket-<id>`
- one Podman-managed Hermes home volume mounted at `/opt/data` for Hermes, with Hermes Workspace bind-mounting that volume's `home/` subdirectory at `/opt/data/home`
- one per-agent dashboard socket at `%S/state/dashboard-sockets/agent-<id>-dashboard.sock`, mounted into `hermes-auth` as `/dashboard-sockets/agent-<id>-dashboard.sock`
- one per-agent workspace socket at `%S/state/workspace-sockets/agent-<id>.sock`, mounted into `hermes-auth` as `/workspace-sockets/agent-<id>.sock`

Shared publishing also runs:

- one shared Traefik dashboard route instance: `<module_id>-hermes-auth-dashboard`
- one shared Traefik workspace route instance: `<module_id>-hermes-auth-workspace`
- one shared auth listener on `127.0.0.1:${TCP_PORT}` forwarded to auth proxy port `9119`
- one shared auth proxy service instance: `hermes-auth.service`
- one shared auth proxy container: `hermes-auth`

The Hermes container exposes its gateway API on `127.0.0.1:8642` and its dashboard on `127.0.0.1:9120` inside the pod. Hermes Workspace connects to those local endpoints with `HERMES_API_URL=http://127.0.0.1:8642` and `HERMES_DASHBOARD_URL=http://127.0.0.1:9120`, reuses the per-agent `API_SERVER_KEY` only for `HERMES_API_TOKEN`, relies on the dashboard session-token fallback instead of forcing `HERMES_DASHBOARD_TOKEN`, and mounts the agent home volume's `home/` subdirectory at `/opt/data/home` so the non-root workspace user gets a readable writable workspace path.

The shared auth proxy mounts both socket directories, strips the `/hermes-<id>/dashboard` or `/hermes-<id>/workspace` prefix before proxying, forwards `X-Forwarded-Host`, `X-Forwarded-Proto`, `X-Forwarded-For`, and `X-Forwarded-Prefix` for the workspace surface, derives the default app from the request host, and only publishes the shared listener.

## UI development

The embedded UI lives in `ui/`.

For local UI work:

```bash
cd ui
yarn install
yarn serve
```

For a production bundle:

```bash
cd ui
yarn install
yarn build
```

If required by your environment, set `NODE_OPTIONS=--openssl-legacy-provider` before running the UI toolchain.

## Testing

Run the module test with:

```bash
./test-module.sh <NODE_ADDR> ghcr.io/nethserver/hermes-agent:latest
```

The checked-in tests cover the current contract:

- install produces no active agent runtime
- zero agents keeps the module idle
- one started agent produces one pod, four per-agent services, four per-agent containers, two socket files, and one isolated volume
- stopping an agent disables the runtime without deleting its generated files or volume
- removing an agent cleans the runtime files and volume
- removing the module cleans the instance state

## Uninstall

Remove the instance with:

```bash
remove-module --no-preserve hermes-agent1
```