*** Settings ***
Library    Collections
Library    SSHLibrary

*** Variables ***
${TRAEFIK_ID}        traefik1
${LDAP_IMAGE}        ghcr.io/nethserver/openldap:latest
${USER_DOMAIN}       hermes.test
${DASHBOARD_HOST}    agents.example.test
${ALLOWED_USER}      alice
${USER_PASSWORD}     Nethesis,1234
${COOKIE_JAR}        /tmp/hermes-agent-test-cookies

*** Keywords ***
Run Module Action
    [Arguments]    ${module}    ${action}    ${payload}
    ${output}    ${rc} =    Execute Command    api-cli run module/${module}/${action} --data '${payload}'
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}    0    ${action} on ${module} failed: ${output}
    [Return]    ${output}

Module Action Should Fail
    [Arguments]    ${module}    ${action}    ${payload}
    ${output}    ${rc} =    Execute Command    api-cli run module/${module}/${action} --data '${payload}'
    ...    return_rc=True
    Should Not Be Equal As Integers    ${rc}    0    ${action} on ${module} unexpectedly succeeded: ${output}
    [Return]    ${output}

Run As Module User
    [Arguments]    ${command}
    ${output}    ${rc} =    Execute Command    runagent -m ${module_id} sh -lc '${command}'
    ...    return_rc=True
    [Return]    ${output}    ${rc}

Wait Until Agent Runtime Is Settled
    [Arguments]    ${agent_id}
    ${output}    ${rc} =    Run As Module User
    ...    for attempt in $(seq 1 60); do systemctl --user is-active --quiet hermes@${agent_id}.service && systemctl --user is-active --quiet hermes-socket@${agent_id}.service && podman pod exists hermes-pod-${agent_id} && podman container exists hermes-${agent_id} && podman container exists hermes-socket-${agent_id} && podman exec hermes-${agent_id} test -f /opt/data/SOUL.md && podman exec hermes-${agent_id} test -f /opt/data/.env && test -S ${state_dir}/dashboard-sockets/agent-${agent_id}.sock && exit 0; sleep 2; done; systemctl --user status hermes@${agent_id}.service hermes-socket@${agent_id}.service --no-pager; exit 1
    Should Be Equal As Integers    ${rc}    0    agent ${agent_id} runtime did not settle: ${output}

Wait Until Auth Proxy Is Active
    ${output}    ${rc} =    Run As Module User
    ...    for attempt in $(seq 1 60); do systemctl --user is-active --quiet hermes-auth.service && curl -fs -o /dev/null http://127.0.0.1:${tcp_port}/health && exit 0; sleep 2; done; systemctl --user status hermes-auth.service --no-pager; exit 1
    Should Be Equal As Integers    ${rc}    0    hermes-auth did not become healthy: ${output}

Agent Home Subdir Should Exist
    [Arguments]    ${agent_id}
    ${output}    ${rc} =    Run As Module User
    ...    podman unshare test -d "$(podman volume inspect --format {{.Mountpoint}} hermes-agents-home)/${agent_id}"
    Should Be Equal As Integers    ${rc}    0    /opt/agents/${agent_id} missing in hermes-agents-home

Agent Home Subdir Should Not Exist
    [Arguments]    ${agent_id}
    ${output}    ${rc} =    Run As Module User
    ...    podman unshare test ! -e "$(podman volume inspect --format {{.Mountpoint}} hermes-agents-home)/${agent_id}"
    Should Be Equal As Integers    ${rc}    0    /opt/agents/${agent_id} still present in hermes-agents-home

File Should Not Contain LDAP Keys
    [Arguments]    ${path}
    ${count} =    Execute Command    grep -c '^LDAP_' ${path} || true
    Should Be Equal    ${count}    0    ${path} must not expose LDAP settings to the agent

*** Test Cases ***
Check if hermes-agent is installed correctly
    ${output}  ${rc} =    Execute Command    add-module ${IMAGE_URL} 1
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    &{output} =    Evaluate    ${output}
    Set Suite Variable    ${module_id}    ${output.module_id}
    ${module_home} =    Execute Command    getent passwd ${module_id} | cut -d: -f6
    Set Suite Variable    ${module_home}    ${module_home}
    Set Suite Variable    ${state_dir}    ${module_home}/.config/state
    ${tcp_port} =    Execute Command    grep '^TCP_PORT=' ${state_dir}/environment | cut -d= -f2-
    Should Not Be Empty    ${tcp_port}    TCP_PORT must be reserved at install time
    Set Suite Variable    ${tcp_port}    ${tcp_port}

