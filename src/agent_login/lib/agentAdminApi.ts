/**
 * Agent-management API adapter — SocioChat.
 * =========================================
 * A thin, strongly-typed adapter so ONE agent-management UI (AgentsManager +
 * AgentInboxAccess) can serve the platform super-admin portal.
 *
 * The super-admin picks an ACCOUNT (owner user) and manages that account's
 * agents. Every call is admin-authenticated (admin session cookie + admin
 * token via `adminHeaders()` + credentials:'include' — modelled on
 * lib/adminApi.ts) and bound to `/api/admin/agent-mgmt/accounts/{ownerUserId}/…`.
 *
 * NOTE: this is deliberately separate from the owner-facing `apiClient`
 * (which sends the owner's X-User-Id) and from `agentApi.ts` (the agent
 * sub-login Bearer flow). The agent LOGIN flow is untouched — only the
 * management UI moves into `/admin`.
 */

import { API_BASE_URL } from "@/config";
import apiClient from "@/lib/apiClient";

// ---------------------------------------------------------------------------
// Result envelope (structurally like apiClient's ApiResult, but strict)
// ---------------------------------------------------------------------------

export interface AgentAdminResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: unknown;
}

function readMessage(value: unknown): string | undefined {
  if (value && typeof value === "object") {
    const m = (value as Record<string, unknown>).message;
    if (typeof m === "string") return m;
  }
  return undefined;
}

/** Best-effort human error message from a result's body/error, else `fallback`. */
export function agentAdminErrMsg(res: AgentAdminResult, fallback: string): string {
  return readMessage(res.data) ?? readMessage(res.error) ?? fallback;
}

// ---------------------------------------------------------------------------
// Domain payload types (shared by the components)
// ---------------------------------------------------------------------------

export interface AgentRecord {
  id: number;
  username: string;
  display_name?: string;
  is_active: boolean;
  allowed_pages: string[];
  workspace_ids: number[];
  last_login_at?: string;
  login_count?: number;
}

export interface PageDef {
  key: string;
  label: string;
  category: string;
  adminOnly?: boolean;
}

export interface WorkspaceLite {
  id: number;
  name?: string;
  business_name?: string;
}

export type InboxScope = "all" | "by_chat";
export type AssignmentType = "advance" | "manual" | "auto";

export interface WorkspaceNumber {
  customer_phone: string;
  user_name?: string | null;
  conversation_id?: number | null;
  last_message_at?: string | null;
  assigned_agent_id?: number | null;
  assigned_agent_name?: string | null;
  assignment_type?: AssignmentType | null;
}

// ---- Request bodies -------------------------------------------------------

export interface CreateAgentBody {
  username: string;
  password: string;
  display_name?: string;
  allowed_pages: string[];
  workspace_ids: number[];
}

export interface UpdateAgentBody {
  display_name?: string;
  is_active?: boolean;
  allowed_pages?: string[];
  workspace_ids?: number[];
  password?: string;
}

export interface AssignNumbersBody {
  workspace_id: number;
  phones: string[];
  advance?: boolean;
}

export interface ReleaseNumbersBody {
  workspace_id: number;
  phones: string[];
}

export interface GrantPatchBody {
  inbox_scope?: InboxScope;
  auto_assign?: boolean;
}

// ---- Response payloads ----------------------------------------------------

export interface ListAgentsResponse {
  success: boolean;
  agents: AgentRecord[];
  account_id?: number;
  total?: number;
  message?: string;
}

export interface PagesConfigResponse {
  success: boolean;
  pages: PageDef[];
  assignable_pages: string[];
  message?: string;
}

export interface ListWorkspacesResponse {
  success: boolean;
  workspaces: WorkspaceLite[];
  message?: string;
}

export interface CreateAgentResponse {
  success: boolean;
  agent?: AgentRecord;
  account_id?: number;
  message?: string;
}

export interface MutateResponse {
  success: boolean;
  message?: string;
}

export interface NumbersResponse {
  success: boolean;
  numbers: WorkspaceNumber[];
  autoassign_enabled: boolean;
  total: number;
  message?: string;
}

export interface GrantResponse {
  success: boolean;
  grant: { workspace_id: number; inbox_scope: InboxScope; auto_assign: boolean };
  message?: string;
}

export interface AutoAssignResponse {
  success: boolean;
  enabled: boolean;
  message?: string;
}

export interface AssignNumbersResponse {
  success: boolean;
  assigned?: unknown[];
  message?: string;
}

export interface ReleaseNumbersResponse {
  success: boolean;
  released?: unknown;
  skipped?: unknown;
  message?: string;
}

export interface AccountRow {
  id: number;
  name: string;
  email: string;
  tenant_id?: number | null;
  workspace_count: number;
  agent_count: number;
}

export interface ListAccountsResponse {
  success: boolean;
  accounts: AccountRow[];
  total?: number;
  message?: string;
}

// ---------------------------------------------------------------------------
// Admin fetch helper (admin session cookie + admin token)
// ---------------------------------------------------------------------------

