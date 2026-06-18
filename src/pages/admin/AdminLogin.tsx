import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Shield, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { adminApi } from '@/lib/adminApi';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();
    const { loginLocal } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.login(email, password);
            if (data.success) {
                const adminUser = { ...data.user, role: 'admin' as const };
                loginLocal(adminUser);
                localStorage.setItem('sv_admin_id', String(data.user.id));
                sessionStorage.setItem('sv_admin_id', String(data.user.id));
                toast({ title: 'Welcome', description: 'Admin access granted.' });
                navigate('/admin/users');
            } else {
                setError(data.error || 'Invalid credentials');
            }
        } catch {
            setError('Connection failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
            <Card className="w-full max-w-md shadow-xl border-t-4 border-t-emerald-600">
                <CardHeader className="text-center">
                    <Shield className="w-10 h-10 mx-auto text-emerald-600 mb-2" />
                    <CardTitle>SocioChat Admin Portal</CardTitle>
                    <p className="text-sm text-muted-foreground">Secure administrator login</p>
                </CardHeader>
                <CardContent>
                    {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input id="email" type="email" className="pl-10" value={email} onChange={e => setEmail(e.target.value)} required />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input id="password" type="password" className="pl-10" value={password} onChange={e => setPassword(e.target.value)} required />
                            </div>
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Authenticate <ArrowRight className="ml-2 h-4 w-4" /></>}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
