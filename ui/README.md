# NS8 hermes-agent UI development

To develop hermes-agent UI please refer to [this section of the Developer manual](https://nethserver.github.io/ns8-core/ui/modules/#module-ui-development).

This UI is the cluster-admin surface for the module. It configures the existing NS8 actions and should not add a separate backend service. Keep Settings aligned with `configure-module`, `get-configuration`, `get-agent-runtime`, `list-user-domains`, and `list-domain-users`, and update translations whenever user-facing labels change.
