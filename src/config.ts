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
export const API_BASE_URL = (
    HAS_EXPLICIT_API_BASE
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
