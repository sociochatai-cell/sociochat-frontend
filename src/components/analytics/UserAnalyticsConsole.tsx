// src/components/analytics/UserAnalyticsConsole.tsx
// Reusable "User Analytics Console" — a KPI summary + a filterable users table
// with per-row Delete / Unlink / Impersonate actions. Data-source agnostic: the
// host page supplies fetchAnalytics + the action callbacks, so the SAME UI backs
// both the super-admin (T0000) and tenant-admin portals. Styling mirrors the
// existing admin/tenant pages (emerald/slate, Card, Table, Badge).
import { useEffect, useMemo, useState } from 'react';
import {
    Users as UsersIcon,
    Search,
    RefreshCw,
    Trash2,
    Unlink,
    LogIn,
    Loader2,
    Check,
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
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
import type {
    AnalyticsResponse,
    AnalyticsRow,
    AnalyticsSummary,
    SubStatus,
} from '@/pages/tenant-admin/tenantAdminApi';

export type { AnalyticsResponse, AnalyticsRow, AnalyticsSummary, SubStatus };

type StatusFilter =
    | 'all'
    | 'paid'
    | 'free'
    | 'expiring'
    | 'expired'
    | 'meta'
    | 'inactive';

export interface UserAnalyticsConsoleProps {
    /** Loads the summary + rows from the appropriate (admin / tenant) endpoint. */
    fetchAnalytics: () => Promise<{ summary: AnalyticsSummary; rows: AnalyticsRow[] }>;
    /** Delete a user with the admin's own password. */
    onDelete: (id: number, password: string) => Promise<{ ok: boolean; error?: string }>;
    /** Optional — unlink from Sociovia (super-admin only). Omit to hide the button. */
    onUnlink?: (id: number) => Promise<unknown>;
    /** Optional — impersonate the user. Omit to hide the button. */
    onImpersonate?: (id: number) => Promise<unknown>;
    title?: string;
    subtitle?: string;
}

function formatDate(d?: string | null): string {
    if (!d) return '—';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** "in 20d" / "12d overdue" / "today" from a signed day count. */
function expiryHint(days?: number | null): string {
    if (days == null) return '';
    if (days === 0) return 'today';
    if (days < 0) return `${Math.abs(days)}d overdue`;
    return `in ${days}d`;
}

const SUB_BADGE: Record<SubStatus, string> = {
    free: 'bg-slate-100 text-slate-700 border-slate-200',
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    expiring: 'bg-amber-100 text-amber-800 border-amber-200',
    expired: 'bg-red-100 text-red-700 border-red-200',
};

const SUB_LABEL: Record<SubStatus, string> = {
    free: 'Free',
    active: 'Active',
    expiring: 'Expiring',
    expired: 'Expired',
};

function KpiCard({
    label,
    value,
    hint,
    accent,
}: {
    label: string;
    value: string | number;
    hint?: string;
    accent?: string;
}) {
    return (
        <Card>
            <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {label}
                </p>
                <p className={cn('mt-1 text-2xl font-bold', accent)}>{value}</p>
                {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
            </CardContent>
        </Card>
    );
}

export default function UserAnalyticsConsole({
    fetchAnalytics,
    onDelete,
    onUnlink,
    onImpersonate,
    title = 'User Analytics',
    subtitle = 'Subscriptions, Meta connections, and account health at a glance.',
}: UserAnalyticsConsoleProps) {
    const { toast } = useToast();

    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [rows, setRows] = useState<AnalyticsRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [busyId, setBusyId] = useState<number | null>(null);

    // Delete confirm state
    const [deleteTarget, setDeleteTarget] = useState<AnalyticsRow | null>(null);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleting, setDeleting] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const data = await fetchAnalytics();
            setSummary(data.summary ?? null);
            setRows(Array.isArray(data.rows) ? data.rows : []);
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to load analytics',
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
        return rows.filter((r) => {
            if (q) {
                const hit =
                    r.name?.toLowerCase().includes(q) || r.email?.toLowerCase().includes(q);
                if (!hit) return false;
            }
            switch (statusFilter) {
                case 'paid':
                    return r.sub_status !== 'free';
                case 'free':
                    return r.sub_status === 'free';
                case 'expiring':
                    return r.sub_status === 'expiring';
                case 'expired':
                    return r.sub_status === 'expired';
                case 'meta':
                    return !!r.meta_connected;
                case 'inactive':
                    return !!r.is_dead;
                default:
                    return true;
            }
        });
    }, [rows, search, statusFilter]);

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        if (!deletePassword.trim()) {
            toast({ title: 'Enter your password to confirm', variant: 'destructive' });
            return;
        }
        setDeleting(true);
        try {
            const res = await onDelete(deleteTarget.id, deletePassword);
            if (res.ok) {
                toast({ title: 'User deleted', description: deleteTarget.email });
                setDeleteTarget(null);
                setDeletePassword('');
                await load();
            } else {
                toast({
                    title: 'Could not delete user',
                    description:
                        res.error === 'invalid_password'
                            ? 'The password you entered is incorrect.'
                            : res.error || 'Delete failed',
                    variant: 'destructive',
                });
            }
        } finally {
            setDeleting(false);
        }
    };

    const handleUnlink = async (r: AnalyticsRow) => {
        if (!onUnlink) return;
        setBusyId(r.id);
        try {
            await onUnlink(r.id);
            toast({ title: 'Unlinked', description: `${r.email} unlinked from Sociovia.` });
            await load();
        } catch (err) {
            toast({
                title: 'Unlink failed',
                description: err instanceof Error ? err.message : 'Request failed',
                variant: 'destructive',
            });
        } finally {
            setBusyId(null);
        }
    };

    const handleImpersonate = async (r: AnalyticsRow) => {
        if (!onImpersonate) return;
        setBusyId(r.id);
        try {
            await onImpersonate(r.id);
            // The host callback typically navigates away on success.
        } catch (err) {
            toast({
                title: 'Could not log in as user',
                description: err instanceof Error ? err.message : 'Impersonation failed',
                variant: 'destructive',
            });
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <UsersIcon className="h-6 w-6 text-emerald-600" /> {title}
                    </h1>
                    <p className="text-muted-foreground text-sm">{subtitle}</p>
                </div>
                <Button variant="outline" onClick={load} disabled={loading}>
                    <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                    Refresh
                </Button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <KpiCard label="Total users" value={summary?.total_users ?? '—'} />
                <KpiCard
                    label="Paid vs Free"
                    value={`${summary?.paid_users ?? 0} / ${summary?.free_users ?? 0}`}
                    hint="paid / free"
                    accent="text-emerald-600"
                />
                <KpiCard
                    label="Active subs"
                    value={summary?.active_subscriptions ?? '—'}
                    accent="text-emerald-600"
                />
                <KpiCard
                    label="Expiring soon"
                    value={summary?.expiring_soon ?? '—'}
                    hint="at-risk (≤7d)"
                    accent="text-amber-600"
                />
                <KpiCard
                    label="Expired"
                    value={summary?.expired ?? '—'}
                    accent="text-red-600"
                />
                <KpiCard label="Meta-connected" value={summary?.meta_connected ?? '—'} />
                <KpiCard label="Auto-renew on" value={summary?.auto_renew ?? '—'} />
                <KpiCard label="New (30d)" value={summary?.new_last_30d ?? '—'} />
                <KpiCard
                    label="Inactive / Dead"
                    value={summary?.inactive_dead ?? '—'}
                    accent="text-red-600"
                />
            </div>

            {/* Plan mix */}
            {summary && Object.keys(summary.plan_mix || {}).length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Plan mix</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(() => {
                            const entries = Object.entries(summary.plan_mix);
                            const max = Math.max(...entries.map(([, c]) => c), 1);
                            return (
                                <div className="space-y-2">
                                    {entries.map(([slug, count]) => (
                                        <div key={slug} className="flex items-center gap-3">
                                            <span className="w-28 shrink-0 truncate text-sm font-medium capitalize">
                                                {slug}
                                            </span>
                                            <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                                                <div
                                                    className="h-full rounded bg-emerald-500"
                                                    style={{ width: `${(count / max) * 100}%` }}
                                                />
                                            </div>
                                            <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                                                {count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>
            )}

            {/* Search + status filter */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                        className="pl-10"
                        placeholder="Search by name or email…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger className="w-44">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="free">Free</SelectItem>
                        <SelectItem value="expiring">Expiring</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="meta">Meta-connected</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Users table */}
            <Card>
                <CardHeader>
                    <CardTitle>Users ({filtered.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <p className="py-6 text-sm text-muted-foreground">Loading users…</p>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center">
                            <UsersIcon className="mx-auto h-10 w-10 text-slate-300" />
                            <p className="mt-3 text-sm text-muted-foreground">
                                {search || statusFilter !== 'all'
                                    ? 'No users match your filters.'
                                    : 'No users yet.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name / email</TableHead>
                                        <TableHead>Plan</TableHead>
                                        <TableHead>Subscription</TableHead>
                                        <TableHead>Expiry</TableHead>
                                        <TableHead>Meta</TableHead>
                                        <TableHead>Auto-renew</TableHead>
                                        <TableHead>Joined</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((r) => {
                                        const busy = busyId === r.id;
                                        return (
                                            <TableRow key={r.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <div className="min-w-0">
                                                            <p className="font-medium">
                                                                {r.name || '—'}
                                                            </p>
                                                            <p className="break-all text-xs text-muted-foreground">
                                                                {r.email}
                                                            </p>
                                                        </div>
                                                        {r.is_dead && (
                                                            <Badge className="shrink-0 border-red-200 bg-red-100 text-red-700">
                                                                Inactive
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="capitalize">
                                                        {r.plan || '—'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <span
                                                        className={cn(
                                                            'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
                                                            SUB_BADGE[r.sub_status] ?? SUB_BADGE.free,
                                                        )}
                                                    >
                                                        {SUB_LABEL[r.sub_status] ?? r.sub_status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {r.sub_status === 'free' ? (
                                                        <span className="text-muted-foreground">—</span>
                                                    ) : (
                                                        <div>
                                                            <p className="text-sm">
                                                                {formatDate(r.subscription_expires_at)}
                                                            </p>
                                                            <p
                                                                className={cn(
                                                                    'text-xs',
                                                                    (r.days_to_expiry ?? 0) < 0
                                                                        ? 'text-red-600'
                                                                        : (r.days_to_expiry ?? 99) <= 7
                                                                          ? 'text-amber-600'
                                                                          : 'text-muted-foreground',
                                                                )}
                                                            >
                                                                {expiryHint(r.days_to_expiry)}
                                                            </p>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {r.meta_connected ? (
                                                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                                                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                                            Connected
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {r.auto_renew ? (
                                                        <Check className="h-4 w-4 text-emerald-600" />
                                                    ) : (
                                                        <span className="text-muted-foreground">—</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-muted-foreground">
                                                    {formatDate(r.created_at)}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap items-center justify-end gap-1">
                                                        {onImpersonate && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                title="Impersonate"
                                                                disabled={busy}
                                                                onClick={() => handleImpersonate(r)}
                                                            >
                                                                {busy ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <LogIn className="h-4 w-4 text-emerald-600" />
                                                                )}
                                                            </Button>
                                                        )}
                                                        {onUnlink && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                title="Unlink from Sociovia"
                                                                disabled={busy}
                                                                onClick={() => handleUnlink(r)}
                                                            >
                                                                <Unlink className="h-4 w-4 text-amber-600" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            title="Delete user"
                                                            disabled={busy}
                                                            onClick={() => setDeleteTarget(r)}
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

            {/* Delete confirm — requires the admin's password */}
            <AlertDialog
                open={!!deleteTarget}
                onOpenChange={(o) => {
                    if (!o) {
                        setDeleteTarget(null);
                        setDeletePassword('');
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete user?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove{' '}
                            <strong>{deleteTarget?.name || deleteTarget?.email}</strong>. This action
                            cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2 py-1">
                        <Label htmlFor="delete-confirm-password">
                            Enter your password to confirm
                        </Label>
                        <Input
                            id="delete-confirm-password"
                            type="password"
                            autoComplete="current-password"
                            value={deletePassword}
                            onChange={(e) => setDeletePassword(e.target.value)}
                            placeholder="Your account password"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && deletePassword.trim() && !deleting)
                                    confirmDelete();
                            }}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={!deletePassword.trim() || deleting}
                            onClick={(e) => {
                                e.preventDefault();
                                confirmDelete();
                            }}
                        >
                            {deleting ? 'Deleting…' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
