// JOM Google Sheet lead intake — paste a "anyone with the link can view" Google
// Sheet URL; the backend polls it, imports new rows as leads and fires the opening
// template. Shows a green/red health badge for the last sync. Gated to JOM workspace.
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, RefreshCw, Sheet, CheckCircle2, XCircle } from "lucide-react";
import { jomApi, JomSheetConfig } from "./jomApi";

function fmt(dt: string | null): string {
  if (!dt) return "never";
  try { return new Date(dt).toLocaleString(); } catch { return dt; }
}

export default function JomSheetIntake({ workspaceId }: { workspaceId: string }) {
  const [cfg, setCfg] = useState<JomSheetConfig | null>(null);
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const apply = useCallback((c: JomSheetConfig) => {
    setCfg(c);
    setUrl(c.sheet_url || "");
    setEnabled(c.enabled);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await jomApi.getSheet(workspaceId);
      if (res.ok && res.data?.success) apply(res.data.config);
      else setError("Failed to load sheet config.");
    } catch { setError("Failed to load sheet config."); }
    finally { setLoading(false); }
  }, [workspaceId, apply]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true); setError(null); setNote(null);
    try {
      const res = await jomApi.saveSheet(workspaceId, { sheet_url: url, enabled });
      if (res.ok && res.data?.success) { apply(res.data.config); setNote("Saved."); }
      else setError(res.data?.error || "Could not save.");
    } catch { setError("Could not save."); }
    finally { setSaving(false); }
  };

  const syncNow = async () => {
    setSyncing(true); setError(null); setNote(null);
    try {
      const res = await jomApi.syncSheet(workspaceId, true);
      if (res.data?.config) apply(res.data.config);
      if (res.ok && res.data?.success) {
        setNote(`Synced: ${res.data.rows ?? 0} rows, ${res.data.imported ?? 0} new lead(s), ${res.data.messaged ?? 0} messaged.`);
      } else {
        setError(res.data?.error || "Sync failed.");
      }
    } catch { setError("Sync failed."); }
    finally { setSyncing(false); }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground py-8"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  }

  const healthOk = cfg?.last_status === "ok";
  const healthBad = cfg?.last_status === "error";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Sheet className="w-4 h-4 text-primary" /> Google Sheet lead intake
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Paste a Google Sheet link (share as <span className="font-medium">"Anyone with the link can view"</span>). New rows are
          imported as leads and get the opening WhatsApp message automatically. Needs a column for the phone number; name,
          destination, budget and dates are picked up when present.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}
        {note && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">{note}</div>}

        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…/edit"
            className="flex-1"
          />
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-muted-foreground">Auto-import</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save
          </Button>
          <Button variant="outline" onClick={syncNow} disabled={syncing || !url.trim()}>
            <RefreshCw className={`w-4 h-4 mr-1 ${syncing ? "animate-spin" : ""}`} /> Sync now
          </Button>
        </div>

        {/* Health */}
        <div className="rounded-lg border bg-slate-50/60 px-3 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            {healthOk && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
            {healthBad && <XCircle className="w-4 h-4 text-red-600" />}
            {!cfg?.last_status && <span className="w-2 h-2 rounded-full bg-slate-300" />}
            <span className={`font-medium ${healthOk ? "text-emerald-700" : healthBad ? "text-red-700" : "text-slate-600"}`}>
              {healthOk ? "Healthy" : healthBad ? "Sync error" : "Not synced yet"}
            </span>
            <span className="text-xs text-muted-foreground">· last sync {fmt(cfg?.last_synced_at || null)}</span>
          </div>
          {healthBad && cfg?.last_error && (
            <p className="text-xs text-red-600 mt-1">{cfg.last_error}</p>
          )}
          {healthOk && (
            <p className="text-xs text-muted-foreground mt-1">
              Last run: {cfg?.last_row_count ?? 0} rows read, {cfg?.last_imported_count ?? 0} new imported ·
              {" "}{cfg?.total_imported ?? 0} imported all-time.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
