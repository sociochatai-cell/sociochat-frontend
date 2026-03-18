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
