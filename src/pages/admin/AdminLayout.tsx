import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Users, CreditCard, LayoutGrid, LogOut, ShieldCheck, UserSearch, ClipboardList, Menu, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { adminApi } from '@/lib/adminApi';
import { useAuth } from '@/contexts/AuthContext';
import { MobileNavSheet } from '@/components/layout/MobileNavSheet';

const navItems = [
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/inspect-login', label: 'Inspect Login', icon: UserSearch },
    { path: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
    { path: '/admin/plans', label: 'Plans & Features', icon: LayoutGrid },
    { path: '/admin/private-slot', label: 'Private Slot', icon: Lock },
    { path: '/admin/review', label: 'Pending Review', icon: ClipboardList },
];

export default function AdminLayout() {
    const navigate = useNavigate();
    const location = useLocation();
    const { logoutLocal } = useAuth();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const handleLogout = async () => {
        await adminApi.logout();
        localStorage.removeItem('sv_admin_id');
        sessionStorage.removeItem('sv_admin_id');
        logoutLocal();
        navigate('/admin/login');
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row overflow-x-hidden">
            <aside className="hidden md:flex w-64 flex-col bg-white border-r border-slate-200 fixed h-full z-40">
                <div className="p-6 flex items-center gap-2">
                    <ShieldCheck className="h-8 w-8 text-emerald-600" />
                    <div>
                        <h1 className="font-bold text-slate-900">Admin</h1>
                        <p className="text-xs text-slate-500">SocioChat</p>
                    </div>
                </div>
                <nav className="flex-1 px-3 space-y-1">
                    {navItems.map(item => (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                location.pathname === item.path
                                    ? 'bg-emerald-600 text-white'
                                    : 'text-slate-600 hover:bg-slate-100'
                            )}
                        >
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </button>
                    ))}
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
                title="Admin Portal"
                items={navItems}
            />

            <div className="flex-1 flex flex-col md:ml-64 min-w-0">
                <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-white px-4 py-3">
                    <button
                        type="button"
                        onClick={() => setMobileNavOpen(true)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200"
                        aria-label="Open admin menu"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-emerald-600" />
                        <span className="font-semibold text-sm">Admin</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleLogout}>
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
