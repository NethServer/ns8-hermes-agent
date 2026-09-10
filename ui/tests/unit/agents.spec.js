import {
  FALLBACK_MAX_AGENTS,
  FALLBACK_ROLES,
  agentDashboardUrl,
  allowedUserInUse,
  buildAgentPayload,
  domainLabel,
  domainUserLabel,
  mapValidationErrors,
  nextAgentId,
  normalizeAgents,
  normalizeDomainUsers,
  normalizeUserDomains,
  sanitizeAllowedUsers,
  unknownRoleAgents,
  validateAgentForm,
} from "@/lib/agents";

const alice = {
  id: 1,
  name: "Alice Agent",
  role: "developer",
  status: "start",
  allowed_user: "alice",
};

describe("normalizeAgents", () => {
  test("keeps agents with unknown roles instead of dropping them", () => {
    const agents = normalizeAgents([
      { id: 2, name: " Future ", role: "brand_new_role", status: "stop" },
      alice,
    ]);
    expect(agents.map((a) => a.id)).toEqual([1, 2]);
    expect(agents[1]).toEqual({
      id: 2,
      name: "Future",
      role: "brand_new_role",
      status: "stop",
      allowed_user: "",
    });
    expect(unknownRoleAgents(agents, FALLBACK_ROLES)).toHaveLength(1);
  });

  test("normalizes status and allowed_user", () => {
    const [agent] = normalizeAgents([
      {
        id: "3",
        name: "Bob",
        role: "sales",
        status: "weird",
        allowed_user: " bob ",
      },
    ]);
    expect(agent).toEqual({
      id: 3,
      name: "Bob",
      role: "sales",
      status: "start",
      allowed_user: "bob",
    });
    expect(buildAgentPayload([agent])).toEqual([agent]);
  });
});

describe("nextAgentId", () => {
  test("fills the first gap and respects the limit", () => {
    expect(nextAgentId([], FALLBACK_MAX_AGENTS)).toBe(1);
    expect(nextAgentId([{ id: 1 }, { id: 3 }], FALLBACK_MAX_AGENTS)).toBe(2);
    const full = Array.from({ length: 30 }, (_, i) => ({ id: i + 1 }));
    expect(nextAgentId(full, 30)).toBeNull();
    expect(nextAgentId(full, 31)).toBe(31);
  });
});

describe("validateAgentForm", () => {
  const context = {
    roles: FALLBACK_ROLES,
    agents: [alice],
    publishing: true,
    userDomain: "example.org",
  };

  test("accepts a valid form", () => {
    const errors = validateAgentForm(
      { name: "Bob Builder", role: "sales", allowed_user: "bob" },
      context
    );
    expect(errors).toEqual({
      name: "",
      role: "",
      allowedUser: "",
      userDomain: "",
    });
  });

  test("rejects empty and non-letter names", () => {
    expect(
      validateAgentForm(
        { name: "  ", role: "sales", allowed_user: "bob" },
        context
      ).name
    ).toBe("required");
    expect(
      validateAgentForm(
        { name: "Jörg", role: "sales", allowed_user: "bob" },
        context
      ).name
    ).toBe("agent_name_invalid");
    expect(
      validateAgentForm(
        { name: "Agent 2", role: "sales", allowed_user: "bob" },
        context
      ).name
    ).toBe("agent_name_invalid");
  });

  test("rejects unknown roles", () => {
    expect(
      validateAgentForm(
        { name: "Bob", role: "nope", allowed_user: "bob" },
        context
      ).role
    ).toBe("agent_role_invalid");
  });

  test("requires a user domain and a unique allowed user only when publishing", () => {
    expect(
      validateAgentForm(
        { name: "Bob", role: "sales", allowed_user: "" },
        { ...context, userDomain: "" }
      ).userDomain
    ).toBe("user_domain_required");
    expect(
      validateAgentForm(
        { name: "Bob", role: "sales", allowed_user: "" },
        context
      ).allowedUser
    ).toBe("allowed_user_required");
    expect(
      validateAgentForm(
        { name: "Bob", role: "sales", allowed_user: "alice" },
        context
      ).allowedUser
    ).toBe("allowed_user_duplicated");
    // Editing alice herself may keep her own user.
    expect(
      validateAgentForm(
        { name: "Alice", role: "sales", allowed_user: "alice" },
        { ...context, excludedAgentId: 1 }
      ).allowedUser
    ).toBe("");
    // Not publishing: allowed_user is optional and duplicates are tolerated.
    const unpublished = validateAgentForm(
      { name: "Bob", role: "sales", allowed_user: "alice" },
      { ...context, publishing: false, userDomain: "" }
    );
    expect(unpublished.allowedUser).toBe("");
    expect(unpublished.userDomain).toBe("");
  });
});