Check if install starts with no agent runtime
    ${active_units}    ${rc} =    Run As Module User    systemctl --user list-units "hermes@*.service" --state=active --no-legend | wc -l
    ${running_containers}    ${rc} =    Run As Module User    podman ps --format "{{.Names}}" | grep -Ec "^hermes-" || true
    Should Be Equal    ${active_units}    0
    Should Be Equal    ${running_containers}    0
    ${secrets_mode} =    Execute Command    stat -c %a ${state_dir}/secrets
    Should Be Equal    ${secrets_mode}    700
    ${legacy_secrets} =    Execute Command    test -e ${state_dir}/secrets.env && echo present || echo absent
    Should Be Equal    ${legacy_secrets}    absent

Check if configure with zero agents keeps module idle
    Run Module Action    ${module_id}    configure-module    {"agents":[]}
    ${output} =    Run Module Action    ${module_id}    get-configuration    {}
    ${config} =    Evaluate    json.loads(r'''${output}''')    json
    ${active_units}    ${rc} =    Run As Module User    systemctl --user list-units "hermes@*.service" --state=active --no-legend | wc -l
    Length Should Be    ${config['agents']}    0
    Should Be Equal    ${config['lets_encrypt']}    ${False}
    Should Be Equal    ${config['base_virtualhost']}    ${EMPTY}
    Should Be Equal    ${active_units}    0

Check if one started agent creates one runtime without publishing
    Run Module Action    ${module_id}    configure-module    {"agents":[{"id":1,"name":"Foo Bar","role":"developer","status":"start"}]}
    Wait Until Agent Runtime Is Settled    1

    ${output} =    Run Module Action    ${module_id}    get-configuration    {}
    ${config} =    Evaluate    json.loads(r'''${output}''')    json
    ${runtime_output} =    Run Module Action    ${module_id}    get-agent-runtime    {}
    ${runtime} =    Evaluate    json.loads(r'''${runtime_output}''')    json
    Should Be Equal    ${config['agents'][0]['status']}    start
    Should Be Equal    ${config['agents'][0]['allowed_user']}    ${EMPTY}
    Should Be Equal    ${runtime['agents'][0]['runtime_status']}    start

    # Generated state follows the documented layout.
    Execute Command    test -f ${state_dir}/agents/1/metadata.json && test -f ${state_dir}/agents/1/agent.env && test -f ${state_dir}/secrets/1.env && test -f ${state_dir}/secrets/shared.env    return_stdout=False
    ${legacy_files} =    Execute Command    find ${state_dir} -maxdepth 1 \\( -name 'agent_*.env' -o -name 'agent_*_secrets.env' -o -name 'secrets.env' \\) | wc -l
    Should Be Equal    ${legacy_files}    0
    ${agent_name_env} =    Execute Command    grep '^AGENT_NAME=' ${state_dir}/agents/1/agent.env | cut -d= -f2-
    ${agent_role_env} =    Execute Command    grep '^AGENT_ROLE=' ${state_dir}/agents/1/agent.env | cut -d= -f2-
    Should Be Equal    ${agent_name_env}    Foo Bar
    Should Be Equal    ${agent_role_env}    developer
    ${secret_key_count} =    Execute Command    grep -Ec '^(HERMES_AGENT_SECRET|API_SERVER_KEY)=' ${state_dir}/secrets/1.env
    Should Be Equal    ${secret_key_count}    2
    File Should Not Contain LDAP Keys    ${state_dir}/agents/1/agent.env
    File Should Not Contain LDAP Keys    ${state_dir}/secrets/1.env

    # One shared volume with a per-agent subdir, no per-agent volumes.
    ${output}    ${rc} =    Run As Module User    podman volume exists hermes-agents-home
    Should Be Equal As Integers    ${rc}    0
    ${output}    ${rc} =    Run As Module User    podman volume exists hermes-agent-1-home
    Should Not Be Equal As Integers    ${rc}    0
    Agent Home Subdir Should Exist    1

    # Exactly the Hermes container and its socket relay are running.
    ${running_containers}    ${rc} =    Run As Module User    podman ps --format "{{.Names}}" | grep -Ec "^hermes-(1|socket-1)$" || true
    Should Be Equal    ${running_containers}    2

    # No publishing: no shared auth service and no Traefik route.
    ${output}    ${rc} =    Run As Module User    systemctl --user is-active hermes-auth.service
    Should Not Be Equal As Integers    ${rc}    0
    ${route_output} =    Run Module Action    ${TRAEFIK_ID}    get-route    {"instance":"${module_id}-hermes-auth"}
    Should Be Equal    ${route_output}    {}

    ${soul_content}    ${rc} =    Run As Module User    podman exec hermes-1 cat /opt/data/SOUL.md
    ${home_env_content}    ${rc} =    Run As Module User    podman exec hermes-1 cat /opt/data/.env
    Should Contain    ${soul_content}    Your name is Foo Bar, you are an Hermes Agent that runs on NethServer8
    Should Contain    ${home_env_content}    AGENT_NAME=Foo Bar

