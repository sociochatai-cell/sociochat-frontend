// CTWA API Client
// ================

import {
    CTWACampaign,
    CampaignMetrics,
    AnalyticsSummary,
    CreateCampaignData,
    AdAccount,
    FacebookPage,
    WhatsAppAccountForAds,
} from './types';
import { API_BASE_URL } from '@/config';

// Absolute base so it works in production too (frontend + AWS backend on
// different origins). API_BASE_URL is '' in dev (same-origin Vite proxy) and the
// deployed backend URL when VITE_API_BASE_URL is set at build time.
const API_BASE = `${API_BASE_URL}/api/ctwa`;

/**
 * Generic fetch wrapper with error handling
 */
async function fetchAPI<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || `API error: ${response.status}`);
    }

    return data;
}

// ============================================================
// Campaign Operations
// ============================================================

/**
 * List all campaigns for a workspace
 */
export async function listCampaigns(workspaceId: string): Promise<CTWACampaign[]> {
    const data = await fetchAPI<{ success: boolean; campaigns: CTWACampaign[] }>(
        `/campaigns?workspace_id=${encodeURIComponent(workspaceId)}`
    );
    return data.campaigns;
}

/**
 * Get single campaign with ad sets
 */
export async function getCampaign(campaignId: number): Promise<CTWACampaign> {
    const data = await fetchAPI<{ success: boolean; campaign: CTWACampaign }>(
        `/campaigns/${campaignId}`
    );
    return data.campaign;
}

/**
 * Create a new campaign (draft)
 */
export async function createCampaign(
    campaignData: CreateCampaignData
): Promise<CTWACampaign> {
    const data = await fetchAPI<{ success: boolean; campaign: CTWACampaign }>(
        '/campaigns',
        {
            method: 'POST',
            body: JSON.stringify(campaignData),
        }
    );
    return data.campaign;
}

/**
 * Update campaign details
 */
export async function updateCampaign(
    campaignId: number,
    updates: Partial<CreateCampaignData>
): Promise<CTWACampaign> {
    const data = await fetchAPI<{ success: boolean; campaign: CTWACampaign }>(
        `/campaigns/${campaignId}`,
        {
            method: 'PUT',
            body: JSON.stringify(updates),
        }
    );
    return data.campaign;
}

/**
 * Delete a campaign (draft or published — the backend also removes it from Meta).
 */
export async function deleteCampaign(campaignId: number): Promise<void> {
    await fetchAPI(`/campaigns/${campaignId}`, { method: 'DELETE' });
}

/**
 * Set a published campaign LIVE (ACTIVE) on Meta — "Go Live".
 */
export async function activateCampaign(campaignId: number): Promise<CTWACampaign> {
    const data = await fetchAPI<{ success: boolean; campaign: CTWACampaign }>(
        `/campaigns/${campaignId}/activate`,
        { method: 'POST' },
    );
    return data.campaign;
}

/**
 * Pause a live campaign on Meta.
 */
export async function pauseCampaign(campaignId: number): Promise<CTWACampaign> {
    const data = await fetchAPI<{ success: boolean; campaign: CTWACampaign }>(
        `/campaigns/${campaignId}/pause`,
        { method: 'POST' },
    );
    return data.campaign;
}

/**
 * Publish campaign to Meta
 */
