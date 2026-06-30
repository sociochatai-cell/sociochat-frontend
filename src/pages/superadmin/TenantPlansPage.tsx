// src/pages/superadmin/TenantPlansPage.tsx
// Super Admin "Tenant Subscription Plans (White-Label Licenses)" — manages the
// UNIVERSAL white-label LICENSE catalog (the plans the platform sells to tenant
// OWNERS). This is a separate concept from end-user subscription plans; do not
// confuse it with the per-tenant end-user plans on the tenant edit page.
import { useEffect, useMemo, useState } from 'react';
import {
    Plus,
    Pencil,
    Trash2,
    Loader2,
    Save,
    X,
    RefreshCw,
    ScrollText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
    superAdminApi,
    type TenantPlan,
    type TenantPlanInput,
    type FeatureCatalogItem,
    type FeatureOverrideMap,
} from '@/components/superadmin/useSuperAdminApi';
import { FeaturesEditor } from '@/components/superadmin/FeaturesEditor';

const BILLING_PERIODS = ['monthly', 'yearly', 'custom'] as const;
type BillingPeriod = (typeof BILLING_PERIODS)[number];

interface FormState {
    name: string;
    description: string;
    price_inr: string;
    billing_period: BillingPeriod;
    max_end_users: string; // empty => unlimited (-1)
    max_workspaces: string; // empty => unlimited (-1)
    is_active: boolean;
    featureOverrides: FeatureOverrideMap;
}

const EMPTY_FORM: FormState = {
    name: '',
    description: '',
    price_inr: '',
    billing_period: 'monthly',
    max_end_users: '',
    max_workspaces: '',
    is_active: true,
    featureOverrides: {},
};

// -1 (or null) => "Unlimited"; otherwise the number.
function formatLimit(v?: number | null): string {
    if (v == null || v === -1) return 'Unlimited';
    return String(v);
}

function formatLicensePrice(price?: number | null, period?: string | null): string {
    if (price == null) return 'Custom pricing';
    const base = price <= 0 ? 'Free' : `₹${price.toLocaleString('en-IN')}`;
    if (price <= 0) return base;
    if (period === 'yearly') return `${base}/yr`;
    if (period === 'monthly') return `${base}/mo`;
    return base;
}

