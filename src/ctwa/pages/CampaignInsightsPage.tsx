// Campaign Insights Page
// ======================
// Analytics for a single WhatsApp Status / CTWA ad campaign, plus an overall
// workspace summary. Opened at: /ctwa/campaigns/:id/insights?workspace_id=<ws>

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
    ArrowLeft,
    BarChart3,
    RefreshCw,
    Eye,
    MousePointerClick,
    Banknote,
    MessageCircle,
    Target,
    MessagesSquare,
    Megaphone,
    Sprout,
    Activity,
    Percent,
    Info,
} from 'lucide-react';
import {
    getCampaignInsights,
    getAnalyticsSummary,
    type CampaignMetrics,
    type AnalyticsSummary,
    type CampaignStatus,
} from '@/ctwa';
import { getWorkspaceId } from '@/whatsapp/utils/workspaceContext';

// ------------------------------------------------------------------
// Formatting helpers
// ------------------------------------------------------------------

function formatNumber(value?: number | null): string {
    if (value === null || value === undefined) return '—';
    return value.toLocaleString('en-IN');
}

function formatCurrency(value?: number | null): string {
    if (value === null || value === undefined) return '—';
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatPercent(value?: number | null): string {
    if (value === null || value === undefined) return '—';
    const rounded = Math.round(value * 10) / 10;
    return `${rounded}%`;
}

function statusBadgeClass(status?: CampaignStatus): string {
    switch (status) {
        case 'ACTIVE':
            return 'bg-green-500/10 text-green-600 border-green-500/20';
        case 'PAUSED':
            return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
        case 'DRAFT':
            return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
        case 'ARCHIVED':
            return 'bg-gray-400/10 text-gray-500 border-gray-400/20';
        default:
            return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
}

function isAllZero(metrics?: CampaignMetrics['metrics']): boolean {
    if (!metrics) return false;
    return (
        !metrics.impressions &&
        !metrics.clicks &&
        !metrics.spend &&
        !metrics.conversations
    );
}

// ------------------------------------------------------------------
// Page
// ------------------------------------------------------------------

export function CampaignInsightsPage() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const campaignId = Number(id);
    // Prefer an explicit workspace from the URL, fall back to the active one.
    const workspaceId = searchParams.get('workspace_id') || getWorkspaceId() || '';

    const [insights, setInsights] = useState<CampaignMetrics | null>(null);
    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);

        // Fetch both in parallel; one failing must not kill the other.
        const [insightsResult, summaryResult] = await Promise.allSettled([
            Number.isNaN(campaignId)
                ? Promise.reject(new Error('Invalid campaign id'))
                : getCampaignInsights(campaignId),
            workspaceId
                ? getAnalyticsSummary(workspaceId)
                : Promise.reject(new Error('No workspace selected')),
        ]);

        if (insightsResult.status === 'fulfilled') {
            setInsights(insightsResult.value);
        } else {
            setInsights(null);
            toast({
                title: 'Could not load campaign insights',
                description: 'The campaign stats are unavailable right now. Try refreshing.',
                variant: 'destructive',
            });
        }

        if (summaryResult.status === 'fulfilled') {
            setSummary(summaryResult.value);
        } else {
            setSummary(null);
            toast({
                title: 'Could not load workspace summary',
                description: 'The workspace overview is unavailable right now. Try refreshing.',
                variant: 'destructive',
            });
        }

        setLoading(false);
    }, [campaignId, workspaceId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const metrics = insights?.metrics;

    return (
        <div className="container max-w-6xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="min-w-0">
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <BarChart3 className="w-8 h-8 text-primary" />
                            Campaign Insights
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Performance for this ad and your overall workspace
                        </p>
                    </div>
                </div>
                <Button variant="outline" onClick={fetchData} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Campaign name + status */}
            <div className="mb-8">
                {loading && !insights ? (
                    <Skeleton className="h-8 w-64" />
                ) : insights ? (
                    <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-xl font-semibold truncate">{insights.name}</h2>
                        <Badge className={statusBadgeClass(insights.status)}>
                            {insights.status}
                        </Badge>
                        {insights.period && (
                            <span className="text-sm text-muted-foreground">
                                {insights.period.replace(/_/g, ' ')}
                            </span>
                        )}
                    </div>
                ) : (
                    <h2 className="text-xl font-semibold text-muted-foreground">
                        Campaign #{Number.isNaN(campaignId) ? '—' : campaignId}
                    </h2>
                )}
            </div>

            {/* Section: This Campaign */}
            <section className="mb-8">
                <h3 className="text-lg font-semibold mb-4">This Campaign</h3>
                {loading ? (
                    <StatGridSkeleton count={5} />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <StatCard
                            title="Impressions"
                            value={formatNumber(metrics?.impressions)}
                            icon={<Eye className="w-5 h-5 text-blue-500" />}
                        />
                        <StatCard
                            title="Clicks"
                            value={formatNumber(metrics?.clicks)}
                            icon={<MousePointerClick className="w-5 h-5 text-indigo-500" />}
                        />
                        <StatCard
                            title="Spend"
                            value={formatCurrency(metrics?.spend)}
                            icon={<Banknote className="w-5 h-5 text-emerald-500" />}
                        />
                        <StatCard
                            title="Conversations"
                            value={formatNumber(metrics?.conversations)}
                            icon={<MessageCircle className="w-5 h-5 text-green-500" />}
                        />
                        <StatCard
                            title="Cost / Conversation"
                            value={formatCurrency(metrics?.cost_per_conversation)}
                            icon={<Target className="w-5 h-5 text-orange-500" />}
                        />
                    </div>
                )}

                {/* Friendly zero-state note (normal for a brand-new / paused ad) */}
                {!loading && insights && isAllZero(metrics) && (
                    <p className="text-sm text-muted-foreground mt-3 flex items-start gap-2">
                        <Info className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>
                            Everything reads zero, which is completely normal for a brand-new or
                            paused ad. Numbers appear here once the ad is live and delivering.
                        </span>
                    </p>
                )}
            </section>

            {/* Section: Workspace Overview */}
            <section className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Workspace Overview</h3>
                {loading ? (
                    <StatGridSkeleton count={5} />
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <StatCard
                            title="Total Conversations"
                            value={formatNumber(summary?.total_conversations)}
                            icon={<MessagesSquare className="w-5 h-5 text-primary" />}
                        />
                        <StatCard
                            title="From Ads"
                            value={formatNumber(summary?.ctwa_conversations)}
                            icon={<Megaphone className="w-5 h-5 text-blue-500" />}
                        />
                        <StatCard
                            title="Organic"
                            value={formatNumber(summary?.organic_conversations)}
                            icon={<Sprout className="w-5 h-5 text-green-500" />}
                        />
                        <StatCard
                            title="Active Campaigns"
                            value={formatNumber(summary?.active_campaigns)}
                            icon={<Activity className="w-5 h-5 text-orange-500" />}
                        />
                        <StatCard
                            title="CTWA %"
                            value={formatPercent(summary?.ctwa_percentage)}
                            icon={<Percent className="w-5 h-5 text-indigo-500" />}
                        />
                    </div>
                )}
            </section>

            {/* Helper line */}
            <p className="text-sm text-muted-foreground flex items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                    Spend and impressions start populating once your ad is approved by Meta and
                    goes live. Conversation counts update as people message you from the ad.
                </span>
            </p>
        </div>
    );
}

// ------------------------------------------------------------------
// Presentational helpers
// ------------------------------------------------------------------

function StatCard({
    title,
    value,
    icon,
}: {
    title: string;
    value: string;
    icon: ReactNode;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <p className="text-2xl font-bold">{value}</p>
            </CardContent>
        </Card>
    );
}

function StatGridSkeleton({ count }: { count: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <Card key={i}>
                    <CardContent className="p-6">
                        <Skeleton className="h-4 w-1/2 mb-3" />
                        <Skeleton className="h-8 w-3/4" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export default CampaignInsightsPage;
