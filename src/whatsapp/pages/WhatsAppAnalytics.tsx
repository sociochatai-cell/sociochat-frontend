// WhatsApp Analytics Dashboard
// =============================
// Business-first design: "A WhatsApp business report, not a developer console"
// Answers: Are customers seeing messages? Are they responding? Is it bringing business?

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    BarChart3,
    TrendingUp,
    TrendingDown,
    MessageCircle,
    CheckCheck,
    Eye,
    AlertCircle,
    Users,
    Clock,
    RefreshCw,
    Info,
    Building2,
    Inbox,
    Settings,
    Menu,
    X,
    Target,
    Search,
    Mail,
    Sliders,
    Brain,
    Zap,
    ThumbsUp,
    ThumbsDown,
    Activity,
    IndianRupee as DollarSign,
} from 'lucide-react';
import logo from '@/assets/sociovia_logo.png';
import { cn } from '@/lib/utils';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from 'recharts';
import { API_BASE_URL } from "@/config";
import { useDataCache } from '../hooks/useDataCache';
import { CACHE_KEYS, POLL_INTERVALS } from '../hooks/useWhatsAppData';

// Import new analytics components
import {
    ExecutiveSummaryCards,
    DeliveryFunnel,
    CategoryPerformance,
    TrendChart,
    ConversationInsights,
    ExportButtons,
} from '../components/analytics';

const API_BASE = API_BASE_URL;

// Summary data interface for executive view
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

// Trend data interface
interface TrendData {
    date: string;
    sent: number;
    delivered: number;
    read: number;
}

interface MessageStats {
    total_outgoing: number;
    total_incoming: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    delivery_rate: number;
    read_rate: number;
    failure_rate: number;
}

interface TemplateStats {
    template_name: string;
    total_sent: number;
    delivered: number;
    read: number;
    failed: number;
    delivery_rate: number;
    read_rate: number;
}

interface ConversationStats {
    total: number;
    open: number;
    with_unread: number;
    active_sessions: number;
}

interface AnalyticsData {
    success: boolean;
    period_label: string;
    messages: MessageStats;
    templates: TemplateStats[];
    conversations: ConversationStats;
}

// Tooltip descriptions for each metric
const METRIC_INFO: Record<string, string> = {
    'Messages Sent': 'Total number of messages you sent to customers via WhatsApp in this period. Includes text, templates, and media messages.',
    'Delivered': 'Number of messages that successfully reached the customer\'s device. The percentage below shows your delivery rate.',
    'Read': 'Number of delivered messages that were opened and read by customers. The percentage below shows your read engagement rate.',
    'Failed': 'Messages that failed to send due to invalid numbers, blocked users, or API errors. Check error details in the inbox.',
    'Total Conversations': 'Unique customers you have exchanged messages with. Each phone number represents one conversation.',
    'Open Conversations': 'Conversations that are currently active and not marked as closed by your team.',
    'Active Sessions': 'Conversations where the customer messaged within the last 24 hours. You can send free-form messages during this window.',
    'Unread': 'Conversations with messages you haven\'t read yet. These need your attention.',
};

// Workspace type
interface Workspace {
    id: number;
    name: string;
    logo?: string;
}

// AI Insights interface
interface AIInsights {
    sentiment_score?: number;
    sentiment_trend?: 'improving' | 'stable' | 'declining';
    churn_risk_customers?: number;
    high_value_customers?: number;
    engagement_score?: number;
    best_send_hour?: number;
    best_send_day?: string;
    response_rate?: number;
    avg_conversation_length?: number;
    customer_satisfaction?: number;
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

export function WhatsAppAnalytics() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Check if we're viewing conversation-specific analytics
    const conversationIdParam = searchParams.get('conversation');
    const conversationId = conversationIdParam ? parseInt(conversationIdParam, 10) : null;
    const isConversationView = conversationId !== null && !isNaN(conversationId);

    // Workspace state
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
    const [workspacesLoading, setWorkspacesLoading] = useState(true);

