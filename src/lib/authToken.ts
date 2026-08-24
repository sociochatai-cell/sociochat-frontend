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

/**
 * Identity headers for raw fetch() calls that bypass apiClient — notably the
 * WhatsApp API layer (waRequest / coexReq / the Embedded-Signup connect calls),
 * which historically sent cookies ONLY. Under the SSO / shared-identity model
 * the session cookie is not the primary auth, so those cookie-only calls were
 * unauthenticated. This mirrors apiClient (Authorization: Bearer sv_token +
 * X-User-Id fallback) so the WhatsApp layer authenticates the same way as the
 * rest of the app. Safe to always add: the backend prefers the session cookie
 * when present, so this only helps the no-cookie case (incognito/mobile/SSO).
 */
export function ownerAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const { token, isAgent } = getActiveAuth();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (isAgent) return headers; // agent portal: Bearer only, never X-User-Id
    let uid: string | null = null;
    try {
      uid = localStorage.getItem("sv_user_id");
      if (!uid) {
        const u = JSON.parse(localStorage.getItem("sv_user") || "null");
        if (u?.id) uid = String(u.id);
      }
    } catch { /* ignore */ }
    if (uid) headers["X-User-Id"] = uid;
  } catch { /* ignore */ }
  return headers;
}