describe("allowedUserInUse", () => {
  test("ignores blanks and the excluded agent", () => {
    expect(allowedUserInUse([alice], "")).toBe(false);
    expect(allowedUserInUse([alice], " alice ")).toBe(true);
    expect(allowedUserInUse([alice], "alice", 1)).toBe(false);
  });
});

describe("mapValidationErrors", () => {
  test("maps backend field paths onto page and form slots", () => {
    const mapped = mapValidationErrors([
      {
        field: "agents[2].allowed_user",
        parameter: "agents",
        error: "agent_allowed_user_required",
      },
      {
        field: "agents[0].name",
        parameter: "agents",
        error: "agent_name_invalid",
      },
      {
        field: "base_virtualhost",
        parameter: "base_virtualhost",
        error: "base_virtualhost_invalid",
      },
      {
        field: "user_domain",
        parameter: "user_domain",
        error: "user_domain_invalid",
      },
    ]);
    expect(mapped).toEqual({
      baseVirtualhost: "base_virtualhost_invalid",
      userDomain: "user_domain_invalid",
      form: {
        name: "agent_name_invalid",
        role: "",
        allowedUser: "allowed_user_required",
      },
    });
  });

  test("tolerates records without a field", () => {
    expect(
      mapValidationErrors([{ parameter: "(root)", error: "invalid_request" }])
        .form.name
    ).toBe("");
    expect(mapValidationErrors(undefined).baseVirtualhost).toBe("");
  });
});

describe("domain helpers", () => {
  test("normalizes and labels domains", () => {
    const domains = normalizeUserDomains([
      { name: "B.Example.ORG", schema: "ad", location: "internal" },
      { name: "a.example.org" },
      { name: "" },
    ]);
    expect(domains.map((d) => d.name)).toEqual([
      "a.example.org",
      "b.example.org",
    ]);
    expect(domainLabel(domains[1])).toBe("b.example.org (ad, internal)");
    expect(domainLabel(domains[0])).toBe("a.example.org");
  });

  test("normalizes and labels users", () => {
    const users = normalizeDomainUsers([
      { user: "zed", display_name: ["", "Zed Z"], locked: true },
      { user: " amy ", display_name: "amy" },
      { user: "" },
    ]);
    expect(users.map((u) => u.user)).toEqual(["amy", "zed"]);
    expect(domainUserLabel(users[0], "(locked)")).toBe("amy");
    expect(domainUserLabel(users[1], "(locked)")).toBe("Zed Z (zed) (locked)");
  });

  test("sanitizeAllowedUsers clears users missing from the domain", () => {
    const agents = [
      alice,
      { ...alice, id: 2, allowed_user: "ghost" },
      { ...alice, id: 3, allowed_user: "" },
    ];
    const cleaned = sanitizeAllowedUsers(agents, [{ user: "alice" }]);
    expect(cleaned.map((a) => a.allowed_user)).toEqual(["alice", "", ""]);
    // An empty user list (still loading or failed) must not wipe anything.
    expect(sanitizeAllowedUsers(agents, [])).toBe(agents);
  });
});

describe("agentDashboardUrl", () => {
  test("builds the per-agent status URL only when publishing", () => {
    expect(agentDashboardUrl("", alice)).toBe("");
    expect(agentDashboardUrl(" Agents.Example.ORG ", alice)).toBe(
      "https://agents.example.org/hermes-1/"
    );
  });
});
