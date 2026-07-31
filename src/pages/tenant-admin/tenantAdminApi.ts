// src/pages/tenant-admin/tenantAdminApi.ts
// Thin wrapper around the shared apiClient for the Tenant Admin portal.
// Centralizes the /api/tenant/admin/* contract. A tenant admin is a logged-in
// User with role 'tenant_admin'; auth rides on the apiClient's existing
// session cookie / headers — no extra headers needed here.
import apiClient from '@/lib/apiClient';

/* ------------------------------- Types ----------------------------------- */

export type TenantUserRole = 'user' | 'tenant_admin';
export type TenantUserStatus = 'active' | 'suspended' | string;

export interface TenantUser {
    id: number | string;
    name: string;
    email: string;
    role: string;
    status: TenantUserStatus;
    business_name?: string | null;
    created_at?: string | null;
}

export interface TenantInfo {
    id: number | string;
    tenant_code: string;
    company_name: string;
    status: string;
    branding?: Record<string, unknown> | null;
    subscription_plan?: string | null;
}

export interface TenantSubscription {
    plan_slug: string;
    subscription_expires_at?: string | null;
}

export interface OverviewResponse {
    success: boolean;
    tenant: TenantInfo;
    subscription: TenantSubscription | null;
    users_count: number;
    /** The tenant's own white-label license plan (set by the platform). */
    tenant_plan?: TenantPlan | null;
}

/* ------------------- Tenant's own white-label license -------------------- */
// The tenant owner's self-service "My Subscription": the white-label LICENSE
// the platform granted this tenant, plus the catalog of license plans the
// tenant owner may switch to themselves (payment is a placeholder for now).

/** A white-label license plan offered to tenant owners. `max_*` of -1 ⇒ Unlimited. */
export interface TenantPlan {
    id: number;
    slug: string;
    name: string;
    description?: string | null;
    price_inr?: number | null;
    billing_period?: string | null;
    max_end_users?: number | null;
    max_workspaces?: number | null;
    is_active?: boolean;
    is_public?: boolean;
    tenant_id?: number | null;
    sort_order?: number | null;
}

/** The tenant's currently-selected license + its payment/expiry state. */
export interface TenantSubscriptionInfo {
    plan_slug: string;
    subscription_expires_at?: string | null;
    payment_status?: string | null;
}

export interface AdminSubscriptionResponse {
    success: boolean;
    subscription: TenantSubscriptionInfo | null;
    tenant_plan: TenantPlan | null;
    available_plans: TenantPlan[];
}

/** Step 1 of the placeholder checkout: the amount due for the chosen plan. */
export interface CheckoutInfo {
    plan_slug: string;
    plan_name: string | null;
    amount_inr: number | null;
    billing_period: string | null;
    currency: string;
    status: string;
    gateway: string | null;
}

export interface CheckoutResponse {
    success: boolean;
    checkout: CheckoutInfo;
}

export interface TenantPayuConfig {
    payu_key: string;
    payu_mode: string;        // "test" | "production"
    payu_salt_version: string; // "v1" | "v2"
    has_payu_salt: boolean;
    configured: boolean;
}

export interface UsersResponse {
    success: boolean;
    users: TenantUser[];
}

export interface CreateUserPayload {
    name: string;
    email: string;
    password?: string;
    role: TenantUserRole;
}

export interface CreateUserResponse {
    success: boolean;
    user: TenantUser;
    generated_password?: string;
}

export interface UpdateUserPayload {
    name?: string;
    status?: TenantUserStatus;
    role?: TenantUserRole;
    password?: string;
}

export interface UpdateUserResponse {
    success: boolean;
    user: TenantUser;
}

export interface ResetPasswordResponse {
    success: boolean;
    password: string;
}

export interface ImpersonatedUser {
    id: number | string;
    name: string;
    email: string;
    role: string;
    tenant_id: number | string;
}

export interface ImpersonateTenant {
    tenant_code: string;
    company_name: string;
    branding?: Record<string, unknown> | null;
}

export interface ImpersonateWorkspace {
    id: number | string;
    [key: string]: unknown;
}

export interface ImpersonateResponse {
    success: boolean;
    user: ImpersonatedUser;
    tenant: ImpersonateTenant;
    workspaces?: ImpersonateWorkspace[];
}

export interface PlanResponse {
    success: boolean;
    plan_slug: string;
    subscription_expires_at?: string | null;
    limits: Record<string, number>;
    features: Record<string, boolean>;
    users_count: number;
}

export interface FeatureCatalogItem {
    key: string;
    label: string;
    category: string;
    feature_type: string;
}

/** Per-feature override entry on a tenant custom plan. */
export interface TenantPlanFeature {
    enabled: boolean;
    limit_value?: number | null;
}

