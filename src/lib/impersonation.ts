// Impersonation return-stack.
// ===========================
// When a super-admin impersonates a tenant/user we FULLY switch the browser to
// that user's identity (user JWT as Bearer, admin markers cleared) so the tenant
// renders correctly and post-payment redirects don't bounce back to the admin.
// That switch, however, removed the old "return to admin" path. This module saves
// the admin's own session BEFORE the switch so we can restore it exactly on
// "Return to Admin".
//
// IMPORTANT: restoring the admin token client-side is NOT sufficient — the backend
// resolves identity from the SESSION first and the Bearer token only as a fallback
// (auth_core.authenticated_user_id / authenticated_admin_id). So the return flow
// must also call POST /api/superadmin/resume-admin to pop session['user_id'] and
// re-set session['admin_id'].

import apiClient from '@/lib/apiClient';

const BUNDLE_KEY = 'sv_impersonation_return';

interface ReturnBundle {
    token: string;
    adminId: string;
    user: string; // JSON string of the admin user object
    returnPath: string;
}

/** Save the CURRENT (admin) session so we can return to it. Call this BEFORE
 *  swapping the browser to the impersonated user's identity. */
export function beginImpersonation(returnPath = '/superadmin/tenants'): void {
    const bundle: ReturnBundle = {
        token: sessionStorage.getItem('sv_token') || localStorage.getItem('sv_token') || '',
        adminId: sessionStorage.getItem('sv_admin_id') || localStorage.getItem('sv_admin_id') || '',
        user: localStorage.getItem('sv_user') || sessionStorage.getItem('sv_user') || '',
        returnPath,
    };
    try {
        localStorage.setItem(BUNDLE_KEY, JSON.stringify(bundle));
    } catch {
        /* ignore */
    }
}

export function hasImpersonationReturn(): boolean {
    return !!localStorage.getItem(BUNDLE_KEY);
}

export function getImpersonationReturnPath(): string {
    try {
        return (JSON.parse(localStorage.getItem(BUNDLE_KEY) || '{}') as ReturnBundle).returnPath || '/superadmin/tenants';
    } catch {
        return '/superadmin/tenants';
    }
}

// Tenant-scoped keys that must be dropped when returning to the platform/admin so
// the SocioChat super-admin surface re-renders cleanly (no leaked tenant context).
const TENANT_CONTEXT_KEYS = [
    'sv_tenant_code',
    'sv_whatsapp_workspace_id',
    'sv_selected_workspace_id',
    'sv_whatsapp_account_id',
    'current_whatsapp_account_id',
    'selectedAccountId',
    'current_workspace_id',
];

/** Restore the saved admin session (client side) and clear the impersonated
 *  tenant context. Returns the path to navigate back to. Caller must ALSO hit
 *  POST /api/superadmin/resume-admin and then do a full reload. */
export function restoreAdminSession(): string {
    let returnPath = '/superadmin/tenants';
    try {
        const b = JSON.parse(localStorage.getItem(BUNDLE_KEY) || '{}') as ReturnBundle;
        returnPath = b.returnPath || returnPath;
        if (b.token) {
            localStorage.setItem('sv_token', b.token);
            sessionStorage.setItem('sv_token', b.token);
        }
        if (b.adminId) {
            localStorage.setItem('sv_admin_id', b.adminId);
            sessionStorage.setItem('sv_admin_id', b.adminId);
        }
        if (b.user) {
            // Owner realm (tenant-admin) — restore the owner's own user object.
            localStorage.setItem('sv_user', b.user);
            sessionStorage.setItem('sv_user', b.user);
            try {
                localStorage.setItem('sv_user_id', String(JSON.parse(b.user)?.id || ''));
            } catch {
                /* ignore */
            }
        } else {
            // Admin realms (super-admin / platform-admin) carry NO sv_user — they
            // authenticate via sv_admin_id + admin JWT. Drop the impersonated user
            // identity so it doesn't linger after returning to the admin surface.
            localStorage.removeItem('sv_user');
            sessionStorage.removeItem('sv_user');
            localStorage.removeItem('sv_user_id');
            sessionStorage.removeItem('sv_user_id');
        }
    } catch {
        /* ignore */
    }
    TENANT_CONTEXT_KEYS.forEach((k) => {
        try {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
        } catch {
            /* ignore */
        }
    });
    // NOTE: the return bundle is intentionally NOT discarded here — the caller
    // discards it (via clearImpersonationReturn) ONLY after the server confirms
    // the session was flipped back, so a failed exit keeps a working retry path.
    return returnPath;
}

/** Discard the saved return bundle. Call this ONLY after exitImpersonation()
 *  succeeds, so a transient failure leaves the banner + bundle intact for retry. */
export function clearImpersonationReturn(): void {
    try {
        localStorage.removeItem(BUNDLE_KEY);
    } catch {
        /* ignore */
    }
}

/** Re-establish the admin/owner SESSION server-side from the (already-restored)
 *  Bearer token — the backend resolves identity from the session before the
 *  token, so restoring the token client-side alone is not enough (critically for
 *  the tenant-admin realm, whose token was never swapped and cannot override a
 *  stale session['user_id']). Returns true only if the server confirmed the flip. */
export async function exitImpersonation(): Promise<boolean> {
    try {
        const res = await apiClient.post('/auth/exit-impersonation');
        return !!(res && res.ok && res.data && res.data.success);
    } catch {
        return false;
    }
}
