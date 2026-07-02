import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getWorkspaceId,
  setWorkspaceId,
  getWorkspaces,
  setWorkspaces,
  type Workspace,
} from "@/whatsapp/utils/workspaceContext";
import apiClient from "@/lib/apiClient";

const CREATE_NEW = "__create_new__";

/**
 * Header workspace selector + management.
 * - Switch between the user's workspaces (persists X-Workspace-Id, reloads).
 * - Create a new workspace (always available).
 * - Delete the current workspace (guarded against deleting the last one).
 * Live-loads the list so it is never hidden by a stale/empty cache.
 */
export default function WorkspaceSwitcher() {
  const [wsList, setWsList] = useState<Workspace[]>(() => getWorkspaces());
  const [current, setCurrent] = useState<string | undefined>(() => getWorkspaceId() ?? undefined);
  const [busy, setBusy] = useState(false);

  // Always fetch the live list so the switcher is never empty due to a stale cache.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get("/workspaces");
        if (!cancelled && res.ok && Array.isArray(res.data?.workspaces)) {
          setWsList(res.data.workspaces);
          setWorkspaces(res.data.workspaces);
          if (!getWorkspaceId() && res.data.workspaces[0]) {
            setWorkspaceId(String(res.data.workspaces[0].id));
            setCurrent(String(res.data.workspaces[0].id));
          }
        }
      } catch {
        /* keep whatever the cache had */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const createWorkspace = async () => {
    const name = window.prompt("New workspace name:");
    if (!name || !name.trim()) return;
    setBusy(true);
    try {
      const res = await apiClient.post("/workspaces", { name: name.trim() });
      if (!res.ok) {
        alert(
          res.error?.error === "workspace_limit_exceeded"
            ? "Workspace limit reached for your plan."
            : "Could not create workspace.",
        );
        return;
      }
      const ws = res.data.workspace;
      const next = [...wsList, ws];
      setWsList(next);
      setWorkspaces(next);
      setWorkspaceId(String(ws.id));
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  const handleChange = (value: string) => {
    if (value === CREATE_NEW) {
      createWorkspace();
      return;
    }
    setWorkspaceId(value);
    setCurrent(value);
    window.location.reload();
  };

  const deleteCurrent = async () => {
    const cur = current || (wsList[0] && String(wsList[0].id));
    if (!cur) return;
    const ws = wsList.find((w) => String(w.id) === String(cur));
    const label = ws?.business_name || ws?.name || `Workspace ${cur}`;
    if (!window.confirm(`Delete workspace "${label}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await apiClient.delete(`/workspaces/${cur}`);
      if (!res.ok) {
        alert(
          res.error?.error === "cannot_delete_last_workspace"
            ? "You must keep at least one workspace."
            : "Could not delete this workspace.",
        );
        return;
      }
      const next = wsList.filter((w) => String(w.id) !== String(cur));
      setWsList(next);
      setWorkspaces(next);
      if (next[0]) setWorkspaceId(String(next[0].id));
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  // Even with 0 workspaces, expose "New workspace" so it's always creatable.
  if (wsList.length === 0) {
    return (
      <button
        type="button"
        onClick={createWorkspace}
        disabled={busy}
        className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
      >
        + New Workspace
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Select value={current} onValueChange={handleChange}>
        <SelectTrigger className="h-9 w-[180px] text-sm">
          <SelectValue placeholder="Workspace" />
        </SelectTrigger>
        <SelectContent>
          {wsList.map((ws) => (
            <SelectItem key={String(ws.id)} value={String(ws.id)}>
              {ws.business_name || ws.name || `Workspace ${ws.id}`}
            </SelectItem>
          ))}
          <SelectItem value={CREATE_NEW}>+ New Workspace</SelectItem>
        </SelectContent>
      </Select>
      <button
        type="button"
        onClick={deleteCurrent}
        disabled={busy}
        title="Delete current workspace"
        className="h-9 px-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-red-600 hover:bg-slate-50 text-sm"
      >
        Delete
      </button>
    </div>
  );
}
