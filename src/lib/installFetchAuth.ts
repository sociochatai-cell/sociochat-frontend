// Global fetch shim — attaches the Bearer token (sv_token) to our OWN /api
// requests that don't already carry an Authorization header. Many raw fetch()
// calls in the ported WhatsApp UI use cookie-only auth (`credentials:'include'`),
// which 401s when the session cookie isn't sent (cross-origin / incognito /
// token-only login). apiClient already sets Authorization, so those calls are
// untouched. Defensive: only string/URL inputs, only same-origin /api URLs,
// only when a token exists and no Authorization is already set; any error falls
// through to the original fetch (never breaks a working call).
import { API_BASE_URL } from "@/config";
import { getActiveAuth, isAgentMode } from "@/lib/authToken";

let installed = false;

export function installFetchAuth(): void {
  if (installed || typeof window === "undefined" || typeof window.fetch !== "function") return;
  installed = true;

  const orig = window.fetch.bind(window);

  const isOwnApi = (url: string): boolean => {
    if (!url) return false;
    if (url.startsWith("/api/")) return true;
    try {
      if (API_BASE_URL && url.startsWith(`${API_BASE_URL}/api/`)) return true;
      if (url.startsWith(`${window.location.origin}/api/`)) return true;
    } catch { /* ignore */ }
    return false;
  };

  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      if (typeof input === "string" || input instanceof URL) {
        const url = typeof input === "string" ? input : input.href;
        if (isOwnApi(url)) {
          // In AGENT mode (the /agent portal) the reused WhatsApp/CRM pages must
          // authenticate as the AGENT — never as the owner. Use the agent token
          // and deliberately do NOT fall back to sv_token, so a stale owner
          // session can't leak owner identity into an agent's requests. Agent
          // mode also forces credentials:'omit' so no owner cookie is sent.
          const { token, isAgent } = getActiveAuth();
          if (token) {
            const headers = new Headers((init && init.headers) || undefined);
            if (!headers.has("Authorization")) {
              headers.set("Authorization", `Bearer ${token}`);
              const nextInit: RequestInit = { ...(init || {}), headers };
              if (isAgent) {
                nextInit.credentials = "omit";
              } else if (!nextInit.credentials) {
                nextInit.credentials = "include";
              }
              return orig(input, nextInit);
            }
          } else if (isAgentMode()) {
            // Agent mode but no agent token yet (e.g. /agent-login): never let a
            // raw fetch carry the owner cookie into an agent-context request.
            const nextInit: RequestInit = { ...(init || {}), credentials: "omit" };
            return orig(input, nextInit);
          }
        }
      }
    } catch { /* fall through to original fetch */ }
    return orig(input, init);
  };
}
