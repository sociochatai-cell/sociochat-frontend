// JOM Journey Pipeline — lead lifecycle visibility board (read-only).
// Shows every lead's status (New / Qualified / Assigned / Ghosted / Dormant /
// Closed), destination department, assigned agent and next follow-up date.
// Gated: only rendered for the JOM workspace; redirects others away.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Compass, CalendarDays, Sliders, CalendarClock } from "lucide-react";
import { jomApi, JomLead, JomSummary, isJomWorkspace } from "./jomApi";
import { getWorkspaceId } from "@/whatsapp/utils/workspaceContext";
import JomSettingsManager from "./JomSettingsManager";
import JomSheetIntake from "./JomSheetIntake";
import ScheduleFollowupModal from "./ScheduleFollowupModal";

const STATUS_STYLES: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  qualified: "bg-blue-100 text-blue-700",
  assigned: "bg-emerald-100 text-emerald-700",
  active: "bg-emerald-100 text-emerald-700",
  ghosted: "bg-amber-100 text-amber-700",
  dormant: "bg-orange-100 text-orange-700",
  closed: "bg-gray-200 text-gray-600",
};

const ORDER = ["new", "qualified", "assigned", "active", "ghosted", "dormant", "closed"];

function fmt(dt: string | null): string {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" }) + " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch { return dt; }
}

