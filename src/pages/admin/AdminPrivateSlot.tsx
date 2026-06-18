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
import { adminApi } from '@/lib/adminApi';
interface SlotUser {
    id: number;
    name: string;
    email: string;
    phone?: string;
    plan: string;
    billing_scope: 'global' | 'private';
    status?: string;
}

interface Plan {
    slug: string;
    name: string;
    is_active?: boolean;
    user_count?: number;
    is_deletable?: boolean;
}

interface Feature {
    key: string;
    label: string;
    feature_type: string;
    category: string;
}

type Matrix = Record<string, Record<string, { enabled: boolean; limit_value?: number | null }>>;

export default function AdminPrivateSlot() {
    const [users, setUsers] = useState<SlotUser[]>([]);
    const [privateMembers, setPrivateMembers] = useState<SlotUser[]>([]);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [globalPlanOptions, setGlobalPlanOptions] = useState<string[]>([]);
    const [features, setFeatures] = useState<Feature[]>([]);
    const [matrix, setMatrix] = useState<Matrix>({});
    const [planEdits, setPlanEdits] = useState<Record<string, { name: string; is_active: boolean }>>({});
    const [stats, setStats] = useState({ private_count: 0, global_count: 0 });
    const [search, setSearch] = useState('');
    const [memberSearch, setMemberSearch] = useState('');
    const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
    const [userPickerOpen, setUserPickerOpen] = useState(false);
    const [scopeFilter, setScopeFilter] = useState<'all' | 'global' | 'private'>('all');    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [newPlan, setNewPlan] = useState({ slug: '', name: '' });
    const { toast } = useToast();

    const load = async (q?: string) => {
        setLoading(true);
        const res = await adminApi.getPrivateSlot(q);
        if (res.success) {
            setUsers(res.users || []);
            setPrivateMembers(res.private_members || []);
            const list: Plan[] = res.private_plans || [];
            setPlans(list);
            setGlobalPlanOptions(res.global_plan_options || []);
            setFeatures(res.features || []);
            setMatrix(res.matrix || {});
            setStats(res.stats || { private_count: 0, global_count: 0 });
            const edits: Record<string, { name: string; is_active: boolean }> = {};
            list.forEach(p => {
                edits[p.slug] = { name: p.name, is_active: p.is_active !== false };
            });
            setPlanEdits(edits);
        } else {
            toast({ title: 'Failed to load', description: res.error, variant: 'destructive' });
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const planOptionsForPrivate = useMemo(() => {
        const custom = plans.filter(p => planEdits[p.slug]?.is_active !== false).map(p => p.slug);
        return [...new Set([...globalPlanOptions, ...custom])];
    }, [globalPlanOptions, plans, planEdits]);

    const filteredMembers = useMemo(() => {
        const q = memberSearch.trim().toLowerCase();
        if (!q) return privateMembers;
        return privateMembers.filter(m =>
            m.name?.toLowerCase().includes(q) ||
            m.email?.toLowerCase().includes(q) ||
            String(m.id).includes(q)
        );
    }, [privateMembers, memberSearch]);

    const dropdownUsers = useMemo(() => {
        if (scopeFilter === 'all') return users;
        return users.filter(u => u.billing_scope === scopeFilter);
    }, [users, scopeFilter]);

    const selectedUsers = useMemo(
        () => users.filter(u => selectedUserIds.includes(u.id)),
        [users, selectedUserIds]
    );

    const toggleUserSelection = (userId: number) => {
        setSelectedUserIds(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const selectAllVisible = () => {
        const ids = dropdownUsers.map(u => u.id);
        setSelectedUserIds(prev => [...new Set([...prev, ...ids])]);
    };

    const clearSelection = () => setSelectedUserIds([]);

    const setScopeBulk = async (billing_scope: 'global' | 'private') => {
        if (selectedUserIds.length === 0) {
            toast({ title: 'Select users first', variant: 'destructive' });
            return;
        }
        setSaving(`bulk-${billing_scope}`);
        const res = await adminApi.setPrivateSlotScopeBulk(selectedUserIds, billing_scope);
        if (res.success) {
            toast({
                title: billing_scope === 'private' ? 'Moved to Private Slot' : 'Moved to Global',
                description: `${res.updated_count ?? selectedUserIds.length} user(s) updated`,
            });
            setSelectedUserIds([]);
            load(search || undefined);
        } else {
            toast({ title: 'Error', description: res.error || res.message, variant: 'destructive' });
        }
        setSaving(null);
    };
    const setScope = async (userId: number, billing_scope: 'global' | 'private') => {
        setSaving(`scope-${userId}`);
        const res = await adminApi.setPrivateSlotScope(userId, billing_scope);
        if (res.success) {
            toast({ title: billing_scope === 'private' ? 'Moved to Private Slot' : 'Moved to Global' });
            load(search || undefined);
        } else {
            toast({ title: 'Error', description: res.error || res.message, variant: 'destructive' });
        }
        setSaving(null);
    };

    const setMemberPlan = async (userId: number, plan: string) => {
        setSaving(`plan-${userId}`);
        const res = await adminApi.setPrivateSlotPlan(userId, plan);
        if (res.success) {
            toast({ title: 'Plan updated', description: `User #${userId} → ${plan}` });
            load(search || undefined);
        } else {
            toast({ title: 'Error', description: res.error || res.message, variant: 'destructive' });
        }
        setSaving(null);
    };

    const toggle = (planSlug: string, featureKey: string, enabled: boolean) => {
        setMatrix(prev => ({
            ...prev,
            [planSlug]: {
                ...prev[planSlug],
                [featureKey]: { ...prev[planSlug]?.[featureKey], enabled },
            },
        }));
    };

    const setLimit = (planSlug: string, featureKey: string, limit_value: number) => {
        setMatrix(prev => ({
            ...prev,
            [planSlug]: {
                ...prev[planSlug],
                [featureKey]: { enabled: true, limit_value },
            },
        }));
    };

    const saveFeatures = async (slug: string) => {
        setSaving(`features-${slug}`);
        const res = await adminApi.updatePrivatePlanFeatures(slug, matrix[slug] || {});
        if (res.success) {
            toast({ title: 'Saved', description: `Private plan ${slug} features updated` });
        } else {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
        }
        setSaving(null);
    };

    const savePlanMeta = async (slug: string) => {
        const edit = planEdits[slug];
        if (!edit?.name?.trim()) {
            toast({ title: 'Name required', variant: 'destructive' });
            return;
        }
        setSaving(`meta-${slug}`);
        const res = await adminApi.updatePrivatePlan(slug, {
            name: edit.name.trim(),
            is_active: edit.is_active,
        });
        if (res.success) {
            toast({ title: 'Plan updated' });
            load(search || undefined);
        } else {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
        }
        setSaving(null);
    };

    const createPlan = async () => {
        if (!newPlan.slug || !newPlan.name) return;
        const res = await adminApi.createPrivatePlan(newPlan);
        if (res.success) {
            toast({ title: 'Private plan created' });
            setNewPlan({ slug: '', name: '' });
            load(search || undefined);
        } else {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
        }
    };

    const deletePlan = async (slug: string) => {
        const plan = plans.find(p => p.slug === slug);
        if (!plan?.is_deletable) return;
        if (!window.confirm(`Delete private plan "${plan.name}"?`)) return;
        setSaving(`delete-${slug}`);
        const res = await adminApi.deletePrivatePlan(slug);
        if (res.success) {
            toast({ title: 'Plan deleted' });
            load(search || undefined);
        } else {
            toast({ title: 'Cannot delete', description: res.message || res.error, variant: 'destructive' });
        }
        setSaving(null);
    };

    const accessFeatures = features.filter(f => f.feature_type === 'access');
    const limitFeatures = features.filter(f => f.feature_type === 'limit');

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Lock className="h-6 w-6 text-violet-600" />
                    Private Slot
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    One shared private pool. Users here use private-only plans plus global tiers (starter / growth / enterprise).
                    Switch back to Global anytime.
                </p>
                <div className="flex gap-3 mt-3 text-sm">
                    <Badge variant="outline" className="gap-1"><Globe className="h-3 w-3" /> Global: {stats.global_count}</Badge>
                    <Badge className="bg-violet-600 gap-1"><Lock className="h-3 w-3" /> Private: {stats.private_count}</Badge>
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
                                placeholder="Search users to load..."
                                className="pl-8"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && load(search)}
                            />
                        </div>
                        <Button variant="outline" onClick={() => load(search)}>Search</Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {(['all', 'global', 'private'] as const).map(f => (
                            <Button
                                key={f}
                                size="sm"
                                variant={scopeFilter === f ? 'default' : 'outline'}
                                className={scopeFilter === f && f === 'private' ? 'bg-violet-600 hover:bg-violet-700' : ''}
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
                            <Command>
                                <CommandInput placeholder="Filter by name, email, or ID..." />
                                <div className="flex items-center justify-between px-3 py-2 border-b text-xs">
                                    <button type="button" className="text-violet-600 hover:underline" onClick={selectAllVisible}>
                                        Select all visible
                                    </button>
                                    <button type="button" className="text-muted-foreground hover:underline" onClick={clearSelection}>
                                        Clear
                                    </button>
                                </div>
                                <CommandList className="max-h-64">
                                    <CommandEmpty>No users found.</CommandEmpty>
                                    <CommandGroup>
                                        {dropdownUsers.map(u => {
                                            const checked = selectedUserIds.includes(u.id);
                                            return (
                                                <CommandItem
                                                    key={u.id}
                                                    value={`${u.id} ${u.name} ${u.email}`}
                                                    onSelect={() => toggleUserSelection(u.id)}
                                                    className="flex items-start gap-2 cursor-pointer"
                                                >
                                                    <Checkbox checked={checked} className="mt-0.5 pointer-events-none" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono text-xs text-muted-foreground">#{u.id}</span>
                                                            <span className="font-medium truncate">{u.name}</span>
                                                            {u.billing_scope === 'private' ? (
                                                                <Badge className="bg-violet-600 text-[10px] px-1.5 py-0">Private</Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">Global</Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                                        <p className="text-[10px] text-muted-foreground">Plan: {u.plan}</p>
                                                    </div>
                                                    {checked && <Check className="h-4 w-4 text-violet-600 shrink-0" />}
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
                            {selectedUsers.map(u => (
                                <Badge key={u.id} variant="secondary" className="gap-1 pr-1">
                                    #{u.id} {u.name}
                                    <button
                                        type="button"
                                        className="rounded-full hover:bg-slate-300/60 p-0.5"
                                        onClick={() => toggleUserSelection(u.id)}
                                        aria-label={`Remove ${u.name}`}
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <Button
                            className="bg-violet-600 hover:bg-violet-700"
                            disabled={selectedUserIds.length === 0 || saving === 'bulk-private'}
                            onClick={() => setScopeBulk('private')}
                        >
                            {saving === 'bulk-private' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Lock className="h-4 w-4 mr-1" />}
                            Set selected to Private
                        </Button>
                        <Button
                            variant="outline"
                            disabled={selectedUserIds.length === 0 || saving === 'bulk-global'}
                            onClick={() => setScopeBulk('global')}
                        >
                            {saving === 'bulk-global' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Globe className="h-4 w-4 mr-1" />}
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
                            onChange={e => setMemberSearch(e.target.value)}
                        />
                    </div>
                    {filteredMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4">No users in the private slot yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {filteredMembers.map(m => (
                                <div key={m.id} className="flex flex-wrap items-center gap-3 p-3 border rounded-lg bg-violet-50/50">
                                    <div className="min-w-[120px]">
                                        <span className="font-mono text-xs text-muted-foreground">#{m.id}</span>
                                        <p className="font-medium">{m.name}</p>
                                        <p className="text-xs text-muted-foreground">{m.email}</p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                        <span className="text-xs text-muted-foreground shrink-0">Plan:</span>
                                        <select
                                            className="h-8 rounded-md border bg-white px-2 text-sm flex-1 max-w-[200px]"
                                            value={m.plan}
                                            disabled={saving === `plan-${m.id}`}
                                            onChange={e => setMemberPlan(m.id, e.target.value)}
                                        >
                                            {planOptionsForPrivate.map(slug => (
                                                <option key={slug} value={slug}>{slug}</option>
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

            {/* Private plans */}
            <Card>
                <CardHeader><CardTitle className="text-base">Private-only plans</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    {plans.length === 0 && (
                        <p className="text-sm text-muted-foreground">No private plans yet. Create one below.</p>
                    )}
                    {plans.map(plan => {
                        const edit = planEdits[plan.slug] || { name: plan.name, is_active: true };
                        return (
                            <div key={plan.slug} className="flex flex-wrap items-center gap-3 p-3 border rounded-lg">
                                <div className="flex-1 min-w-[180px]">
                                    <Input
                                        value={edit.name}
                                        onChange={e => setPlanEdits(prev => ({
                                            ...prev,
                                            [plan.slug]: { ...edit, name: e.target.value },
                                        }))}
                                        className="h-8 max-w-[200px] font-medium"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        slug: {plan.slug} · {plan.user_count ?? 0} private user(s)
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs">Active</span>
                                    <Switch
                                        checked={edit.is_active}
                                        onCheckedChange={v => setPlanEdits(prev => ({
                                            ...prev,
                                            [plan.slug]: { ...edit, is_active: v },
                                        }))}
                                    />
                                </div>
                                <Button size="sm" variant="outline" onClick={() => savePlanMeta(plan.slug)} disabled={saving === `meta-${plan.slug}`}>
                                    <Pencil className="h-3 w-3 mr-1" /> Save
                                </Button>
                                {plan.is_deletable && (
                                    <Button size="sm" variant="destructive" onClick={() => deletePlan(plan.slug)} disabled={saving === `delete-${plan.slug}`}>
                                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-base">Create private plan</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Input
                        placeholder="slug (e.g. vip-pro)"
                        value={newPlan.slug}
                        onChange={e => setNewPlan(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                        className="w-40"
                    />
                    <Input
                        placeholder="Display name"
                        value={newPlan.name}
                        onChange={e => setNewPlan(p => ({ ...p, name: e.target.value }))}
                        className="w-48"
                    />
                    <Button onClick={createPlan} className="bg-violet-600 hover:bg-violet-700">
                        <Plus className="h-4 w-4 mr-1" /> Create
                    </Button>
                </CardContent>
            </Card>

            {plans.map(plan => (
                <Card key={plan.slug} className={planEdits[plan.slug]?.is_active === false ? 'opacity-60' : ''}>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>{planEdits[plan.slug]?.name || plan.name}</CardTitle>
                            <p className="text-xs text-muted-foreground">Private plan · {plan.slug}</p>
                        </div>
                        <Button onClick={() => saveFeatures(plan.slug)} disabled={saving === `features-${plan.slug}`}>
                            {saving === `features-${plan.slug}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-1" /> Save features</>}
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b text-left">
                                        <th className="py-2 pr-4">Feature</th>
                                        <th className="py-2">Enabled</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {accessFeatures.map(f => (
                                        <tr key={f.key} className="border-b border-slate-100">
                                            <td className="py-2 pr-4">
                                                <p className="font-medium">{f.label}</p>
                                                <p className="text-xs text-muted-foreground">{f.key}</p>
                                            </td>
                                            <td className="py-2">
                                                <Switch
                                                    checked={matrix[plan.slug]?.[f.key]?.enabled ?? false}
                                                    onCheckedChange={v => toggle(plan.slug, f.key, v)}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {limitFeatures.map(f => (
                                <div key={f.key} className="p-3 border rounded-lg">
                                    <p className="text-sm font-medium">{f.label}</p>
                                    <Input
                                        type="number"
                                        className="mt-1 h-8 text-xs"
                                        placeholder="-1 = unlimited"
                                        value={matrix[plan.slug]?.[f.key]?.limit_value ?? ''}
                                        onChange={e => setLimit(plan.slug, f.key, parseInt(e.target.value, 10) || 0)}
                                    />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
