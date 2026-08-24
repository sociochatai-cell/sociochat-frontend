/**
 * WhatsApp Workspace Context
 * ==========================
 * 
 * Centralized management for the active WhatsApp workspace ID.
 * This ensures ALL WhatsApp pages use the same workspace consistently.
 * 
 * Storage Key: sv_whatsapp_workspace_id
 * Read order:  localStorage (persistent) → sessionStorage (tab-scoped) → sv_selected_workspace_id (fallback)
 * Write:       Always writes to BOTH localStorage and sessionStorage
 * 
 * IMPORTANT: Import this utility instead of reading storage keys directly.
 */

const WS_KEY = 'sv_whatsapp_workspace_id';
const WS_FALLBACK_KEY = 'sv_selected_workspace_id';
const WS_LIST_KEY = 'sv_workspaces';

/**
 * SSO landing from Sociovia: the backend redirects to /dashboard?ws=<id>&sso=1
 * where <id> is the ALREADY-TRANSLATED SocioChat workspace id. Adopt it and
 * CLEAR any stale workspace context from a previous account (this is what caused
 * the wrong account's workspaces to show after switching). Runs once per load
 * and strips the params so a refresh won't re-trigger.
 */
let _ssoWsConsumed = false;
function consumeSsoWorkspaceParam(): void {
    if (_ssoWsConsumed || typeof window === 'undefined') return;
    _ssoWsConsumed = true;
    try {
        const p = new URLSearchParams(window.location.search);
        if (p.get('sso') === '1') {
            // Fresh SSO login from Sociovia. Wipe any previous account's cached
            // identity + workspace so nothing stale leaks through, and leave a
            // DURABLE flag for the identity bootstrap in main.tsx. That bootstrap
            // runs AFTER this import-time code strips the ?sso param below, so it
            // CANNOT rely on the URL — it keys off this sessionStorage flag instead.
            ['sv_user_id', 'sv_user', 'sv_token'].forEach((k) => {
                localStorage.removeItem(k);
                sessionStorage.removeItem(k);
            });
            // Purge the WhatsApp persistent data cache (connection / analytics /
            // accounts, prefixed `wa_cache:`). A fresh SSO is a new identity+workspace
            // context; any surviving cache from a previous session on this domain can
            // pin the dashboard to a stale "not connected" / empty state so it never
            // refetches — showing blank skeletons forever. Done inline (not via
            // clearWhatsAppCache) to avoid a circular import at module-eval time.
            try {
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('wa_cache:')) localStorage.removeItem(k);
                }
            } catch { /* ignore */ }
            sessionStorage.setItem('sso_login_pending', '1');
            // Mark this session as launched from Sociovia so DashboardLayout shows the
            // "← Sociovia Dashboard" / "Main Dashboard" return link.
            localStorage.setItem('sociovia_source', 'true');
            const ws = p.get('ws');
            if (ws) {
                // wipe the previous account's selection + cached list so nothing stale leaks through
                [WS_KEY, WS_FALLBACK_KEY, WS_LIST_KEY].forEach((k) => {
                    localStorage.removeItem(k);
                    sessionStorage.removeItem(k);
                });
                localStorage.setItem(WS_FALLBACK_KEY, String(ws));
                sessionStorage.setItem(WS_FALLBACK_KEY, String(ws));
                localStorage.setItem(WS_KEY, String(ws));
                sessionStorage.setItem(WS_KEY, String(ws));
            }
            const clean = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', clean);
        }
    } catch {
        /* ignore */
    }
}

// Consume the SSO workspace param as early as this module is imported, before any
// component reads workspace context.
consumeSsoWorkspaceParam();

/**
 * A workspace as returned by GET /api/workspaces.
 * `business_name` is optional (sub-workspaces may not have one).
 */
export interface Workspace {
    id: number | string;
    name: string;
    business_name?: string;
    /** Rich fields returned by GET /api/workspaces (used by the Manage page). */
    business_type?: string | null;
    industry?: string | null;
    city?: string | null;
    country?: string | null;
    website?: string | null;
    description?: string | null;
    logo_path?: string | null;
    created_at?: string | null;
    whatsapp?: {
        connected: boolean;
        phone_number?: string | null;
        verified_name?: string | null;
        quality_score?: string | null;
    };
}

/**
 * Get the stored active WhatsApp workspace ID.
 *
 * PRIORITY: sv_selected_workspace_id (the general workspace dropdown) is the
 * SOURCE OF TRUTH — when the user clicks a workspace in the header switcher,
 * that must be what every page uses (WhatsApp dashboard included). The
 * separate sv_whatsapp_workspace_id key is kept as a legacy fallback only.
 *
 * Read order: sv_selected_workspace_id (localStorage → sessionStorage)
 *          → sv_whatsapp_workspace_id  (localStorage → sessionStorage)  [legacy]
 */
export function getWorkspaceId(): string | null {
    consumeSsoWorkspaceParam();
    return (
        localStorage.getItem(WS_FALLBACK_KEY) ||
        sessionStorage.getItem(WS_FALLBACK_KEY) ||
        localStorage.getItem(WS_KEY) ||
        sessionStorage.getItem(WS_KEY) ||
        null
    );
}

/**
 * Set the active WhatsApp workspace ID.
 * Writes to BOTH keys and BOTH storages so a switch here propagates to the
 * general dropdown too — the two selectors stay in sync in both directions.
 */
export function setWorkspaceId(workspaceId: string | number): void {
    const value = String(workspaceId);
    localStorage.setItem(WS_FALLBACK_KEY, value);
    sessionStorage.setItem(WS_FALLBACK_KEY, value);
    localStorage.setItem(WS_KEY, value);
    sessionStorage.setItem(WS_KEY, value);
}

/**
 * Clear the stored workspace ID (e.g., on logout).
 */
export function clearWorkspaceId(): void {
    localStorage.removeItem(WS_KEY);
    sessionStorage.removeItem(WS_KEY);
}

/**
 * Get the cached list of the user's workspaces (from localStorage key
 * `sv_workspaces`). Returns an empty array if nothing is cached or the
 * cached value is malformed.
 */
export function getWorkspaces(): Workspace[] {
    try {
        const raw = localStorage.getItem(WS_LIST_KEY) || sessionStorage.getItem(WS_LIST_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as Workspace[]) : [];
    } catch {
        return [];
    }
}

/**
 * Cache the full list of the user's workspaces.
 * Writes to BOTH localStorage and sessionStorage for consistency with the
 * active-id helpers.
 */
export function setWorkspaces(list: Workspace[]): void {
    try {
        const value = JSON.stringify(Array.isArray(list) ? list : []);
        localStorage.setItem(WS_LIST_KEY, value);
        sessionStorage.setItem(WS_LIST_KEY, value);
    } catch {
        /* ignore quota / serialization errors */
    }
}

/**
 * Clear the cached workspace list (e.g., on logout).
 */
export function clearWorkspaces(): void {
    localStorage.removeItem(WS_LIST_KEY);
    sessionStorage.removeItem(WS_LIST_KEY);
}
