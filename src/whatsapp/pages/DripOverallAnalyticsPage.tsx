
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, Send, Eye, CheckCircle, BarChart as BarChartIcon, MessageCircle, TrendingUp, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINT } from '@/config';
import { getWorkspaceId } from '@/whatsapp/utils/workspaceContext';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const API_BASE = API_ENDPOINT;

interface SummaryStats {
    total_campaigns: number;
    active_campaigns: number;
    total_enrollments: number;
    total_sent: number;
    total_delivered: number;
    total_read: number;
    total_replied: number;
}

interface CampaignPerformance {
    id: number;
    name: string;
    status: string;
    enrolled_count: number;
    sent_count: number;
    delivered_count: number;
    read_count: number;
    replied_count: number;
}

interface DailyTrend {
    date: string;
    sent: number;
    delivered: number;
    read: number;
}

const DripOverallAnalyticsPage = () => {
    const navigate = useNavigate();

    // Use workspace ID from localStorage
    const [workspaceId, setWorkspaceId] = useState<string | null>(getWorkspaceId());

    useEffect(() => {
        const id = getWorkspaceId();
        if (id) setWorkspaceId(id);
    }, []);

    const [stats, setStats] = useState<SummaryStats | null>(null);
    const [campaigns, setCampaigns] = useState<CampaignPerformance[]>([]);
    const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchOverview = async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const res = await fetch(
                `${API_BASE}/whatsapp/drip-campaigns/analytics/overview?workspace_id=${workspaceId}`,
                { credentials: 'include' }
            );
            if (!res.ok) throw new Error('Failed to fetch analytics');
            const data = await res.json();
            setStats(data.summary);
            setCampaigns(data.campaigns);
            setDailyTrends(data.daily_trends || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load overall analytics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOverview();
    }, [workspaceId]);

    if (!workspaceId) return <div className="p-8">Please select a workspace.</div>;

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-emerald-600" />
                        Global Drip Analytics
                    </h1>
                    <p className="text-muted-foreground">Comprehensive performance overview across all drip campaigns</p>
                </div>
                <Button variant="outline" onClick={() => navigate('/dashboard/drip')}>
                    Back to Drip Campaigns
                </Button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <KPICard
                    title="Total Campaigns"
                    value={stats?.total_campaigns || 0}
                    subtext={`${stats?.active_campaigns || 0} Active`}
                    icon={<BarChartIcon className="w-4 h-4 text-gray-500" />}
                />
                <KPICard
                    title="Total Enrollments"
                    value={stats?.total_enrollments || 0}
                    subtext="All Time"
                    icon={<Users className="w-4 h-4 text-blue-500" />}
                />
                <KPICard
                    title="Messages Sent"
                    value={stats?.total_sent || 0}
                    subtext={`${stats?.total_delivered || 0} Delivered`}
                    icon={<Send className="w-4 h-4 text-indigo-500" />}
                />
                <KPICard
                    title="Read Rate"
                    value={stats?.total_delivered ? `${Math.round((stats.total_read / stats.total_delivered) * 100)}%` : '0%'}
                    subtext={`${stats?.total_read || 0} Read`}
                    icon={<Eye className="w-4 h-4 text-emerald-500" />}
                />
                <KPICard
                    title="Replied"
                    value={stats?.total_replied || 0}
                    subtext="Inbound Replies"
                    icon={<MessageCircle className="w-4 h-4 text-purple-500" />}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Daily Activity Chart */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Daily Message Activity (Last 30 Days)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={dailyTrends}>
                                <defs>
                                    <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorDelivered" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorRead" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Area type="monotone" dataKey="sent" stroke="#6366f1" fillOpacity={1} fill="url(#colorSent)" name="Sent" />
                                <Area type="monotone" dataKey="delivered" stroke="#3b82f6" fillOpacity={1} fill="url(#colorDelivered)" name="Delivered" />
                                <Area type="monotone" dataKey="read" stroke="#10b981" fillOpacity={1} fill="url(#colorRead)" name="Read" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Delivery Mix Chart */}
                <Card>
                    <CardHeader>
                        <CardTitle>Delivery Status Mix</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[{
                                name: 'Total',
                                Sent: stats?.total_sent || 0,
                                Delivered: stats?.total_delivered || 0,
                                Read: stats?.total_read || 0
                            }]}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="Sent" fill="#6366f1" />
                                <Bar dataKey="Delivered" fill="#3b82f6" />
                                <Bar dataKey="Read" fill="#10b981" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Campaign Performance Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Campaign Performance Details</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Campaign Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Enrolled</TableHead>
                                <TableHead className="text-right">Sent</TableHead>
                                <TableHead className="text-right">Delivered</TableHead>
                                <TableHead className="text-right">Read</TableHead>
                                <TableHead className="text-right">Replied</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {campaigns.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                        No campaigns found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                campaigns.map((c) => (
                                    <TableRow key={c.id}>
                                        <TableCell className="font-medium">{c.name}</TableCell>
                                        <TableCell>
                                            <Badge variant={c.status === 'active' ? 'default' : 'secondary'} className={c.status === 'active' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : ''}>
                                                {c.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">{(c.enrolled_count || 0).toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{(c.sent_count || 0).toLocaleString()}</TableCell>
                                        <TableCell className="text-right">{(c.delivered_count || 0).toLocaleString()}</TableCell>
                                        <TableCell className="text-right">
                                            <span className="text-emerald-600 font-medium">
                                                {(c.read_count || 0).toLocaleString()}
                                            </span>
                                            <span className="text-xs text-muted-foreground ml-1">
                                                ({c.delivered_count ? Math.round(((c.read_count || 0) / c.delivered_count) * 100) : 0}%)
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">{(c.replied_count || 0).toLocaleString()}</TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => navigate(`/dashboard/campaigns/${c.id}/analytics`)}
                                            >
                                                Details <ArrowRight className="w-4 h-4 ml-1" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

const KPICard = ({ title, value, subtext, icon }: { title: string, value: string | number, subtext: string, icon: React.ReactNode }) => (
    <Card>
        <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
                <span className="text-sm font-medium text-muted-foreground">{title}</span>
                {icon}
            </div>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
        </CardContent>
    </Card>
);

export default DripOverallAnalyticsPage;
