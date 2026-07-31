// src/lib/authToken.ts
// SINGLE SOURCE OF TRUTH for "which identity does this request carry?"
// The app has two principals that must never be confused:
//   - OWNER  (sv_token / owner session cookie / X-User-Id)
//   - AGENT  (sociovia_agent_token, Bearer-only, no cookie, no X-User-Id)
// In the /agent portal we MUST send the agent token and MUST NOT leak the
// owner's token, X-User-Id header, or session cookie (the backend's
// authenticated_user_id() prefers the session cookie over the Bearer, so a
// stale owner cookie would otherwise override the agent identity).

export const AGENT_TOKEN_KEY = "sociovia_agent_token";

/** True when the app is running inside the agent portal (/agent, /agent/...). */
export function isAgentMode(): boolean {
  try {
    return typeof window !== "undefined" && window.location.pathname.startsWith("/agent");
  } catch {
    return false;
  }
}

export interface ActiveAuth {
  token: string | null;
  isAgent: boolean;
}

/** The token + principal kind for the current context. */
export function getActiveAuth(): ActiveAuth {
  if (isAgentMode()) {
    let token: string | null = null;
    try { token = localStorage.getItem(AGENT_TOKEN_KEY); } catch { /* ignore */ }
    return { token, isAgent: true };
  }
  let token: string | null = null;
  try { token = sessionStorage.getItem("sv_token") || localStorage.getItem("sv_token"); } catch { /* ignore */ }
  return { token, isAgent: false };
}

/**
 * credentials mode for fetch(). Agent mode omits cookies so a stale owner
 * session can never take precedence over the agent Bearer token server-side.
 */
export function credentialsMode(): RequestCredentials {
  return isAgentMode() ? "omit" : "include";
}
