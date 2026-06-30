import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Shield, ArrowRight, Loader2, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/branding/BrandingContext';
import { API_BASE_URL } from '@/config';
import type { TenantBranding } from '@/branding/branding';

interface AdminLoginResponse {
    success: boolean;
    error?: string;
    role?: 'super_admin' | 'tenant_admin';
    redirect?: string;
    token?: string;
    user?: {
        id: number;
        email?: string;
        name?: string;
        role?: string;
        tenant_id?: number;
    };
    tenant?: {
        tenant_code: string;
        company_name: string;
        branding: TenantBranding;
    };
}

const ERROR_MESSAGES: Record<string, string> = {
    invalid_credentials: 'Invalid credentials. Check your tenant code, email, and password.',
    not_an_admin: 'This account is not an admin for that tenant.',
    tenant_suspended: 'This tenant is suspended. Contact support.',
    email_password_required: 'Email and password are required.',
};

export default function AdminLogin() {
    const [tenantCode, setTenantCode] = useState(
        () => localStorage.getItem('sv_tenant_code') || '',
    );
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();
    const { loginLocal } = useAuth();
    const { setBranding } = useBranding();

    const handleTenantCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value.toUpperCase().trim();
        setTenantCode(next);
        localStorage.setItem('sv_tenant_code', next);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_BASE_URL}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ tenant_code: tenantCode, email, password }),
            });
            const data: AdminLoginResponse = await res.json();

            if (!data.success) {
                setError(ERROR_MESSAGES[data.error || ''] || data.error || 'Invalid credentials');
                return;
            }

            if (data.role === 'tenant_admin' && data.user && data.tenant) {
                const tenantUser = {
                    id: data.user.id,
                    name: data.user.name,
                    email: data.user.email,
                    role: data.user.role,
                };
                loginLocal(tenantUser);
                localStorage.setItem('sv_user', JSON.stringify(tenantUser));
                sessionStorage.setItem('sv_user', JSON.stringify(tenantUser));
                localStorage.setItem('sv_user_id', String(data.user.id));
                if (data.token) {
                    localStorage.setItem('sv_token', data.token);
                    sessionStorage.setItem('sv_token', data.token);
                }
                localStorage.setItem('sv_tenant_code', data.tenant.tenant_code);
                setBranding(data.tenant.branding, data.tenant.tenant_code);
                toast({ title: 'Welcome', description: `${data.tenant.company_name} admin access granted.` });
                navigate(data.redirect || '/tenant-admin');
                return;
            }

            // super_admin (default / backward-compatible)
            if (data.user) {
                const adminUser = { ...data.user, role: 'admin' as const };
                loginLocal(adminUser);
                localStorage.setItem('sv_admin_id', String(data.user.id));
                sessionStorage.setItem('sv_admin_id', String(data.user.id));
                if (data.token) {
                    localStorage.setItem('sv_token', data.token);
                    sessionStorage.setItem('sv_token', data.token);
                }
            }
            toast({ title: 'Welcome', description: 'Admin access granted.' });
            navigate(data.redirect || '/superadmin/tenants');
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
                            <Label htmlFor="tenant_code">Tenant Code</Label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input
                                    id="tenant_code"
                                    type="text"
                                    className="pl-10 uppercase"
                                    value={tenantCode}
                                    onChange={handleTenantCodeChange}
                                    autoCapitalize="characters"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    placeholder="T0000"
                                    required
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Enter T0000 for Super Admin, or a tenant code for that tenant's admin portal.
                            </p>
                        </div>
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