function adminHeaders(): Record<string, string> {
  const adminId = localStorage.getItem("sv_admin_id") || sessionStorage.getItem("sv_admin_id");
  const token = sessionStorage.getItem("sv_token") || localStorage.getItem("sv_token");
  return {
    "Content-Type": "application/json",
    ...(adminId ? { "X-Admin-Id": adminId } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<AgentAdminResult<T>> {
  const url = path.startsWith("http")
    ? path
    : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      credentials: "include",
      headers: { ...adminHeaders(), ...((options.headers as Record<string, string>) || {}) },
    });
    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json")
      ? await res.json().catch(() => null)
      : await res.text().catch(() => null);
    if (res.status === 204) return { ok: true, status: res.status };
    return {
      ok: res.ok,
      status: res.status,
      data: res.ok ? (body as T) : undefined,
      error: res.ok ? undefined : body,
    };
  } catch (err) {
    return { ok: false, status: 0, error: err };
  }
}

// ---------------------------------------------------------------------------
// Adapter interface — ONE shape the UI codes against
// ---------------------------------------------------------------------------

export interface UsernameCheckResponse {
  success: boolean;
  username: string;
  available: boolean;
  suggestion: string | null;
  message?: string;
}

export interface AgentAdminApi {
  /** The owner (account) user id every call is scoped to. */
  accountId: number;

  listAgents(): Promise<AgentAdminResult<ListAgentsResponse>>;
  pagesConfig(): Promise<AgentAdminResult<PagesConfigResponse>>;
  listWorkspaces(): Promise<AgentAdminResult<ListWorkspacesResponse>>;
  /** Live global-uniqueness check for a candidate agent username. */
  checkUsername(username: string): Promise<AgentAdminResult<UsernameCheckResponse>>;

  createAgent(body: CreateAgentBody): Promise<AgentAdminResult<CreateAgentResponse>>;
  updateAgent(aid: number, body: UpdateAgentBody): Promise<AgentAdminResult<MutateResponse>>;
  deleteAgent(aid: number): Promise<AgentAdminResult<MutateResponse>>;
  resetPassword(aid: number, newPassword: string): Promise<AgentAdminResult<MutateResponse>>;

  listNumbers(wid: number): Promise<AgentAdminResult<NumbersResponse>>;
  assignNumbers(aid: number, body: AssignNumbersBody): Promise<AgentAdminResult<AssignNumbersResponse>>;
  releaseNumbers(aid: number, body: ReleaseNumbersBody): Promise<AgentAdminResult<ReleaseNumbersResponse>>;

  getGrant(aid: number, wid: number): Promise<AgentAdminResult<GrantResponse>>;
  patchGrant(aid: number, wid: number, body: GrantPatchBody): Promise<AgentAdminResult<GrantResponse>>;

  getAutoassign(wid: number): Promise<AgentAdminResult<AutoAssignResponse>>;
  setAutoassign(wid: number, enabled: boolean): Promise<AgentAdminResult<AutoAssignResponse>>;
}

const MGMT_BASE = "/api/admin/agent-mgmt";

/**
 * Bind every agent-management call to a specific account (owner user) via the
 * admin-authenticated `/api/admin/agent-mgmt/accounts/{ownerUserId}/…` routes.
 */
