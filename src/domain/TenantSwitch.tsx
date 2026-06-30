// src/domain/TenantSwitch.tsx
// LOCAL-TESTING route component for `/t/:code` (and bare `/t`).
//
// Visiting `/t/ABC001` stores that tenant_code as the local override and full-
// reloads to `/`, so DomainGate re-runs and resolves the override (rendering the
// whole app — landing/login/dashboard — as that tenant). Visiting `/t`,
// `/t/reset`, `/t/clear`, `/t/default`, or `/t/t0000` clears the override and
// returns to the default SocioChat platform.
//
// The integrator should register BOTH routes → this default export:
//   <Route path="/t" element={<TenantSwitch />} />
//   <Route path="/t/:code" element={<TenantSwitch />} />
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { clearBrandingCache } from "@/branding/branding";
import { setLocalTenantCode, clearLocalTenant } from "@/domain/localTenant";

const RESET_CODES = new Set(["reset", "clear", "default", "t0000"]);

export default function TenantSwitch() {
    const { code } = useParams<{ code?: string }>();

    useEffect(() => {
        const raw = (code ?? "").trim();

        if (!raw || RESET_CODES.has(raw.toLowerCase())) {
            // Back to the default SocioChat platform.
            clearLocalTenant();
        } else {
            setLocalTenantCode(raw);
        }

        // Drop any cached tenant branding so the new tenant's branding
        // re-resolves cleanly on the next load.
        clearBrandingCache();

        // Full reload so DomainGate re-runs and resolves the override.
        window.location.assign("/");
    }, [code]);

    return (
        <div
            style={{
                minHeight: "100vh",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                alignItems: "center",
                justifyContent: "center",
                background: "#f8fafc",
                color: "#475569",
                fontFamily: "Inter, system-ui, sans-serif",
            }}
            aria-busy="true"
            aria-label="Switching workspace"
        >
            <span
                style={{
                    width: "2.5rem",
                    height: "2.5rem",
                    border: "3px solid #e2e8f0",
                    borderTopColor: "rgb(var(--brand-600))",
                    borderRadius: "9999px",
                    display: "inline-block",
                    animation: "sv-tenant-switch-spin 0.7s linear infinite",
                }}
            />
            <span style={{ fontSize: "0.95rem" }}>Switching workspace…</span>
            <style>{"@keyframes sv-tenant-switch-spin{to{transform:rotate(360deg)}}"}</style>
        </div>
    );
}
