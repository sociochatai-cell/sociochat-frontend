// src/components/superadmin/useSuperAdminApi.ts
// Thin wrapper around the shared apiClient for all Super Admin tenant endpoints.
// Keeps pages clean and centralizes the /api/superadmin/* contract.
import apiClient from '@/lib/apiClient';

/* ----------------------------- Shared types ------------------------------ */

export type ButtonStyle = 'rounded' | 'pill' | 'square';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface Branding {
    company_name: string;
    short_name: string;
    name_suffix: string;
    tagline: string;
    logo_url: string;
    logo_dark_url: string;
    favicon_url: string;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    font_family: string;
    button_style: ButtonStyle;
    theme: ThemeMode;
    support_email: string;
    login_background: string;
    // UI chrome colors (hex). "" = keep the default UI look.
    background_color: string;
    surface_color: string;
    text_color: string;
    border_color: string;
    // Heading font name. "" = same as body font.
    heading_font_family: string;
    // Corner radius preset: "" | "none" | "small" | "medium" | "large" | "xl".
    corner_radius: string;
    landing_video_url: string;
    landing_image_url: string;
    landing_headline: string;
    landing_subheadline: string;
    landing_cta_text: string;
    // Landing feature sections (7): title / description / image each.
    landing_feature1_title: string;
    landing_feature1_desc: string;
    landing_feature1_image: string;
    landing_feature2_title: string;
    landing_feature2_desc: string;
    landing_feature2_image: string;
    landing_feature3_title: string;
    landing_feature3_desc: string;
    landing_feature3_image: string;
    landing_feature4_title: string;
    landing_feature4_desc: string;
    landing_feature4_image: string;
    landing_feature5_title: string;
    landing_feature5_desc: string;
    landing_feature5_image: string;
    landing_feature6_title: string;
    landing_feature6_desc: string;
    landing_feature6_image: string;
    landing_feature7_title: string;
    landing_feature7_desc: string;
    landing_feature7_image: string;
}

export interface TenantListItem {
    id: number | string;
    tenant_code: string;
    company_name: string;
    status: string;
    custom_domain?: string | null;
    subscription_plan?: string | null;
    // When the tenant's subscription lapses (ISO) — null = never expires.
    subscription_expires_at?: string | null;
    created_at?: string | null;
    branding?: Partial<Branding>;
}

export interface FeatureOverride {
    feature_key: string;
    enabled?: boolean;
    limit_value?: number | null;
}

export type DomainStatus = 'none' | 'pending' | 'active' | 'disabled';

export interface TenantDetail {
    id: number | string;
    tenant_code: string;
    company_name: string;
    status: string;
    custom_domain?: string | null;
    phone_number?: string | null;
    domain_verified?: boolean;
    ssl_enabled?: boolean;
    domain_status?: DomainStatus;
    subscription_plan?: string | null;
    created_at?: string | null;
    branding?: Partial<Branding>;
    [key: string]: unknown;
}

export interface TenantSubscription {
    plan_slug: string;
    subscription_expires_at?: string | null;
    // Payment status of the tenant's white-label license (e.g. 'paid' | 'pending').
    payment_status?: string | null;
}

export interface TenantDetailResponse {
    success: boolean;
    tenant: TenantDetail;
    subscription?: TenantSubscription;
    feature_overrides?: FeatureOverride[];
    users_count?: number;
    // The white-label LICENSE plan currently assigned to this tenant (or null).
    tenant_plan?: TenantPlan | null;
}

/* --------------- White-label LICENSE plans (tenant plans) ---------------- */
// A "tenant plan" is a WHITE-LABEL LICENSE the platform sells to tenant owners
// (NOT an end-user subscription plan). The catalog is universal; a tenant can
// additionally have custom license plans scoped to itself. For the max_* fields,
// -1 means "unlimited".
export interface TenantPlan {
    id: number;
    slug: string;
    name: string;
    description?: string | null;
    price_inr?: number | null;
    billing_period?: string | null; // 'monthly' | 'yearly' | 'custom'
    max_end_users?: number | null;   // -1 = unlimited
    max_workspaces?: number | null;  // -1 = unlimited
    is_active?: boolean;
    is_public?: boolean;
    tenant_id?: number | null;
    sort_order?: number | null;
    // Per-feature overrides (matrix shape): { [key]: { enabled, limit_value } }.
    features?: FeatureOverrideMap;
}

