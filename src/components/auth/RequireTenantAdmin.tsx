import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Route guard for the Tenant Admin portal.
 * Allows a logged-in user whose role is 'tenant_admin' (the tenant's own admin)
 * or 'admin' (platform admin). Everyone else is redirected to /login.
 * Mirrors RequireAdmin, including the `loading` spinner behavior.
 */
export default function RequireTenantAdmin({ children }: { children: JSX.Element }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    const isTenantAdmin = user?.role === 'tenant_admin' || user?.role === 'admin';
    if (!isTenantAdmin) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}
