// src/domain/DomainGate.tsx
// Gates the entire app on custom-domain resolution at startup.
//
// On mount it asks the backend which tenant (if any) owns the current hostname:
//   GET /api/tenant/by-domain?host=<window.location.hostname>  (public)
//
//   • 200 success                 → apply that tenant's branding (version-gated
//                                    so we only re-apply when it actually changed)
//                                    and render the app.
//   • 404 domain_not_configured   → render <DomainNotConfigured/> and block the
//                                    app entirely (no children, no redirect).
//   • network / any other error   → FAIL-OPEN: render children, so a backend
//                                    hiccup or offline dev never bricks the app.
//
// Platform hosts (sociochat.ai, localhost, 127.0.0.1, *.devtunnels.ms) always
// resolve to the internal tenant T0000 on the backend, so the app renders
// normally there — only an explicit 404 blocks.
import { useEffect, useState, type ReactNode } from "react";
import { API_BASE_URL } from "@/config";
import { useBranding } from "@/branding/BrandingContext";
import { isPlatformHost, type TenantBranding } from "@/branding/branding";
import { getLocalTenantCode, clearLocalTenant } from "@/domain/localTenant";
import DomainNotConfigured from "@/pages/DomainNotConfigured";

interface ByDomainSuccess {
    success: true;
    tenant_id: number | string;
    tenant_code: string;
    company_name: string;
    branding: Partial<TenantBranding>;
    features?: unknown;
    branding_version: string | number;
}

type GateStatus = "loading" | "ready" | "blocked";

const DOMAIN_CACHE_KEY = "sv_domain";
const DOMAIN_VERSION_KEY = "sv_domain_branding_version";
const TENANT_CODE_KEY = "sv_tenant_code";

function Loader() {
    return (
        <div
            style={{
                minHeight: "100vh",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f8fafc",
            }}
            aria-busy="true"
            aria-label="Loading"
        >
            <span
                style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    border: "3px solid #e2e8f0",
                    borderTopColor: "rgb(var(--brand-600))",
                    borderRadius: "9999px",
                    display: "inline-block",
                    animation: "sv-domain-spin 0.7s linear infinite",
                }}
            />
            <style>{"@keyframes sv-domain-spin{to{transform:rotate(360deg)}}"}</style>
        </div>
    );
}

export default function DomainGate({ children }: { children: ReactNode }) {
    const { setBranding } = useBranding();
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    // The shared platform / localhost / dev-tunnel host renders the app
    // immediately (no blocking network round-trip → fast first paint). Its
    // branding is owned by BrandingProvider (default SocioChat) and login.
    const platform = isPlatformHost(host);
    // LOCAL-TESTING: on a platform host, a stored "local tenant override"
    // (a tenant_code) makes us resolve THAT tenant instead of the default
    // SocioChat — mirroring how the hostname does it in production. The override
    // is only ever honored on platform hosts; a real custom domain wins.
    const override = getLocalTenantCode();
    // Platform host with an override must gate (loading) while we resolve the
    // override tenant. Platform host without an override renders immediately.
    const [status, setStatus] = useState<GateStatus>(
        platform ? (override ? "loading" : "ready") : "loading",
    );

    useEffect(() => {
        // Platform host with NO override: nothing to gate — never block, never fetch.
        if (platform && !override) return;

        // StrictMode runs effects twice in dev; the `cancelled` flag makes the
        // first (cleaned-up) run a no-op while the second run resolves `status`.
        // (A prior `ranRef` guard caused a permanent "loading" hang here.)
        let cancelled = false;

        // On a platform host honor the local tenant override (by tenant code);
        // on a real custom domain resolve by hostname and ignore any override.
        const url =
            platform && override
                ? `${API_BASE_URL}/api/tenant/by-domain?code=${encodeURIComponent(override)}`
                : `${API_BASE_URL}/api/tenant/by-domain?host=${encodeURIComponent(host)}`;

        async function resolveDomain() {
            try {
                const res = await fetch(url, { credentials: "include" });

                // ── Explicit 404: domain not configured ──
                if (res.status === 404) {
                    let payload: { success?: boolean; error?: string } | null = null;
                    try {
                        payload = await res.json();
                    } catch {
                        payload = null;
                    }
                    if (payload?.error === "domain_not_configured") {
                        // Platform-host override that doesn't resolve: drop the
                        // bad override and fall back to the SocioChat platform.
                        if (platform && override) {
                            clearLocalTenant();
                            if (!cancelled) setStatus("ready");
                            return;
                        }
                        // Real custom domain not configured → block the app.
                        if (!cancelled) setStatus("blocked");
                        return;
                    }
                    if (!cancelled) setStatus("ready");
                    return;
                }

                // ── Non-2xx (other than handled 404): fail open ──
                if (!res.ok) {
                    if (!cancelled) setStatus("ready");
                    return;
                }

                const data = (await res.json()) as ByDomainSuccess;

                // Apply the resolved tenant's branding (custom domain OR the
                // platform-host local override — same cache writes either way).
                if (data?.success && data.branding) {
                    setBranding({ ...data.branding } as TenantBranding, data.tenant_code);
                    try {
                        const version = String(data.branding_version ?? "");
                        localStorage.setItem(
                            DOMAIN_CACHE_KEY,
                            JSON.stringify({
                                tenant_id: data.tenant_id,
                                tenant_code: data.tenant_code,
                                branding_version: version,
                            }),
                        );
                        localStorage.setItem(DOMAIN_VERSION_KEY, version);
                        localStorage.setItem(TENANT_CODE_KEY, data.tenant_code);
                    } catch {
                        // storage unavailable (private mode quota) — ignore
                    }
                }

                if (!cancelled) setStatus("ready");
            } catch {
                // network / parse / other error → fail open
                if (!cancelled) setStatus("ready");
            }
        }

        void resolveDomain();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [platform, host, override]);

    if (status === "loading") return <Loader />;
    if (status === "blocked") return <DomainNotConfigured host={host} />;
    return <>{children}</>;
}
