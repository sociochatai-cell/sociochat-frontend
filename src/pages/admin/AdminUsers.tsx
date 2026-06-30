import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LogIn, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { adminApi } from '@/lib/adminApi';
import { useAuth } from '@/contexts/AuthContext';
import { beginAdminInspect, clearUserSessionKeepAdminInspect } from '@/lib/adminInspect';

interface UserRow {
    id: number;
    name: string;
    email: string;
    plan?: string;
    status?: string;
    role?: string;
}

interface FeatureDef {
    key: string;
    label: string;
    feature_type: string;
    category: string;
}

interface UserFeaturesResponse {
    success: boolean;
    user: { id: number; name: string; email: string; plan: string; billing_scope: string };
    features: FeatureDef[];
    plan_defaults: Record<string, boolean>;
    overrides: Record<string, boolean>;
    // Present on the PUT response: per-user numeric limit overrides (e.g. workspaces).
    limit_overrides?: Record<string, number | null>;
}

type FeatureChoice = 'inherit' | 'on' | 'off';

export default function AdminUsers() {
    const [users, setUsers] = useState<UserRow[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const navigate = useNavigate();
    const { loginLocal } = useAuth();

    // Per-user feature override dialog state.
    const [featuresOpen, setFeaturesOpen] = useState(false);
    const [featuresUserId, setFeaturesUserId] = useState<number | null>(null);
    const [featuresLoading, setFeaturesLoading] = useState(false);
    const [featuresData, setFeaturesData] = useState<UserFeaturesResponse | null>(null);
    const [featureChoices, setFeatureChoices] = useState<Record<string, FeatureChoice>>({});
    const [featuresSaving, setFeaturesSaving] = useState(false);
    // Per-user "Max workspaces" cap. '' = inherit plan/tenant; -1 = unlimited.
    const [maxWorkspaces, setMaxWorkspaces] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getUsers();
            setUsers(Array.isArray(data) ? data : []);
        } catch {
            toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const filtered = users.filter(u =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase())
    );

    const updatePlan = async (userId: number, plan: string) => {
        const res = await adminApi.updateUser(userId, { plan });
        if (res.success) {
            toast({ title: 'Updated', description: `Plan set to ${plan}` });
            load();
        }
    };

    const inspectLogin = async (userId: number) => {
        const res = await adminApi.loginAsUser(userId);
        if (res.success && res.user) {
            beginAdminInspect('/admin/users');
            clearUserSessionKeepAdminInspect();
            loginLocal(res.user);
            localStorage.setItem('sv_user_id', String(res.user.id));
            if (res.workspaces?.[0]) {
                localStorage.setItem('sv_whatsapp_workspace_id', String(res.workspaces[0].id));
            }
            toast({ title: 'Inspect mode', description: `Logged in as ${res.user.email}` });
            navigate('/dashboard');
        }
    };

    const openFeatures = async (userId: number) => {
        setFeaturesUserId(userId);
        setFeaturesOpen(true);
        setFeaturesLoading(true);
        setFeaturesData(null);
        setFeatureChoices({});
        setMaxWorkspaces('');
        try {
            const data: UserFeaturesResponse = await adminApi.getUserFeatures(userId);
            if (!data.success) {
                toast({ title: 'Error', description: 'Failed to load features', variant: 'destructive' });
                return;
            }
            const choices: Record<string, FeatureChoice> = {};
            for (const f of data.features) {
                if (Object.prototype.hasOwnProperty.call(data.overrides, f.key)) {
                    choices[f.key] = data.overrides[f.key] ? 'on' : 'off';
                } else {
                    choices[f.key] = 'inherit';
                }
            }
            setFeaturesData(data);
            setFeatureChoices(choices);
        } catch {
            toast({ title: 'Error', description: 'Failed to load features', variant: 'destructive' });
        } finally {
            setFeaturesLoading(false);
        }
    };

    const saveFeatures = async () => {
        if (featuresUserId == null || !featuresData) return;
        setFeaturesSaving(true);
        try {
            const payload: Record<string, boolean | number | null> = {};
            for (const f of featuresData.features) {
                const choice = featureChoices[f.key] ?? 'inherit';
                payload[f.key] = choice === 'inherit' ? null : choice === 'on';
            }
            // Per-user "Max workspaces" cap: '' = inherit (null), else an int
            // (-1 = unlimited). Sent in the same overrides map; the backend
            // routes LIMIT keys to numeric handling.
            const wsTrim = maxWorkspaces.trim();
            payload.workspaces = wsTrim === '' ? null : (Number.parseInt(wsTrim, 10) || 0);
            const res = await adminApi.setUserFeatures(featuresUserId, payload);
            if (res.success) {
                toast({ title: 'Features updated' });
                setFeaturesOpen(false);
            } else {
                toast({ title: 'Error', description: 'Failed to update features', variant: 'destructive' });
            }
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to update features',
                variant: 'destructive',
            });
        } finally {
            setFeaturesSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">User Management</h1>
                <p className="text-muted-foreground text-sm">Manage users, plans, and inspect accounts</p>
            </div>
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input className="pl-10" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Card>
                <CardHeader><CardTitle>Users ({filtered.length})</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    {loading ? <p className="text-sm text-muted-foreground">Loading...</p> : filtered.map(u => (
                        <div key={u.id} className="flex flex-wrap items-center gap-3 p-3 border rounded-lg bg-white">
                            <div className="flex-1 min-w-[200px]">
                                <p className="font-medium">{u.name}</p>
                                <p className="text-sm text-muted-foreground">{u.email}</p>
                            </div>
                            <Badge variant="outline">{u.status || 'active'}</Badge>
                            <Select value={u.plan || 'beta'} onValueChange={v => updatePlan(u.id, v)}>
                                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {['beta', 'starter', 'growth', 'enterprise'].map(p => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button size="sm" variant="outline" onClick={() => openFeatures(u.id)}>
                                <SlidersHorizontal className="h-4 w-4 mr-1" /> Features
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => inspectLogin(u.id)}>
                                <LogIn className="h-4 w-4 mr-1" /> Inspect
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Dialog open={featuresOpen} onOpenChange={setFeaturesOpen}>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Feature overrides</DialogTitle>
                        <DialogDescription>
                            {featuresData ? (
                                <span>
                                    {featuresData.user.name} ({featuresData.user.email}) — plan{' '}
                                    <span className="font-medium">{featuresData.user.plan}</span>. Overrides win over the
                                    plan. Plan default applies when set to inherit.
                                </span>
                            ) : (
                                'Overrides win over the plan. Plan default applies when set to inherit.'
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    {featuresLoading ? (
                        <p className="text-sm text-muted-foreground py-6">Loading features...</p>
                    ) : !featuresData ? (
                        <p className="text-sm text-muted-foreground py-6">No features available for this user.</p>
                    ) : (
                        <div className="max-h-[55vh] overflow-y-auto space-y-2 pr-1">
                            {/* Per-user numeric limit override: Max workspaces */}
                            <div className="flex flex-wrap items-center gap-3 p-3 border rounded-lg">
                                <div className="flex-1 min-w-[180px]">
                                    <p className="font-medium text-sm">Max workspaces</p>
                                    <p className="text-xs text-muted-foreground">
                                        workspaces · blank = inherit plan/tenant, -1 = unlimited
                                    </p>
                                </div>
                                <Input
                                    type="number"
                                    className="w-44"
                                    placeholder="Inherit"
                                    value={maxWorkspaces}
                                    onChange={e => setMaxWorkspaces(e.target.value)}
                                />
                            </div>
                            {featuresData.features.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-3">
                                    No access features available for this user.
                                </p>
                            ) : featuresData.features.map(f => {
                                const planOn = !!featuresData.plan_defaults[f.key];
                                const choice = featureChoices[f.key] ?? 'inherit';
                                return (
                                    <div
                                        key={f.key}
                                        className="flex flex-wrap items-center gap-3 p-3 border rounded-lg"
                                    >
                                        <div className="flex-1 min-w-[180px]">
                                            <p className="font-medium text-sm">{f.label}</p>
                                            <p className="text-xs text-muted-foreground">{f.key}</p>
                                        </div>
                                        <Select
                                            value={choice}
                                            onValueChange={v =>
                                                setFeatureChoices(prev => ({ ...prev, [f.key]: v as FeatureChoice }))
                                            }
                                        >
                                            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="inherit">
                                                    Plan default ({planOn ? 'On' : 'Off'})
                                                </SelectItem>
                                                <SelectItem value="on">On</SelectItem>
                                                <SelectItem value="off">Off</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFeaturesOpen(false)} disabled={featuresSaving}>
                            Cancel
                        </Button>
                        <Button
                            onClick={saveFeatures}
                            disabled={featuresSaving || featuresLoading || !featuresData}
                        >
                            {featuresSaving ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