Check if publishing without an allowed user is rejected
    ${output} =    Module Action Should Fail    ${module_id}    configure-module    {"base_virtualhost":"${DASHBOARD_HOST}","user_domain":"","lets_encrypt":false,"agents":[{"id":1,"name":"Foo Bar","role":"developer","status":"start"}]}
    Should Contain    ${output}    agent_allowed_user_required
    # The rejected request must not have touched the running agent.
    ${output}    ${rc} =    Run As Module User    systemctl --user is-active --quiet hermes@1.service
    Should Be Equal As Integers    ${rc}    0

Check if a user domain can be provisioned for dashboard login
    ${output}  ${rc} =    Execute Command    add-module ${LDAP_IMAGE} 1
    ...    return_rc=True
    Should Be Equal As Integers    ${rc}    0
    &{output} =    Evaluate    ${output}
    Set Suite Variable    ${ldap_id}    ${output.module_id}
    Run Module Action    ${ldap_id}    configure-module    {"provision":"new-domain","domain":"${USER_DOMAIN}","admuser":"admin","admpass":"${USER_PASSWORD}"}
    Run Module Action    ${ldap_id}    add-user    {"user":"${ALLOWED_USER}","display_name":"Alice Example","password":"${USER_PASSWORD}","groups":[]}

    ${domains_output} =    Run Module Action    ${module_id}    list-user-domains    {}
    ${domains} =    Evaluate    [d['name'] for d in json.loads(r'''${domains_output}''')['domains']]    json
    List Should Contain Value    ${domains}    ${USER_DOMAIN}
    ${users_output} =    Run Module Action    ${module_id}    list-domain-users    {"domain":"${USER_DOMAIN}"}
    ${users} =    Evaluate    [u['user'] for u in json.loads(r'''${users_output}''')['users']]    json
    List Should Contain Value    ${users}    ${ALLOWED_USER}

Check if publishing the dashboard creates the shared route and auth proxy
    Run Module Action    ${module_id}    configure-module    {"base_virtualhost":"${DASHBOARD_HOST}","user_domain":"${USER_DOMAIN}","lets_encrypt":false,"agents":[{"id":1,"name":"Foo Bar","role":"developer","status":"start","allowed_user":"${ALLOWED_USER}"}]}
    Wait Until Agent Runtime Is Settled    1
    Wait Until Auth Proxy Is Active

    ${output} =    Run Module Action    ${module_id}    get-configuration    {}
    ${config} =    Evaluate    json.loads(r'''${output}''')    json
    Should Be Equal    ${config['base_virtualhost']}    ${DASHBOARD_HOST}
    Should Be Equal    ${config['user_domain']}    ${USER_DOMAIN}
    Should Be Equal    ${config['agents'][0]['allowed_user']}    ${ALLOWED_USER}

    ${route_output} =    Run Module Action    ${TRAEFIK_ID}    get-route    {"instance":"${module_id}-hermes-auth"}
    ${route} =    Evaluate    json.loads(r'''${route_output}''')    json
    Should Be Equal    ${route['host']}    ${DASHBOARD_HOST}
    Should Be Equal    ${route['url']}    http://127.0.0.1:${tcp_port}
    Should Be Equal    ${route['lets_encrypt']}    ${False}

    # Auth runtime files exist; LDAP settings stay in the auth proxy files only.
    ${auth_files_rc} =    Execute Command    test -f ${state_dir}/authproxy.env && test -f ${state_dir}/authproxy_secrets.env && test -f ${state_dir}/authproxy/agents.json
    ...    return_rc=True    return_stdout=False
    Should Be Equal As Integers    ${auth_files_rc}    0    auth proxy runtime files are missing
    ${bind_dn_count} =    Execute Command    grep -c '^LDAP_BIND_DN=' ${state_dir}/authproxy_secrets.env
    Should Be Equal    ${bind_dn_count}    1
    File Should Not Contain LDAP Keys    ${state_dir}/agents/1/agent.env
    File Should Not Contain LDAP Keys    ${state_dir}/secrets/1.env

    # Login flow through the loopback listener Traefik forwards to.
    Execute Command    rm -f ${COOKIE_JAR}
    ${form_status} =    Execute Command    curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${tcp_port}/login
    Should Be Equal    ${form_status}    200
    ${anonymous_me} =    Execute Command    curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${tcp_port}/api/auth/me
    Should Be Equal    ${anonymous_me}    401
    ${bad_login} =    Execute Command    curl -s -o /dev/null -w '%{http_code}' -X POST --data-urlencode 'username=${ALLOWED_USER}' --data-urlencode 'password=wrong-password' --data-urlencode 'next=/' http://127.0.0.1:${tcp_port}/login
    Should Be Equal    ${bad_login}    401
    ${good_login} =    Execute Command    curl -s -o /dev/null -w '%{http_code}' -c ${COOKIE_JAR} -X POST --data-urlencode 'username=${ALLOWED_USER}' --data-urlencode 'password=${USER_PASSWORD}' --data-urlencode 'next=/' http://127.0.0.1:${tcp_port}/login
    Should Be Equal    ${good_login}    303
    ${me_output} =    Execute Command    curl -s -b ${COOKIE_JAR} http://127.0.0.1:${tcp_port}/api/auth/me
    ${me} =    Evaluate    json.loads(r'''${me_output}''')    json
    Should Be Equal    ${me['user_id']}    ${ALLOWED_USER}
    ${auth_log_count}    ${rc} =    Run As Module User    journalctl --user -u hermes-auth.service --no-pager | grep -c 'event=auth_success' || true
    Should Not Be Equal    ${auth_log_count}    0