export default function TenantPlansPage() {
    const { toast } = useToast();

    const [plans, setPlans] = useState<TenantPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [features, setFeatures] = useState<FeatureCatalogItem[]>([]);
    const [featuresLoading, setFeaturesLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        try {
            const res = await superAdminApi.listLicensePlans();
            setPlans(Array.isArray(res.plans) ? res.plans : []);
        } catch (e: any) {
            toast({
                title: 'Error',
                description: e?.message || 'Failed to load license plans',
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

    // Load the feature catalog once on mount (tolerate failures).
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const res = await superAdminApi.listFeatures();
                if (active) setFeatures(Array.isArray(res.features) ? res.features : []);
            } catch {
                if (active) setFeatures([]);
            } finally {
                if (active) setFeaturesLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, []);

    const sortedPlans = useMemo(
        () =>
            [...plans].sort(
                (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name),
            ),
        [plans],
    );

    const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const openCreate = () => {
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        setShowForm(true);
    };

    const openEdit = (plan: TenantPlan) => {
        setEditingId(plan.id);
        setForm({
            name: plan.name || '',
            description: plan.description || '',
            price_inr: plan.price_inr == null ? '' : String(plan.price_inr),
            billing_period: (BILLING_PERIODS.includes(plan.billing_period as BillingPeriod)
                ? (plan.billing_period as BillingPeriod)
                : 'monthly'),
            // Treat -1/null as "unlimited" => blank input.
            max_end_users: plan.max_end_users == null || plan.max_end_users === -1 ? '' : String(plan.max_end_users),
            max_workspaces: plan.max_workspaces == null || plan.max_workspaces === -1 ? '' : String(plan.max_workspaces),
            is_active: plan.is_active !== false,
            // Already in the matrix shape on the backend.
            featureOverrides: plan.features || {},
        });
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
    };

    const buildPayload = (): TenantPlanInput => {
        const priceTrim = form.price_inr.trim();
        const usersTrim = form.max_end_users.trim();
        const wsTrim = form.max_workspaces.trim();
        return {
            name: form.name.trim(),
            description: form.description.trim() || undefined,
            price_inr: priceTrim === '' ? undefined : Number(priceTrim),
            billing_period: form.billing_period,
            // Blank means unlimited => send -1.
            max_end_users: usersTrim === '' ? -1 : Number(usersTrim),
            max_workspaces: wsTrim === '' ? -1 : Number(wsTrim),
            is_active: form.is_active,
            features: form.featureOverrides,
        };
    };

    const submit = async () => {
        if (!form.name.trim()) {
            toast({ title: 'Plan name required', variant: 'destructive' });
            return;
        }
        setSaving(true);
        try {
            const payload = buildPayload();
            if (editingId != null) {
                await superAdminApi.updateLicensePlan(editingId, payload);
                toast({ title: 'License plan updated', description: payload.name });
            } else {
                await superAdminApi.createLicensePlan(payload);
                toast({ title: 'License plan created', description: payload.name });
            }
            await load();
            closeForm();
        } catch (e: any) {
            toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const removePlan = async (plan: TenantPlan) => {
        if (!window.confirm(`Delete license plan "${plan.name}"? Tenants currently on it will need a new plan.`)) return;
        setDeletingId(plan.id);
        try {
            await superAdminApi.deleteLicensePlan(plan.id);
            toast({ title: 'License plan deleted', description: plan.name });
            setPlans((prev) => prev.filter((p) => p.id !== plan.id));
        } catch (e: any) {
            toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' });
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="w-full min-w-0 space-y-6">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ScrollText className="h-6 w-6 text-emerald-600" /> Tenant Subscription Plans (White-Label Licenses)
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        The universal license catalog you sell to tenant owners. Assign a license to a tenant
                        from its Subscription tab. These are separate from each tenant&apos;s own end-user plans.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" onClick={load} disabled={loading}>
                        <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                        Refresh
                    </Button>
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4" /> Create License Plan
                    </Button>
                </div>
            </div>

            {/* Create / edit form */}
            {showForm && (
                <Card className="min-w-0 border-emerald-200">
                    <CardHeader>
                        <CardTitle className="text-base">
                            {editingId != null ? 'Edit license plan' : 'New license plan'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Name *</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => setField('name', e.target.value)}
                                    placeholder="e.g. Growth"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Price (₹)</Label>
                                <Input
                                    type="number"
                                    value={form.price_inr}
                                    onChange={(e) => setField('price_inr', e.target.value)}
                                    placeholder="0"
                                />
                                <p className="text-xs text-muted-foreground">Leave blank for custom pricing.</p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Description</Label>
                            <Input
                                value={form.description}
                                onChange={(e) => setField('description', e.target.value)}
                                placeholder="Short blurb shown when assigning this license"
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label>Billing period</Label>
                                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                                    {BILLING_PERIODS.map((bp) => (
                                        <button
                                            key={bp}
                                            type="button"
                                            onClick={() => setField('billing_period', bp)}
                                            className={cn(
                                                'flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors',
                                                form.billing_period === bp
                                                    ? 'bg-white shadow-sm text-slate-900'
                                                    : 'text-slate-500 hover:text-slate-700',
                                            )}
                                        >
                                            {bp}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Max end-users</Label>
                                <Input
                                    type="number"
                                    value={form.max_end_users}
                                    onChange={(e) => setField('max_end_users', e.target.value)}
                                    placeholder="Unlimited"
                                />
                                <p className="text-xs text-muted-foreground">Blank = unlimited.</p>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Max workspaces</Label>
                                <Input
                                    type="number"
                                    value={form.max_workspaces}
                                    onChange={(e) => setField('max_workspaces', e.target.value)}
                                    placeholder="Unlimited"
                                />
                                <p className="text-xs text-muted-foreground">Blank = unlimited.</p>
                            </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                checked={form.is_active}
                                onChange={(e) => setField('is_active', e.target.checked)}
                            />
                            <span>Active (available to assign to tenants)</span>
                        </label>

                        <div className="space-y-2 pt-2 border-t">
                            <Label>Features &amp; limits</Label>
                            <p className="text-xs text-muted-foreground">
                                Choose which features this license grants. Limit-type features accept a cap (blank = unlimited).
                            </p>
                            <FeaturesEditor
                                features={features}
                                overrides={form.featureOverrides}
                                onChange={(o) => setField('featureOverrides', o)}
                                loading={featuresLoading}
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                            <Button onClick={submit} disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                                {editingId != null ? 'Save changes' : 'Create plan'}
                            </Button>
                            <Button variant="outline" onClick={closeForm} disabled={saving}>
                                <X className="h-4 w-4 mr-1" /> Cancel
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card className="min-w-0">
                <CardHeader>
                    <CardTitle>License catalog ({sortedPlans.length})</CardTitle>
                </CardHeader>
                <CardContent className="min-w-0">
                    {loading ? (
                        <p className="text-sm text-muted-foreground py-6">Loading license plans…</p>
                    ) : sortedPlans.length === 0 ? (
                        <div className="py-12 text-center">
                            <ScrollText className="mx-auto h-10 w-10 text-slate-300" />
                            <p className="mt-3 text-sm text-muted-foreground">No license plans yet.</p>
                            <Button className="mt-4" onClick={openCreate}>
                                <Plus className="h-4 w-4" /> Create your first license plan
                            </Button>
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {sortedPlans.map((plan) => (
                                <div
                                    key={plan.id}
                                    className="flex flex-col rounded-xl border border-slate-200 p-4"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900">{plan.name}</p>
                                            <p className="text-xs text-muted-foreground font-mono break-all">{plan.slug}</p>
                                        </div>
                                        <Badge
                                            className={cn(
                                                plan.is_active !== false
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-slate-100 text-slate-600',
                                            )}
                                        >
                                            {plan.is_active !== false ? 'Active' : 'Inactive'}
                                        </Badge>
                                    </div>

                                    <p className="mt-2 text-sm font-medium text-emerald-700">
                                        {formatLicensePrice(plan.price_inr, plan.billing_period)}
                                    </p>

                                    {plan.description && (
                                        <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                                            {plan.description}
                                        </p>
                                    )}

                                    <dl className="mt-3 space-y-1 text-xs">
                                        <div className="flex justify-between gap-2">
                                            <dt className="text-muted-foreground">Max end-users</dt>
                                            <dd className="font-medium">{formatLimit(plan.max_end_users)}</dd>
                                        </div>
                                        <div className="flex justify-between gap-2">
                                            <dt className="text-muted-foreground">Max workspaces</dt>
                                            <dd className="font-medium">{formatLimit(plan.max_workspaces)}</dd>
                                        </div>
                                    </dl>

                                    <div className="mt-4 flex items-center gap-2 pt-3 border-t">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => openEdit(plan)}
                                        >
                                            <Pencil className="h-4 w-4 mr-1" /> Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700"
                                            disabled={deletingId === plan.id}
                                            onClick={() => removePlan(plan)}
                                        >
                                            {deletingId === plan.id
                                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                                : <Trash2 className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
          </div>
        </div>
    );
}
