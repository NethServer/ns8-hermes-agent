<!--
  Copyright (C) 2023 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <div>
    <cv-grid fullWidth>
      <cv-row>
        <cv-column class="page-title">
          <h2>{{ $t("settings.title") }}</h2>
        </cv-column>
      </cv-row>
      <cv-row v-if="error.getConfiguration">
        <cv-column>
          <NsInlineNotification
            kind="error"
            :title="$t('action.get-configuration')"
            :description="error.getConfiguration"
            :showCloseButton="false"
          />
        </cv-column>
      </cv-row>
      <cv-row>
        <cv-column>
          <cv-tile light>
            <cv-grid class="no-padding">
              <cv-row class="toolbar-row">
                <cv-column :md="6" :max="8">
                  <h4 class="section-title">
                    {{ $t("settings.agents_title") }}
                  </h4>
                  <p class="section-description">
                    {{ $t("settings.agents_description") }}
                  </p>
                  <p v-if="isAgentLimitReached" class="section-description">
                    {{
                      $t("settings.agent_limit_reached", { count: maxAgents })
                    }}
                  </p>
                  <NsInlineNotification
                    v-if="hasInvalidAgentState"
                    kind="error"
                    :title="$t('settings.invalid_agent_state_title')"
                    :description="
                      $t('settings.invalid_agent_state_description', {
                        directories: invalidAgentDirectories,
                      })
                    "
                    :showCloseButton="false"
                  />
                  <NsInlineNotification
                    v-if="hasUnknownRoles"
                    kind="warning"
                    :title="$t('settings.unknown_role_title')"
                    :description="$t('settings.unknown_role_blocks_save')"
                    :showCloseButton="false"
                  />
                </cv-column>
                <cv-column :md="2" :max="8" class="toolbar-actions">
                  <NsButton
                    kind="secondary"
                    :icon="Add20"
                    :disabled="
                      loading.getConfiguration ||
                      loading.configureModule ||
                      isAgentLimitReached
                    "
                    @click="showCreateAgentModal"
                  >
                    {{ $t("settings.create_agent") }}
                  </NsButton>
                </cv-column>
              </cv-row>
              <cv-row>
                <cv-column :md="6" :max="8">
                  <NsTextInput
                    v-model.trim="baseVirtualhost"
                    :label="$t('settings.base_virtualhost')"
                    :placeholder="$t('settings.base_virtualhost_placeholder')"
                    :invalid-message="error.baseVirtualhost"
                    :disabled="
                      loading.getConfiguration || loading.configureModule
                    "
                    ref="baseVirtualhost"
                  />
                  <p class="section-description">
                    {{ $t("settings.base_virtualhost_description") }}
                  </p>
                  <cv-select
                    v-model="userDomain"
                    :label="$t('settings.user_domain')"
                    :invalid-message="error.userDomain"
                    :disabled="
                      loading.getConfiguration ||
                      loading.configureModule ||
                      loading.listUserDomains
                    "
                    ref="userDomain"
                    class="mg-bottom-lg"
                    @change="onUserDomainChanged"
                  >
                    <cv-select-option value="">
                      {{ $t("settings.user_domain_placeholder") }}
                    </cv-select-option>
                    <cv-select-option
                      v-for="domain in userDomains"
                      :key="domain.name"
                      :value="domain.name"
                    >
                      {{ domainLabel(domain) }}
                    </cv-select-option>
                  </cv-select>
                  <p class="section-description">
                    {{ $t("settings.user_domain_description") }}
                  </p>
                  <NsInlineNotification
                    v-if="error.listUserDomains"
                    kind="warning"
                    :title="$t('action.list-user-domains')"
                    :description="error.listUserDomains"
                    :showCloseButton="false"
                  />
                  <NsToggle
                    value="letsEncrypt"
                    :label="$t('settings.request_le_certificates')"
                    v-model="letsEncrypt"
                    :disabled="
                      loading.getConfiguration || loading.configureModule
                    "
                  >
                    <template #tooltip>
                      <div class="mg-bottom-sm">
                        {{ $t("settings.request_le_certificates_tooltip") }}
                      </div>
                      <div class="mg-bottom-sm">
                        <cv-link @click="goToCertificates">
                          {{
                            core.$t("apps_lets_encrypt.go_to_tls_certificates")
                          }}
                        </cv-link>
                      </div>
                    </template>
                    <template slot="text-left">{{
                      core.$t("common.disabled")
                    }}</template>
                    <template slot="text-right">{{
                      core.$t("common.enabled")
                    }}</template>
                  </NsToggle>
                  <NsInlineNotification
                    v-if="isLetsEncryptCurrentlyEnabled && !letsEncrypt"
                    kind="warning"
                    :title="
                      core.$t('apps_lets_encrypt.lets_encrypt_disabled_warning')
                    "
                    :description="
                      $t(
                        'settings.request_le_certificates_disabled_warning_description',
                      )
                    "
                    :showCloseButton="false"
                  />
                </cv-column>
              </cv-row>
              <cv-row>
                <cv-column>
                  <cv-skeleton-text
                    v-if="loading.getConfiguration"
                    :paragraph="true"
                    :line-count="6"
                  ></cv-skeleton-text>
                  <NsEmptyState
                    v-else-if="!agents.length"
                    :title="$t('settings.no_agents')"
                  ></NsEmptyState>
                  <cv-structured-list v-else>
                    <template slot="headings">
                      <cv-structured-list-heading>
                        {{ $t("settings.agent_name") }}
                      </cv-structured-list-heading>
                      <cv-structured-list-heading>
                        {{ $t("settings.role") }}
                      </cv-structured-list-heading>
                      <cv-structured-list-heading>
                        {{ $t("settings.status") }}
                      </cv-structured-list-heading>
                      <cv-structured-list-heading>
                        {{ $t("settings.allowed_user") }}
                      </cv-structured-list-heading>
                      <cv-structured-list-heading>
                        {{ $t("settings.dashboard") }}
                      </cv-structured-list-heading>
                      <cv-structured-list-heading>
                        {{ $t("settings.actions") }}
                      </cv-structured-list-heading>
                    </template>
                    <template slot="items">
                      <cv-structured-list-item
                        v-for="agentData in agents"
                        :key="agentData.id"
                      >
                        <cv-structured-list-data class="break-word">
                          {{ agentData.name }}
                        </cv-structured-list-data>
                        <cv-structured-list-data>
                          {{ roleLabel(agentData.role) }}
                        </cv-structured-list-data>
                        <cv-structured-list-data>
                          <cv-tag
                            :kind="statusKind(agentData.status)"
                            size="sm"
                            :label="statusLabel(agentData.status)"
                            class="no-margin"
                          ></cv-tag>
                        </cv-structured-list-data>
                        <cv-structured-list-data class="break-word">
                          {{
                            agentData.allowed_user ||
                            $t("settings.allowed_user_not_set")
                          }}
                        </cv-structured-list-data>
                        <cv-structured-list-data class="break-word">
                          <cv-link
                            v-if="agentDashboardUrl(agentData)"
                            :href="agentDashboardUrl(agentData)"
                            target="_blank"
                          >
                            {{ agentDashboardUrl(agentData) }}
                          </cv-link>
                          <span v-else>{{
                            $t("settings.dashboard_not_configured")
                          }}</span>
                        </cv-structured-list-data>
                        <cv-structured-list-data
                          class="table-overflow-menu-cell"
                        >
                          <cv-overflow-menu
                            flip-menu
                            class="table-overflow-menu"
                          >
                            <cv-overflow-menu-item
                              @click="showEditAgentModal(agentData)"
                            >
                              <NsMenuItem
                                :icon="Edit20"
                                :label="$t('settings.edit_agent')"
                              />
                            </cv-overflow-menu-item>
                            <cv-overflow-menu-item
                              :disabled="agentData.status === 'start'"
                              @click="setAgentStatus(agentData.id, 'start')"
                            >
                              <NsMenuItem
                                :icon="Play20"
                                :label="$t('settings.start_agent')"
                              />
                            </cv-overflow-menu-item>
                            <cv-overflow-menu-item
                              :disabled="agentData.status === 'stop'"
                              @click="setAgentStatus(agentData.id, 'stop')"
                            >
                              <NsMenuItem
                                :icon="Stop20"
                                :label="$t('settings.stop_agent')"
                              />
                            </cv-overflow-menu-item>
                            <cv-overflow-menu-item
                              danger
                              @click="showDeleteAgentModal(agentData)"
                            >
                              <NsMenuItem
                                :icon="TrashCan20"
                                :label="$t('settings.delete_agent')"
                              />
                            </cv-overflow-menu-item>
                          </cv-overflow-menu>
                        </cv-structured-list-data>
                      </cv-structured-list-item>
                    </template>
                  </cv-structured-list>
                </cv-column>
              </cv-row>
              <cv-row v-if="showPageConfigureError">
                <cv-column>
                  <NsInlineNotification
                    kind="error"
                    :title="$t('action.configure-module')"
                    :description="error.configureModule"
                    :showCloseButton="false"
                  />
                </cv-column>
              </cv-row>
              <cv-row class="footer-actions-row">
                <cv-column class="footer-actions-column">
                  <NsButton
                    kind="primary"
                    :icon="Save20"
                    :loading="
                      loading.configureModule && configureMode === 'page'
                    "
                    :disabled="
                      loading.getConfiguration || loading.configureModule
                    "
                    @click="saveAgentsFromPage"
                  >
                    {{ $t("settings.save") }}
                  </NsButton>
                </cv-column>
              </cv-row>
            </cv-grid>
          </cv-tile>
        </cv-column>
      </cv-row>
    </cv-grid>

    <AgentFormModal
      ref="agentFormModal"
      v-model="agentForm"
      :visible="isShownAgentModal"
      :mode="agentModalMode"
      :roles="roles"
      :domain-users="domainUsers"
      :errors="agentFormErrors"
      :loading="loading.configureModule && isAgentModalBusy"
      :allowed-user-disabled="allowedUserDisabled"
      :allowed-user-placeholder="allowedUserPlaceholder"
      :domain-users-error="normalizeUserDomain() ? error.listDomainUsers : ''"
      :submit-error="showAgentModalError ? error.configureModule : ''"
      :cancel-label="core.$t('common.cancel')"
      :role-label="roleLabel"
      @submit="submitAgentForm"
      @hidden="hideAgentModal"
    />

    <NsModal
      size="default"
      kind="danger"
      :visible="isShownDeleteAgentModal"
      :primary-button-disabled="loading.configureModule"
      :isLoading="loading.configureModule && configureMode === 'delete'"
      @modal-hidden="hideDeleteAgentModal"
      @primary-click="deleteAgent"
    >
      <template slot="title">
        {{
          $t("settings.delete_agent_title", {
            name: agentToDelete ? agentToDelete.name : "",
          })
        }}
      </template>
      <template slot="content">
        <p>
          {{
            $t("settings.delete_agent_description", {
              name: agentToDelete ? agentToDelete.name : "",
            })
          }}
        </p>
        <NsInlineNotification
          v-if="showDeleteAgentError"
          kind="error"
          :title="$t('action.configure-module')"
          :description="error.configureModule"
          :showCloseButton="false"
        />
      </template>
      <template slot="secondary-button">{{
        core.$t("common.cancel")
      }}</template>
      <template slot="primary-button">{{
        $t("settings.delete_agent")
      }}</template>
    </NsModal>
  </div>
