import { useEffect, useState } from "react";
import {
  Plus, Pencil, Trash2, Check, Loader2, Layers,
  Building2, MapPin, Globe, Calendar, MessageCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import apiClient from "@/lib/apiClient";
import {
  getWorkspaceId,
  setWorkspaceId,
  setWorkspaces,
  type Workspace,
} from "@/whatsapp/utils/workspaceContext";

/** Format an ISO date as "Jun 30, 2025", or "" if missing/invalid. */
function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Tailwind classes for a WhatsApp quality score badge. */
function qualityClasses(score?: string | null): string {
  switch ((score || "").toUpperCase()) {
    case "GREEN": return "bg-emerald-100 text-emerald-700";
    case "YELLOW": return "bg-amber-100 text-amber-700";
    case "RED": return "bg-red-100 text-red-700";
    default: return "bg-slate-100 text-slate-600";
  }
}

/**
 * Dedicated Workspaces management page (/dashboard/workspaces).
 * See ALL workspaces and manage them: switch active, create, rename, delete.
 */
export default function WorkspacesPage() {
  const { toast } = useToast();
  const [list, setList] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(() => getWorkspaceId());
  const [busy, setBusy] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "rename">("create");
  const [dialogValue, setDialogValue] = useState("");
  const [renameTarget, setRenameTarget] = useState<Workspace | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/workspaces");
      if (res.ok && Array.isArray(res.data?.workspaces)) {
        setList(res.data.workspaces);
        setWorkspaces(res.data.workspaces);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load workspaces", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    setActiveId(getWorkspaceId());
  }, []);

  const openCreate = () => {
    setDialogMode("create");
    setDialogValue("");
    setRenameTarget(null);
    setDialogOpen(true);
  };

  const openRename = (ws: Workspace) => {
    setDialogMode("rename");
    setDialogValue(ws.business_name || ws.name || "");
    setRenameTarget(ws);
    setDialogOpen(true);
  };

  const submitDialog = async () => {
    const name = dialogValue.trim();
    if (!name) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      if (dialogMode === "create") {
        const res = await apiClient.post("/workspaces", { name });
        if (!res.ok) {
          toast({
            title: "Could not create",
            description: res.error?.error === "workspace_limit_exceeded"
              ? "Workspace limit reached for your plan."
              : (res.error?.message || res.error?.error || "Failed."),
            variant: "destructive",
          });
          return;
        }
        toast({ title: "Workspace created", description: name });
      } else if (renameTarget) {
        const res = await apiClient.put(`/workspaces/${renameTarget.id}`, { name });
        if (!res.ok) {
          toast({ title: "Could not rename", variant: "destructive" });
          return;
        }
        toast({ title: "Workspace renamed" });
      }
      setDialogOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const switchTo = (ws: Workspace) => {
    setWorkspaceId(ws.id);
    window.location.reload();
  };

  const remove = async (ws: Workspace) => {
    const label = ws.business_name || ws.name || `Workspace ${ws.id}`;
    if (!window.confirm(`Delete workspace "${label}"? This permanently removes it and its data.`)) return;
    setBusy(true);
    try {
      const res = await apiClient.delete(`/workspaces/${ws.id}`);
      if (!res.ok) {
        toast({
          title: "Could not delete",
          description: res.error?.error === "cannot_delete_last_workspace"
            ? "You must keep at least one workspace."
            : (res.error?.message || res.error?.error || "Failed."),
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Workspace deleted" });
      const wasActive = String(ws.id) === String(getWorkspaceId());
      const next = list.filter((w) => String(w.id) !== String(ws.id));
      setList(next);
      setWorkspaces(next);
      if (wasActive && next[0]) {
        setWorkspaceId(next[0].id);
        window.location.reload();
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-emerald-600" /> Workspaces
          </h1>
          <p className="text-sm text-muted-foreground">
            See and manage all your workspaces — switch, create, rename, or delete.
          </p>
        </div>
        <Button onClick={openCreate} disabled={busy}>
          <Plus className="h-4 w-4 mr-1" /> New Workspace
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All workspaces ({list.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground py-4">Loading...</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No workspaces yet. Click “New Workspace” to create one.
            </p>
          ) : (
            list.map((ws) => {
              const isActive = String(ws.id) === String(activeId);
              const wa = ws.whatsapp;
              const created = fmtDate(ws.created_at);
              return (
                <div
                  key={String(ws.id)}
                  className="p-3 border rounded-lg bg-white space-y-3"
                >
                  {/* Header row: name + active badge + actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[180px]">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{ws.business_name || ws.name || `Workspace ${ws.id}`}</p>
                        {isActive && (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            <Check className="h-3 w-3 mr-1" /> Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">ID {ws.id}</p>
                    </div>
                    {!isActive && (
                      <Button size="sm" variant="outline" onClick={() => switchTo(ws)} disabled={busy}>
                        Switch to
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openRename(ws)} disabled={busy}>
                      <Pencil className="h-4 w-4 mr-1" /> Rename
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => remove(ws)}
                      disabled={busy}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </div>

                  {/* Related info */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    {(ws.industry || ws.business_type) && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {[ws.industry, ws.business_type].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {(ws.city || ws.country) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {[ws.city, ws.country].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {ws.website && (
                      <a
                        href={/^https?:\/\//i.test(ws.website) ? ws.website : `https://${ws.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-emerald-600 hover:underline"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {ws.website.replace(/^https?:\/\//i, "")}
                      </a>
                    )}
                    {created && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" /> Created {created}
                      </span>
                    )}
                  </div>

                  {/* WhatsApp connection status */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium " +
                        (wa?.connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500")
                      }
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {wa?.connected ? "WhatsApp connected" : "WhatsApp not connected"}
                    </span>
                    {wa?.connected && wa.phone_number && (
                      <span className="text-muted-foreground">{wa.phone_number}</span>
                    )}
                    {wa?.connected && wa.verified_name && (
                      <span className="text-muted-foreground">· {wa.verified_name}</span>
                    )}
                    {wa?.connected && wa.quality_score && (
                      <span className={"rounded-full px-2 py-0.5 font-medium " + qualityClasses(wa.quality_score)}>
                        {wa.quality_score}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!busy) setDialogOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogMode === "create" ? "New workspace" : "Rename workspace"}</DialogTitle>
            <DialogDescription>
              {dialogMode === "create" ? "Create a new workspace." : "Give this workspace a new name."}
            </DialogDescription>
          </DialogHeader>
          <Input
            value={dialogValue}
            onChange={(e) => setDialogValue(e.target.value)}
            placeholder="Workspace name"
            autoFocus
            disabled={busy}
            onKeyDown={(e) => { if (e.key === "Enter" && !busy) submitDialog(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitDialog} disabled={busy || !dialogValue.trim()}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {dialogMode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
