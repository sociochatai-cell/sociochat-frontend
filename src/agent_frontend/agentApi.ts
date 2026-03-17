/**
 * Agent API Client
 * ================
 * Communicates with /api/agent/* endpoints.
 */

import apiClient from '@/lib/apiClient';

export interface AgentResponse {
  status: 'success' | 'error' | 'need_input' | 'confirmation_required' | 'no_match' | 'cancelled';
  message: string;
  data?: any;
  navigate_to?: string;
  ui_action?: string;
  next_step?: string;
  session_id?: string;
}

export interface AgentCapability {
  name: string;
  domain: string;
  action: string;
  description: string;
  required_params: string[];
  optional_params: string[];
}

export interface CapabilitiesResponse {
  actions: AgentCapability[];
  domains: string[];
}

export const agentApi = {
  /**
   * Send a chat message to the agent.
   */
  chat: async (message: string, sessionId?: string, workspaceId?: string): Promise<AgentResponse> => {
    const body: Record<string, any> = { message };
    if (sessionId) body.session_id = sessionId;
    if (workspaceId) body.workspace_id = workspaceId;

    const res = await apiClient.post<AgentResponse>('/agent/chat', body);
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || res.error || 'Agent request failed');
  },

  /**
   * Get all registered capabilities.
   */
  getCapabilities: async (): Promise<CapabilitiesResponse> => {
    const res = await apiClient.get<CapabilitiesResponse>('/agent/capabilities');
    if (res.ok && res.data) return res.data;
    throw new Error(res.error?.message || 'Failed to load capabilities');
  },

  /**
   * Clear a session.
   */
  clearSession: async (sessionId: string): Promise<void> => {
    await apiClient.del(`/agent/session/${sessionId}`);
  },
};

export default agentApi;
