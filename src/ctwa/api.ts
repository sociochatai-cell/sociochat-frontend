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

const API_BASE = '/api/ctwa';

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
 * Delete a draft campaign
 */
export async function deleteCampaign(campaignId: number): Promise<void> {
    await fetchAPI(`/campaigns/${campaignId}`, { method: 'DELETE' });
}

/**
 * Publish campaign to Meta
 */
export async function publishCampaign(
    campaignId: number,
    activate: boolean = false
): Promise<CTWACampaign> {
    const data = await fetchAPI<{
        success: boolean;
        campaign: CTWACampaign;
        meta_campaign_id: string;
    }>(`/campaigns/${campaignId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ activate }),
    });
    return data.campaign;
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
