// Impersonation return-stack.
// ===========================
// Multi-level: Super Admin → Tenant Admin → Tenant User, each level pushes a
// bundle onto the stack. "Return to Admin" pops the top, restoring the previous
// level. When the stack is empty, the user is back to their original session.

import apiClient from '@/lib/apiClient';

const STACK_KEY = 'sv_impersonation_stack';

interface ReturnBundle {
    token: string;
    adminId: string;
    user: string;
    returnPath: string;
    tenantCode: string;
    brandVars: string;
}

function _readStack(): ReturnBundle[] {
    try {
        const raw = localStorage.getItem(STACK_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function _writeStack(stack: ReturnBundle[]): void {
    try {
        if (stack.length === 0) {
            localStorage.removeItem(STACK_KEY);
        } else {
            localStorage.setItem(STACK_KEY, JSON.stringify(stack));
        }
    } catch { /* ignore */ }
}

/** Save the CURRENT session onto the stack. Call BEFORE swapping identity. */
export function beginImpersonation(returnPath = '/superadmin/tenants'): void {
    const bundle: ReturnBundle = {
        token: sessionStorage.getItem('sv_token') || localStorage.getItem('sv_token') || '',
        adminId: sessionStorage.getItem('sv_admin_id') || localStorage.getItem('sv_admin_id') || '',
        user: localStorage.getItem('sv_user') || sessionStorage.getItem('sv_user') || '',
        returnPath,
        tenantCode: localStorage.getItem('sv_tenant_code') || '',
        brandVars: localStorage.getItem('sv_brand_vars') || '',
    };
    const stack = _readStack();
    stack.push(bundle);
    _writeStack(stack);

    // CRITICAL: clear the OUTGOING identity's workspace/account context so the
    // impersonated user does NOT inherit the admin's selected workspace. Without
    // this, the dashboard tries to load a workspace the impersonated user doesn't
    // own → 403 → "Connect to WhatsApp". The caller sets the new user's own
    // sv_whatsapp_workspace_id immediately after this, and the dashboard then
    // resolves to the impersonated user's first workspace on load.
    TENANT_CONTEXT_KEYS.concat(['sv_workspaces']).forEach((k) => {
        try {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
        } catch { /* ignore */ }
    });
}

export function hasImpersonationReturn(): boolean {
    return _readStack().length > 0;
}

export function getImpersonationReturnPath(): string {
    const stack = _readStack();
    if (stack.length === 0) return '/superadmin/tenants';
    return stack[stack.length - 1].returnPath || '/superadmin/tenants';
}

/** How many impersonation levels deep we are. */
export function impersonationDepth(): number {
    return _readStack().length;
}

// Tenant-scoped keys to drop when popping a level.
const TENANT_CONTEXT_KEYS = [
    'sv_tenant_code',
    'sv_whatsapp_workspace_id',
    'sv_selected_workspace_id',
    'sv_whatsapp_account_id',
    'current_whatsapp_account_id',
    'selectedAccountId',
    'current_workspace_id',
];

/** Pop the top bundle off the stack and restore that session client-side.
 *  Returns the path to navigate to. Caller must ALSO call exitImpersonation()
 *  and then hard-reload. */
export function restoreAdminSession(): string {
    const stack = _readStack();
    if (stack.length === 0) return '/superadmin/tenants';

    const b = stack.pop()!;
    _writeStack(stack);

    let returnPath = b.returnPath || '/superadmin/tenants';

    // Clear tenant context keys first
    TENANT_CONTEXT_KEYS.forEach((k) => {
        try {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
        } catch { /* ignore */ }
    });

    // Restore token
    if (b.token) {
        localStorage.setItem('sv_token', b.token);
        sessionStorage.setItem('sv_token', b.token);
    }

    // Restore admin ID if present
    if (b.adminId) {
        localStorage.setItem('sv_admin_id', b.adminId);
        sessionStorage.setItem('sv_admin_id', b.adminId);
    } else {
        localStorage.removeItem('sv_admin_id');
        sessionStorage.removeItem('sv_admin_id');
    }

    // Restore user object
    if (b.user) {
        localStorage.setItem('sv_user', b.user);
        sessionStorage.setItem('sv_user', b.user);
        try {
            localStorage.setItem('sv_user_id', String(JSON.parse(b.user)?.id || ''));
        } catch { /* ignore */ }
    } else {
        localStorage.removeItem('sv_user');
        sessionStorage.removeItem('sv_user');
        localStorage.removeItem('sv_user_id');
        sessionStorage.removeItem('sv_user_id');
    }

    // Restore tenant code (critical: prevents stale tenant code from blocking login)
    if (b.tenantCode) {
        localStorage.setItem('sv_tenant_code', b.tenantCode);
    } else {
        localStorage.removeItem('sv_tenant_code');
    }

    // Restore branding cache
    if (b.brandVars) {
        localStorage.setItem('sv_brand_vars', b.brandVars);
    } else {
        localStorage.removeItem('sv_brand_vars');
    }

    return returnPath;
}

/** Discard the entire stack. Call after the final exitImpersonation() succeeds. */
export function clearImpersonationReturn(): void {
    _writeStack([]);
}

/** Re-establish the admin/owner SESSION server-side from the (already-restored)
 *  Bearer token. Returns true only if the server confirmed the flip. */
export async function exitImpersonation(): Promise<boolean> {
    try {
        const res = await apiClient.post('/auth/exit-impersonation');
        return !!(res && res.ok && res.data && res.data.success);
    } catch {
        return false;
    }
}
