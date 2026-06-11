// WhatsApp Data Hooks
// ====================
// Specialized hooks for WhatsApp data with caching

import { useDataCache } from './useDataCache';

// API Base URL from environment
const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '').toString().replace(/\/$/, '');

// Cache key generators
export const CACHE_KEYS = {
    CONNECTION: (workspaceId: string) => `whatsapp_connection_${workspaceId}`,
    FLOWS: (accountId: string) => `whatsapp_flows_${accountId}`,
    TEMPLATES: (accountId: string) => `whatsapp_templates_${accountId}`,
    CONVERSATIONS: (accountId: string) => `whatsapp_conversations_${accountId}`,
    ANALYTICS: (workspaceId: string, period: string) => `whatsapp_analytics_${workspaceId}_${period}`,
    BULK_CAMPAIGNS: (workspaceId: string, status?: string) => `bulk_campaigns_${workspaceId}_${status || 'all'}`,
};

// Poll intervals (in milliseconds)
export const POLL_INTERVALS = {
    FAST: 10000,      // 10 seconds - for real-time data
    NORMAL: 30000,    // 30 seconds - default
    SLOW: 60000,      // 1 minute - for less critical data
    VERY_SLOW: 300000, // 5 minutes - for rarely changing data
};

// Connection status response type
export interface ConnectionData {
    status: 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONFIGURED' | 'ERROR';
    account_summary?: {
        id: string | number;
        verified_name?: string;
        phone_number?: string;
        quality_rating?: string;
        platform_type?: string;
    };
    message?: string;
}

/**
 * Hook to get WhatsApp connection status with caching
 * Shows cached data instantly, refreshes silently in background
 */
export function useWhatsAppConnection(workspaceId: string) {
    return useDataCache<ConnectionData>({
        key: CACHE_KEYS.CONNECTION(workspaceId),
        fetcher: async () => {
            if (!workspaceId) {
                return { status: 'NOT_CONFIGURED' as const };
            }

            try {
                const res = await fetch(
                    `${API_BASE}/api/whatsapp/connection-path?workspace_id=${workspaceId}`,
                    { credentials: 'include' }
                );
                
                if (!res.ok) {
                    return { status: 'ERROR' as const, message: 'Failed to check connection' };
                }

                const data = await res.json();
                
                if (data.status === 'CONNECTED') {
                    return {
                        status: 'CONNECTED' as const,
                        account_summary: data.account_summary,
                    };
                }
                if (data.status === 'NO_ACCOUNT' || data.reason?.includes('No WhatsApp account')) {
                    return { status: 'DISCONNECTED' as const };
                } else if (data.status === 'DISCONNECTED' || data.message?.includes('not linked')) {
                    return { status: 'DISCONNECTED' as const };
                } else {
                    return { status: 'NOT_CONFIGURED' as const };
                }
            } catch (error) {
                console.error('Connection check error:', error);
                return { status: 'ERROR' as const, message: 'Network error' };
            }
        },
        pollInterval: POLL_INTERVALS.SLOW, // Check every minute
        staleTime: POLL_INTERVALS.NORMAL, // Consider stale after 30 seconds
        enabled: !!workspaceId,
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
                `${API_BASE}/api/whatsapp/templates?account_id=${accountId}`,
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
                `${API_BASE}/api/whatsapp/analytics/summary?workspace_id=${workspaceId}&days=${period}`,
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
                `${API_BASE}/api/whatsapp/accounts?workspace_id=${workspaceId}`,
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
