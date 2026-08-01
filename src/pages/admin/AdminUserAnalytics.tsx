// src/pages/admin/AdminUserAnalytics.tsx
// Super-admin (T0000) mount of the shared UserAnalyticsConsole. Wires the
// platform admin endpoints via adminApi + the existing impersonation flow.
import { useNavigate } from 'react-router-dom';
import UserAnalyticsConsole from '@/components/analytics/UserAnalyticsConsole';
import { adminApi } from '@/lib/adminApi';
import { useAuth } from '@/contexts/AuthContext';
import { beginImpersonation } from '@/lib/impersonation';

export default function AdminUserAnalytics() {
    const navigate = useNavigate();
    const { loginLocal } = useAuth();

    const fetchAnalytics = async () => {
        const res = await adminApi.getUserAnalytics();
        return { summary: res.summary, rows: res.rows };
    };

    const onDelete = async (id: number, password: string) => {
        const res = await adminApi.deleteUser(id, password);
        return { ok: !!res?.success, error: res?.error };
    };

    // Reuse the Phase-2 per-user Sociovia link toggle (enable=false ⇒ unlink).
    const onUnlink = async (id: number) => {
        const res = await adminApi.setUserSociovia(id, false);
        if (!res?.success) throw new Error(res?.error || 'Unlink failed');
        return res;
    };

    // Reuse the existing admin "login-as-user" impersonation flow (same as
    // AdminUsers' inspectLogin): swap the admin session for the user session and
    // land in the dashboard.
    const onImpersonate = async (id: number) => {
        const res = await adminApi.loginAsUser(id);
        if (!res?.success || !res.user) throw new Error(res?.error || 'Impersonation failed');
        beginImpersonation('/admin/user-analytics');
        if (res.token) {
            localStorage.setItem('sv_token', res.token);
            sessionStorage.setItem('sv_token', res.token);
        }
        localStorage.removeItem('sv_admin_id');
        sessionStorage.removeItem('sv_admin_id');
        loginLocal(res.user);
        localStorage.setItem('sv_user_id', String(res.user.id));
        sessionStorage.setItem('sv_user', JSON.stringify(res.user));
        if (res.workspaces?.[0]) {
            localStorage.setItem('sv_whatsapp_workspace_id', String(res.workspaces[0].id));
        }
        navigate('/dashboard');
        return res;
    };

    return (
        <UserAnalyticsConsole
            title="User Analytics"
            fetchAnalytics={fetchAnalytics}
            onDelete={onDelete}
            onUnlink={onUnlink}
            onImpersonate={onImpersonate}
        />
    );
}
