// JOM Departments admin — create/edit destination departments, keywords, and
// which agents staff each. Gated to the JOM workspace only (rendered from
// WhatsAppSettings behind an isJomWorkspace check). Owner-authenticated.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, X, Users } from "lucide-react";
import { jomApi, JomDepartment } from "./jomApi";
import { makeOwnerAgentApi } from "@/agent_login/lib/agentAdminApi";

interface AgentLite { id: number; name: string; active: boolean; }

export default function DepartmentsManager({ workspaceId }: { workspaceId: string }) {
  const [departments, setDepartments] = useState<JomDepartment[]>([]);
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // new-department form
  const [newName, setNewName] = useState("");
  const [newKeywords, setNewKeywords] = useState("");

  const ownerApi = useMemo(() => makeOwnerAgentApi(), []);
  const agentName = useCallback((id: number) => agents.find((a) => a.id === id)?.name || `Agent #${id}`, [agents]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [depRes, agRes] = await Promise.all([
        jomApi.listDepartments(workspaceId),
        ownerApi.listAgents(),
      ]);
      if (depRes.ok && depRes.data?.success) {
        setDepartments(depRes.data.departments || []);
      } else {
        setError("Failed to load departments.");
      }
      const list = (agRes.data?.agents || []).map((a) => ({
        id: a.id,
        name: a.display_name || a.username,
        active: a.is_active !== false,
      }));
      setAgents(list);
    } catch (e) {
      setError("Failed to load departments.");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, ownerApi]);

  useEffect(() => { void load(); }, [load]);

  const createDept = async () => {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const keywords = newKeywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
      const res = await jomApi.createDepartment(workspaceId, { name, match_keywords: keywords });
      if (res.ok && res.data?.success) {
        setNewName("");
        setNewKeywords("");
        await load();
      } else {
        setError("Could not create department.");
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (d: JomDepartment) => {
    const res = await jomApi.updateDepartment(workspaceId, d.id, { is_active: !d.is_active });
    if (res.ok && res.data?.success) {
      setDepartments((prev) => prev.map((x) => (x.id === d.id ? res.data!.department : x)));
    }
  };

  const saveKeywords = async (d: JomDepartment, raw: string) => {
    const keywords = raw.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    const res = await jomApi.updateDepartment(workspaceId, d.id, { match_keywords: keywords });
    if (res.ok && res.data?.success) {
      setDepartments((prev) => prev.map((x) => (x.id === d.id ? res.data!.department : x)));
    }
  };

  const removeDept = async (d: JomDepartment) => {
    if (!window.confirm(`Delete department "${d.name}"? This cannot be undone.`)) return;
    const res = await jomApi.deleteDepartment(workspaceId, d.id);
    if (res.ok && res.data?.success) {
      setDepartments((prev) => prev.filter((x) => x.id !== d.id));
    }
  };

  const attachAgent = async (d: JomDepartment, agentId: number) => {
    const res = await jomApi.addAgent(workspaceId, d.id, agentId);
    if (res.ok && res.data?.success) {
      setDepartments((prev) => prev.map((x) => (x.id === d.id ? { ...x, agent_ids: res.data!.agent_ids } : x)));
    }
  };

  const detachAgent = async (d: JomDepartment, agentId: number) => {
    const res = await jomApi.removeAgent(workspaceId, d.id, agentId);
    if (res.ok && res.data?.success) {
      setDepartments((prev) => prev.map((x) => (x.id === d.id ? { ...x, agent_ids: res.data!.agent_ids } : x)));
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground py-8"><Loader2 className="w-4 h-4 animate-spin" /> Loading departments…</div>;
  }

  return (
    <div className="space-y-4">
      {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</div>}

      {/* Create */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Add department</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="Destination name (e.g. Kashmir)" value={newName} onChange={(e) => setNewName(e.target.value)} className="sm:max-w-[220px]" />
          <Input placeholder="Keywords, comma-separated (kashmir, srinagar, gulmarg)" value={newKeywords} onChange={(e) => setNewKeywords(e.target.value)} className="flex-1" />
          <Button onClick={createDept} disabled={saving || !newName.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
          </Button>
        </CardContent>
      </Card>

      {departments.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-6">No departments yet. Add your first destination above.</div>
      )}

      {/* List */}
      {departments.map((d) => (
        <DepartmentRow
          key={d.id}
          dept={d}
          agents={agents}
          agentName={agentName}
          onToggle={() => toggleActive(d)}
          onSaveKeywords={(raw) => saveKeywords(d, raw)}
          onDelete={() => removeDept(d)}
          onAttach={(aid) => attachAgent(d, aid)}
          onDetach={(aid) => detachAgent(d, aid)}
        />
      ))}
    </div>
  );
}

function DepartmentRow({
  dept, agents, agentName, onToggle, onSaveKeywords, onDelete, onAttach, onDetach,
}: {
  dept: JomDepartment;
  agents: AgentLite[];
  agentName: (id: number) => string;
  onToggle: () => void;
  onSaveKeywords: (raw: string) => void;
  onDelete: () => void;
  onAttach: (agentId: number) => void;
  onDetach: (agentId: number) => void;
}) {
  const [kw, setKw] = useState((dept.match_keywords || []).join(", "));
  const kwDirty = kw !== (dept.match_keywords || []).join(", ");
  const unassigned = agents.filter((a) => !dept.agent_ids.includes(a.id));

  return (
    <Card className={dept.is_active ? "" : "opacity-60"}>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{dept.name}</span>
            <Badge variant={dept.is_active ? "default" : "secondary"}>{dept.is_active ? "Active" : "Off"}</Badge>
            <span className="text-xs text-muted-foreground">round-robin</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Active</span>
              <Switch checked={dept.is_active} onCheckedChange={onToggle} />
            </div>
            <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600" onClick={onDelete}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Keywords */}
        <div className="flex items-center gap-2">
          <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="Keywords, comma-separated" className="flex-1 text-sm" />
          <Button size="sm" variant={kwDirty ? "default" : "outline"} disabled={!kwDirty} onClick={() => onSaveKeywords(kw)}>Save keywords</Button>
        </div>

        {/* Agents */}
        <div className="flex flex-wrap items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          {dept.agent_ids.length === 0 && <span className="text-xs text-muted-foreground">No agents — leads won't be assigned.</span>}
          {dept.agent_ids.map((aid) => (
            <Badge key={aid} variant="outline" className="gap-1">
              {agentName(aid)}
              <button onClick={() => onDetach(aid)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
            </Badge>
          ))}
          {unassigned.length > 0 && (
            <select
              className="text-xs border rounded-md px-2 py-1 bg-white"
              value=""
              onChange={(e) => { const v = Number(e.target.value); if (v) onAttach(v); }}
            >
              <option value="">+ add agent…</option>
              {unassigned.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
