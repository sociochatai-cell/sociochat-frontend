import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Zap, Crown, Gem, Building, Check, Sparkles, MessageCircle, Loader2, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { useBranding } from '@/branding/BrandingContext';

// A plan row from GET /api/subscription/plans (or /my-plans): the SubscriptionPlan
// catalog fields + the per-plan feature/limit matrix, all merged into one object.
type PlanRow = {
    slug: string;
    name: string;
    description?: string | null;
    price_monthly_inr?: number | null;
    sort_order?: number;
    [featureKey: string]: unknown;
};

const ICONS: Record<string, typeof Zap> = {
    beta: Gift,
    starter: Zap,
    growth: Crown,
    premium: Gem,
    enterprise: Building,
};
const COLORS: Record<string, string> = {
    beta: 'from-slate-500 to-slate-600',
    starter: 'from-blue-500 to-blue-600',
    growth: 'from-brand-800 to-brand-500',
    premium: 'from-purple-500 to-purple-600',
    enterprise: 'from-amber-500 to-amber-600',
};

const inr = (n: number) => n.toLocaleString('en-IN');

// Limit-type features → a human bullet (or null to hide). Order matters.
const LIMIT_BULLETS: { key: string; fmt: (v: number) => string | null }[] = [
    { key: 'workspaces', fmt: (v) => (v === -1 ? 'Unlimited WhatsApp numbers' : v > 0 ? `${v} WhatsApp number${v === 1 ? '' : 's'}` : null) },
    { key: 'users', fmt: (v) => (v === -1 ? 'Unlimited team seats' : v > 0 ? `${v} team seat${v === 1 ? '' : 's'}` : null) },
    { key: 'messages_per_day', fmt: (v) => (v === -1 ? 'Unlimited messages / day' : v > 0 ? `${inr(v)} messages / day` : null) },
    { key: 'interactive_flows', fmt: (v) => (v === -1 ? 'Unlimited interactive flows' : v > 0 ? `${v} interactive flows` : null) },
    { key: 'image_credits', fmt: (v) => (v === -1 ? 'Unlimited AI image credits' : v > 0 ? `${inr(v)} AI image credits` : null) },
    { key: 'ad_spend_limit', fmt: (v) => (v === -1 ? 'Unlimited managed ad spend' : v > 0 ? `Managed ad spend up to ₹${inr(v)}` : null) },
];

// Access-type features → bullet label (shown only when enabled for the plan).
const ACCESS_BULLETS: { key: string; label: string }[] = [
    { key: 'whatsapp_automation', label: 'Automation + broadcasts' },
    { key: 'unified_dashboard_analytics', label: 'Analytics dashboard' },
    { key: 'human_agent_whatsapp', label: 'Team inbox + live chat' },
    { key: 'crm', label: 'CRM with Kanban pipeline' },
    { key: 'whatsapp_smart_ai', label: 'Smart AI replies' },
    { key: 'whatsapp_ctwa', label: 'Click-to-WhatsApp ads' },
    { key: 'ai_chatbot_dashboard', label: 'AI chatbot' },
    { key: 'image_generation', label: 'AI image generation' },
    { key: 'whatsapp_coexistence', label: 'WhatsApp coexistence' },
];

function bulletsFor(plan: PlanRow): string[] {
    const out: string[] = [];
    for (const { key, fmt } of LIMIT_BULLETS) {
        const v = plan[key];
        if (typeof v === 'number') {
            const line = fmt(v);
            if (line) out.push(line);
        }
    }
    for (const { key, label } of ACCESS_BULLETS) {
        if (plan[key] === true) out.push(label);
    }
    return out;
}

function priceLabel(p: number | null | undefined): { price: string; period: string; free: boolean; custom: boolean } {
    if (p === null || p === undefined) return { price: 'Custom', period: '', free: false, custom: true };
    if (p === 0) return { price: '₹0', period: '/forever', free: true, custom: false };
    return { price: `₹${inr(p)}`, period: '/month', free: false, custom: false };
}