// Create/update payload for a white-label LICENSE plan.
export interface TenantPlanInput {
    name: string;
    description?: string;
    price_inr?: number;
    billing_period?: string;
    max_end_users?: number;
    max_workspaces?: number;
    is_active?: boolean;
    sort_order?: number;
    // Per-feature overrides selected in the plan editor.
    features?: FeatureOverrideMap;
}

export interface FeatureCatalogItem {
    key: string;
    label: string;
    category: string;
    feature_type: string; // e.g. 'access' | 'limit'
}

// A user belonging to a tenant (Super Admin user-management view).
export interface TenantUser {
    id: number;
    name: string;
    email: string;
    role: string;
    status: string;
    created_at?: string | null;
}

export interface PlanItem {
    slug: string;
    name: string;
    // Catalog price (INR/month). null/undefined => custom or unpriced.
    price_monthly_inr?: number | null;
    description?: string | null;
}

/* --------------------- Custom per-tenant plans --------------------------- */

// A subscription plan that exists for exactly ONE tenant.
export interface CustomPlan {
    id: number;
    slug: string;
    name: string;
    price_monthly_inr?: number | null;
    tenant_id?: number | null;
}

export interface CreateCustomPlanPayload {
    name: string;
    price_monthly_inr?: number;
    features: FeatureOverrideMap;
}

export interface ListTenantPlansResponse {
    success: boolean;
    custom_plans: CustomPlan[];
    global_plans: PlanItem[];
}

export interface GeneratedCredential {
    tenant_code: string;
    email: string;
    password: string;
}

export interface CreateTenantCredentials {
    admin?: GeneratedCredential;
    demo?: GeneratedCredential;
}

// Per-feature override entry sent to the backend.
export type FeatureOverrideMap = Record<string, { enabled?: boolean; limit_value?: number }>;

export interface CreateTenantPayload {
    company_name: string;
    tenant_code?: string;
    custom_domain?: string;
    phone_number?: string;
    plan: string;
    // Optional subscription expiry chosen at creation (ISO) — omit = never.
    subscription_expires_at?: string | null;
    branding: Branding;
    features: FeatureOverrideMap;
    admin_email?: string;
    demo_email?: string;
}

export interface UpdateTenantPayload {
    company_name?: string;
    custom_domain?: string;
    phone_number?: string;
    status?: string;
    branding?: Partial<Branding>;
}

/* ------------------------- Domain configuration -------------------------- */

export interface SaveDomainResponse {
    success: boolean;
    tenant: TenantDetail;
}

export interface VerifyDomainResponse {
    success: boolean;
    domain_verified: boolean;
    domain_status: DomainStatus;
    resolved_ip?: string | null;
}

export interface SetDomainSslResponse {
    success: boolean;
    ssl_enabled: boolean;
}

export interface DisableDomainResponse {
    success: boolean;
    domain_status: DomainStatus;
}

/* ----------------- Per-tenant Meta / WhatsApp integration ---------------- */

// The integration record returned by GET. Secrets are NEVER returned — only
// `has_*` booleans indicate whether each secret is set.
export interface TenantIntegration {
    tenant_id: number | string;
    meta_app_id: string;
    oauth_redirect_url: string;
    webhook_url: string;
    whatsapp_config_id: string;
    has_app_secret: boolean;
    has_verify_token: boolean;
    // API versions (plain).
    whatsapp_api_version: string;
    fb_api_version: string;
    // Email / SMTP so the tenant can send mail from their own domain (plain).
    smtp_host: string;
    smtp_port: number | null;
    smtp_user: string;
    mail_from: string;
    // Secret presence flags (the secrets themselves are never returned).
    has_smtp_pass: boolean;
    has_gemini_api_key: boolean;
    has_google_sa_json: boolean;
    // SMS gateway (password-reset OTP) — plain fields + secret presence flag.
    sms_provider: string;
    sms_sender_id: string;
    has_sms_api_key: boolean;
    // Payment gateway (PayU) — plain fields + secret presence flag. The merchant
    // salt itself is never returned (write-only); has_payu_salt signals presence.
    payu_key: string;
    payu_mode: string;
    payu_salt_version: string;
    has_payu_salt: boolean;
}

