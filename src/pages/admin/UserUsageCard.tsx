import { useEffect, useState } from "react";
import { Loader2, Send, MessageSquare, Zap, Boxes, Users as UsersIcon, GitBranch } from "lucide-react";
import apiClient from "@/lib/apiClient";

interface UsageCounts {
    whatsapp_templates: number;
    whatsapp_messages_sent: number;
    drip_campaigns: number;
    automation_rules: number;
    flows: number;
    crm_leads: number;
}

/** Feature-usage counts for one user. Scope 'admin' hits super-admin; 'tenant-admin' hits scoped endpoint. */
export default function UserUsageCard({ userId, scope = "admin" }: { userId: number; scope?: "admin" | "tenant-admin" }) {
    const [loading, setLoading] = useState(true);
    const [counts, setCounts] = useState<UsageCounts | null>(null);

    useEffect(() => {
        let cancelled = false;
        const base = scope === "tenant-admin" ? "/tenant-admin" : "/admin";
        apiClient.get<{ counts: UsageCounts }>(`${base}/user-usage/${userId}`)
            .then(r => { if (!cancelled && r.ok && r.data?.counts) setCounts(r.data.counts); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [userId, scope]);

    if (loading) return <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>;
    if (!counts) return null;

    const items = [
        { label: "Templates", value: counts.whatsapp_templates, icon: MessageSquare, color: "text-emerald-600 bg-emerald-100" },
        { label: "Messages Sent", value: counts.whatsapp_messages_sent, icon: Send, color: "text-blue-600 bg-blue-100" },
        { label: "Drip Campaigns", value: counts.drip_campaigns, icon: Boxes, color: "text-violet-600 bg-violet-100" },
        { label: "Automation Rules", value: counts.automation_rules, icon: Zap, color: "text-amber-600 bg-amber-100" },
        { label: "Flows", value: counts.flows, icon: GitBranch, color: "text-rose-600 bg-rose-100" },
        { label: "CRM Leads", value: counts.crm_leads, icon: UsersIcon, color: "text-slate-700 bg-slate-100" },
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-4">Feature Usage</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items.map(it => (
                    <div key={it.label} className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-100 p-3">
                        <div className={`p-2 rounded-lg ${it.color}`}><it.icon className="h-4 w-4" /></div>
                        <div>
                            <div className="text-lg font-bold text-slate-900 tabular-nums">{it.value.toLocaleString()}</div>
                            <div className="text-[11px] text-slate-500 font-medium">{it.label}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