// Last-resort fallback so /pricing is never blank when the API is unreachable or
// not yet seeded. Mirrors the launch catalog; the DB (Admin → Plans) overrides
// this whenever the backend responds.
const DEFAULT_PLANS: PlanRow[] = [
    { slug: 'starter', name: 'Basic', description: 'For small businesses starting out', price_monthly_inr: 999, sort_order: 1,
      workspaces: 1, users: 5, messages_per_day: 1000, interactive_flows: 5, image_credits: 0, ad_spend_limit: 100000,
      whatsapp_automation: true, unified_dashboard_analytics: true, human_agent_whatsapp: true, crm: true, whatsapp_smart_ai: true, whatsapp_coexistence: true },
    { slug: 'growth', name: 'Pro', description: 'Scale with AI and automation', price_monthly_inr: 2999, sort_order: 2,
      workspaces: 3, users: 5, messages_per_day: 5000, interactive_flows: 15, image_credits: 100000, ad_spend_limit: 500000,
      whatsapp_automation: true, unified_dashboard_analytics: true, human_agent_whatsapp: true, crm: true, whatsapp_smart_ai: true, whatsapp_coexistence: true, whatsapp_ctwa: true, ai_chatbot_dashboard: true, image_generation: true },
    { slug: 'premium', name: 'Premium', description: 'For high-volume teams', price_monthly_inr: 8999, sort_order: 3,
      workspaces: 10, users: 15, messages_per_day: 20000, interactive_flows: 50, image_credits: 500000, ad_spend_limit: 1000000,
      whatsapp_automation: true, unified_dashboard_analytics: true, human_agent_whatsapp: true, crm: true, whatsapp_smart_ai: true, whatsapp_coexistence: true, whatsapp_ctwa: true, ai_chatbot_dashboard: true, image_generation: true },
    { slug: 'enterprise', name: 'Ultimate', description: 'White-label, unlimited scale', price_monthly_inr: 39999, sort_order: 4,
      workspaces: -1, users: -1, messages_per_day: -1, interactive_flows: -1, image_credits: -1, ad_spend_limit: -1,
      whatsapp_automation: true, unified_dashboard_analytics: true, human_agent_whatsapp: true, crm: true, whatsapp_smart_ai: true, whatsapp_coexistence: true, whatsapp_ctwa: true, ai_chatbot_dashboard: true, image_generation: true },
];

