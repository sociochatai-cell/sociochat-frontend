import React, { useState, useEffect, useRef, Suspense } from 'react';
import { NavLink, useLocation, Outlet, useNavigate } from 'react-router-dom';
import AgentChatPanel from '@/agent_frontend/components/AgentChatPanel';
import { useAgentStore } from '@/agent_frontend/agentStore';
import {
    MessageSquare, LayoutTemplate, Bot, BarChart3,
    Settings, Users, Database, Send, Workflow, Zap,
    Inbox, LogOut, Link2, User, ChevronRight,
    ChevronDown, Home,
    ChevronsLeft, ChevronsRight, Smartphone,
} from 'lucide-react';
import {
    motion,
    useMotionValue,
    useSpring,
    useTransform,
    AnimatePresence,
} from 'framer-motion';
import { API_BASE_URL } from '@/config';

/* ══════════════════════════════════════════════
   NAV ITEMS
   ══════════════════════════════════════════════ */
const NAV_ITEMS = [
    { label: 'Dashboard', path: '/dashboard', icon: Home, exact: true },
    { label: 'Hub', path: '/dashboard/hub', icon: LayoutTemplate },
    { label: 'Inbox', path: '/dashboard/inbox', icon: Inbox },
    { label: 'Bulk Send', path: '/dashboard/bulk', icon: Send },
    { label: 'Templates', path: '/dashboard/templates', icon: LayoutTemplate },
    { label: 'Automation', path: '/dashboard/automation', icon: Bot },
    { label: 'Drip Campaigns', path: '/dashboard/drip', icon: Zap },
    { label: 'Interactive Flows', path: '/dashboard/interactive-automation', icon: Workflow },
    { label: 'Flows', path: '/dashboard/flows', icon: Workflow },
    { label: 'Catalog', path: '/dashboard/catalog', icon: Link2 },
    { label: 'Contacts', path: '/dashboard/contacts', icon: Users },
    { label: 'Datasets', path: '/dashboard/datasets', icon: Database },
    { label: 'Tracking', path: '/dashboard/tracking', icon: BarChart3 },
    { label: 'Coexistence', path: '/dashboard/coexistence', icon: Smartphone },
];

const SIDEBAR_COLLAPSED_W = 72;
const SIDEBAR_EXPANDED_W = 240;

/* ══════════════════════════════════════════════
   UTILITY: clear all user data on logout
   ══════════════════════════════════════════════ */
function clearAllUserData() {
    const lsKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sv_') || key.startsWith('sociochat_'))) lsKeys.push(key);
    }
    lsKeys.forEach(k => localStorage.removeItem(k));
    const ssKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('sv_') || key.startsWith('sociochat_'))) ssKeys.push(key);
    }
    ssKeys.forEach(k => sessionStorage.removeItem(k));
}

/* ══════════════════════════════════════════════
   DOCK ITEM — fish-eye magnification (collapsed)
   ══════════════════════════════════════════════ */
