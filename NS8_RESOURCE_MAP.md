# NethServer 8 Resource Map for Agent Use

## Scope

This document maps the main official and quasi-official NethServer 8 resources an agent should consult to answer questions about features, users, firewall, APIs, HTTP routing, Traefik routes, repositories, and development details. NethServer 8 is positioned as a multi-node application platform for hybrid cloud, with a web UI, container orchestration, centralized administration, backups, and a software center. ([nethserver.org][1])

## Primary official entry points

* **Official website** — best starting point for product positioning, high-level features, architecture summary, and value proposition. Use this for questions like “what is NethServer 8” or “what are the main features.” ([nethserver.org][1])
* **Administrator manual** — best starting point for installation, operations, cluster management, applications, user domains, HTTP routes, TLS, backup, firewall, notifications, logs, and metrics. ([docs.nethserver.org][2])
* **Developer manual** — best starting point for internals, architecture, agents, API server, Redis schema, module model, firewall APIs, user-domain binding, proxy/certificates, networking, and module development. ([nethserver.github.io][3])
* **GitHub organization** — best starting point to discover the canonical NS8 repositories and follow source code. ([GitHub][4])
* **Community Discourse** — best starting point for support threads, edge cases, workarounds, recent practical issues, and usage discussions. ([NethServer Community][5])
* **Official issue tracker** — use after checking docs and community, for confirmed bugs, implementation status, and development tracking. The official tracker explicitly says discussion should usually start on the community forum first. ([GitHub][6])

## Official documentation resources

### 1. Administrator manual

* **Admin manual home** — canonical operational documentation for NS8. ([docs.nethserver.org][2])
* **Introduction** — use for concise platform description and product definition; it states NS8 is an application server for SMEs and operates as a container orchestrator. ([docs.nethserver.org][7])
* **Software center** — use for core components overview and repository behavior; it states the core includes the web UI, API server, agents, and backup engines, and also lists LDAP proxy, Loki, and Traefik as core apps. ([docs.nethserver.org][8])
* **Applications / modules** — use to understand that an NS8 application is implemented as a *module*, the deployable unit managed by the cluster orchestrator. ([docs.nethserver.org][9])
* **User domains** — use for admin-facing user/group management, LDAP schema choices, Samba vs OpenLDAP, internal vs external providers, and user management portal references. ([docs.nethserver.org][10])
* **HTTP routes** — use for admin-facing routing behavior, route types, automatic vs custom routes, and the fact that Traefik is the component implementing HTTP routes. ([docs.nethserver.org][11])
* **Firewall** — use for open ports, node firewall behavior, UI location of firewall settings, and manual `firewall-cmd` operations. ([docs.nethserver.org][12])
* **Release notes** — use for newly introduced capabilities and behavior changes, especially around routing, certificates, firewall rich rules, and experimental API/manual features. ([docs.nethserver.org][13])

### 2. Developer manual

* **Developer manual home** — canonical internals guide for developers working on or extending NS8. ([nethserver.github.io][3])
* **Design & Architecture** — use for the highest-signal internal overview: Redis database/message bus, node/cluster/module agents, Traefik as edge proxy, LDAP proxy, WireGuard VPN, API server, and UI. ([nethserver.github.io][14])
* **API server** — use for authentication flow, JWT handling, API path model, source-IP restrictions, audit log, and `api-cli` usage. It also states the API server is implemented in Go and listens on TCP port 9311. ([nethserver.github.io][15])
* **Database** — use for Redis schema and internal object layout, including `cluster/`, `node/`, `module/`, `task/`, and `module/traefikX/` keys. ([nethserver.github.io][16])
* **Agents** — use to understand task execution flow, queues, and how actions are dispatched to cluster, node, and module agents. ([nethserver.github.io][17])
* **User domains** — use for developer-facing domain binding, `accountconsumer` authorization, and module/domain relations. ([nethserver.github.io][18])
* **Firewall** — use for programmatic firewall management from modules, including `fwadm` authorization and `agent.add_public_service()`. ([nethserver.github.io][19])
* **Modules / network / tutorial** — use for how modules are built, networked, published, and exposed behind Traefik. ([nethserver.github.io][20])

## API documentation resources

