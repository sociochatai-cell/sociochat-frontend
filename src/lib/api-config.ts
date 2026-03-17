/**
 * API Configuration with Fallback Support
 * 
 * Priority:
 * 1. DevTunnel URL (for external access / Meta webhooks)
 * 2. Localhost fallback (for local development)
 */

const PRIMARY_URL = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '').toString().replace(/\/$/, '');
const FALLBACK_URL = (import.meta.env.VITE_API_FALLBACK_URL || 'https://sociovia-backend-362038465411.europe-west1.run.app').toString().replace(/\/$/, '');

let activeBaseUrl: string | null = null;
let checkingConnection = false;

/**
 * Check if a URL is reachable
 */
async function isUrlReachable(url: string, timeout = 3000): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(`${url}/health`, {
            method: 'GET',
            signal: controller.signal,
            mode: 'cors',
        });

        clearTimeout(timeoutId);
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Get the active API base URL, checking connectivity if needed
 */
export async function getApiBaseUrl(): Promise<string> {
    // Return cached URL if already determined
    if (activeBaseUrl) {
        return activeBaseUrl;
    }

    // Prevent concurrent checks
    if (checkingConnection) {
        // Wait a bit and return primary (will retry on failure)
        await new Promise(resolve => setTimeout(resolve, 100));
        return activeBaseUrl || PRIMARY_URL;
    }

    checkingConnection = true;

    try {
        // Try primary URL first (devtunnel)
        if (PRIMARY_URL && await isUrlReachable(PRIMARY_URL)) {
            activeBaseUrl = PRIMARY_URL;
            console.log('✅ Using DevTunnel:', PRIMARY_URL);
            return PRIMARY_URL;
        }

        // Try fallback (localhost)
        if (FALLBACK_URL && await isUrlReachable(FALLBACK_URL)) {
            activeBaseUrl = FALLBACK_URL;
            console.log('✅ Using Fallback (localhost):', FALLBACK_URL);
            return FALLBACK_URL;
        }

        // Default to primary even if not reachable
        console.warn('⚠️ No reachable API, defaulting to:', PRIMARY_URL);
        activeBaseUrl = PRIMARY_URL;
        return PRIMARY_URL;
    } finally {
        checkingConnection = false;
    }
}

/**
 * Synchronous getter - returns cached or primary URL
 * Use this when you can't await (e.g., in component render)
 */
export function getApiBaseUrlSync(): string {
    return activeBaseUrl || PRIMARY_URL || FALLBACK_URL;
}

/**
 * Reset the cached URL (useful for retry logic)
 */
export function resetApiBaseUrl(): void {
    activeBaseUrl = null;
}

/**
 * Make a fetch request with automatic fallback
 */
export async function apiFetch(
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> {
    const baseUrl = await getApiBaseUrl();
    const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`,
                ...options.headers,
            },
        });
        return response;
    } catch (error) {
        // If primary fails, try fallback
        if (baseUrl === PRIMARY_URL && FALLBACK_URL) {
            console.warn('Primary API failed, trying fallback...');
            resetApiBaseUrl();
            activeBaseUrl = FALLBACK_URL;

            const fallbackUrl = `${FALLBACK_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
            return fetch(fallbackUrl, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    ...options.headers,
                },
            });
        }
        throw error;
    }
}

// Export constants for direct access
export const API_PRIMARY = PRIMARY_URL;
export const API_FALLBACK = FALLBACK_URL;
export const API_BASE = PRIMARY_URL; // For backward compatibility