export default function PricingPage() {
    const navigate = useNavigate();
    useBranding();
    const [plans, setPlans] = useState<PlanRow[]>([]);
    const [loading, setLoading] = useState(true);

    // Custom/"Contact sales" tiers (null price) open a lead form; on submit the
    // backend emails the team (POST /api/subscription/contact-sales).
    const [contactPlan, setContactPlan] = useState<PlanRow | null>(null);
    const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', company: '', message: '' });
    const [contactSubmitting, setContactSubmitting] = useState(false);
    const [contactDone, setContactDone] = useState(false);
    const [contactError, setContactError] = useState('');

    const contactSales = (plan: PlanRow) => {
        setContactPlan(plan);
        setContactForm({ name: '', email: '', phone: '', company: '', message: '' });
        setContactDone(false);
        setContactError('');
    };

    const submitContactSales = async (e: FormEvent) => {
        e.preventDefault();
        setContactError('');
        if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.phone.trim()) {
            setContactError('Please fill in your name, email and phone.');
            return;
        }
        setContactSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/subscription/contact-sales`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...contactForm, plan: contactPlan?.name || 'Enterprise' }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data?.success) {
                setContactDone(true);
            } else {
                setContactError(data?.error || 'Could not send your enquiry. Please try again.');
            }
        } catch {
            setContactError('Network error. Please try again.');
        } finally {
            setContactSubmitting(false);
        }
    };

    // Load the plan catalog from the DB (admin-editable via Admin → Plans). Use
    // the tenant-aware /my-plans when authenticated, else the public /plans.
    useEffect(() => {
        const load = async () => {
            const userId = localStorage.getItem('sv_user_id');
            const svToken = sessionStorage.getItem('sv_token') || localStorage.getItem('sv_token');
            const headers: Record<string, string> = {};
            if (userId) headers['X-User-Id'] = userId;
            if (svToken) headers['Authorization'] = `Bearer ${svToken}`;
            const url = svToken || userId ? '/subscription/my-plans' : '/subscription/plans';
            try {
                let res = await fetch(`${API_BASE_URL}/api${url}`, { credentials: 'include', headers });
                let data = await res.json().catch(() => ({}));
                if (!res.ok || !data?.success) {
                    res = await fetch(`${API_BASE_URL}/api/subscription/plans`);
                    data = await res.json().catch(() => ({}));
                }
                const map = data?.success && data.plans ? (data.plans as Record<string, PlanRow>) : null;
                const rows: PlanRow[] = map ? Object.values(map).filter(p => p.slug !== 'beta' && p.price_monthly_inr !== 0) : [];
                rows.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                // Always show prices — fall back to the built-in defaults when the
                // API returns nothing (offline / not yet seeded).
                setPlans(rows.length ? rows : DEFAULT_PLANS);
            } catch {
                setPlans(DEFAULT_PLANS);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, []);

    const popularSlug = useMemo(() => (plans.some((p) => p.slug === 'growth') ? 'growth' : ''), [plans]);

    const selectPlan = (slug: string) => {
        const userId = localStorage.getItem('sv_user_id');
        const svToken = sessionStorage.getItem('sv_token') || localStorage.getItem('sv_token');
        if (!userId && !svToken) {
            // Not logged in → send to SIGN-UP first; remember the plan + come back
            // to the subscription page after they authenticate.
            try {
                localStorage.setItem('sv_intended_plan', slug);
                localStorage.setItem('sv_post_auth_redirect', '/subscription');
            } catch { /* ignore */ }
            navigate('/signup');
            return;
        }
        // Already logged in → go straight to the subscription page to complete it.
        navigate(`/subscription?plan=${encodeURIComponent(slug)}`);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg">
                            <MessageCircle className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-bold text-brand-800">
                            SocioChat<span className="text-brand-500">.ai</span>
                        </span>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-16">
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-4">
                        <Sparkles className="w-3.5 h-3.5" />
                        Everything included — less than the competition
                    </div>
                    <h1 className="text-4xl font-bold text-slate-900 mb-3">Plans that grow with you</h1>
                    <p className="text-lg text-slate-500 max-w-lg mx-auto">
                        Start free, upgrade when you're ready. AI chatbot, flows, and CRM built in — no add-ons.
                    </p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin" /> Loading plans…
                    </div>
                ) : plans.length === 0 ? (
                    <p className="text-center py-20 text-slate-500">Plans are unavailable right now. Please try again shortly.</p>
                ) : (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 mb-10 items-stretch">
                        {plans.map((plan) => {
                            const Icon = ICONS[plan.slug] || Zap;
                            const color = COLORS[plan.slug] || 'from-slate-500 to-slate-600';
                            const popular = plan.slug === popularSlug;
                            const { price, period, free, custom } = priceLabel(plan.price_monthly_inr ?? null);
                            const cta = free ? 'Start free' : custom ? 'Contact sales' : 'Get started';
                            const bullets = bulletsFor(plan);
                            return (
                                <div key={plan.slug}
                                    className={`relative flex flex-col bg-white rounded-2xl border-2 p-6 transition-all hover:shadow-xl ${popular
                                        ? 'border-brand-500 shadow-lg shadow-brand-500/10'
                                        : 'border-slate-200 hover:border-slate-300'
                                        }`}>
                                    {popular && (
                                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-brand-800 to-brand-500 text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">
                                            Most Popular
                                        </div>
                                    )}
                                    <div className={`inline-flex w-fit p-2.5 rounded-xl bg-gradient-to-br ${color} mb-4`}>
                                        <Icon className="w-5 h-5 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
                                    <p className="text-sm text-slate-500 mb-4 min-h-[2.5rem]">{plan.description || ''}</p>
                                    <div className="mb-5">
                                        <span className="text-3xl font-bold text-slate-900">{price}</span>
                                        <span className="text-slate-500 text-sm">{period}</span>
                                    </div>
                                    <button
                                        onClick={() => (custom ? contactSales(plan) : selectPlan(plan.slug))}
                                        className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all mb-5 ${popular
                                            ? 'bg-gradient-to-r from-brand-800 to-brand-700 text-white shadow-lg shadow-brand-500/20 hover:shadow-xl'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}>
                                        {cta}
                                    </button>
                                    <ul className="space-y-2.5">
                                        {bullets.map((f, i) => (
                                            <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                                                <Check className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                                                {f}
                                            </li>
                                        ))}
                                    </ul>
                                    {!free && !custom && (
                                        <div className="mt-auto pt-4 border-t border-slate-100 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                                            <RefreshCw className="w-3.5 h-3.5" />
                                            Auto-renew available
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="max-w-3xl mx-auto flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3 text-sm text-emerald-800">
                        <RefreshCw className="w-4 h-4 flex-shrink-0" />
                        <span><strong>Auto-renew available</strong> — enable recurring payments at checkout so your plan renews automatically each period. You can turn it off anytime from your Subscription page.</span>
                    </div>
                    <p className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-5 py-3 inline-block">
                        Plan price covers the platform only. WhatsApp conversation charges are billed separately at
                        Meta's rates — marketing ₹1.09, utility &amp; authentication ₹0.145, service (user-initiated) free.
                    </p>
                </div>
            </div>

            {/* Contact Sales modal (Enterprise / custom-priced plans) */}
            {contactPlan && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => !contactSubmitting && setContactPlan(null)}
                >
                    <div
                        className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {contactDone ? (
                            <div className="text-center py-6">
                                <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                                    <Check className="w-6 h-6 text-emerald-600" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-1">Thank you!</h3>
                                <p className="text-sm text-slate-500 mb-5">
                                    Our sales team has received your details and will reach out to you shortly.
                                </p>
                                <button
                                    onClick={() => setContactPlan(null)}
                                    className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200"
                                >
                                    Close
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900">Contact Sales</h3>
                                        <p className="text-sm text-slate-500">
                                            Tell us about your needs for the {contactPlan.name} plan and our team will get in touch.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setContactPlan(null)}
                                        className="text-slate-400 hover:text-slate-600 text-xl leading-none"
                                        aria-label="Close"
                                    >
                                        ×
                                    </button>
                                </div>
                                <form onSubmit={submitContactSales} className="space-y-3">
                                    <input
                                        type="text" placeholder="Full name *" value={contactForm.name}
                                        onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                    <input
                                        type="email" placeholder="Work email *" value={contactForm.email}
                                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                    <input
                                        type="tel" placeholder="Phone number *" value={contactForm.phone}
                                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                    <input
                                        type="text" placeholder="Company (optional)" value={contactForm.company}
                                        onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                    />
                                    <textarea
                                        placeholder="What are you looking for? (optional)" value={contactForm.message}
                                        onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                                        rows={3}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                                    />
                                    {contactError && <p className="text-sm text-red-600">{contactError}</p>}
                                    <button
                                        type="submit" disabled={contactSubmitting}
                                        className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-gradient-to-r from-brand-800 to-brand-700 text-white shadow-lg shadow-brand-500/20 hover:shadow-xl disabled:opacity-60"
                                    >
                                        {contactSubmitting ? 'Sending…' : 'Send enquiry'}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