    // WhatsApp account linked state
    const [hasLinkedAccount, setHasLinkedAccount] = useState<boolean | null>(null);
    const [accountName, setAccountName] = useState<string | null>(null);
    const [checkingAccount, setCheckingAccount] = useState(false);

    // Overall analytics state
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [categoryData, setCategoryData] = useState<Record<string, {
        category: string;
        total_sent: number;
        delivered: number;
        read: number;
        failed: number;
        delivery_rate: number;
        read_rate: number;
        failure_rate: number;
    }> | null>(null);

    // Conversation-specific analytics state (matches actual API response)
    const [conversationData, setConversationData] = useState<{
        conversation_id: number;
        session: {
            is_open: boolean;
            expires_at: string | null;
            time_left_seconds: number;
            close_reason: string | null;
            closed_by_agent: boolean;
            closed_at: string | null;
        };
        messages: {
            total: number;
            incoming: number;
            outgoing: number;
            delivered: number;
            read: number;
            failed: number;
        };
        templates_used: Array<{
            name: string;
            count: number;
            category: string | null;
        }>;
    } | null>(null);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState('7');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [activeCategory, setActiveCategory] = useState<'utility' | 'marketing' | 'authentication'>('utility');

    const selectedWorkspaceName = useMemo(() => {
        const workspace = workspaces.find(w => String(w.id) === selectedWorkspaceId);
        return workspace?.name || 'SocioChat';
    }, [workspaces, selectedWorkspaceId]);

    // New business-first analytics state
    const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
    const [trendData, setTrendData] = useState<TrendData[]>([]);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [trendsLoading, setTrendsLoading] = useState(false);

    // AI Insights state
    const [aiInsights, setAIInsights] = useState<AIInsights | null>(null);
    const [aiInsightsLoading, setAIInsightsLoading] = useState(false);

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

