// Global fetch shim — attaches the Bearer token (sv_token) to our OWN /api
// requests that don't already carry an Authorization header. Many raw fetch()
// calls in the ported WhatsApp UI use cookie-only auth (`credentials:'include'`),
// which 401s when the session cookie isn't sent (cross-origin / incognito /
// token-only login). apiClient already sets Authorization, so those calls are
// untouched. Defensive: only string/URL inputs, only same-origin /api URLs,
// only when a token exists and no Authorization is already set; any error falls
// through to the original fetch (never breaks a working call).
import { API_BASE_URL } from "@/config";

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
          const token = sessionStorage.getItem("sv_token") || localStorage.getItem("sv_token");
          if (token) {
            const headers = new Headers((init && init.headers) || undefined);
            if (!headers.has("Authorization")) {
              headers.set("Authorization", `Bearer ${token}`);
              const nextInit: RequestInit = { ...(init || {}), headers };
              if (!nextInit.credentials) nextInit.credentials = "include";
              return orig(input, nextInit);
            }
          }
        }
      }
    } catch { /* fall through to original fetch */ }
    return orig(input, init);
  };
}
