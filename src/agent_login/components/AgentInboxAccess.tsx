/**
 * Agent Inbox Access UI — SocioChat.
 * ==================================
 * Dialog for controlling which WhatsApp conversations an agent can see, per
 * workspace: inbox scope (all vs assigned-only), auto-assign participation,
 * the workspace-level round-robin master switch, and per-number assignment
 * (assign selected / release / assign-in-advance).
 *
 * Data-source agnostic: all calls go through an injected `AgentAdminApi`
 * adapter (see agent_login/lib/agentAdminApi.ts).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentAdminApi, AgentAdminResult, WorkspaceLite, WorkspaceNumber, InboxScope,
} from "../lib/agentAdminApi";
import { agentAdminErrMsg } from "../lib/agentAdminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Search, X, Plus, Building2, Inbox, Shuffle, UserPlus, ChevronDown, ChevronRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types (AgentLite is structurally compatible with the adapter's AgentRecord)
// ---------------------------------------------------------------------------

interface AgentLite {
  id: number;
  username: string;
  display_name?: string;
  workspace_ids: number[];
}

interface AgentInboxAccessProps {
  api: AgentAdminApi;
  agent: AgentLite;
  workspaces: WorkspaceLite[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const failMsg = (res: AgentAdminResult, fallback: string): string =>
  agentAdminErrMsg(res, fallback);

const AgentInboxAccess: React.FC<AgentInboxAccessProps> = ({ api, agent, workspaces, open, onOpenChange }) => {
  const { toast } = useToast();
  const agentName = agent.display_name || agent.username;

  // Workspaces this agent has been granted (agent.workspace_ids ∩ workspaces).
  const granted = useMemo(
    () => workspaces.filter((w) => (agent.workspace_ids || []).includes(w.id)),
    [workspaces, agent.workspace_ids],
  );
  const wsLabel = (w: WorkspaceLite) => w.business_name || w.name || `Workspace ${w.id}`;

  const [wsId, setWsId] = useState<number | null>(granted[0]?.id ?? null);

  // Per-workspace state
  const [numbers, setNumbers] = useState<WorkspaceNumber[]>([]);
  const [numbersLoading, setNumbersLoading] = useState(false);
  const [scope, setScope] = useState<InboxScope | null>(null); // null = loading
  const [scopeSaving, setScopeSaving] = useState(false);
  const [participate, setParticipate] = useState(false);
  const [participateSaving, setParticipateSaving] = useState(false);
  const [masterEnabled, setMasterEnabled] = useState<boolean | null>(null); // null = loading
  const [masterSaving, setMasterSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [advancePhone, setAdvancePhone] = useState("");
  const [advanceSaving, setAdvanceSaving] = useState(false);
  const [numbersOpen, setNumbersOpen] = useState(true); // collapsible so "add in advance" stays visible

  // Keep the selected workspace valid if the granted list changes.
  useEffect(() => {
    if (wsId == null || !granted.some((w) => w.id === wsId)) setWsId(granted[0]?.id ?? null);
  }, [granted, wsId]);

  const refetchNumbers = useCallback(async (workspaceId: number) => {
    const res = await api.listNumbers(workspaceId);
    if (res.ok && res.data?.success) {
      setNumbers(res.data.numbers || []);
      setMasterEnabled(res.data.autoassign_enabled);
    } else {
      toast({ title: "Error", description: failMsg(res, "Failed to load numbers"), variant: "destructive" });
    }
  }, [api, toast]);

  // Guards against a stale load: if the owner switches workspace tabs while a
  // previous load is in flight, the older (slower) response must NOT overwrite
  // the newer workspace's state (and mutations against the wrong ws).
  const latestWsRef = useRef<number | null>(null);

  const loadWorkspaceData = useCallback(async (workspaceId: number) => {
    latestWsRef.current = workspaceId;
    setNumbersLoading(true);
    setScope(null);
    setMasterEnabled(null);
    try {
      const [numsRes, grantRes, autoRes] = await Promise.all([
        api.listNumbers(workspaceId),
        api.getGrant(agent.id, workspaceId),
        api.getAutoassign(workspaceId),
      ]);
      // Discard if the owner switched workspaces while this was loading.
      if (latestWsRef.current !== workspaceId) return;
      if (numsRes.ok && numsRes.data?.success) {
        setNumbers(numsRes.data.numbers || []);
        setMasterEnabled(numsRes.data.autoassign_enabled);
      } else {
        setNumbers([]);
        toast({ title: "Error", description: failMsg(numsRes, "Failed to load numbers"), variant: "destructive" });
      }
      if (grantRes.ok && grantRes.data?.success) {
        setScope(grantRes.data.grant.inbox_scope);
        setParticipate(grantRes.data.grant.auto_assign);
      } else {
        setScope("all"); // sensible default when the grant can't be read
        setParticipate(false);
      }
      if (autoRes.ok && autoRes.data?.success) setMasterEnabled(autoRes.data.enabled);
    } finally {
      if (latestWsRef.current === workspaceId) setNumbersLoading(false);
    }
  }, [api, agent.id, toast]);

  // (Re)load everything whenever the dialog opens or the workspace changes.
  useEffect(() => {
    if (!open || wsId == null) return;
    setSearch("");
    setSelected(new Set());
    setAdvancePhone("");
    loadWorkspaceData(wsId);
  }, [open, wsId, loadWorkspaceData]);

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  const changeScope = async (value: InboxScope) => {
    if (wsId == null || value === scope || scopeSaving) return;
    const prev = scope;
    setScope(value);
    setScopeSaving(true);
    try {
      const res = await api.patchGrant(agent.id, wsId, { inbox_scope: value });
      if (res.ok && res.data?.success) {
        setScope(res.data.grant.inbox_scope);
        setParticipate(res.data.grant.auto_assign);
        toast({
          title: "Saved",
          description: value === "all"
            ? `${agentName} now sees all conversations in this workspace`
            : `${agentName} now only sees numbers assigned to them`,
        });
      } else {
        setScope(prev);
        toast({ title: "Error", description: failMsg(res, "Failed to update inbox scope"), variant: "destructive" });
      }
    } finally {
      setScopeSaving(false);
    }
  };

  const toggleParticipate = async (checked: boolean) => {
    if (wsId == null || participateSaving) return;
    const prev = participate;
    setParticipate(checked);
    setParticipateSaving(true);
    try {
      const res = await api.patchGrant(agent.id, wsId, { auto_assign: checked });
      if (res.ok && res.data?.success) {
        setParticipate(res.data.grant.auto_assign);
        toast({
          title: "Saved",
          description: checked
            ? `${agentName} will receive auto-assigned numbers`
            : `${agentName} removed from auto-assign rotation`,
        });
      } else {
        setParticipate(prev);
        toast({ title: "Error", description: failMsg(res, "Failed to update auto-assign participation"), variant: "destructive" });
      }
    } finally {
      setParticipateSaving(false);
    }
  };

  const toggleMaster = async (enabled: boolean) => {
    if (wsId == null || masterSaving) return;
    const prev = masterEnabled;
    setMasterEnabled(enabled);
    setMasterSaving(true);
    try {
      const res = await api.setAutoassign(wsId, enabled);
      if (res.ok && res.data?.success) {
        setMasterEnabled(res.data.enabled);
        toast({
          title: "Saved",
          description: enabled ? "Auto-assign enabled for this workspace" : "Auto-assign disabled for this workspace",
        });
      } else {
        setMasterEnabled(prev);
        toast({ title: "Error", description: failMsg(res, "Failed to update auto-assign"), variant: "destructive" });
      }
    } finally {
      setMasterSaving(false);
    }
  };

  const assignSelected = async () => {
    if (wsId == null || selected.size === 0 || assigning) return;
    const phones = Array.from(selected);
    const movedCount = numbers.filter(
      (n) => selected.has(n.customer_phone) && n.assigned_agent_id != null && n.assigned_agent_id !== agent.id,
    ).length;
    if (movedCount > 0 && !confirm(`${movedCount} number(s) are assigned to other agents and will be moved. Continue?`)) return;
    setAssigning(true);
    try {
      const res = await api.assignNumbers(agent.id, { workspace_id: wsId, phones });
      if (res.ok && res.data?.success) {
        toast({ title: "Assigned", description: `${phones.length} number(s) assigned to ${agentName}` });
        setSelected(new Set());
        await refetchNumbers(wsId);
      } else {
        toast({ title: "Error", description: failMsg(res, "Failed to assign numbers"), variant: "destructive" });
      }
    } finally {
      setAssigning(false);
    }
  };

  const releaseNumber = async (phone: string) => {
    if (wsId == null || releasing) return;
    setReleasing(phone);
    try {
      const res = await api.releaseNumbers(agent.id, { workspace_id: wsId, phones: [phone] });
      if (res.ok && res.data?.success) {
        toast({ title: "Released", description: `${phone} is no longer assigned to ${agentName}` });
        await refetchNumbers(wsId);
      } else {
        toast({ title: "Error", description: failMsg(res, "Failed to release number"), variant: "destructive" });
      }
    } finally {
      setReleasing(null);
    }
  };

  const addAdvance = async () => {
    const phone = advancePhone.trim();
    if (wsId == null || advanceSaving) return;
    if (phone.replace(/\D/g, "").length < 5) {
      return toast({ title: "Error", description: "Enter a valid phone number", variant: "destructive" });
    }
    setAdvanceSaving(true);
    try {
      const res = await api.assignNumbers(agent.id, { workspace_id: wsId, phones: [phone], advance: true });
      if (res.ok && res.data?.success) {
        toast({ title: "Added", description: `${phone} pre-assigned to ${agentName}` });
        setAdvancePhone("");
        await refetchNumbers(wsId);
      } else {
        toast({ title: "Error", description: failMsg(res, "Failed to add number"), variant: "destructive" });
      }
    } finally {
      setAdvanceSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Derived table data
  // -------------------------------------------------------------------------

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return numbers;
    return numbers.filter(
      (n) => n.customer_phone.toLowerCase().includes(q) || (n.user_name || "").toLowerCase().includes(q),
    );
  }, [numbers, search]);

  const selectableFiltered = filtered.filter((n) => n.assigned_agent_id !== agent.id);
  const allFilteredSelected = selectableFiltered.length > 0 && selectableFiltered.every((n) => selected.has(n.customer_phone));

  const toggleRow = (phone: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(phone)) next.delete(phone); else next.add(phone);
      return next;
    });

  const toggleAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) selectableFiltered.forEach((n) => next.delete(n.customer_phone));
      else selectableFiltered.forEach((n) => next.add(n.customer_phone));
      return next;
    });

  const statusBadge = (n: WorkspaceNumber) => {
    if (n.assigned_agent_id == null) return <Badge variant="secondary">Unassigned</Badge>;
    const mine = n.assigned_agent_id === agent.id;
    return (
      <Badge variant={mine ? "default" : "secondary"}>
        Assigned to {mine ? agentName : (n.assigned_agent_name || `Agent ${n.assigned_agent_id}`)}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Inbox className="h-5 w-5" /> Inbox Access — {agentName}</DialogTitle>
          <DialogDescription>Control which WhatsApp conversations this agent can see, per workspace.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
          {granted.length === 0 ? (
            <p className="text-sm text-muted-foreground">This agent has no workspaces assigned.</p>
          ) : (
            <>
              {/* Workspace selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Workspace</Label>
                {granted.length === 1 ? (
                  <p className="text-sm font-medium">{wsLabel(granted[0])}</p>
                ) : (
                  <Select value={wsId != null ? String(wsId) : undefined} onValueChange={(v) => setWsId(Number(v))}>
                    <SelectTrigger className="w-full sm:w-[320px]"><SelectValue placeholder="Select workspace" /></SelectTrigger>
                    <SelectContent>
                      {granted.map((w) => (
                        <SelectItem key={w.id} value={String(w.id)}>{wsLabel(w)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Separator />

              {/* Inbox scope */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Inbox scope</Label>
                {scope === null ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading current setting…
                  </div>
                ) : (
                  // onValueChange is the single source of scope change — the option
                  // wrappers deliberately have no onClick (it double-fired changeScope).
                  <RadioGroup value={scope} onValueChange={(v) => changeScope(v as InboxScope)} className="space-y-1" disabled={scopeSaving}>
                    <div className="flex items-start space-x-3 rounded-md border p-3 hover:bg-accent">
                      <RadioGroupItem value="all" id={`scope-all-${agent.id}`} className="mt-0.5" />
                      <div className="space-y-0.5">
                        <Label htmlFor={`scope-all-${agent.id}`} className="cursor-pointer">All conversations</Label>
                        <p className="text-xs text-muted-foreground">The agent sees every chat in this workspace's inbox.</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 rounded-md border p-3 hover:bg-accent">
                      <RadioGroupItem value="by_chat" id={`scope-by-chat-${agent.id}`} className="mt-0.5" />
                      <div className="space-y-0.5">
                        <Label htmlFor={`scope-by-chat-${agent.id}`} className="cursor-pointer">Only assigned numbers</Label>
                        <p className="text-xs text-muted-foreground">The agent only sees chats from customer numbers assigned to them below.</p>
                      </div>
                    </div>
                  </RadioGroup>
                )}

                {scope === "by_chat" && (
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <div className="space-y-0.5">
                      <Label className="flex items-center gap-2"><UserPlus className="h-4 w-4" /> Participate in auto-assign</Label>
                      <p className="text-xs text-muted-foreground">Include {agentName} when new numbers are distributed automatically.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {participateSaving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      <Switch checked={participate} onCheckedChange={toggleParticipate} disabled={participateSaving} />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Workspace-level auto-assign master switch */}
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2"><Shuffle className="h-4 w-4" /> Auto-assign new numbers (round-robin)</Label>
                  <p className="text-xs text-muted-foreground">New customer numbers are distributed to participating agents in rotation.</p>
                </div>
                <div className="flex items-center gap-2">
                  {(masterSaving || masterEnabled === null) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Switch checked={masterEnabled === true} onCheckedChange={toggleMaster} disabled={masterSaving || masterEnabled === null} />
                </div>
              </div>

              <Separator />

              {/* Numbers (collapsible dropdown so "Add number in advance" below stays visible) */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setNumbersOpen((o) => !o)}
                  className="w-full flex items-center justify-between rounded-md px-1 py-1 -mx-1 hover:bg-accent/50"
                >
                  <span className="text-base font-semibold flex items-center gap-2">
                    {numbersOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    Numbers
                    <Badge variant="secondary" className="text-xs">{numbers.length}</Badge>
                  </span>
                  {!numbersOpen && <span className="text-xs text-muted-foreground">click to expand</span>}
                </button>

                {numbersOpen && (
                <>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search phone or name" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 w-full" />
                  </div>
                  {selected.size > 0 && (
                    <Button size="sm" onClick={assignSelected} disabled={assigning} className="gap-1">
                      {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
                      Assign selected to {agentName} ({selected.size})
                    </Button>
                  )}
                </div>

                {numbersLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6 border rounded-md">
                    {numbers.length === 0 ? "No customer numbers in this workspace yet." : "No numbers match your search."}
                  </p>
                ) : (
                  <div className="border rounded-md max-h-[280px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[40px]">
                            <Checkbox
                              checked={allFilteredSelected}
                              onCheckedChange={toggleAllFiltered}
                              disabled={selectableFiltered.length === 0}
                              aria-label="Select all"
                            />
                          </TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-[60px]" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((n) => {
                          const mine = n.assigned_agent_id === agent.id;
                          return (
                            <TableRow key={n.customer_phone}>
                              <TableCell>
                                {!mine && (
                                  <Checkbox
                                    checked={selected.has(n.customer_phone)}
                                    onCheckedChange={() => toggleRow(n.customer_phone)}
                                    aria-label={`Select ${n.customer_phone}`}
                                  />
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm">{n.customer_phone}</TableCell>
                              <TableCell className="text-sm">{n.user_name || <span className="text-muted-foreground">—</span>}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {statusBadge(n)}
                                  {n.assigned_agent_id != null && n.assignment_type && (
                                    <Badge variant="outline" className="text-xs">{n.assignment_type}</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                {mine && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => releaseNumber(n.customer_phone)}
                                    disabled={releasing === n.customer_phone}
                                    title={`Release ${n.customer_phone}`}
                                  >
                                    {releasing === n.customer_phone
                                      ? <Loader2 className="h-4 w-4 animate-spin" />
                                      : <X className="h-4 w-4" />}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                </>
                )}
              </div>

              <Separator />

              {/* Add number in advance */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Add number in advance</Label>
                <p className="text-xs text-muted-foreground">
                  Assign a customer number before their first message — when they message, only this agent will see the chat.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="+919876543210"
                    value={advancePhone}
                    onChange={(e) => setAdvancePhone(e.target.value.replace(/[^\d+]/g, ""))}
                    className="w-[240px] font-mono"
                  />
                  <Button
                    variant="outline"
                    onClick={addAdvance}
                    disabled={advanceSaving || advancePhone.replace(/\D/g, "").length < 5}
                    className="gap-1"
                  >
                    {advanceSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AgentInboxAccess;
