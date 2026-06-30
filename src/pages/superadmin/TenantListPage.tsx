// src/pages/superadmin/TenantListPage.tsx
// Super Admin "Tenant Management" — lists every tenant with row actions:
// View/Edit, Suspend/Activate, Impersonate, Delete (confirmed).
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Plus,
    Pencil,
    LogIn,
    Trash2,
    PauseCircle,
    PlayCircle,
    Building2,
    RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { superAdminApi, type TenantListItem } from '@/components/superadmin/useSuperAdminApi';
import { getExpiryStatus, EXPIRY_TONE_CLASS } from '@/components/superadmin/subscriptionDisplay';

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'default';
    if (s === 'suspended') return 'destructive';
    return 'secondary';
}

function formatDate(d?: string | null): string {
    if (!d) return '—';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function TenantListPage() {
    const navigate = useNavigate();
    const { toast } = useToast();

    const [tenants, setTenants] = useState<TenantListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [busyId, setBusyId] = useState<string | number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<TenantListItem | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const data = await superAdminApi.listTenants();
            setTenants(Array.isArray(data.tenants) ? data.tenants : []);
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to load tenants',
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

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return tenants;
        return tenants.filter(
            (t) =>
                t.company_name?.toLowerCase().includes(q) ||
                t.tenant_code?.toLowerCase().includes(q) ||
                (t.custom_domain || '').toLowerCase().includes(q),
        );
    }, [tenants, search]);

    const toggleStatus = async (t: TenantListItem) => {
        const suspend = (t.status || '').toLowerCase() === 'active';
        setBusyId(t.id);
        try {
            if (suspend) await superAdminApi.suspendTenant(t.id);
            else await superAdminApi.activateTenant(t.id);
            toast({ title: suspend ? 'Tenant suspended' : 'Tenant activated' });
            setTenants((prev) =>
                prev.map((x) => (x.id === t.id ? { ...x, status: suspend ? 'suspended' : 'active' } : x)),
            );
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Action failed',
                variant: 'destructive',
            });
        } finally {
            setBusyId(null);
        }
    };

    const impersonate = async (t: TenantListItem) => {
        setBusyId(t.id);
        try {
            const res = await superAdminApi.impersonate(t.id);
            if (res.success) {
                if (res.user?.id) localStorage.setItem('sv_user_id', String(res.user.id));
                if (res.workspaces?.[0]?.id) {
                    localStorage.setItem('sv_whatsapp_workspace_id', String(res.workspaces[0].id));
                }
                toast({ title: 'Impersonating', description: `Entered ${t.company_name}` });
                navigate('/dashboard');
            }
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Impersonation failed',
                variant: 'destructive',
            });
        } finally {
            setBusyId(null);
        }
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        const t = deleteTarget;
        setBusyId(t.id);
        try {
            await superAdminApi.deleteTenant(t.id);
            toast({ title: 'Tenant deleted', description: t.company_name });
            setTenants((prev) => prev.filter((x) => x.id !== t.id));
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Delete failed',
                variant: 'destructive',
            });
        } finally {
            setBusyId(null);
            setDeleteTarget(null);
        }
    };

    return (
        <div className="w-full min-w-0 space-y-6">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-emerald-600" /> Tenant Management
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Create, configure, and manage white-label tenants.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={load} disabled={loading}>
                        <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                        Refresh
                    </Button>
                    <Button onClick={() => navigate('/superadmin/tenants/new')}>
                        <Plus className="h-4 w-4" /> Create Tenant
                    </Button>
                </div>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                    className="pl-10"
                    placeholder="Search by company, code, or domain..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <Card className="min-w-0">
                <CardHeader>
                    <CardTitle>Tenants ({filtered.length})</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                    {loading ? (
                        <p className="text-sm text-muted-foreground py-6">Loading tenants…</p>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center">
                            <Building2 className="mx-auto h-10 w-10 text-slate-300" />
                            <p className="mt-3 text-sm text-muted-foreground">
                                {search ? 'No tenants match your search.' : 'No tenants yet.'}
                            </p>
                            {!search && (
                                <Button className="mt-4" onClick={() => navigate('/superadmin/tenants/new')}>
                                    <Plus className="h-4 w-4" /> Create your first tenant
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Plan</TableHead>
                                    <TableHead>Subscription expiry</TableHead>
                                    <TableHead>Custom domain</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((t) => {
                                    const isActive = (t.status || '').toLowerCase() === 'active';
                                    const busy = busyId === t.id;
                                    const exp = getExpiryStatus(t.subscription_expires_at);
                                    return (
                                        <TableRow key={t.id}>
                                            <TableCell className="font-mono text-xs">{t.tenant_code}</TableCell>
                                            <TableCell className="font-medium">{t.company_name}</TableCell>
                                            <TableCell>
                                                <Badge variant={statusVariant(t.status)} className="capitalize">
                                                    {t.status || 'unknown'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="capitalize">{t.subscription_plan || '—'}</TableCell>
                                            <TableCell className="whitespace-nowrap">
                                                {exp.tone === 'none' ? (
                                                    <span className="text-muted-foreground">Never</span>
                                                ) : (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-xs text-slate-600">{exp.expiresOn}</span>
                                                        <Badge className={cn('w-fit font-normal', EXPIRY_TONE_CLASS[exp.tone])}>
                                                            {exp.label}
                                                        </Badge>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {t.custom_domain || '—'}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground whitespace-nowrap">
                                                {formatDate(t.created_at)}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap items-center justify-end gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        title="View / Edit"
                                                        onClick={() => navigate(`/superadmin/tenants/${t.id}`)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        title={isActive ? 'Suspend' : 'Activate'}
                                                        disabled={busy}
                                                        onClick={() => toggleStatus(t)}
                                                    >
                                                        {isActive ? (
                                                            <PauseCircle className="h-4 w-4 text-amber-600" />
                                                        ) : (
                                                            <PlayCircle className="h-4 w-4 text-emerald-600" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        title="Impersonate"
                                                        disabled={busy}
                                                        onClick={() => impersonate(t)}
                                                    >
                                                        <LogIn className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        title="Delete"
                                                        disabled={busy}
                                                        onClick={() => setDeleteTarget(t)}
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
          </div>

            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete tenant?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove <strong>{deleteTarget?.company_name}</strong> (
                            {deleteTarget?.tenant_code}) and all of its data. This action cannot be undone.
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
        </div>
    );
}
