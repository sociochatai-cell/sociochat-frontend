// src/lib/payu.ts
// PayU hosted-checkout helper. Asks the backend to create a payment, then
// auto-submits a hidden form to PayU's hosted page (a full-page redirect).
import { API_BASE_URL } from '@/config';

export type InitiateType = 'user_plan' | 'tenant_license';

export interface InitiateResult {
    ok: boolean;
    error?: string;
    isTenantLicense?: boolean;
}

function resolveUserId(): string | null {
    const direct = localStorage.getItem('sv_user_id');
    if (direct) return direct;
    // Fallback to the sv_user object (mirrors apiClient) so the header is sent
    // even when only sv_user is present.
    try {
        const u = localStorage.getItem('sv_user');
        if (u) {
            const parsed = JSON.parse(u);
            if (parsed?.id) return String(parsed.id);
        }
    } catch { /* ignore */ }
    return null;
}

export function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const userId = resolveUserId();
    if (userId) headers['X-User-Id'] = userId;
    const adminId = sessionStorage.getItem('sv_admin_id') || localStorage.getItem('sv_admin_id');
    if (adminId) headers['X-Admin-Id'] = adminId;
    const token = sessionStorage.getItem('sv_token') || localStorage.getItem('sv_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

function submitToPayu(action: string, params: Record<string, string>) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    Object.entries(params).forEach(([k, v]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = String(v ?? '');
        form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
}

/**
 * Start a PayU checkout for the given plan. On success this REDIRECTS the page
 * to PayU (the returned promise won't resolve in that case). On failure it
 * resolves with ok=false and a machine-readable error code.
 *
 * `returnTo` is where the user should land AFTER the payment result screen
 * (success or failure) — e.g. '/dashboard' for the signup flow, or the
 * tenant-admin / super-admin page they started from. If omitted, we capture the
 * current page so they come back exactly where they were.
 */
export async function startPayuCheckout(
    type: InitiateType,
    plan: string,
    returnTo?: string,
    recurring?: boolean,
): Promise<InitiateResult> {
    try {
        // Persist across the full-page redirect to PayU and back (same origin).
        const back = returnTo || (window.location.pathname + window.location.search);
        localStorage.setItem('sv_payment_return_to', back);
        const res = await fetch(`${API_BASE_URL}/api/payments/initiate`, {
            method: 'POST',
            credentials: 'include',
            headers: authHeaders(),
            // return_origin = the exact origin the checkout started from (the
            // tenant's own domain for white-label users). The backend returns the
            // browser here after PayU so branding + session survive the round-trip.
            // recurring=true registers a PayU autopay mandate (auto-renew).
            body: JSON.stringify({ type, plan, return_origin: window.location.origin, recurring: !!recurring }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) {
            return {
                ok: false,
                error: (data && data.error) || 'initiate_failed',
                isTenantLicense: !!(data && data.is_tenant_license),
            };
        }
        submitToPayu(data.action, data.params);
        return { ok: true };
    } catch {
        return { ok: false, error: 'network_error' };
    }
}

/** Human-readable message for an initiate error code. */
export function payuErrorMessage(code?: string, isTenantLicense?: boolean): string {
    switch (code) {
        case 'payu_not_configured':
            return isTenantLicense
                ? 'Payments are not set up yet. Please contact support.'
                : 'This workspace has not set up payments yet. Please ask your administrator to add PayU credentials in Integration settings.';
        case 'plan_not_payable':
        case 'contact_sales':
            return 'This plan has custom pricing — please contact sales.';
        case 'invalid_plan':
            return 'That plan is not available for your account.';
        case 'tenant_admin_required':
            return 'Only a workspace administrator can change the license plan.';
        case 'authentication_required':
            return 'Please log in again to continue.';
        default:
            return 'Could not start the payment. Please try again.';
    }
}