// PUT payload. All fields optional. Secrets (`meta_app_secret`,
// `webhook_verify_token`, `smtp_pass`, `gemini_api_key`, `google_sa_json`) are
// write-only — only send them with a non-empty value to change them; sending
// blank/omitting leaves the existing secret intact.
export interface SaveIntegrationPayload {
    meta_app_id?: string;
    meta_app_secret?: string;
    oauth_redirect_url?: string;
    webhook_url?: string;
    webhook_verify_token?: string;
    whatsapp_config_id?: string;
    // API versions (plain).
    whatsapp_api_version?: string;
    fb_api_version?: string;
    // Email / SMTP (plain).
    smtp_host?: string;
    smtp_port?: number;
    smtp_user?: string;
    mail_from?: string;
    // SMS gateway (plain).
    sms_provider?: string;
    sms_sender_id?: string;
    // Payment gateway (PayU) — plain fields.
    payu_key?: string;
    payu_mode?: string;
    payu_salt_version?: string;
    // Write-only secrets.
    smtp_pass?: string;
    gemini_api_key?: string;
    google_sa_json?: string;
    sms_api_key?: string;
    // Write-only PayU merchant salt.
    payu_salt?: string;
}

/* --------------------------- Default branding ---------------------------- */

export const DEFAULT_BRANDING: Branding = {
    company_name: 'SocioChat',
    short_name: 'SocioChat',
    name_suffix: '.ai',
    tagline: 'WhatsApp marketing, simplified.',
    logo_url: '/sociochat_logo.png',
    logo_dark_url: '',
    favicon_url: '/sociochat_logo.png',
    primary_color: '#25D366',
    secondary_color: '#128C7E',
    accent_color: '#0a6847',
    font_family: 'Inter',
    button_style: 'rounded',
    theme: 'light',
    support_email: '',
    login_background: '',
    background_color: '',
    surface_color: '',
    text_color: '',
    border_color: '',
    heading_font_family: '',
    corner_radius: '',
    landing_video_url: '',
    landing_image_url: '',
    landing_headline: '',
    landing_subheadline: '',
    landing_cta_text: '',
    // Blank = inherit the shared default (see branding.py merge_branding).
    landing_feature1_title: '',
    landing_feature1_desc: '',
    landing_feature1_image: '',
    landing_feature2_title: '',
    landing_feature2_desc: '',
    landing_feature2_image: '',
    landing_feature3_title: '',
    landing_feature3_desc: '',
    landing_feature3_image: '',
    landing_feature4_title: '',
    landing_feature4_desc: '',
    landing_feature4_image: '',
    landing_feature5_title: '',
    landing_feature5_desc: '',
    landing_feature5_image: '',
    landing_feature6_title: '',
    landing_feature6_desc: '',
    landing_feature6_image: '',
    landing_feature7_title: '',
    landing_feature7_desc: '',
    landing_feature7_image: '',
};

export const FONT_OPTIONS = ['Inter', 'Roboto', 'Poppins', 'Montserrat', 'Lato', 'Open Sans'];
export const BUTTON_STYLE_OPTIONS: ButtonStyle[] = ['rounded', 'pill', 'square'];
export const THEME_OPTIONS: ThemeMode[] = ['light', 'dark', 'system'];
export const RADIUS_OPTIONS = ['none', 'small', 'medium', 'large', 'xl'] as const;

/** Merge a partial branding object (from the API) onto the defaults. */
export function mergeBranding(partial?: Partial<Branding> | null): Branding {
    return { ...DEFAULT_BRANDING, ...(partial || {}) };
}

/* ------------------------------- Helpers --------------------------------- */

function unwrap<T = any>(res: { ok: boolean; data?: any; error?: any }): T {
    if (res.ok) return (res.data as T);
    const message =
        res.error?.message ||
        res.error?.error ||
        (typeof res.error === 'string' ? res.error : 'Request failed');
    throw new Error(message);
}

