// NavigationCommandCenter - Premium Modal Navigation
// ===================================================
// Full-screen blur overlay with glass-morphic navigation cards
// Features: Active highlight, responsive grid, smooth animations

import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart3,
    Database,
    Users,
    Workflow,
    FileText,
    Send,
    Inbox,
    Zap,
    Settings,
    X,
    Sparkles,
    Crown,
    Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlan } from '@/contexts/PlanContext';
import { hasAccess, FEATURE_PLAN_MAP, getUpgradeMessage, PLAN_LABELS } from '@/config/featureGating';
import type { FeatureKey } from '@/config/featureGating';

interface NavigationItem {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    route: string;
    color: string;
    gradient: string;
    featureKey?: FeatureKey;
}

const navigationItems: NavigationItem[] = [
    {
        id: 'analytics',
        label: 'Dashboard',
        description: 'Analytics & Reports',
        icon: <BarChart3 className="w-6 h-6" />,
        route: '/dashboard/whatsapp',
        color: 'text-blue-500',
        gradient: 'from-blue-500/20 to-cyan-500/20',
    },
    {
        id: 'datasets',
        label: 'Datasets',
        description: 'Manage data sources',
        icon: <Database className="w-6 h-6" />,
        route: '/dashboard/datasets',
        color: 'text-violet-500',
        gradient: 'from-violet-500/20 to-purple-500/20',
        featureKey: 'whatsapp_datasets' as FeatureKey,
    },
    {
        id: 'contacts',
        label: 'Contacts',
        description: 'Customer directory',
        icon: <Users className="w-6 h-6" />,
        route: '/dashboard/contacts',
        color: 'text-emerald-500',
        gradient: 'from-emerald-500/20 to-green-500/20',
        featureKey: 'whatsapp_contacts' as FeatureKey,
    },
    {
        id: 'flows',
        label: 'Interactive Flows',
        description: 'Visual flow builder',
        icon: <Workflow className="w-6 h-6" />,
        route: '/dashboard/interactive-automation',
        color: 'text-orange-500',
        gradient: 'from-orange-500/20 to-amber-500/20',
        featureKey: 'whatsapp_interactive_automation' as FeatureKey,
    },
    {
        id: 'templates',
        label: 'Templates',
        description: 'Message templates',
        icon: <FileText className="w-6 h-6" />,
        route: '/dashboard/templates',
        color: 'text-pink-500',
        gradient: 'from-pink-500/20 to-rose-500/20',
    },
    {
        id: 'bulk',
        label: 'Bulk Send',
        description: 'Broadcast campaigns',
        icon: <Send className="w-6 h-6" />,
        route: '/dashboard/bulk',
        color: 'text-indigo-500',
        gradient: 'from-indigo-500/20 to-blue-500/20',
        featureKey: 'whatsapp_bulk_messaging' as FeatureKey,
    },
    {
        id: 'inbox',
        label: 'Inbox',
        description: 'Conversations',
        icon: <Inbox className="w-6 h-6" />,
        route: '/dashboard/inbox',
        color: 'text-green-500',
        gradient: 'from-green-500/20 to-emerald-500/20',
    },
    {
        id: 'automations',
        label: 'Automations',
        description: 'Auto-responses & rules',
        icon: <Zap className="w-6 h-6" />,
        route: '/dashboard/automation',
        color: 'text-yellow-500',
        gradient: 'from-yellow-500/20 to-orange-500/20',
        featureKey: 'whatsapp_automation' as FeatureKey,
    },
    {
        id: 'settings',
        label: 'Settings',
        description: 'Account & preferences',
        icon: <Settings className="w-6 h-6" />,
        route: '/dashboard/settings',
        color: 'text-slate-500',
        gradient: 'from-slate-500/20 to-gray-500/20',
    },
];

interface NavigationCommandCenterProps {
    isOpen: boolean;
    onClose: () => void;
}

