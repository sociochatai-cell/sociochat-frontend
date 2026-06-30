import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, MessageCircle, Clock, Hash, Snowflake, BookOpen, Sparkles, RefreshCw, Lock, ArrowRight, CheckCircle, LayoutDashboard, Settings, Plus, GitBranch, Bot } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { WHATSAPP_REST_API_PREFIX } from "@/config";
import { cachedFetch } from '../utils/waPersistentCache';

interface AutomationOverviewProps {
    unlockedLevel: number;
    onUnlockRequest: (level: 2 | 3, title: string) => void;
    onNavigate: (tab: string) => void;
    accountId?: number;  // Account ID for API sync
}


interface FeatureCardProps {
    title: string;
    description: string;
    icon: React.ElementType;
    level: 1 | 2 | 3;
    userLevel: number;
    tabTarget: string;
    onUnlock: () => void;
    onNavigate: () => void;
    color: string;
    stats?: string;
}

function FeatureCard({ title, description, icon: Icon, level, userLevel, tabTarget, onUnlock, onNavigate, color, stats, isEnabled, onToggle }: FeatureCardProps & { isEnabled?: boolean; onToggle?: (enabled: boolean) => void }) {
    const isLocked = userLevel < level;
    const enabled = isEnabled ?? true;

    return (
        <Card className={cn(
            "relative overflow-hidden transition-all duration-300 hover:shadow-lg border-l-4 group",
            isLocked ? "border-l-gray-300 bg-gray-50/50" : enabled ? `border-l-${color}-500 bg-white` : "border-l-gray-300 bg-gray-50/80"
        )}>
            {/* Locked Overlay */}
            {isLocked && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center p-6 text-center transition-opacity duration-300">
                    <div className="bg-gray-100 p-3 rounded-full mb-3 shadow-inner">
                        <Lock className="w-6 h-6 text-gray-500" />
                    </div>
                    <h4 className="font-semibold text-gray-800 mb-1">
                        {level === 2 ? 'Growth Feature' : 'Enterprise Feature'}
                    </h4>
                    <p className="text-xs text-muted-foreground mb-4 max-w-[180px]">
                        Unlock this feature to power up your automation.
                    </p>
                    <Button size="sm" onClick={onUnlock} className="bg-gradient-to-r from-gray-700 to-gray-900 text-white shadow-md hover:shadow-lg transform transition hover:-translate-y-0.5">
                        <Sparkles className="w-3 h-3 mr-2 text-yellow-400" />
                        Unlock {level === 2 ? 'Growth' : 'Enterprise'}
                    </Button>
                </div>
            )}

            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className={cn("p-2 rounded-lg", isLocked || !enabled ? "bg-gray-100" : `bg-${color}-100`)}>
                        <Icon className={cn("w-5 h-5", isLocked || !enabled ? "text-gray-400" : `text-${color}-600`)} />
                    </div>
                    <div className="flex items-center gap-2">
                        {/* On/Off Toggle */}
                        {!isLocked && onToggle && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggle(!enabled);
                                }}
                                className={cn(
                                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                    enabled ? "bg-emerald-500" : "bg-gray-300"
                                )}
                            >
                                <span
                                    className={cn(
                                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                        enabled ? "translate-x-4" : "translate-x-0"
                                    )}
                                />
                            </button>
                        )}
                        {/* Level Badge */}
                        {level > 1 && (
                            <Badge variant="outline" className={cn("text-[10px] items-center gap-1", isLocked ? "border-gray-300 text-gray-400" : `border-${color}-200 text-${color}-700 bg-${color}-50`)}>
                                {level === 2 ? 'GROWTH' : 'ENTERPRISE'}
                            </Badge>
                        )}
                    </div>
                </div>
                <CardTitle className={cn("text-lg mt-3 transition-colors", !isLocked && enabled ? "group-hover:text-emerald-700" : "text-gray-500")}>{title}</CardTitle>
                <CardDescription className="line-clamp-2 min-h-[40px]">{description}</CardDescription>
            </CardHeader>

            <CardContent className="pb-2">
                {stats && !isLocked && (
                    <div className={cn("flex items-center gap-2 text-xs font-medium p-2 rounded border",
                         enabled ? "text-muted-foreground bg-slate-50 border-slate-100" : "text-gray-400 bg-gray-50 border-gray-100"
                    )}>
                        <CheckCircle className={cn("w-3 h-3", enabled ? "text-emerald-500" : "text-gray-400")} />
                        {enabled ? stats : "Disabled"}
                    </div>
                )}
            </CardContent>

            <CardFooter className="pt-2">
                <Button
                    onClick={onNavigate}
                    disabled={isLocked || !enabled}
                    variant="ghost"
                    className="w-full justify-between hover:bg-emerald-50 hover:text-emerald-700 group-hover:pr-2 transition-all p-0 h-9 px-4 font-normal"
                >
                    <span className="text-sm">Manage Settings</span>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0" />
                </Button>
            </CardFooter>
        </Card>
    );
}