                // Set initial workspace from storage or first one
                const storedWs = localStorage.getItem('sv_whatsapp_workspace_id') || sessionStorage.getItem('sv_whatsapp_workspace_id');
                if (storedWs && mapped.some((w: Workspace) => w.id === Number(storedWs))) {
                    setSelectedWorkspaceId(storedWs);
                } else if (mapped.length > 0) {
                    const firstWsId = String(mapped[0].id);
                    setSelectedWorkspaceId(firstWsId);
                    // Store the initial workspace ID so other pages can use it
                    localStorage.setItem('sv_whatsapp_workspace_id', firstWsId);
                    sessionStorage.setItem('sv_whatsapp_workspace_id', firstWsId);
                }
            } catch (err) {
                console.error('Failed to fetch workspaces:', err);
            } finally {
                setWorkspacesLoading(false);
            }
        };
        fetchWorkspaces();
    }, []);

    // Handle workspace change
    const handleWorkspaceChange = (wsId: string) => {
        setSelectedWorkspaceId(wsId);
        localStorage.setItem('sv_whatsapp_workspace_id', wsId);
        sessionStorage.setItem('sv_whatsapp_workspace_id', wsId);
        setHasLinkedAccount(null); // Reset account check on workspace change
        setAccountName(null);
    };

    // Check if workspace has a linked WhatsApp account
    useEffect(() => {
        const checkLinkedAccount = async () => {
            if (!selectedWorkspaceId) {
                setHasLinkedAccount(null);
                setAccountName(null);
                return;
            }
            setCheckingAccount(true);
            try {
                const res = await fetch(`${API_BASE}/api/whatsapp/connection-path?workspace_id=${selectedWorkspaceId}`, {
                    credentials: 'include',
                });
                const data = await res.json();
                if (data.status === 'CONNECTED') {
                    setHasLinkedAccount(true);
                    // Prioritise verified_name, then phone_number
                    const name = data.account_summary?.verified_name || data.account_summary?.phone_number;
                    if (name) {
                        setAccountName(name);
                    } else {
                        setAccountName(null);
                    }
                } else {
                    setHasLinkedAccount(false);
                    setAccountName(null);
                }
            } catch (err) {
                console.error('Failed to check linked account:', err);
                setHasLinkedAccount(false);
                setAccountName(null);
            } finally {
                setCheckingAccount(false);
            }
        };
        checkLinkedAccount();
    }, [selectedWorkspaceId]);

    // Fetch analytics with optional silent refresh
    const fetchAnalytics = useCallback(async (silent = false) => {
        if (!selectedWorkspaceId) {
            setError('Please select a workspace');
            setLoading(false);
            return;
        }

        // Only show loading on initial load, not silent refresh
        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError(null);

        try {
            const token = localStorage.getItem('token');

            if (isConversationView) {
                // Fetch conversation-specific analytics
                const res = await fetch(`${API_BASE}/api/whatsapp/analytics/conversations/${conversationId}?days=${period}&workspace_id=${selectedWorkspaceId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: 'include',
                });
                const json = await res.json();
                if (json.success) {
                    setConversationData(json);
                    setLastUpdated(Date.now());
                } else {
                    setError(json.error || 'Failed to load conversation analytics');
                }
            } else {
                // Build query params
                let queryParams = '';
                if (period === 'custom' && startDate && endDate) {
                    queryParams = `start_date=${startDate}&end_date=${endDate}`;
                } else if (period === 'all') {
                    queryParams = 'days=0';  // 0 means all time
                } else {
                    queryParams = `days=${period}`;
                }

                // Fetch overall analytics with workspace_id
                const wsParam = `workspace_id=${selectedWorkspaceId}`;
                const [analyticsRes, categoryRes] = await Promise.all([
                    fetch(`${API_BASE}/api/whatsapp/analytics?${queryParams}&${wsParam}`, {
                        headers: { Authorization: `Bearer ${token}` },
                        credentials: 'include',
                    }),
                    fetch(`${API_BASE}/api/whatsapp/analytics/categories?${queryParams}&${wsParam}`, {
                        headers: { Authorization: `Bearer ${token}` },
                        credentials: 'include',
                    }),
                ]);

                const analyticsJson = await analyticsRes.json();
                const categoryJson = await categoryRes.json();

                if (analyticsJson.success) {
                    setData(analyticsJson);
                    setLastUpdated(Date.now());
                } else {
                    setError(analyticsJson.error || 'Failed to load analytics');
                }

                if (categoryJson.success) {
                    setCategoryData(categoryJson.categories);
                }

                // Fetch new business-first endpoints (summary and trends)
                const daysForTrends = period === 'all' ? '30' : period === 'custom' ? '30' : period;
                try {
                    const [summaryRes, trendsRes] = await Promise.all([
                        fetch(`${API_BASE}/api/whatsapp/analytics/summary?${wsParam}&days=${daysForTrends}`, {
                            headers: { Authorization: `Bearer ${token}` },
                            credentials: 'include',
                        }),
                        fetch(`${API_BASE}/api/whatsapp/analytics/trends?${wsParam}&days=${daysForTrends}`, {
                            headers: { Authorization: `Bearer ${token}` },
                            credentials: 'include',
                        }),
                    ]);

                    const summaryJson = await summaryRes.json();
                    const trendsJson = await trendsRes.json();

                    if (summaryJson.success) {
                        setSummaryData(summaryJson);
                    }
                    if (trendsJson.success) {
                        setTrendData(trendsJson.daily || []);
                    }
                } catch (err) {
                    console.error('Failed to fetch summary/trends:', err);
                    // Non-critical, don't set error
                }
            }
        } catch (err) {
            setError('Failed to fetch analytics');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedWorkspaceId, isConversationView, conversationId, period, startDate, endDate]);

    // Initial fetch and dependency-based refetch
    useEffect(() => {
        if (selectedWorkspaceId && hasLinkedAccount === true) {
            fetchAnalytics(false);
        }
    }, [period, conversationId, startDate, endDate, selectedWorkspaceId, hasLinkedAccount, fetchAnalytics]);

    // Auto-refresh every 30 seconds (silent)
    useEffect(() => {
        if (!selectedWorkspaceId || hasLinkedAccount !== true) return;

        const interval = setInterval(() => {
            // Only refresh if tab is visible
            if (document.visibilityState === 'visible') {
                fetchAnalytics(true);
            }
        }, POLL_INTERVALS.NORMAL);

        return () => clearInterval(interval);
    }, [selectedWorkspaceId, hasLinkedAccount, fetchAnalytics]);

    // Manual refresh handler
    const handleRefresh = () => {
        fetchAnalytics(false);
    };

    // Info tooltip component with beautiful animation
    const InfoTooltip = ({ metric }: { metric: string }) => {
        const description = METRIC_INFO[metric] || 'No description available.';

        return (
            <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                    <button className="group relative ml-1.5 -mt-0.5 inline-flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full bg-primary/20 scale-0 group-hover:scale-150 transition-transform duration-300 ease-out" />
                        <Info className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors duration-200 relative z-10" />
                    </button>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    className="max-w-xs bg-popover/95 backdrop-blur-sm border shadow-xl animate-in fade-in-0 zoom-in-95 duration-200"
                    sideOffset={8}
                >
                    <div className="flex items-start gap-2 p-1">
                        <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <p className="text-sm leading-relaxed">{description}</p>
                    </div>
                </TooltipContent>
            </Tooltip>
        );
    };

    const StatCard = ({
        title,
        value,
        subtitle,
        icon: Icon,
        trend,
        color = 'primary',
    }: {
        title: string;
        value: string | number;
        subtitle?: string;
        icon: typeof MessageCircle;
        trend?: 'up' | 'down' | 'neutral';
        color?: 'primary' | 'green' | 'blue' | 'red' | 'yellow';
    }) => {
        const colorClasses = {
            primary: 'from-primary/20 to-primary/5 text-primary',
            green: 'from-green-500/20 to-green-500/5 text-green-600',
            blue: 'from-blue-500/20 to-blue-500/5 text-blue-600',
            red: 'from-red-500/20 to-red-500/5 text-red-600',
            yellow: 'from-yellow-500/20 to-yellow-500/5 text-yellow-600',
        };

        return (
            <Card className="relative overflow-hidden group hover:shadow-lg transition-shadow duration-300">
                <div className={cn('absolute inset-0 bg-gradient-to-br opacity-50 group-hover:opacity-70 transition-opacity duration-300', colorClasses[color])} />
                <CardContent className="relative p-3 md:p-6">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs md:text-sm font-medium text-muted-foreground flex items-center truncate">
                                {title}
                                <span className="hidden md:inline"><InfoTooltip metric={title} /></span>
                            </p>
                            <p className="text-xl md:text-3xl font-bold mt-0.5 md:mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                            {subtitle && <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5 md:mt-1 truncate">{subtitle}</p>}
                        </div>
                        <div className={cn(
                            'p-2 md:p-3 rounded-full transition-transform duration-300 group-hover:scale-110 shrink-0',
                            colorClasses[color].replace('text-', 'bg-').split(' ')[0]
                        )}>
                            <Icon className="w-4 h-4 md:w-5 md:h-5" />
                        </div>
                    </div>
                    {trend && (
                        <div className="mt-2 md:mt-3 flex items-center gap-1 text-sm">
                            {trend === 'up' ? (
                                <TrendingUp className="w-4 h-4 text-green-500" />
                            ) : trend === 'down' ? (
                                <TrendingDown className="w-4 h-4 text-red-500" />
                            ) : null}
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    const ProgressBar = ({ value, color }: { value: number; color: string }) => (
        <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
                className={cn('h-full transition-all duration-500', color)}
                style={{ width: `${Math.min(value, 100)}%` }}
            />
        </div>
    );

    // Show checking account state
    if (checkingAccount) {
        return (
            <div className="min-h-screen bg-background p-6 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Checking WhatsApp account...</p>
                </div>
            </div>
        );
    }

    // Show no account linked state
    if (hasLinkedAccount === false) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-6">

                <div className="w-full">
                    {/* Header with workspace selector */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-4">
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                                    <img src={logo} alt="SocioChat" className="w-5 h-5 md:w-6 md:h-6" />
                                    {accountName || selectedWorkspaceName} Analytics
                                </h1>
                                <p className="text-muted-foreground text-xs md:text-sm">Select workspace to view analytics</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 ml-12 md:ml-0">
                            {/* Workspace Dropdown */}
                            <Select
                                value={selectedWorkspaceId || ''}
                                onValueChange={handleWorkspaceChange}
                                disabled={workspacesLoading || workspaces.length === 0}
                            >
                                <SelectTrigger className="w-full md:w-48">
                                    <Building2 className="w-4 h-4 mr-2" />
                                    <SelectValue placeholder={workspacesLoading ? 'Loading...' : 'Select Workspace'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {workspaces.map((ws) => (
                                        <SelectItem key={ws.id} value={String(ws.id)}>
                                            {ws.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* No Account Card */}
                    <Card className="max-w-lg mx-auto">
                        <CardContent className="p-8 text-center">
                            <MessageCircle className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold mb-2">No WhatsApp Account Linked</h2>
                            <p className="text-muted-foreground mb-6">
                                Connect your WhatsApp Business account for workspace "{workspaces.find(w => String(w.id) === selectedWorkspaceId)?.name || 'this workspace'}" to view analytics.
                            </p>
                            <div className="flex flex-col gap-3">
                                <Button onClick={() => navigate('/dashboard/settings')} className="gap-2 w-full">
                                    <MessageCircle className="w-4 h-4" />
                                    Connect WhatsApp Account
                                </Button>
                                <Button variant="outline" onClick={() => navigate('/dashboard/inbox')} className="gap-2 w-full">
                                    <Inbox className="w-4 h-4" />
                                    Go to Inbox
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background p-6 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading analytics...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-background p-6 flex items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="p-6 text-center">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-lg font-semibold mb-2">Failed to load analytics</h2>
                        <p className="text-muted-foreground mb-4">{error}</p>
                        <Button onClick={() => fetchAnalytics(false)}>Try Again</Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Conversation-specific analytics view
    if (isConversationView && conversationData) {
        // Calculate rates from raw counts
        const deliveryRate = conversationData.messages.outgoing > 0
            ? Math.round((conversationData.messages.delivered / conversationData.messages.outgoing) * 100)
            : 0;
        const readRate = conversationData.messages.outgoing > 0
            ? Math.round((conversationData.messages.read / conversationData.messages.outgoing) * 100)
            : 0;
        const templateCount = conversationData.templates_used?.reduce((acc, t) => acc + t.count, 0) || 0;

        return (
            <TooltipProvider>
                <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4 md:p-6">

                    <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
                        {/* Header with Menu Button */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 md:gap-4">
                                <div>
                                    <h1 className="text-lg md:text-2xl font-bold flex items-center gap-2">
                                        <img src={logo} alt="SocioChat" className="w-5 h-5 md:w-6 md:h-6" />
                                        {accountName || selectedWorkspaceName} Analytics
                                    </h1>
                                    <p className="text-xs md:text-sm text-muted-foreground">
                                        Conversation #{conversationData.conversation_id}
                                    </p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="ml-12 md:ml-0 w-fit" onClick={() => navigate('/dashboard/analytics')}>
                                View Overall Analytics
                            </Button>
                        </div>

                        {/* Session Info Card */}
                        <Card className="border-0 shadow-lg">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="w-5 h-5" />
                                    Session Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4">
                                    <Badge variant={conversationData.session.is_open ? 'default' : 'secondary'}>
                                        {conversationData.session.is_open ? '🟢 Active Session' : '⚪ Session Expired'}
                                    </Badge>
                                    {conversationData.session.is_open && (
                                        <span className="text-sm text-muted-foreground">
                                            {Math.floor(conversationData.session.time_left_seconds / 3600)}h {Math.floor((conversationData.session.time_left_seconds % 3600) / 60)}m left
                                        </span>
                                    )}
                                    {conversationData.session.closed_by_agent && (
                                        <Badge variant="destructive">Closed by agent</Badge>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Message Stats */}
                        <Card>
                            <CardHeader>
                                <CardTitle>📨 Message Statistics</CardTitle>
                                <CardDescription>Messages sent and received in this conversation</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-4 bg-muted/30 rounded-lg text-center">
                                        <p className="text-3xl font-bold">{conversationData.messages.total}</p>
                                        <p className="text-sm text-muted-foreground">Total Messages</p>
                                    </div>
                                    <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-center">
                                        <p className="text-3xl font-bold text-blue-600">{conversationData.messages.incoming}</p>
                                        <p className="text-sm text-muted-foreground">Received</p>
                                    </div>
                                    <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg text-center">
                                        <p className="text-3xl font-bold text-green-600">{conversationData.messages.outgoing}</p>
                                        <p className="text-sm text-muted-foreground">Sent</p>
                                    </div>
                                    <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg text-center">
                                        <p className="text-3xl font-bold text-purple-600">{templateCount}</p>
                                        <p className="text-sm text-muted-foreground">Templates</p>
                                    </div>
                                </div>


                                {/* Mini Message Flow Chart */}
                                <div className="mt-6">
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart
                                            data={[
                                                { name: 'Incoming', value: conversationData.messages.incoming, fill: '#3b82f6' },
                                                { name: 'Outgoing', value: conversationData.messages.outgoing, fill: '#22c55e' },
                                                { name: 'Delivered', value: conversationData.messages.delivered, fill: '#10b981' },
                                                { name: 'Read', value: conversationData.messages.read, fill: '#6366f1' },
                                            ]}
                                            margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                            <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
                                            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                                            <RechartsTooltip
                                                contentStyle={{
                                                    backgroundColor: 'white',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '8px',
                                                }}
                                            />
                                            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                                {[
                                                    { fill: '#3b82f6' },
                                                    { fill: '#22c55e' },
                                                    { fill: '#10b981' },
                                                    { fill: '#6366f1' },
                                                ].map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Templates Used */}
                        {conversationData.templates_used && conversationData.templates_used.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>📝 Templates Used</CardTitle>
                                    <CardDescription>Template messages sent in this conversation</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {conversationData.templates_used.map((t, idx) => (
                                            <div key={idx} className="p-3 bg-muted/30 rounded-lg flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium">{t.name}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        Sent {t.count}x {t.category && `• Category: ${t.category}`}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </TooltipProvider>
        );
    }

    return (
        <TooltipProvider>
            <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4 md:p-6">

                <div className="w-full space-y-4 md:space-y-6">
                    {/* Header - Desktop */}
                    <div className="hidden md:flex items-center justify-between border-b pb-4">
                        <div className="flex items-center gap-4">
                            <div>
                                <h1 className="text-2xl font-bold flex items-center gap-2">
                                    <img src={logo} alt="SocioChat" className="w-6 h-6" />
                                    {accountName || selectedWorkspaceName} Analytics
                                </h1>
                                <p className="text-muted-foreground text-sm">{data?.period_label || 'Performance'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Period Dropdown */}
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
                                    <SelectItem value="custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Custom date range picker */}
                            {period === 'custom' && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="px-2 py-1 text-sm border rounded-md bg-background w-32"
                                    />
                                    <span className="text-muted-foreground text-sm">to</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="px-2 py-1 text-sm border rounded-md bg-background w-32"
                                    />
                                </div>
                            )}

                            {/* Last updated indicator */}
                            {lastUpdated && !loading && (
                                <span className="text-xs text-muted-foreground hidden sm:block">
                                    Updated {Math.round((Date.now() - lastUpdated) / 1000)}s ago
                                </span>
                            )}

                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handleRefresh}
                                disabled={refreshing}
                            >
                                <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                            </Button>

                            <div className="h-6 w-px bg-border" />




                            {/* Export Button */}
                            <ExportButtons
                                workspaceId={selectedWorkspaceId}
                                period={period}
                                startDate={startDate}
                                endDate={endDate}
                            />

                            <div className="h-6 w-px bg-border" />

                            {/* Workspace dropdown */}
                            <Select
                                value={selectedWorkspaceId || ''}
                                onValueChange={handleWorkspaceChange}
                                disabled={workspacesLoading || workspaces.length === 0}
                            >
                                <SelectTrigger className="w-48">
                                    <Building2 className="w-4 h-4 mr-2" />
                                    <SelectValue placeholder={workspacesLoading ? 'Loading...' : 'Workspace'} />
                                </SelectTrigger>
                                <SelectContent>
                                    {workspaces.map((ws) => (
                                        <SelectItem key={ws.id} value={String(ws.id)}>
                                            {ws.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Header - Mobile */}
                    <div className="md:hidden space-y-3">
                        {/* Top row: Menu, Title, Workspace */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div>
                                    <h1 className="text-base font-bold flex items-center gap-1.5">
                                        <img src={logo} alt="SocioChat" className="w-5 h-5" />
                                        {accountName || selectedWorkspaceName} Analytics
                                    </h1>
                                    <p className="text-muted-foreground text-[10px]">{data?.period_label || 'Last 7 days'}</p>
                                </div>
                            </div>
                            {/* Workspace dropdown */}
                            <Select
                                value={selectedWorkspaceId || ''}
                                onValueChange={handleWorkspaceChange}
                                disabled={workspacesLoading || workspaces.length === 0}
                            >
                                <SelectTrigger className="w-28 h-8 text-xs">
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
                        </div>

                        {/* Controls row */}
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                {/* Period Dropdown */}
                                <Select value={period} onValueChange={setPeriod}>
                                    <SelectTrigger className="w-24 h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="7">7 days</SelectItem>
                                        <SelectItem value="14">14 days</SelectItem>
                                        <SelectItem value="30">30 days</SelectItem>
                                        <SelectItem value="90">90 days</SelectItem>
                                        <SelectItem value="all">All</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={handleRefresh}
                                    disabled={refreshing}
                                >
                                    <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                                </Button>
                            </div>

                            {/* Quick action icons */}
                            <div className="flex items-center gap-1">


                                <ExportButtons
                                    workspaceId={selectedWorkspaceId}
                                    period={period}
                                    startDate={startDate}
                                    endDate={endDate}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ============================================ */}
                    {/* SECTION 1: Executive Summary (CEO View)     */}
                    {/* ============================================ */}
                    <div className="analytics-content">
                        <ExecutiveSummaryCards
                            data={summaryData}
                            loading={summaryLoading}
                        />
                    </div>

                    {/* ============================================ */}
                    {/* SECTION 1.5: AI-Powered Insights            */}
                    {/* ============================================ */}
                    <AIInsightsSection
                        insights={aiInsights}
                        loading={aiInsightsLoading}
                        onGenerateInsights={() => generateRealAIInsights(false)}
                        onRefreshInsights={() => generateRealAIInsights(true)}
                        accountName={accountName}
                        selectedWorkspaceName={selectedWorkspaceName}
                    />

                    {/* ============================================ */}
                    {/* SECTION 2: Delivery Funnel + Trend Chart    */}
                    {/* ============================================ */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <DeliveryFunnel
                            sent={data?.messages.total_outgoing || 0}
                            delivered={data?.messages.delivered || 0}
                            read={data?.messages.read || 0}
                            failed={data?.messages.failed || 0}
                        />
                        <TrendChart
                            data={trendData}
                            loading={trendsLoading}
                            periodDays={parseInt(period) || 7}
                        />
                    </div>

                    {/* ============================================ */}
                    {/* SECTION 3: Category Performance (Money)     */}
                    {/* ============================================ */}
                    <CategoryPerformance categories={categoryData} />

                    {/* ============================================ */}
                    {/* SECTION 4: Conversation Insights            */}
                    {/* ============================================ */}
                    <ConversationInsights conversations={data?.conversations || null} />

                    {/* ============================================ */}
                    {/* SECTION 5: Template Performance             */}
                    {/* ============================================ */}
                    <Card className="border-0 shadow-md">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                📝 Template Performance
                                <Tooltip delayDuration={200}>
                                    <TooltipTrigger asChild>
                                        <button className="group relative inline-flex items-center justify-center">
                                            <Info className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" className="max-w-sm">
                                        <p className="text-sm">
                                            Shows delivery and read rates for each WhatsApp template message you've sent.
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </CardTitle>
                            <CardDescription>Delivery and read rates by template</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {data?.templates && data.templates.length > 0 ? (
                                <div className="space-y-4">
                                    {data.templates.slice(0, 5).map((t) => (
                                        <div key={t.template_name} className="p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors duration-200">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <h4 className="font-medium">{t.template_name}</h4>
                                                    <p className="text-sm text-muted-foreground">
                                                        {t.total_sent} sent • {t.delivered} delivered • {t.read} read
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {t.failed > 0 && (
                                                        <Badge variant="destructive" className="text-xs">
                                                            {t.failed} failed
                                                        </Badge>
                                                    )}
                                                    <Badge
                                                        variant={t.delivery_rate >= 90 ? 'default' : t.delivery_rate >= 70 ? 'secondary' : 'destructive'}
                                                    >
                                                        {t.delivery_rate}% delivered
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="text-muted-foreground">Delivery Rate</span>
                                                        <span className="font-medium">{t.delivery_rate}%</span>
                                                    </div>
                                                    <ProgressBar value={t.delivery_rate} color="bg-green-500" />
                                                </div>
                                                <div>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="text-muted-foreground">Read Rate</span>
                                                        <span className="font-medium">{t.read_rate}%</span>
                                                    </div>
                                                    <ProgressBar value={t.read_rate} color="bg-blue-500" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {data.templates.length > 5 && (
                                        <p className="text-center text-sm text-muted-foreground">
                                            Showing top 5 of {data.templates.length} templates
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                                        <BarChart3 className="w-8 h-8 opacity-50" />
                                    </div>
                                    <p className="font-medium">No template messages sent yet</p>
                                    <p className="text-sm mt-1">
                                        When you send template messages, their performance will appear here.
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ============================================ */}
                    {/* About Section                                */}
                    {/* ============================================ */}
                    <Card className="bg-muted/30 border-dashed">
                        <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <BarChart3 className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h4 className="font-medium">About These Metrics</h4>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        All data is sourced from WhatsApp webhooks. Delivery and read rates only track YOUR outgoing messages.
                                        WhatsApp does not provide read receipts for incoming messages. Cost estimates are approximate based on
                                        standard WhatsApp Business API pricing.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </TooltipProvider>
    );
}

// AI Insights Section Component - Real Gemini-powered insights with cost tracking
function AIInsightsSection({
    insights,
    loading,
    onGenerateInsights,
    onRefreshInsights,
    accountName,
    selectedWorkspaceName
}: {
    insights: AIInsights | null;
    loading: boolean;
    onGenerateInsights: () => void;
    onRefreshInsights: () => void;
    accountName: string | null;
    selectedWorkspaceName: string;
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
            case 'warning': return <AlertCircle className="w-4 h-4 text-yellow-600" />;
            case 'critical': return <AlertCircle className="w-4 h-4 text-red-600" />;
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
                        <Badge variant="secondary" className="text-[10px] ml-2">{accountName || selectedWorkspaceName}</Badge>
                    </CardTitle>
                    <CardDescription>
                        Get intelligent analytics powered by SocioChat AI
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="text-center py-8">
                        <Brain className="w-12 h-12 mx-auto text-purple-400 mb-4" />
                        <p className="text-muted-foreground mb-4">
                            Click below to generate AI-powered insights for your {accountName || selectedWorkspaceName} Analytics.
                        </p>
                        <p className="text-xs text-muted-foreground mb-4">
                            ⚡ Uses {accountName || selectedWorkspaceName} • Cached for 24 hours
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
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg flex-wrap">
                            <Brain className="w-5 h-5 text-purple-600" />
                            AI-Powered Insights
                            <Badge
                                variant="default"
                                className="text-[10px] bg-purple-600"
                            >
                                {accountName || selectedWorkspaceName}
                            </Badge>
                            {insights.metadata?.from_cache && (
                                <Badge variant="outline" className="text-[10px]">Cached</Badge>
                            )}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-4 mt-1 flex-wrap">
                            <span>AI-powered business intelligence for your WhatsApp performance</span>
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
                                <AlertCircle className="w-4 h-4 mx-auto mb-1" />
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
                                    Get ROI-focused insights powered by SocioChat AI
                                </p>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}

export default WhatsAppAnalytics;
