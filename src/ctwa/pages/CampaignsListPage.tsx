// Campaigns List Page
// ====================

import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import {
    Plus,
    Megaphone,
    Play,
    Pause,
    Trash2,
    BarChart3,
    ExternalLink,
    RefreshCw,
} from 'lucide-react';
import { listCampaigns, deleteCampaign, CTWACampaign } from '@/ctwa';

export function CampaignsListPage() {
    const [searchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspace_id') || '4';

    const [campaigns, setCampaigns] = useState<CTWACampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<number | null>(null);

    const fetchCampaigns = async () => {
        setLoading(true);
        try {
            const data = await listCampaigns(workspaceId);
            setCampaigns(data);
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to load campaigns',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCampaigns();
    }, [workspaceId]);

    const handleDelete = async (id: number, name: string) => {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;

        setDeleting(id);
        try {
            await deleteCampaign(id);
            setCampaigns(prev => prev.filter(c => c.id !== id));
            toast({ title: 'Deleted', description: `Campaign "${name}" deleted.` });
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to delete',
                variant: 'destructive',
            });
        } finally {
            setDeleting(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'bg-green-500';
            case 'PAUSED':
                return 'bg-yellow-500';
            case 'DRAFT':
                return 'bg-gray-500';
            case 'ARCHIVED':
                return 'bg-gray-400';
            default:
                return 'bg-gray-500';
        }
    };

    return (
        <div className="container max-w-6xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Megaphone className="w-8 h-8 text-primary" />
                        WhatsApp Ads
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Create and manage Click-to-WhatsApp campaigns
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={fetchCampaigns}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Link to={`/ctwa/create?workspace_id=${workspaceId}`}>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Ad
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <StatsCard
                    title="Active Campaigns"
                    value={campaigns.filter(c => c.status === 'ACTIVE').length}
                    icon={<Play className="w-5 h-5 text-green-500" />}
                />
                <StatsCard
                    title="Paused"
                    value={campaigns.filter(c => c.status === 'PAUSED').length}
                    icon={<Pause className="w-5 h-5 text-yellow-500" />}
                />
                <StatsCard
                    title="Drafts"
                    value={campaigns.filter(c => c.status === 'DRAFT').length}
                    icon={<Megaphone className="w-5 h-5 text-gray-500" />}
                />
                <StatsCard
                    title="Total"
                    value={campaigns.length}
                    icon={<BarChart3 className="w-5 h-5 text-primary" />}
                />
            </div>

            {/* Campaigns Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <Card key={i}>
                            <CardContent className="p-6">
                                <Skeleton className="h-6 w-3/4 mb-4" />
                                <Skeleton className="h-4 w-1/2 mb-2" />
                                <Skeleton className="h-4 w-1/4" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : campaigns.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <Megaphone className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-xl font-semibold mb-2">No Campaigns Yet</h3>
                        <p className="text-muted-foreground mb-6">
                            Create your first Click-to-WhatsApp ad to start receiving conversations.
                        </p>
                        <Link to={`/ctwa/create?workspace_id=${workspaceId}`}>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Create Your First Ad
                            </Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {campaigns.map(campaign => (
                        <CampaignCard
                            key={campaign.id}
                            campaign={campaign}
                            onDelete={() => handleDelete(campaign.id, campaign.name)}
                            deleting={deleting === campaign.id}
                            workspaceId={workspaceId}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function StatsCard({
    title,
    value,
    icon,
}: {
    title: string;
    value: number;
    icon: React.ReactNode;
}) {
    return (
        <Card>
            <CardContent className="flex items-center justify-between p-4">
                <div>
                    <p className="text-sm text-muted-foreground">{title}</p>
                    <p className="text-2xl font-bold">{value}</p>
                </div>
                {icon}
            </CardContent>
        </Card>
    );
}

function CampaignCard({
    campaign,
    onDelete,
    deleting,
    workspaceId,
}: {
    campaign: CTWACampaign;
    onDelete: () => void;
    deleting: boolean;
    workspaceId: string;
}) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return 'bg-green-500/10 text-green-600 border-green-500/20';
            case 'PAUSED':
                return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
            case 'DRAFT':
                return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
            default:
                return 'bg-gray-500/10 text-gray-600';
        }
    };

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">{campaign.name}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                            Created {new Date(campaign.created_at).toLocaleDateString()}
                        </p>
                    </div>
                    <Badge className={getStatusColor(campaign.status)}>
                        {campaign.status}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Budget</span>
                        <span className="font-medium">
                            {campaign.budget_currency} {campaign.daily_budget?.toLocaleString() || '—'}/day
                        </span>
                    </div>

                    {campaign.meta_campaign_id && (
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Meta ID</span>
                            <span className="font-mono text-xs">{campaign.meta_campaign_id}</span>
                        </div>
                    )}

                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Sync</span>
                        <Badge variant={campaign.sync_status === 'synced' ? 'default' : 'secondary'}>
                            {campaign.sync_status}
                        </Badge>
                    </div>

                    <div className="flex gap-2 pt-3 border-t">
                        <Link
                            to={`/ctwa/campaigns?workspace_id=${workspaceId}`}
                            className="flex-1"
                        >
                            <Button variant="outline" size="sm" className="w-full">
                                <BarChart3 className="w-4 h-4 mr-1" />
                                Insights
                            </Button>
                        </Link>

                        {campaign.meta_campaign_id && (
                            <a
                                href={`https://business.facebook.com/adsmanager/manage/campaigns?act=${campaign.ad_account_id.replace('act_', '')}&selected_campaign_ids=${campaign.meta_campaign_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <Button variant="outline" size="sm">
                                    <ExternalLink className="w-4 h-4" />
                                </Button>
                            </a>
                        )}

                        {!campaign.meta_campaign_id && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onDelete}
                                disabled={deleting}
                                className="text-destructive hover:text-destructive"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default CampaignsListPage;