export function NavigationCommandCenter({ isOpen, onClose }: NavigationCommandCenterProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const { plan: userPlan } = usePlan();

    // Close on route change
    useEffect(() => {
        if (isOpen) {
            onClose();
        }
    }, [location.pathname]);

    // Prevent background scroll when open
    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : 'auto';
        return () => {
            document.body.style.overflow = 'auto';
        };
    }, [isOpen]);

    // Close on ESC key
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, handleKeyDown]);

    const handleNavigate = (item: NavigationItem) => {
        // Check if feature is gated
        if (item.featureKey) {
            const requiredPlan = FEATURE_PLAN_MAP[item.featureKey];
            if (!hasAccess(userPlan, requiredPlan)) {
                // Don't navigate, will show locked state
                return;
            }
        }
        navigate(item.route);
        onClose();
    };

    const isItemLocked = (item: NavigationItem) => {
        return false; // All features are unlocked in standalone version
    };

    const isActivePage = (route: string) => {
        if (route === '/dashboard/whatsapp') {
            return location.pathname === '/dashboard/whatsapp';
        }
        return location.pathname.startsWith(route);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop with blur */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xl"
                        onClick={onClose}
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/20 dark:border-slate-700/50 w-full max-w-3xl pointer-events-auto overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/25">
                                        <Sparkles className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                                            Command Center
                                        </h2>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            Navigate to any WhatsApp feature
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
                                >
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            {/* Navigation Grid */}
                            <div className="p-6">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {navigationItems.map((item, index) => {
                                        const isActive = isActivePage(item.route);
                                        const locked = isItemLocked(item);
                                        const requiredPlan = item.featureKey ? FEATURE_PLAN_MAP[item.featureKey] : undefined;
                                        return (
                                            <motion.button
                                                key={item.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{
                                                    duration: 0.3,
                                                    delay: index * 0.05,
                                                    ease: [0.4, 0, 0.2, 1]
                                                }}
                                                onClick={() => locked ? navigate('/subscription') : handleNavigate(item)}
                                                className={cn(
                                                    "relative group p-4 rounded-2xl text-left transition-all duration-300",
                                                    "bg-gradient-to-br border",
                                                    locked ? 'from-slate-100/50 to-slate-200/30' : item.gradient,
                                                    locked
                                                        ? "border-slate-200/50 cursor-not-allowed opacity-60"
                                                        : isActive
                                                            ? "border-2 border-green-500 shadow-lg shadow-green-500/20 ring-2 ring-green-500/20"
                                                            : "border-slate-200/50 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600",
                                                    !locked && "hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5",
                                                )}
                                            >
                                                {/* Active Badge */}
                                                {isActive && !locked && (
                                                    <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-green-500 text-white text-[10px] font-medium rounded-full shadow-lg">
                                                        Active
                                                    </div>
                                                )}


                                                {/* Icon */}
                                                <div className={cn(
                                                    "w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110",
                                                    "bg-white/80 dark:bg-slate-800/80 shadow-sm",
                                                    item.color
                                                )}>
                                                    {item.icon}
                                                </div>

                                                {/* Label & Description */}
                                                <h3 className={cn(
                                                    "font-semibold mb-0.5",
                                                    locked
                                                        ? "text-slate-400"
                                                        : isActive ? "text-green-600 dark:text-green-400" : "text-slate-900 dark:text-white"
                                                )}>
                                                    {item.label}
                                                </h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {locked && requiredPlan
                                                        ? getUpgradeMessage(requiredPlan)
                                                        : item.description}
                                                </p>

                                                {/* Hover Glow Effect */}
                                                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                    <div className={cn(
                                                        "absolute inset-0 rounded-2xl blur-xl opacity-30",
                                                        `bg-gradient-to-br ${item.gradient}`
                                                    )} />
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Footer hint */}
                            <div className="px-6 py-3 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
                                <p className="text-xs text-center text-slate-400">
                                    Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px]">ESC</kbd> or click outside to close
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export default NavigationCommandCenter;