export async function publishCampaign(
    campaignId: number,
    activate: boolean = false
): Promise<CTWACampaign & { warning?: string | null }> {
    const data = await fetchAPI<{
        success: boolean;
        campaign: CTWACampaign;
        meta_campaign_id: string;
        /** Set when the ad published but something optional was dropped
         *  (e.g. Meta rejected the ice-breaker welcome screen). */
        warning?: string | null;
    }>(`/campaigns/${campaignId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ activate }),
    });
    return { ...data.campaign, warning: data.warning ?? null };
}

// ============================================================
// Analytics
// ============================================================

/**
 * Get campaign insights/metrics
 */
export async function getCampaignInsights(
    campaignId: number,
    datePreset: string = 'last_7d'
): Promise<CampaignMetrics> {
    const data = await fetchAPI<{ success: boolean } & CampaignMetrics>(
        `/campaigns/${campaignId}/insights?date_preset=${datePreset}`
    );
    return data;
}

/**
 * Get analytics summary for workspace
 */
export async function getAnalyticsSummary(
    workspaceId: string
): Promise<AnalyticsSummary> {
    const data = await fetchAPI<{ success: boolean; summary: AnalyticsSummary }>(
        `/analytics/summary?workspace_id=${encodeURIComponent(workspaceId)}`
    );
    return data.summary;
}

// ============================================================
// Account Selection
// ============================================================

/**
 * Get ad accounts, pages, and WhatsApp numbers for a workspace.
 * Uses the consolidated /api/ctwa/accounts endpoint.
 */
export async function getCTWAAccounts(workspaceId: string): Promise<{
    ad_accounts: AdAccount[];
    pages: FacebookPage[];
    whatsapp_numbers: WhatsAppAccountForAds[];
}> {
    const data = await fetchAPI<{
        success: boolean;
        ad_accounts: AdAccount[];
        pages: FacebookPage[];
        whatsapp_numbers: WhatsAppAccountForAds[];
    }>(`/accounts?workspace_id=${encodeURIComponent(workspaceId)}`);
    return {
        ad_accounts: data.ad_accounts || [],
        pages: data.pages || [],
        whatsapp_numbers: data.whatsapp_numbers || [],
    };
}

// ============================================================
// Ad creative media upload (-> DigitalOcean Spaces public URL)
// ============================================================

/**
 * Upload an image/video for an ad creative. Returns a public https URL that
 * Meta can fetch. Uses multipart/form-data (NOT the JSON fetchAPI helper).
 */
export async function uploadAdMedia(
    workspaceId: string,
    file: File,
): Promise<{ url: string; media_type: 'image' | 'video' }> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('workspace_id', workspaceId);
    const res = await fetch(`${API_BASE}/upload-media`, {
        method: 'POST',
        credentials: 'include',
        body: fd, // let the browser set the multipart boundary
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
        throw new Error(data.error || `Upload failed: ${res.status}`);
    }
    return { url: data.url, media_type: data.media_type };
}

// ============================================================
// Per-workspace ad account setup (chosen once in Settings)
// ============================================================

export interface AdSettings {
    ad_account_id?: string;
    ad_account_name?: string;
    page_id?: string;
    page_name?: string;
    whatsapp_phone_number_id?: string;
    whatsapp_display_number?: string;
}

/** The workspace's saved Ad Account + Page + WhatsApp number, or null if unset. */
export async function getAdSettings(workspaceId: string): Promise<AdSettings | null> {
    const data = await fetchAPI<{ success: boolean; settings: AdSettings | null }>(
        `/settings?workspace_id=${encodeURIComponent(workspaceId)}`,
    );
    return data.settings;
}

/** Save the workspace's ad account setup (used automatically by the wizard). */
export async function saveAdSettings(workspaceId: string, settings: AdSettings): Promise<AdSettings> {
    const data = await fetchAPI<{ success: boolean; settings: AdSettings }>(
        `/settings`,
        { method: 'PUT', body: JSON.stringify({ workspace_id: workspaceId, ...settings }) },
    );
    return data.settings;
}

// ============================================================
// Advanced targeting (interests search + saved audiences)
// ============================================================

export interface TargetingSearchResult {
    id: string;
    name: string;
    audience_size?: number;
    type?: string;
}

/** Search Meta's targeting catalogue (interests by default). */
export async function searchTargeting(
    workspaceId: string,
    q: string,
    type = 'adinterest',
): Promise<TargetingSearchResult[]> {
    const data = await fetchAPI<{ success: boolean; results: TargetingSearchResult[] }>(
        `/targeting-search?workspace_id=${encodeURIComponent(workspaceId)}&q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}`,
    );
    return data.results || [];
}

export interface SavedAudience {
    id: string;
    name: string;
    approximate_count?: number;
    subtype?: string;
}

/** List the ad account's custom + lookalike audiences. */
export async function listAudiences(workspaceId: string): Promise<SavedAudience[]> {
    const data = await fetchAPI<{ success: boolean; custom_audiences: SavedAudience[] }>(
        `/audiences?workspace_id=${encodeURIComponent(workspaceId)}`,
    );
    return data.custom_audiences || [];
}

// ============================================================
// AI generation (image + ad copy)
// ============================================================

export interface GeneratedCopy {
    primary_text: string;
    headline?: string;
}

/**
 * Generate ad image(s) with AI. `prompt` is OPTIONAL — leave it out and the
 * backend auto-builds one from the workspace's business details.
 */
export async function generateAdImage(
    workspaceId: string,
    prompt?: string,
    count = 2,
): Promise<{ url: string }[]> {
    const data = await fetchAPI<{ success: boolean; images: { url: string }[] }>(
        '/generate-image',
        {
            method: 'POST',
            body: JSON.stringify({ workspace_id: workspaceId, prompt: prompt || undefined, count }),
        },
    );
    return data.images || [];
}

/**
 * Generate ad copy variations with AI. `prompt` is OPTIONAL — without it the
 * backend writes from the workspace's business details.
 */
export async function generateAdCopy(
    workspaceId: string,
    prompt?: string,
    adType?: string,
): Promise<GeneratedCopy[]> {
    const data = await fetchAPI<{ success: boolean; variations: GeneratedCopy[] }>(
        '/generate-copy',
        {
            method: 'POST',
            body: JSON.stringify({ workspace_id: workspaceId, prompt: prompt || undefined, ad_type: adType }),
        },
    );
    return data.variations || [];
}

// ============================================================
// Facebook Ads connection (Ad Account + Page)
// ============================================================

export interface AdsConnectionStatus {
    connected: boolean;
    ad_account_id?: string | null;
    account_name?: string | null;
    connected_at?: string | null;
}

/**
 * Persist a Facebook Ads connection for the workspace. `accessToken` is the
 * short-lived user token from the in-browser Facebook login (ads scopes).
 */
export async function connectAds(
    workspaceId: string,
    accessToken: string,
): Promise<{ connected: boolean; ad_account_count: number; page_count: number }> {
    return fetchAPI('/connect-ads', {
        method: 'POST',
        body: JSON.stringify({ workspace_id: workspaceId, access_token: accessToken }),
    });
}

/** Whether this workspace has a Facebook Ads connection (for the settings UI). */
export async function getAdsConnectionStatus(workspaceId: string): Promise<AdsConnectionStatus> {
    return fetchAPI<AdsConnectionStatus & { success: boolean }>(
        `/connection-status?workspace_id=${encodeURIComponent(workspaceId)}`,
    );
}

/**
 * @deprecated Use getCTWAAccounts instead
 */
export async function getAdAccounts(): Promise<AdAccount[]> {
    return [];
}

/**
 * @deprecated Use getCTWAAccounts instead
 */
export async function getFacebookPages(): Promise<FacebookPage[]> {
    return [];
}

/**
 * @deprecated Use getCTWAAccounts instead
 */
export async function getWhatsAppAccounts(
    _workspaceId: string
): Promise<WhatsAppAccountForAds[]> {
    return [];
}