function DockItem({
    icon: Icon,
    label,
    path,
    isActive,
    mouseY,
    exact,
}: {
    icon: React.ElementType;
    label: string;
    path: string;
    isActive: boolean;
    mouseY?: ReturnType<typeof useMotionValue<number>>;
    exact?: boolean;
}) {
    const ref = useRef<HTMLAnchorElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    // Create a fallback MotionValue if none is provided
    const fallbackY = useMotionValue(Infinity);
    const activeY = mouseY || fallbackY;

    // Calculate distance from mouse to the center of this icon
    const distance = useTransform(activeY, (val: number) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return 150;
        return val - rect.y - rect.height / 2;
    });

    // True macOS dock physics: neighboring icons also grow
    const sizeSpring = useSpring(
        useTransform(distance, [-80, 0, 80], [40, 56, 40]),
        { stiffness: 400, damping: 25, mass: 0.1 }
    );

    const iconSizeSpring = useSpring(
        useTransform(distance, [-80, 0, 80], [18, 26, 18]),
        { stiffness: 400, damping: 25, mass: 0.1 }
    );

    return (
        <NavLink
            ref={ref}
            to={path}
            end={exact}
            className="relative group flex items-center justify-center outline-none"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <motion.div
                style={{ width: sizeSpring, height: sizeSpring }}
                className={`
                    relative flex items-center justify-center rounded-[14px]
                    transition-colors cursor-pointer
                    ${isActive
                        ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/30'
                        : 'bg-white/50 text-slate-500 hover:text-emerald-600'
                    }
                `}
                animate={{
                    boxShadow: isHovered && !isActive
                        ? '0 0 16px rgba(16,185,129,0.35), 0 0 4px rgba(16,185,129,0.2)'
                        : isActive
                            ? '0 4px 16px rgba(16,185,129,0.25)'
                            : '0 1px 4px rgba(0,0,0,0.04)',
                }}
            >
                {/* Glow ring on hover */}
                <AnimatePresence>
                    {isHovered && !isActive && (
                        <motion.div
                            className="absolute inset-0 rounded-[14px] ring-2 ring-emerald-400/50"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            style={{ boxShadow: '0 0 12px rgba(16,185,129,0.3)' }}
                        />
                    )}
                </AnimatePresence>

                <motion.div style={{ width: iconSizeSpring, height: iconSizeSpring }} className="flex items-center justify-center">
                    <Icon className="w-full h-full" strokeWidth={isActive ? 2.2 : 1.6} />
                </motion.div>

                {isActive && (
                    <motion.div
                        layoutId="dock-dot"
                        className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-emerald-400"
                        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    />
                )}
            </motion.div>

            {/* Tooltip — name label */}
            <AnimatePresence>
                {isHovered && (
                    <motion.div
                        initial={{ opacity: 0, x: -4, scale: 0.92 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -4, scale: 0.92 }}
                        transition={{ duration: 0.12 }}
                        className="absolute left-full ml-4 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap bg-slate-900 text-white shadow-2xl pointer-events-none"
                        style={{ zIndex: 9999, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
                    >
                        {label}
                        <div className="absolute left-0 top-1/2 -translate-x-[5px] -translate-y-1/2 w-2.5 h-2.5 rotate-45 bg-slate-900" />
                    </motion.div>
                )}
            </AnimatePresence>
        </NavLink>
    );
}

/* ══════════════════════════════════════════════
   SIDEBAR (collapsed = dock, expanded = full)
   ══════════════════════════════════════════════ */
function Sidebar({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
    const location = useLocation();
    const mouseY = useMotionValue(Infinity);

    return (
        <motion.aside
            animate={{ width: expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 h-screen z-50 flex flex-col"
            onMouseMove={(e) => !expanded && mouseY.set(e.clientY)}
            onMouseLeave={() => mouseY.set(Infinity)}
            style={{
                background: expanded
                    ? 'linear-gradient(180deg, rgba(255,255,255,0.97) 0%, rgba(241,245,249,0.95) 100%)'
                    : 'transparent',
                borderRight: expanded ? '1px solid rgba(0,0,0,0.06)' : 'none',
            }}
        >
            {/* Logo */}
            <div className={`flex items-center gap-3 py-4 ${expanded ? 'px-5' : 'px-0 justify-center'}`}>
                <NavLink to="/dashboard" className="group flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md ring-1 ring-white/50 group-hover:ring-emerald-400/40 transition-all flex-shrink-0">
                        <img src="/sociochat_logo.png" alt="SocioChat" className="w-full h-full object-cover" />
                    </div>
                    {expanded && (
                        <motion.div
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -8 }}
                            className="flex flex-col"
                        >
                            <span className="text-base font-bold text-slate-800">SocioChat<span className="text-emerald-600">.ai</span></span>
                            <span className="text-[10px] text-slate-400 -mt-0.5">WhatsApp Business</span>
                        </motion.div>
                    )}
                </NavLink>
            </div>

            {/* Separator */}
            {!expanded && <div className="w-8 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent mx-auto mb-2" />}
            {expanded && <div className="h-px bg-slate-100 mx-4 mb-2" />}

            {/* Nav Items */}
            {expanded ? (
                /* ── EXPANDED: standard sidebar with icon + label ── */
                <nav className="flex-1 overflow-y-auto py-1 px-3 space-y-0.5 no-scrollbar">
                    {NAV_ITEMS.map(({ label, path, icon: Icon, exact }) => {
                        const isActive = exact
                            ? location.pathname === path
                            : location.pathname === path || location.pathname.startsWith(path + '/');
                        return (
                            <NavLink
                                key={path}
                                to={path}
                                end={exact}
                                className={`
                                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium
                                    transition-all duration-150
                                    ${isActive
                                        ? 'bg-gradient-to-r from-emerald-500/10 to-teal-500/5 text-emerald-700 shadow-sm ring-1 ring-emerald-200/40'
                                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                                    }
                                `}
                            >
                                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.6} className="flex-shrink-0" />
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.05 }}
                                >
                                    {label}
                                </motion.span>
                            </NavLink>
                        );
                    })}
                </nav>
            ) : (
                /* ── COLLAPSED: dock with fish-eye magnification ── */
                <div className="flex-1 mx-1.5 relative" style={{ overflow: 'visible' }}>
                    <div
                        className="h-full flex flex-col items-center gap-1 py-2 px-1.5 rounded-[20px]"
                        style={{
                            background: 'linear-gradient(180deg, rgba(241,245,249,0.85) 0%, rgba(226,232,240,0.7) 100%)',
                            backdropFilter: 'blur(24px) saturate(1.8)',
                            border: '1px solid rgba(255,255,255,0.6)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)',
                            overflow: 'visible',
                        }}
                    >
                        {NAV_ITEMS.map(({ label, path, icon, exact }) => {
                            const isActive = exact
                                ? location.pathname === path
                                : location.pathname === path || location.pathname.startsWith(path + '/');
                            return (
                                <DockItem
                                    key={path}
                                    icon={icon}
                                    label={label}
                                    path={path}
                                    isActive={isActive}
                                    mouseY={mouseY}
                                    exact={exact}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Toggle expand / collapse */}
            <div className={`py-3 ${expanded ? 'px-3' : 'flex justify-center'}`}>
                <button
                    onClick={onToggle}
                    className={`
                        flex items-center justify-center gap-2 rounded-xl
                        text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all
                        ${expanded ? 'w-full py-2.5 px-3' : 'w-10 h-10'}
                    `}
                    title={expanded ? 'Collapse' : 'Expand'}
                >
                    {expanded ? (
                        <>
                            <ChevronsLeft size={16} />
                            <span className="text-xs font-medium">Collapse</span>
                        </>
                    ) : (
                        <ChevronsRight size={16} />
                    )}
                </button>
            </div>
        </motion.aside>
    );
}

/* ══════════════════════════════════════════════
   BREADCRUMB
   ══════════════════════════════════════════════ */
function Breadcrumb() {
    const location = useLocation();
    const segments = location.pathname.split('/').filter(Boolean);
    const crumbs = segments.map((seg, i) => ({
        label: seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' '),
        path: '/' + segments.slice(0, i + 1).join('/'),
    }));

    return (
        <nav className="flex items-center gap-1 text-sm">
            {crumbs.map((crumb, i) => (
                <React.Fragment key={crumb.path}>
                    {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 mx-0.5" />}
                    {i === crumbs.length - 1 ? (
                        <span className="font-semibold text-slate-800">{crumb.label}</span>
                    ) : (
                        <NavLink to={crumb.path} className="text-slate-400 hover:text-emerald-600 transition-colors font-medium">
                            {crumb.label}
                        </NavLink>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
}

/* ══════════════════════════════════════════════
   HEADER BAR
   ══════════════════════════════════════════════ */
function Header() {
    const navigate = useNavigate();
    const [userName, setUserName] = useState('User');
    const [userEmail, setUserEmail] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            const u = JSON.parse(localStorage.getItem('sv_user') || sessionStorage.getItem('sv_user') || '{}');
            setUserName(u.name || 'User');
            setUserEmail(u.email || '');
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleLogout = async () => {
        try {
            await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
        } catch { /* ignore */ }
        clearAllUserData();
        navigate('/login');
    };

    const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30_000);
        return () => clearInterval(timer);
    }, []);

    const dateTimeLabel = now.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <header
            className="sticky top-0 z-40 flex items-center justify-between h-14 px-6"
            style={{
                background: 'rgba(255,255,255,0.72)',
                backdropFilter: 'blur(20px) saturate(1.6)',
                borderBottom: '1px solid rgba(0,0,0,0.05)',
            }}
        >
            <Breadcrumb />

            <div className="flex items-center gap-2">
                <span className="hidden md:inline text-xs text-slate-500 tabular-nums mr-1">
                    {dateTimeLabel}
                </span>

                <div className="w-px h-6 bg-slate-200 mx-1" />

                <div ref={dropdownRef} className="relative">
                    <button
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="flex items-center gap-2 pl-0.5 pr-2.5 py-0.5 rounded-full hover:bg-slate-50 transition-all"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            {initials}
                        </div>
                        <div className="text-left hidden sm:block">
                            <p className="text-[13px] font-semibold text-slate-700 leading-tight">{userName}</p>
                        </div>
                        <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {showDropdown && (
                            <motion.div
                                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                                transition={{ duration: 0.12 }}
                                className="absolute right-0 mt-2 w-52 rounded-2xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden"
                            >
                                <div className="p-3 border-b border-slate-100">
                                    <p className="text-sm font-semibold text-slate-800">{userName}</p>
                                    <p className="text-xs text-slate-400 mt-0.5">{userEmail}</p>
                                </div>
                                <div className="p-1.5">
                                    <button
                                        onClick={() => { setShowDropdown(false); navigate('/dashboard/settings'); }}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        <Settings className="w-4 h-4" /> Settings
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                                    >
                                        <LogOut className="w-4 h-4" /> Log Out
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </header>
    );
}

/* ══════════════════════════════════════════════
   CONTENT LOADING SCREEN
   Subtle "morphing" skeleton with SocioChat feel
   ══════════════════════════════════════════════ */
function ContentLoader() {
    return (
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <motion.div
                className="flex flex-col items-center gap-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
            >
                {/* Morphing logo ring */}
                <div className="relative w-14 h-14">
                    {/* Outer ring — rotating */}
                    <motion.div
                        className="absolute inset-0 rounded-2xl border-2 border-emerald-200"
                        animate={{
                            borderRadius: ['28%', '50%', '28%'],
                            rotate: [0, 180, 360],
                        }}
                        transition={{
                            duration: 2.2,
                            ease: 'easeInOut',
                            repeat: Infinity,
                        }}
                    />
                    {/* Inner fill — pulsing */}
                    <motion.div
                        className="absolute inset-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10"
                        animate={{
                            borderRadius: ['24%', '50%', '24%'],
                            scale: [0.9, 1, 0.9],
                        }}
                        transition={{
                            duration: 2.2,
                            ease: 'easeInOut',
                            repeat: Infinity,
                        }}
                    />
                    {/* Center dot */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div
                            className="w-2 h-2 rounded-full bg-emerald-500"
                            animate={{ scale: [1, 1.4, 1] }}
                            transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity }}
                        />
                    </div>
                </div>
                <p className="text-xs font-medium text-slate-400 tracking-wide">Loading</p>
            </motion.div>
        </div>
    );
}

/* ══════════════════════════════════════════════
   PAGE TRANSITION wrapper
   ══════════════════════════════════════════════ */
function AnimatedOutlet() {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex-1"
            >
                <Suspense fallback={<ContentLoader />}>
                    <Outlet />
                </Suspense>
            </motion.div>
        </AnimatePresence>
    );
}

/* ══════════════════════════════════════════════
   MAIN LAYOUT
   ══════════════════════════════════════════════ */
export default function DashboardLayout() {
    const [expanded, setExpanded] = useState(false);
    const navigate = useNavigate();
    const setNavigate = useAgentStore((s) => s.setNavigate);

    useEffect(() => {
        setNavigate(navigate);
    }, [navigate, setNavigate]);

    return (
        <div className="flex min-h-screen" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #ecfdf5 100%)' }}>
            <Sidebar expanded={expanded} onToggle={() => setExpanded(!expanded)} />
            <motion.div
                className="flex-1 flex flex-col min-h-screen"
                animate={{ marginLeft: expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                <Header />
                <AnimatedOutlet />
            </motion.div>
            <AgentChatPanel />
        </div>
    );
}

export { clearAllUserData };