export function makeSuperAdminAgentApi(ownerUserId: number): AgentAdminApi {
  const acct = `${MGMT_BASE}/accounts/${ownerUserId}`;
  return {
    accountId: ownerUserId,

    listAgents: () => adminFetch<ListAgentsResponse>(`${acct}/agents`, { method: "GET" }),
    pagesConfig: () => adminFetch<PagesConfigResponse>(`${MGMT_BASE}/pages-config`, { method: "GET" }),
    listWorkspaces: () => adminFetch<ListWorkspacesResponse>(`${acct}/workspaces`, { method: "GET" }),
    checkUsername: (username) =>
      adminFetch<UsernameCheckResponse>(`${MGMT_BASE}/username-available?username=${encodeURIComponent(username)}`, { method: "GET" }),

    createAgent: (body) =>
      adminFetch<CreateAgentResponse>(`${acct}/agents`, { method: "POST", body: JSON.stringify(body) }),
    updateAgent: (aid, body) =>
      adminFetch<MutateResponse>(`${acct}/agents/${aid}`, { method: "PATCH", body: JSON.stringify(body) }),
    deleteAgent: (aid) => adminFetch<MutateResponse>(`${acct}/agents/${aid}`, { method: "DELETE" }),
    resetPassword: (aid, newPassword) =>
      adminFetch<MutateResponse>(`${acct}/agents/${aid}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ new_password: newPassword }),
      }),

    listNumbers: (wid) =>
      adminFetch<NumbersResponse>(`${acct}/workspaces/${wid}/numbers`, { method: "GET" }),
    assignNumbers: (aid, body) =>
      adminFetch<AssignNumbersResponse>(`${acct}/agents/${aid}/numbers`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    releaseNumbers: (aid, body) =>
      adminFetch<ReleaseNumbersResponse>(`${acct}/agents/${aid}/numbers`, {
        method: "DELETE",
        body: JSON.stringify(body),
      }),

    getGrant: (aid, wid) =>
      adminFetch<GrantResponse>(`${acct}/agents/${aid}/workspaces/${wid}`, { method: "GET" }),
    patchGrant: (aid, wid, body) =>
      adminFetch<GrantResponse>(`${acct}/agents/${aid}/workspaces/${wid}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),

    getAutoassign: (wid) =>
      adminFetch<AutoAssignResponse>(`${acct}/workspaces/${wid}/autoassign`, { method: "GET" }),
    setAutoassign: (wid, enabled) =>
      adminFetch<AutoAssignResponse>(`${acct}/workspaces/${wid}/autoassign`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
  };
}

// ---------------------------------------------------------------------------
// Owner self-service adapter — an account OWNER manages THEIR OWN agents
// ---------------------------------------------------------------------------

/**
 * The owner's own user id, for display only. The `listAgents` response carries
 * the authoritative `account_id`, so this is a best-effort seed read from the
 * same storage keys the owner `apiClient` uses for its X-User-Id fallback.
 */
function ownerAccountId(): number {
  try {
    const direct = localStorage.getItem("sv_user_id");
    if (direct) {
      const n = Number(direct);
      if (Number.isFinite(n)) return n;
    }
    const userStr = localStorage.getItem("sv_user");
    if (userStr) {
      const user = JSON.parse(userStr) as { id?: number | string } | null;
      if (user?.id != null) {
        const n = Number(user.id);
        if (Number.isFinite(n)) return n;
      }
    }
  } catch {
    /* ignore malformed storage */
  }
  return 0;
}

/**
 * Bind every agent-management call to the CURRENTLY LOGGED-IN OWNER via the
 * owner-authenticated `apiClient` (sends the owner's identity + workspace
 * automatically). These hit the `require_owner_user` `/api/agent-admin/*`
 * routes — no account id in the path, since the owner IS the authenticated
 * user. `apiClient` prepends `/api`, so paths start at `/agent-admin/...`
 * (owner workspaces list lives at `/workspaces`).
 *
 * `apiClient`'s ApiResult<T> is structurally compatible with AgentAdminResult<T>
 * (same ok/status/data/error; a harmless extra `headers`), so results are
 * returned directly.
 */
export function makeOwnerAgentApi(): AgentAdminApi {
  return {
    accountId: ownerAccountId(),

    listAgents: () => apiClient.get<ListAgentsResponse>("/agent-admin/agents"),
    pagesConfig: () => apiClient.get<PagesConfigResponse>("/agent-admin/pages-config"),
    listWorkspaces: () => apiClient.get<ListWorkspacesResponse>("/workspaces"),
    checkUsername: (username) =>
      apiClient.get<UsernameCheckResponse>("/agent-admin/username-available", { username }),

    createAgent: (body) => apiClient.post<CreateAgentResponse>("/agent-admin/agents", body),
    updateAgent: (aid, body) => apiClient.patch<MutateResponse>(`/agent-admin/agents/${aid}`, body),
    deleteAgent: (aid) => apiClient.delete<MutateResponse>(`/agent-admin/agents/${aid}`),
    resetPassword: (aid, newPassword) =>
      apiClient.post<MutateResponse>(`/agent-admin/agents/${aid}/reset-password`, { new_password: newPassword }),

    listNumbers: (wid) => apiClient.get<NumbersResponse>(`/agent-admin/workspaces/${wid}/numbers`),
    assignNumbers: (aid, body) =>
      apiClient.post<AssignNumbersResponse>(`/agent-admin/agents/${aid}/numbers`, body),
    releaseNumbers: (aid, body) =>
      // apiClient.delete has no body — mirror the admin adapter's DELETE-with-body via request().
      apiClient.request<ReleaseNumbersResponse>(`/agent-admin/agents/${aid}/numbers`, {
        method: "DELETE",
        body: JSON.stringify(body),
      }),

    getGrant: (aid, wid) =>
      apiClient.get<GrantResponse>(`/agent-admin/agents/${aid}/workspaces/${wid}`),
    patchGrant: (aid, wid, body) =>
      apiClient.patch<GrantResponse>(`/agent-admin/agents/${aid}/workspaces/${wid}`, body),

    getAutoassign: (wid) => apiClient.get<AutoAssignResponse>(`/agent-admin/workspaces/${wid}/autoassign`),
    setAutoassign: (wid, enabled) =>
      apiClient.patch<AutoAssignResponse>(`/agent-admin/workspaces/${wid}/autoassign`, { enabled }),
  };
}

/** Account picker source — search accounts (owner users) the admin can manage. */
export async function listAccounts(q?: string): Promise<ListAccountsResponse> {
  const query = q ? `?q=${encodeURIComponent(q)}` : "";
  const res = await adminFetch<ListAccountsResponse>(`${MGMT_BASE}/accounts${query}`, { method: "GET" });
  return (
    res.data ?? {
      success: false,
      accounts: [],
      message: agentAdminErrMsg(res, "Failed to load accounts"),
    }
  );
}
