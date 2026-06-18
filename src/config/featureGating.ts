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
    | 'unified_dashboard_analytics';

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

export default ROUTE_FEATURE_MAP;
