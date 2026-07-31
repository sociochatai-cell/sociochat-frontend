import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronsUpDown, Plus, Settings2, Loader2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getWorkspaceId,
  setWorkspaceId,
  getWorkspaces,
  setWorkspaces,
  type Workspace,
} from "@/whatsapp/utils/workspaceContext";
import apiClient from "@/lib/apiClient";

/**
 * Header workspace selector.
 * - Searchable dropdown of the user's workspaces (persists the active id, reloads).
 * - "New" opens a small dialog that runs the normal creation flow (POST /workspaces).
 * - "Manage" navigates to the full management page (/dashboard/workspaces).
 * Live-loads the list so it is never hidden by a stale/empty cache.
 */
export default function WorkspaceSwitcher() {
  const navigate = useNavigate();
  const [wsList, setWsList] = useState<Workspace[]>(() => getWorkspaces());
  const [current, setCurrent] = useState<string | undefined>(() => getWorkspaceId() ?? undefined);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // "New workspace" dialog state.
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");

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

  const wsLabel = (ws: Workspace) => ws.business_name || ws.name || `Workspace ${ws.id}`;
  const currentWs = wsList.find((w) => String(w.id) === String(current));
  const triggerLabel = currentWs ? wsLabel(currentWs) : "Select workspace";

  // Clear any persisted account id when the workspace changes — otherwise a page
  // that trusts the stored account id would operate on the PREVIOUS workspace's
  // account (cross-workspace data). The reload then lets each page re-resolve the
  // new workspace's connected account.
  const clearStoredAccountIds = () => {
    ['sv_whatsapp_account_id', 'current_whatsapp_account_id', 'selectedAccountId'].forEach((k) => {
      try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch { /* ignore */ }
    });
  };

  const switchTo = (value: string) => {
    setOpen(false);
    if (String(value) === String(current)) return;
    setWorkspaceId(value);
    setCurrent(value);
    clearStoredAccountIds();
    window.location.reload();
  };

  const openManage = () => {
    setOpen(false);
    navigate("/dashboard/workspaces");
  };

  const openCreate = () => {
    setOpen(false);
    setCreateName("");
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const name = createName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await apiClient.post("/workspaces", { name });
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
      clearStoredAccountIds();
      setCreateOpen(false);
      window.location.reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            className="flex h-9 w-[180px] items-center justify-between gap-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-0" align="end">
          <Command>
            <CommandInput placeholder="Search workspaces..." className="h-9" />
            <CommandList>
              <CommandEmpty>No workspace found.</CommandEmpty>
              <CommandGroup heading="Workspaces">
                {wsList.map((ws) => {
                  const id = String(ws.id);
                  const isActive = id === String(current);
                  return (
                    <CommandItem
                      key={id}
                      value={`${wsLabel(ws)} ${id}`}
                      onSelect={() => switchTo(id)}
                    >
                      <Check
                        className={
                          "mr-2 h-4 w-4 " + (isActive ? "opacity-100" : "opacity-0")
                        }
                      />
                      <span className="truncate">{wsLabel(ws)}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
          {/* Fixed actions, always visible (outside the filtered list). */}
          <div className="border-t p-1">
            <button
              type="button"
              onClick={openCreate}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Plus className="h-4 w-4" /> New workspace
            </button>
            <button
              type="button"
              onClick={openManage}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Settings2 className="h-4 w-4" /> Manage workspaces
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={(o) => { if (!busy) setCreateOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>Give your new workspace a name.</DialogDescription>
          </DialogHeader>
          <Input
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Workspace name"
            autoFocus
            disabled={busy}
            onKeyDown={(e) => { if (e.key === "Enter" && !busy) submitCreate(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submitCreate} disabled={busy || !createName.trim()}>
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