</template>

<script>
import to from "await-to-js";
import { mapState } from "vuex";
import {
  QueryParamService,
  UtilService,
  TaskService,
  IconService,
  PageTitleService,
} from "@nethserver/ns8-ui-lib";
import AgentFormModal from "../components/AgentFormModal";
import {
  BASE_VIRTUALHOST_PATTERN,
  FALLBACK_MAX_AGENTS,
  FALLBACK_ROLES,
  agentDashboardUrl,
  buildAgentPayload,
  domainLabel,
  emptyAgentForm,
  isValidForm,
  mapValidationErrors,
  nextAgentId,
  normalizeAgents,
  normalizeAllowedUser,
  normalizeDomainUsers,
  normalizeHostname,
  normalizeUserDomains,
  sanitizeAllowedUsers,
  unknownRoleAgents,
  validateAgentForm,
} from "../lib/agents";

// Error codes produced by src/lib/agents.js and by configure-module
// validation-failed records, mapped to translation keys.
const ERROR_MESSAGE_KEYS = {
  required: "common.required",
  agent_name_invalid: "settings.agent_name_invalid",
  agent_role_invalid: "settings.agent_role_invalid",
  allowed_user_required: "settings.allowed_user_required",
  allowed_user_duplicated: "settings.allowed_user_invalid",
  allowed_user_invalid: "settings.allowed_user_invalid",
  user_domain_required: "settings.user_domain_required",
  user_domain_invalid: "settings.user_domain_invalid",
  base_virtualhost_invalid: "settings.base_virtualhost_invalid",
};

