// src/crm/api.ts
// ============================================================
// CRM API client — a thin, typed wrapper around the shared
// apiClient. Centralizes the /api/{leads,deals,contacts,dashboard}
// contract and AUTO-APPENDS the active `workspace_id` query param
// to every request, so page components never deal with it.
//
// Conventions (match tenantAdminApi.ts / blogApi.ts):
//  - Call paths OMIT the `/api` prefix (apiClient prepends it).
//  - Each function unwraps ApiResult.data and throws on failure.
// ============================================================
import apiClient from '@/lib/apiClient';
import { getWorkspaceId } from '@/whatsapp/utils/workspaceContext';
import type {
    Lead,
    Deal,
    Contact,
    Activity,
    DashboardStats,
    ChartPoint,
    DealStage,
} from './types';

/* ------------------------------- Helpers --------------------------------- */

/**
 * Unwrap an apiClient `{ ok, data, error }` result into the response data,
 * throwing an Error with the backend's message on failure. Mirrors the
 * `unwrap` helper in tenantAdminApi.ts so pages use plain async/await +
 * try/catch.
 */
function unwrap<T = any>(res: { ok: boolean; data?: any; error?: any }): T {
    if (res.ok) return res.data as T;
    const message =
        res.error?.message ||
        res.error?.error ||
        (typeof res.error === 'string' ? res.error : 'Request failed');
    throw new Error(message);
}

/**
 * Merge the active workspace_id into a query-params object. Read once per
 * call so a workspace switch is always reflected. Caller-supplied keys win
 * only if they explicitly pass workspace_id.
 */
function withWorkspace(params?: Record<string, any>): Record<string, any> {
    return { workspace_id: getWorkspaceId() ?? undefined, ...(params || {}) };
}

/**
 * Build a query string carrying workspace_id for POST/PATCH/DELETE calls,
 * which take their payload in the body. Backend requires workspace_id as a
 * QUERY param on every CRM route, so it must ride on the path here too.
 */
function wsQuery(extra?: Record<string, any>): string {
    const q = new URLSearchParams();
    const params = withWorkspace(extra);
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) q.append(k, String(v));
    });
    const s = q.toString();
    return s ? `?${s}` : '';
}

/**
 * Normalize a qualify-keyword list into `{ keyword, status }` objects.
 * Tolerates the legacy shape where each entry was a bare string — those map to
 * `{ keyword, status: 'qualified' }`. Drops blank/invalid entries.
 */
function normalizeKeywordList(
    list: any,
): { keyword: string; status: string }[] {
    if (!Array.isArray(list)) return [];
    return list
        .map((item) => {
            if (typeof item === 'string') {
                return { keyword: item.trim(), status: 'qualified' };
            }
            if (item && typeof item === 'object') {
                const keyword = String(item.keyword ?? '').trim();
                const status = String(item.status ?? 'qualified').trim() || 'qualified';
                return { keyword, status };
            }
            return { keyword: '', status: 'qualified' };
        })
        .filter((e) => e.keyword.length > 0);
}

/* ------------------------------- API calls ------------------------------- */

