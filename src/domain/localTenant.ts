// src/domain/localTenant.ts
// LOCAL-TESTING helper: a "local tenant override" that lets you view the whole
// app as any tenant while on a PLATFORM host (localhost / 127.0.0.1 /
// *.devtunnels.ms / sociochat.ai). In production the hostname does this; here a
// stored tenant_code mirrors that so DomainGate can resolve a specific tenant.
//
// The override is a tenant_code persisted under `sv_local_tenant`. It is only
// ever honored on platform hosts (see DomainGate) — a real custom domain wins.

const LOCAL_TENANT_KEY = "sv_local_tenant";

/** Normalize a tenant code: trim + uppercase. Empty/blank → "". */
function normalizeCode(code: string | null | undefined): string {
    return (code ?? "").trim().toUpperCase();
}

/**
 * Return the active local tenant override, or null if none.
 *
 * Side effect: if the current URL has a `?tenant=CODE` query param, it is
 * persisted to `sv_local_tenant` (and returned), so `?tenant=ABC001` works on
 * any path without first visiting the /t switch route.
 */
export function getLocalTenantCode(): string | null {
    // 1) URL query param takes precedence and is persisted.
    try {
        if (typeof window !== "undefined" && window.location?.search) {
            const params = new URLSearchParams(window.location.search);
            const fromUrl = normalizeCode(params.get("tenant"));
            if (fromUrl) {
                setLocalTenantCode(fromUrl);
                return fromUrl;
            }
        }
    } catch {
        // URL/storage unavailable — fall through to stored value
    }

    // 2) Fall back to the stored override.
    try {
        const stored = normalizeCode(localStorage.getItem(LOCAL_TENANT_KEY));
        return stored || null;
    } catch {
        return null;
    }
}

/** Persist a local tenant override (trimmed + uppercased). */
export function setLocalTenantCode(code: string): void {
    try {
        const normalized = normalizeCode(code);
        if (normalized) {
            localStorage.setItem(LOCAL_TENANT_KEY, normalized);
        } else {
            localStorage.removeItem(LOCAL_TENANT_KEY);
        }
    } catch {
        // storage unavailable (private mode quota) — ignore
    }
}

/** Remove the local tenant override (→ back to the default SocioChat platform). */
export function clearLocalTenant(): void {
    try {
        localStorage.removeItem(LOCAL_TENANT_KEY);
    } catch {
        // storage unavailable — ignore
    }
}
