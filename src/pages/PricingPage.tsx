import { useNavigate } from 'react-router-dom';
import { MessageCircle, Zap, Crown, Building, ArrowRight, Check, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { usePlan } from '@/contexts/PlanContext';

const PLAN_SLUGS: Record<string, string> = {
    Starter: 'starter',
    Growth: 'growth',
    Enterprise: 'enterprise',
};

const plans = [
    {
        name: 'Starter',
        price: '₹1,999',
        period: '/month',
        description: 'Perfect for small businesses getting started',
        icon: Zap,
        color: 'from-blue-500 to-blue-600',
        features: [
            '1 WhatsApp Number',
            '1,000 Messages / month',
            'Basic Automations',
            'Template Messaging',
            'Email Support',
        ],
        cta: 'Get Started',
        popular: false,
    },
    {
        name: 'Growth',
        price: '₹4,999',
        period: '/month',
        description: 'Scale your business with powerful features',
        icon: Crown,
        color: 'from-[#0a6847] to-[#25D366]',
        features: [
            '3 WhatsApp Numbers',
            '10,000 Messages / month',
            'Advanced AI Chatbot',
            'Drip Campaigns',
            'Flow Builder',
            'Analytics Dashboard',
            'Priority Support',
        ],
        cta: 'Get Started',
        popular: true,
    },
    {
        name: 'Enterprise',
        price: 'Custom',
        period: '',
        description: 'For large teams with custom requirements',
        icon: Building,
        color: 'from-purple-500 to-purple-600',
        features: [
            'Unlimited WhatsApp Numbers',
            'Unlimited Messages',
            'Custom AI Training',
            'API Access',
            'Dedicated Account Manager',
            'White Label Option',
            'SLA Guarantee',
            '24/7 Support',
        ],
        cta: 'Contact Sales',
        popular: false,
    },
];

export default function PricingPage() {
    const navigate = useNavigate();
    const { refreshPlan } = usePlan();

    const selectPlan = async (slug: string) => {
        const userId = localStorage.getItem('sv_user_id');
        if (!userId) {
            navigate('/login');
            return;
        }
        try {
            const res = await fetch(`${API_BASE_URL}/api/subscription/select-plan`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': userId,
                },
                body: JSON.stringify({ plan: slug }),
            });
            const data = await res.json();
            if (data.success) {
                const userStr = localStorage.getItem('sv_user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    user.plan = slug;
                    localStorage.setItem('sv_user', JSON.stringify(user));
                }
                await refreshPlan();
                navigate('/dashboard');
            }
        } catch {
            navigate('/dashboard');
        }
    };

    const handleContinueAsBeta = () => selectPlan('beta');

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-lg">
                            <MessageCircle className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-lg font-bold text-[#0a6847]">
                            SocioChat<span className="text-[#25D366]">.ai</span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <div className="text-center mb-14">
                    <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-4 py-1.5 rounded-full mb-4">
                        <Sparkles className="w-3.5 h-3.5" />
                        Email Verified Successfully!
                    </div>
                    <h1 className="text-4xl font-bold text-slate-900 mb-3">Choose your plan</h1>
                    <p className="text-lg text-slate-500 max-w-lg mx-auto">
                        Select the plan that best fits your business needs. Upgrade or downgrade anytime.
                    </p>
                </div>

                {/* Plans Grid */}
                <div className="grid md:grid-cols-3 gap-6 mb-12">
                    {plans.map((plan) => (
                        <div key={plan.name}
                            className={`relative bg-white rounded-2xl border-2 p-7 transition-all hover:shadow-xl ${plan.popular
                                ? 'border-[#25D366] shadow-lg shadow-[#25D366]/10 scale-[1.02]'
                                : 'border-slate-200 hover:border-slate-300'
                                }`}>
                            {plan.popular && (
                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#0a6847] to-[#25D366] text-white text-xs font-bold px-4 py-1 rounded-full">
                                    Most Popular
                                </div>
                            )}
                            <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${plan.color} mb-4`}>
                                <plan.icon className="w-5 h-5 text-white" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-1">{plan.name}</h3>
                            <p className="text-sm text-slate-500 mb-4">{plan.description}</p>
                            <div className="mb-6">
                                <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                                <span className="text-slate-500 text-sm">{plan.period}</span>
                            </div>
                            <ul className="space-y-2.5 mb-6">
                                {plan.features.map((f, i) => (
                                    <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                                        <Check className="w-4 h-4 text-[#25D366] mt-0.5 flex-shrink-0" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <button
                                onClick={() => {
                                    const slug = PLAN_SLUGS[plan.name];
                                    if (slug) selectPlan(slug);
                                    else if (plan.name === 'Enterprise') selectPlan('enterprise');
                                }}
                                className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${plan.popular
                                    ? 'bg-gradient-to-r from-[#0a6847] to-[#128C7E] text-white shadow-lg shadow-[#25D366]/20 hover:shadow-xl'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}>
                                {plan.cta}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Continue as Beta */}
                <div className="text-center">
                    <div className="inline-flex flex-col items-center bg-white rounded-2xl border border-slate-200 p-6 px-10 shadow-sm">
                        <p className="text-sm text-slate-500 mb-3">
                            Not ready to commit? Try our platform for free.
                        </p>
                        <button onClick={handleContinueAsBeta}
                            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-semibold text-[#128C7E] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all">
                            <Sparkles className="w-4 h-4" />
                            Continue as Beta (30 days free)
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
