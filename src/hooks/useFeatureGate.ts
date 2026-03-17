// src/hooks/useFeatureGate.ts
// ============================
// Hook to check if a feature is available on the user's current plan

import { useMemo } from 'react';
import { usePlan } from '@/contexts/PlanContext';
import {
    type FeatureKey,
    FEATURE_PLAN_MAP,
    hasAccess,
    getUpgradeMessage,
    PLAN_LABELS,
    type PlanName,
} from '@/config/featureGating';

export interface FeatureGateResult {
    /** Whether the user can access this feature */
    allowed: boolean;
    /** The user's current plan name */
    userPlan: string;
    /** The minimum plan required for this feature */
    requiredPlan: PlanName;
    /** Human-readable upgrade message */
    upgradeMessage: string;
    /** Human-readable required plan label */
    requiredPlanLabel: string;
}

/**
 * Check if the current user's plan allows access to a specific feature
 *
 * @example
 * const { allowed, upgradeMessage } = useFeatureGate('workflow_builder');
 * if (!allowed) showTooltip(upgradeMessage);
 */
export function useFeatureGate(featureKey: FeatureKey): FeatureGateResult {
    const { plan: userPlan } = usePlan();

    return useMemo(() => {
        const requiredPlan = FEATURE_PLAN_MAP[featureKey] || 'starter';
        const allowed = hasAccess(userPlan, requiredPlan);
        const upgradeMessage = getUpgradeMessage(requiredPlan);
        const requiredPlanLabel = PLAN_LABELS[requiredPlan];

        return {
            allowed,
            userPlan,
            requiredPlan,
            upgradeMessage,
            requiredPlanLabel,
        };
    }, [userPlan, featureKey]);
}

/**
 * Check multiple features at once
 *
 * @example
 * const gates = useFeatureGates(['workflow_builder', 'brand_dna']);
 * gates.workflow_builder.allowed // boolean
 */
export function useFeatureGates<K extends FeatureKey>(
    featureKeys: K[]
): Record<K, FeatureGateResult> {
    const { plan: userPlan } = usePlan();

    return useMemo(() => {
        const result = {} as Record<K, FeatureGateResult>;

        for (const key of featureKeys) {
            const requiredPlan = FEATURE_PLAN_MAP[key] || 'starter';
            result[key] = {
                allowed: hasAccess(userPlan, requiredPlan),
                userPlan,
                requiredPlan,
                upgradeMessage: getUpgradeMessage(requiredPlan),
                requiredPlanLabel: PLAN_LABELS[requiredPlan],
            };
        }

        return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userPlan, featureKeys.join(',')]);
}
