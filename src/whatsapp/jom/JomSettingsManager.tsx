// JOM Settings — owner-editable follow-up cadence, qualify threshold and the
// template mapping (which approved WhatsApp template each drip step sends).
// Every field falls back to the code default on the backend, so an untouched
// workspace behaves exactly as before. Gated to the JOM workspace.
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, RotateCcw, Sliders } from "lucide-react";
import { jomApi, JomSettings } from "./jomApi";

// Human labels for the stable template-step keys the backend uses.
const TEMPLATE_LABELS: Record<string, string> = {
  opening: "Opening (first message)",
  continue: "24h Continue (re-opener)",
  ghosted_checkin: "Ghosted — check-in",
  ghosted_exit: "Ghosted — final exit",
  dormant_checkin: "Dormant — check-in (with tip)",
  close: "Close (goodbye)",
};

const daysToStr = (d: number[] | undefined) => (d || []).join(", ");
const parseDays = (s: string): number[] =>
  s.split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isFinite(n) && n >= 0);

export default function JomSettingsManager({ workspaceId }: { workspaceId: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const [templateKeys, setTemplateKeys] = useState<string[]>([]);
  const [approved, setApproved] = useState<string[]>([]);

  const [ghosted, setGhosted] = useState("");
  const [dormant, setDormant] = useState("");
  const [qualifyTurns, setQualifyTurns] = useState<number>(5);
  const [templates, setTemplates] = useState<Record<string, string>>({});

  const apply = useCallback((s: JomSettings, keys: string[], approvedList: string[]) => {
    setGhosted(daysToStr(s.ghosted_days));
    setDormant(daysToStr(s.dormant_days));
    setQualifyTurns(s.qualify_max_turns);
    setTemplates(s.templates || {});
    setTemplateKeys(keys.length ? keys : Object.keys(s.templates || {}));
    setApproved(approvedList);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await jomApi.getSettings(workspaceId);
      if (res.ok && res.data?.success) {
        apply(res.data.settings, res.data.template_keys || [], res.data.approved_templates || []);
      } else {
        setError("Failed to load settings.");
      }
    } catch {
      setError("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, apply]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setOk(false);
    try {
      const gd = parseDays(ghosted);
      const dd = parseDays(dormant);
      if (!gd.length || !dd.length) {
        setError("Cadence needs at least one day offset (e.g. 7, 15).");
        setSaving(false);
        return;
      }
      const res = await jomApi.saveSettings(workspaceId, {
        ghosted_days: gd,
        dormant_days: dd,
        qualify_max_turns: qualifyTurns,
        templates,
      });
      if (res.ok && res.data?.success) {
        apply(res.data.settings, templateKeys, approved);
        setOk(true);
        setTimeout(() => setOk(false), 2500);
      } else {
        setError((res.data as { error?: string } | undefined)?.error || "Could not save settings.");
      }
    } catch {
      setError("Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
      {ok && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">Saved.</div>}

      {/* Cadence + threshold */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" /> Follow-up cadence & qualification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-800">Ghosted drip (days after go-silent)</label>
              <Input value={ghosted} onChange={(e) => setGhosted(e.target.value)} placeholder="7, 15" className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Comma-separated day offsets. Last step sends the exit message, then the lead closes.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-800">Dormant drip (days after go-silent)</label>
              <Input value={dormant} onChange={(e) => setDormant(e.target.value)} placeholder="7, 14, 24, 31, 45" className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Longer nurture with a travel tip each step. Last step closes the lead.</p>
            </div>
          </div>
          <div className="max-w-[260px]">
            <label className="text-sm font-medium text-gray-800">Qualify within (customer messages)</label>
            <Input
              type="number"
              min={1}
              max={50}
              value={qualifyTurns}
              onChange={(e) => setQualifyTurns(Math.max(1, Math.min(50, parseInt(e.target.value || "1", 10))))}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">After this many replies with no buyer signal, the lead is flagged as a soft stall (AI keeps nurturing — it is not cut off).</p>
          </div>
        </CardContent>
      </Card>

      {/* Template mapping */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Template mapping</CardTitle>
          <p className="text-xs text-muted-foreground">
            Which Meta-approved template each step sends. {approved.length === 0 && "No approved templates detected — the default names below will be used as-is."}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {templateKeys.map((key) => (
            <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-sm text-gray-800 sm:w-64 shrink-0">{TEMPLATE_LABELS[key] || key}</label>
              {approved.length > 0 ? (
                <select
                  className="text-sm border rounded-md px-2 py-1.5 bg-white flex-1"
                  value={templates[key] || ""}
                  onChange={(e) => setTemplates((prev) => ({ ...prev, [key]: e.target.value }))}
                >
                  {/* keep the current value even if it's not in the approved list */}
                  {templates[key] && !approved.includes(templates[key]) && (
                    <option value={templates[key]}>{templates[key]} (current)</option>
                  )}
                  {approved.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              ) : (
                <Input
                  value={templates[key] || ""}
                  onChange={(e) => setTemplates((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="flex-1 text-sm"
                  placeholder="template name"
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
          Save settings
        </Button>
        <Button variant="outline" onClick={() => void load()} disabled={saving}>
          <RotateCcw className="w-4 h-4 mr-1" /> Reset
        </Button>
      </div>
    </div>
  );
}