Check if stopped agent disables runtime but keeps files
    Run Module Action    ${module_id}    configure-module    {"base_virtualhost":"${DASHBOARD_HOST}","user_domain":"${USER_DOMAIN}","lets_encrypt":false,"agents":[{"id":1,"name":"Foo Bar","role":"developer","status":"stop","allowed_user":"${ALLOWED_USER}"}]}
    ${output} =    Run Module Action    ${module_id}    get-configuration    {}
    ${config} =    Evaluate    json.loads(r'''${output}''')    json
    ${runtime_output} =    Run Module Action    ${module_id}    get-agent-runtime    {}
    ${runtime} =    Evaluate    json.loads(r'''${runtime_output}''')    json
    Should Be Equal    ${config['agents'][0]['status']}    stop
    Should Be Equal    ${runtime['agents'][0]['runtime_status']}    stop
    ${service_output}    ${service_rc} =    Run As Module User    systemctl --user is-active hermes@1.service
    Should Be Equal    ${service_output}    inactive
    ${output}    ${rc} =    Run As Module User    podman container exists hermes-1
    Should Not Be Equal As Integers    ${rc}    0
    ${output}    ${rc} =    Run As Module User    podman pod exists hermes-pod-1
    Should Not Be Equal As Integers    ${rc}    0
    Execute Command    test -f ${state_dir}/agents/1/metadata.json && test -f ${state_dir}/agents/1/agent.env && test -f ${state_dir}/secrets/1.env    return_stdout=False
    Agent Home Subdir Should Exist    1
    # A stopped agent has no login target: authentication must be refused.
    ${stopped_login} =    Execute Command    curl -s -o /dev/null -w '%{http_code}' -X POST --data-urlencode 'username=${ALLOWED_USER}' --data-urlencode 'password=${USER_PASSWORD}' --data-urlencode 'next=/' http://127.0.0.1:${tcp_port}/login
    Should Be Equal    ${stopped_login}    401

Check if deleting agent cleans runtime files
    Run Module Action    ${module_id}    configure-module    {"base_virtualhost":"${DASHBOARD_HOST}","user_domain":"${USER_DOMAIN}","lets_encrypt":false,"agents":[]}
    ${output} =    Run Module Action    ${module_id}    get-configuration    {}
    ${config} =    Evaluate    json.loads(r'''${output}''')    json
    Length Should Be    ${config['agents']}    0
    ${leftovers} =    Execute Command    ls -d ${state_dir}/agents/1 ${state_dir}/secrets/1.env ${state_dir}/dashboard-sockets/agent-1.sock 2>/dev/null | wc -l
    Should Be Equal    ${leftovers}    0
    Agent Home Subdir Should Not Exist    1
    ${output}    ${rc} =    Run As Module User    podman volume exists hermes-agents-home
    Should Be Equal As Integers    ${rc}    0    the shared volume must survive agent deletion
    # With no agents left the shared route and auth service are removed.
    ${route_output} =    Run Module Action    ${TRAEFIK_ID}    get-route    {"instance":"${module_id}-hermes-auth"}
    Should Be Equal    ${route_output}    {}
    ${output}    ${rc} =    Run As Module User    systemctl --user is-active hermes-auth.service
    Should Not Be Equal As Integers    ${rc}    0

Check if hermes-agent can be removed cleanly
    ${rc} =    Execute Command    remove-module --no-preserve ${module_id}
    ...    return_rc=True  return_stdout=False
    Should Be Equal As Integers    ${rc}    0
    ${module_home_exists_rc} =    Execute Command    test -e ${module_home}
    ...    return_rc=True  return_stdout=False
    Should Not Be Equal As Integers    ${module_home_exists_rc}    0
    ${route_output} =    Run Module Action    ${TRAEFIK_ID}    get-route    {"instance":"${module_id}-hermes-auth"}
    Should Be Equal    ${route_output}    {}
    ${rc} =    Execute Command    remove-module --no-preserve ${ldap_id}
    ...    return_rc=True  return_stdout=False
    Should Be Equal As Integers    ${rc}    0