export default function JourneyPipeline() {
  const workspaceId = getWorkspaceId() || "";
  const enabled = isJomWorkspace(workspaceId);

  const [leads, setLeads] = useState<JomLead[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [summary, setSummary] = useState<JomSummary | null>(null);
  const [days, setDays] = useState(30);
  const [showSettings, setShowSettings] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<JomLead | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const [res, sum] = await Promise.all([
        jomApi.listLeads(workspaceId, filter || undefined),
        jomApi.getSummary(workspaceId, days),
      ]);
      if (res.ok && res.data?.success) {
        setLeads(res.data.leads || []);
        setCounts(res.data.counts || {});
      } else {
        setError("Failed to load leads.");
      }
      if (sum.ok && sum.data?.success) setSummary(sum.data);
    } catch {
      setError("Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }, [enabled, workspaceId, filter, days]);

  useEffect(() => { void load(); }, [load]);

  const changeStatus = useCallback(async (phone: string, status: string) => {
    const res = await jomApi.setLeadStatus(workspaceId, phone, status);
    if (res.ok && res.data?.success) void load();
  }, [workspaceId, load]);

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);

  if (!enabled) {
    return <div className="p-8 text-sm text-muted-foreground">This section isn't available for this workspace.</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Compass className="w-5 h-5 text-primary" /> Journey Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">Every lead's lifecycle stage, department, agent and next follow-up.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground"
            onClick={async () => { await jomApi.seedDemo(workspaceId); void load(); }}>
            Load demo
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground"
            onClick={async () => { await jomApi.clearDemo(workspaceId); void load(); }}>
            Clear demo
          </Button>
          <Button variant={showSettings ? "default" : "outline"} size="sm" onClick={() => setShowSettings((v) => !v)}>
            <Sliders className="w-4 h-4 mr-1" /> Settings
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {showSettings && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
          <JomSheetIntake workspaceId={workspaceId} />
          <JomSettingsManager workspaceId={workspaceId} />
        </div>
      )}

      {/* Counts strip */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter("")} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${filter === "" ? "border-primary bg-primary/5" : "border-slate-200 bg-white"}`}>
          All <span className="ml-1 text-muted-foreground">{total}</span>
        </button>
        {ORDER.filter((s) => counts[s]).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border capitalize ${filter === s ? "border-primary bg-primary/5" : "border-slate-200 bg-white"}`}>
            {s} <span className="ml-1 text-muted-foreground">{counts[s]}</span>
          </button>
        ))}
      </div>

      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      {/* Daily outcomes — how many leads landed in each stage per day, plus why they closed */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm">Daily outcomes</span>
              <span className="text-xs text-muted-foreground">what happened each day</span>
            </div>
            <div className="flex gap-1">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                    days === d ? "border-primary bg-primary/5 font-medium" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>

          {(() => {
            const byDay = summary?.by_day || {};
            const dates = Object.keys(byDay).sort().reverse();
            const cols = ORDER.filter((s) => dates.some((d) => byDay[d]?.[s]));
            if (!dates.length) {
              return <p className="text-sm text-muted-foreground py-3">No activity in the last {days} days.</p>;
            }
            return (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b">
                      <th className="px-3 py-2 font-medium">Date</th>
                      {cols.map((c) => (
                        <th key={c} className="px-3 py-2 font-medium capitalize text-center">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dates.map((d) => (
                      <tr key={d} className="border-b last:border-0 hover:bg-slate-50/50">
                        <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{d}</td>
                        {cols.map((c) => (
                          <td key={c} className="px-3 py-2 text-center">
                            {byDay[d]?.[c] ? (
                              <span className={`inline-block min-w-[1.5rem] px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[c] || "bg-slate-100 text-slate-700"}`}>
                                {byDay[d][c]}
                              </span>
                            ) : (
                              <span className="text-slate-300">–</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {summary?.totals && (
                      <tr className="bg-slate-50/70 font-semibold">
                        <td className="px-3 py-2">Total</td>
                        {cols.map((c) => (
                          <td key={c} className="px-3 py-2 text-center">{summary.totals[c] ?? 0}</td>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {summary?.close_reasons && Object.keys(summary.close_reasons).length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
              <span className="text-xs text-muted-foreground">Why leads closed:</span>
              {Object.entries(summary.close_reasons).map(([reason, count]) => (
                <Badge key={reason} variant="outline" className="text-xs">
                  {reason.replace(/_/g, " ")}: {count}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Loading leads…</div>
          ) : leads.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center p-10">No leads yet{filter ? ` in "${filter}"` : ""}. They appear here automatically as customers message in.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b bg-slate-50/60">
                    <th className="px-4 py-2.5 font-medium">Customer</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Destination</th>
                    <th className="px-4 py-2.5 font-medium">Department</th>
                    <th className="px-4 py-2.5 font-medium">Agent</th>
                    <th className="px-4 py-2.5 font-medium">Next follow-up</th>
                    <th className="px-4 py-2.5 font-medium">Last inbound</th>
                    <th className="px-4 py-2.5 font-medium">Msgs</th>
                    <th className="px-4 py-2.5 font-medium">Set status</th>
                    <th className="px-4 py-2.5 font-medium">Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.customer_phone} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">
                        <div className="flex flex-col leading-tight">
                          <span>
                            {l.customer_name || `+${l.customer_phone}`}
                            {(l.reopen_count || 0) > 0 && <span className="ml-1 text-[10px] text-orange-600">↻{l.reopen_count}</span>}
                          </span>
                          {l.customer_name && (
                            <span className="text-[11px] font-normal text-muted-foreground">+{l.customer_phone}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[l.status] || "bg-slate-100 text-slate-700"}`}>
                          {l.status}{l.drip_stage != null ? ` · d${l.drip_stage}` : ""}
                        </span>
                        {l.close_reason && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{l.close_reason.replace(/_/g, " ")}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {l.destination
                          ? <span className="text-emerald-700 font-medium">{l.destination}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5">{l.department || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-2.5">{l.agent || <span className="text-muted-foreground">unassigned</span>}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{fmt(l.next_followup_at)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{fmt(l.last_inbound_at)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        <span title="inbound / outbound">{l.total_inbound ?? 0}/{l.total_outbound ?? 0}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          className="text-xs border rounded-md px-1.5 py-1 bg-white"
                          value=""
                          onChange={(e) => { const v = e.target.value; if (v) void changeStatus(l.customer_phone, v); }}
                          title="Manually move this lead"
                        >
                          <option value="">Change…</option>
                          {ORDER.map((st) => (
                            <option key={st} value={st} disabled={st === l.status} className="capitalize">
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => setScheduleFor(l)}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          title="Schedule a follow-up"
                        >
                          <CalendarClock className="w-3.5 h-3.5" /> Schedule
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {scheduleFor && (
        <ScheduleFollowupModal
          workspaceId={workspaceId}
          customerPhone={scheduleFor.customer_phone}
          customerName={scheduleFor.customer_name}
          onClose={() => setScheduleFor(null)}
        />
      )}
    </div>
  );
}
