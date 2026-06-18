import { useEffect, useState } from 'react';
import { Save, Plus, Loader2, Trash2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { adminApi } from '@/lib/adminApi';

interface Plan {
    slug: string;
    name: string;
    price_monthly_inr?: number | null;
    is_active?: boolean;
    is_public?: boolean;
    user_count?: number;
    is_deletable?: boolean;
    is_system?: boolean;
}
interface Feature { key: string; label: string; feature_type: string; category: string }
type Matrix = Record<string, Record<string, { enabled: boolean; limit_value?: number | null }>>

export default function AdminPlans() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [features, setFeatures] = useState<Feature[]>([]);
    const [matrix, setMatrix] = useState<Matrix>({});
    const [planEdits, setPlanEdits] = useState<Record<string, { name: string; is_active: boolean }>>({});
    const [saving, setSaving] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [newPlan, setNewPlan] = useState({ slug: '', name: '' });
    const { toast } = useToast();

    const load = async () => {
        setLoading(true);
        const res = await adminApi.getPlansMatrix();
        if (res.success) {
            const list: Plan[] = res.plans || [];
            setPlans(list);
            setFeatures(res.features || []);
            setMatrix(res.matrix || {});
            const edits: Record<string, { name: string; is_active: boolean }> = {};
            list.forEach(p => {
                edits[p.slug] = { name: p.name, is_active: p.is_active !== false };
            });
            setPlanEdits(edits);
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

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
        const res = await adminApi.updatePlanFeatures(slug, matrix[slug] || {});
        if (res.success) {
            toast({ title: 'Saved', description: `Features updated for ${slug}` });
        } else {
            toast({ title: 'Error', description: res.error || 'Save failed', variant: 'destructive' });
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
        const res = await adminApi.updatePlanCatalog(slug, {
            name: edit.name.trim(),
            is_active: edit.is_active,
        });
        if (res.success) {
            toast({ title: 'Plan updated', description: `${edit.name} saved` });
            load();
        } else {
            toast({ title: 'Error', description: res.error || 'Update failed', variant: 'destructive' });
        }
        setSaving(null);
    };

    const deletePlan = async (slug: string) => {
        const plan = plans.find(p => p.slug === slug);
        if (!plan?.is_deletable) return;
        if (!window.confirm(`Delete plan "${plan.name}" (${slug})? This cannot be undone.`)) return;

        setSaving(`delete-${slug}`);
        const res = await adminApi.deletePlan(slug);
        if (res.success) {
            toast({ title: 'Plan deleted' });
            load();
        } else {
            toast({
                title: 'Cannot delete',
                description: res.message || res.error || 'Delete failed',
                variant: 'destructive',
            });
        }
        setSaving(null);
    };

    const createPlan = async () => {
        if (!newPlan.slug || !newPlan.name) return;
        const res = await adminApi.createPlan(newPlan);
        if (res.success) {
            toast({ title: 'Plan created' });
            setNewPlan({ slug: '', name: '' });
            load();
        } else {
            toast({ title: 'Error', description: res.error || 'Create failed', variant: 'destructive' });
        }
    };

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    const accessFeatures = features.filter(f => f.feature_type === 'access');
    const limitFeatures = features.filter(f => f.feature_type === 'limit');
    const matrixPlans = plans.filter(p => p.slug !== 'beta');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Plans & Feature Matrix</h1>
                <p className="text-sm text-muted-foreground">
                    Edit plan names, set active/inactive, delete unused custom plans, and control features per plan.
                </p>
            </div>

            <Card>
                <CardHeader><CardTitle className="text-base">All subscription plans</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    {plans.map(plan => {
                        const edit = planEdits[plan.slug] || { name: plan.name, is_active: plan.is_active !== false };
                        const active = edit.is_active;
                        return (
                            <div key={plan.slug} className="flex flex-wrap items-center gap-3 p-3 border rounded-lg bg-white">
                                <div className="flex-1 min-w-[180px] space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <Input
                                            value={edit.name}
                                            onChange={e => setPlanEdits(prev => ({
                                                ...prev,
                                                [plan.slug]: { ...edit, name: e.target.value },
                                            }))}
                                            className="h-8 max-w-[200px] font-medium"
                                        />
                                        <Badge variant={active ? 'default' : 'secondary'} className={active ? 'bg-emerald-600' : ''}>
                                            {active ? 'Active' : 'Inactive'}
                                        </Badge>
                                        {plan.is_system && (
                                            <Badge variant="outline" className="text-xs">Built-in</Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        slug: {plan.slug} · {plan.user_count ?? 0} user(s)
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Active</span>
                                    <Switch
                                        checked={active}
                                        onCheckedChange={v => setPlanEdits(prev => ({
                                            ...prev,
                                            [plan.slug]: { ...edit, is_active: v },
                                        }))}
                                    />
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => savePlanMeta(plan.slug)}
                                    disabled={saving === `meta-${plan.slug}`}
                                >
                                    {saving === `meta-${plan.slug}` ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <><Pencil className="h-3 w-3 mr-1" /> Save name</>
                                    )}
                                </Button>
                                {plan.is_deletable ? (
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => deletePlan(plan.slug)}
                                        disabled={saving === `delete-${plan.slug}`}
                                    >
                                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                                    </Button>
                                ) : (
                                    <span className="text-[10px] text-muted-foreground max-w-[120px]">
                                        {plan.is_system ? 'Built-in — deactivate only' : 'In use — cannot delete'}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-base">Create new plan</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <Input placeholder="slug (e.g. pro)" value={newPlan.slug} onChange={e => setNewPlan(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} className="w-40" />
                    <Input placeholder="Display name" value={newPlan.name} onChange={e => setNewPlan(p => ({ ...p, name: e.target.value }))} className="w-48" />
                    <Button onClick={createPlan}><Plus className="h-4 w-4 mr-1" /> Create</Button>
                </CardContent>
            </Card>

            {matrixPlans.map(plan => (
                <Card key={plan.slug} className={planEdits[plan.slug]?.is_active === false ? 'opacity-60' : ''}>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>{planEdits[plan.slug]?.name || plan.name}</CardTitle>
                            <p className="text-xs text-muted-foreground">slug: {plan.slug}</p>
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
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
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
