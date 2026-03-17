import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, NavLink } from 'react-router-dom';
import { API_BASE_URL } from '@/config';
import { MessageCircle, MailCheck, RefreshCw } from 'lucide-react';

export default function VerifyEmailPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email') || sessionStorage.getItem('sv_signup_email') || '';
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (!email) {
            navigate('/signup');
        }
        inputRefs.current[0]?.focus();
    }, [email, navigate]);

    useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);

    const handleChange = (index: number, value: string) => {
        if (value.length > 1) {
            // Handle paste
            const digits = value.replace(/\D/g, '').slice(0, 6).split('');
            const newCode = [...code];
            digits.forEach((d, i) => { if (index + i < 6) newCode[index + i] = d; });
            setCode(newCode);
            const nextIdx = Math.min(index + digits.length, 5);
            inputRefs.current[nextIdx]?.focus();
            return;
        }
        if (!/^\d*$/.test(value)) return;
        const newCode = [...code];
        newCode[index] = value;
        setCode(newCode);
        if (value && index < 5) inputRefs.current[index + 1]?.focus();
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        const fullCode = code.join('');
        if (fullCode.length !== 6) { setError('Please enter a 6-digit code'); return; }

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/verify-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, code: fullCode }),
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(data.error || 'Verification failed');
                return;
            }

            // Store user data
            if (data.user) {
                localStorage.setItem('sv_user', JSON.stringify(data.user));
                localStorage.setItem('sv_user_id', String(data.user.id));
                sessionStorage.setItem('sv_user', JSON.stringify(data.user));
            }

            setSuccess('Email verified successfully!');
            setTimeout(() => navigate('/pricing'), 800);
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setError('');

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/resend-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
            if (data.success) {
                const channels = [data.email_sent && 'email', data.sms_sent && 'SMS'].filter(Boolean).join(' & ');
                setSuccess(`New code sent via ${channels || 'email'}!`);
                setResendCooldown(60);
                setCode(['', '', '', '', '', '']);
                inputRefs.current[0]?.focus();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error || 'Failed to resend code');
            }
        } catch {
            setError('Network error');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 border border-slate-100">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-green-50 mb-4">
                            <MailCheck className="w-10 h-10 text-[#25D366]" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Verify your account</h2>
                        <p className="text-sm text-slate-500">
                            We sent a 6-digit verification code to your email &amp; phone<br />
                            <span className="font-medium text-slate-700">{email}</span>
                        </p>
                    </div>

                    {error && (
                        <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 text-center">{error}</div>
                    )}
                    {success && (
                        <div className="mb-5 p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 text-center">{success}</div>
                    )}

                    <form onSubmit={handleVerify}>
                        {/* OTP Input */}
                        <div className="flex gap-3 justify-center mb-6">
                            {code.map((digit, i) => (
                                <input
                                    key={i}
                                    ref={el => { inputRefs.current[i] = el; }}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={digit}
                                    onChange={e => handleChange(i, e.target.value)}
                                    onKeyDown={e => handleKeyDown(i, e)}
                                    className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 border-slate-200 bg-slate-50 focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20 focus:bg-white outline-none transition-all"
                                />
                            ))}
                        </div>

                        <button type="submit" disabled={loading || code.join('').length !== 6}
                            className="w-full py-3 px-6 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#0a6847] to-[#128C7E] hover:from-[#074b33] hover:to-[#0d7a6d] shadow-lg shadow-[#25D366]/20 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : 'Verify Email'}
                        </button>
                    </form>

                    {/* Resend */}
                    <div className="mt-5 text-center">
                        <p className="text-sm text-slate-500">
                            Didn't receive the code?{' '}
                            <button onClick={handleResend} disabled={resendCooldown > 0}
                                className="font-semibold text-[#128C7E] hover:text-[#0a6847] disabled:text-slate-400 transition-colors inline-flex items-center gap-1">
                                <RefreshCw className="w-3.5 h-3.5" />
                                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                            </button>
                        </p>
                    </div>

                    <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                        <NavLink to="/signup" className="text-sm text-slate-500 hover:text-slate-700 transition-colors">
                            ← Back to Sign Up
                        </NavLink>
                    </div>
                </div>
            </div>
        </div>
    );
}
