/**
 * SocioChat.ai - API Configuration
 */

export const API_BASE_URL = (
    import.meta.env.VITE_API_BASE ??
    import.meta.env.VITE_API_BASE_URL ??
    (import.meta.env.DEV ? "" : "")
).toString().replace(/\/$/, "");

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
