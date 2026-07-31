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
    ad_type?: AdType;
    status: CampaignStatus;
    daily_budget: number | null;
    lifetime_budget: number | null;
    budget_currency: string;
    start_time: string | null;
    end_time: string | null;
    created_at: string;
    updated_at: string;
    sync_status: 'pending' | 'synced' | 'error';
    /** Official wa.me click-to-chat link — same destination the ad button opens. */
    wa_link?: string | null;
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
    behaviors?: { id: string; name: string }[];
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
 * Ad placement specification (Meta ad set level).
 *
 * For standard Click-to-WhatsApp ads this is left undefined (Meta auto-places
 * across Facebook/Instagram). For WhatsApp Status ads we pin the placement to
 * WhatsApp → Status so the ad only renders inside the WhatsApp Updates tab.
 */
export interface PlacementSpec {
    publisher_platforms: string[];   // e.g. ['whatsapp']
    whatsapp_positions?: string[];   // e.g. ['status']
    facebook_positions?: string[];
    instagram_positions?: string[];
}

/**
 * Which kind of ad this campaign represents. Drives placement + which creator
 * built it. Defaults to 'ctwa' on the backend when omitted.
 */
export type AdType = 'ctwa' | 'status';

/**
 * Create campaign form data
 */
export interface CreateCampaignData {
    workspace_id: string;
    ad_account_id: string;
    name: string;
    ad_type?: AdType;
    placement?: PlacementSpec;
    /** When true, people who message from this ad are auto-added as CRM leads. */
    create_leads?: boolean;
    /** CTA button label type, e.g. WHATSAPP_MESSAGE, GET_QUOTE, BOOK_NOW. */
    cta_type?: string;
    budget_type?: 'daily' | 'lifetime';
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
        /** Carousel cards — when 2+ present, the ad is published as a carousel. */
        cards?: { image_url: string; headline?: string; description?: string }[];
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