export const crmApi = {
    /* ---- Leads ---- */
    getLeads: async (params?: Record<string, any>): Promise<Lead[]> =>
        unwrap(await apiClient.get('/leads', withWorkspace(params))),

    createLead: async (body: Partial<Lead>): Promise<Lead> =>
        unwrap(await apiClient.post(`/leads${wsQuery()}`, body)),

    updateLead: async (id: string, body: Partial<Lead>): Promise<Lead> =>
        unwrap(await apiClient.patch(`/leads/${id}${wsQuery()}`, body)),

    getLeadActivity: async (id: string): Promise<Activity[]> =>
        unwrap(await apiClient.get(`/leads/${id}/activity`, withWorkspace())),

    // Append a note/activity entry to a lead. Defaults the activity `type` to
    // 'note_created' (a valid backend enum), but lets the caller override via body.
    addLeadActivity: async (
        leadId: string,
        body: { description: string; title?: string; type?: string },
    ) =>
        unwrap(
            await apiClient.post(`/leads/${leadId}/activity${wsQuery()}`, {
                type: 'note_created',
                ...body,
            }),
        ),

    addLeadFromConversation: async (conversationId: string): Promise<Lead> =>
        unwrap(
            await apiClient.post(`/leads/from-conversation${wsQuery()}`, {
                conversation_id: conversationId,
            }),
        ),

    /* ---- Deals ---- */
    getDeals: async (params?: Record<string, any>): Promise<Deal[]> =>
        unwrap(await apiClient.get('/deals', withWorkspace(params))),

    createDeal: async (body: Partial<Deal>): Promise<Deal> =>
        unwrap(await apiClient.post(`/deals${wsQuery()}`, body)),

    updateDeal: async (id: string, body: Partial<Deal>): Promise<Deal> => {
        // Backend echoes { ok, deal:{...} } — return the nested deal, not the envelope.
        const r: any = unwrap(await apiClient.patch(`/deals/${id}${wsQuery()}`, body));
        return (r && typeof r === 'object' && r.deal) ? r.deal : r;
    },

    changeDealStage: async (id: string, stage: DealStage): Promise<Deal> =>
        unwrap(await apiClient.post(`/deals/${id}/stage${wsQuery()}`, { stage })),

    closeDeal: async (id: string, status: 'won' | 'lost' | string): Promise<Deal> =>
        unwrap(await apiClient.post(`/deals/${id}/close${wsQuery()}`, { status })),

    convertLeadToDeal: async (
        leadId: string,
        opts?: { value?: number; name?: string; stage?: string },
    ): Promise<Deal> =>
        unwrap(
            await apiClient.post(`/deals/convert-from-lead${wsQuery()}`, {
                lead_id: leadId,
                ...(opts || {}),
            }),
        ),

    // Fetch a deal's activity/notes timeline. Backend may return a flat array
    // or an envelope ({ data } / { history }); normalize to always return an array.
    getDealActivity: async (dealId: string): Promise<any[]> => {
        const b: any = unwrap(
            await apiClient.get(`/deals/${dealId}/activity`, withWorkspace()),
        );
        return Array.isArray(b) ? b : (b?.data ?? b?.history ?? []);
    },

    // Append a note/activity entry to a deal. Defaults `type` to 'note_created',
    // overridable via body.type.
    addDealActivity: async (
        dealId: string,
        body: { description: string; title?: string; type?: string },
    ) =>
        unwrap(
            await apiClient.post(`/deals/${dealId}/activity${wsQuery()}`, {
                type: 'note_created',
                ...body,
            }),
        ),

    /* ---- Contacts ---- */
    // The contacts endpoint returns a paginated envelope { meta, data: [...] },
    // unlike leads which returns a flat array. Normalize to always return the array.
    getContacts: async (params?: Record<string, any>): Promise<Contact[]> => {
        const body: any = unwrap(await apiClient.get('/contacts', withWorkspace(params)));
        if (Array.isArray(body)) return body;
        if (body && Array.isArray(body.data)) return body.data;
        return [];
    },

    // Backend returns { ok, id, contact:{...} } — hand the page the nested contact
    // object (not the envelope), else the row renders with no name ("Unknown").
    createContact: async (body: Partial<Contact>): Promise<Contact> => {
        const r: any = unwrap(await apiClient.post(`/contacts${wsQuery()}`, body));
        return (r && typeof r === 'object' && r.contact) ? r.contact : r;
    },

    updateContact: async (id: string, body: Partial<Contact>): Promise<Contact> => {
        // Backend echoes { ok, contact:{...} } — return the nested contact.
        const r: any = unwrap(await apiClient.patch(`/contacts/${id}${wsQuery()}`, body));
        return (r && typeof r === 'object' && r.contact) ? r.contact : r;
    },

    deleteContact: async (id: string): Promise<{ success?: boolean } | null> =>
        unwrap(await apiClient.delete(`/contacts/${id}${wsQuery()}`)),

    // Fetch a contact's history/notes timeline. Backend may return a flat array
    // or an envelope ({ data } / { history }); normalize to always return an array.
    getContactHistory: async (contactId: string): Promise<any[]> => {
        const b: any = unwrap(
            await apiClient.get(`/contacts/${contactId}/history`, withWorkspace()),
        );
        return Array.isArray(b) ? b : (b?.data ?? b?.history ?? []);
    },

    // Append a note/history entry to a contact. Defaults `type` to 'note_created',
    // overridable via body.type.
    addContactHistory: async (
        contactId: string,
        body: { description: string; title?: string; type?: string },
    ) =>
        unwrap(
            await apiClient.post(`/contacts/${contactId}/history${wsQuery()}`, {
                type: 'note_created',
                ...body,
            }),
        ),

    /* ---- Dashboard ---- */
    getDashboardStats: async (range?: string): Promise<DashboardStats> =>
        unwrap(
            await apiClient.get('/dashboard/stats', withWorkspace(range ? { range } : undefined)),
        ),

    getSourceChart: async (range?: string): Promise<ChartPoint[]> =>
        unwrap(
            await apiClient.get(
                '/dashboard/charts/sources',
                withWorkspace(range ? { range } : undefined),
            ),
        ),

    getRevenueChart: async (range?: string): Promise<ChartPoint[]> =>
        unwrap(
            await apiClient.get(
                '/dashboard/charts/revenue',
                withWorkspace(range ? { range } : undefined),
            ),
        ),

    /* ---- Settings: lead-qualification keywords ---- */
    // Returns the built-in `defaults` (read-only) plus the workspace's `custom`
    // keywords. Each keyword now carries the lead STATUS it maps to
    // ('new' | 'contacted' | 'qualified'). Backend wraps the payload in a
    // `{ success, ... }` envelope; normalize to always hand pages a
    // `{ defaults, custom }` shape of `{ keyword, status }` objects. Legacy
    // bare-string entries are coerced to `{ keyword: s, status: 'qualified' }`.
    getQualifyKeywords: async (): Promise<{
        defaults: { keyword: string; status: string }[];
        custom: { keyword: string; status: string }[];
    }> => {
        const body: any = unwrap(
            await apiClient.get('/settings/qualify-keywords', withWorkspace()),
        );
        return {
            defaults: normalizeKeywordList(body?.defaults),
            custom: normalizeKeywordList(body?.custom),
        };
    },

    updateQualifyKeywords: async (
        custom: { keyword: string; status: string }[],
    ): Promise<{
        defaults: { keyword: string; status: string }[];
        custom: { keyword: string; status: string }[];
    }> => {
        const body: any = unwrap(
            await apiClient.put('/settings/qualify-keywords' + wsQuery(), { custom }),
        );
        return {
            defaults: normalizeKeywordList(body?.defaults),
            custom: normalizeKeywordList(body?.custom),
        };
    },

    /* ---- Settings: AI status classification ---- */
    // Toggle + editable prompt the backend uses to let AI set a lead's status
    // when no keyword/flow matches. `default_prompt` is the built-in template a
    // page can offer as "reset to default".
    getAiStatusConfig: async (): Promise<{
        enabled: boolean;
        prompt: string;
        default_prompt: string;
    }> => {
        const body: any = unwrap(
            await apiClient.get('/settings/ai-status-config', withWorkspace()),
        );
        return {
            enabled: !!body?.enabled,
            prompt: typeof body?.prompt === 'string' ? body.prompt : '',
            default_prompt:
                typeof body?.default_prompt === 'string' ? body.default_prompt : '',
        };
    },

    updateAiStatusConfig: async (body: {
        enabled: boolean;
        prompt: string;
    }): Promise<{ enabled: boolean; prompt: string; default_prompt: string }> => {
        const res: any = unwrap(
            await apiClient.put('/settings/ai-status-config' + wsQuery(), body),
        );
        return {
            enabled: !!res?.enabled,
            prompt: typeof res?.prompt === 'string' ? res.prompt : body.prompt,
            default_prompt:
                typeof res?.default_prompt === 'string' ? res.default_prompt : '',
        };
    },
};

export default crmApi;
