// WhatsApp Data Hooks
// ====================
// Specialized hooks for WhatsApp data with caching

import { useDataCache, clearCache } from './useDataCache';
import { invalidateHttpCache } from '../utils/waPersistentCache';
import { WHATSAPP_REST_API_PREFIX } from '@/config';

// Cache key generators
export const CACHE_KEYS = {
    CONNECTION: (workspaceId: string) => `whatsapp_connection_${workspaceId}`,
    ACCOUNTS: (workspaceId: string) => `whatsapp_accounts_${workspaceId}`,
    FLOWS: (accountId: string) => `whatsapp_flows_${accountId}`,
    TEMPLATES: (accountId: string) => `whatsapp_templates_${accountId}`,
    CONVERSATIONS: (accountId: string) => `whatsapp_conversations_${accountId}`,
    ANALYTICS: (workspaceId: string, period: string) => `whatsapp_analytics_${workspaceId}_${period}`,
    BULK_CAMPAIGNS: (workspaceId: string, status?: string) => `bulk_campaigns_${workspaceId}_${status || 'all'}`,
};

/**
 * Invalidate every cached view of WhatsApp accounts/connection for a workspace.
 *
 * Call after a connect / unlink / rename / delete so the next read refetches fresh
 * data instead of serving the pre-mutation cache. Drops three layers:
 *   - cachedFetch HTTP cache for `/api/whatsapp/accounts`
 *   - the `whatsapp_accounts_<ws>` useDataCache entry (L1 memory + L2 persistent)
 *   - the `whatsapp_connection_<ws>` useDataCache entry (connection status)
 *
 * Passing a workspaceId scopes the useDataCache clears to that workspace; omit it to
 * clear all workspaces' account/connection entries.
 */
export function invalidateWhatsAppAccountsCache(workspaceId?: string): void {
    invalidateHttpCache('/api/whatsapp/accounts');
    clearCache(workspaceId ? CACHE_KEYS.ACCOUNTS(workspaceId) : 'whatsapp_accounts');
    clearCache(workspaceId ? CACHE_KEYS.CONNECTION(workspaceId) : 'whatsapp_connection');
}

// Poll intervals (in milliseconds)
export const POLL_INTERVALS = {
    FAST: 10000,      // 10 seconds - for real-time data
    NORMAL: 30000,    // 30 seconds - default
    SLOW: 60000,      // 1 minute - for less critical data
    VERY_SLOW: 300000, // 5 minutes - for rarely changing data
};

// Connection status response type
export interface ConnectionData {
    status: 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONFIGURED' | 'PARTIAL' | 'RELINK_REQUIRED' | 'ERROR';
    account_summary?: {
        id: string | number;
        verified_name?: string;
        phone_number?: string;
        phone_number_id?: string;
        quality_rating?: string;
        platform_type?: string;
        is_coexistence?: boolean;
        is_active?: boolean;
    };
    message?: string;
}

/**
 * True when the workspace still has a WhatsApp account row we can use for templates/inbox,
 * even if OAuth needs refresh (RELINK_REQUIRED / PARTIAL).
 */
export function connectionPathHasLinkedAccount(data: {
    status?: string;
    account_summary?: { id?: string | number; phone_number_id?: string; phone_number?: string; verified_name?: string };
    reason?: string;
} | null | undefined): boolean {
    if (!data?.account_summary) return false;
    const s = data.status;
    return s === 'CONNECTED' || s === 'RELINK_REQUIRED' || s === 'PARTIAL';
}

/**
 * Hook to get WhatsApp connection status with caching
 * Shows cached data instantly, refreshes silently in background
 */
export function useWhatsAppConnection(workspaceId: string, enabled = true) {
    return useDataCache<ConnectionData>({
        key: CACHE_KEYS.CONNECTION(workspaceId),
        fetcher: async () => {
            if (!workspaceId) {
                return { status: 'NOT_CONFIGURED' as const };
            }

            try {
                const res = await fetch(
                    `${WHATSAPP_REST_API_PREFIX}/connection-path?workspace_id=${workspaceId}`,
                    { credentials: 'include' },
                );
                
                if (!res.ok) {
                    return { status: 'ERROR' as const, message: 'Failed to check connection' };
                }

                const data = await res.json();

                // Preserve backend status semantics so UI can distinguish
                // linked-but-needs-reconnect (RELINK_REQUIRED) from truly unlinked.
                if (data.status === 'CONNECTED') {
                    return { status: 'CONNECTED' as const, account_summary: data.account_summary };
                }
                if (data.status === 'RELINK_REQUIRED') {
                    return {
                        status: 'RELINK_REQUIRED' as const,
                        account_summary: data.account_summary,
                        message: data.reason || 'Reconnect required',
                    };
                }
                if (data.status === 'PARTIAL') {
                    return {
                        status: 'PARTIAL' as const,
                        account_summary: data.account_summary,
                        message: data.reason || 'Setup incomplete',
                    };
                }
                if (data.status === 'DISCONNECTED' || data.message?.includes('not linked')) {
                    return { status: 'DISCONNECTED' as const };
                }
                return { status: 'NOT_CONFIGURED' as const };
            } catch (error) {
                console.error('Connection check error:', error);
                return { status: 'ERROR' as const, message: 'Network error' };
            }
        },
        pollInterval: POLL_INTERVALS.SLOW, // Check every minute
        // Always revalidate the connection status on mount (staleTime 0). Otherwise a
        // cached "CONNECTED" could show for up to 30s even after the account was
        // unlinked (is_active=False) — the dashboard would show Connected + Unlink
        // while Settings correctly shows "not connected". Fresh check keeps them in sync.
        staleTime: 0,
        enabled: !!workspaceId && enabled,
    });
}

/**
 * Hook to get WhatsApp templates with caching
 */
export function useWhatsAppTemplates(accountId: string) {
    return useDataCache<any[]>({
        key: CACHE_KEYS.TEMPLATES(accountId),
        fetcher: async () => {
            if (!accountId) return [];

            const res = await fetch(
                `${WHATSAPP_REST_API_PREFIX}/templates?account_id=${accountId}`,
                { credentials: 'include' }
            );
            const data = await res.json();
            return data.success ? data.templates || [] : [];
        },
        pollInterval: POLL_INTERVALS.SLOW,
        enabled: !!accountId,
    });
}

/**
 * Hook to get WhatsApp analytics with caching
 */
export function useWhatsAppAnalytics(workspaceId: string, period: string = '7') {
    return useDataCache<any>({
        key: CACHE_KEYS.ANALYTICS(workspaceId, period),
        fetcher: async () => {
            if (!workspaceId) return null;

            const res = await fetch(
                `${WHATSAPP_REST_API_PREFIX}/analytics/summary?workspace_id=${workspaceId}&period=${period}`,
                { credentials: 'include' }
            );
            return await res.json();
        },
        pollInterval: POLL_INTERVALS.NORMAL,
        enabled: !!workspaceId,
    });
}

/**
 * Hook to get WhatsApp accounts for a workspace with caching
 */
export function useWhatsAppAccounts(workspaceId: string) {
    return useDataCache<any[]>({
        key: `whatsapp_accounts_${workspaceId}`,
        fetcher: async () => {
            if (!workspaceId) return [];

            const res = await fetch(
                `${WHATSAPP_REST_API_PREFIX}/accounts?workspace_id=${workspaceId}`,
                { credentials: 'include' }
            );
            const data = await res.json();
            return data.success ? data.accounts || [] : [];
        },
        pollInterval: POLL_INTERVALS.SLOW,
        staleTime: POLL_INTERVALS.NORMAL,
        enabled: !!workspaceId,
    });
}
