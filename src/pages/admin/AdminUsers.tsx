import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

export default function AdminUsers() {
    const [users, setUsers] = useState<UserRow[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const navigate = useNavigate();
    const { loginLocal } = useAuth();

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
                            <Button size="sm" variant="outline" onClick={() => inspectLogin(u.id)}>
                                <LogIn className="h-4 w-4 mr-1" /> Inspect
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
