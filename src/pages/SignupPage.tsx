import { useState } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { API_BASE_URL } from '@/config';
import { MessageCircle, ArrowRight, Eye, EyeOff, Building2, Mail, User, Phone, Briefcase } from 'lucide-react';

export default function SignupPage() {
    const navigate = useNavigate();
    const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', business_name: '', industry: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrors([]);

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(form),
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
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
                    <h1 className="text-4xl font-bold leading-tight mb-4">
                        The Ultimate WhatsApp Business Platform
                    </h1>
                    <p className="text-emerald-100 text-lg leading-relaxed">
                        Automate conversations, send personalized bulk messages, and engage customers at scale.
                    </p>
                    <div className="mt-10 space-y-4">
                        {['Smart Automations & AI Chatbots', 'Bulk Messaging with 98% Open Rate', 'Unified Inbox & Analytics'].map((item, i) => (
                            <div key={i} className="flex items-center gap-3 text-emerald-100">
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
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-lg">
                            <MessageCircle className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-xl font-bold text-[#0a6847]">
                            SocioChat<span className="text-[#25D366]">.ai</span>
                        </span>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Create your account</h2>
                    <p className="text-muted-foreground mb-6">Get started with SocioChat in seconds</p>

                    {errors.length > 0 && (
                        <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 space-y-1">
                            {errors.map((e, i) => <p key={i}>{e}</p>)}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3.5">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="text" required value={form.name}
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all"
                                        placeholder="John Doe" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="tel" required value={form.phone}
                                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all"
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
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all"
                                    placeholder="john@company.com" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Business Name</label>
                                <div className="relative">
                                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input type="text" required value={form.business_name}
                                        onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all"
                                        placeholder="Your Business" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Industry</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <select value={form.industry}
                                        onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all appearance-none">
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
                                    className="w-full px-4 py-2.5 pr-12 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition-all"
                                    placeholder="At least 8 characters" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <button type="submit" disabled={loading}
                            className="w-full py-3 px-6 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#0a6847] to-[#128C7E] hover:from-[#074b33] hover:to-[#0d7a6d] shadow-lg shadow-[#25D366]/20 hover:shadow-xl hover:shadow-[#25D366]/30 transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-1">
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>Create Account <ArrowRight className="w-4 h-4" /></>
                            )}
                        </button>
                    </form>

                    <p className="mt-5 text-center text-sm text-slate-500">
                        Already have an account?{' '}
                        <NavLink to="/login" className="font-semibold text-[#128C7E] hover:text-[#0a6847] transition-colors">Log in</NavLink>
                    </p>
                </div>
            </div>
        </div>
    );
}
