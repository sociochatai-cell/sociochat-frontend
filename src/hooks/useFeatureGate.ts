import { useMemo } from 'react';
import { usePlan } from '@/contexts/PlanContext';
import {
    type FeatureKey,
    hasFeatureAccess,
    hasAccess,
    FEATURE_PLAN_MAP,
    getUpgradeMessage,
    PLAN_LABELS,
} from '@/config/featureGating';

export interface FeatureGateResult {
    allowed: boolean;
    userPlan: string;
    upgradeMessage: string;
    requiredPlanLabel: string;
}

export function useFeatureGate(featureKey: FeatureKey): FeatureGateResult {
    const { plan: userPlan, features, loading } = usePlan();

    return useMemo(() => {
        // Access resolution order:
        //   1. While the plan is still loading, allow (avoids a flash of the
        //      upgrade wall on first paint).
        //   2. If the backend's features map KNOWS this key, respect it — this is
        //      what honors per-plan super-admin toggles.
        //   3. If the key is MISSING from the map (e.g. a newly shipped feature the
        //      backend catalog hasn't been re-seeded with yet), fall back to the
        //      plan-tier requirement in FEATURE_PLAN_MAP. Without this, brand-new
        //      features are hard-denied for EVERY plan — including unlimited — until
        //      the backend is reseeded, which is confusing and wrong.
        const known = !!features && features[featureKey] !== undefined;
        let allowed: boolean;
        if (loading) {
            allowed = true;
        } else if (known) {
            allowed = hasFeatureAccess(features, featureKey);
        } else {
            allowed = hasAccess(userPlan, FEATURE_PLAN_MAP[featureKey]);
        }

        return {
            allowed,
            userPlan,
            upgradeMessage: getUpgradeMessage(featureKey),
            requiredPlanLabel: PLAN_LABELS.growth || 'Pro',
        };
    }, [userPlan, features, featureKey, loading]);
}
