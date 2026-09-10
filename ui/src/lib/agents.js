//
// Copyright (C) 2023 Nethesis S.r.l.
// SPDX-License-Identifier: GPL-3.0-or-later
//
// Pure helpers for the agent settings page. Everything here is framework-free
// so it can be unit tested without mounting Vue components. The validation
// constants mirror imageroot/pypkg/hermes_agent_state.py and are only
// fallbacks: get-configuration publishes the authoritative `roles` and
// `max_agents` values at runtime.

export const FALLBACK_ROLES = [
  "default",
  "developer",
  "marketing",
  "sales",
  "customer_support",
  "social_media_manager",
  "business_consultant",
  "researcher",
];

export const FALLBACK_MAX_AGENTS = 30;

export const AGENT_NAME_PATTERN = /^[A-Za-z ]+$/;

export const BASE_VIRTUALHOST_PATTERN =
  /^(?=.{1,253}$)(?:(?!-)[A-Za-z0-9-]{1,63}(?<!-)\.)+(?!-)[A-Za-z0-9-]{1,63}(?<!-)$/;

export function normalizeHostname(value) {
  return (value || "").trim().toLowerCase();
}

export function normalizeAllowedUser(value) {
  return (value || "").trim();
}

export function emptyAgentForm() {
  return { name: "", role: "default", allowed_user: "" };
}

// Keep every agent the backend reported, even ones this UI build does not
// fully understand: filtering here and then saving the filtered list would
// delete those agents server-side.
export function normalizeAgents(agents) {
  return (agents || [])
    .map((agentData) => ({
      id: Number(agentData.id),
      name: (agentData.name || "").trim(),
      role: agentData.role,
      status: agentData.status === "stop" ? "stop" : "start",
      allowed_user: normalizeAllowedUser(agentData.allowed_user),
    }))
    .sort((left, right) => left.id - right.id);
}

export function buildAgentPayload(agents) {
  return agents.map((agentData) => ({
    id: agentData.id,
    name: agentData.name,
    role: agentData.role,
    status: agentData.status,
    allowed_user: normalizeAllowedUser(agentData.allowed_user),
  }));
}

export function unknownRoleAgents(agents, roles) {
  return agents.filter((agentData) => !roles.includes(agentData.role));
}

export function nextAgentId(agents, maxAgents) {
  for (let candidateId = 1; candidateId <= maxAgents; candidateId++) {
    if (!agents.some((agentData) => agentData.id === candidateId)) {
      return candidateId;
    }
  }
  return null;
}

export function allowedUserInUse(agents, value, excludedAgentId = null) {
  const normalizedAllowedUser = normalizeAllowedUser(value);
  if (!normalizedAllowedUser) {
    return false;
  }
  return agents.some((agentData) => {
    if (excludedAgentId !== null && agentData.id === excludedAgentId) {
      return false;
    }
    return (
      normalizeAllowedUser(agentData.allowed_user) === normalizedAllowedUser
    );
  });
}

export function normalizeUserDomains(domains) {
  return (domains || [])
    .map((domainData) => ({
      name: normalizeHostname(domainData.name),
      schema: (domainData.schema || "").trim(),
      location: (domainData.location || "").trim(),
    }))
    .filter((domainData) => !!domainData.name)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function normalizeDomainUsers(users) {
  return (users || [])
    .map((userData) => {
      const displayName = Array.isArray(userData.display_name)
        ? userData.display_name.find((value) => !!value)
        : userData.display_name;
      return {
        user: normalizeAllowedUser(userData.user),
        display_name: (displayName || "").trim(),
        locked: userData.locked === true,
      };
    })
    .filter((userData) => !!userData.user)
    .sort((left, right) => left.user.localeCompare(right.user));
}

export function domainLabel(domainData) {
  const details = [domainData.schema, domainData.location].filter(Boolean);
  return details.length
    ? `${domainData.name} (${details.join(", ")})`
    : domainData.name;
}

export function domainUserLabel(userData, lockedSuffix) {
  const label =
    userData.display_name && userData.display_name !== userData.user
      ? `${userData.display_name} (${userData.user})`
      : userData.user;
  return userData.locked ? `${label} ${lockedSuffix}` : label;
}

// Drop allowed_user values that no longer exist in the loaded domain user list.
export function sanitizeAllowedUsers(agents, domainUsers) {
  const validUsers = new Set(domainUsers.map((userData) => userData.user));
  if (!validUsers.size) {
    return agents;
  }
  return agents.map((agentData) => {
    if (!agentData.allowed_user || validUsers.has(agentData.allowed_user)) {
      return agentData;
    }
    return { ...agentData, allowed_user: "" };
  });
}

/**
 * Validate one agent form the way configure-module will.
 *
 * Returns an object with `name`, `role` and `allowedUser` error codes
 * (empty string when valid). Callers translate the codes.
 */
export function validateAgentForm(form, context) {
  const {
    roles,
    agents,
    excludedAgentId = null,
    publishing,
    userDomain,
  } = context;
  const errors = { name: "", role: "", allowedUser: "", userDomain: "" };
  const trimmedName = (form.name || "").trim();

  if (!trimmedName) {
    errors.name = "required";
  } else if (!AGENT_NAME_PATTERN.test(trimmedName)) {
    errors.name = "agent_name_invalid";
  }

  if (!roles.includes(form.role)) {
    errors.role = "agent_role_invalid";
  }

  if (publishing) {
    if (!normalizeHostname(userDomain)) {
      errors.userDomain = "user_domain_required";
    } else if (!normalizeAllowedUser(form.allowed_user)) {
      errors.allowedUser = "allowed_user_required";
    } else if (allowedUserInUse(agents, form.allowed_user, excludedAgentId)) {
      errors.allowedUser = "allowed_user_duplicated";
    }
  }

  return errors;
}

export function isValidForm(errors) {
  return Object.values(errors).every((value) => !value);
}

/**
 * Map configure-module `validation-failed` records onto the page and form
 * error slots. `field` looks like `agents[2].allowed_user`, `base_virtualhost`
 * or `user_domain`.
 */
export function mapValidationErrors(validationErrors) {
  const mapped = {
    baseVirtualhost: "",
    userDomain: "",
    form: { name: "", role: "", allowedUser: "" },
  };

  for (const validationError of validationErrors || []) {
    const field = validationError.field || validationError.parameter || "";
    const code = validationError.error || "";

    if (field.endsWith("base_virtualhost")) {
      mapped.baseVirtualhost = "base_virtualhost_invalid";
    } else if (field === "user_domain") {
      mapped.userDomain =
        code === "user_domain_required"
          ? "user_domain_required"
          : "user_domain_invalid";
    } else if (field.endsWith(".name")) {
      mapped.form.name = "agent_name_invalid";
    } else if (field.endsWith(".role")) {
      mapped.form.role = "agent_role_invalid";
    } else if (field.endsWith(".allowed_user")) {
      mapped.form.allowedUser =
        code === "agent_allowed_user_required"
          ? "allowed_user_required"
          : "allowed_user_invalid";
    }
  }

  return mapped;
}

export function agentDashboardUrl(baseVirtualhost, agentData) {
  const normalizedBaseVirtualhost = normalizeHostname(baseVirtualhost);
  if (!normalizedBaseVirtualhost) {
    return "";
  }
  return `https://${normalizedBaseVirtualhost}/hermes-${agentData.id}/`;
}
