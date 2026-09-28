/**
 * Agent (sub-login) API client — SocioChat.
 * =========================================
 * Talks to the backend `agent_auth` blueprints:
 *   - /api/agent-auth/*   (agent login/logout/me/refresh)
 *   - /api/agent-admin/*  (owner-facing agent CRUD)
 *
 * Auth is a signed JWT stored in localStorage under keys SEPARATE from the
 * owner/admin auth, so an agent and an owner can never impersonate each other.
 * The token keys match the existing stub in agent_frontend/lib/agentApi.ts.
 */

import { API_ENDPOINT } from "@/config";

const AGENT_TOKEN_KEY = "sociovia_agent_token";
const AGENT_DATA_KEY = "sociovia_agent_data";

export interface AgentData {
  id: number;
  owner_user_id: number;
  username: string;
  display_name?: string;
  is_active: boolean;
  allowed_pages: string[];
  allowed_paths: string[];
  workspace_ids: number[];
  created_at?: string;
  updated_at?: string;
  last_login_at?: string;
}

export interface AgentWorkspaceLite {
  id: number;
  business_name?: string;
}

export interface AgentLoginResponse {
  success: boolean;
  token?: string;
  agent?: AgentData;
  workspaces?: AgentWorkspaceLite[];
  error?: string;
  message?: string;
  retry_after?: number;
}

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: unknown;
}

// ---------------------------------------------------------------------------
// Token / data storage
// ---------------------------------------------------------------------------
export function getAgentToken(): string | null {
  try { return localStorage.getItem(AGENT_TOKEN_KEY); } catch { return null; }
}
export function setAgentToken(token: string): void {
  try { localStorage.setItem(AGENT_TOKEN_KEY, token); } catch (e) { console.error(e); }
}
export function clearAgentToken(): void {
  try {
    localStorage.removeItem(AGENT_TOKEN_KEY);
    localStorage.removeItem(AGENT_DATA_KEY);
  } catch (e) { console.error(e); }
}
export function getStoredAgentData(): AgentData | null {
  try {
    const d = localStorage.getItem(AGENT_DATA_KEY);
    return d ? (JSON.parse(d) as AgentData) : null;
  } catch { return null; }
}
export function setStoredAgentData(agent: AgentData): void {
  try { localStorage.setItem(AGENT_DATA_KEY, JSON.stringify(agent)); } catch (e) { console.error(e); }
}

// ---------------------------------------------------------------------------
// Request helper (Bearer agent token)
// ---------------------------------------------------------------------------
async function agentRequest<T = unknown>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const url = path.startsWith("http") ? path : `${API_ENDPOINT}${path.startsWith("/") ? "" : "/"}${path}`;
  const token = getAgentToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(url, { ...options, headers, credentials: "include" });
    const ct = res.headers.get("content-type") || "";
    const body = ct.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => null);

    if (res.status === 401 && typeof window !== "undefined") {
      // Agent token expired/invalid — drop it and bounce to agent login.
      clearAgentToken();
      if (!window.location.pathname.startsWith("/agent-login")) {
        window.location.href = "/agent-login";
      }
    }
    return { ok: res.ok, status: res.status, data: body as T, error: res.ok ? undefined : body };
  } catch (err) {
    return { ok: false, status: 0, error: err };
  }
}

// ---------------------------------------------------------------------------
// Agent API
// ---------------------------------------------------------------------------
export const agentApi = {
  async login(username: string, password: string): Promise<AgentLoginResponse> {
    const res = await agentRequest<AgentLoginResponse>("/agent-auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    if (res.ok && res.data?.success && res.data.token && res.data.agent) {
      setAgentToken(res.data.token);
      setStoredAgentData(res.data.agent);
    }
    return res.data || { success: false, error: "network_error" };
  },

  /**
   * Cross-app SSO: exchange a one-time token (minted by the Sociovia monolith for
   * THIS agent identity) for a fresh SocioChat agent session. Public endpoint — no
   * Bearer needed. Mirrors login()'s success handling so the context/guards behave
   * identically. Backend: POST /api/agent-auth/sso/entry {token}
   *   -> {success, token, agent, workspaces}.
   */
  async exchangeSso(token: string): Promise<AgentLoginResponse> {
    const res = await agentRequest<AgentLoginResponse>("/agent-auth/sso/entry", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    if (res.ok && res.data?.success && res.data.token && res.data.agent) {
      setAgentToken(res.data.token);
      setStoredAgentData(res.data.agent);
    }
    return res.data || { success: false, error: "network_error" };
  },

  async logout(): Promise<void> {
    try { await agentRequest("/agent-auth/logout", { method: "POST" }); } catch { /* ignore */ }
    clearAgentToken();
  },

  async getProfile(): Promise<ApiResult<{ success: boolean; agent: AgentData; workspaces: AgentWorkspaceLite[] }>> {
    return agentRequest("/agent-auth/me");
  },

  async refreshToken(): Promise<ApiResult<{ success: boolean; token: string }>> {
    const res = await agentRequest<{ success: boolean; token: string }>("/agent-auth/refresh-token", { method: "POST" });
    if (res.ok && res.data?.success && res.data.token) setAgentToken(res.data.token);
    return res;
  },
};

export default agentApi;
