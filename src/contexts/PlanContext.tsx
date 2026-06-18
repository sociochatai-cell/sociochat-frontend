import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { API_BASE_URL } from '@/config';
import { useAuth } from '@/contexts/AuthContext';

export interface FeatureAccess {
    enabled: boolean;
}

export interface PlanLimits {
    workspaces: number;
    users: number;
    messages_per_day: number;
    interactive_flows: number;
    image_credits: number;
    ad_spend_limit: number;
}

interface PlanContextShape {
    plan: string;
    loading: boolean;
    expired: boolean;
    limits: PlanLimits | null;
    features: Record<string, FeatureAccess> | null;
    refreshPlan: () => Promise<void>;
    isFeatureEnabled: (key: string) => boolean;
}

const PlanContext = createContext<PlanContextShape>({
    plan: 'beta',
    loading: true,
    expired: false,
    limits: null,
    features: null,
    refreshPlan: async () => {},
    isFeatureEnabled: () => true,
});

export function PlanProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [plan, setPlan] = useState('beta');
    const [limits, setLimits] = useState<PlanLimits | null>(null);
    const [features, setFeatures] = useState<Record<string, FeatureAccess> | null>(null);
    const [expired, setExpired] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchPlan = useCallback(async () => {
        const userId = user?.id || localStorage.getItem('sv_user_id');
        if (!userId) {
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/subscription/limits`, {
                credentials: 'include',
                headers: { 'X-User-Id': String(userId) },
            });
            const data = await res.json();
            if (data.success) {
                if (data.plan) {
                    setPlan(data.plan);
                    localStorage.setItem('sv_user_plan', data.plan);
                }
                if (data.limits) {
                    setLimits(data.limits);
                    localStorage.setItem('sv_plan_limits', JSON.stringify(data.limits));
                }
                if (data.features) {
                    setFeatures(data.features);
                    localStorage.setItem('sv_plan_features', JSON.stringify(data.features));
                }
                setExpired(!!data.expired);
            } else if (user?.plan) {
                setPlan(user.plan);
            }
        } catch {
            try {
                const cached = localStorage.getItem('sv_plan_features');
                if (cached) setFeatures(JSON.parse(cached));
                const cachedPlan = localStorage.getItem('sv_user_plan');
                if (cachedPlan) setPlan(cachedPlan);
            } catch { /* ignore */ }
        } finally {
            setLoading(false);
        }
    }, [user?.id, user?.plan]);

    useEffect(() => {
        setLoading(true);
        fetchPlan();
    }, [fetchPlan]);

    const isFeatureEnabled = useCallback((key: string) => {
        if (!features) return true;
        return features[key]?.enabled !== false;
    }, [features]);

    const refreshPlan = useCallback(async () => {
        setLoading(true);
        await fetchPlan();
    }, [fetchPlan]);

    return (
        <PlanContext.Provider value={{ plan, loading, expired, limits, features, refreshPlan, isFeatureEnabled }}>
            {children}
        </PlanContext.Provider>
    );
}

export function usePlan() {
    return useContext(PlanContext);
}