export function AutomationOverview({ unlockedLevel, onUnlockRequest, onNavigate, accountId }: AutomationOverviewProps) {
    // Tool on/off toggle state - persisted to localStorage
    const [toolStates, setToolStates] = useState<Record<string, boolean>>(() => {
        // Load from localStorage on initial render
        try {
            const saved = localStorage.getItem('automation_tool_states');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    const handleToggle = async (tabTarget: string, enabled: boolean) => {
        const newStates = { ...toolStates, [tabTarget]: enabled };
        setToolStates(newStates);

        // Persist to localStorage
        try {
            localStorage.setItem('automation_tool_states', JSON.stringify(newStates));
        } catch (e) {
            console.error('Failed to save toggle state:', e);
        }

        // Sync with backend API
        if (accountId) {
            try {
                const API_BASE = import.meta.env.VITE_WHATSAPP_API_BASE || import.meta.env.VITE_API_BASE || '';
                await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/accounts/${accountId}/automation-settings`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ tool: tabTarget, enabled })
                });
                console.log(`${enabled ? '✅' : '❌'} ${tabTarget} automation ${enabled ? 'enabled' : 'disabled'}`);
            } catch (e) {
                console.error('Failed to sync toggle with backend:', e);
            }
        }
    };

    const features = [
        // Level 1: Starter
        {
            title: "Welcome Message",
            description: "Auto-greet new customers instantly when they message you.",
            icon: MessageCircle,
            level: 1,
            color: "green",
            tabTarget: "inbound",
            stats: "Active & Ready"
        },
        {
            title: "Ice Breakers",
            description: "Show clickable buttons to new visitors to start conversations.",
            icon: Snowflake,
            level: 1,
            color: "sky",
            tabTarget: "inbound",
            stats: "4 Options Set"
        },

        // Level 2: Growth
        {
            title: "Business Hours",
            description: "Set your schedule and auto-reply when you are away.",
            icon: Clock,
            level: 2,
            color: "blue",
            tabTarget: "inbound",
            stats: "Schedule Configured"
        },
        {
            title: "Keyword & Commands",
            description: "Trigger actions with /commands or specific keywords.",
            icon: Hash,
            level: 2,
            color: "orange",
            tabTarget: "tools",
            stats: "Keywords Active"
        },

        // Level 3: Enterprise
        {
            title: "AI Chatbot",
            description: "Gemini-powered AI assistant to handle complex queries 24/7.",
            icon: Sparkles,
            level: 3,
            color: "pink",
            tabTarget: "ai",
            stats: "AI Trained"
        },
        {
            title: "FAQ Knowledge Base",
            description: "Instant answers for common questions before AI takes over.",
            icon: BookOpen,
            level: 3,
            color: "purple",
            tabTarget: "ai",
            stats: "Knowledge Base Ready"
        },
        {
            title: "Drip Campaigns",
            description: "Nurture leads with scheduled message sequences over time.",
            icon: RefreshCw,
            level: 3,
            color: "emerald",
            tabTarget: "campaigns",
            stats: "Campaigns Running"
        },
        {
            title: "Conversational Flows",
            description: "Create branching chatbot flows with buttons and automated logic.",
            icon: Bot,
            level: 1,
            color: "orange",
            tabTarget: "interactive-automation",
            stats: "Flow Builder"
        },
        {
            title: "API Triggers",
            description: "Fire messages from your external systems via secure API.",
            icon: Zap,
            level: 3,
            color: "yellow",
            tabTarget: "campaigns",
            stats: "Endpoints Active"
        }
    ] as const;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Hero Section - Updated to Clean Light Theme */}
            <div className="relative rounded-2xl overflow-hidden bg-white border border-slate-100 p-8 shadow-lg">
                {/* Subtle Brand Background Accents */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-green-50 rounded-full blur-3xl opacity-60 pointer-events-none -mr-16 -mt-16" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-60 pointer-events-none -ml-16 -mb-16" />

                <div className="relative z-10 flex items-start justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-green-100/50 rounded-lg border border-green-100 backdrop-blur-sm">
                                <LayoutDashboard className="w-6 h-6 text-green-600" />
                            </div>
                            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
                                {unlockedLevel === 1 ? 'STARTER PLAN' : unlockedLevel === 2 ? 'GROWTH PLAN' : 'ENTERPRISE PLAN'}
                            </Badge>
                        </div>
                        <h1 className="text-3xl font-bold mb-3 tracking-tight text-slate-900">
                            Automation Command Center
                        </h1>
                        <p className="text-slate-500 max-w-xl text-lg leading-relaxed">
                            Manage your bots, campaigns, and intelligent responses all in one place.
                            Unlock advanced features to scale your business.
                        </p>
                    </div>
                </div>
            </div>

            {/* Feature Grid */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-600" />
                        Available Tools
                    </h2>
                    <span className="text-sm text-muted-foreground">
                        {features.filter(f => f.level <= unlockedLevel).length} / {features.length} Unlocked
                    </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {features.map((feature, index) => (
                        <FeatureCard
                            key={index}
                            {...feature}
                            userLevel={unlockedLevel}
                            onUnlock={() => onUnlockRequest(feature.level as 2 | 3, feature.title)}
                            onNavigate={() => onNavigate(feature.tabTarget)}
                            isEnabled={toolStates[feature.tabTarget] ?? true}
                            onToggle={(enabled) => handleToggle(feature.tabTarget, enabled)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
