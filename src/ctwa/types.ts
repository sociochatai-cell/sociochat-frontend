// CTWA (Click-to-WhatsApp Ads) TypeScript Types
// ==============================================

/**
 * Campaign status values
 */
export type CampaignStatus = 'DRAFT' | 'PAUSED' | 'ACTIVE' | 'ARCHIVED';

/**
 * Ad review status
 */
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

/**
 * Media type for ads
 */
export type MediaType = 'image' | 'video';

/**
 * CTWA Campaign
 */
export interface CTWACampaign {
    id: number;
    workspace_id: string;
    meta_campaign_id: string | null;
    ad_account_id: string;
    name: string;
    objective: string;
    status: CampaignStatus;
    daily_budget: number | null;
    lifetime_budget: number | null;
    budget_currency: string;
    start_time: string | null;
    end_time: string | null;
    created_at: string;
    updated_at: string;
    sync_status: 'pending' | 'synced' | 'error';
    adsets?: CTWAAdSet[];
}

/**
 * CTWA Ad Set
 */
export interface CTWAAdSet {
    id: number;
    workspace_id: string;
    campaign_id: number;
    meta_adset_id: string | null;
    name: string;
    status: CampaignStatus;
    optimization_goal: string;
    billing_event: string;
    bid_strategy: string;
    daily_budget: number | null;
    targeting: TargetingSpec | null;
    page_id: string;
    whatsapp_phone_number_id: string;
    start_time: string | null;
    end_time: string | null;
    created_at: string;
    updated_at: string;
    ads?: CTWAAd[];
}

/**
 * CTWA Ad
 */
export interface CTWAAd {
    id: number;
    workspace_id: string;
    adset_id: number;
    meta_ad_id: string | null;
    meta_creative_id: string | null;
    name: string;
    status: CampaignStatus;
    effective_status: string | null;
    primary_text: string | null;
    headline: string | null;
    description: string | null;
    media_type: MediaType | null;
    media_url: string | null;
    cta_type: string;
    ice_breakers: IceBreaker[] | null;
    prefilled_message: string | null;
    review_status: ReviewStatus;
    rejection_reasons: string[] | null;
    created_at: string;
    updated_at: string;
}

/**
 * Ice breaker quick reply
 */
export interface IceBreaker {
    text: string;
}

/**
 * Targeting specification
 */
export interface TargetingSpec {
    geo_locations?: {
        countries?: string[];
        cities?: { key: string; name: string }[];
    };
    age_min?: number;
    age_max?: number;
    genders?: number[]; // 0=all, 1=male, 2=female
    interests?: { id: string; name: string }[];
    custom_audiences?: { id: string; name: string }[];
}

/**
 * Campaign metrics
 */
export interface CampaignMetrics {
    campaign_id: number;
    meta_campaign_id: string | null;
    name: string;
    status: CampaignStatus;
    period: string;
    metrics: {
        impressions: number;
        clicks: number;
        spend: number;
        conversations: number;
        cost_per_conversation: number | null;
        meta_conversations?: number;
    };
}

/**
 * Analytics summary
 */
export interface AnalyticsSummary {
    total_conversations: number;
    ctwa_conversations: number;
    organic_conversations: number;
    active_campaigns: number;
    ctwa_percentage: number;
}

/**
 * Attribution data from CTWA ads
 */
export interface CTWAAttribution {
    ad_id: string;
    ctwa_clid: string;
    source_type: string;
    headline?: string;
    body?: string;
    media_type?: string;
    image_url?: string;
    campaign_id?: string;
    campaign_name?: string;
    adset_id?: string;
    adset_name?: string;
    ad_name?: string;
    attributed_at?: string;
    enriched?: boolean;
}

/**
 * Create campaign form data
 */
export interface CreateCampaignData {
    workspace_id: string;
    ad_account_id: string;
    name: string;
    daily_budget?: number;
    lifetime_budget?: number;
    budget_currency?: string;
    start_time?: string;
    end_time?: string;
    page_id?: string;
    whatsapp_phone_number_id?: string;
    targeting?: TargetingSpec;
    creative?: {
        primary_text?: string;
        headline?: string;
        description?: string;
        media_type?: MediaType;
        media_url?: string;
        ice_breakers?: IceBreaker[];
        prefilled_message?: string;
    };
}

/**
 * Ad account from Meta
 */
export interface AdAccount {
    id: string;
    account_id: string;
    name: string;
    currency?: string;
    timezone_name?: string;
}

/**
 * Facebook page
 */
export interface FacebookPage {
    id: string;
    name: string;
    access_token?: string;
}

/**
 * WhatsApp account for ads
 */
export interface WhatsAppAccountForAds {
    id: number | string;
    phone_number_id: string;
    display_phone_number: string;
    verified_name: string | null;
    is_active?: boolean;
}
