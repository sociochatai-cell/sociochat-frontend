/**
 * Feature Gating — driven by PlanContext / backend /api/subscription/limits
 */

export type FeatureKey =
    | 'whatsapp_inbox'
    | 'whatsapp_templates'
    | 'whatsapp_automation'
    | 'whatsapp_drip'
    | 'whatsapp_interactive_automation'
    | 'whatsapp_flows'
    | 'whatsapp_analytics'
    | 'whatsapp_contacts'
    | 'whatsapp_datasets'
    | 'whatsapp_bulk_messaging'
    | 'whatsapp_tracking'
    | 'whatsapp_catalog'
    | 'whatsapp_ctwa'
    | 'whatsapp_smart_ai'
    | 'image_generation'
    | 'ai_chatbot_dashboard'
    | 'human_agent_whatsapp'
    | 'unified_dashboard_analytics'
    | 'crm'
    | 'whatsapp_coexistence';

export type PlanName = 'beta' | 'starter' | 'growth' | 'enterprise';

/** Route → feature key for GatedRoute */
export const ROUTE_FEATURE_MAP: Record<string, FeatureKey> = {
    '/dashboard/inbox': 'whatsapp_inbox',
    '/dashboard/conversations': 'whatsapp_inbox',
    '/dashboard/templates': 'whatsapp_templates',
    '/dashboard/automation': 'whatsapp_automation',
    '/dashboard/drip': 'whatsapp_drip',
    '/dashboard/interactive-automation': 'whatsapp_interactive_automation',
    '/dashboard/interactive-automations': 'whatsapp_interactive_automation',
    '/dashboard/flows': 'whatsapp_flows',
    '/dashboard/analytics': 'whatsapp_analytics',
    '/dashboard/hub': 'unified_dashboard_analytics',
    '/dashboard/contacts': 'whatsapp_contacts',
    '/dashboard/datasets': 'whatsapp_datasets',
    '/dashboard/bulk': 'whatsapp_bulk_messaging',
    '/dashboard/tracking': 'whatsapp_tracking',
    '/dashboard/catalog': 'whatsapp_catalog',
    '/dashboard/coexistence': 'whatsapp_coexistence',
    '/dashboard/crm': 'crm',
    '/dashboard/crm/leads': 'crm',
    '/dashboard/crm/deals': 'crm',
    '/dashboard/crm/contacts': 'crm',
    '/dashboard/crm/settings': 'crm',
    '/ctwa/create': 'whatsapp_ctwa',
    '/ctwa/campaigns': 'whatsapp_ctwa',
};

export const PLAN_LABELS: Record<string, string> = {
    beta: 'Beta',
    starter: 'Starter',
    growth: 'Growth',
    enterprise: 'Enterprise',
};

export function hasFeatureAccess(
    features: Record<string, { enabled?: boolean }> | null | undefined,
    featureKey: string,
): boolean {
    if (!features) return true;
    const entry = features[featureKey];
    if (!entry) return false;
    return entry.enabled !== false;
}

export function getUpgradeMessage(featureKey: string): string {
    const label = featureKey.replace(/_/g, ' ');
    return `${label.charAt(0).toUpperCase() + label.slice(1)} is not included in your current plan`;
}

/* ----------------------------------------------------------------------------
 * Plan-tier compatibility layer
 * ----------------------------------------------------------------------------
 * Some ported source components (e.g. NavigationCommandCenter) gate features by
 * comparing the user's plan against a minimum required plan, rather than the
 * backend-driven `features` map. The helpers below provide that thin compat
 * surface on top of this module's plan model.
 */

/** Plan hierarchy (higher index = higher tier). Beta is most permissive. */
export const PLAN_HIERARCHY: PlanName[] = ['starter', 'growth', 'enterprise', 'beta'];

/** Numeric tier level for a plan name. */
export function getPlanLevel(plan: string | undefined): number {
    if (!plan) return 0;
    const idx = PLAN_HIERARCHY.indexOf(plan as PlanName);
    return idx === -1 ? 0 : idx;
}

/** Whether `userPlan` meets the minimum `requiredPlan`. */
export function hasAccess(userPlan: string | undefined, requiredPlan: PlanName): boolean {
    // Beta & Enterprise have ALL features — always allow.
    if (userPlan === 'beta' || userPlan === 'enterprise') return true;
    return getPlanLevel(userPlan) >= getPlanLevel(requiredPlan);
}

/** Feature key → minimum plan required. Defaults to 'starter' (available to all). */
export const FEATURE_PLAN_MAP: Record<FeatureKey, PlanName> = {
    whatsapp_inbox: 'starter',
    whatsapp_templates: 'starter',
    whatsapp_automation: 'starter',
    whatsapp_drip: 'starter',
    whatsapp_interactive_automation: 'starter',
    whatsapp_flows: 'starter',
    whatsapp_analytics: 'starter',
    whatsapp_contacts: 'starter',
    whatsapp_datasets: 'starter',
    whatsapp_bulk_messaging: 'starter',
    whatsapp_tracking: 'starter',
    whatsapp_catalog: 'growth',
    whatsapp_ctwa: 'growth',
    whatsapp_smart_ai: 'growth',
    image_generation: 'growth',
    ai_chatbot_dashboard: 'growth',
    human_agent_whatsapp: 'growth',
    unified_dashboard_analytics: 'starter',
    crm: 'starter',
    whatsapp_coexistence: 'starter',
};

export default ROUTE_FEATURE_MAP;
