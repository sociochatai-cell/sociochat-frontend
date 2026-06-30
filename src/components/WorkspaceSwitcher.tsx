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
  type Workspace,
} from "@/whatsapp/utils/workspaceContext";

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

  if (wsList.length <= 1) return null;

  const handleChange = (value: string) => {
    setWorkspaceId(value);
    setCurrent(value);
    window.location.reload();
  };

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
      </SelectContent>
    </Select>
  );
}
