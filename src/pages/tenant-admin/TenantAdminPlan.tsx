// src/pages/tenant-admin/TenantAdminPlan.tsx
// Tenant Admin "Plans & Features": a tenant-scoped, white-labeled replica of the
// platform super-admin plan CATALOG page (AdminPlans). These are the subscription
// plans THIS tenant offers its own users. Mirrors AdminPlans UX:
//   1. Create-plan card — a name (+ optional ₹/month price) → createPlan.
//   2. Per-plan cards — editable name, read-only slug, Active/Inactive switch +
//      badge, "Save name" (updatePlan), and a Delete (deletePlan) with confirm.
//   3. Feature matrix per plan — ACCESS features as Switch toggles, LIMIT features
//      as numeric inputs, prefilled from the plan's features map, saved with
//      "Save features" (updatePlanFeatures). Saving applies to every user on that
//      plan (handled server-side).
// Tenant admins only see/manage THEIR OWN custom end-user plans here — SocioChat's
// global base plans are intentionally not shown.
// Everything is scoped to the admin's own tenant via /api/tenant/admin/* and uses
// tenantAdminApi (NOT adminApi). Brand-remapped emerald/slate utilities.
import { useEffect, useState } from 'react';
import { Save, Plus, Loader2, Trash2, Pencil, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
    tenantAdminApi,
    type TenantCustomPlan,
    type TenantPlanFeatureMap,
    type FeatureCatalogItem,
} from './tenantAdminApi';

/** Per-plan name + active + billing-period + price + offer edits, keyed by plan id (as string). */
interface PlanEdit { name: string; is_active: boolean; billing_period: string; price: string; offer_text: string }
/** Feature matrix keyed by plan id (string) → feature key → cell. */
type Matrix = Record<string, TenantPlanFeatureMap>;

const isLimit = (f: FeatureCatalogItem): boolean =>
    (f.feature_type || '').toLowerCase() === 'limit';

/** Allowed billing cadences for an end-user plan. */
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

