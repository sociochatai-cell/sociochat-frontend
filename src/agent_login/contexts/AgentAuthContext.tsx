/**
 * Agent Auth Context — SocioChat.
 * ===============================
 * Holds the logged-in agent, its allowed workspaces, and the currently selected
 * workspace. Bridges the selected workspace into the localStorage keys the
 * reused WhatsApp product components read (sv_whatsapp_workspace_id /
 * sv_selected_workspace_id), so those components load the right tenant's data.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  agentApi,
  getAgentToken,
  getStoredAgentData,
  clearAgentToken,
  setStoredAgentData,
  AgentData,
  AgentWorkspaceLite,
  AgentLoginResponse,
} from "../lib/agentApi";

const SELECTED_WS_KEY = "sv_agent_selected_workspace_id";

interface AgentAuthShape {
  agent: AgentData | null;
  workspaces: AgentWorkspaceLite[];
  selectedWorkspaceId: number | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<AgentLoginResponse>;
  loginWithSso: (token: string, workspaceId?: number | null) => Promise<AgentLoginResponse>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  selectWorkspace: (workspaceId: number) => void;
  hasPageAccess: (pageKey: string) => boolean;
  getAllowedPages: () => string[];
}

const AgentAuthContext = createContext<AgentAuthShape | undefined>(undefined);

/** Mirror the selected workspace into the keys reused WhatsApp components read. */
function syncWorkspaceStorage(workspaceId: number | null) {
  try {
    if (workspaceId == null) return;
    const wid = String(workspaceId);
    localStorage.setItem("sv_whatsapp_workspace_id", wid);
    localStorage.setItem("sv_selected_workspace_id", wid);
    localStorage.setItem("current_workspace_id", wid);
    sessionStorage.setItem("sv_whatsapp_workspace_id", wid);
    localStorage.setItem(SELECTED_WS_KEY, wid);
  } catch { /* ignore */ }
}

function pickInitialWorkspace(agent: AgentData | null, workspaces: AgentWorkspaceLite[]): number | null {
  const allowed = new Set((agent?.workspace_ids || []).concat(workspaces.map((w) => w.id)));
  // Honor a previously chosen workspace if it is still allowed.
  try {
    const stored = Number(localStorage.getItem(SELECTED_WS_KEY));
    if (stored && allowed.has(stored)) return stored;
  } catch { /* ignore */ }
  if (workspaces.length > 0) return workspaces[0].id;
  if (agent?.workspace_ids?.length) return agent.workspace_ids[0];
  return null;
}

export const AgentAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [agent, setAgent] = useState<AgentData | null>(() => getStoredAgentData());
  const [workspaces, setWorkspaces] = useState<AgentWorkspaceLite[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const isAuthenticated = !!agent && !!getAgentToken();

  const hasPageAccess = useCallback(
    (pageKey: string) => (agent?.allowed_pages?.includes(pageKey) ?? false),
    [agent]
  );
  const getAllowedPages = useCallback(() => agent?.allowed_pages ?? [], [agent]);

  const selectWorkspace = useCallback((workspaceId: number) => {
    setSelectedWorkspaceId(workspaceId);
    syncWorkspaceStorage(workspaceId);
  }, []);

  const applySession = useCallback((a: AgentData | null, ws: AgentWorkspaceLite[]) => {
    setAgent(a);
    setWorkspaces(ws);
    const initial = pickInitialWorkspace(a, ws);
    setSelectedWorkspaceId(initial);
    syncWorkspaceStorage(initial);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!getAgentToken()) {
      setAgent(null);
      setWorkspaces([]);
      setLoading(false);
      return;
    }
    try {
      const res = await agentApi.getProfile();
      if (res.ok && res.data?.success) {
        setStoredAgentData(res.data.agent);
        applySession(res.data.agent, res.data.workspaces || []);
      } else {
        clearAgentToken();
        setAgent(null);
        setWorkspaces([]);
      }
    } catch (e) {
      console.error("agent profile refresh failed", e);
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  const login = useCallback(
    async (username: string, password: string): Promise<AgentLoginResponse> => {
      setLoading(true);
      try {
        const res = await agentApi.login(username, password);
        if (res.success && res.agent) {
          applySession(res.agent, res.workspaces || []);
        }
        return res;
      } finally {
        setLoading(false);
      }
    },
    [applySession]
  );

  /**
   * Cross-app SSO login: exchange a one-time token minted by the Sociovia monolith
   * for a SocioChat agent session, then (if the handoff named an allowed workspace)
   * select it. Mirrors login() so guards/RBAC behave identically.
   */
  const loginWithSso = useCallback(
    async (token: string, workspaceId?: number | null): Promise<AgentLoginResponse> => {
      setLoading(true);
      try {
        const res = await agentApi.exchangeSso(token);
        if (res.success && res.agent) {
          applySession(res.agent, res.workspaces || []);
          if (workspaceId != null) {
            const allowed = new Set(
              (res.agent.workspace_ids || []).concat((res.workspaces || []).map((w) => w.id))
            );
            if (allowed.has(workspaceId)) {
              setSelectedWorkspaceId(workspaceId);
              syncWorkspaceStorage(workspaceId);
            }
          }
        }
        return res;
      } finally {
        setLoading(false);
      }
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await agentApi.logout();
    } finally {
      setAgent(null);
      setWorkspaces([]);
      setSelectedWorkspaceId(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  // Refresh the token every 20 minutes while authenticated.
  useEffect(() => {
    if (!isAuthenticated) return;
    const id = setInterval(() => { agentApi.refreshToken().catch(console.error); }, 20 * 60 * 1000);
    return () => clearInterval(id);
  }, [isAuthenticated]);

  return (
    <AgentAuthContext.Provider
      value={{
        agent,
        workspaces,
        selectedWorkspaceId,
        loading,
        isAuthenticated,
        login,
        loginWithSso,
        logout,
        refreshProfile,
        selectWorkspace,
        hasPageAccess,
        getAllowedPages,
      }}
    >
      {children}
    </AgentAuthContext.Provider>
  );
};

export function useAgentAuth(): AgentAuthShape {
  const ctx = useContext(AgentAuthContext);
  if (!ctx) throw new Error("useAgentAuth must be used within an AgentAuthProvider");
  return ctx;
}

export default AgentAuthContext;
