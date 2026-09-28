// JOM — schedule a one-off follow-up for a lead. Agent (or owner) picks a future
// date + time (IST), an approved template, and fills the variables (name auto-filled
// from the chat). Shows existing schedules with a Cancel action. The backend fires it
// via the existing scheduler tick; a reply afterwards returns the lead to the same agent.
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, X, Clock, CalendarClock, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { jomApi, JomSchedule } from "./jomApi";

// Build an ISO-8601 UTC string from an IST (India, +05:30) date + time the agent picks,
// independent of the viewer's own timezone.
function istToUtcIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}:00+05:30`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function fmtIST(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) + " IST";
  } catch { return iso; }
}

const STATUS_ICON: Record<string, JSX.Element> = {
  sent: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
  failed: <XCircle className="w-3.5 h-3.5 text-red-600" />,
  cancelled: <XCircle className="w-3.5 h-3.5 text-slate-400" />,
  pending: <Clock className="w-3.5 h-3.5 text-amber-600" />,
};

export default function ScheduleFollowupModal({
  workspaceId, customerPhone, customerName, onClose,
}: {
  workspaceId: string;
  customerPhone: string;
  customerName?: string | null;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<string[]>([]);
  const [schedules, setSchedules] = useState<JomSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [template, setTemplate] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [v1, setV1] = useState(customerName || "");
  const [v2, setV2] = useState("");
  const [v3, setV3] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sett, sch] = await Promise.all([
        jomApi.getSettings(workspaceId),
        jomApi.listSchedules(workspaceId, customerPhone),
      ]);
      if (sett.ok && sett.data?.success) {
        const appr = sett.data.approved_templates || [];
        setTemplates(appr);
        if (appr.length && !template) setTemplate(appr[0]);
      }
      if (sch.ok && sch.data?.success) setSchedules(sch.data.schedules || []);
    } catch { setError("Failed to load."); }
    finally { setLoading(false); }
  }, [workspaceId, customerPhone, template]);

  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setError(null); setNote(null);
    const iso = istToUtcIso(date, time);
    if (!template) { setError("Pick a template."); return; }
    if (!iso) { setError("Pick a valid date and time."); return; }
    if (new Date(iso).getTime() <= Date.now()) { setError("Pick a future date/time."); return; }
    const variables: Record<string, string> = {};
    if (v1.trim()) variables["1"] = v1.trim();
    if (v2.trim()) variables["2"] = v2.trim();
    if (v3.trim()) variables["3"] = v3.trim();
    setSaving(true);
    try {
      const res = await jomApi.createSchedule(workspaceId, customerPhone, {
        template_name: template, scheduled_at: iso, variables,
        note: reason.trim() || undefined,
      });
      if (res.ok && res.data?.success) {
        setNote("Scheduled.");
        setDate(""); setReason("");
        await load();
      } else {
        setError(res.data?.error || "Could not schedule.");
      }
    } catch { setError("Could not schedule."); }
    finally { setSaving(false); }
  };

  const cancel = async (id: number) => {
    const res = await jomApi.cancelSchedule(workspaceId, id);
    if (res.ok && res.data?.success) await load();
    else setError(res.data?.error || "Could not cancel.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-white">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" /> Schedule a follow-up
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-gray-900"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div className="text-sm text-muted-foreground">
            To <span className="font-medium text-gray-800">{customerName || `+${customerPhone}`}</span>
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
          {note && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{note}</div>}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : (
            <>
              <div>
                <label className="text-sm font-medium text-gray-800">Template</label>
                {templates.length ? (
                  <select className="mt-1 w-full text-sm border rounded-md px-2 py-2 bg-white" value={template} onChange={(e) => setTemplate(e.target.value)}>
                    {templates.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (
                  <Input value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="template name" className="mt-1" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-800">Date (IST)</label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-800">Time (IST)</label>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-800">Message variables</label>
                <Input value={v1} onChange={(e) => setV1(e.target.value)} placeholder="{{1}} — name (auto-filled)" className="text-sm" />
                <Input value={v2} onChange={(e) => setV2(e.target.value)} placeholder="{{2}} — e.g. destination" className="text-sm" />
                <Input value={v3} onChange={(e) => setV3(e.target.value)} placeholder="{{3}} — optional" className="text-sm" />
                <p className="text-xs text-muted-foreground">Fill only the variables your chosen template uses. Name is pre-filled from the chat.</p>
              </div>

              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Note (optional, for your team)" className="text-sm" />

              <Button onClick={create} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Clock className="w-4 h-4 mr-1" />}
                Schedule
              </Button>

              {/* Existing schedules */}
              <div className="pt-2 border-t">
                <div className="text-sm font-medium text-gray-800 mb-2">Scheduled ({schedules.length})</div>
                {schedules.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nothing scheduled yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {schedules.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-sm border rounded-md px-2.5 py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {STATUS_ICON[s.status]}
                          <div className="min-w-0">
                            <div className="truncate font-medium text-gray-800">{s.template_name}</div>
                            <div className="text-xs text-muted-foreground">{fmtIST(s.scheduled_at)} · {s.status}</div>
                          </div>
                        </div>
                        {s.status === "pending" && (
                          <button onClick={() => cancel(s.id)} className="text-red-500 hover:text-red-600 shrink-0" title="Cancel">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
