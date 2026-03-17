import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, NavLink } from 'react-router-dom';
import { API_BASE_URL } from '@/config';
import { MessageCircle, Eye, EyeOff, KeyRound, CheckCircle, XCircle } from 'lucide-react';

export default function ResetPasswordPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [validating, setValidating] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [tokenError, setTokenError] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [email, setEmail] = useState('');

    // Validate token on mount
    useEffect(() => {
        if (!token) {
            setTokenError('No reset token provided');
            setValidating(false);
            return;
        }
        (async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`);
                const data = await res.json();
                if (data.valid) {
                    setTokenValid(true);
                    setEmail(data.email || '');
                } else {
                    setTokenError(data.error === 'invalid_or_expired_token' ? 'This reset link has expired or is invalid.' : data.error || 'Invalid token');
                }
            } catch {
                setTokenError('Could not validate token. Please try again.');
            } finally {
                setValidating(false);
            }
        })();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) { setError('Passwords do not match'); return; }
        if (password.length < 8) { setError('Password must be at least 8 characters'); return; }

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            });
            const data = await res.json();

            if (data.success) {
                setSuccess(true);
                setTimeout(() => navigate('/login'), 2500);
            } else {
                const msg = data.error === 'invalid_or_expired_token' ? 'This reset link has expired.'
                    : data.error === 'password_policy_failed' ? 'Password must be at least 8 characters'
                        : data.error || 'Reset failed';
                setError(msg);
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
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-lg">
                            <MessageCircle className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-bold text-[#0a6847]">
                            SocioChat<span className="text-[#25D366]">.ai</span>
                        </span>
                    </div>

                    {validating ? (
                        <div className="text-center py-10">
                            <div className="w-8 h-8 border-3 border-slate-200 border-t-[#25D366] rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-sm text-slate-500">Validating reset link...</p>
                        </div>
                    ) : tokenError ? (
                        <div className="text-center py-6">
                            <div className="inline-flex p-4 rounded-2xl bg-red-50 mb-4">
                                <XCircle className="w-10 h-10 text-red-500" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Invalid Link</h2>
                            <p className="text-sm text-slate-500 mb-6">{tokenError}</p>
                            <NavLink to="/forgot-password"
                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#0a6847] to-[#128C7E] transition-all">
                                Request New Link
                            </NavLink>
                        </div>
                    ) : success ? (
                        <div className="text-center py-6">
                            <div className="inline-flex p-4 rounded-2xl bg-green-50 mb-4">
                                <CheckCircle className="w-10 h-10 text-[#25D366]" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Password Reset!</h2>
                            <p className="text-sm text-slate-500">Your password has been changed. Redirecting to login...</p>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-6">
                                <div className="inline-flex p-3 rounded-2xl bg-emerald-50 mb-3">
                                    <KeyRound className="w-8 h-8 text-[#25D366]" />
                                </div>
                                <h2 className="text-2xl font-bold text-slate-900 mb-1">Set new password</h2>
                                {email && <p className="text-sm text-slate-500">for <span className="font-medium text-slate-700">{email}</span></p>}
                            </div>

                            {error && (
                                <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
                            )}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
                                    <div className="relative">
                                        <input type={showPassword ? 'text' : 'password'} required minLength={8}
                                            value={password} onChange={e => setPassword(e.target.value)}
                                            className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all"
                                            placeholder="At least 8 characters" />
                                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
                                    <input type="password" required minLength={8}
                                        value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all"
                                        placeholder="Re-enter your password" />
                                </div>

                                <button type="submit" disabled={loading}
                                    className="w-full py-3 px-6 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#0a6847] to-[#128C7E] hover:from-[#074b33] hover:to-[#0d7a6d] shadow-lg shadow-[#25D366]/20 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : 'Reset Password'}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
