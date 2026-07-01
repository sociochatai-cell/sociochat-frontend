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
 * Header workspace selector. Reads the user's cached workspaces (populated at login by
 * AuthContext) and the active workspace id from the shared workspace context. Switching
 * persists the new id (used as X-Workspace-Id on every API call) and reloads so all
 * workspace-scoped data refetches. Hidden when the user has 0/1 workspace.
 */
export default function WorkspaceSwitcher() {
  const [wsList, setWsList] = useState<Workspace[]>([]);
  const [current, setCurrent] = useState<string | undefined>(undefined);

  useEffect(() => {
    setWsList(getWorkspaces());
    setCurrent(getWorkspaceId() ?? undefined);
  }, []);

  const handleChange = async (value: string) => {
    if (value === CREATE_NEW) {
      const name = window.prompt("New workspace name:");
      if (!name || !name.trim()) return;
      const res = await apiClient.post("/workspaces", { name: name.trim() });
      if (!res.ok) {
        alert(res.error?.error === "workspace_limit_exceeded" ? "Workspace limit reached for your plan." : "Could not create workspace.");
        return;
      }
      const ws = res.data.workspace;
      setWorkspaces([...wsList, ws]);
      setWorkspaceId(String(ws.id));
      window.location.reload();
      return;
    }
    setWorkspaceId(value);
    setCurrent(value);
    window.location.reload();
  };

  if (wsList.length === 0) return null;

  return (
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
  );
}
