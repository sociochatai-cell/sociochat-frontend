import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
    endAdminInspect,
    getAdminInspectReturnPath,
    isAdminInspectActive,
} from '@/lib/adminInspect';
import { API_BASE_URL } from '@/config';

export function AdminInspectBanner() {
    const navigate = useNavigate();
    const { loginLocal } = useAuth();

    if (!isAdminInspectActive()) return null;

    const returnPath = getAdminInspectReturnPath();

    const handleReturn = async () => {
        const adminId = localStorage.getItem('sv_admin_id') || sessionStorage.getItem('sv_admin_id');
        try {
            await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
        } catch { /* ignore */ }

        endAdminInspect();

        if (adminId) {
            localStorage.setItem('sv_admin_id', adminId);
            sessionStorage.setItem('sv_admin_id', adminId);
            loginLocal({
                id: Number(adminId),
                role: 'admin',
                name: 'Administrator',
                email: 'admin',
            });
        }

        navigate(returnPath);
    };

    return (
        <div className="sticky top-0 z-[60] flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-950">
            <div className="flex items-center gap-2 text-sm font-medium min-w-0">
                <Shield className="h-4 w-4 shrink-0 text-amber-600" />
                <span className="truncate">Admin inspect mode</span>
            </div>
            <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-amber-300 bg-white hover:bg-amber-100 text-amber-900"
                onClick={handleReturn}
            >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Return to Admin
            </Button>
        </div>
    );
}
