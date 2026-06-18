import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_BASE_URL } from '@/config';
import { usePlan } from '@/contexts/PlanContext';
import { PLAN_LABELS } from '@/config/featureGating';

export default function SubscriptionPage() {
    const navigate = useNavigate();
    const { plan: currentPlan, refreshPlan } = usePlan();
    const [plans, setPlans] = useState<Record<string, Record<string, unknown>>>({});
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState<string | null>(null);

    useEffect(() => {
        fetch(`${API_BASE_URL}/api/subscription/plans`)
            .then(r => r.json())
            .then(data => {
                if (data.success) setPlans(data.plans || {});
            })
            .finally(() => setLoading(false));
    }, []);

    const selectPlan = async (slug: string) => {
        const userId = localStorage.getItem('sv_user_id');
        if (!userId) {
            navigate('/login');
            return;
        }
        setSelecting(slug);
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
                await refreshPlan();
                navigate('/dashboard');
            }
        } finally {
            setSelecting(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4">
            <div className="max-w-5xl mx-auto space-y-8">
                <div className="text-center">
                    <Crown className="h-10 w-10 mx-auto text-amber-500 mb-3" />
                    <h1 className="text-3xl font-bold">Your Subscription</h1>
                    <p className="text-muted-foreground mt-1">
                        Current plan: <span className="font-semibold capitalize">{PLAN_LABELS[currentPlan] || currentPlan}</span>
                    </p>
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                    {Object.entries(plans).map(([slug, info]) => (
                        <Card key={slug} className={slug === currentPlan ? 'ring-2 ring-emerald-500' : ''}>
                            <CardHeader>
                                <CardTitle className="capitalize">{String(info.name || slug)}</CardTitle>
                                {info.price_monthly_inr != null && (
                                    <p className="text-2xl font-bold">₹{String(info.price_monthly_inr)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                                )}
                            </CardHeader>
                            <CardContent>
                                {slug === currentPlan ? (
                                    <Button disabled className="w-full" variant="outline">
                                        <Check className="h-4 w-4 mr-1" /> Current Plan
                                    </Button>
                                ) : (
                                    <Button className="w-full" onClick={() => selectPlan(slug)} disabled={selecting === slug}>
                                        {selecting === slug ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Select Plan'}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
