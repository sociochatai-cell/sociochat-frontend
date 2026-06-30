import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
    ResponsiveContainer, BarChart, Bar, AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Cell,
} from 'recharts';
import { Card } from '@/components/ui/card';
import {
    Users, UserPlus, Activity as ActivityIcon, Target, Loader2,
    TrendingUp, BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import crmApi from '../api';
import type { DashboardStats, ChartPoint } from '../types';

// Defensive accessor — the DashboardStats shape isn't fully specified in the
// contract, so read a few likely field names and fall back to 0.
function pick(obj: any, keys: string[]): number {
    if (!obj) return 0;
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === 'number' && !isNaN(v)) return v;
    }
    return 0;
}

const BAR_COLORS = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#f43f5e', '#14b8a6'];

export default function CRMDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [sources, setSources] = useState<ChartPoint[]>([]);
    const [revenue, setRevenue] = useState<ChartPoint[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            const [s, src, rev] = await Promise.allSettled([
                crmApi.getDashboardStats(),
                crmApi.getSourceChart(),
                crmApi.getRevenueChart(),
            ]);
            if (cancelled) return;
            if (s.status === 'fulfilled') setStats(s.value as DashboardStats);
            else toast.error('Failed to load dashboard stats');
            if (src.status === 'fulfilled') setSources(Array.isArray(src.value) ? src.value : []);
            if (rev.status === 'fulfilled') setRevenue(Array.isArray(rev.value) ? rev.value : []);
            setLoading(false);
        })();
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return (
            <div className="w-full min-h-[calc(100vh-8rem)] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    const totalLeads = pick(stats, ['total_leads', 'totalLeads', 'total']);
    const newLeads = pick(stats, ['new_leads', 'newLeads', 'new']);
    const activeLeads = pick(stats, ['active_leads', 'activeLeads', 'active']);
    const conversion = pick(stats, ['conversion_rate', 'conversionRate', 'conversion']);

    const kpis = [
        { label: 'Total Leads', value: totalLeads.toLocaleString(), icon: Users, from: 'from-emerald-500', to: 'to-teal-600', tint: 'bg-emerald-50 text-emerald-600' },
        { label: 'New Leads', value: newLeads.toLocaleString(), icon: UserPlus, from: 'from-sky-500', to: 'to-blue-600', tint: 'bg-sky-50 text-sky-600' },
        { label: 'Active Leads', value: activeLeads.toLocaleString(), icon: ActivityIcon, from: 'from-violet-500', to: 'to-purple-600', tint: 'bg-violet-50 text-violet-600' },
        { label: 'Conversion Rate', value: `${(conversion <= 1 ? conversion * 100 : conversion).toFixed(1)}%`, icon: Target, from: 'from-amber-500', to: 'to-orange-600', tint: 'bg-amber-50 text-amber-600' },
    ];

    return (
        <div className="p-4 sm:p-6 space-y-6 min-w-0">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <BarChart3 className="h-6 w-6 text-emerald-600 shrink-0" /> CRM Overview
                </h1>
                <p className="text-slate-500 text-sm">Your lead pipeline at a glance.</p>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {kpis.map((k, i) => (
                    <motion.div
                        key={k.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: i * 0.05 }}
                    >
                        <Card className="relative overflow-hidden border-border bg-white/80 backdrop-blur-sm p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className={cn('absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-10', k.from, k.to)} />
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">{k.label}</p>
                                    <p className="text-2xl font-bold text-slate-800 mt-1">{k.value}</p>
                                </div>
                                <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center', k.tint)}>
                                    <k.icon className="h-5 w-5" />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Lead sources */}
                <Card className="border-border bg-white/80 backdrop-blur-sm p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-emerald-600" /> Lead Sources
                        </h3>
                    </div>
                    {sources.length === 0 ? (
                        <ChartEmpty />
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={sources} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} />
                                <RTooltip
                                    cursor={{ fill: 'rgba(16,185,129,0.06)' }}
                                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                                />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={48}>
                                    {sources.map((_, i) => (
                                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>

                {/* Revenue / trend */}
                <Card className="border-border bg-white/80 backdrop-blur-sm p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-600" /> New Leads Trend
                        </h3>
                    </div>
                    {revenue.length === 0 ? (
                        <ChartEmpty />
                    ) : (
                        <ResponsiveContainer width="100%" height={280}>
                            <AreaChart data={revenue} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                                <RTooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                                <Area type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2.5} fill="url(#revFill)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </Card>
            </div>
        </div>
    );
}

function ChartEmpty() {
    return (
        <div className="h-[280px] flex flex-col items-center justify-center text-slate-300">
            <BarChart3 className="h-10 w-10 mb-2" />
            <p className="text-sm">No data to display yet</p>
        </div>
    );
}
