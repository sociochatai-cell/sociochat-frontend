import { useState, useEffect, useRef } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { API_BASE_URL } from '@/config';
import { clearAllUserData } from '@/lib/userSession';
import { clearCache } from '@/whatsapp/hooks/useDataCache';
import { getWorkspaceId, setWorkspaceId, setWorkspaces } from '@/whatsapp/utils/workspaceContext';
import { MessageCircle, ArrowRight, Eye, EyeOff, Mail, Building2 } from 'lucide-react';
import { useBranding } from '@/branding/BrandingContext';
import {
    DEFAULT_BRANDING,
    TenantBranding,
    TENANT_CODE_STORAGE_KEY,
    loadTenantCode,
    clearBrandingCache,
} from '@/branding/branding';

export default function LoginPage() {
    const navigate = useNavigate();
    const { branding, setBranding } = useBranding();
    const [tenantCode, setTenantCode] = useState(() => loadTenantCode() || '');
    const [form, setForm] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [logoFailed, setLogoFailed] = useState(false);
    // The tenant is resolved internally from the custom domain (DomainGate stores
    // its code), so the Tenant Code field is hidden — users sign in with just
    // email + password. It is revealed ONLY as a fallback if the backend can't
    // resolve the tenant from the email alone (same email in multiple tenants on
    // the shared platform host, which replies 409 tenant_code_required).
    const [showTenantField, setShowTenantField] = useState(false);

    // Reset the logo-failure flag whenever the tenant logo changes (e.g. after
    // live by-code theming) so a new tenant's logo gets a fresh chance to load.
    useEffect(() => {
        setLogoFailed(false);
    }, [branding.logo_url]);

    // Auto-resume a persisted session on boot: if a stored token+user exist AND
    // they belong to THIS domain's tenant, skip the login form and go straight to
    // the dashboard. The domain guard prevents resuming a T0000 session on a
    // different tenant's domain ("not for the wrong one"). Runs once on mount.
    useEffect(() => {
        try {
            const token = localStorage.getItem('sv_token');
            const userStr = localStorage.getItem('sv_user');
            if (!token || !userStr) return;
            const authTenant = (localStorage.getItem('sv_auth_tenant') || '').toUpperCase();
            const domainTenant = (localStorage.getItem(TENANT_CODE_STORAGE_KEY) || '').toUpperCase();
            if (authTenant && domainTenant && authTenant !== domainTenant) return; // wrong domain
            navigate('/dashboard', { replace: true });
        } catch { /* ignore — show the login form */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastResolvedCode = useRef<string>('');

    // ── Live tenant theming: debounced by-code branding lookup ──
    useEffect(() => {
        const code = tenantCode.trim();
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!code) {
            // No code → fall back to default branding
            if (lastResolvedCode.current !== '') {
                lastResolvedCode.current = '';
                setBranding(DEFAULT_BRANDING);
            }
            return;
        }

        debounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(
                    `${API_BASE_URL}/api/tenant/branding/by-code/${encodeURIComponent(code)}`,
                    { credentials: 'include' },
                );
                const data = await res.json().catch(() => null);

                if (res.ok && data?.success && data.tenant?.branding) {
                    lastResolvedCode.current = code;
                    setBranding(
                        { ...DEFAULT_BRANDING, ...data.tenant.branding } as TenantBranding,
                        data.tenant.tenant_code || code,
                    );
                } else {
                    // Not found → revert to default branding
                    lastResolvedCode.current = '';
                    setBranding(DEFAULT_BRANDING);
                }
            } catch {
                // Network error → keep current branding
            }
        }, 450);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [tenantCode, setBranding]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Resolved internally from the custom domain (DomainGate). Empty only on
        // the shared platform host with a unique email — the backend then finds
        // the tenant by email, or replies 409 if the email is ambiguous.
        const code = tenantCode.trim().toUpperCase();

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ ...form, tenant_code: code }),
            });
            const data = await res.json();

            if (res.status === 403 && data.status === 'pending_verification') {
                sessionStorage.setItem('sv_signup_email', form.email);
                navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
                return;
            }

            if (res.status === 409 && data.error === 'tenant_code_required') {
                setShowTenantField(true);
                setError(data.message || 'This email exists in multiple workspaces. Please enter your Tenant Code to continue.');
                return;
            }

            if (!res.ok || !data.success) {
                if (data.error === 'tenant_code_required') setShowTenantField(true);
                const msg = data.error === 'invalid_credentials' ? 'Invalid email or password'
                    : data.error === 'email_password_required' ? 'Email and password are required'
                        : data.error === 'tenant_code_required' ? (data.message || 'Please enter your Tenant Code to continue.')
                            : data.error || 'Login failed';
                setError(msg);
                return;
            }

            // ── Clear ALL previous user data first ──
            clearAllUserData();
            // Wipe the previous tenant's in-memory WhatsApp cache and cached
            // branding so the incoming tenant loads fresh (no stale data/colors).
            clearCache();
            clearBrandingCache();

            // Store new auth credentials
            localStorage.setItem('sv_user', JSON.stringify(data.user));
            localStorage.setItem('sv_user_id', String(data.user.id));
            sessionStorage.setItem('sv_user', JSON.stringify(data.user));
            // Signed JWT — the secure credential sent as `Authorization: Bearer`
            // (works even when third-party cookies are blocked).
            if (data.token) {
                localStorage.setItem('sv_token', data.token);
                sessionStorage.setItem('sv_token', data.token);
            }
            // This is a NORMAL user session — clear any stale admin markers left in
            // the browser from a prior admin login, so the user is never treated as
            // admin (which crossed identities after payment/redirect).
            localStorage.removeItem('sv_admin_id');
            sessionStorage.removeItem('sv_admin_id');

            // ── Persist tenant code + apply tenant branding ──
            const resolvedCode = data.tenant?.tenant_code || code;
            if (resolvedCode) {
                localStorage.setItem(TENANT_CODE_STORAGE_KEY, resolvedCode);
                // The tenant this session belongs to — used to auto-resume only on
                // the matching domain (never resume a T0000 session on a tenant domain).
                localStorage.setItem('sv_auth_tenant', resolvedCode);
            }
            if (data.tenant?.branding) {
                setBranding(
                    { ...DEFAULT_BRANDING, ...data.tenant.branding } as TenantBranding,
                    resolvedCode,
                );
            }

            if (data.workspaces?.length > 0) {
                // Cache the FULL workspace list so the switcher has it immediately,
                // and set the first as active only if none is active yet.
                setWorkspaces(data.workspaces);
                if (!getWorkspaceId()) {
                    setWorkspaceId(data.workspaces[0].id);
                }
            }

            // Honor a post-auth redirect (e.g. Pricing → Sign up → back to Subscription).
            let dest = '/dashboard';
            try {
                const r = localStorage.getItem('sv_post_auth_redirect');
                if (r) { dest = r; localStorage.removeItem('sv_post_auth_redirect'); }
            } catch { /* ignore */ }
            navigate(dest);
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const brandName = (
        <>
            {branding.short_name}<span style={{ color: 'var(--brand-primary)' }}>{branding.name_suffix}</span>
        </>
    );

    // Render the brand panel background from branding.login_background.
    // It may be an image URL (starts with `/`, `http`, or `data:`) or a CSS
    // background value such as a `linear-gradient(...)` / solid color string.
    const loginBg = (branding.login_background || '').trim();
    const isImageBg = /^(\/|https?:\/\/|data:)/i.test(loginBg);
    const brandPanelStyle: React.CSSProperties = isImageBg
        ? { backgroundImage: `url(${loginBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : { background: loginBg || 'var(--brand-login-bg)' };

    return (
        <div className="min-h-screen flex bg-slate-50">
            {/* Left Panel - Branding */}
            <div
                className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-center justify-center p-12"
                style={brandPanelStyle}
            >
                <div className="absolute inset-0">
                    <div className="absolute top-20 left-10 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-20 right-10 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
                </div>
                <div className="relative z-10 text-white max-w-md">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                            {branding.logo_url && !logoFailed ? (
                                <img
                                    src={branding.logo_url}
                                    alt={branding.company_name}
                                    className="w-9 h-9 rounded-xl object-cover"
                                    onError={() => setLogoFailed(true)}
                                />
                            ) : (
                                <MessageCircle className="w-8 h-8" />
                            )}
                        </div>
                        <span className="text-2xl font-bold">{branding.company_name}{branding.name_suffix}</span>
                    </div>
                    <h1 className="text-4xl font-bold leading-tight mb-4">Welcome back!</h1>
                    <p className="text-white/90 text-lg leading-relaxed">
                        {branding.tagline || 'Log in to manage your WhatsApp conversations, automations, and analytics all in one place.'}
                    </p>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-8">
                        <div
                            className="p-2 rounded-xl shadow-lg flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))` }}
                        >
                            {branding.logo_url && !logoFailed ? (
                                <img
                                    src={branding.logo_url}
                                    alt={branding.company_name}
                                    className="w-6 h-6 rounded-md object-cover"
                                    onError={() => setLogoFailed(true)}
                                />
                            ) : (
                                <MessageCircle className="w-6 h-6 text-white" />
                            )}
                        </div>
                        <span className="text-xl font-bold" style={{ color: 'var(--brand-accent)' }}>
                            {brandName}
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Log in to your account</h2>
                    <p className="text-muted-foreground mb-8">Enter your credentials to continue</p>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {showTenantField && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tenant Code</label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" value={tenantCode}
                                    onChange={e => {
                                        const v = e.target.value.toUpperCase();
                                        setTenantCode(v);
                                        const t = v.trim();
                                        if (t) localStorage.setItem(TENANT_CODE_STORAGE_KEY, t);
                                    }}
                                    onBlur={e => {
                                        const v = e.target.value.trim();
                                        if (v) localStorage.setItem(TENANT_CODE_STORAGE_KEY, v);
                                    }}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all"
                                    style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                    placeholder="ABC001"
                                    autoCapitalize="characters" autoComplete="off" />
                            </div>
                            <p className="mt-1 text-xs text-slate-400">Enter your organization’s tenant code to continue.</p>
                        </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="email" required value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all"
                                    style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                    placeholder="john@company.com" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-medium text-slate-700">Password</label>
                                <NavLink to="/forgot-password" className="text-xs font-medium transition-colors" style={{ color: 'var(--brand-secondary)' }}>
                                    Forgot password?
                                </NavLink>
                            </div>
                            <div className="relative">
                                <input type={showPassword ? 'text' : 'password'} required value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all"
                                    style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                    placeholder="Your password" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={loading}
                            className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2 hover:brightness-110"
                            style={{ background: `linear-gradient(to right, var(--brand-primary), var(--brand-secondary))` }}>
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>Log In <ArrowRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-slate-500">
                        Don't have an account?{' '}
                        <NavLink to="/signup" className="font-semibold transition-colors" style={{ color: 'var(--brand-secondary)' }}>Sign up</NavLink>
                    </p>
                    <p className="mt-2 text-center text-sm text-slate-500">
                        Are you an agent?{' '}
                        <NavLink to="/agent-login" className="font-semibold transition-colors" style={{ color: 'var(--brand-secondary)' }}>Agent Login</NavLink>
                    </p>
                </div>
            </div>
        </div>
    );
}
