import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { API_BASE_URL } from '@/config';
import { MessageCircle, Mail, ArrowLeft, Send, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const data = await res.json();
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
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-lg">
                            <MessageCircle className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-bold text-[#0a6847]">
                            SocioChat<span className="text-[#25D366]">.ai</span>
                        </span>
                    </div>

                    {sent ? (
                        <div className="text-center py-6">
                            <div className="inline-flex p-4 rounded-2xl bg-green-50 mb-4">
                                <CheckCircle className="w-10 h-10 text-[#25D366]" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 mb-2">Check your email</h2>
                            <p className="text-sm text-slate-500 mb-6">
                                If an account with <span className="font-medium text-slate-700">{email}</span> exists,
                                we've sent a password reset link.
                            </p>
                            <NavLink to="/login"
                                className="inline-flex items-center gap-2 text-sm font-semibold text-[#128C7E] hover:text-[#0a6847] transition-colors">
                                <ArrowLeft className="w-4 h-4" /> Back to Login
                            </NavLink>
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
                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input type="email" required value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all"
                                            placeholder="john@company.com" />
                                    </div>
                                </div>

                                <button type="submit" disabled={loading}
                                    className="w-full py-3 px-6 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#0a6847] to-[#128C7E] hover:from-[#074b33] hover:to-[#0d7a6d] shadow-lg shadow-[#25D366]/20 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>Send Reset Link <Send className="w-4 h-4" /></>
                                    )}
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <NavLink to="/login"
                                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                                    <ArrowLeft className="w-4 h-4" /> Back to Login
                                </NavLink>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
