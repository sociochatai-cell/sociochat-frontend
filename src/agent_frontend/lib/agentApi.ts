/**
 * Agent Auth Token Helpers
 * ========================
 * Thin localStorage-backed helpers for the agent JWT used by the WhatsApp
 * product views (e.g. WhatsAppAccountStatusOnLogin treats a present agent token
 * as "authenticated"). Uses keys separate from admin auth to prevent agents and
 * admins from impersonating each other.
 */

// SECURITY: Separate keys from admin auth (which uses 'sv_user').
const AGENT_TOKEN_KEY = 'sociovia_agent_token';
const AGENT_DATA_KEY = 'sociovia_agent_data';

export interface AgentData {
  id: number;
  workspace_id: number;
  username: string;
  display_name?: string;
  is_active: boolean;
  allowed_paths: string[];
  allowed_pages: string[];
  created_at?: string;
  updated_at?: string;
  last_login_at?: string;
}

/** Get stored agent token. */
export function getAgentToken(): string | null {
  try {
    return localStorage.getItem(AGENT_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Store agent token. */
export function setAgentToken(token: string): void {
  try {
    localStorage.setItem(AGENT_TOKEN_KEY, token);
  } catch (e) {
    console.error('Failed to store agent token', e);
  }
}

/** Clear agent token (and any stored agent data). */
export function clearAgentToken(): void {
  try {
    localStorage.removeItem(AGENT_TOKEN_KEY);
    localStorage.removeItem(AGENT_DATA_KEY);
  } catch (e) {
    console.error('Failed to clear agent token', e);
  }
}

/** Get stored agent data. */
export function getStoredAgentData(): AgentData | null {
  try {
    const data = localStorage.getItem(AGENT_DATA_KEY);
    return data ? (JSON.parse(data) as AgentData) : null;
  } catch {
    return null;
  }
}

/** Store agent data. */
export function setStoredAgentData(agent: AgentData): void {
  try {
    localStorage.setItem(AGENT_DATA_KEY, JSON.stringify(agent));
  } catch (e) {
    console.error('Failed to store agent data', e);
  }
}
