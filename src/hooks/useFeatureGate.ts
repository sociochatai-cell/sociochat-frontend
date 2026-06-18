import { useMemo } from 'react';
import { usePlan } from '@/contexts/PlanContext';
import {
    type FeatureKey,
    hasFeatureAccess,
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
        const allowed = loading ? true : hasFeatureAccess(features, featureKey);
        return {
            allowed,
            userPlan,
            upgradeMessage: getUpgradeMessage(featureKey),
            requiredPlanLabel: PLAN_LABELS.growth || 'Growth',
        };
    }, [userPlan, features, featureKey, loading]);
}
