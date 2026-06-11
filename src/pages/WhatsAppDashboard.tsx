// WhatsApp Dashboard Page - Business-First Design
// ================================================
// Comprehensive WhatsApp Business dashboard with full analytics
// Includes: Executive Summary, Delivery Funnel, Trends, Category Performance
// Plus: AI-powered insights for SaaS differentiation

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    TooltipProvider,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import {
    MessageCircle,
    Settings,
    Inbox,
    RefreshCw,
    Users,
    BarChart3,
    Building2,
    TrendingUp,
    Link as LinkIcon,
    Unlink,
    FileText,
    Workflow,
    Brain,
    Zap,
    Target,
    AlertTriangle,
    ThumbsUp,
    ThumbsDown,
    Activity,
    Banknote as DollarSign,
    Database,
    LayoutGrid,
    Shield,
    Lock,
    Unlock,
    ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWhatsAppConnection } from '@/whatsapp/hooks/useWhatsAppData';
import { NavigationCommandCenter } from '@/whatsapp/components';
import { getWorkspaceId, setWorkspaceId as persistWorkspaceId } from '@/whatsapp/utils/workspaceContext';

// Import analytics components
import {
    ExecutiveSummaryCards,
    DeliveryFunnel,
    CategoryPerformance,
    TrendChart,
    ConversationInsights,
    ExportButtons,
} from '@/whatsapp/components/analytics';

// API Base URL from environment
const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || '').toString().replace(/\/$/, '');

// Types
interface SummaryData {
    current: {
        sent: number;
        delivered: number;
        read: number;
        failed: number;
        delivery_rate: number;
        read_rate: number;
        active_customers: number;
        avg_response_time_seconds?: number;
    };
    previous: {
        sent: number;
        delivered: number;
        read: number;
        failed: number;
    };
    comparison: {
        sent_change: number;
        delivered_change: number;
        read_change: number;
    };
    period_days: number;
}

interface TrendData {
    date: string;
    sent: number;
    delivered: number;
    read: number;
}

interface CategoryData {
    category: string;
    total_sent: number;
    delivered: number;
    read: number;
    failed: number;
    delivery_rate: number;
    read_rate: number;
    failure_rate: number;
}

interface ConversationStats {
    total: number;
    open: number;
    with_unread: number;
    active_sessions: number;
}

interface AIInsights {
    sentiment_score?: number;  // 0-100
    sentiment_trend?: 'improving' | 'stable' | 'declining';
    churn_risk_customers?: number;
    high_value_customers?: number;
    engagement_score?: number;  // 0-100
    best_send_hour?: number;
    best_send_day?: string;
    response_rate?: number;
    avg_conversation_length?: number;
    customer_satisfaction?: number;  // 0-100
    recommendations?: string[];
    // Enhanced AI insights properties
    revenue_opportunity?: string;
    customer_health?: {
        engaged: number;
        at_risk: number;
        dormant: number;
    };
    best_practices_score?: number;
    quick_wins?: string[];
    growth_recommendations?: string[];
    predicted_improvement?: string;
    // Real AI insights metadata
    is_ai_generated?: boolean;
    insight_type?: 'heuristic' | 'gemini' | 'error';
    metadata?: {
        from_cache: boolean;
        generation_time_ms: number;
        tokens_used: number;
        cost_inr: number;
        model?: string;
    };
    insights?: Array<{
        type: 'success' | 'warning' | 'tip' | 'critical' | 'opportunity' | 'info';
        title: string;
        message: string;
        action?: string;
        metric?: string;
        impact?: 'high' | 'medium' | 'low';
    }>;
    summary?: string;
}

interface Workspace {
    id: number;
    name: string;
    logo?: string;
}