export default function TenantAdminPlan() {
    const { toast } = useToast();

    const [plans, setPlans] = useState<TenantCustomPlan[]>([]);
    const [features, setFeatures] = useState<FeatureCatalogItem[]>([]);
    const [matrix, setMatrix] = useState<Matrix>({});
    const [planEdits, setPlanEdits] = useState<Record<string, PlanEdit>>({});
    const [saving, setSaving] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [newPlan, setNewPlan] = useState<{ name: string; price: string; billing_period: string; offer_text: string }>({
        name: '',
        price: '',
        billing_period: 'monthly',
        offer_text: '',
    });
    const [creating, setCreating] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [plansRes, catRes] = await Promise.all([
                tenantAdminApi.listPlans(),
                tenantAdminApi.featuresCatalog(),
            ]);
            const list = plansRes.custom_plans || [];
            setPlans(list);
            setFeatures(catRes.features || []);

            // Seed per-plan name/active edits + the feature matrix from each
            // plan's current features map.
            const edits: Record<string, PlanEdit> = {};
            const mtx: Matrix = {};
            list.forEach((p) => {
                const id = String(p.id);
                edits[id] = {
                    name: p.name,
                    is_active: p.is_active !== false,
                    billing_period: (p.billing_period || 'monthly').toLowerCase(),
                    price: p.price_monthly_inr != null ? String(p.price_monthly_inr) : '',
                    offer_text: p.offer_text ?? '',
                };
                mtx[id] = { ...(p.features || {}) };
            });
            setPlanEdits(edits);
            setMatrix(mtx);
        } catch (e: any) {
            toast({ title: 'Failed to load plans', description: e?.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    /* ----------------------------- Matrix edits ----------------------------- */

    const toggle = (planId: string, featureKey: string, enabled: boolean) => {
        setMatrix((prev) => {
            const cell: TenantPlanFeatureMap[string] = prev[planId]?.[featureKey] || { enabled: false };
            return {
                ...prev,
                [planId]: {
                    ...prev[planId],
                    [featureKey]: { ...cell, enabled },
                },
            };
        });
    };

    const setLimit = (planId: string, featureKey: string, limit_value: number) => {
        setMatrix((prev) => ({
            ...prev,
            [planId]: {
                ...prev[planId],
                [featureKey]: { enabled: true, limit_value },
            },
        }));
    };

    /* ------------------------------- Actions -------------------------------- */

    const saveFeatures = async (planId: string) => {
        setSaving(`features-${planId}`);
        try {
            await tenantAdminApi.updatePlanFeatures(planId, matrix[planId] || {});
            toast({ title: 'Saved', description: 'Plan features updated for all users on this plan.' });
        } catch (e: any) {
            toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(null);
        }
    };

    const savePlanMeta = async (planId: string) => {
        const edit = planEdits[planId];
        if (!edit?.name?.trim()) {
            toast({ title: 'Name required', variant: 'destructive' });
            return;
        }
        const priceNum = edit.price.trim() ? Number(edit.price) : undefined;
        if (priceNum !== undefined && Number.isNaN(priceNum)) {
            toast({ title: 'Price must be a number', variant: 'destructive' });
            return;
        }
        setSaving(`meta-${planId}`);
        try {
            await tenantAdminApi.updatePlan(planId, {
                name: edit.name.trim(),
                is_active: edit.is_active,
                billing_period: edit.billing_period,
                ...(priceNum !== undefined ? { price_monthly_inr: priceNum } : {}),
                offer_text: edit.offer_text,
            });
            toast({ title: 'Plan updated', description: `${edit.name} saved` });
            load();
        } catch (e: any) {
            toast({ title: 'Update failed', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(null);
        }
    };

    const deletePlan = async (plan: TenantCustomPlan) => {
        if (!window.confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
        const id = String(plan.id);
        setSaving(`delete-${id}`);
        try {
            await tenantAdminApi.deletePlan(plan.id);
            toast({ title: 'Plan deleted' });
            load();
        } catch (e: any) {
            toast({ title: 'Cannot delete', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(null);
        }
    };

    const createPlan = async () => {
        const name = newPlan.name.trim();
        if (!name) {
            toast({ title: 'Name required', variant: 'destructive' });
            return;
        }
        const priceNum = newPlan.price.trim() ? Number(newPlan.price) : undefined;
        if (priceNum !== undefined && Number.isNaN(priceNum)) {
            toast({ title: 'Price must be a number', variant: 'destructive' });
            return;
        }
        setCreating(true);
        try {
            await tenantAdminApi.createPlan({
                name,
                ...(priceNum !== undefined ? { price_monthly_inr: priceNum } : {}),
                billing_period: newPlan.billing_period,
                offer_text: newPlan.offer_text,
                features: {},
            });
            toast({ title: 'Plan created' });
            setNewPlan({ name: '', price: '', billing_period: 'monthly', offer_text: '' });
            load();
        } catch (e: any) {
            toast({ title: 'Create failed', description: e?.message, variant: 'destructive' });
        } finally {
            setCreating(false);
        }
    };

    /* -------------------------------- Render -------------------------------- */

    if (loading) {
        return (
            <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
            </div>
        );
    }

    const accessFeatures = features.filter((f) => !isLimit(f));
    const limitFeatures = features.filter((f) => isLimit(f));

    return (
        <div className="w-full min-w-0 space-y-6 mx-auto max-w-5xl">
            {/* Page header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-emerald-600" /> Plans &amp; Features
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        The subscription plans you offer your users. Create plans, edit names &amp; active state,
                        and control the features and limits each plan grants.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={load}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                </Button>
            </div>

            {/* ============================ Create plan ============================ */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Create new plan</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="new-plan-name">Name</Label>
                        <Input
                            id="new-plan-name"
                            placeholder="e.g. Pro"
                            value={newPlan.name}
                            onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))}
                            className="w-52"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="new-plan-price">Price (₹)</Label>
                        <Input
                            id="new-plan-price"
                            type="number"
                            placeholder="optional"
                            value={newPlan.price}
                            onChange={(e) => setNewPlan((p) => ({ ...p, price: e.target.value }))}
                            className="w-40"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="new-plan-period">Billing period</Label>
                        <select
                            id="new-plan-period"
                            value={newPlan.billing_period}
                            onChange={(e) => setNewPlan((p) => ({ ...p, billing_period: e.target.value }))}
                            className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            {BILLING_PERIODS.map((bp) => (
                                <option key={bp.value} value={bp.value}>{bp.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="new-plan-offer">Offer text</Label>
                        <Input
                            id="new-plan-offer"
                            placeholder="e.g. Save 20% this month"
                            value={newPlan.offer_text}
                            onChange={(e) => setNewPlan((p) => ({ ...p, offer_text: e.target.value }))}
                            className="w-56"
                        />
                    </div>
                    <Button onClick={createPlan} disabled={creating}>
                        {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                        Create
                    </Button>
                </CardContent>
            </Card>

            {/* ========================= Per-plan cards ========================= */}
            {plans.length === 0 ? (
                <Card>
                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                        No plans yet. Create your first plan above.
                    </CardContent>
                </Card>
            ) : (
                plans.map((plan) => {
                    const id = String(plan.id);
                    const edit = planEdits[id] || {
                        name: plan.name,
                        is_active: plan.is_active !== false,
                        billing_period: (plan.billing_period || 'monthly').toLowerCase(),
                        price: plan.price_monthly_inr != null ? String(plan.price_monthly_inr) : '',
                        offer_text: plan.offer_text ?? '',
                    };
                    const active = edit.is_active;
                    return (
                        <Card key={id} className={active ? '' : 'opacity-60'}>
                            <CardHeader className="space-y-3">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex-1 min-w-[200px] space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Input
                                                value={edit.name}
                                                onChange={(e) => setPlanEdits((prev) => ({
                                                    ...prev,
                                                    [id]: { ...edit, name: e.target.value },
                                                }))}
                                                className="h-8 max-w-[220px] font-medium"
                                            />
                                            <Badge
                                                variant={active ? 'default' : 'secondary'}
                                                className={active ? 'bg-emerald-600' : ''}
                                            >
                                                {active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            slug: {plan.slug}
                                            {plan.price_monthly_inr != null
                                                ? ` · ₹${plan.price_monthly_inr}${periodSuffix(edit.billing_period)}`
                                                : ` · ${periodLabel(edit.billing_period)}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Billing</span>
                                        <select
                                            value={edit.billing_period}
                                            onChange={(e) => setPlanEdits((prev) => ({
                                                ...prev,
                                                [id]: { ...edit, billing_period: e.target.value },
                                            }))}
                                            className="flex h-8 w-32 rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        >
                                            {BILLING_PERIODS.map((bp) => (
                                                <option key={bp.value} value={bp.value}>{bp.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Price (₹)</span>
                                        <Input
                                            type="number"
                                            placeholder="optional"
                                            value={edit.price}
                                            onChange={(e) => setPlanEdits((prev) => ({
                                                ...prev,
                                                [id]: { ...edit, price: e.target.value },
                                            }))}
                                            className="h-8 w-28"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Offer</span>
                                        <Input
                                            placeholder="e.g. Save 20%"
                                            value={edit.offer_text}
                                            onChange={(e) => setPlanEdits((prev) => ({
                                                ...prev,
                                                [id]: { ...edit, offer_text: e.target.value },
                                            }))}
                                            className="h-8 w-44"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Active</span>
                                        <Switch
                                            checked={active}
                                            onCheckedChange={(v) => setPlanEdits((prev) => ({
                                                ...prev,
                                                [id]: { ...edit, is_active: v },
                                            }))}
                                        />
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => savePlanMeta(id)}
                                        disabled={saving === `meta-${id}`}
                                    >
                                        {saving === `meta-${id}` ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <><Pencil className="h-3 w-3 mr-1" /> Save name</>
                                        )}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => deletePlan(plan)}
                                        disabled={saving === `delete-${id}`}
                                    >
                                        {saving === `delete-${id}` ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <><Trash2 className="h-3 w-3 mr-1" /> Delete</>
                                        )}
                                    </Button>
                                </div>
                            </CardHeader>

                            <CardContent className="space-y-4">
                                {/* Access features (toggles) */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b text-left">
                                                <th className="py-2 pr-4">Feature</th>
                                                <th className="py-2">Enabled</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {accessFeatures.length === 0 ? (
                                                <tr>
                                                    <td colSpan={2} className="py-3 text-xs text-muted-foreground">
                                                        No access features in the catalog.
                                                    </td>
                                                </tr>
                                            ) : (
                                                accessFeatures.map((f) => {
                                                    const cell: TenantPlanFeatureMap[string] | undefined = matrix[id]?.[f.key];
                                                    return (
                                                        <tr key={f.key} className="border-b border-slate-100">
                                                            <td className="py-2 pr-4">
                                                                <p className="font-medium">{f.label}</p>
                                                                <p className="text-xs text-muted-foreground">{f.key}</p>
                                                            </td>
                                                            <td className="py-2">
                                                                <Switch
                                                                    checked={cell?.enabled ?? false}
                                                                    onCheckedChange={(v) => toggle(id, f.key, v)}
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Limit features (numeric inputs) */}
                                {limitFeatures.length > 0 && (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                                        {limitFeatures.map((f) => {
                                            const cell: TenantPlanFeatureMap[string] | undefined = matrix[id]?.[f.key];
                                            return (
                                                <div key={f.key} className="p-3 border rounded-lg">
                                                    <p className="text-sm font-medium">{f.label}</p>
                                                    <Input
                                                        type="number"
                                                        className="mt-1 h-8 text-xs"
                                                        placeholder="-1 = unlimited"
                                                        value={cell?.limit_value ?? ''}
                                                        onChange={(e) => setLimit(
                                                            id,
                                                            f.key,
                                                            e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0,
                                                        )}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="flex justify-end pt-1">
                                    <Button
                                        onClick={() => saveFeatures(id)}
                                        disabled={saving === `features-${id}`}
                                    >
                                        {saving === `features-${id}` ? (
                                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                        ) : (
                                            <Save className="h-4 w-4 mr-1" />
                                        )}
                                        Save features
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })
            )}
        </div>
    );
}