/** Feature matrix keyed by feature key (prefills the per-plan matrix editor). */
export type TenantPlanFeatureMap = Record<string, TenantPlanFeature>;

export interface TenantCustomPlan {
    id: number | string;
    slug: string;
    name: string;
    price_monthly_inr?: number | null;
    /** Billing cadence: 'monthly' | 'quarterly' | 'yearly' (defaults to 'monthly'). */
    billing_period?: string | null;
    /** Short promo note shown to users (e.g. "Save 20%"). '' ⇒ cleared. */
    offer_text?: string | null;
    is_active?: boolean;
    /** Current PlanFeatureAccess matrix, so the matrix editor can prefill. */
    features?: TenantPlanFeatureMap;
}

export interface TenantPlansResponse {
    success: boolean;
    custom_plans: TenantCustomPlan[];
    base_plans: { slug: string; name: string }[];
}

export type TenantFeatureOverrideMap = Record<string, { enabled?: boolean; limit_value?: number }>;

export interface CreatePlanPayload {
    name: string;
    price_monthly_inr?: number;
    /** 'monthly' | 'quarterly' | 'yearly' (defaults to 'monthly' server-side). */
    billing_period?: string;
    /** Short promo note shown to users. '' ⇒ cleared. */
    offer_text?: string;
    features: TenantFeatureOverrideMap;
}

export interface UserFeaturesResponse {
    success: boolean;
    plan: string;
    /** Effective access-feature flags after applying plan defaults + overrides. */
    features: Record<string, boolean>;
    /** The plan's access-feature defaults BEFORE any per-user override (drives the "inherit" label / value). */
    plan_defaults?: Record<string, boolean>;
    /** The user's explicit per-feature overrides (presence ⇒ on/off; absence ⇒ inherit). */
    overrides: { feature_key: string; enabled: boolean }[];
}

export interface DnsRecord {
    host: string;
    target: string;
}

export interface DnsInstructions {
    cname?: DnsRecord | null;
    a_record?: DnsRecord | null;
}

export interface DomainInfoResponse {
    success: boolean;
    custom_domain?: string | null;
    domain_status?: string | null;
    domain_verified?: boolean;
    ssl_enabled?: boolean;
    dns_instructions?: DnsInstructions | null;
}

/* --------------------------- Private Slot -------------------------------- */
// One shared "private" pool of this tenant's own users. Private users can be
// assigned tenant-private plans (created here) plus the global tiers. Mirrors
// the platform super-admin private-slot contract, scoped to /tenant/admin/*.

export type BillingScope = 'global' | 'private';

export interface PrivateSlotUser {
    id: number | string;
    name: string;
    email: string;
    billing_scope: BillingScope;
    plan: string;
}

/** Per-feature override entry on a private plan. */
export interface PrivatePlanFeature {
    enabled: boolean;
    limit_value?: number | null;
}

export type PrivatePlanFeatureMap = Record<string, PrivatePlanFeature>;

export interface PrivatePlan {
    id: number | string;
    slug: string;
    name: string;
    price_monthly_inr?: number | null;
    /** 'monthly' | 'quarterly' | 'yearly' (defaults to 'monthly'). */
    billing_period?: string | null;
    /** Short promo note shown to users. '' ⇒ cleared. */
    offer_text?: string | null;
    is_active: boolean;
    features: PrivatePlanFeatureMap;
}

export interface PrivateGlobalTier {
    slug: string;
    name: string;
}

export interface PrivateSlotResponse {
    success: boolean;
    users: PrivateSlotUser[];
    private_members: PrivateSlotUser[];
    private_plans: PrivatePlan[];
    // Backend returns plain slug strings (e.g. ["starter","growth",...]).
    global_tiers: string[];
    feature_catalog: FeatureCatalogItem[];
}

export interface CreatePrivatePlanPayload {
    name: string;
    price_monthly_inr?: number;
    /** 'monthly' | 'quarterly' | 'yearly' (defaults to 'monthly' server-side). */
    billing_period?: string;
    /** Short promo note shown to users. '' ⇒ cleared. */
    offer_text?: string;
    features: PrivatePlanFeatureMap;
}

export interface UpdatePrivatePlanPayload {
    name?: string;
    is_active?: boolean;
    price_monthly_inr?: number;
    /** 'monthly' | 'quarterly' | 'yearly'. */
    billing_period?: string;
    /** Short promo note shown to users. '' ⇒ cleared. */
    offer_text?: string;
}

/* ------------------------------- Helpers --------------------------------- */

/**
 * Unwrap an apiClient `{ ok, data, error }` result into the response data,
 * throwing an Error with the backend's message on failure. Lets pages use
 * plain async/await + try/catch (mirrors the superadmin wrapper's `unwrap`).
 */
