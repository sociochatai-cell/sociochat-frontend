// src/pages/tenant-admin/TenantUserAnalytics.tsx
// Tenant-admin mount of the shared UserAnalyticsConsole. Wires the tenant portal
// endpoints via tenantAdminApi + the existing tenant impersonation flow. No
// Unlink action here (Sociovia link is a platform super-admin concern).
import { useNavigate } from 'react-router-dom';
import UserAnalyticsConsole from '@/components/analytics/UserAnalyticsConsole';
import { useBranding } from '@/branding/BrandingContext';
import type { TenantBranding } from '@/branding/branding';
import { beginImpersonation } from '@/lib/impersonation';
import { tenantAdminApi } from './tenantAdminApi';

export default function TenantUserAnalytics() {
    const navigate = useNavigate();
    const { setBranding } = useBranding();

    const fetchAnalytics = async () => {
        const res = await tenantAdminApi.getUserAnalytics();
        return { summary: res.summary, rows: res.rows };
    };

    // Reuse the existing tenant deleteUser (X-Confirm-Password header). unwrap()
    // throws on failure, so surface the backend message as {ok:false, error}.
    const onDelete = async (id: number, password: string) => {
        try {
            const res = await tenantAdminApi.deleteUser(id, password);
            return { ok: !!res?.success };
        } catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : 'Delete failed' };
        }
    };

    // Reuse the existing tenant impersonation flow (same as TenantAdminUsers):
    // persist the impersonated session, re-theme with the tenant branding, and
    // drop into the dashboard.
    const onImpersonate = async (id: number) => {
        const res = await tenantAdminApi.impersonateUser(id);
        beginImpersonation('/tenant-admin/user-analytics');
        try {
            localStorage.setItem('sv_user', JSON.stringify(res.user));
            sessionStorage.setItem('sv_user', JSON.stringify(res.user));
            localStorage.setItem('sv_user_id', String(res.user.id));
            if (res.tenant?.tenant_code) {
                localStorage.setItem('sv_tenant_code', res.tenant.tenant_code);
            }
            if (res.workspaces?.[0]) {
                localStorage.setItem('sv_whatsapp_workspace_id', String(res.workspaces[0].id));
            }
        } catch {
            // storage may be unavailable — branding + navigation still apply
        }
        if (res.tenant?.branding) {
            setBranding(res.tenant.branding as unknown as TenantBranding, res.tenant.tenant_code);
        }
        navigate('/dashboard');
        return res;
    };

    return (
        <UserAnalyticsConsole
            title="User Analytics"
            fetchAnalytics={fetchAnalytics}
            onDelete={onDelete}
            onImpersonate={onImpersonate}
        />
    );
}