const BASE = '/superadmin';

/* ------------------------------- API calls ------------------------------- */

export const superAdminApi = {
    listTenants: async (): Promise<{ success: boolean; tenants: TenantListItem[] }> =>
        unwrap(await apiClient.get(`${BASE}/tenants`)),

    getTenant: async (id: string | number): Promise<TenantDetailResponse> =>
        unwrap(await apiClient.get(`${BASE}/tenants/${id}`)),

    createTenant: async (
        payload: CreateTenantPayload,
    ): Promise<{ success: boolean; tenant: TenantDetail; credentials: CreateTenantCredentials }> =>
        unwrap(await apiClient.post(`${BASE}/tenants`, payload)),

    updateTenant: async (
        id: string | number,
        payload: UpdateTenantPayload,
    ): Promise<{ success: boolean; tenant: TenantDetail }> =>
        unwrap(await apiClient.put(`${BASE}/tenants/${id}`, payload)),

    suspendTenant: async (id: string | number): Promise<{ success: boolean }> =>
        unwrap(await apiClient.post(`${BASE}/tenants/${id}/suspend`)),

    activateTenant: async (id: string | number): Promise<{ success: boolean }> =>
        unwrap(await apiClient.post(`${BASE}/tenants/${id}/activate`)),

    deleteTenant: async (id: string | number): Promise<{ success: boolean }> =>
        unwrap(await apiClient.delete(`${BASE}/tenants/${id}`)),

    updateSubscription: async (
        id: string | number,
        body: TenantSubscription,
    ): Promise<{ success: boolean }> =>
        unwrap(await apiClient.put(`${BASE}/tenants/${id}/subscription`, body)),

    updateFeatures: async (
        id: string | number,
        overrides: FeatureOverrideMap,
    ): Promise<{ success: boolean }> =>
        unwrap(await apiClient.put(`${BASE}/tenants/${id}/features`, { overrides })),

    /* ----------------- Domain configuration ----------------- */

    saveDomain: async (
        id: string | number,
        custom_domain: string,
    ): Promise<SaveDomainResponse> =>
        unwrap(await apiClient.put(`${BASE}/tenants/${id}/domain`, { custom_domain })),

    verifyDomain: async (
        id: string | number,
    ): Promise<VerifyDomainResponse> =>
        unwrap(await apiClient.post(`${BASE}/tenants/${id}/domain/verify`)),

    setDomainSsl: async (
        id: string | number,
        enabled: boolean,
    ): Promise<SetDomainSslResponse> =>
        unwrap(await apiClient.post(`${BASE}/tenants/${id}/domain/ssl`, { enabled })),

    disableDomain: async (
        id: string | number,
    ): Promise<DisableDomainResponse> =>
        unwrap(await apiClient.post(`${BASE}/tenants/${id}/domain/disable`)),

    impersonate: async (
        id: string | number,
        userId?: number | string,
    ): Promise<{ success: boolean; user: any; workspaces: any[] }> =>
        unwrap(await apiClient.post(`${BASE}/tenants/${id}/impersonate`, userId ? { user_id: userId } : {})),

    // Usage/exhaustion stats for a specific user within a tenant.
    getTenantUserUsage: async (
        tenantId: string | number,
        userId: number | string,
    ): Promise<{ success: boolean; plan: string; usage: any }> =>
        unwrap(await apiClient.get(`${BASE}/tenants/${tenantId}/users/${userId}/usage`)),

    // Permanently delete a tenant user. Requires the super-admin's own password
    // (sent as a header so it never lands in the URL/query logs).
    deleteTenantUser: async (
        tenantId: string | number,
        userId: number | string,
        password: string,
    ): Promise<{ success: boolean }> =>
        unwrap(await apiClient.delete(`${BASE}/tenants/${tenantId}/users/${userId}`, { 'X-Confirm-Password': password })),

    listFeatures: async (): Promise<{ success: boolean; features: FeatureCatalogItem[] }> =>
        unwrap(await apiClient.get(`${BASE}/features`)),

    listPlans: async (): Promise<{ success: boolean; plans: PlanItem[] }> =>
        unwrap(await apiClient.get(`${BASE}/plans`)),

    /* ----------------- Custom per-tenant plans ----------------- */

    listTenantPlans: async (
        tenantId: string | number,
    ): Promise<ListTenantPlansResponse> =>
        unwrap(await apiClient.get(`${BASE}/tenants/${tenantId}/plans`)),

    createCustomPlan: async (
        tenantId: string | number,
        payload: CreateCustomPlanPayload,
    ): Promise<{ success: boolean; plan: CustomPlan }> =>
        unwrap(await apiClient.post(`${BASE}/tenants/${tenantId}/plans`, payload)),

    deleteCustomPlan: async (
        tenantId: string | number,
        planId: number | string,
    ): Promise<{ success: boolean }> =>
        unwrap(await apiClient.delete(`${BASE}/tenants/${tenantId}/plans/${planId}`)),

    /* ----------- White-label LICENSE plans (tenant plans catalog) ----------- */
    // The universal white-label license catalog (sold to tenant owners). These
    // are DISTINCT from the end-user custom plans above.

    listLicensePlans: async (): Promise<{ success: boolean; plans: TenantPlan[] }> =>
        unwrap(await apiClient.get(`${BASE}/tenant-plans`)),

    createLicensePlan: async (
        payload: TenantPlanInput,
    ): Promise<{ success: boolean; plan: TenantPlan }> =>
        unwrap(await apiClient.post(`${BASE}/tenant-plans`, payload)),

    updateLicensePlan: async (
        id: number | string,
        payload: TenantPlanInput,
    ): Promise<{ success: boolean; plan: TenantPlan }> =>
        unwrap(await apiClient.put(`${BASE}/tenant-plans/${id}`, payload)),

    deleteLicensePlan: async (
        id: number | string,
    ): Promise<{ success: boolean }> =>
        unwrap(await apiClient.delete(`${BASE}/tenant-plans/${id}`)),

    // License plans assignable to a specific tenant: the universal catalog plus
    // any custom license plans scoped to that tenant.
    listAssignableLicensePlans: async (
        tenantId: string | number,
    ): Promise<{ success: boolean; universal_plans: TenantPlan[]; custom_plans: TenantPlan[] }> =>
        unwrap(await apiClient.get(`${BASE}/tenants/${tenantId}/tenant-plans`)),

    createCustomLicensePlan: async (
        tenantId: string | number,
        payload: TenantPlanInput,
    ): Promise<{ success: boolean; plan: TenantPlan }> =>
        unwrap(await apiClient.post(`${BASE}/tenants/${tenantId}/tenant-plans`, payload)),

    deleteCustomLicensePlan: async (
        tenantId: string | number,
        id: number | string,
    ): Promise<{ success: boolean }> =>
        unwrap(await apiClient.delete(`${BASE}/tenants/${tenantId}/tenant-plans/${id}`)),

    /* ----------------- Tenant users (password recovery) ----------------- */

    listTenantUsers: async (
        tenantId: string | number,
    ): Promise<{ success: boolean; users: TenantUser[] }> =>
        unwrap(await apiClient.get(`${BASE}/tenants/${tenantId}/users`)),

    resetTenantUserPassword: async (
        tenantId: string | number,
        userId: number | string,
    ): Promise<{ success: boolean; email: string; password: string }> =>
        unwrap(await apiClient.post(`${BASE}/tenants/${tenantId}/users/${userId}/reset-password`)),

    /* ----------------- Per-tenant Meta / WhatsApp integration ----------------- */

    getIntegration: async (
        tenantId: string | number,
    ): Promise<{ success: boolean; integration: TenantIntegration | null }> =>
        unwrap(await apiClient.get(`${BASE}/tenants/${tenantId}/integration`)),

    saveIntegration: async (
        tenantId: string | number,
        payload: SaveIntegrationPayload,
    ): Promise<{ success: boolean; integration: TenantIntegration }> =>
        unwrap(await apiClient.put(`${BASE}/tenants/${tenantId}/integration`, payload)),
};

export default superAdminApi;