* **API server docs in developer manual** — first stop for understanding the API model exposed by NS8. It documents login, JWT flow, `api-cli`, WebSocket support, and source-IP restrictions. ([nethserver.github.io][15])
* **Generated Swagger JSON** — canonical machine-readable API description generated from the core API server. The `ns8-core` API server README states the Swagger file is automatically built and published from the `swagdoc` branch. ([GitHub][21])
* **`ns8-core/core/api-server/README.md`** — use when you need implementation-adjacent details not obvious from the manuals, including the Redis mapping of API calls and WebSocket commands. ([GitHub][21])

## Repository map

### Core platform repositories

* **`NethServer/ns8-core`** — the main NS8 core source repository; it explicitly says it contains core source code, developer documentation, CI/CD automation, and installation procedure. ([GitHub][22])
* **`NethServer/ns8-docs`** — source repository for the NS8 documentation site. Use when you want the raw docs sources or need to inspect how documentation is structured. ([GitHub][23])
* **`NethServer/ns8-traefik`** — source repository for the Traefik proxy module that manages HTTP routes and certificates. This is the authoritative repo for route actions like `set-route`, `get-route`, `delete-route`, and `list-routes`. ([GitHub][24])
* **`NethServer/ns8-openldap`** — core module for OpenLDAP-based user domains using RFC2307 schema. ([GitHub][25])
* **`NethServer/ns8-samba`** — core module for Samba-based Active Directory domains and related file-server behavior. ([GitHub][26])
* **`NethServer/ns8-ldapproxy`** — LDAP proxy module used as the broker between account providers and consumer modules. ([GitHub][27])
* **`NethServer/ns8-loki`** — log aggregation module used by the platform log stack. ([GitHub][28])
* **`NethServer/ns8-repomd`** — official NS8 repository metadata index for modules. Use this to understand official module publication and repository metadata. ([GitHub][29])
* **`NethServer/ns8-nethforge`** — official NethForge index for community-built NS8 modules. ([GitHub][30])
* **`NethServer/ns8-kickstart`** — official template repository for creating a new NS8 module. ([GitHub][31])
* **`NethServer/nethserver-ns8-migration`** — migration tooling from NethServer 7 to NethServer 8. ([GitHub][32])

### Project-wide discovery and tracking

* **`NethServer` GitHub org repositories page** — use to discover all official repos, modules, and supporting tooling. ([GitHub][4])
* **`NethServer/dev`** — official issue tracker for the project. Use for bugs, feature requests, and implementation status after checking docs/community first. ([GitHub][6])

## Community resources

* **Community forum home** — main public discussion area for support, deployment problems, user questions, and announcements. ([NethServer Community][5])
* **Categories index** — useful when an agent needs to navigate by topic rather than keyword; includes categories such as Development. ([NethServer Community][33])
* **`ns8` tag page** — best filtered view for NS8-specific discussions. ([NethServer Community][34])
* **`nethserver8` tag page** — additional NS8-related discussion stream. ([NethServer Community][35])

## Agent retrieval strategy

1. **Use the administrator manual first** for operational questions, installed applications, user management, firewall, routes, certificates, backups, and cluster tasks. ([docs.nethserver.org][2])
2. **Use the developer manual second** for architecture, API flow, Redis/task model, module internals, and programmatic firewall or domain binding behavior. ([nethserver.github.io][3])
3. **Use repository READMEs and code** for exact action names, CLI examples, environment variables, and implementation details. ([GitHub][24])
4. **Use the official issue tracker and community forum** for unresolved edge cases, bugs, regressions, or undocumented behavior. ([GitHub][6])

For agentic development inside this repository, apply local checked-in docs first, then official NS8 manuals, then maintained module and `ns8-kickstart` patterns. The current kickstart guideline files used for this repository refresh are:

