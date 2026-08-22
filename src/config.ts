/**
 * SocioChat.ai - API Configuration
 */

const HAS_EXPLICIT_API_BASE = !!(
    import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE
);

const IS_DEV_TUNNEL_HOST =
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".devtunnels.ms");

/**
 * Empty base = same-origin `/api/...` via Vite proxy → http://localhost:5000.
 * On Dev Tunnels this keeps all API traffic on the 5173 tunnel (no separate :5000 hop).
 * Never set https://127.0.0.1:5000 — Flask is HTTP-only and the browser will TLS-handshake fail.
 */
const _CADDY_SERVED_HOSTS = ["app.sociochat.ai", "sc.sociovia.com"];
const _isCaddyHost =
    typeof window !== "undefined" &&
    _CADDY_SERVED_HOSTS.includes(window.location.hostname.toLowerCase());

export const API_BASE_URL = (
    _isCaddyHost
        ? ""
        : HAS_EXPLICIT_API_BASE
            ? import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || ""
            : ""
).toString().replace(/\/$/, "");

if (import.meta.env.DEV && IS_DEV_TUNNEL_HOST) {
    console.info("[Sociovia dev] Dev Tunnel mode — API via same-origin Vite proxy", {
        origin: window.location.origin,
        apiBase: API_BASE_URL || "(same-origin /api)",
    });
}

export const API_ENDPOINT = `${API_BASE_URL}/api`;

/**
 * WhatsApp API aliases — SAME-ORIGIN.
 * The ported WhatsApp UI (from the standalone service) imports these expecting a SEPARATE
 * WhatsApp origin. In this merged monolith everything is same-origin `/api`, so all four
 * resolve to the shared base. This lets the ~200 source call sites compile unchanged while
 * routing through the same Vite proxy / Caddy rewrite as the rest of the app.
 */
export const WHATSAPP_API_BASE_URL = API_BASE_URL;                       // "" (same-origin)
export const WHATSAPP_API_ENDPOINT = API_ENDPOINT;                        // "/api"
export const WHATSAPP_REST_API_PREFIX = `${API_BASE_URL}/api/whatsapp`;   // "/api/whatsapp"
export const getApiBaseForPath = (_path?: string): string => API_BASE_URL;

export const buildApiUrl = (path: string): string => {
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `${API_BASE_URL}${cleanPath}`;
};

export const buildApiEndpoint = (path: string): string => {
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `${API_ENDPOINT}/${cleanPath}`;
};

export default {
    API_BASE_URL,
    API_ENDPOINT,
    buildApiUrl,
    buildApiEndpoint,
};
