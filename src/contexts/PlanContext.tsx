import { createContext, useContext, ReactNode } from 'react';

interface PlanContextType {
    plan: string;
    isPro: boolean;
    isEnterprise: boolean;
    limits: Record<string, number>;
}

const PlanContext = createContext<PlanContextType>({
    plan: 'free',
    isPro: false,
    isEnterprise: false,
    limits: {},
});

export function PlanProvider({ children }: { children: ReactNode }) {
    return (
        <PlanContext.Provider value={{ plan: 'pro', isPro: true, isEnterprise: false, limits: {} }}>
            {children}
        </PlanContext.Provider>
    );
}

export function usePlan() {
    return useContext(PlanContext);
}