export default {
  name: "Settings",
  components: { AgentFormModal },
  mixins: [
    TaskService,
    IconService,
    UtilService,
    QueryParamService,
    PageTitleService,
  ],
  pageTitle() {
    return this.$t("settings.title") + " - " + this.appName;
  },
  data() {
    return {
      q: {
        page: "settings",
      },
      urlCheckInterval: null,
      baseVirtualhost: "",
      userDomain: "",
      letsEncrypt: false,
      isLetsEncryptCurrentlyEnabled: false,
      // Fallbacks only: get-configuration publishes the authoritative values.
      maxAgents: FALLBACK_MAX_AGENTS,
      roles: FALLBACK_ROLES.slice(),
      userDomains: [],
      domainUsers: [],
      agents: [],
      invalidAgents: [],
      configureMode: "",
      isShownAgentModal: false,
      agentModalMode: "create",
      agentToEdit: null,
      agentForm: emptyAgentForm(),
      agentFormErrors: { name: "", role: "", allowedUser: "" },
      isShownDeleteAgentModal: false,
      agentToDelete: null,
      loading: {
        getConfiguration: false,
        configureModule: false,
        listUserDomains: false,
        listDomainUsers: false,
      },
      error: {
        getConfiguration: "",
        configureModule: "",
        baseVirtualhost: "",
        userDomain: "",
        listUserDomains: "",
        listDomainUsers: "",
      },
    };
  },
  computed: {
    ...mapState(["instanceName", "core", "appName"]),
    normalizedBaseVirtualhost() {
      return normalizeHostname(this.baseVirtualhost);
    },
    isPublishing() {
      return !!this.normalizedBaseVirtualhost;
    },
    allowedUserDisabled() {
      return (
        this.loading.listDomainUsers ||
        !this.normalizeUserDomain() ||
        !this.isPublishing
      );
    },
    allowedUserPlaceholder() {
      if (!this.isPublishing) {
        return this.$t("settings.allowed_user_not_required");
      }
      if (!this.normalizeUserDomain()) {
        return this.$t("settings.allowed_user_select_domain_first");
      }
      if (this.loading.listDomainUsers) {
        return this.$t("common.processing");
      }
      return this.$t("settings.allowed_user_placeholder");
    },
    isAgentModalBusy() {
      return ["create", "edit"].includes(this.configureMode);
    },
    showPageConfigureError() {
      return this.configureMode === "page" && !!this.error.configureModule;
    },
    showAgentModalError() {
      return this.isAgentModalBusy && !!this.error.configureModule;
    },
    showDeleteAgentError() {
      return this.configureMode === "delete" && !!this.error.configureModule;
    },
    isAgentLimitReached() {
      return this.agents.length >= this.maxAgents;
    },
    unknownRoleAgents() {
      return unknownRoleAgents(this.agents, this.roles);
    },
    hasUnknownRoles() {
      return this.unknownRoleAgents.length > 0;
    },
    hasInvalidAgentState() {
      return this.invalidAgents.length > 0;
    },
    invalidAgentDirectories() {
      return this.invalidAgents.map((entry) => entry.directory).join(", ");
    },
  },
  beforeRouteEnter(to, from, next) {
    next((vm) => {
      vm.watchQueryData(vm);
      vm.urlCheckInterval = vm.initUrlBindingForApp(vm, vm.q.page);
    });
  },
  beforeRouteLeave(to, from, next) {
    clearInterval(this.urlCheckInterval);
    next();
  },
  created() {
    this.getConfiguration();
  },
  methods: {
    message(code) {
      return code ? this.$t(ERROR_MESSAGE_KEYS[code] || code) : "";
    },
    translateFormErrors(codes) {
      return {
        name: this.message(codes.name),
        role: this.message(codes.role),
        allowedUser: this.message(codes.allowedUser),
      };
    },
    async getConfiguration() {
      this.loading.getConfiguration = true;
      this.error.getConfiguration = "";
      const taskAction = "get-configuration";
      const eventId = this.getUuid();

      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.getConfigurationAborted,
      );
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.getConfigurationCompleted,
      );

      const res = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          extra: {
            title: this.$t("action." + taskAction),
            isNotificationHidden: true,
            eventId,
          },
        }),
      );
      const err = res[0];

      if (err) {
        this.error.getConfiguration = this.getErrorMessage(err);
        this.loading.getConfiguration = false;
      }
    },
    getConfigurationAborted() {
      this.error.getConfiguration = this.$t("error.generic_error");
      this.loading.getConfiguration = false;
    },
    getConfigurationCompleted(taskContext, taskResult) {
      this.loading.getConfiguration = false;
      const config = taskResult.output;

      if (Array.isArray(config.roles) && config.roles.length) {
        this.roles = config.roles.slice();
      }
      if (Number.isInteger(config.max_agents) && config.max_agents > 0) {
        this.maxAgents = config.max_agents;
      }

      this.baseVirtualhost = normalizeHostname(config.base_virtualhost);
      this.userDomain = normalizeHostname(config.user_domain);
      this.letsEncrypt = !!config.lets_encrypt;
      this.isLetsEncryptCurrentlyEnabled = !!config.lets_encrypt;
      this.agents = normalizeAgents(config.agents);
      this.invalidAgents = Array.isArray(config.invalid_agents)
        ? config.invalid_agents
        : [];
      this.loadUserDomains();
      this.loadDomainUsers(this.userDomain);
    },
    configureModuleValidationFailed(validationErrors) {
      this.loading.configureModule = false;
      const mapped = mapValidationErrors(validationErrors);

      this.error.baseVirtualhost = this.message(mapped.baseVirtualhost);
      this.error.userDomain = this.message(mapped.userDomain);
      if (this.isAgentModalBusy) {
        this.agentFormErrors = this.translateFormErrors(mapped.form);
        this.$refs.agentFormModal.focusFirstInvalid();
      }
      if (mapped.baseVirtualhost) {
        this.focusElement("baseVirtualhost");
      } else if (mapped.userDomain) {
        this.focusElement("userDomain");
      }

      this.error.configureModule = this.$t("error.validation_error");
    },
    validateBaseVirtualhost() {
      const value = this.normalizedBaseVirtualhost;
      if (value && !BASE_VIRTUALHOST_PATTERN.test(value)) {
        this.error.baseVirtualhost = this.message("base_virtualhost_invalid");
        this.focusElement("baseVirtualhost");
        return false;
      }
      return true;
    },
    validateUserDomain(nextAgents) {
      if (!this.isPublishing || !nextAgents.length) {
        return true;
      }
      if (!this.normalizeUserDomain()) {
        this.error.userDomain = this.message("user_domain_required");
        this.focusElement("userDomain");
        return false;
      }
      return true;
    },
    async saveAgents(nextAgents, mode) {
      this.error.baseVirtualhost = "";
      this.error.userDomain = "";
      this.configureMode = mode;

      if (this.hasUnknownRoles) {
        // Saving resubmits the full agent list and the backend would reject
        // it; never let a UI/backend version skew alter agents.
        this.error.configureModule = this.$t(
          "settings.unknown_role_blocks_save",
        );
        return;
      }
      if (this.hasInvalidAgentState) {
        // The backend refuses too (agent_state_invalid); fail fast here.
        this.error.configureModule = this.$t(
          "settings.invalid_agent_state_description",
          { directories: this.invalidAgentDirectories },
        );
        return;
      }
      if (
        !this.validateBaseVirtualhost() ||
        !this.validateUserDomain(nextAgents)
      ) {
        this.error.configureModule = this.$t("error.validation_error");
        return;
      }

      this.loading.configureModule = true;
      this.error.configureModule = "";
      const taskAction = "configure-module";
      const eventId = this.getUuid();

      this.core.$root.$once(
        `${taskAction}-aborted-${eventId}`,
        this.configureModuleAborted,
      );
      this.core.$root.$once(
        `${taskAction}-validation-failed-${eventId}`,
        this.configureModuleValidationFailed,
      );
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        this.configureModuleCompleted,
      );

      const res = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          data: {
            base_virtualhost: this.normalizedBaseVirtualhost,
            user_domain: this.normalizeUserDomain(),
            lets_encrypt: this.letsEncrypt,
            agents: buildAgentPayload(normalizeAgents(nextAgents)),
          },
          extra: {
            title: this.$t("settings.configure_instance", {
              instance: this.instanceName,
            }),
            description: this.$t("common.processing"),
            eventId,
          },
        }),
      );
      const err = res[0];

      if (err) {
        this.error.configureModule = this.getErrorMessage(err);
        this.loading.configureModule = false;
      }
    },
    configureModuleAborted() {
      this.error.configureModule = this.$t("error.generic_error");
      this.loading.configureModule = false;
    },
    configureModuleCompleted() {
      this.loading.configureModule = false;
      this.error.configureModule = "";
      this.isShownAgentModal = false;
      this.isShownDeleteAgentModal = false;
      this.agentToEdit = null;
      this.agentToDelete = null;
      this.resetAgentForm();
      this.getConfiguration();
    },
    normalizeUserDomain(value = this.userDomain) {
      return normalizeHostname(value);
    },
    domainLabel(domainData) {
      return domainLabel(domainData);
    },
    agentDashboardUrl(agentData) {
      return agentDashboardUrl(this.baseVirtualhost, agentData);
    },
    roleLabel(role) {
      const key = `settings.role_${role}`;
      if (this.roles.includes(role) && this.$te(key)) {
        return this.$t(key);
      }
      return this.$t("settings.role_unknown", { role });
    },
    statusKind(status) {
      return status === "stop" ? "high-contrast" : "green";
    },
    statusLabel(status) {
      return this.$t(`settings.status_${status}`);
    },
    resetAgentForm() {
      this.agentForm = emptyAgentForm();
      this.agentFormErrors = { name: "", role: "", allowedUser: "" };
    },
    showCreateAgentModal() {
      this.resetAgentForm();
      this.agentToEdit = null;
      this.agentModalMode = "create";
      this.error.configureModule = "";
      this.configureMode = "";
      this.isShownAgentModal = true;
    },
    showEditAgentModal(agentData) {
      this.resetAgentForm();
      this.agentToEdit = agentData;
      this.agentModalMode = "edit";
      this.agentForm = {
        name: agentData.name,
        role: agentData.role,
        allowed_user: normalizeAllowedUser(agentData.allowed_user),
      };
      this.error.configureModule = "";
      this.configureMode = "";
      this.isShownAgentModal = true;
    },
    hideAgentModal() {
      if (this.loading.configureModule && this.isAgentModalBusy) {
        return;
      }
      this.isShownAgentModal = false;
      this.agentToEdit = null;
      this.resetAgentForm();
      if (this.isAgentModalBusy) {
        this.configureMode = "";
        this.error.configureModule = "";
      }
    },
    submitAgentForm() {
      const isEdit = this.agentModalMode === "edit";
      if (isEdit && !this.agentToEdit) {
        return;
      }

      this.error.configureModule = "";
      this.error.userDomain = "";
      const codes = validateAgentForm(this.agentForm, {
        roles: this.roles,
        agents: this.agents,
        excludedAgentId: isEdit ? this.agentToEdit.id : null,
        publishing: this.isPublishing,
        userDomain: this.userDomain,
      });
      this.agentFormErrors = this.translateFormErrors(codes);
      if (codes.userDomain) {
        this.error.userDomain = this.message(codes.userDomain);
      }
      if (!isValidForm(codes)) {
        if (codes.userDomain && !codes.name && !codes.role) {
          this.focusElement("userDomain");
        } else {
          this.$refs.agentFormModal.focusFirstInvalid();
        }
        return;
      }

      const trimmedName = this.agentForm.name.trim();
      const allowedUser = normalizeAllowedUser(this.agentForm.allowed_user);

      if (isEdit) {
        const nextAgents = this.agents.map((agentData) =>
          agentData.id === this.agentToEdit.id
            ? {
                ...agentData,
                name: trimmedName,
                role: this.agentForm.role,
                allowed_user: allowedUser,
              }
            : agentData,
        );
        this.saveAgents(nextAgents, "edit");
        return;
      }

      const nextId = nextAgentId(this.agents, this.maxAgents);
      if (!nextId) {
        this.configureMode = "create";
        this.error.configureModule = this.$t("settings.agent_limit_reached", {
          count: this.maxAgents,
        });
        return;
      }
      this.saveAgents(
        [
          ...this.agents,
          {
            id: nextId,
            name: trimmedName,
            role: this.agentForm.role,
            status: "start",
            allowed_user: allowedUser,
          },
        ],
        "create",
      );
    },
    showDeleteAgentModal(agentData) {
      this.agentToDelete = agentData;
      this.error.configureModule = "";
      this.configureMode = "";
      this.isShownDeleteAgentModal = true;
    },
    hideDeleteAgentModal() {
      if (this.loading.configureModule && this.configureMode === "delete") {
        return;
      }
      this.isShownDeleteAgentModal = false;
      this.agentToDelete = null;
      if (this.configureMode === "delete") {
        this.configureMode = "";
        this.error.configureModule = "";
      }
    },
    deleteAgent() {
      if (!this.agentToDelete) {
        return;
      }
      const nextAgents = this.agents.filter(
        (agentData) => agentData.id !== this.agentToDelete.id,
      );
      this.saveAgents(nextAgents, "delete");
    },
    setAgentStatus(agentId, status) {
      this.error.configureModule = "";
      this.agents = this.agents.map((agentData) =>
        agentData.id === agentId ? { ...agentData, status } : agentData,
      );
    },
    saveAgentsFromPage() {
      this.saveAgents(this.agents, "page");
    },
    goToCertificates() {
      this.core.$router.push("/settings/tls-certificates");
    },
    clearAllowedUsers() {
      this.agents = this.agents.map((agentData) => ({
        ...agentData,
        allowed_user: "",
      }));
      this.agentForm = { ...this.agentForm, allowed_user: "" };
      this.agentFormErrors = { ...this.agentFormErrors, allowedUser: "" };
    },
    onUserDomainChanged() {
      this.userDomain = this.normalizeUserDomain();
      this.error.userDomain = "";
      this.error.listDomainUsers = "";
      this.clearAllowedUsers();
      this.loadDomainUsers(this.userDomain);
    },
    async loadUserDomains() {
      this.loading.listUserDomains = true;
      this.error.listUserDomains = "";
      const taskAction = "list-user-domains";
      const eventId = this.getUuid();

      this.core.$root.$once(`${taskAction}-aborted-${eventId}`, () => {
        this.error.listUserDomains = this.$t("error.generic_error");
        this.loading.listUserDomains = false;
      });
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        (taskContext, taskResult) => {
          this.userDomains = normalizeUserDomains(taskResult.output.domains);
          this.loading.listUserDomains = false;
        },
      );

      const res = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          data: {},
          extra: {
            title: this.$t(`action.${taskAction}`),
            isNotificationHidden: true,
            eventId,
          },
        }),
      );
      const err = res[0];

      if (err) {
        this.error.listUserDomains = this.getErrorMessage(err);
        this.loading.listUserDomains = false;
      }
    },
    async loadDomainUsers(domain) {
      const normalizedDomain = this.normalizeUserDomain(domain);
      this.domainUsers = [];
      this.error.listDomainUsers = "";

      if (!normalizedDomain) {
        return;
      }

      this.loading.listDomainUsers = true;
      const taskAction = "list-domain-users";
      const eventId = this.getUuid();

      this.core.$root.$once(`${taskAction}-aborted-${eventId}`, () => {
        if (normalizedDomain === this.normalizeUserDomain()) {
          this.error.listDomainUsers = this.$t("error.generic_error");
          this.loading.listDomainUsers = false;
        }
      });
      this.core.$root.$once(
        `${taskAction}-completed-${eventId}`,
        (taskContext, taskResult) => {
          if (normalizedDomain !== this.normalizeUserDomain()) {
            return;
          }
          this.domainUsers = normalizeDomainUsers(taskResult.output.users);
          this.loading.listDomainUsers = false;
          this.agents = sanitizeAllowedUsers(this.agents, this.domainUsers);
          const validUsers = new Set(this.domainUsers.map((u) => u.user));
          if (
            this.agentForm.allowed_user &&
            !validUsers.has(this.agentForm.allowed_user)
          ) {
            this.agentForm = { ...this.agentForm, allowed_user: "" };
          }
        },
      );

      const res = await to(
        this.createModuleTaskForApp(this.instanceName, {
          action: taskAction,
          data: {
            domain: normalizedDomain,
          },
          extra: {
            title: this.$t(`action.${taskAction}`),
            isNotificationHidden: true,
            eventId,
          },
        }),
      );
      const err = res[0];

      if (err && normalizedDomain === this.normalizeUserDomain()) {
        this.error.listDomainUsers = this.getErrorMessage(err);
        this.loading.listDomainUsers = false;
      }
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";

.toolbar-row {
  margin-bottom: $spacing-06;
}

.toolbar-actions {
  display: flex;
  justify-content: flex-end;
}

.section-title {
  margin-bottom: $spacing-03;
}

.section-description {
  margin: 0;
  color: $text-secondary;
  max-width: 36rem;
}

.table-overflow-menu-cell {
  width: 1%;
}

.footer-actions-row {
  margin-top: $spacing-07;
}

.footer-actions-column {
  display: flex;
  justify-content: flex-end;
}

.break-word {
  word-break: break-word;
}

@media (max-width: 671px) {
  .toolbar-actions {
    justify-content: flex-start;
    margin-top: $spacing-05;
  }
}
</style>
