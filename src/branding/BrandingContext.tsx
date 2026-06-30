// src/branding/BrandingContext.tsx
// Provides the active tenant branding to the app, applies it to the document,
// and keeps it fresh in the background.
import {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useRef,
    ReactNode,
} from "react";
import apiClient from "@/lib/apiClient";
import {
    TenantBranding,
    DEFAULT_BRANDING,
    applyBranding,
    loadCachedBranding,
    cacheBranding,
    isPlatformHost,
    clearBrandingCache,
} from "./branding";

interface BrandingContextType {
    branding: TenantBranding;
    /** Apply + cache a branding object (used after login or live login-page theming). */
    setBranding: (branding: TenantBranding, tenantCode?: string) => void;
    /** Reset to the default SocioChat brand and clear cached tenant branding. */
    resetBranding: () => void;
    /** Re-fetch the current tenant's branding from the backend. */
    refresh: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType>({
    branding: DEFAULT_BRANDING,
    setBranding: () => {},
    resetBranding: () => {},
    refresh: async () => {},
});

/** Merge a possibly-partial backend branding payload with the defaults. */
function normalize(partial: Partial<TenantBranding> | null | undefined): TenantBranding {
    return { ...DEFAULT_BRANDING, ...(partial || {}) } as TenantBranding;
}

/**
 * True only when a real TENANT user is logged in (has a tenant, not the
 * platform super-admin). On the shared platform URL we use this to decide
 * whether to show the tenant's brand or the default SocioChat brand — so a
 * leftover tenant's cached branding never leaks onto the normal landing page.
 */
function activeTenantUser(): boolean {
    try {
        const raw = localStorage.getItem("sv_user") || sessionStorage.getItem("sv_user");
        if (!raw) return false;
        const u = JSON.parse(raw);
        return Boolean(u && u.tenant_id && u.role !== "admin");
    } catch {
        return false;
    }
}

export function BrandingProvider({ children }: { children: ReactNode }) {
    const [branding, setBrandingState] = useState<TenantBranding>(() => {
        // On the shared platform URL (localhost / devtunnel / sociochat.ai),
        // show the DEFAULT SocioChat brand unless a real tenant user is logged
        // in — never a leftover tenant's cached branding. On a tenant custom
        // domain the DomainGate applies the right brand.
        if (isPlatformHost() && !activeTenantUser()) return DEFAULT_BRANDING;
        return loadCachedBranding() || DEFAULT_BRANDING;
    });
    const appliedOnce = useRef(false);

    const setBranding = useCallback((next: TenantBranding, tenantCode?: string) => {
        const normalized = normalize(next);
        setBrandingState(normalized);
        applyBranding(normalized);
        cacheBranding(normalized, tenantCode);
    }, []);

    const resetBranding = useCallback(() => {
        setBrandingState(DEFAULT_BRANDING);
        applyBranding(DEFAULT_BRANDING);
        clearBrandingCache();
    }, []);

    const refresh = useCallback(async () => {
        try {
            // apiClient prepends `${API_BASE_URL}/api`, so omit the `/api` prefix.
            const res = await apiClient.get<{
                success?: boolean;
                tenant_code?: string;
                company_name?: string;
                branding?: Partial<TenantBranding>;
            }>("/tenant/branding");

            if (res.ok && res.data?.success && res.data.branding) {
                const normalized = normalize(res.data.branding);
                setBrandingState(normalized);
                applyBranding(normalized);
                cacheBranding(normalized, res.data.tenant_code);
            }
        } catch {
            // keep cached/default branding on any failure
        }
    }, []);

    // On mount: apply cached/default branding immediately (fast paint), then
    // fetch fresh branding in the background if a tenant context is known —
    // either a resolved tenant code or an active auth token (the backend
    // resolves the tenant from the token). This guarantees the tenant's colors
    // reliably re-apply on every page load / reload.
    useEffect(() => {
        if (!appliedOnce.current) {
            applyBranding(branding);
            appliedOnce.current = true;
        }
        // Only re-fetch tenant branding when a real tenant user is authenticated.
        // The platform super-admin and logged-out visitors stay on the default
        // SocioChat brand (their tenant has none / no tenant), so the normal
        // landing page never inherits a leftover tenant's colors.
        if (activeTenantUser()) {
            void refresh();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <BrandingContext.Provider value={{ branding, setBranding, resetBranding, refresh }}>
            {children}
        </BrandingContext.Provider>
    );
}

export function useBranding() {
    return useContext(BrandingContext);
}