* [ns8-kickstart agentic AGENTS.md](https://github.com/Stell0/ns8-kickstart/blob/agentic_dev/AGENTS.md)
* [ns8-kickstart agentic STRUCTURE.md](https://github.com/Stell0/ns8-kickstart/blob/agentic_dev/STRUCTURE.md)

Treat those guideline files as patterns to evaluate against the local module contract, not as a replacement for checked-in behavior.

## Query-to-resource routing

### “What is NethServer 8 features?”

* Start with the **official website** for the product-level feature set: multi-node architecture, centralized administration, software center, backups, multiple app instances per node, and hybrid-cloud positioning. ([nethserver.org][1])
* Then use the **Introduction** and **Software center** pages in the admin docs for the platform definition and core-component inventory. ([docs.nethserver.org][7])

### “How does NethServer 8 manage users?”

* Start with **User domains** in the admin manual for operational behavior: LDAP-based domains, internal vs external providers, Samba AD vs OpenLDAP RFC2307, replicas, users, groups, and user portal. ([docs.nethserver.org][10])
* Then use **Developer manual → User domains** for module/domain binding and authorization mechanics. ([nethserver.github.io][18])
* For implementation details, inspect **`ns8-openldap`**, **`ns8-samba`**, and **`ns8-ldapproxy`**. ([GitHub][25])

### “How does NethServer 8 manage firewall?”

* Start with the **Firewall** page in the admin manual for node-level firewall model, default open ports, UI location, and `firewall-cmd` examples. ([docs.nethserver.org][12])
* Then use **Developer manual → Firewall** for the module-facing firewall API and `fwadm` authorization model. ([nethserver.github.io][19])

### “What API does NethServer 8 expose?”

* Start with **Developer manual → API server** for the official API model, login flow, JWT auth, and `api-cli`. ([nethserver.github.io][15])
* Then use **Swagger JSON** from the generated API docs for machine-readable endpoint discovery. ([GitHub][21])
* For lower-level behavior, use **`ns8-core/core/api-server/README.md`**. ([GitHub][21])

### “What API does NethServer 8 use?”

* Use **Developer manual → API server** and **Design & Architecture** to understand that NS8 uses an HTTP REST API fronted by the API server, with Redis used underneath for command dispatch and Pub/Sub signaling. ([nethserver.github.io][15])
* Use **`ns8-core/core/api-server/README.md`** for the explicit Redis mapping of API calls and WebSocket support. ([GitHub][21])

### “What NethServer 8 module manages HTTP routes?”

* The admin docs explicitly state that the component implementing HTTP routes is the **Traefik HTTP proxy**. ([docs.nethserver.org][11])
* The canonical source repository for that module is **`NethServer/ns8-traefik`**. ([GitHub][24])

### “How to query NethServer 8 existing Traefik routes?”

* Use **`NethServer/ns8-traefik`** README: it documents `get-route` and `list-routes`, including `api-cli run list-routes --agent module/traefik1` and the expanded-list option. ([GitHub][24])
* Use **Developer manual → API server** and **`ns8-core/core/api-server/README.md`** to understand how to authenticate, obtain a JWT, and execute actions through the API server or `api-cli`. ([nethserver.github.io][15])
* If you need the admin-facing view rather than the action interface, use the **HTTP routes** page in the admin manual. ([docs.nethserver.org][11])

## Minimal source set an agent should always keep handy

* **Official website** for high-level features and positioning. ([nethserver.org][1])
* **Administrator manual home** for operational documentation. ([docs.nethserver.org][2])
* **Developer manual home** for internals and developer-facing behavior. ([nethserver.github.io][3])
* **`ns8-core`** for core implementation and API server details. ([GitHub][22])
* **`ns8-traefik`** for routes and certificates. ([GitHub][24])
* **`ns8-openldap` / `ns8-samba` / `ns8-ldapproxy`** for user-domain internals. ([GitHub][25])
* **Community forum** and **official issue tracker** for real-world problems and current implementation status. ([NethServer Community][5])

## Short rule set for the agent

* For **product/features questions**, prefer website + intro + software center. ([nethserver.org][1])
* For **admin/ops questions**, prefer admin manual. ([docs.nethserver.org][2])
* For **internals/API/module questions**, prefer developer manual + `ns8-core` repo. ([nethserver.github.io][3])
* For **routes/certificates/proxy**, prefer admin HTTP routes page + `ns8-traefik` repo. ([docs.nethserver.org][11])
* For **users/auth/LDAP**, prefer admin User domains + developer User domains + `ns8-openldap` / `ns8-samba` / `ns8-ldapproxy`. ([docs.nethserver.org][10])
* For **bugs, regressions, unclear behavior, or recent changes**, check community and then `NethServer/dev`. ([NethServer Community][5])

[1]: https://www.nethserver.org/ "NethServer – Small Business Linux Server Made Easy"
[2]: https://docs.nethserver.org/projects/ns8 "NethServer 8 administrator manual — NS8  documentation"
[3]: https://nethserver.github.io/ns8-core/ "Home | NS8 dev manual"
[4]: https://github.com/orgs/NethServer/repositories?utm_source=chatgpt.com "Repositories - NethServer"
[5]: https://community.nethserver.org/?utm_source=chatgpt.com "NethServer Community"
[6]: https://github.com/NethServer/dev?utm_source=chatgpt.com "NethServer/dev: NethServer issue tracker"
[7]: https://docs.nethserver.org/projects/ns8/en/latest/introduction.html?utm_source=chatgpt.com "Introduction — NS8 documentation"
[8]: https://docs.nethserver.org/projects/ns8/en/latest/software_center.html?utm_source=chatgpt.com "Software center — NS8 documentation"
[9]: https://docs.nethserver.org/projects/ns8/en/latest/modules.html?utm_source=chatgpt.com "Applications — NS8 documentation"
[10]: https://docs.nethserver.org/projects/ns8/en/latest/user_domains.html "User domains — NS8  documentation"
[11]: https://docs.nethserver.org/projects/ns8/en/latest/proxy.html "HTTP routes — NS8  documentation"
[12]: https://docs.nethserver.org/projects/ns8/en/latest/firewall.html "Firewall — NS8  documentation"
[13]: https://docs.nethserver.org/projects/ns8/en/latest/release_notes.html?utm_source=chatgpt.com "Release notes — NS8 documentation"
[14]: https://nethserver.github.io/ns8-core/design/?utm_source=chatgpt.com "Design & Architecture | NS8 dev manual"
[15]: https://nethserver.github.io/ns8-core/core/api_server/?utm_source=chatgpt.com "API server | NS8 dev manual"
[16]: https://nethserver.github.io/ns8-core/core/database/?utm_source=chatgpt.com "Database | NS8 dev manual"
[17]: https://nethserver.github.io/ns8-core/core/agents/?utm_source=chatgpt.com "Agents | NS8 dev manual"
[18]: https://nethserver.github.io/ns8-core/core/user_domains/?utm_source=chatgpt.com "User domains | NS8 dev manual"
[19]: https://nethserver.github.io/ns8-core/core/firewall/?utm_source=chatgpt.com "Firewall | NS8 dev manual"
[20]: https://nethserver.github.io/ns8-core/modules/new_module/?utm_source=chatgpt.com "New module tutorial | NS8 dev manual"
[21]: https://github.com/NethServer/ns8-core/blob/main/core/api-server/README.md?utm_source=chatgpt.com "ns8-core/core/api-server/README.md at main"
[22]: https://github.com/NethServer/ns8-core "GitHub - NethServer/ns8-core: Multi-node application platform for hybrid cloud to run your apps and data anywhere · GitHub"
[23]: https://github.com/NethServer/ns8-docs?utm_source=chatgpt.com "NethServer/ns8-docs: NethServer 8 documentation"
[24]: https://github.com/NethServer/ns8-traefik "GitHub - NethServer/ns8-traefik: NS8 Traefik configuration · GitHub"
[25]: https://github.com/NethServer/ns8-openldap?utm_source=chatgpt.com "NethServer/ns8-openldap"
[26]: https://github.com/NethServer/ns8-samba?utm_source=chatgpt.com "NethServer/ns8-samba"
[27]: https://github.com/NethServer/ns8-ldapproxy?utm_source=chatgpt.com "NethServer/ns8-ldapproxy: LDAP proxy based on nginx for ..."
[28]: https://github.com/NethServer/ns8-loki?utm_source=chatgpt.com "NethServer/ns8-loki: Loki configuration for NS8"
[29]: https://github.com/NethServer/ns8-repomd?utm_source=chatgpt.com "NethServer/ns8-repomd: NS8 modules index metadata ..."
[30]: https://github.com/NethServer/ns8-nethforge?utm_source=chatgpt.com "NethForge is where you can find extra modules built by the ..."
[31]: https://github.com/NethServer/ns8-kickstart?utm_source=chatgpt.com "NethServer/ns8-kickstart"
[32]: https://github.com/NethServer/nethserver-ns8-migration?utm_source=chatgpt.com "nethserver-ns8-migration"
[33]: https://community.nethserver.org/categories?utm_source=chatgpt.com "Categories - NethServer Community"
[34]: https://community.nethserver.org/tag/ns8?utm_source=chatgpt.com "Topics tagged ns8 - NethServer Community"
[35]: https://community.nethserver.org/tag/nethserver8?utm_source=chatgpt.com "Topics tagged nethserver8 - NethServer Community"
