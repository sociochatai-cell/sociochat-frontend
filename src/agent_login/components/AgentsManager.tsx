/**
 * Agents Manager UI — SocioChat.
 * ==============================
 * Create/manage agent sub-logins: username + password, feature (page)
 * permissions, and which of the account's workspaces each agent may access.
 *
 * This UI is data-source agnostic — it talks to the backend through an injected
 * `AgentAdminApi` adapter (see agent_login/lib/agentAdminApi.ts) rather than a
 * fixed client. The platform super-admin portal mounts it with an admin-bound
 * adapter scoped to a chosen ACCOUNT (owner user).
 */

import React, { useCallback, useEffect, useState } from "react";
import type { AgentAdminApi, AgentRecord as Agent, PageDef, WorkspaceLite } from "../lib/agentAdminApi";
import { agentAdminErrMsg } from "../lib/agentAdminApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Plus, MoreHorizontal, Eye, EyeOff, RefreshCw, Trash2, KeyRound,
  User, Shield, CheckCircle2, XCircle, AlertCircle, Copy, Check, Building2, Inbox,
} from "lucide-react";
import AgentInboxAccess from "./AgentInboxAccess";

interface AgentsManagerProps {
  api: AgentAdminApi;
}

const AgentsManager: React.FC<AgentsManagerProps> = ({ api }) => {
  const { toast } = useToast();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [pages, setPages] = useState<PageDef[]>([]);
  const [assignable, setAssignable] = useState<string[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceLite[]>([]);
  const [accountId, setAccountId] = useState<number | null>(api.accountId ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", display_name: "", allowed_pages: [] as string[], workspace_ids: [] as number[] });
  // Live username availability (usernames are globally unique).
  const [usernameCheck, setUsernameCheck] = useState<{ status: "idle" | "checking" | "available" | "taken"; suggestion: string | null }>({ status: "idle", suggestion: null });

  const [resetAgent, setResetAgent] = useState<Agent | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const [inboxAgent, setInboxAgent] = useState<Agent | null>(null);

  const [successInfo, setSuccessInfo] = useState<{ account_id: number; username: string; password: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchAll = useCallback(async (opts?: { silent?: boolean }) => {
    // A "silent" refresh (after create/toggle/delete) must NOT flip the global
    // `loading` flag — that early-returns the whole component to a spinner and
    // unmounts the open dialogs (e.g. the just-opened credentials popup),
    // which made the create form appear to "reopen".
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const [agentsRes, cfgRes, wsRes] = await Promise.all([
        api.listAgents(),
        api.pagesConfig(),
        api.listWorkspaces(),
      ]);
      if (agentsRes.ok && agentsRes.data?.success) {
        setAgents(agentsRes.data.agents);
        setAccountId(agentsRes.data.account_id ?? api.accountId ?? null);
      } else {
        setError(agentAdminErrMsg(agentsRes, "Failed to load agents"));
      }
      if (cfgRes.ok && cfgRes.data?.success) {
        setPages(cfgRes.data.pages || []);
        setAssignable(cfgRes.data.assignable_pages || []);
      }
      if (wsRes.ok && wsRes.data?.success) setWorkspaces(wsRes.data.workspaces || []);
    } catch (e) {
      console.error(e);
      setError("Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Debounced live username availability check while the create dialog is open.
  useEffect(() => {
    const u = form.username.trim();
    if (!createOpen || u.length < 3 || !/^[A-Za-z0-9_.-]+$/.test(u)) {
      setUsernameCheck({ status: "idle", suggestion: null });
      return;
    }
    setUsernameCheck({ status: "checking", suggestion: null });
    const t = setTimeout(async () => {
      const res = await api.checkUsername(u);
      if (res.ok && res.data?.success) {
        setUsernameCheck(res.data.available
          ? { status: "available", suggestion: null }
          : { status: "taken", suggestion: res.data.suggestion });
      } else {
        setUsernameCheck({ status: "idle", suggestion: null });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form.username, createOpen, api]);

  const togglePage = (key: string) =>
    setForm((p) => ({ ...p, allowed_pages: p.allowed_pages.includes(key) ? p.allowed_pages.filter((k) => k !== key) : [...p.allowed_pages, key] }));
  const toggleWorkspace = (id: number) =>
    setForm((p) => ({ ...p, workspace_ids: p.workspace_ids.includes(id) ? p.workspace_ids.filter((w) => w !== id) : [...p.workspace_ids, id] }));

  const handleCreate = async () => {
    // Feedback is shown INLINE in the dialog (not just via toast) so it is
    // always visible regardless of the toast setup.
    const fail = (msg: string) => {
      setCreateError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    };
    setCreateError(null);
    if (form.username.trim().length < 3) return fail("Username must be at least 3 characters");
    if (!/^[A-Za-z0-9_.-]+$/.test(form.username.trim())) return fail("Username may contain only letters, numbers, underscore, hyphen, and dot (no spaces)");
    if (usernameCheck.status === "taken") return fail(usernameCheck.suggestion ? `That username is taken. Try "${usernameCheck.suggestion}".` : "That username is already taken — pick another.");
    if (form.password.length < 8) return fail("Password must be at least 8 characters");
    if (form.allowed_pages.length === 0) return fail("Select at least one page permission");
    if (form.workspace_ids.length === 0) return fail("Assign at least one workspace");

    setCreateLoading(true);
    try {
      const res = await api.createAgent({
        username: form.username.trim(),
        password: form.password,
        display_name: form.display_name.trim() || undefined,
        allowed_pages: form.allowed_pages,
        workspace_ids: form.workspace_ids,
      });
      if (res.ok && res.data?.success) {
        setSuccessInfo({ account_id: res.data.account_id ?? accountId ?? api.accountId ?? 0, username: form.username.trim(), password: form.password });
        setCreateOpen(false);
        setForm({ username: "", password: "", display_name: "", allowed_pages: [], workspace_ids: [] });
        fetchAll({ silent: true });
      } else {
        fail(agentAdminErrMsg(res, "Failed to create agent"));
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleStatus = async (agent: Agent) => {
    const res = await api.updateAgent(agent.id, { is_active: !agent.is_active });
    if (res.ok && res.data?.success) fetchAll({ silent: true });
    else toast({ title: "Error", description: agentAdminErrMsg(res, "Failed to update agent"), variant: "destructive" });
  };

  const handleReset = async () => {
    if (!resetAgent || newPassword.length < 8) return toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
    setResetLoading(true);
    try {
      const res = await api.resetPassword(resetAgent.id, newPassword);
      if (res.ok && res.data?.success) {
        toast({ title: "Success", description: "Password reset" });
        setResetAgent(null); setNewPassword("");
      } else {
        toast({ title: "Error", description: agentAdminErrMsg(res, "Failed to reset password"), variant: "destructive" });
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleDelete = async (agent: Agent) => {
    if (!confirm(`Delete agent "${agent.username}"? This cannot be undone.`)) return;
    const res = await api.deleteAgent(agent.id);
    if (res.ok && res.data?.success) { toast({ title: "Deleted", description: "Agent removed" }); fetchAll({ silent: true }); }
    else toast({ title: "Error", description: agentAdminErrMsg(res, "Failed to delete agent"), variant: "destructive" });
  };

  const copy = (field: string, val: string) => {
    navigator.clipboard.writeText(val); setCopied(field); setTimeout(() => setCopied(null), 2000);
  };

  const wsName = (id: number) => { const w = workspaces.find((x) => x.id === id); return w?.business_name || w?.name || `Workspace ${id}`; };
  const categories = ["General", "WhatsApp", "CRM", "Marketing"];
  const assignablePages = pages.filter((p) => !p.adminOnly && assignable.includes(p.key));

  if (loading) {
    return <Card><CardContent className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Shield className="h-6 w-6" /> Agents</h2>
          <p className="text-muted-foreground">
            Create agent logins for this account. Agents sign in with their username + password.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => fetchAll()}><RefreshCw className="h-4 w-4" /></Button>
          <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (o) setCreateError(null); }}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Create Agent</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
              <DialogHeader><DialogTitle>Create New Agent</DialogTitle><DialogDescription>Set credentials, features, and workspaces.</DialogDescription></DialogHeader>
              {createError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              )}
              <div className="flex-1 overflow-y-auto pr-2 space-y-6 py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Username *</Label>
                    <Input placeholder="agent_username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
                    {usernameCheck.status === "checking" && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Checking availability…</p>
                    )}
                    {usernameCheck.status === "available" && (
                      <p className="text-xs text-green-600 flex items-center gap-1"><Check className="h-3 w-3" /> Available</p>
                    )}
                    {usernameCheck.status === "taken" && (
                      <p className="text-xs text-destructive flex items-center gap-1 flex-wrap">
                        <XCircle className="h-3 w-3 flex-shrink-0" /> Taken.
                        {usernameCheck.suggestion && (
                          <>Try{" "}
                            <button type="button" className="underline font-medium" onClick={() => setForm((p) => ({ ...p, username: usernameCheck.suggestion! }))}>
                              {usernameCheck.suggestion}
                            </button>
                          </>
                        )}
                      </p>
                    )}
                    {usernameCheck.status === "idle" && (
                      <p className="text-xs text-muted-foreground">Letters, numbers, underscore, hyphen, dot. Must be unique across all accounts.</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input placeholder="Agent Name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Password *</Label>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Workspaces *</Label>
                  <p className="text-sm text-muted-foreground">Which of your workspaces can this agent access?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 border rounded-lg p-3 bg-muted/20">
                    {workspaces.length === 0 && <p className="text-sm text-muted-foreground">No workspaces found.</p>}
                    {workspaces.map((w) => (
                      <div key={w.id} className="flex items-center space-x-2 rounded-md border p-2 hover:bg-accent cursor-pointer" onClick={() => toggleWorkspace(w.id)}>
                        <Checkbox checked={form.workspace_ids.includes(w.id)} onCheckedChange={() => toggleWorkspace(w.id)} />
                        <span className="text-sm truncate">{w.business_name || w.name || `Workspace ${w.id}`}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <Label className="text-base font-semibold">Feature Permissions *</Label>
                  <div className="space-y-4 border rounded-lg p-3 bg-muted/20">
                    {categories.map((cat) => {
                      const inCat = assignablePages.filter((p) => p.category === cat);
                      if (inCat.length === 0) return null;
                      return (
                        <div key={cat} className="space-y-2">
                          <span className="font-medium text-sm">{cat}</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                            {inCat.map((page) => (
                              <div key={page.key} className="flex items-center space-x-2 rounded-md border p-2 hover:bg-accent cursor-pointer" onClick={() => togglePage(page.key)}>
                                <Checkbox checked={form.allowed_pages.includes(page.key)} onCheckedChange={() => togglePage(page.key)} />
                                <span className="text-sm">{page.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={createLoading}>{createLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Agent</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

      <Card>
        <CardContent className="p-0">
          {agents.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Agents Yet</h3>
              <p className="text-muted-foreground mb-4">Create your first agent to give limited access to your team.</p>
              <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Create Agent</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead><TableHead>Status</TableHead>
                  <TableHead>Features</TableHead><TableHead>Workspaces</TableHead><TableHead className="w-[70px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center"><User className="h-5 w-5 text-primary" /></div>
                        <div><p className="font-medium">{agent.display_name || agent.username}</p><p className="text-sm text-muted-foreground">{agent.username}</p></div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={agent.is_active} onCheckedChange={() => toggleStatus(agent)} />
                        <Badge variant={agent.is_active ? "default" : "secondary"}>
                          {agent.is_active ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                          {agent.is_active ? "Active" : "Disabled"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{agent.allowed_pages?.length || 0} pages</Badge></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {(agent.workspace_ids || []).slice(0, 2).map((id) => <Badge key={id} variant="outline" className="text-xs">{wsName(id)}</Badge>)}
                        {(agent.workspace_ids || []).length > 2 && <Badge variant="outline" className="text-xs">+{agent.workspace_ids.length - 2}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setInboxAgent(agent)}><Inbox className="h-4 w-4 mr-2" /> Inbox Access</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setResetAgent(agent); setNewPassword(""); }}><KeyRound className="h-4 w-4 mr-2" /> Reset Password</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(agent)} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete Agent</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Inbox access (scope, auto-assign, number assignment) */}
      {inboxAgent && (
        <AgentInboxAccess
          api={api}
          agent={inboxAgent}
          workspaces={workspaces}
          open
          onOpenChange={(o) => { if (!o) setInboxAgent(null); }}
        />
      )}

      {/* Reset password */}
      <Dialog open={!!resetAgent} onOpenChange={(o) => !o && setResetAgent(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Password</DialogTitle><DialogDescription>New password for "{resetAgent?.username}".</DialogDescription></DialogHeader>
          <div className="space-y-2 py-4">
            <Label>New Password</Label>
            <Input type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetAgent(null)}>Cancel</Button>
            <Button onClick={handleReset} disabled={resetLoading}>{resetLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created success — show credentials once */}
      <Dialog open={!!successInfo} onOpenChange={(o) => !o && setSuccessInfo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-500" /> Agent Created</DialogTitle>
            <DialogDescription>Save these — the password won't be shown again.</DialogDescription>
          </DialogHeader>
          {successInfo && (
            <div className="space-y-4 py-2">
              <Alert className="bg-amber-50 border-amber-200"><AlertCircle className="h-4 w-4 text-amber-600" /><AlertDescription className="text-amber-800">The agent logs in at <code>/agent-login</code> with these.</AlertDescription></Alert>
              {[
                { k: "username", label: "Username", val: successInfo.username },
                { k: "password", label: "Password", val: successInfo.password },
              ].map(({ k, label, val }) => (
                <div key={k} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-3 py-2 rounded-md font-mono text-sm break-all">{val}</code>
                    <Button variant="outline" size="icon" onClick={() => copy(k, val)}>{copied === k ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter><Button onClick={() => setSuccessInfo(null)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AgentsManager;