function unwrap<T = any>(res: { ok: boolean; data?: any; error?: any }): T {
    if (res.ok) return res.data as T;
    const message =
        res.error?.message ||
        res.error?.error ||
        (typeof res.error === 'string' ? res.error : 'Request failed');
    throw new Error(message);
}

const BASE = '/tenant/admin';

/* ------------------------------- API calls ------------------------------- */

export const tenantAdminApi = {
    overview: async (): Promise<OverviewResponse> =>
        unwrap(await apiClient.get(`${BASE}/overview`)),

    listUsers: async (): Promise<UsersResponse> =>
        unwrap(await apiClient.get(`${BASE}/users`)),

    createUser: async (payload: CreateUserPayload): Promise<CreateUserResponse> =>
        unwrap(await apiClient.post(`${BASE}/users`, payload)),

    updateUser: async (
        id: string | number,
        payload: UpdateUserPayload,
    ): Promise<UpdateUserResponse> =>
        unwrap(await apiClient.patch(`${BASE}/users/${id}`, payload)),

    resetPassword: async (id: string | number): Promise<ResetPasswordResponse> =>
        unwrap(await apiClient.post(`${BASE}/users/${id}/reset-password`)),

    // Delete a user — requires the admin's own password (sent as a header so it
    // isn't logged in the URL).
    deleteUser: async (id: string | number, password: string): Promise<{ success: boolean }> =>
        unwrap(await apiClient.delete(`${BASE}/users/${id}`, { 'X-Confirm-Password': password })),

    // "Login as / Impersonate" a user in THIS tenant. Returns the impersonated
    // user, the tenant (code + branding to re-theme the app), and the user's
    // workspaces so the dashboard can resume.
    impersonateUser: async (id: string | number): Promise<ImpersonateResponse> =>
        unwrap(await apiClient.post(`${BASE}/users/${id}/impersonate`)),

    // Usage/exhaustion stats for one user in THIS tenant.
    getUserUsage: async (
        id: string | number,
    ): Promise<{ success: boolean; plan: string; usage: any }> =>
        unwrap(await apiClient.get(`${BASE}/users/${id}/usage`)),

    // Read-only plan, limits, and feature flags for the current tenant.
    getPlan: async (): Promise<PlanResponse> =>
        unwrap(await apiClient.get(`${BASE}/plan`)),

    // The tenant owner's own white-label LICENSE: current subscription, the
    // matching license plan, and the catalog of plans they can switch to.
    getMySubscription: async (): Promise<AdminSubscriptionResponse> =>
        unwrap(await apiClient.get(`${BASE}/subscription`)),

    // Placeholder checkout — Step 1: record the chosen plan as pending and
    // return the amount due so the UI can render the "pay" screen.
    checkoutPlan: async (plan_slug: string): Promise<CheckoutResponse> =>
        unwrap(await apiClient.post(`${BASE}/subscription/checkout`, { plan_slug })),

    // Placeholder checkout — Step 2: PLACEHOLDER gateway success marks the
    // chosen plan active/paid and returns the refreshed subscription.
    confirmPlanPayment: async (
        plan_slug: string,
    ): Promise<{ success: boolean; subscription: any; tenant_plan: TenantPlan | null }> =>
        unwrap(await apiClient.post(`${BASE}/subscription/confirm`, { plan_slug })),

    // Tenant owner self-selects a white-label license plan. Free/custom plans
    // apply directly; a PRICED plan returns HTTP 402 {requires_payment:true} and
    // must be paid via PayU. Returns the RAW apiClient result so the caller can
    // branch on status without unwrap() throwing.
    selectMyPlanResult: async (plan_slug: string) =>
        apiClient.post(`${BASE}/subscription`, { plan_slug }),

    // Tenant's OWN PayU credentials (Bring-Your-Own). The salt is write-only:
    // GET returns masked flags; PUT only overwrites the salt when a value is sent.
    getPayuConfig: async (): Promise<{ success: boolean; payu: TenantPayuConfig }> =>
        unwrap(await apiClient.get(`${BASE}/payu`)),

    savePayuConfig: async (
        payload: Partial<{ payu_key: string; payu_salt: string; payu_mode: string; payu_salt_version: string }>,
    ): Promise<{ success: boolean; payu: TenantPayuConfig }> =>
        unwrap(await apiClient.put(`${BASE}/payu`, payload)),

    // Feature catalog (to render per-user / per-plan feature toggles).
    featuresCatalog: async (): Promise<{ success: boolean; features: FeatureCatalogItem[] }> =>
        unwrap(await apiClient.get(`${BASE}/features-catalog`)),

    // Subscription plans this tenant admin can create/assign to their users.
    listPlans: async (): Promise<TenantPlansResponse> =>
        unwrap(await apiClient.get(`${BASE}/plans`)),

    createPlan: async (payload: CreatePlanPayload): Promise<{ success: boolean; plan: TenantCustomPlan }> =>
        unwrap(await apiClient.post(`${BASE}/plans`, payload)),

    // Update a custom plan's name / active state / billing period / price / offer (own-tenant plans only).
    updatePlan: async (
        planId: string | number,
        payload: { name?: string; is_active?: boolean; billing_period?: string; price_monthly_inr?: number; offer_text?: string },
    ): Promise<{ success: boolean; plan: TenantCustomPlan }> =>
        unwrap(await apiClient.put(`${BASE}/plans/${planId}`, payload)),

    deletePlan: async (planId: string | number): Promise<{ success: boolean }> =>
        unwrap(await apiClient.delete(`${BASE}/plans/${planId}`)),

    // Replace/upsert a custom plan's full feature matrix (access + limits).
    updatePlanFeatures: async (
        planId: string | number,
        features: TenantPlanFeatureMap,
    ): Promise<{ success: boolean; plan: TenantCustomPlan }> =>
        unwrap(await apiClient.put(`${BASE}/plans/${planId}/features`, { features })),

    // Per-user subscription + feature control (scoped to this tenant's users).
    setUserPlan: async (userId: string | number, plan_slug: string): Promise<{ success: boolean; user: TenantUser }> =>
        unwrap(await apiClient.put(`${BASE}/users/${userId}/plan`, { plan_slug })),

    getUserFeatures: async (userId: string | number): Promise<UserFeaturesResponse> =>
        unwrap(await apiClient.get(`${BASE}/users/${userId}/features`)),

    // Per-user feature overrides. `null` clears the override (inherit the plan
    // default); `true`/`false` set an explicit on/off override.
    setUserFeatures: async (
        userId: string | number,
        overrides: Record<string, boolean | null>,
    ): Promise<{ success: boolean }> =>
        unwrap(await apiClient.put(`${BASE}/users/${userId}/features`, { overrides })),

    // Custom-domain + DNS info for the current tenant. Note this lives at
    // /tenant/domain-info (not under /tenant/admin), per the backend contract.
    getDomainInfo: async (): Promise<DomainInfoResponse> =>
        unwrap(await apiClient.get('/tenant/domain-info')),

    /* --------------------------- Private Slot ---------------------------- */
    // Full snapshot for the Private Slot page: this tenant's users, the private
    // members, the tenant-private plans (+ their feature matrix), the global
    // tiers private users may also pick, and the feature catalog.
    getPrivateSlot: async (): Promise<PrivateSlotResponse> =>
        unwrap(await apiClient.get(`${BASE}/private-slot`)),

    // Move a single user in/out of the private slot.
    setUserScope: async (
        userId: string | number,
        scope: BillingScope,
    ): Promise<{ success: boolean; user: PrivateSlotUser }> =>
        unwrap(await apiClient.patch(`${BASE}/private-slot/users/${userId}/scope`, { scope })),

    // Move several users in/out of the private slot at once.
    bulkSetScope: async (
        userIds: (string | number)[],
        scope: BillingScope,
    ): Promise<{ success: boolean; updated: number }> =>
        unwrap(await apiClient.patch(`${BASE}/private-slot/users/scope`, { user_ids: userIds, scope })),

    // Assign a plan (private plan slug or global tier slug) to a private user.
    setPrivateUserPlan: async (
        userId: string | number,
        planSlug: string,
    ): Promise<{ success: boolean; user: PrivateSlotUser }> =>
        unwrap(await apiClient.put(`${BASE}/private-slot/users/${userId}/plan`, { plan_slug: planSlug })),

    // Create a tenant-private plan.
    createPrivatePlan: async (
        payload: CreatePrivatePlanPayload,
    ): Promise<{ success: boolean; plan: PrivatePlan }> =>
        unwrap(await apiClient.post(`${BASE}/private-slot/plans`, payload)),

    // Update a private plan's name / active state.
    updatePrivatePlan: async (
        id: string | number,
        payload: UpdatePrivatePlanPayload,
    ): Promise<{ success: boolean; plan: PrivatePlan }> =>
        unwrap(await apiClient.put(`${BASE}/private-slot/plans/${id}`, payload)),

    // Delete a private plan.
    deletePrivatePlan: async (id: string | number): Promise<{ success: boolean }> =>
        unwrap(await apiClient.delete(`${BASE}/private-slot/plans/${id}`)),

    // Replace a private plan's full feature matrix (access toggles + limits).
    updatePrivatePlanFeatures: async (
        id: string | number,
        features: PrivatePlanFeatureMap,
    ): Promise<{ success: boolean; plan: PrivatePlan }> =>
        unwrap(await apiClient.put(`${BASE}/private-slot/plans/${id}/features`, { features })),
};

export default tenantAdminApi;
