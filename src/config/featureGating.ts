/**
 * Feature Gating Configuration Stub for standalone SocioChat
 * All features are enabled — no plan restrictions.
 */

export type FeatureKey = string;
export type PlanName = 'free' | 'starter' | 'pro' | 'enterprise';

export const FEATURES = {
    WHATSAPP_INBOX: true,
    WHATSAPP_TEMPLATES: true,
    WHATSAPP_AUTOMATION: true,
    WHATSAPP_DRIP_CAMPAIGNS: true,
    WHATSAPP_FLOWS: true,
    WHATSAPP_ANALYTICS: true,
    WHATSAPP_CONTACTS: true,
    WHATSAPP_DATASETS: true,
    WHATSAPP_AI_CHATBOT: true,
    WHATSAPP_KNOWLEDGE_BASE: true,
    WHATSAPP_TRACKING: true,
} as const;

/** Maps feature keys to minimum plan required — all set to 'free' so everything is accessible */
export const FEATURE_PLAN_MAP: Record<string, PlanName> = {
    whatsapp_datasets: 'free',
    whatsapp_contacts: 'free',
    whatsapp_interactive_automation: 'free',
    whatsapp_bulk_messaging: 'free',
    whatsapp_automation: 'free',
    whatsapp_drip: 'free',
    whatsapp_flows: 'free',
    whatsapp_analytics: 'free',
    whatsapp_tracking: 'free',
    whatsapp_knowledge_base: 'free',
    whatsapp_ai_chatbot: 'free',
};

export const PLAN_LABELS: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
};

/** Always returns true — all features are accessible in standalone */
export function hasAccess(userPlan: string, requiredPlan: string): boolean {
    return true;
}

export function isFeatureEnabled(feature: string): boolean {
    return true;
}

export function getFeatureLimit(feature: string): number {
    return Infinity;
}

export function getUpgradeMessage(requiredPlan: string): string {
    return '';
}

export default FEATURES;
