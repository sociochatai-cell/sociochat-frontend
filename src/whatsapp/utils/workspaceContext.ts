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
 * A workspace as returned by GET /api/workspaces.
 * `business_name` is optional (sub-workspaces may not have one).
 */
export interface Workspace {
    id: number | string;
    name: string;
    business_name?: string;
}

/**
 * Get the stored active WhatsApp workspace ID.
 * Priority: localStorage → sessionStorage → sv_selected_workspace_id fallback
 */
export function getWorkspaceId(): string | null {
    return (
        localStorage.getItem(WS_KEY) ||
        sessionStorage.getItem(WS_KEY) ||
        localStorage.getItem(WS_FALLBACK_KEY) ||
        sessionStorage.getItem(WS_FALLBACK_KEY) ||
        null
    );
}

/**
 * Set the active WhatsApp workspace ID.
 * Writes to BOTH localStorage and sessionStorage for cross-tab + cross-page consistency.
 */
export function setWorkspaceId(workspaceId: string | number): void {
    const value = String(workspaceId);
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
