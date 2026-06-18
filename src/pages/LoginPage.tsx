import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { API_BASE_URL } from '@/config';
import { clearAllUserData } from '@/lib/userSession';
import { MessageCircle, ArrowRight, Eye, EyeOff, Mail } from 'lucide-react';

export default function LoginPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(form),
            });
            const data = await res.json();

            if (res.status === 403 && data.status === 'pending_verification') {
                sessionStorage.setItem('sv_signup_email', form.email);
                navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
                return;
            }

            if (!res.ok || !data.success) {
                const msg = data.error === 'invalid_credentials' ? 'Invalid email or password'
                    : data.error === 'email_password_required' ? 'Email and password are required'
                        : data.error || 'Login failed';
                setError(msg);
                return;
            }

            // ── Clear ALL previous user data first ──
            clearAllUserData();

            // Store new auth credentials
            localStorage.setItem('sv_user', JSON.stringify(data.user));
            localStorage.setItem('sv_user_id', String(data.user.id));
            sessionStorage.setItem('sv_user', JSON.stringify(data.user));

            if (data.workspaces?.length > 0) {
                sessionStorage.setItem('sv_whatsapp_workspace_id', String(data.workspaces[0].id));
                localStorage.setItem('sv_whatsapp_workspace_id', String(data.workspaces[0].id));
            }

            navigate('/dashboard');
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-slate-50">
            {/* Left Panel - Branding */}
            <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-[#0a6847] via-[#128C7E] to-[#25D366] items-center justify-center p-12">
                <div className="absolute inset-0">
                    <div className="absolute top-20 left-10 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
                    <div className="absolute bottom-20 right-10 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
                </div>
                <div className="relative z-10 text-white max-w-md">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-sm">
                            <MessageCircle className="w-8 h-8" />
                        </div>
                        <span className="text-2xl font-bold">SocioChat.ai</span>
                    </div>
                    <h1 className="text-4xl font-bold leading-tight mb-4">Welcome back!</h1>
                    <p className="text-emerald-100 text-lg leading-relaxed">
                        Log in to manage your WhatsApp conversations, automations, and analytics all in one place.
                    </p>
                </div>
            </div>

            {/* Right Panel - Form */}
            <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
                <div className="w-full max-w-md">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-8">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-lg">
                            <MessageCircle className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold text-[#0a6847]">
                            SocioChat<span className="text-[#25D366]">.ai</span>
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Log in to your account</h2>
                    <p className="text-muted-foreground mb-8">Enter your credentials to continue</p>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="email" required value={form.email}
                                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all"
                                    placeholder="john@company.com" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="block text-sm font-medium text-slate-700">Password</label>
                                <NavLink to="/forgot-password" className="text-xs font-medium text-[#128C7E] hover:text-[#0a6847] transition-colors">
                                    Forgot password?
                                </NavLink>
                            </div>
                            <div className="relative">
                                <input type={showPassword ? 'text' : 'password'} required value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all"
                                    placeholder="Your password" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={loading}
                            className="w-full py-3.5 px-6 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#0a6847] to-[#128C7E] hover:from-[#074b33] hover:to-[#0d7a6d] shadow-lg shadow-[#25D366]/20 hover:shadow-xl hover:shadow-[#25D366]/30 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>Log In <ArrowRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-slate-500">
                        Don't have an account?{' '}
                        <NavLink to="/signup" className="font-semibold text-[#128C7E] hover:text-[#0a6847] transition-colors">Sign up</NavLink>
                    </p>
                </div>
            </div>
        </div>
    );
}
