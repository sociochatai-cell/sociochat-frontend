// src/pages/tenant-admin/TenantAdminLayout.tsx
// Sidebar layout for the Tenant Admin portal. Mirrors AdminLayout's structure
// and emerald/slate styling, but the header/logo are driven by the active
// tenant's branding (useBranding) so each white-label tenant sees its own brand.
import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, ArrowLeft, LogOut, Menu, Sparkles, Crown, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/branding/BrandingContext';
import { clearCache } from '@/whatsapp/hooks/useDataCache';
import apiClient from '@/lib/apiClient';
import { MobileNavSheet } from '@/components/layout/MobileNavSheet';

const navItems = [
    { path: '/tenant-admin', label: 'Overview', icon: LayoutDashboard, exact: true },
    { path: '/tenant-admin/users', label: 'Users', icon: Users },
    { path: '/tenant-admin/plan', label: 'Plan & Features', icon: Sparkles },
    { path: '/tenant-admin/subscription', label: 'Subscription', icon: CreditCard },
    { path: '/tenant-admin/private-slot', label: 'Private Slot', icon: Crown },
    { path: '/dashboard', label: 'Back to App', icon: ArrowLeft },
];

export default function TenantAdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logoutLocal } = useAuth();
    const { branding, refresh, resetBranding } = useBranding();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    // Always (re)apply THIS tenant admin's own tenant branding when the portal
    // loads, so the emerald→--brand-* accents render in the tenant's colors —
    // never the default SocioChat green — regardless of how they navigated here.
    useEffect(() => {
        void refresh();
    }, [refresh]);

    const companyName = branding?.company_name || 'Tenant Admin';
    const logoUrl = branding?.logo_url;

    const handleLogout = async () => {
        try {
            await apiClient.post('/auth/logout');
        } catch {
            // ignore network/logout errors — still clear local session below
        }
        logoutLocal();
        // Wipe the in-memory WhatsApp data cache and reset branding to the
        // SocioChat default so the next user/login never sees this tenant's
        // cached data or colors.
        clearCache();
        resetBranding();
        try {
            localStorage.removeItem('sv_user');
            sessionStorage.removeItem('sv_user');
            localStorage.removeItem('sv_user_id');
            localStorage.removeItem('sv_token');
            sessionStorage.removeItem('sv_token');
        } catch {
            // storage may be unavailable — ignore
        }
        navigate('/login');
    };

    const Brand = ({ compact = false }: { compact?: boolean }) => (
        <div className="flex items-center gap-2 min-w-0">
            {logoUrl ? (
                <img
                    src={logoUrl}
                    alt={companyName}
                    className={compact ? 'h-6 w-auto object-contain' : 'h-8 w-auto object-contain'}
                />
            ) : null}
            <div className="min-w-0">
                <h1 className={cn('font-bold text-slate-900 truncate', compact && 'text-sm')}>
                    {companyName}
                </h1>
                {!compact && <p className="text-xs text-slate-500">Admin Portal</p>}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row overflow-x-hidden">
            <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 fixed h-full z-40">
                <div className="p-6">
                    <Brand />
                </div>
                <nav className="flex-1 px-3 space-y-1">
                    {navItems.map((item) => {
                        const isActive = item.exact
                            ? location.pathname === item.path
                            : location.pathname === item.path ||
                              location.pathname.startsWith(item.path + '/');
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={cn(
                                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                    isActive
                                        ? 'bg-emerald-600 text-white'
                                        : 'text-slate-600 hover:bg-slate-100',
                                )}
                            >
                                <item.icon className="h-4 w-4 shrink-0" />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>
                <div className="p-4 border-t">
                    <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleLogout}>
                        <LogOut className="h-4 w-4" /> Sign Out
                    </Button>
                </div>
            </aside>

            <MobileNavSheet
                open={mobileNavOpen}
                onOpenChange={setMobileNavOpen}
                title={companyName}
                items={navItems}
            />

            <div className="flex-1 flex flex-col md:ml-64 min-w-0">
                <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-white px-4 py-3 gap-2">
                    <button
                        type="button"
                        onClick={() => setMobileNavOpen(true)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200"
                        aria-label="Open admin menu"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <Brand compact />
                    <Button variant="ghost" size="sm" className="shrink-0" onClick={handleLogout}>
                        <LogOut className="h-4 w-4" />
                    </Button>
                </header>
                <main className="flex-1 p-4 sm:p-6 md:p-10 min-w-0 overflow-x-hidden">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
