/** Lightweight fetch wrapper (parity with reference waPersistentCache).
 *
 * Adds the app's standard cross-origin auth (mirrors src/lib/apiClient.ts):
 *   • credentials: 'include'  → send the session cookie when same-origin / allowed
 *   • X-User-Id  header       → fallback identity for cross-origin / blocked cookies
 *   • X-Admin-Id header       → admin-portal fallback
 *   • Authorization: Bearer   → token fallback
 * Without these, cross-origin POSTs (e.g. creating a WhatsApp Flow/Form) hit
 * auth-gated endpoints with no identity and get a 401.
 */
function authHeaders(): Record<string, string> {
    const h: Record<string, string> = {};
    try {
        let userId = localStorage.getItem("sv_user_id");
        if (!userId) {
            const userStr = localStorage.getItem("sv_user");
            if (userStr) {
                const u = JSON.parse(userStr);
                if (u?.id) userId = String(u.id);
            }
        }
        if (userId) h["X-User-Id"] = userId;

        const adminId =
            sessionStorage.getItem("sv_admin_id") || localStorage.getItem("sv_admin_id");
        if (adminId) h["X-Admin-Id"] = adminId;

        const token = sessionStorage.getItem("sv_token") || localStorage.getItem("sv_token");
        if (token) h["Authorization"] = `Bearer ${token}`;
    } catch {
        // storage unavailable (private mode) — fall back to cookie-only auth
    }
    return h;
}

export async function cachedFetch(url: string, options?: RequestInit): Promise<Response> {
    // Caller headers win over auth headers (e.g. Content-Type is preserved).
    const headers: Record<string, string> = {
        ...authHeaders(),
        ...((options?.headers as Record<string, string>) || {}),
    };
    return fetch(url, { credentials: "include", ...options, headers });
}
