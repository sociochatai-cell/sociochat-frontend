import { useEffect, useState } from "react";
import { Eye, Users, Clock, RefreshCw, Loader2, BarChart3, TrendingUp, Globe, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import apiClient from "@/lib/apiClient";

function fmtSeconds(s: number): string {
    if (!s) return "—";
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm ? `${h}h ${rm}m` : `${h}h`;
}
function fmtHours(t: number): string {
    if (!t) return "0h";
    const h = t / 3600;
    return h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(t / 60)}m`;
}

type Tab = "in-app" | "landing";
type Props = { scope?: "admin" | "tenant-admin" };

export default function AdminPageActivity({ scope = "admin" }: Props) {
    const [tab, setTab] = useState<Tab>("in-app");
    const [days, setDays] = useState("7");
    const [paLoading, setPaLoading] = useState(true);
    const [laLoading, setLaLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [paData, setPaData] = useState<any>(null);
    const [laData, setLaData] = useState<any>(null);

    const base = scope === "tenant-admin" ? "/tenant-admin" : "/admin";

    const loadPa = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setPaLoading(true);
        try {
            const r = await apiClient.get(`${base}/page-activity?days=${days}`);
            if (r.ok) setPaData(r.data);
        } finally {
            setPaLoading(false); setRefreshing(false);
        }
    };
    const loadLa = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true); else setLaLoading(true);
        try {
            const r = await apiClient.get(`${base}/landing-analytics?days=${days}`);
            if (r.ok) setLaData(r.data);
        } finally {
            setLaLoading(false); setRefreshing(false);
        }
    };

    useEffect(() => {
        if (tab === "in-app") loadPa();
        else loadLa();
    }, [days, tab]);

    const isLoading = tab === "in-app" ? paLoading : laLoading;

    return (
        <div className="space-y-6 pb-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">Page Activity</h1>
                    <p className="text-slate-500 mt-1">
                        {scope === "tenant-admin"
                            ? "How users in your tenant navigate the app and how visitors interact with your landing pages."
                            : "How users navigate the app and how visitors interact with landing pages, across all tenants."}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={days} onValueChange={setDays}>
                        <SelectTrigger className="w-[130px] bg-white border-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7">Last 7 days</SelectItem>
                            <SelectItem value="30">Last 30 days</SelectItem>
                            <SelectItem value="90">Last 90 days</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button
                        variant="outline"
                        onClick={() => (tab === "in-app" ? loadPa(true) : loadLa(true))}
                        disabled={refreshing}
                        className="gap-2 bg-white border-slate-200 shadow-sm"
                    >
                        {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Tab toggle */}
            <div className="flex bg-slate-100 rounded-xl p-1 w-fit">
                <button
                    onClick={() => setTab("in-app")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                        tab === "in-app" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <MousePointerClick className="h-4 w-4" /> In-App Pages
                </button>
                <button
                    onClick={() => setTab("landing")}
                    className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                        tab === "landing" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                >
                    <Globe className="h-4 w-4" /> Landing Pages
                </button>
            </div>

            {isLoading ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-100 rounded-2xl animate-pulse" />)}
                    </div>
                    <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
                </div>
            ) : tab === "in-app" ? (
                <InAppTab data={paData} />
            ) : (
                <LandingTab data={laData} />
            )}
        </div>
    );
}

function InAppTab({ data }: { data: any }) {
    const s = data?.summary || {};
    const pages = data?.pages || [];
    const daily = data?.daily_trend || [];
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KpiCard label="Total Page Views" value={(s.total_page_views || 0).toLocaleString()} icon={Eye} accent="blue" />
                <KpiCard label="Unique Users" value={(s.unique_users || 0).toLocaleString()} icon={Users} accent="emerald" />
                <KpiCard label="Avg Time on Page" value={fmtSeconds(s.avg_duration_seconds)} icon={Clock} accent="violet" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-800">Page Rankings</h3>
                    <span className="text-[11px] text-slate-400 ml-1">{pages.length} pages tracked</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-left">
                                <Th>Page</Th><Th right>Views</Th><Th right>Users</Th><Th right>Avg Time</Th><Th right>Total Time</Th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {pages.length === 0 ? (
                                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">No page activity data yet. Data will appear as users browse the app.</td></tr>
                            ) : pages.map((p: any) => (
                                <tr key={p.page_path} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="font-semibold text-slate-800">{p.page_label || p.page_path}</div>
                                        {p.page_label && <div className="text-[11px] text-slate-400 font-mono">{p.page_path}</div>}
                                    </td>
                                    <td className="px-5 py-3 text-right font-bold tabular-nums">{(p.views || 0).toLocaleString()}</td>
                                    <td className="px-5 py-3 text-right tabular-nums">{(p.unique_users || 0).toLocaleString()}</td>
                                    <td className="px-5 py-3 text-right tabular-nums">{fmtSeconds(p.avg_duration_seconds)}</td>
                                    <td className="px-5 py-3 text-right tabular-nums">{fmtHours(p.total_duration_seconds)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {daily.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className="h-4 w-4 text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-800">Daily Trend</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                        {daily.slice(-14).map((d: any) => (
                            <div key={d.date} className="text-center rounded-xl bg-slate-50 border border-slate-100 p-2">
                                <div className="text-[10px] text-slate-400 font-medium">{new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                                <div className="text-sm font-bold text-slate-800 tabular-nums">{d.views}</div>
                                <div className="text-[10px] text-slate-400">{d.unique_users} users</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function LandingTab({ data }: { data: any }) {
    const s = data?.summary || {};
    const pages = data?.pages || [];
    const clicks = data?.click_breakdown || [];
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <KpiCard label="Total Visits" value={(s.total_visits || 0).toLocaleString()} icon={Globe} accent="emerald" />
                <KpiCard label="Total Clicks" value={(s.total_clicks || 0).toLocaleString()} icon={MousePointerClick} accent="amber" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                    <h3 className="text-sm font-bold text-slate-800">Page Visits</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-slate-50 text-left"><Th>Page</Th><Th right>Visits</Th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {pages.length === 0 ? (
                                <tr><td colSpan={2} className="px-5 py-12 text-center text-slate-400">No landing page data yet.</td></tr>
                            ) : pages.map((p: any) => (
                                <tr key={p.page_path} className="hover:bg-slate-50">
                                    <td className="px-5 py-3 font-semibold text-slate-800">{p.page_path}</td>
                                    <td className="px-5 py-3 text-right font-bold tabular-nums">{(p.visits || 0).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {clicks.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100">
                        <h3 className="text-sm font-bold text-slate-800">Click Breakdown</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">Which elements visitors click on most</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 text-left"><Th>Element</Th><Th>Page</Th><Th right>Clicks</Th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {clicks.map((c: any, i: number) => (
                                    <tr key={i} className="hover:bg-slate-50">
                                        <td className="px-5 py-3 font-semibold text-slate-800">{c.element_id || c.element_label || "unknown"}</td>
                                        <td className="px-5 py-3 text-slate-500">{c.page_path}</td>
                                        <td className="px-5 py-3 text-right font-bold tabular-nums">{(c.clicks || 0).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
    return <th className={cn("px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500", right && "text-right")}>{children}</th>;
}

function KpiCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent: "blue" | "emerald" | "violet" | "amber" }) {
    const map = {
        blue: "border-t-blue-500 bg-blue-100 text-blue-600",
        emerald: "border-t-emerald-500 bg-emerald-100 text-emerald-600",
        violet: "border-t-violet-500 bg-violet-100 text-violet-600",
        amber: "border-t-amber-500 bg-amber-100 text-amber-600",
    }[accent];
    const [borderCls, ...iconCls] = map.split(" ");
    return (
        <div className={cn("bg-white rounded-2xl border border-slate-200 border-t-4 shadow-sm p-5", borderCls)}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                    <p className="mt-2 text-3xl font-black text-slate-900 tabular-nums">{value}</p>
                </div>
                <div className={cn("p-2.5 rounded-xl", iconCls.join(" "))}><Icon className="h-5 w-5" /></div>
            </div>
        </div>
    );
}
