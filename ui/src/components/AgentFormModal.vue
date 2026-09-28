<!--
  Copyright (C) 2023 Nethesis S.r.l.
  SPDX-License-Identifier: GPL-3.0-or-later
-->
<template>
  <NsModal
    size="default"
    :visible="visible"
    :primary-button-disabled="loading"
    :isLoading="loading"
    @modal-hidden="$emit('hidden')"
    @primary-click="$emit('submit')"
  >
    <template slot="title">{{
      mode === "create"
        ? $t("settings.create_agent_title")
        : $t("settings.edit_agent_title")
    }}</template>
    <template slot="content">
      <cv-form @submit.prevent="$emit('submit')">
        <NsTextInput
          :value="value.name"
          :label="$t('settings.agent_name')"
          :placeholder="$t('settings.agent_name_placeholder')"
          :invalid-message="errors.name"
          :disabled="loading"
          data-modal-primary-focus
          ref="name"
          @input="update('name', $event)"
        />
        <cv-select
          :value="value.role"
          :label="$t('settings.role')"
          :invalid-message="errors.role"
          :disabled="loading"
          ref="role"
          class="mg-bottom-lg"
          @change="update('role', $event)"
        >
          <cv-select-option
            v-for="role in roles"
            :key="`${mode}-${role}`"
            :value="role"
          >
            {{ roleLabel(role) }}
          </cv-select-option>
        </cv-select>
        <cv-select
          :value="value.allowed_user"
          :label="$t('settings.allowed_user')"
          :invalid-message="errors.allowedUser"
          :disabled="loading || allowedUserDisabled"
          ref="allowedUser"
          class="mg-bottom-lg"
          @change="update('allowed_user', $event)"
        >
          <cv-select-option value="">
            {{ allowedUserPlaceholder }}
          </cv-select-option>
          <cv-select-option
            v-for="userRecord in domainUsers"
            :key="`${mode}-${userRecord.user}`"
            :value="userRecord.user"
          >
            {{ userLabel(userRecord) }}
          </cv-select-option>
        </cv-select>
        <p class="section-description mg-bottom-lg">
          {{ $t("settings.allowed_user_description") }}
        </p>
        <NsInlineNotification
          v-if="domainUsersError"
          kind="warning"
          :title="$t('action.list-domain-users')"
          :description="domainUsersError"
          :showCloseButton="false"
        />
        <NsInlineNotification
          v-if="submitError"
          kind="error"
          :title="$t('action.configure-module')"
          :description="submitError"
          :showCloseButton="false"
        />
      </cv-form>
    </template>
    <template slot="secondary-button">{{ cancelLabel }}</template>
    <template slot="primary-button">{{
      mode === "create" ? $t("settings.create_agent") : $t("settings.save")
    }}</template>
  </NsModal>
</template>

<script>
import { UtilService } from "@nethserver/ns8-ui-lib";
import { domainUserLabel } from "../lib/agents";

// One modal for both creating and editing an agent; the parent owns the form
// state (v-model) and validation, this component only renders and focuses.
export default {
  name: "AgentFormModal",
  mixins: [UtilService],
  props: {
    visible: { type: Boolean, default: false },
    mode: { type: String, default: "create" },
    value: {
      type: Object,
      default: () => ({ name: "", role: "default", allowed_user: "" }),
    },
    roles: { type: Array, default: () => [] },
    domainUsers: { type: Array, default: () => [] },
    errors: {
      type: Object,
      default: () => ({ name: "", role: "", allowedUser: "" }),
    },
    loading: { type: Boolean, default: false },
    allowedUserDisabled: { type: Boolean, default: false },
    allowedUserPlaceholder: { type: String, default: "" },
    domainUsersError: { type: String, default: "" },
    submitError: { type: String, default: "" },
    cancelLabel: { type: String, default: "" },
    roleLabel: { type: Function, required: true },
  },
  methods: {
    update(field, fieldValue) {
      this.$emit("input", { ...this.value, [field]: fieldValue });
    },
    userLabel(userRecord) {
      return domainUserLabel(
        userRecord,
        this.$t("settings.allowed_user_locked_suffix"),
      );
    },
    focusFirstInvalid() {
      const order = ["name", "role", "allowedUser"];
      const first = order.find((field) => this.errors[field]);
      if (first) {
        this.$nextTick(() => this.focusElement(first));
      }
    },
    focusName() {
      this.$nextTick(() => this.focusElement("name"));
    },
  },
};
</script>

<style scoped lang="scss">
@import "../styles/carbon-utils";

.section-description {
  margin: 0;
  color: $text-secondary;
  max-width: 36rem;
}
</style>
