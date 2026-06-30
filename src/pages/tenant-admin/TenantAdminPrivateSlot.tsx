// src/pages/tenant-admin/TenantAdminPrivateSlot.tsx
// Tenant Admin "Private Slot" — mirrors the platform super-admin Private Slot
// page (AdminPrivateSlot.tsx) UI/UX, but scoped to THIS tenant via the
// existing tenantAdminApi (/api/tenant/admin/private-slot/*):
//   1. A multi-select user picker (search, select-all-visible, bulk move
//      between Global and Private billing scope).
//   2. A private-members section with per-user plan assignment + remove.
//   3. Private-plans CRUD: inline name + active toggle + delete, a create
//      form, and a per-plan feature-matrix editor (access toggles + limits).
//   4. Global / Private headline stats.
import { useEffect, useMemo, useState } from 'react';
import { Save, Plus, Loader2, Trash2, Pencil, Search, Lock, Globe, ChevronsUpDown, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/components/ui/use-toast';
import {
    tenantAdminApi,
    type PrivateSlotUser,
    type PrivatePlan,
    type PrivatePlanFeature,
    type PrivatePlanFeatureMap,
    type FeatureCatalogItem,
} from './tenantAdminApi';

// Local editable mirror of a plan's name + active state + pricing (keyed by plan id).
type PlanMetaEdit = {
    name: string;
    is_active: boolean;
    price_monthly_inr: string;
    billing_period: string;
    offer_text: string;
};
// Editable feature matrix keyed by plan id (so unsaved edits per plan are isolated).
type FeatureMatrix = Record<string, PrivatePlanFeatureMap>;

const pretty = (k: string): string => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const isLimit = (f: FeatureCatalogItem): boolean => (f.feature_type || '').toLowerCase() === 'limit';

/** Allowed billing cadences for a private plan. */
const BILLING_PERIODS: { value: string; label: string }[] = [
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
];

/** Short suffix shown next to a plan's price (e.g. "/mo", "/qtr", "/yr"). */
const periodSuffix = (period?: string | null): string => {
    switch ((period || 'monthly').toLowerCase()) {
        case 'yearly': return '/yr';
        case 'quarterly': return '/qtr';
        default: return '/mo';
    }
};

/** Human label for a billing period (defaults to Monthly). */
const periodLabel = (period?: string | null): string =>
    BILLING_PERIODS.find((p) => p.value === (period || 'monthly').toLowerCase())?.label ?? 'Monthly';

export default function TenantAdminPrivateSlot() {
    const { toast } = useToast();
    const [users, setUsers] = useState<PrivateSlotUser[]>([]);
    const [privateMembers, setPrivateMembers] = useState<PrivateSlotUser[]>([]);
    const [plans, setPlans] = useState<PrivatePlan[]>([]);
    const [globalTiers, setGlobalTiers] = useState<string[]>([]);
    const [features, setFeatures] = useState<FeatureCatalogItem[]>([]);
    const [matrix, setMatrix] = useState<FeatureMatrix>({});
    const [planEdits, setPlanEdits] = useState<Record<string, PlanMetaEdit>>({});

    const [search, setSearch] = useState('');
    const [memberSearch, setMemberSearch] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
    const [userPickerOpen, setUserPickerOpen] = useState(false);
    const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'private'>('all');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    const [newPlan, setNewPlan] = useState<{ name: string; price: string; billing_period: string; offer_text: string }>({
        name: '',
        price: '',
        billing_period: 'monthly',
        offer_text: '',
    });
    const [newFeatures, setNewFeatures] = useState<PrivatePlanFeatureMap>({});

    const load = async () => {
        setLoading(true);
        try {
            const res = await tenantAdminApi.getPrivateSlot();
            setUsers(res.users || []);
            setPrivateMembers(res.private_members || []);
            const list = res.private_plans || [];
            setPlans(list);
            setGlobalTiers(res.global_tiers || []);
            setFeatures(res.feature_catalog || []);
            // Build per-plan editable mirrors (id-keyed).
            const edits: Record<string, PlanMetaEdit> = {};
            const mtx: FeatureMatrix = {};
            list.forEach((p) => {
                edits[String(p.id)] = {
                    name: p.name,
                    is_active: p.is_active !== false,
                    price_monthly_inr: p.price_monthly_inr != null ? String(p.price_monthly_inr) : '',
                    billing_period: p.billing_period || 'monthly',
                    offer_text: p.offer_text ?? '',
                };
                mtx[String(p.id)] = { ...(p.features || {}) };
            });
            setPlanEdits(edits);
            setMatrix(mtx);
        } catch (e: any) {
            toast({ title: 'Failed to load', description: e?.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Headline stats derived from the user list (tenant API has no stats block).
    const stats = useMemo(() => {
        let priv = 0;
        let global = 0;
        for (const u of users) {
            if (u.billing_scope === 'private') priv++;
            else global++;
        }
        return { private_count: priv, global_count: global };
    }, [users]);

    // Plan options assignable to a private member: this tenant's ACTIVE private
    // plans (slug + name) plus the global tier slugs.
    const planOptionsForPrivate = useMemo(() => {
        const opts: { value: string; label: string }[] = [];
        for (const p of plans) {
            if (planEdits[String(p.id)]?.is_active !== false) {
                opts.push({ value: p.slug, label: `${p.name} (private)` });
            }
        }
        for (const t of globalTiers) {
            if (!opts.some((o) => o.value === t)) opts.push({ value: t, label: pretty(t) });
        }
        return opts;
    }, [plans, planEdits, globalTiers]);

    const filteredMembers = useMemo(() => {
        const q = memberSearch.trim().toLowerCase();
        if (!q) return privateMembers;
        return privateMembers.filter(
            (m) =>
                m.name?.toLowerCase().includes(q) ||
                m.email?.toLowerCase().includes(q) ||
                String(m.id).includes(q),
        );
    }, [privateMembers, memberSearch]);

    const dropdownUsers = useMemo(() => {
        if (scopeFilter === 'all') return users;
        return users.filter((u) => u.billing_scope === scopeFilter);
    }, [users, scopeFilter]);

    const selectedUsers = useMemo(
        () => users.filter((u) => selectedUserIds.includes(String(u.id))),
        [users, selectedUserIds],
    );

    const toggleUserSelection = (userId: string) =>
        setSelectedUserIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
        );

    const selectAllVisible = () => {
        const ids = dropdownUsers.map((u) => String(u.id));
        setSelectedUserIds((prev) => [...new Set([...prev, ...ids])]);
    };

    const clearSelection = () => setSelectedUserIds([]);

    const setScopeBulk = async (scope: 'global' | 'private') => {
        if (selectedUserIds.length === 0) {
            toast({ title: 'Select users first', variant: 'destructive' });
            return;
        }
        setSaving(`bulk-${scope}`);
        try {
            const res = await tenantAdminApi.bulkSetScope(selectedUserIds, scope);
            toast({
                title: scope === 'private' ? 'Moved to Private Slot' : 'Moved to Global',
                description: `${res.updated ?? selectedUserIds.length} user(s) updated`,
            });
            setSelectedUserIds([]);
            await load();
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(null);
        }
    };

    const setScope = async (userId: string | number, scope: 'global' | 'private') => {
        setSaving(`scope-${userId}`);
        try {
            await tenantAdminApi.setUserScope(userId, scope);
            toast({ title: scope === 'private' ? 'Moved to Private Slot' : 'Moved to Global' });
            await load();
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(null);
        }
    };

    const setMemberPlan = async (userId: string | number, plan: string) => {
        setSaving(`plan-${userId}`);
        try {
            await tenantAdminApi.setPrivateUserPlan(userId, plan);
            toast({ title: 'Plan updated', description: `User #${userId} → ${plan}` });
            await load();
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(null);
        }
    };

    // ---- feature matrix editing (per existing plan, keyed by plan id) ----
    const toggle = (planId: string, featureKey: string, enabled: boolean) =>
        setMatrix((prev) => ({
            ...prev,
            [planId]: { ...prev[planId], [featureKey]: { ...prev[planId]?.[featureKey], enabled } },
        }));

    const setLimit = (planId: string, featureKey: string, raw: string) =>
        setMatrix((prev) => ({
            ...prev,
            [planId]: {
                ...prev[planId],
                [featureKey]: { enabled: true, limit_value: raw === '' ? null : Number(raw) },
            },
        }));

    const saveFeatures = async (p: PrivatePlan) => {
        const id = String(p.id);
        setSaving(`features-${id}`);
        try {
            await tenantAdminApi.updatePrivatePlanFeatures(p.id, matrix[id] || {});
            toast({ title: 'Saved', description: `Private plan ${p.slug} features updated` });
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(null);
        }
    };

    const savePlanMeta = async (p: PrivatePlan) => {
        const id = String(p.id);
        const edit = planEdits[id];
        if (!edit?.name?.trim()) {
            toast({ title: 'Name required', variant: 'destructive' });
            return;
        }
        setSaving(`meta-${id}`);
        try {
            const priceRaw = edit.price_monthly_inr.trim();
            const price = priceRaw === '' ? NaN : Number(priceRaw);
            await tenantAdminApi.updatePrivatePlan(p.id, {
                name: edit.name.trim(),
                is_active: edit.is_active,
                billing_period: edit.billing_period,
                offer_text: edit.offer_text,
                ...(Number.isNaN(price) ? {} : { price_monthly_inr: price }),
            });
            toast({ title: 'Plan updated' });
            await load();
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(null);
        }
    };

    // ---- create-plan feature editing ----
    const setNewAccess = (key: string, enabled: boolean) =>
        setNewFeatures((m) => ({ ...m, [key]: { ...m[key], enabled } }));
    const setNewLimit = (key: string, raw: string) =>
        setNewFeatures((m) => ({ ...m, [key]: { enabled: true, limit_value: raw === '' ? null : Number(raw) } }));

    const createPlan = async () => {
        const name = newPlan.name.trim();
        if (!name) {
            toast({ title: 'Name required', variant: 'destructive' });
            return;
        }
        setSaving('create');
        try {
            const priceRaw = newPlan.price.trim();
            const price = priceRaw === '' ? undefined : Number(priceRaw);
            await tenantAdminApi.createPrivatePlan({
                name,
                price_monthly_inr: price !== undefined && !Number.isNaN(price) ? price : undefined,
                billing_period: newPlan.billing_period,
                offer_text: newPlan.offer_text,
                features: newFeatures,
            });
            toast({ title: 'Private plan created' });
            setNewPlan({ name: '', price: '', billing_period: 'monthly', offer_text: '' });
            setNewFeatures({});
            await load();
        } catch (e: any) {
            toast({ title: 'Error', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(null);
        }
    };

    const deletePlan = async (p: PrivatePlan) => {
        if (!window.confirm(`Delete private plan "${p.name}"?`)) return;
        const id = String(p.id);
        setSaving(`delete-${id}`);
        try {
            await tenantAdminApi.deletePrivatePlan(p.id);
            toast({ title: 'Plan deleted' });
            await load();
        } catch (e: any) {
            toast({ title: 'Cannot delete', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(null);
        }
    };

    const accessFeatures = features.filter((f) => !isLimit(f));
    const limitFeatures = features.filter((f) => isLimit(f));

    if (loading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Lock className="h-6 w-6 text-emerald-600" />
                    Private Slot
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    A private billing pool for your VIP users. Users here use private-only plans plus the global
                    tiers. Switch back to Global anytime.
                </p>
                <div className="flex gap-3 mt-3 text-sm">
                    <Badge variant="outline" className="gap-1">
                        <Globe className="h-3 w-3" /> Global: {stats.global_count}
                    </Badge>
                    <Badge className="bg-emerald-600 gap-1">
                        <Lock className="h-3 w-3" /> Private: {stats.private_count}
                    </Badge>
                </div>
            </div>

            {/* User picker — multi-select dropdown */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Manage user scope</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2 items-center">
                        <div className="relative flex-1 min-w-[200px] max-w-md">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search users by name or email..."
                                className="pl-8"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {(['all', 'global', 'private'] as const).map((f) => (
                            <Button
                                key={f}
                                size="sm"
                                variant={scopeFilter === f ? 'default' : 'outline'}
                                className={scopeFilter === f && f === 'private' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                                onClick={() => setScopeFilter(f)}
                            >
                                {f === 'all' ? 'All users' : f === 'global' ? 'Global only' : 'Private only'}
                            </Button>
                        ))}
                    </div>

                    <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={userPickerOpen}
                                className="w-full max-w-xl justify-between h-auto min-h-10 py-2"
                            >
                                <span className="truncate text-left">
                                    {selectedUserIds.length === 0
                                        ? 'Select users from dropdown...'
                                        : `${selectedUserIds.length} user(s) selected`}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[min(100vw-2rem,28rem)] p-0" align="start">
                            <Command
                                filter={(value, search) =>
                                    value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
                                }
                            >
                                <CommandInput placeholder="Filter by name, email, or ID..." />
                                <div className="flex items-center justify-between px-3 py-2 border-b text-xs">
                                    <button type="button" className="text-emerald-600 hover:underline" onClick={selectAllVisible}>
                                        Select all visible
                                    </button>
                                    <button type="button" className="text-muted-foreground hover:underline" onClick={clearSelection}>
                                        Clear
                                    </button>
                                </div>
                                <CommandList className="max-h-64">
                                    <CommandEmpty>No users found.</CommandEmpty>
                                    <CommandGroup>
                                        {dropdownUsers
                                            .filter((u) => {
                                                const q = search.trim().toLowerCase();
                                                return !q || `${u.id} ${u.name} ${u.email}`.toLowerCase().includes(q);
                                            })
                                            .map((u) => {
                                                const id = String(u.id);
                                                const checked = selectedUserIds.includes(id);
                                                return (
                                                    <CommandItem
                                                        key={id}
                                                        value={`${u.id} ${u.name} ${u.email}`}
                                                        onSelect={() => toggleUserSelection(id)}
                                                        className="flex items-start gap-2 cursor-pointer"
                                                    >
                                                        <Checkbox checked={checked} className="mt-0.5 pointer-events-none" />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="font-mono text-xs text-muted-foreground">#{u.id}</span>
                                                                <span className="font-medium truncate">{u.name || u.email}</span>
                                                                {u.billing_scope === 'private' ? (
                                                                    <Badge className="bg-emerald-600 text-[10px] px-1.5 py-0">Private</Badge>
                                                                ) : (
                                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">Global</Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                                            <p className="text-[10px] text-muted-foreground">Plan: {u.plan}</p>
                                                        </div>
                                                        {checked && <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
                                                    </CommandItem>
                                                );
                                            })}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    {selectedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {selectedUsers.map((u) => (
                                <Badge key={String(u.id)} variant="secondary" className="gap-1 pr-1">
                                    #{u.id} {u.name || u.email}
                                    <button
                                        type="button"
                                        className="rounded-full hover:bg-slate-300/60 p-0.5"
                                        onClick={() => toggleUserSelection(String(u.id))}
                                        aria-label={`Remove ${u.name || u.email}`}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={selectedUserIds.length === 0 || saving === 'bulk-private'}
                            onClick={() => setScopeBulk('private')}
                        >
                            {saving === 'bulk-private' ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                                <Lock className="h-4 w-4 mr-1" />
                            )}
                            Set selected to Private
                        </Button>
                        <Button
                            variant="outline"
                            disabled={selectedUserIds.length === 0 || saving === 'bulk-global'}
                            onClick={() => setScopeBulk('global')}
                        >
                            {saving === 'bulk-global' ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                                <Globe className="h-4 w-4 mr-1" />
                            )}
                            Set selected to Global
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Private members */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Private slot members</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Filter members..."
                            className="pl-8"
                            value={memberSearch}
                            onChange={(e) => setMemberSearch(e.target.value)}
                        />
                    </div>
                    {filteredMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">No users in the private slot yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {filteredMembers.map((m) => (
                                <div
                                    key={String(m.id)}
                                    className="flex flex-wrap items-center gap-3 p-3 border rounded-lg bg-emerald-50/50"
                                >
                                    <div className="min-w-[120px]">
                                        <span className="font-mono text-xs text-muted-foreground">#{m.id}</span>
                                        <p className="font-medium">{m.name || m.email}</p>
                                        <p className="text-xs text-muted-foreground">{m.email}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                        <span className="text-xs text-muted-foreground shrink-0">Plan:</span>
                                        <select
                                            className="h-8 rounded-md border bg-white px-2 text-sm flex-1 max-w-[220px]"
                                            value={m.plan}
                                            disabled={saving === `plan-${m.id}`}
                                            onChange={(e) => setMemberPlan(m.id, e.target.value)}
                                        >
                                            {/* current plan may not be in options (e.g. legacy) — show it */}
                                            {!planOptionsForPrivate.some((o) => o.value === m.plan) && (
                                                <option value={m.plan}>{pretty(m.plan)}</option>
                                            )}
                                            {planOptionsForPrivate.map((o) => (
                                                <option key={o.value} value={o.value}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setScope(m.id, 'global')}
                                        disabled={saving === `scope-${m.id}`}
                                    >
                                        Remove from slot
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Private plans — inline meta edit (name + active toggle) + delete */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Private-only plans</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {plans.length === 0 && (
                        <p className="text-sm text-muted-foreground">No private plans yet. Create one below.</p>
                    )}
                    {plans.map((plan) => {
                        const id = String(plan.id);
                        const edit = planEdits[id] || {
                            name: plan.name,
                            is_active: true,
                            price_monthly_inr: plan.price_monthly_inr != null ? String(plan.price_monthly_inr) : '',
                            billing_period: plan.billing_period || 'monthly',
                            offer_text: plan.offer_text ?? '',
                        };
                        return (
                            <div key={id} className="flex flex-wrap items-center gap-3 p-3 border rounded-lg">
                                <div className="flex-1 min-w-[180px]">
                                    <Input
                                        value={edit.name}
                                        onChange={(e) =>
                                            setPlanEdits((prev) => ({ ...prev, [id]: { ...edit, name: e.target.value } }))
                                        }
                                        className="h-8 max-w-[200px] font-medium"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        slug: {plan.slug}
                                        {plan.price_monthly_inr != null
                                            ? ` · ₹${plan.price_monthly_inr}${periodSuffix(plan.billing_period)}`
                                            : ` · ${periodLabel(plan.billing_period)}`}
                                    </p>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground">Price (₹)</span>
                                    <Input
                                        type="number"
                                        placeholder="Price ₹"
                                        value={edit.price_monthly_inr}
                                        onChange={(e) =>
                                            setPlanEdits((prev) => ({ ...prev, [id]: { ...edit, price_monthly_inr: e.target.value } }))
                                        }
                                        className="h-8 w-28"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground">Billing</span>
                                    <select
                                        aria-label="Billing period"
                                        value={edit.billing_period}
                                        onChange={(e) =>
                                            setPlanEdits((prev) => ({ ...prev, [id]: { ...edit, billing_period: e.target.value } }))
                                        }
                                        className="flex h-8 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                    >
                                        {BILLING_PERIODS.map((bp) => (
                                            <option key={bp.value} value={bp.value}>{bp.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-xs text-muted-foreground">Offer text</span>
                                    <Input
                                        aria-label="Offer text"
                                        placeholder="Offer text (e.g. Save 20%)"
                                        value={edit.offer_text}
                                        onChange={(e) =>
                                            setPlanEdits((prev) => ({ ...prev, [id]: { ...edit, offer_text: e.target.value } }))
                                        }
                                        className="h-8 w-44"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs">Active</span>
                                    <Switch
                                        checked={edit.is_active}
                                        onCheckedChange={(v) =>
                                            setPlanEdits((prev) => ({ ...prev, [id]: { ...edit, is_active: v } }))
                                        }
                                    />
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => savePlanMeta(plan)}
                                    disabled={saving === `meta-${id}`}
                                >
                                    {saving === `meta-${id}` ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                        <Pencil className="h-3 w-3 mr-1" />
                                    )}
                                    Save
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deletePlan(plan)}
                                    disabled={saving === `delete-${id}`}
                                >
                                    {saving === `delete-${id}` ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-3 w-3 mr-1" />
                                    )}
                                    Delete
                                </Button>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            {/* Create private plan */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Create private plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Input
                            placeholder="Display name (e.g. VIP Pro)"
                            value={newPlan.name}
                            onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))}
                            className="w-56"
                        />
                        <Input
                            type="number"
                            placeholder="Price ₹"
                            value={newPlan.price}
                            onChange={(e) => setNewPlan((p) => ({ ...p, price: e.target.value }))}
                            className="w-32"
                        />
                        <select
                            aria-label="Billing period"
                            value={newPlan.billing_period}
                            onChange={(e) => setNewPlan((p) => ({ ...p, billing_period: e.target.value }))}
                            className="flex h-10 w-36 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            {BILLING_PERIODS.map((bp) => (
                                <option key={bp.value} value={bp.value}>{bp.label}</option>
                            ))}
                        </select>
                        <Input
                            aria-label="Offer text"
                            placeholder="Offer text (e.g. Save 20%)"
                            value={newPlan.offer_text}
                            onChange={(e) => setNewPlan((p) => ({ ...p, offer_text: e.target.value }))}
                            className="w-56"
                        />
                        <Button
                            onClick={createPlan}
                            className="bg-emerald-600 hover:bg-emerald-700"
                            disabled={saving === 'create' || !newPlan.name.trim()}
                        >
                            {saving === 'create' ? (
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4 mr-1" />
                            )}
                            Create
                        </Button>
                    </div>

                    {/* Optional starting feature matrix for the new plan */}
                    {features.length > 0 && (
                        <div className="space-y-4 rounded-lg border p-3 bg-slate-50/50">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                Starting features (optional)
                            </p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left">
                                            <th className="py-2 pr-4">Feature</th>
                                            <th className="py-2">Enabled</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {accessFeatures.map((f) => (
                                            <tr key={f.key} className="border-b border-slate-100">
                                                <td className="py-2 pr-4">
                                                    <p className="font-medium">{f.label}</p>
                                                    <p className="text-xs text-muted-foreground">{f.key}</p>
                                                </td>
                                                <td className="py-2">
                                                    <Switch
                                                        checked={newFeatures[f.key]?.enabled ?? false}
                                                        onCheckedChange={(v) => setNewAccess(f.key, v)}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {limitFeatures.map((f) => (
                                    <div key={f.key} className="p-3 border rounded-lg bg-white">
                                        <p className="text-sm font-medium">{f.label}</p>
                                        <Input
                                            type="number"
                                            className="mt-1 h-8 text-xs"
                                            placeholder="-1 = unlimited"
                                            value={newFeatures[f.key]?.limit_value ?? ''}
                                            onChange={(e) => setNewLimit(f.key, e.target.value)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Per-plan feature-matrix editor */}
            {plans.map((plan) => {
                const id = String(plan.id);
                const planMatrix: PrivatePlanFeatureMap = matrix[id] || {};
                return (
                    <Card key={id} className={planEdits[id]?.is_active === false ? 'opacity-60' : ''}>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>{planEdits[id]?.name || plan.name}</CardTitle>
                                <p className="text-xs text-muted-foreground">Private plan · {plan.slug}</p>
                            </div>
                            <Button onClick={() => saveFeatures(plan)} disabled={saving === `features-${id}`}>
                                {saving === `features-${id}` ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <Save className="h-4 w-4 mr-1" /> Save features
                                    </>
                                )}
                            </Button>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {features.length === 0 ? (
                                <p className="text-xs text-muted-foreground">Feature catalog unavailable.</p>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b text-left">
                                                    <th className="py-2 pr-4">Feature</th>
                                                    <th className="py-2">Enabled</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {accessFeatures.map((f) => {
                                                    const ov: Partial<PrivatePlanFeature> = planMatrix[f.key] || {};
                                                    return (
                                                        <tr key={f.key} className="border-b border-slate-100">
                                                            <td className="py-2 pr-4">
                                                                <p className="font-medium">{f.label}</p>
                                                                <p className="text-xs text-muted-foreground">{f.key}</p>
                                                            </td>
                                                            <td className="py-2">
                                                                <Switch
                                                                    checked={ov.enabled ?? false}
                                                                    onCheckedChange={(v) => toggle(id, f.key, v)}
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {limitFeatures.map((f) => {
                                            const ov: Partial<PrivatePlanFeature> = planMatrix[f.key] || {};
                                            return (
                                                <div key={f.key} className="p-3 border rounded-lg">
                                                    <p className="text-sm font-medium">{f.label}</p>
                                                    <Input
                                                        type="number"
                                                        className="mt-1 h-8 text-xs"
                                                        placeholder="-1 = unlimited"
                                                        value={ov.limit_value ?? ''}
                                                        onChange={(e) => setLimit(id, f.key, e.target.value)}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