export default function WhatsAppDashboard() {
    const navigate = useNavigate();

    // Workspace state
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
    const [workspacesLoading, setWorkspacesLoading] = useState(true);

    // --- Password Protection State ---
    const [isLocked, setIsLocked] = useState(getWorkspaceId() === '1');
    const [passwordInput, setPasswordInput] = useState('');

    // Connection status from cached hook
    const {
        data: connectionData,
        isLoading: checkingAccount,
    } = useWhatsAppConnection(selectedWorkspaceId || '');

    const hasLinkedAccount = useMemo(() => {
        if (!connectionData) return null;
        return connectionData.status === 'CONNECTED';
    }, [connectionData]);

    const accountName = useMemo(() => {
        if (!connectionData || connectionData.status !== 'CONNECTED') return null;
        return connectionData.account_summary?.verified_name || null;
    }, [connectionData]);

    const accountPhone = useMemo(() => {
        if (!connectionData || connectionData.status !== 'CONNECTED') return null;
        return connectionData.account_summary?.phone_number || null;
    }, [connectionData]);

    // Analytics state
    const [period, setPeriod] = useState('7');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Data states
    const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
    const [trendData, setTrendData] = useState<TrendData[]>([]);
    const [categoryData, setCategoryData] = useState<Record<string, CategoryData> | null>(null);
    const [conversationData, setConversationData] = useState<ConversationStats | null>(null);
    const [aiInsights, setAIInsights] = useState<AIInsights | null>(null);
    const [aiInsightsLoading, setAIInsightsLoading] = useState(false);
    const [sectionLoading, setSectionLoading] = useState(true);
    const loadingTransitionTimerRef = useRef<number | null>(null);

    const hasAnalyticsData = useMemo(
        () => !!summaryData || trendData.length > 0 || !!categoryData || !!conversationData,
        [summaryData, trendData, categoryData, conversationData]
    );

    useEffect(() => {
        if (loading && !hasAnalyticsData) {
            setSectionLoading(true);
            if (loadingTransitionTimerRef.current) {
                window.clearTimeout(loadingTransitionTimerRef.current);
                loadingTransitionTimerRef.current = null;
            }
            return;
        }

        if (loadingTransitionTimerRef.current) {
            window.clearTimeout(loadingTransitionTimerRef.current);
        }

        // Keep skeleton briefly so section transitions feel smooth instead of flashing.
        loadingTransitionTimerRef.current = window.setTimeout(() => {
            setSectionLoading(false);
            loadingTransitionTimerRef.current = null;
        }, 260);

        return () => {
            if (loadingTransitionTimerRef.current) {
                window.clearTimeout(loadingTransitionTimerRef.current);
                loadingTransitionTimerRef.current = null;
            }
        };
    }, [loading, hasAnalyticsData]);

    // AI Insights localStorage key (shared between Dashboard and Analytics)
    const aiInsightsStorageKey = useMemo(() =>
        selectedWorkspaceId ? `sv_ai_insights_${selectedWorkspaceId}_${period}` : null
        , [selectedWorkspaceId, period]);

    // Load AI insights from localStorage on mount/workspace change
    useEffect(() => {
        if (!aiInsightsStorageKey) return;
        try {
            const cached = localStorage.getItem(aiInsightsStorageKey);
            if (cached) {
                const parsed = JSON.parse(cached);
                // Check if cache is less than 24 hours old
                if (parsed.cached_at && Date.now() - parsed.cached_at < 86400000) {
                    setAIInsights(parsed.data);
                }
            }
        } catch (e) {
            console.error('Failed to load cached AI insights:', e);
        }
    }, [aiInsightsStorageKey]);

    // Listen for localStorage changes (sync between pages)
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === aiInsightsStorageKey && e.newValue) {
                try {
                    const parsed = JSON.parse(e.newValue);
                    setAIInsights(parsed.data);
                } catch (err) {
                    console.error('Failed to parse AI insights from storage event:', err);
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [aiInsightsStorageKey]);

    // Generate REAL AI insights (manual trigger only - costs tokens)
    const generateRealAIInsights = useCallback(async (forceRefresh = false) => {
        if (!selectedWorkspaceId) return;

        setAIInsightsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/whatsapp/analytics/ai-insights/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                credentials: 'include',
                body: JSON.stringify({
                    workspace_id: selectedWorkspaceId,
                    days: parseInt(period) || 7,
                    force_refresh: forceRefresh,
                }),
            });
            const json = await res.json();
            if (json.success) {
                setAIInsights(json);
                // Save to localStorage for sync between Dashboard and Analytics
                const storageKey = `sv_ai_insights_${selectedWorkspaceId}_${period}`;
                localStorage.setItem(storageKey, JSON.stringify({
                    data: json,
                    cached_at: Date.now(),
                }));
            }
        } catch (err) {
            console.error('Failed to generate AI insights:', err);
        } finally {
            setAIInsightsLoading(false);
        }
    }, [selectedWorkspaceId, period]);

    // Fetch workspaces on mount
    useEffect(() => {
        const fetchWorkspaces = async () => {
            setWorkspacesLoading(true);
            try {
                const userStr = localStorage.getItem('sv_user') || sessionStorage.getItem('sv_user');
                const user = userStr ? JSON.parse(userStr) : null;
                if (!user?.id) return;

                const res = await fetch(`${API_BASE}/api/workspaces?user_id=${user.id}`, {
                    credentials: 'include',
                });
                const json = await res.json();
                const wsList = json.workspaces || json.workspace || [];
                const mapped = (Array.isArray(wsList) ? wsList : [wsList]).map((w: any) => ({
                    id: w.id || w.workspace_id,
                    name: w.business_name || w.name || `Workspace ${w.id}`,
                    logo: w.logo_url || w.logo,
                }));
                setWorkspaces(mapped);

                const storedWs = getWorkspaceId();
                if (storedWs && mapped.some((w: Workspace) => w.id === Number(storedWs))) {
                    setSelectedWorkspaceId(storedWs);
                } else if (mapped.length > 0) {
                    const firstWsId = String(mapped[0].id);
                    setSelectedWorkspaceId(firstWsId);
                    persistWorkspaceId(firstWsId);
                }
            } catch (err) {
                console.error('Failed to fetch workspaces:', err);
            } finally {
                setWorkspacesLoading(false);
            }
        };
        fetchWorkspaces();
    }, []);

    const handleWorkspaceChange = (wsId: string) => {
        setSelectedWorkspaceId(wsId);
        persistWorkspaceId(wsId);

        // Handle lock logic when switching
        if (wsId === '1') {
            setIsLocked(true);
        } else {
            setIsLocked(false);
        }

        // Reload to sync state across the app
        window.location.reload();
    };

    const handleUnlock = () => {
        if (passwordInput === 'prabhu@1charan') {
            setIsLocked(false);
            toast.success('Workspace unlocked');
        } else {
            toast.error('Incorrect password');
        }
    };

    // Generate AI insights from real data (until ML model is built)
    const generateAIInsights = (summary: any, analytics: any): AIInsights => {
        const readRate = summary?.current?.read_rate || 0;
        const deliveryRate = summary?.current?.delivery_rate || 0;
        const sent = summary?.current?.sent || 0;
        const totalConversations = analytics?.conversations?.total || 0;

        return {
            sentiment_score: Math.min(100, Math.round((readRate * 0.6 + deliveryRate * 0.4))),
            sentiment_trend: readRate > 50 ? 'improving' : readRate > 30 ? 'stable' : 'declining',
            churn_risk_customers: Math.round(totalConversations * 0.15),
            high_value_customers: Math.round(totalConversations * 0.25),
            engagement_score: Math.round((readRate + deliveryRate) / 2),
            best_send_hour: 10, // 10 AM - will be ML-driven later
            best_send_day: 'Tuesday',
            response_rate: Math.min(100, Math.round(readRate * 1.2)),
            avg_conversation_length: 4.5,
            customer_satisfaction: Math.min(100, Math.round(readRate * 1.1)),
            recommendations: [
                readRate < 50 ? '📌 Consider shorter message templates for better read rates' : '✅ Read rates are healthy',
                deliveryRate < 90 ? '⚠️ Review phone number quality - some messages aren\'t delivering' : '✅ Delivery rates are excellent',
                sent < 100 ? '💡 Increase engagement with scheduled broadcasts' : '📊 Good message volume',
                '🎯 Best time to send: Tuesdays at 10 AM based on your data',
            ].filter(Boolean),
        };
    };

    // Fetch all analytics data (without AI insights - those are triggered manually)
    const fetchAllAnalytics = useCallback(async (silent = false) => {
        if (!selectedWorkspaceId) {
            setError('Please select a workspace');
            setLoading(false);
            return;
        }

        if (!silent) {
            if (hasAnalyticsData) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
        } else {
            setRefreshing(true);
        }
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const wsParam = `workspace_id=${selectedWorkspaceId}`;
            const daysParam = period === 'all' ? '30' : period;

            // Fetch all endpoints in parallel (NO AI insights - those cost money)
            const [summaryRes, trendsRes, categoriesRes, analyticsRes] = await Promise.all([
                fetch(`${API_BASE}/api/whatsapp/analytics/summary?${wsParam}&days=${daysParam}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: 'include',
                }),
                fetch(`${API_BASE}/api/whatsapp/analytics/trends?${wsParam}&days=${daysParam}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: 'include',
                }),
                fetch(`${API_BASE}/api/whatsapp/analytics/categories?${wsParam}&days=${daysParam}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: 'include',
                }),
                fetch(`${API_BASE}/api/whatsapp/analytics?${wsParam}&days=${daysParam}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: 'include',
                }),
            ]);

            const [summaryJson, trendsJson, categoriesJson, analyticsJson] = await Promise.all([
                summaryRes.json(),
                trendsRes.json(),
                categoriesRes.json(),
                analyticsRes.json(),
            ]);

            if (summaryJson.success) setSummaryData(summaryJson);
            if (trendsJson.success) setTrendData(trendsJson.daily || []);
            if (categoriesJson.success) setCategoryData(categoriesJson.categories);
            if (analyticsJson.success) setConversationData(analyticsJson.conversations);

            // AI insights are NOT auto-fetched - user must click "Generate AI Insights" button

        } catch (err) {
            console.error('Failed to fetch analytics:', err);
            setError('Failed to load analytics data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedWorkspaceId, period, hasAnalyticsData]);

    useEffect(() => {
        if (selectedWorkspaceId && hasLinkedAccount === true) {
            fetchAllAnalytics(false);
        }
    }, [period, selectedWorkspaceId, hasLinkedAccount, fetchAllAnalytics]);

    // Intentionally no background polling for dashboard analytics.
    // Data updates on:
    // 1) page navigation/mount
    // 2) workspace or period change
    // 3) explicit refresh button click

    // Loading state
    if (workspacesLoading || checkingAccount || (hasLinkedAccount === null && selectedWorkspaceId)) {
        return <DashboardInitialLoadingScreen />;
    }

    // No account linked
    if (hasLinkedAccount === false && selectedWorkspaceId) {
        return (
            <TooltipProvider>
                <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
                    <DashboardHeader
                        accountName={null}
                        accountPhone={null}
                        hasLinkedAccount={false}
                        workspaces={workspaces}
                        selectedWorkspaceId={selectedWorkspaceId}
                        workspacesLoading={workspacesLoading}
                        onWorkspaceChange={handleWorkspaceChange}
                        navigate={navigate}
                    />
                    <div className="max-w-2xl mx-auto px-4 py-16">
                        <Card className="border-2 border-dashed border-green-200">
                            <CardContent className="p-8 text-center">
                                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
                                    <MessageCircle className="w-8 h-8 text-green-600" />
                                </div>
                                <h2 className="text-2xl font-bold mb-2">Connect WhatsApp Business</h2>
                                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                                    Link your WhatsApp Business Account to start sending messages, managing conversations, and viewing AI-powered analytics.
                                </p>
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                                    <Button
                                        onClick={() => navigate('/dashboard/whatsapp/setup')}
                                        className="bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#128C7E] hover:to-[#075E54] text-white gap-2"
                                    >
                                        <MessageCircle className="w-5 h-5" />
                                        Connect WhatsApp Account
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => navigate('/dashboard/whatsapp/coexistence')}
                                        className="gap-2 border-teal-300 text-teal-700 hover:bg-teal-50"
                                    >
                                        <Zap className="w-4 h-4" />
                                        Coexistence Mode
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-4 max-w-sm mx-auto">
                                    <strong>Coexistence Mode:</strong> Keep your mobile WhatsApp active while also using the Cloud API through Sociovia.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </TooltipProvider>
        );
    }

    return (
        <TooltipProvider>
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                {/* Header */}
                <DashboardHeader
                    accountName={accountName}
                    accountPhone={accountPhone}
                    hasLinkedAccount={hasLinkedAccount}
                    workspaces={workspaces}
                    selectedWorkspaceId={selectedWorkspaceId}
                    workspacesLoading={workspacesLoading}
                    onWorkspaceChange={handleWorkspaceChange}
                    navigate={navigate}
                />

                {/* Main Content */}
                <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                    {/* Controls Row */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Select value={period} onValueChange={setPeriod}>
                                <SelectTrigger className="w-36">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="7">Last 7 days</SelectItem>
                                    <SelectItem value="14">Last 14 days</SelectItem>
                                    <SelectItem value="30">Last 30 days</SelectItem>
                                    <SelectItem value="90">Last 90 days</SelectItem>
                                    <SelectItem value="all">All time</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => fetchAllAnalytics(false)}
                                disabled={loading || refreshing}
                            >
                                <RefreshCw className={cn("w-4 h-4", (loading || refreshing) && "animate-spin")} />
                            </Button>
                            <ExportButtons
                                workspaceId={selectedWorkspaceId}
                                period={period}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            {hasLinkedAccount && (
                                <Badge className="text-xs bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md">
                                    <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                                    Connected
                                </Badge>
                            )}
                        </div>
                    </div>

                    {refreshing && hasAnalyticsData && (
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                            <div className="h-full w-1/3 bg-gradient-to-r from-emerald-500 to-cyan-500 animate-[shimmer_1.4s_linear_infinite]" />
                        </div>
                    )}

                    {/* Error State */}
                    {error && !loading && (
                        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                            <CardContent className="p-6 text-center">
                                <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                                <p className="text-red-700 dark:text-red-400">{error}</p>
                                <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchAllAnalytics(false)}>
                                    Retry
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Analytics Content */}
                    {!error && (
                        <>
                            {/* Section 1: Executive Summary (CEO View) */}
                            <ExecutiveSummaryCards data={summaryData} loading={sectionLoading} />

                            {/* Section 2: AI-Powered Insights */}
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.2 }}
                                transition={{ type: 'tween', duration: 0.45, ease: 'easeOut' }}
                            >
                                {sectionLoading ? (
                                    <AIInsightsLoadingSkeleton />
                                ) : (
                                    <AIInsightsSection
                                        insights={aiInsights}
                                        loading={aiInsightsLoading}
                                        onGenerateInsights={() => generateRealAIInsights(false)}
                                        onRefreshInsights={() => generateRealAIInsights(true)}
                                    />
                                )}
                            </motion.div>

                            {/* Section 3: Delivery Funnel + Trend Chart */}
                            <motion.div
                                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                                initial={{ opacity: 0, y: 12 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.15 }}
                                transition={{ type: 'tween', duration: 0.45, ease: 'easeOut' }}
                            >
                                <DeliveryFunnel
                                    sent={summaryData?.current?.sent || 0}
                                    delivered={summaryData?.current?.delivered || 0}
                                    read={summaryData?.current?.read || 0}
                                    failed={summaryData?.current?.failed || 0}
                                    loading={sectionLoading}
                                />
                                <TrendChart
                                    data={trendData}
                                    loading={sectionLoading}
                                    periodDays={parseInt(period) || 7}
                                    periodLabel={period === 'all' ? 'all time' : `${period} days`}
                                />
                            </motion.div>

                            {/* Section 4: Category Performance */}
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.15 }}
                                transition={{ type: 'tween', duration: 0.45, ease: 'easeOut', delay: 0.05 }}
                            >
                                <CategoryPerformance categories={categoryData} loading={sectionLoading} />
                            </motion.div>

                            {/* Section 5: Conversation Insights */}
                            <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.15 }}
                                transition={{ type: 'tween', duration: 0.45, ease: 'easeOut', delay: 0.1 }}
                            >
                                <ConversationInsights conversations={conversationData} loading={sectionLoading} />
                            </motion.div>


                        </>
                    )}
                </div>

                {/* Password Protection Overlay */}
                {isLocked && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-background/30 transition-all animate-in fade-in duration-500">
                        <div className="max-w-md w-full bg-white dark:bg-slate-900 shadow-2xl rounded-2xl border border-primary/20 overflow-hidden animate-in zoom-in-95 duration-300">
                            <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-8 text-center relative">
                                <div className="absolute top-4 right-4">
                                    <Shield className="w-5 h-5 text-primary/30" />
                                </div>
                                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4 border border-primary/10">
                                    <Lock className="w-8 h-8 text-primary" />
                                </div>
                                <h2 className="text-2xl font-bold mb-2">Workspace Locked</h2>
                                <p className="text-sm text-muted-foreground">
                                    This is Prabhu Charan's personal WhatsApp workspace so it requires the password to access.
                                </p>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Access Password</label>
                                    <div className="relative">
                                        <Input
                                            type="password"
                                            placeholder="Enter password..."
                                            value={passwordInput}
                                            onChange={(e) => setPasswordInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                                            className="pr-10"
                                            autoFocus
                                        />
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            {passwordInput === 'prabhu@1charan' ? (
                                                <Unlock className="w-4 h-4 text-green-500" />
                                            ) : (
                                                <Lock className="w-4 h-4 text-muted-foreground" />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <Button onClick={handleUnlock} className="w-full gap-2 h-11 text-lg font-semibold">
                                    Unlock Workspace
                                </Button>

                                <div className="relative py-2">
                                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-muted" /></div>
                                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-white dark:bg-slate-900 px-2 text-muted-foreground">OR SWITCH WORKSPACE</span></div>
                                </div>

                                <div className="space-y-3">
                                    <p className="text-xs text-center text-muted-foreground">Select another workspace to escape the lock</p>
                                    <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                                        {workspaces.filter(ws => String(ws.id) !== '1').map(ws => (
                                            <Button
                                                key={ws.id}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleWorkspaceChange(String(ws.id))}
                                                className="justify-start gap-2 h-10 border-primary/10 hover:bg-primary/5 dark:hover:bg-primary/10 flex-shrink-0"
                                            >
                                                <Building2 className="w-4 h-4" />
                                                {ws.name}
                                            </Button>
                                        ))}
                                        {workspaces.length <= 1 && (
                                            <div className="text-center py-2 px-4 bg-muted/50 rounded-lg text-[10px] text-muted-foreground italic">
                                                No other workspaces available
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </TooltipProvider>
    );
}

function AIInsightsLoadingSkeleton() {
    return (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Brain className="w-5 h-5 text-purple-600" />
                    AI-Powered Insights
                    <Badge variant="secondary" className="text-[10px] ml-2">Sociovia AI</Badge>
                </CardTitle>
                <CardDescription>
                    Get intelligent analytics powered by Sociovia AI
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                    <Skeleton className="h-20 rounded-xl" />
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-10 w-44" />
            </CardContent>
        </Card>
    );
}

function DashboardInitialLoadingScreen() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="space-y-2">
                            <Skeleton className="h-7 w-52" />
                            <Skeleton className="h-4 w-64" />
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                            <Skeleton className="h-10 w-40" />
                            <Skeleton className="h-10 w-24" />
                            <Skeleton className="h-10 w-24" />
                        </div>
                    </div>
                </div>
            </header>

            <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-36" />
                        <Skeleton className="h-10 w-10" />
                        <Skeleton className="h-10 w-24" />
                    </div>
                    <Skeleton className="h-7 w-28 rounded-full" />
                </div>

                <div className="space-y-3">
                    <Skeleton className="h-9 w-56" />
                    <Skeleton className="h-28 w-full rounded-2xl" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Skeleton className="h-64 w-full rounded-2xl" />
                    <Skeleton className="h-64 w-full rounded-2xl" />
                </div>

                <Skeleton className="h-56 w-full rounded-2xl" />
            </div>
        </div>
    );
}

// Dashboard Header Component
function DashboardHeader({
    accountName,
    accountPhone,
    hasLinkedAccount,
    workspaces,
    selectedWorkspaceId,
    workspacesLoading,
    onWorkspaceChange,
    navigate,
}: {
    accountName: string | null;
    accountPhone: string | null;
    hasLinkedAccount: boolean | null;
    workspaces: Workspace[];
    selectedWorkspaceId: string | null;
    workspacesLoading: boolean;
    onWorkspaceChange: (wsId: string) => void;
    navigate: (path: string) => void;
}) {
    const [isNavOpen, setIsNavOpen] = useState(false);

    return (
        <>
            <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <MessageCircle className="h-5 w-5 text-green-600" />
                                    {accountName ? (
                                        <span>
                                            <span className="text-green-600">{accountName}</span>
                                        </span>
                                    ) : (
                                        'WhatsApp Business'
                                    )}
                                </h1>
                                <p className="text-xs text-gray-500 dark:text-gray-400 hidden md:block">
                                    {accountPhone && <span className="mr-2">{accountPhone}</span>}
                                    Business Analytics Dashboard
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 md:gap-3">
                            <Select
                                value={selectedWorkspaceId || ''}
                                onValueChange={onWorkspaceChange}
                                disabled={workspacesLoading || workspaces.length === 0}
                            >
                                <SelectTrigger className="w-32 md:w-48">
                                    <Building2 className="w-4 h-4 mr-2 hidden md:inline" />
                                    <SelectValue placeholder="Workspace" />
                                </SelectTrigger>
                                <SelectContent>
                                    {workspaces.map((ws) => (
                                        <SelectItem key={ws.id} value={String(ws.id)}>
                                            {ws.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Navigation Menu Button */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsNavOpen(true)}
                                className="gap-2 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 hover:from-slate-100 hover:to-slate-200 dark:hover:from-slate-700 dark:hover:to-slate-800 border-slate-200 dark:border-slate-700"
                            >
                                <LayoutGrid className="h-4 w-4" />
                                <span className="hidden sm:inline">Menu</span>
                            </Button>

                            {!hasLinkedAccount && (
                                <Button
                                    variant="default"
                                    size="sm"
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                    onClick={() => navigate('/dashboard/whatsapp/setup')}
                                >
                                    <LinkIcon className="h-4 w-4 mr-1" />
                                    Link
                                </Button>
                            )}
                            {hasLinkedAccount && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => navigate('/dashboard/whatsapp/settings')}
                                >
                                    <Unlink className="h-4 w-4 mr-1" />
                                    <span className="hidden sm:inline">Unlink</span>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Navigation Command Center Modal */}
            <NavigationCommandCenter
                isOpen={isNavOpen}
                onClose={() => setIsNavOpen(false)}
            />
        </>
    );
}

// AI Insights Section - Real Gemini-powered insights with cost tracking
function AIInsightsSection({
    insights,
    loading,
    onGenerateInsights,
    onRefreshInsights,
}: {
    insights: AIInsights | null;
    loading: boolean;
    onGenerateInsights: () => void;
    onRefreshInsights: () => void;
}) {
    const getSentimentColor = (score: number) => {
        if (score >= 70) return 'text-green-600 bg-green-100 dark:bg-green-900/30';
        if (score >= 40) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
        return 'text-red-600 bg-red-100 dark:bg-red-900/30';
    };

    const getInsightTypeStyle = (type: string) => {
        switch (type) {
            case 'success': return 'border-green-200 bg-green-50 dark:bg-green-950/20';
            case 'warning': return 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20';
            case 'critical': return 'border-red-200 bg-red-50 dark:bg-red-950/20';
            case 'opportunity': return 'border-purple-200 bg-purple-50 dark:bg-purple-950/20';
            default: return 'border-blue-200 bg-blue-50 dark:bg-blue-950/20';
        }
    };

    const getInsightIcon = (type: string) => {
        switch (type) {
            case 'success': return <ThumbsUp className="w-4 h-4 text-green-600" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
            case 'critical': return <AlertTriangle className="w-4 h-4 text-red-600" />;
            case 'opportunity': return <Zap className="w-4 h-4 text-purple-600" />;
            default: return <Zap className="w-4 h-4 text-blue-600" />;
        }
    };

    // No insights yet - show generate button
    if (!insights) {
        return (
            <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Brain className="w-5 h-5 text-purple-600" />
                        AI-Powered Insights
                        <Badge variant="secondary" className="text-[10px] ml-2">Sociovia AI</Badge>
                    </CardTitle>
                    <CardDescription>
                        Get intelligent analytics powered by Sociovia AI
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-center py-8">
                        <Brain className="w-12 h-12 mx-auto text-purple-400 mb-4" />
                        <p className="text-muted-foreground mb-4">
                            Click below to generate AI-powered insights for your WhatsApp analytics.
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                            ⚡ Uses Sociovia AI • Cached for 24 hours
                        </p>
                        <Button
                            onClick={onGenerateInsights}
                            disabled={loading}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                        >
                            {loading ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Brain className="w-4 h-4 mr-2" />
                                    Generate AI Insights
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Has insights - show them
    const isRealAI = insights.is_ai_generated && insights.insight_type === 'gemini';
    const hasRealInsights = insights.insights && insights.insights.length > 0;

    return (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Brain className="w-5 h-5 text-purple-600" />
                            AI-Powered Insights
                            <Badge
                                variant="default"
                                className="text-[10px] ml-2 bg-purple-600"
                            >
                                Sociovia AI
                            </Badge>
                            {insights.metadata?.from_cache && (
                                <Badge variant="outline" className="text-[10px]">Cached</Badge>
                            )}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-4 mt-1">
                            AI-powered business intelligence for your WhatsApp performance
                            {insights.metadata && (
                                <span className="text-xs text-purple-600 font-medium">
                                    {Math.round(insights.metadata.generation_time_ms)}ms
                                </span>
                            )}
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRefreshInsights}
                        disabled={loading}
                    >
                        {loading ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4 mr-1" />
                                Refresh
                            </>
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                {/* Real AI Insights Display */}
                {hasRealInsights ? (
                    <div className="space-y-5">
                        {/* Summary Banner */}
                        {insights.summary && (
                            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-200/50">
                                <p className="text-sm font-semibold text-purple-800 dark:text-purple-200">
                                    {insights.summary}
                                </p>
                                {insights.predicted_improvement && (
                                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/40">
                                        <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                                            📈 {insights.predicted_improvement}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Score Cards - Compact & Visual */}
                        {(insights.engagement_score || insights.customer_health || insights.revenue_opportunity) && (
                            <div className="grid grid-cols-4 gap-2">
                                {insights.engagement_score !== undefined && (
                                    <div className="relative p-4 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white overflow-hidden">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8" />
                                        <p className="text-3xl font-bold">{insights.engagement_score}%</p>
                                        <p className="text-xs text-blue-100 font-medium mt-1">Health Score</p>
                                    </div>
                                )}
                                {insights.revenue_opportunity && (
                                    <div className="relative p-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white overflow-hidden">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8" />
                                        <p className="text-xl font-bold">{insights.revenue_opportunity}</p>
                                        <p className="text-xs text-emerald-100 font-medium mt-1">Opportunity</p>
                                    </div>
                                )}
                                {insights.customer_health?.engaged !== undefined && (
                                    <div className="relative p-4 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 text-white overflow-hidden">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8" />
                                        <p className="text-3xl font-bold">{insights.customer_health.engaged}%</p>
                                        <p className="text-xs text-green-100 font-medium mt-1">Engaged</p>
                                    </div>
                                )}
                                {insights.customer_health?.at_risk !== undefined && (
                                    <div className="relative p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 text-white overflow-hidden">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -mr-8 -mt-8" />
                                        <p className="text-3xl font-bold">{insights.customer_health.at_risk}%</p>
                                        <p className="text-xs text-orange-100 font-medium mt-1">At Risk</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Key Insights - Clean Cards */}
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Key Insights</h4>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                                {insights.insights!.slice(0, 3).map((insight, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            'p-4 rounded-xl border-l-4 bg-white dark:bg-slate-800/50 shadow-sm hover:shadow-md transition-shadow',
                                            insight.type === 'success' ? 'border-l-green-500' :
                                                insight.type === 'warning' ? 'border-l-yellow-500' :
                                                    insight.type === 'critical' ? 'border-l-red-500' :
                                                        insight.type === 'opportunity' ? 'border-l-purple-500' :
                                                            'border-l-blue-500'
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <h5 className="font-semibold text-sm text-foreground leading-tight">{insight.title}</h5>
                                            {insight.impact && (
                                                <span className={cn(
                                                    "shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                                                    insight.impact === 'high' ? 'bg-red-100 text-red-700' :
                                                        insight.impact === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-gray-100 text-gray-600'
                                                )}>
                                                    {insight.impact}
                                                </span>
                                            )}
                                        </div>
                                        {insight.action && (
                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                {insight.action}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Action Items - Compact Lists */}
                        {((insights.quick_wins && insights.quick_wins.length > 0) || (insights.growth_recommendations && insights.growth_recommendations.length > 0)) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {insights.quick_wins && insights.quick_wins.length > 0 && (
                                    <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-lg">⚡</span>
                                            <h4 className="font-semibold text-sm text-green-800 dark:text-green-300">Quick Wins</h4>
                                        </div>
                                        <div className="space-y-2">
                                            {insights.quick_wins.slice(0, 2).map((win, idx) => (
                                                <div key={idx} className="flex items-start gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                                    <p className="text-xs text-green-700 dark:text-green-300 leading-relaxed">{win}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {insights.growth_recommendations && insights.growth_recommendations.length > 0 && (
                                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="text-lg">🚀</span>
                                            <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-300">Growth Strategy</h4>
                                        </div>
                                        <div className="space-y-2">
                                            {insights.growth_recommendations.slice(0, 2).map((rec, idx) => (
                                                <div key={idx} className="flex items-start gap-2">
                                                    <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                                                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{rec}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Fallback: Heuristic insights display */
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
                            {/* Sentiment Score */}
                            <div className={cn('p-4 rounded-xl text-center', getSentimentColor(insights.sentiment_score || 0))}>
                                <div className="flex items-center justify-center gap-1 mb-1">
                                    {(insights.sentiment_score || 0) >= 50 ? (
                                        <ThumbsUp className="w-4 h-4" />
                                    ) : (
                                        <ThumbsDown className="w-4 h-4" />
                                    )}
                                </div>
                                <p className="text-2xl font-bold">{insights.sentiment_score || 0}%</p>
                                <p className="text-xs opacity-80">Customer Sentiment</p>
                            </div>

                            {/* Engagement Score */}
                            <div className="p-4 rounded-xl text-center bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                <Activity className="w-4 h-4 mx-auto mb-1" />
                                <p className="text-2xl font-bold">{insights.engagement_score || 0}%</p>
                                <p className="text-xs opacity-80">Engagement Score</p>
                            </div>

                            {/* Churn Risk */}
                            <div className="p-4 rounded-xl text-center bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                                <AlertTriangle className="w-4 h-4 mx-auto mb-1" />
                                <p className="text-2xl font-bold">{insights.churn_risk_customers || 0}</p>
                                <p className="text-xs opacity-80">Churn Risk</p>
                            </div>

                            {/* High Value Customers */}
                            <div className="p-4 rounded-xl text-center bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                <DollarSign className="w-4 h-4 mx-auto mb-1" />
                                <p className="text-2xl font-bold">{insights.high_value_customers || 0}</p>
                                <p className="text-xs opacity-80">High Value</p>
                            </div>

                            {/* Best Send Time */}
                            <div className="p-4 rounded-xl text-center bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                                <Zap className="w-4 h-4 mx-auto mb-1" />
                                <p className="text-2xl font-bold">{insights.best_send_hour || 10}:00</p>
                                <p className="text-xs opacity-80">Best Send Time</p>
                            </div>

                            {/* Customer Satisfaction */}
                            <div className="p-4 rounded-xl text-center bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400">
                                <Target className="w-4 h-4 mx-auto mb-1" />
                                <p className="text-2xl font-bold">{insights.customer_satisfaction || 0}%</p>
                                <p className="text-xs opacity-80">Satisfaction</p>
                            </div>
                        </div>

                        {/* AI Recommendations */}
                        {insights.recommendations && insights.recommendations.length > 0 && (
                            <div className="bg-white/50 dark:bg-slate-800/50 rounded-xl p-4">
                                <h4 className="font-medium mb-3 flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-purple-600" />
                                    Smart Recommendations
                                </h4>
                                <div className="space-y-2">
                                    {insights.recommendations.map((rec, idx) => (
                                        <p key={idx} className="text-sm text-muted-foreground">
                                            {rec}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Upgrade prompt for heuristic insights */}
                        {!isRealAI && (
                            <div className="mt-4 text-center">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onGenerateInsights}
                                    disabled={loading}
                                    className="border-purple-300 text-purple-700 hover:bg-purple-50"
                                >
                                    {loading ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Brain className="w-4 h-4 mr-2" />
                                            Generate AI Insights
                                        </>
                                    )}
                                </Button>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Get ROI-focused insights powered by Sociovia AI
                                </p>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}


