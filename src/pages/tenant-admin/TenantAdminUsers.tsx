// src/pages/tenant-admin/TenantAdminUsers.tsx
// Tenant Admin user management: a responsive users table with create / edit /
// reset-password / delete actions. Generated passwords (on create or reset) are
// surfaced once in a copyable callout dialog. Mirrors the superadmin pages'
// emerald/slate styling and toast-driven feedback.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users as UsersIcon,
    Plus,
    Pencil,
    KeyRound,
    Trash2,
    RefreshCw,
    Copy,
    Check,
    Search,
    LogIn,
    Loader2,
    CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { useBranding } from '@/branding/BrandingContext';
import type { TenantBranding } from '@/branding/branding';
import {
    tenantAdminApi,
    type TenantUser,
    type TenantUserRole,
    type FeatureCatalogItem,
    type TenantCustomPlan,
} from './tenantAdminApi';

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'default';
    if (s === 'suspended') return 'destructive';
    return 'secondary';
}

function roleLabel(role: string): string {
    if (role === 'tenant_admin') return 'Admin';
    if (role === 'admin') return 'Platform Admin';
    return 'User';
}

function formatDate(d?: string | null): string {
    if (!d) return '—';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** A copyable readonly field used for showing generated passwords once. */
function CopyableValue({ value }: { value: string }) {
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast({
                title: 'Copy failed',
                description: 'Select the text and copy it manually.',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2">
            <code className="flex-1 break-all font-mono text-sm text-emerald-900">{value}</code>
            <Button type="button" size="sm" variant="outline" className="shrink-0" onClick={copy}>
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
        </div>
    );
}

export default function TenantAdminUsers() {
    const { toast } = useToast();
    const navigate = useNavigate();
    const { setBranding } = useBranding();

    const [users, setUsers] = useState<TenantUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [busyId, setBusyId] = useState<string | number | null>(null);
    // Per-row spinner for the "Login as / Impersonate" action.
    const [impersonatingId, setImpersonatingId] = useState<string | number | null>(null);

    // Create dialog state
    const [createOpen, setCreateOpen] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createEmail, setCreateEmail] = useState('');
    const [createPassword, setCreatePassword] = useState('');
    const [createRole, setCreateRole] = useState<TenantUserRole>('user');
    const [creating, setCreating] = useState(false);

    // Edit dialog state
    const [editTarget, setEditTarget] = useState<TenantUser | null>(null);
    const [editName, setEditName] = useState('');
    const [editActive, setEditActive] = useState(true);
    const [editRole, setEditRole] = useState<TenantUserRole>('user');
    const [saving, setSaving] = useState(false);

    // Delete confirm state
    const [deleteTarget, setDeleteTarget] = useState<TenantUser | null>(null);

    // Generated-password callout (create or reset)
    const [generated, setGenerated] = useState<{ title: string; user: string; password: string } | null>(null);

    /* ----------------- Subscription & features (per user) ---------------- */
    // Fetched once on mount and cached for every per-user dialog.
    const [featureCatalog, setFeatureCatalog] = useState<FeatureCatalogItem[]>([]);
    const [customPlans, setCustomPlans] = useState<TenantCustomPlan[]>([]);
    const [basePlans, setBasePlans] = useState<{ slug: string; name: string }[]>([]);

    // The user whose "Manage subscription & features" dialog is open.
    const [manageTarget, setManageTarget] = useState<TenantUser | null>(null);
    const [manageLoading, setManageLoading] = useState(false);
    // Subscription
    const [managePlan, setManagePlan] = useState<string>('');
    const [savingPlan, setSavingPlan] = useState(false);
    // Features: only access-type feature keys + their effective on/off state.
    const [featureState, setFeatureState] = useState<Record<string, boolean>>({});
    const [savingFeatures, setSavingFeatures] = useState(false);

    // Access-type features only (limit-type features are configured elsewhere).
    const accessFeatures = useMemo(
        () => featureCatalog.filter((f) => f.feature_type !== 'limit'),
        [featureCatalog],
    );

    const load = async () => {
        setLoading(true);
        try {
            const res = await tenantAdminApi.listUsers();
            setUsers(Array.isArray(res.users) ? res.users : []);
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to load users',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch the feature catalog + assignable plans once. Failures are
    // non-fatal: the manage dialog simply shows whatever loaded.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [cat, plans] = await Promise.all([
                    tenantAdminApi.featuresCatalog(),
                    tenantAdminApi.listPlans(),
                ]);
                if (cancelled) return;
                setFeatureCatalog(Array.isArray(cat.features) ? cat.features : []);
                setCustomPlans(Array.isArray(plans.custom_plans) ? plans.custom_plans : []);
                setBasePlans(Array.isArray(plans.base_plans) ? plans.base_plans : []);
            } catch (err) {
                if (cancelled) return;
                toast({
                    title: 'Could not load plans/features',
                    description: err instanceof Error ? err.message : 'Request failed',
                    variant: 'destructive',
                });
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return users;
        return users.filter(
            (u) =>
                u.name?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q) ||
                (u.business_name || '').toLowerCase().includes(q),
        );
    }, [users, search]);

    /* ------------------------------ Create ------------------------------- */

    const resetCreateForm = () => {
        setCreateName('');
        setCreateEmail('');
        setCreatePassword('');
        setCreateRole('user');
    };

    const submitCreate = async () => {
        if (!createName.trim() || !createEmail.trim()) {
            toast({ title: 'Name and email are required', variant: 'destructive' });
            return;
        }
        setCreating(true);
        try {
            const res = await tenantAdminApi.createUser({
                name: createName.trim(),
                email: createEmail.trim(),
                password: createPassword.trim() || undefined,
                role: createRole,
            });
            toast({ title: 'User created', description: res.user?.email });
            setCreateOpen(false);
            resetCreateForm();
            if (res.generated_password) {
                setGenerated({
                    title: 'User created',
                    user: res.user?.email || createEmail.trim(),
                    password: res.generated_password,
                });
            }
            await load();
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to create user',
                variant: 'destructive',
            });
        } finally {
            setCreating(false);
        }
    };

    /* ------------------------------- Edit -------------------------------- */

    const openEdit = (u: TenantUser) => {
        setEditTarget(u);
        setEditName(u.name || '');
        setEditActive((u.status || '').toLowerCase() !== 'suspended');
        setEditRole(u.role === 'tenant_admin' ? 'tenant_admin' : 'user');
    };

    const submitEdit = async () => {
        if (!editTarget) return;
        setSaving(true);
        try {
            const res = await tenantAdminApi.updateUser(editTarget.id, {
                name: editName.trim() || undefined,
                status: editActive ? 'active' : 'suspended',
                role: editRole,
            });
            toast({ title: 'User updated', description: res.user?.email });
            setEditTarget(null);
            await load();
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to update user',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    /* -------------------------- Reset password --------------------------- */

    const resetPassword = async (u: TenantUser) => {
        setBusyId(u.id);
        try {
            const res = await tenantAdminApi.resetPassword(u.id);
            setGenerated({
                title: 'Password reset',
                user: u.email,
                password: res.password,
            });
            toast({ title: 'Password reset', description: u.email });
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to reset password',
                variant: 'destructive',
            });
        } finally {
            setBusyId(null);
        }
    };

    /* -------------------------- Impersonate ------------------------------ */

    // The tenant-admin's "Inspect Login": become the selected user. Persist the
    // impersonated session, re-theme the app with the tenant's branding, and
    // drop the admin into the regular dashboard.
    const impersonate = async (u: TenantUser) => {
        setImpersonatingId(u.id);
        try {
            const res = await tenantAdminApi.impersonateUser(u.id);
            try {
                localStorage.setItem('sv_user', JSON.stringify(res.user));
                sessionStorage.setItem('sv_user', JSON.stringify(res.user));
                localStorage.setItem('sv_user_id', String(res.user.id));
                if (res.tenant?.tenant_code) {
                    localStorage.setItem('sv_tenant_code', res.tenant.tenant_code);
                }
                if (res.workspaces?.[0]) {
                    localStorage.setItem(
                        'sv_whatsapp_workspace_id',
                        String(res.workspaces[0].id),
                    );
                }
            } catch {
                // storage may be unavailable — branding + navigation still apply
            }
            if (res.tenant?.branding) {
                setBranding(
                    res.tenant.branding as unknown as TenantBranding,
                    res.tenant.tenant_code,
                );
            }
            toast({ title: 'Logged in as', description: res.user?.email });
            navigate('/dashboard');
        } catch (err) {
            toast({
                title: 'Could not log in as user',
                description: err instanceof Error ? err.message : 'Impersonation failed',
                variant: 'destructive',
            });
            setImpersonatingId(null);
        }
    };

    /* ------------------- Subscription & features (per user) -------------- */

    const openManage = async (u: TenantUser) => {
        setManageTarget(u);
        setManageLoading(true);
        setManagePlan('');
        setFeatureState({});
        try {
            const res = await tenantAdminApi.getUserFeatures(u.id);
            setManagePlan(res.plan || '');
            // Seed each access feature from the user's effective features map.
            const next: Record<string, boolean> = {};
            for (const f of accessFeatures) {
                next[f.key] = !!res.features?.[f.key];
            }
            setFeatureState(next);
        } catch (err) {
            toast({
                title: 'Could not load user features',
                description: err instanceof Error ? err.message : 'Request failed',
                variant: 'destructive',
            });
        } finally {
            setManageLoading(false);
        }
    };

    const saveUserPlan = async () => {
        if (!manageTarget || !managePlan) return;
        setSavingPlan(true);
        try {
            await tenantAdminApi.setUserPlan(manageTarget.id, managePlan);
            toast({ title: 'Plan updated', description: manageTarget.email });
            await load();
        } catch (err) {
            toast({
                title: 'Could not update plan',
                description: err instanceof Error ? err.message : 'Request failed',
                variant: 'destructive',
            });
        } finally {
            setSavingPlan(false);
        }
    };

    const saveUserFeatures = async () => {
        if (!manageTarget) return;
        setSavingFeatures(true);
        try {
            // Send only the access features (limit-type features are excluded).
            const overrides: Record<string, boolean> = {};
            for (const f of accessFeatures) {
                overrides[f.key] = !!featureState[f.key];
            }
            await tenantAdminApi.setUserFeatures(manageTarget.id, overrides);
            toast({ title: 'Features updated', description: manageTarget.email });
        } catch (err) {
            toast({
                title: 'Could not update features',
                description: err instanceof Error ? err.message : 'Request failed',
                variant: 'destructive',
            });
        } finally {
            setSavingFeatures(false);
        }
    };

    /* ------------------------------ Delete ------------------------------- */

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const u = deleteTarget;
        setBusyId(u.id);
        try {
            await tenantAdminApi.deleteUser(u.id);
            toast({ title: 'User deleted', description: u.email });
            setUsers((prev) => prev.filter((x) => x.id !== u.id));
        } catch (err) {
            // Backend blocks deleting self / the last admin — surface its message.
            toast({
                title: 'Could not delete user',
                description: err instanceof Error ? err.message : 'Delete failed',
                variant: 'destructive',
            });
        } finally {
            setBusyId(null);
            setDeleteTarget(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <UsersIcon className="h-6 w-6 text-emerald-600" /> Users
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Invite teammates and manage their access.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={load} disabled={loading}>
                        <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                        Refresh
                    </Button>
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4" /> Create User
                    </Button>
                </div>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                    className="pl-10"
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Members ({filtered.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="text-sm text-muted-foreground py-6">Loading users…</p>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center">
                            <UsersIcon className="mx-auto h-10 w-10 text-slate-300" />
                            <p className="mt-3 text-sm text-muted-foreground">
                                {search ? 'No users match your search.' : 'No users yet.'}
                            </p>
                            {!search && (
                                <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                                    <Plus className="h-4 w-4" /> Create your first user
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((u) => {
                                        const impersonating = impersonatingId === u.id;
                                        const busy = busyId === u.id || impersonating;
                                        return (
                                            <TableRow key={u.id}>
                                                <TableCell className="font-medium">{u.name || '—'}</TableCell>
                                                <TableCell className="text-muted-foreground break-all">
                                                    {u.email}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline">{roleLabel(u.role)}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={statusVariant(u.status)} className="capitalize">
                                                        {u.status || 'unknown'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground whitespace-nowrap">
                                                    {formatDate(u.created_at)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap items-center justify-end gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            title="Edit"
                                                            disabled={busy}
                                                            onClick={() => openEdit(u)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            title="Manage subscription & features"
                                                            disabled={busy}
                                                            onClick={() => openManage(u)}
                                                        >
                                                            <CreditCard className="h-4 w-4 text-emerald-600" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            title="Reset password"
                                                            disabled={busy}
                                                            onClick={() => resetPassword(u)}
                                                        >
                                                            <KeyRound className="h-4 w-4 text-amber-600" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            title="Login as / Impersonate"
                                                            disabled={busy}
                                                            onClick={() => impersonate(u)}
                                                        >
                                                            {impersonating ? (
                                                                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                                                            ) : (
                                                                <LogIn className="h-4 w-4 text-emerald-600" />
                                                            )}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            title="Delete"
                                                            disabled={busy}
                                                            onClick={() => setDeleteTarget(u)}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create user dialog */}
            <Dialog
                open={createOpen}
                onOpenChange={(o) => {
                    setCreateOpen(o);
                    if (!o) resetCreateForm();
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create user</DialogTitle>
                        <DialogDescription>
                            Add a teammate to your workspace.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="create-name">Name</Label>
                            <Input
                                id="create-name"
                                value={createName}
                                onChange={(e) => setCreateName(e.target.value)}
                                placeholder="Jane Doe"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-email">Email</Label>
                            <Input
                                id="create-email"
                                type="email"
                                value={createEmail}
                                onChange={(e) => setCreateEmail(e.target.value)}
                                placeholder="jane@company.com"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-password">Password</Label>
                            <Input
                                id="create-password"
                                type="text"
                                value={createPassword}
                                onChange={(e) => setCreatePassword(e.target.value)}
                                placeholder="Leave blank to auto-generate"
                            />
                            <p className="text-xs text-muted-foreground">
                                Leave blank and a secure password will be generated and shown once.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Select value={createRole} onValueChange={(v) => setCreateRole(v as TenantUserRole)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="tenant_admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                            Cancel
                        </Button>
                        <Button onClick={submitCreate} disabled={creating}>
                            {creating ? 'Creating…' : 'Create user'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit user dialog */}
            <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit user</DialogTitle>
                        <DialogDescription className="break-all">{editTarget?.email}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Name</Label>
                            <Input
                                id="edit-name"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Select value={editRole} onValueChange={(v) => setEditRole(v as TenantUserRole)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="tenant_admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center justify-between rounded-md border p-3">
                            <div>
                                <Label htmlFor="edit-active" className="text-sm font-medium">
                                    Active
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    {editActive ? 'User can sign in.' : 'User is suspended.'}
                                </p>
                            </div>
                            <Switch id="edit-active" checked={editActive} onCheckedChange={setEditActive} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditTarget(null)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={submitEdit} disabled={saving}>
                            {saving ? 'Saving…' : 'Save changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manage subscription & features dialog */}
            <Dialog
                open={!!manageTarget}
                onOpenChange={(o) => {
                    if (!o) {
                        setManageTarget(null);
                        setManagePlan('');
                        setFeatureState({});
                    }
                }}
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Manage subscription &amp; features</DialogTitle>
                        <DialogDescription className="break-all">
                            {manageTarget?.name || manageTarget?.email}
                        </DialogDescription>
                    </DialogHeader>

                    {manageLoading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Subscription */}
                            <div className="space-y-2 rounded-md border p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <Label className="text-sm font-semibold">Subscription</Label>
                                    {managePlan && (
                                        <Badge variant="outline" className="font-mono text-xs">
                                            {managePlan}
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Assign a base or custom plan to this user.
                                </p>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <Select value={managePlan} onValueChange={setManagePlan}>
                                        <SelectTrigger className="sm:flex-1">
                                            <SelectValue placeholder="Select a plan" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {basePlans.map((p) => (
                                                <SelectItem key={`base-${p.slug}`} value={p.slug}>
                                                    {p.name}
                                                </SelectItem>
                                            ))}
                                            {customPlans.map((p) => (
                                                <SelectItem key={`custom-${p.slug}`} value={p.slug}>
                                                    {p.name} (custom)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        onClick={saveUserPlan}
                                        disabled={savingPlan || !managePlan}
                                        className="shrink-0"
                                    >
                                        {savingPlan ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                                            </>
                                        ) : (
                                            'Save plan'
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="space-y-3 rounded-md border p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <Label className="text-sm font-semibold">Features</Label>
                                    <Button
                                        size="sm"
                                        onClick={saveUserFeatures}
                                        disabled={savingFeatures}
                                        className="shrink-0"
                                    >
                                        {savingFeatures ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                                            </>
                                        ) : (
                                            'Save features'
                                        )}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Toggle access for this user. Overrides the user's plan.
                                </p>
                                {accessFeatures.length === 0 ? (
                                    <p className="py-4 text-sm text-muted-foreground">
                                        No access features available.
                                    </p>
                                ) : (
                                    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                                        {accessFeatures.map((f) => (
                                            <div
                                                key={f.key}
                                                className="flex items-center justify-between gap-3 rounded-md border p-3"
                                            >
                                                <div className="min-w-0">
                                                    <Label
                                                        htmlFor={`feat-${f.key}`}
                                                        className="text-sm font-medium"
                                                    >
                                                        {f.label}
                                                    </Label>
                                                    {f.category && (
                                                        <p className="text-xs capitalize text-muted-foreground">
                                                            {f.category}
                                                        </p>
                                                    )}
                                                </div>
                                                <Switch
                                                    id={`feat-${f.key}`}
                                                    checked={!!featureState[f.key]}
                                                    onCheckedChange={(checked) =>
                                                        setFeatureState((prev) => ({
                                                            ...prev,
                                                            [f.key]: checked,
                                                        }))
                                                    }
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setManageTarget(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirm */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete user?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove <strong>{deleteTarget?.name || deleteTarget?.email}</strong>.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={confirmDelete}
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Generated password callout (shown once) */}
            <Dialog open={!!generated} onOpenChange={(o) => !o && setGenerated(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{generated?.title}</DialogTitle>
                        <DialogDescription>
                            Copy this password now — it won't be shown again.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">User</Label>
                            <p className="break-all text-sm font-medium">{generated?.user}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Password</Label>
                            {generated && <CopyableValue value={generated.password} />}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setGenerated(null)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
