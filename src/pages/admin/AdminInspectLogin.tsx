import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserSearch, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { adminApi } from '@/lib/adminApi';
import { useAuth } from '@/contexts/AuthContext';
import { beginAdminInspect, clearUserSessionKeepAdminInspect } from '@/lib/adminInspect';

export default function AdminInspectLogin() {
    const [userId, setUserId] = useState('');
    const [users, setUsers] = useState<{ id: number; name: string; email: string }[]>([]);
    const { toast } = useToast();
    const navigate = useNavigate();
    const { loginLocal } = useAuth();

    useEffect(() => {
        adminApi.getUsers().then(data => {
            if (Array.isArray(data)) setUsers(data);
        });
    }, []);

    const inspect = async (id: number) => {
        const res = await adminApi.loginAsUser(id);
        if (res.success && res.user) {
            beginAdminInspect('/admin/inspect-login');
            clearUserSessionKeepAdminInspect();
            loginLocal(res.user);
            localStorage.setItem('sv_user_id', String(res.user.id));
            if (res.workspaces?.[0]) {
                localStorage.setItem('sv_whatsapp_workspace_id', String(res.workspaces[0].id));
            }
            toast({ title: 'Inspect mode', description: `Viewing as ${res.user.email}` });
            navigate('/dashboard');
        } else {
            toast({ title: 'Failed', description: res.error || 'Could not login as user', variant: 'destructive' });
        }
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2"><UserSearch className="h-6 w-6" /> Inspect Login</h1>
                <p className="text-sm text-muted-foreground">Login as any user for support and debugging</p>
            </div>
            <Card>
                <CardHeader><CardTitle>Quick login by user ID</CardTitle></CardHeader>
                <CardContent className="flex gap-2">
                    <Input placeholder="User ID" value={userId} onChange={e => setUserId(e.target.value)} />
                    <Button onClick={() => inspect(parseInt(userId, 10))} disabled={!userId}>
                        <LogIn className="h-4 w-4 mr-1" /> Go
                    </Button>
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>All users</CardTitle></CardHeader>
                <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                    {users.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-2 border rounded">
                            <div>
                                <p className="font-medium text-sm">{u.name}</p>
                                <p className="text-xs text-muted-foreground">{u.email} · ID {u.id}</p>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => inspect(u.id)}>Inspect</Button>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
