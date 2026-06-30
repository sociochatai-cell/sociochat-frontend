import { useState, useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { API_BASE_URL } from '@/config';
import { MessageCircle, Mail, ArrowLeft, Send, CheckCircle, KeyRound, Phone, MessageSquare, Lock, ShieldCheck } from 'lucide-react';
import { useBranding } from '@/branding/BrandingContext';
import {
    DEFAULT_BRANDING,
    TenantBranding,
    TENANT_CODE_STORAGE_KEY,
    loadTenantCode,
} from '@/branding/branding';

export default function ForgotPasswordPage() {
    const { branding, setBranding } = useBranding();
    const [tenantCode, setTenantCode] = useState(() => loadTenantCode() || '');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [logoFailed, setLogoFailed] = useState(false);
    // Tenant recovery contact (phone) resolved via the by-code branding lookup,
    // shown so a locked-out user knows who to contact.
    const [recoveryPhone, setRecoveryPhone] = useState<string>('');

    // ── SMS-OTP reset flow state ──────────────────────────────────────────────
    // `smsMode` toggles between the email-link flow (default) and the SMS code flow.
    const [smsMode, setSmsMode] = useState(false);
    // SMS step: 'request' (ask backend to text a code) → 'verify' (enter code + new pw).
    const [smsStep, setSmsStep] = useState<'request' | 'verify'>('request');
    const [smsLoading, setSmsLoading] = useState(false);
    const [smsError, setSmsError] = useState('');
    const [smsInfo, setSmsInfo] = useState('');           // friendly informational text (e.g. "code sent to …")
    const [phoneHint, setPhoneHint] = useState('');        // masked phone returned by /request
    const [noRecoveryPhone, setNoRecoveryPhone] = useState(false);
    const [smsCode, setSmsCode] = useState('');
    const [smsNewPassword, setSmsNewPassword] = useState('');
    const [smsConfirmPassword, setSmsConfirmPassword] = useState('');
    const [smsDone, setSmsDone] = useState(false);         // verify succeeded → success screen

    // Map backend error codes to friendly, user-facing text.
    const SMS_REQUEST_ERRORS: Record<string, string> = {
        no_recovery_phone:
            'This tenant has no recovery phone set. Please use the email reset above, or contact your administrator.',
        sms_not_configured:
            'SMS is not set up for this organization yet. Please contact your administrator to add an SMS gateway in Integration settings, or use the email reset above.',
    };
    const SMS_VERIFY_ERRORS: Record<string, string> = {
        invalid_code: 'Incorrect code. Please check the digits and try again.',
        expired: 'Code expired. Please request a new one.',
        too_many_attempts: 'Too many attempts. Please request a new code and try again.',
        weak_password: 'Password is too weak. Use at least 8 characters.',
        no_otp: 'No active code found. Please request a new SMS code.',
    };

    // Step 1 — ask the backend to text a one-time code to the tenant's recovery phone.
    const handleSmsRequest = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setSmsError('');
        setSmsInfo('');
        setNoRecoveryPhone(false);

        const code = tenantCode.trim().toUpperCase();
        if (!code) {
            setSmsError('Tenant Code is required. Please enter your organization’s tenant code (e.g. ABC001).');
            return;
        }
        if (!email.trim()) {
            setSmsError('Please enter the email address for your account.');
            return;
        }

        setSmsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/sms/forgot/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_code: code, email: email.trim() }),
            });
            const data = await res.json().catch(() => null);

            if (data?.sent) {
                setPhoneHint(typeof data.phone_hint === 'string' ? data.phone_hint : '');
                setSmsInfo(
                    data.phone_hint
                        ? `Code sent to ${data.phone_hint}.`
                        : 'A verification code has been sent.',
                );
                setSmsStep('verify');
            } else if (data?.error === 'no_recovery_phone') {
                setNoRecoveryPhone(true);
                setSmsError(SMS_REQUEST_ERRORS.no_recovery_phone);
            } else {
                setSmsError(
                    (data && SMS_REQUEST_ERRORS[data.error]) ||
                    'Could not send an SMS code right now. Please try again or use the email reset.',
                );
            }
        } catch {
            setSmsError('Network error. Please try again.');
        } finally {
            setSmsLoading(false);
        }
    };

    // Step 2 — verify the code and set the new password in one call.
    const handleSmsVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setSmsError('');
        setSmsInfo('');

        if (smsCode.trim().length < 6) {
            setSmsError('Please enter the 6-digit code from the text message.');
            return;
        }
        if (smsNewPassword.length < 8) {
            setSmsError('Password must be at least 8 characters.');
            return;
        }
        if (smsNewPassword !== smsConfirmPassword) {
            setSmsError('Passwords do not match.');
            return;
        }

        const code = tenantCode.trim().toUpperCase();
        setSmsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/sms/forgot/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenant_code: code,
                    email: email.trim(),
                    code: smsCode.trim(),
                    new_password: smsNewPassword,
                }),
            });
            const data = await res.json().catch(() => null);

            if (data?.success) {
                setSmsDone(true);
                // Brief success screen, then send the user to login.
                setTimeout(() => {
                    window.location.assign('/login');
                }, 1800);
            } else {
                setSmsError(
                    (data && SMS_VERIFY_ERRORS[data.error]) ||
                    data?.message ||
                    'Could not reset your password. Please try again.',
                );
            }
        } catch {
            setSmsError('Network error. Please try again.');
        } finally {
            setSmsLoading(false);
        }
    };

    // Flip into the SMS flow (or back), resetting transient SMS state each time.
    const enableSmsMode = (on: boolean) => {
        setSmsMode(on);
        setSmsStep('request');
        setSmsError('');
        setSmsInfo('');
        setPhoneHint('');
        setNoRecoveryPhone(false);
        setSmsCode('');
        setSmsNewPassword('');
        setSmsConfirmPassword('');
        setSmsDone(false);
        setError('');
    };

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
            setRecoveryPhone('');
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
                    setRecoveryPhone(
                        typeof data.tenant.phone_number === 'string'
                            ? data.tenant.phone_number.trim()
                            : '',
                    );
                } else {
                    // Not found → revert to default branding
                    lastResolvedCode.current = '';
                    setBranding(DEFAULT_BRANDING);
                    setRecoveryPhone('');
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

        const code = tenantCode.trim().toUpperCase();

        if (!code) {
            setError('Tenant Code is required. Please enter your organization’s tenant code (e.g. ABC001).');
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenant_code: code, email }),
            });
            const data = await res.json();

            if (res.status === 409 && data.error === 'tenant_code_required') {
                setError(data.message || 'This email exists in multiple workspaces. Please enter your Tenant Code to continue.');
                return;
            }

            if (data.success) {
                setSent(true);
            } else {
                setError(data.error || 'Something went wrong');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-8">
                        <div
                            className="p-2.5 rounded-xl shadow-lg flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))` }}
                        >
                            {branding.logo_url && !logoFailed ? (
                                <img
                                    src={branding.logo_url}
                                    alt={branding.company_name}
                                    className="w-5 h-5 rounded-md object-cover"
                                    onError={() => setLogoFailed(true)}
                                />
                            ) : (
                                <MessageCircle className="w-5 h-5 text-white" />
                            )}
                        </div>
                        <span className="text-lg font-bold" style={{ color: 'var(--brand-accent)' }}>
                            {branding.short_name}<span style={{ color: 'var(--brand-primary)' }}>{branding.name_suffix}</span>
                        </span>
                    </div>

                    {smsMode ? (
                        /* ───────────────────────── SMS-OTP reset flow ───────────────────────── */
                        smsDone ? (
                            <div className="text-center py-6">
                                <div className="inline-flex p-4 rounded-2xl bg-green-50 mb-4">
                                    <ShieldCheck className="w-10 h-10" style={{ color: 'var(--brand-primary)' }} />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 mb-2">Password reset</h2>
                                <p className="text-sm text-slate-500 mb-6">
                                    Your password has been updated. Redirecting you to login…
                                </p>
                                <NavLink to="/login"
                                    className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
                                    style={{ color: 'var(--brand-secondary)' }}>
                                    <ArrowLeft className="w-4 h-4" /> Back to Login
                                </NavLink>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 mb-1">
                                    <MessageSquare className="w-5 h-5" style={{ color: 'var(--brand-primary)' }} />
                                    <h2 className="text-2xl font-bold text-slate-900">Reset via SMS code</h2>
                                </div>
                                <p className="text-sm text-slate-500 mb-6">
                                    {smsStep === 'request'
                                        ? 'We’ll text a one-time code to your tenant’s recovery phone.'
                                        : 'Enter the code we texted you, then choose a new password.'}
                                </p>

                                {smsError && (
                                    <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{smsError}</div>
                                )}
                                {smsInfo && !smsError && (
                                    <div className="mb-5 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--brand-primary)' }} />
                                        {smsInfo}
                                    </div>
                                )}

                                {smsStep === 'request' ? (
                                    <form onSubmit={handleSmsRequest} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tenant Code</label>
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
                                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all"
                                                    style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                                    placeholder="ABC001"
                                                    autoCapitalize="characters" autoComplete="off" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input type="email" required value={email}
                                                    onChange={e => setEmail(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all"
                                                    style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                                    placeholder="john@company.com" />
                                            </div>
                                        </div>

                                        <button type="submit" disabled={smsLoading}
                                            className="w-full py-3 px-6 rounded-xl text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2 hover:brightness-110"
                                            style={{ background: `linear-gradient(to right, var(--brand-primary), var(--brand-secondary))` }}>
                                            {smsLoading ? (
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>Send SMS code <MessageSquare className="w-4 h-4" /></>
                                            )}
                                        </button>

                                        {noRecoveryPhone && (
                                            <button type="button" onClick={() => enableSmsMode(false)}
                                                className="w-full py-2.5 px-6 rounded-xl text-sm font-semibold transition-colors border"
                                                style={{ color: 'var(--brand-secondary)', borderColor: 'color-mix(in srgb, var(--brand-secondary) 35%, transparent)' }}>
                                                Use email reset instead
                                            </button>
                                        )}
                                    </form>
                                ) : (
                                    <form onSubmit={handleSmsVerify} className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Verification Code</label>
                                            <div className="relative">
                                                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input type="text" inputMode="numeric" required value={smsCode}
                                                    onChange={e => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm tracking-[0.4em] font-semibold focus:outline-none focus:ring-2 transition-all"
                                                    style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                                    placeholder="123456"
                                                    autoComplete="one-time-code" maxLength={6} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input type="password" required value={smsNewPassword}
                                                    onChange={e => setSmsNewPassword(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all"
                                                    style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                                    placeholder="At least 8 characters" autoComplete="new-password" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input type="password" required value={smsConfirmPassword}
                                                    onChange={e => setSmsConfirmPassword(e.target.value)}
                                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all"
                                                    style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                                    placeholder="Re-enter new password" autoComplete="new-password" />
                                            </div>
                                        </div>

                                        <button type="submit" disabled={smsLoading}
                                            className="w-full py-3 px-6 rounded-xl text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2 hover:brightness-110"
                                            style={{ background: `linear-gradient(to right, var(--brand-primary), var(--brand-secondary))` }}>
                                            {smsLoading ? (
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>Reset password <CheckCircle className="w-4 h-4" /></>
                                            )}
                                        </button>

                                        <button type="button" disabled={smsLoading} onClick={() => handleSmsRequest()}
                                            className="w-full text-center text-sm font-medium transition-colors disabled:opacity-60"
                                            style={{ color: 'var(--brand-secondary)' }}>
                                            Didn’t get it? Resend code
                                        </button>
                                    </form>
                                )}

                                <div className="mt-6 flex flex-col items-center gap-3">
                                    <button type="button" onClick={() => enableSmsMode(false)}
                                        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                                        <Mail className="w-4 h-4" /> Use email reset instead
                                    </button>
                                    <NavLink to="/login"
                                        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                                        <ArrowLeft className="w-4 h-4" /> Back to Login
                                    </NavLink>
                                </div>

                                {recoveryPhone && (
                                    <p className="mt-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                                        <Phone className="w-3.5 h-3.5" style={{ color: 'var(--brand-primary)' }} />
                                        Trouble resetting? Contact your administrator at{' '}
                                        <a
                                            href={`tel:${recoveryPhone}`}
                                            className="font-semibold hover:underline"
                                            style={{ color: 'var(--brand-secondary)' }}
                                        >
                                            {recoveryPhone}
                                        </a>
                                    </p>
                                )}
                            </>
                        )
                    ) : sent ? (
                        <div className="text-center py-6">
                            <div className="inline-flex p-4 rounded-2xl bg-green-50 mb-4">
                                <CheckCircle className="w-10 h-10" style={{ color: 'var(--brand-primary)' }} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Check your email</h2>
                            <p className="text-sm text-slate-500 mb-6">
                                If an account with <span className="font-medium text-slate-700">{email}</span> exists,
                                we've sent a password reset link.
                            </p>
                            <NavLink to="/login"
                                className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
                                style={{ color: 'var(--brand-secondary)' }}>
                                <ArrowLeft className="w-4 h-4" /> Back to Login
                            </NavLink>

                            {recoveryPhone && (
                                <p className="mt-4 text-xs text-slate-500 flex items-center justify-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5" style={{ color: 'var(--brand-primary)' }} />
                                    Trouble resetting? Contact your administrator at{' '}
                                    <a
                                        href={`tel:${recoveryPhone}`}
                                        className="font-semibold hover:underline"
                                        style={{ color: 'var(--brand-secondary)' }}
                                    >
                                        {recoveryPhone}
                                    </a>
                                </p>
                            )}
                        </div>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-slate-900 mb-1">Forgot your password?</h2>
                            <p className="text-sm text-slate-500 mb-6">
                                Enter your email and we'll send you a link to reset your password.
                            </p>

                            {error && (
                                <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Tenant Code</label>
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
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all"
                                            style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                            placeholder="ABC001"
                                            autoCapitalize="characters" autoComplete="off" />
                                    </div>
                                    <p className="mt-1 text-xs text-slate-400">Your organization’s tenant code, e.g. ABC001.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input type="email" required value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 transition-all"
                                            style={{ ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--brand-primary) 30%, transparent)' }}
                                            placeholder="john@company.com" />
                                    </div>
                                </div>

                                <button type="submit" disabled={loading}
                                    className="w-full py-3 px-6 rounded-xl text-sm font-semibold text-white shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2 hover:brightness-110"
                                    style={{ background: `linear-gradient(to right, var(--brand-primary), var(--brand-secondary))` }}>
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>Send Reset Link <Send className="w-4 h-4" /></>
                                    )}
                                </button>
                            </form>

                            {/* Alternative: reset via an SMS one-time code to the tenant's recovery phone. */}
                            <div className="mt-5 flex items-center gap-3">
                                <div className="h-px flex-1 bg-slate-200" />
                                <span className="text-xs text-slate-400">or</span>
                                <div className="h-px flex-1 bg-slate-200" />
                            </div>
                            <button type="button" onClick={() => enableSmsMode(true)}
                                className="mt-4 w-full py-3 px-6 rounded-xl text-sm font-semibold transition-colors border flex items-center justify-center gap-2 hover:bg-slate-50"
                                style={{ color: 'var(--brand-secondary)', borderColor: 'color-mix(in srgb, var(--brand-secondary) 35%, transparent)' }}>
                                <MessageSquare className="w-4 h-4" /> Use SMS code instead
                            </button>

                            <div className="mt-6 text-center">
                                <NavLink to="/login"
                                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                                    <ArrowLeft className="w-4 h-4" /> Back to Login
                                </NavLink>
                            </div>

                            {recoveryPhone && (
                                <p className="mt-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5" style={{ color: 'var(--brand-primary)' }} />
                                    Trouble resetting? Contact your administrator at{' '}
                                    <a
                                        href={`tel:${recoveryPhone}`}
                                        className="font-semibold hover:underline"
                                        style={{ color: 'var(--brand-secondary)' }}
                                    >
                                        {recoveryPhone}
                                    </a>
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
