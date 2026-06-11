import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, RefreshCw, Send, CheckCheck, Eye, MessageSquare, StopCircle, Users, BarChart } from 'lucide-react';
import { toast } from 'sonner';
import { API_ENDPOINT } from '@/config';
import { ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';

const API_BASE = API_ENDPOINT;

interface SummaryStats {
    enrollment: {
        total: number;
        active: number;
        completed: number;
        paused: number;
        failed: number;
    };
    messages: {
        sent: number;
        delivered: number;
        read: number;
        replied: number;
        failed: number;
    };
}

interface FunnelStep {
    step_order: number;
    step_name: string;
    template_name: string;
    sent: number;
    read: number;
}

interface Enrollment {
    id: number;
    contact_name: string;
    phone_number: string;
    status: string;
    current_step: number;
    joined_at: string;
    next_run_at: string | null;
}

export default function DripAnalyticsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState<SummaryStats | null>(null);
    const [funnel, setFunnel] = useState<FunnelStep[]>([]);
    const [dailyStats, setDailyStats] = useState<any[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [campaignName, setCampaignName] = useState('Campaign');

    useEffect(() => {
        if (id) {
            fetchAnalytics();
        }
    }, [id]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            // Fetch Campaign Details
            // (Assuming existing endpoint or using simplified check. For now just fetching analytics)

            // 1. Summary
            const resSummary = await fetch(`${API_BASE}/whatsapp/drip-campaigns/${id}/analytics/summary`, { credentials: 'include' });
            if (resSummary.ok) {
                setSummary(await resSummary.json());
            }

            // 2. Daily
            const resDaily = await fetch(`${API_BASE}/whatsapp/drip-campaigns/${id}/analytics/daily`, { credentials: 'include' });
            if (resDaily.ok) {
                setDailyStats(await resDaily.json());
            }

            // 3. Funnel
            const resFunnel = await fetch(`${API_BASE}/whatsapp/drip-campaigns/${id}/analytics/funnel`, { credentials: 'include' });
            if (resFunnel.ok) {
                setFunnel(await resFunnel.json());
            }

            // 4. Enrollments (first page)
            const resEnrollments = await fetch(`${API_BASE}/whatsapp/drip-campaigns/${id}/analytics/enrollments?per_page=10`, { credentials: 'include' });
            if (resEnrollments.ok) {
                const data = await resEnrollments.json();
                setEnrollments(data.enrollments);
            }

        } catch (error) {
            console.error("Error fetching analytics:", error);
            toast.error("Failed to load analytics data");
        } finally {
            setLoading(false);
        }
    };

    if (!id) return <div>Invalid Campaign ID</div>;

    return (
        <div className="p-8 space-y-8 bg-gray-50/50 min-h-screen">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/drip-analytics')}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Campaign Analytics</h1>
                        <p className="text-gray-500">Performance insights and delivery reports</p>
                    </div>
                </div>
                <Button variant="outline" onClick={fetchAnalytics} disabled={loading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh Data
                </Button>
            </div>

            {/* KPI Cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-l-4 border-l-blue-500">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between space-y-0 pb-2">
                                <p className="text-sm font-medium text-gray-500">Total Enrolled</p>
                                <Users className="h-4 w-4 text-gray-400" />
                            </div>
                            <div className="text-2xl font-bold">{summary.enrollment.total}</div>
                            <p className="text-xs text-gray-500 mt-1">
                                {summary.enrollment.active} Active, {summary.enrollment.completed} Completed
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-green-500">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between space-y-0 pb-2">
                                <p className="text-sm font-medium text-gray-500">Delivered</p>
                                <CheckCheck className="h-4 w-4 text-green-500" />
                            </div>
                            <div className="text-2xl font-bold">{summary.messages.delivered}</div>
                            <p className="text-xs text-gray-500 mt-1">
                                {(summary.messages.sent > 0 ? (summary.messages.delivered / summary.messages.sent * 100).toFixed(1) : 0)}% Delivery Rate
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-indigo-500">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between space-y-0 pb-2">
                                <p className="text-sm font-medium text-gray-500">Read</p>
                                <Eye className="h-4 w-4 text-indigo-500" />
                            </div>
                            <div className="text-2xl font-bold">{summary.messages.read}</div>
                            <p className="text-xs text-gray-500 mt-1">
                                {(summary.messages.delivered > 0 ? (summary.messages.read / summary.messages.delivered * 100).toFixed(1) : 0)}% Read Rate
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-purple-500 hidden">
                        {/* Hidden until reply logic is fully implemented */}
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between space-y-0 pb-2">
                                <p className="text-sm font-medium text-gray-500">Replied</p>
                                <MessageSquare className="h-4 w-4 text-purple-500" />
                            </div>
                            <div className="text-2xl font-bold">{summary.messages.replied}</div>
                        </CardContent>
                    </Card>

                    <Card className="border-l-4 border-l-red-500">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between space-y-0 pb-2">
                                <p className="text-sm font-medium text-gray-500">Stopped</p>
                                <StopCircle className="h-4 w-4 text-red-500" />
                            </div>
                            <div className="text-2xl font-bold">{summary.enrollment.paused + summary.enrollment.failed}</div>
                            <p className="text-xs text-gray-500 mt-1">
                                {summary.enrollment.paused} Paused, {summary.enrollment.failed} Failed
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Daily Trends Chart */}
                <Card className="col-span-1 lg:col-span-2 shadow-sm">
                    <CardHeader>
                        <CardTitle>Message Activity</CardTitle>
                        <CardDescription>Daily sent and read volume (Last 30 days)</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyStats}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="sent" name="Sent" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="read" name="Read" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Step Funnel */}
                <Card className="col-span-1 shadow-sm">
                    <CardHeader>
                        <CardTitle>Funnel Analysis</CardTitle>
                        <CardDescription>Drop-off between steps</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart layout="vertical" data={funnel} margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="step_name" type="category" width={60} tick={{ fontSize: 12 }} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="sent" name="Sent" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                                <Bar dataKey="read" name="Read" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Enrollments Table */}
            <Card className="shadow-sm">
                <CardHeader>
                    <CardTitle>Recent Enrollments</CardTitle>
                    <CardDescription>Live status of enrolled contacts</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Contact</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Current Step</TableHead>
                                <TableHead>Last Activity</TableHead>
                                <TableHead>Next Run</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {enrollments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                        No enrollments found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                enrollments.map((enr) => (
                                    <TableRow key={enr.id}>
                                        <TableCell className="font-medium">{enr.contact_name}</TableCell>
                                        <TableCell>{enr.phone_number}</TableCell>
                                        <TableCell>
                                            <StatusBadge status={enr.status} />
                                        </TableCell>
                                        <TableCell>Step {enr.current_step}</TableCell>
                                        <TableCell className="text-gray-500">
                                            {enr.joined_at ? new Date(enr.joined_at).toLocaleDateString() : '-'}
                                        </TableCell>
                                        <TableCell className="text-gray-500">
                                            {enr.next_run_at ? new Date(enr.next_run_at).toLocaleString() : '-'}
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
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        active: "bg-green-100 text-green-700 hover:bg-green-100",
        completed: "bg-blue-100 text-blue-700 hover:bg-blue-100",
        paused: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100",
        failed: "bg-red-100 text-red-700 hover:bg-red-100",
    } as const;

    return (
        <Badge variant="secondary" className={styles[status as keyof typeof styles] || ""}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
    );
}
