import { useState, useEffect, useRef } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { API_BASE_URL } from '@/config';
import { MessageCircle, ArrowRight, Eye, EyeOff, Building2, Mail, User, Phone, Briefcase, KeyRound } from 'lucide-react';
import { useBranding } from '@/branding/BrandingContext';
import {
    DEFAULT_BRANDING,
    TenantBranding,
    TENANT_CODE_STORAGE_KEY,
    loadTenantCode,
} from '@/branding/branding';

export default function SignupPage() {
    const navigate = useNavigate();
    const { branding, setBranding } = useBranding();
    const [tenantCode, setTenantCode] = useState(() => loadTenantCode() || '');
    const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', business_name: '', industry: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [logoFailed, setLogoFailed] = useState(false);

    // Reset the logo-failure flag whenever the tenant logo changes (e.g. after
    // live by-code theming) so a new tenant's logo gets a fresh chance to load.
    useEffect(() => {
        setLogoFailed(false);
    }, [branding.logo_url]);

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
        setErrors([]);

        const code = tenantCode.trim().toUpperCase();

        if (!code) {
            setErrors(['Tenant Code is required. Please enter your organization’s tenant code (e.g. ABC001).']);
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ ...form, tenant_code: code }),
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                if (data.error === 'sms_not_configured') {
                    setErrors([data.message || data.errors?.[0] || 'SMS is not configured for this account. Please contact your administrator to set up an SMS gateway in Integration settings.']);
                    return;
                }
                setErrors(data.errors || [data.error || 'Signup failed']);
                return;
            }

            // Store email for verification page
            sessionStorage.setItem('sv_signup_email', form.email);
            sessionStorage.setItem('sv_signup_name', form.name);

            // Navigate to verification page
            navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
        } catch (err) {
            setErrors(['Network error. Please try again.']);
        } finally {
            setLoading(false);
        }
    };

    const industries = ['E-commerce', 'Healthcare', 'Education', 'Real Estate', 'Finance', 'Food & Beverage', 'Travel', 'Technology', 'Other'];

    const tenantCodeError = errors.find(e => /tenant code/i.test(e));

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
                    <h1 className="text-4xl font-bold leading-tight mb-4">
                        The Ultimate WhatsApp Business Platform
                    </h1>
                    <p className="text-white/90 text-lg leading-relaxed">
                        {branding.tagline || 'Automate conversations, send personalized bulk messages, and engage customers at scale.'}
                    </p>
                    <div className="mt-10 space-y-4">
                        {['Smart Automations & AI Chatbots', 'Bulk Messaging with 98% Open Rate', 'Unified Inbox & Analytics'].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 text-white/90">
                                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">✓</div>
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-6">
                        <div
                            className="p-2.5 rounded-xl shadow-lg flex items-center justify-center"
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

                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h2>
                    <p className="text-muted-foreground mb-6">Get started with {branding.company_name}{branding.name_suffix} in seconds</p>

                    {errors.length > 0 && (
                        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 space-y-1">
                            {errors.map((e, i) => <p key={i}>{e}</p>)}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3.5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tenant Code</label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" required value={tenantCode}
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
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all"
                                    style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                    placeholder="ABC001"
                                    autoCapitalize="characters" autoComplete="off" />
                            </div>
                            {tenantCodeError ? (
                                <p className="mt-1 text-xs text-red-600">{tenantCodeError}</p>
                            ) : (
                                <p className="mt-1 text-xs text-slate-400">Your organization’s tenant code, e.g. ABC001.</p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="text" required value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all"
                                        style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                        placeholder="John Doe" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="tel" required value={form.phone}
                                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all"
                                        style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                        placeholder="+91 98765 43210" />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="email" required value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all"
                                    style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                    placeholder="john@company.com" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="text" required value={form.business_name}
                                        onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all"
                                        style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                        placeholder="Your Business" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <select value={form.industry}
                                        onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all appearance-none"
                                        style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}>
                                        <option value="">Select</option>
                                        {industries.map(i => <option key={i} value={i}>{i}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                            <div className="relative">
                                <input type={showPassword ? 'text' : 'password'} required minLength={8}
                                    value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    className="w-full px-4 py-2.5 pr-12 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all"
                                    style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                    placeholder="At least 8 characters" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={loading}
                            className="w-full py-3 px-6 rounded-xl text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1 hover:brightness-110"
                            style={{ background: `linear-gradient(to right, var(--brand-primary), var(--brand-secondary))` }}>
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>Create Account <ArrowRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </form>

                    <p className="mt-5 text-center text-sm text-slate-500">
                        Already have an account?{' '}
                        <NavLink to="/login" className="font-semibold transition-colors" style={{ color: 'var(--brand-secondary)' }}>Log in</NavLink>
                    </p>
                </div>
            </div>
        </div>
    );
}
