import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function RequireAdmin({ children }: { children: JSX.Element }) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    const isAdmin = user?.role === 'admin' || localStorage.getItem('sv_admin_id');
    if (!isAdmin) {
        return <Navigate to="/admin/login" state={{ from: location }} replace />;
    }

    return children;
}
