import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Check, Loader2, CalendarClock, Lock, Sparkles, Tag, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL } from '@/config';
import { usePlan } from '@/contexts/PlanContext';
import { PLAN_LABELS } from '@/config/featureGating';
import { startPayuCheckout, payuErrorMessage } from '@/lib/payu';
import { UsagePanel, usageRowsFrom } from '@/components/usage/UsageMeter';
import AutoRenewManager from '@/components/AutoRenewManager';

type CurrentInfo = {
    plan_slug: string;
    effective_plan: string;
    /** True only when the user has actively selected/paid a plan (not the default baseline). */
    has_selected_plan?: boolean;
    billing_scope: string;
    is_private_slot: boolean;
    subscription_expires_at: string | null;
    beta_expires_at: string | null;
    is_expired: boolean;
};

// Resolve the date that actually governs the user's current plan: the beta
// trial date for the beta plan, otherwise the paid-subscription date.
function relevantExpiryDate(current: CurrentInfo): string | null {
    if (current.effective_plan === 'beta') return current.beta_expires_at;
    return current.subscription_expires_at;
}

// Compute whole-day difference between a date and "now" (positive = future).
function daysUntil(iso: string): number {
    const ms = new Date(iso).getTime() - Date.now();
    return Math.ceil(ms / 86_400_000);
}

function formatExpiryDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
    });
}

// A loose shape for a single plan entry from /my-plans. Known fields are typed;
// the rest of the object is the feature matrix (feature_key -> boolean | number).
type PlanInfo = {
    name?: string;
    description?: string;
    price_monthly_inr?: number | null;
    billing_period?: string;
    plan_scope?: string;
    offer_text?: string | null;
    [key: string]: unknown;
};

// Period suffix shown next to the price.
function periodSuffix(billingPeriod?: string): string {
    switch (billingPeriod) {
        case 'quarterly':
            return '/quarter';
        case 'yearly':
            return '/yr';
        default:
            return '/mo';
    }
}

// Render a numeric limit: -1 means unlimited; everything else is locale-grouped.
function formatLimit(value: number): string {
    if (value === -1) return 'Unlimited';
    return value.toLocaleString('en-US');
}

// Prettify a feature_key into a human label: split on '_', title-case each word,
// then fix up a couple of well-known acronyms.
function prettifyFeatureKey(key: string): string {
    const label = key
        .split('_')
        .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
        .join(' ');
    return label
        .replace(/\bAi\b/g, 'AI')
        .replace(/\bWhatsapp\b/g, 'WhatsApp');
}

// Well-known LIMIT keys (numeric) to surface as the leading highlights, with the
// label shown to the user. Order here is the display order.
const LIMIT_HIGHLIGHTS: ReadonlyArray<{ key: string; label: string }> = [
    { key: 'workspaces', label: 'Workspaces' },
    { key: 'users', label: 'Users' },
    { key: 'messages_per_day', label: 'Messages/day' },
    { key: 'interactive_flows', label: 'Interactive flows' },
    { key: 'image_credits', label: 'Image credits' },
];

// Keys that are part of the plan's metadata (not feature-matrix entries) and must
// never be treated as access features.
const NON_FEATURE_KEYS = new Set<string>([
    'name',
    'description',
    'price_monthly_inr',
    'billing_period',
    'plan_scope',
    'offer_text',
]);

const MAX_HIGHLIGHTS = 6;

type Highlight = { text: string; emphasis?: boolean };

// Build the "What's included" highlight list for a plan: numeric limit keys first
// (in LIMIT_HIGHLIGHTS order), then enabled (boolean true) access features. Limit
// keys are excluded from the access list so they aren't duplicated. Returns the
// capped list plus a count of how many items were trimmed.
function buildHighlights(info: PlanInfo): { items: Highlight[]; extra: number } {
    const items: Highlight[] = [];

    // Leading numeric limits.
    for (const { key, label } of LIMIT_HIGHLIGHTS) {
        const value = info[key];
        if (typeof value === 'number') {
            items.push({ text: `${label}: ${formatLimit(value)}`, emphasis: true });
        }
    }

    // Enabled access features (boolean true), excluding metadata + limit keys.
    const limitKeys = new Set(LIMIT_HIGHLIGHTS.map((h) => h.key));
    for (const [key, value] of Object.entries(info)) {
        if (NON_FEATURE_KEYS.has(key) || limitKeys.has(key)) continue;
        if (value === true) {
            items.push({ text: prettifyFeatureKey(key) });
        }
    }

    if (items.length <= MAX_HIGHLIGHTS) return { items, extra: 0 };
    return { items: items.slice(0, MAX_HIGHLIGHTS), extra: items.length - MAX_HIGHLIGHTS };
}

// Display the price block: null -> "Custom", 0 -> "Free", else the rupee amount
// with the period suffix.
function PriceBlock({ info }: { info: PlanInfo }) {
    const price = info.price_monthly_inr;
    if (price == null) {
        return (
            <div>
                <p className="text-3xl font-bold tracking-tight">Custom</p>
                <p className="text-sm text-muted-foreground">Contact us</p>
            </div>
        );
    }
    if (price === 0) {
        return <p className="text-3xl font-bold tracking-tight">Free</p>;
    }
    return (
        <p className="text-3xl font-bold tracking-tight">
            ₹{price.toLocaleString('en-US')}
            <span className="text-sm font-normal text-muted-foreground">{periodSuffix(info.billing_period)}</span>
        </p>
    );
}

export default function SubscriptionPage() {
    const navigate = useNavigate();
    const { plan: currentPlan, refreshPlan, isFeatureEnabled } = usePlan();
    const [plans, setPlans] = useState<Record<string, Record<string, unknown>>>({});
    const [current, setCurrent] = useState<CurrentInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState<string | null>(null);
    const [usage, setUsage] = useState<Record<string, unknown> | null>(null);
    const [autoRenew, setAutoRenew] = useState(true);  // auto-renew opt-in at checkout

    useEffect(() => {
        const userId = localStorage.getItem('sv_user_id');
        const svToken = sessionStorage.getItem('sv_token') || localStorage.getItem('sv_token');
        if (!userId && !svToken) {
            navigate('/signup', { replace: true });
        }
    }, [navigate]);

    useEffect(() => {
        const loadPlans = async () => {
            try {
                // Prefer the authenticated, tenant-aware catalog so a tenant's users
                // see THEIR tenant's plans. Send the same auth the rest of the app uses
                // (credentials + X-User-Id fallback for blocked cookies).
                const userId = localStorage.getItem('sv_user_id');
                const svToken = sessionStorage.getItem('sv_token') || localStorage.getItem('sv_token');
                const res = await fetch(`${API_BASE_URL}/api/subscription/my-plans`, {
                    credentials: 'include',
                    headers: {
                        ...(userId ? { 'X-User-Id': userId } : {}),
                        ...(svToken ? { Authorization: `Bearer ${svToken}` } : {}),
                    },
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        setPlans(data.plans || {});
                        // my-plans is tenant/private-slot aware and includes `current`.
                        if (data.current) setCurrent(data.current as CurrentInfo);
                        // Also load usage/exhaustion stats for the meters (best-effort).
                        fetch(`${API_BASE_URL}/api/subscription/usage`, {
                            credentials: 'include',
                            headers: {
                                ...(userId ? { 'X-User-Id': userId } : {}),
                                ...(svToken ? { Authorization: `Bearer ${svToken}` } : {}),
                            },
                        })
                            .then((r) => (r.ok ? r.json() : null))
                            .then((d) => { if (d?.success) setUsage(d.usage); })
                            .catch(() => {});
                        return;
                    }
                }
                // Fall back to the public global catalog for logged-out viewing
                // (e.g. /my-plans responded 401/!ok).
                const fallback = await fetch(`${API_BASE_URL}/api/subscription/plans`);
                const fallbackData = await fallback.json();
                if (fallbackData.success) setPlans(fallbackData.plans || {});
            } catch {
                // Network error — leave plans empty; the page renders gracefully.
            } finally {
                setLoading(false);
            }
        };
        loadPlans();
    }, []);

    const selectPlan = async (slug: string) => {
        const svToken = sessionStorage.getItem('sv_token') || localStorage.getItem('sv_token');
        // Derive the user id from sv_user_id, or fall back to the stored user object
        // (some login/verify responses set sv_user but not sv_user_id).
        let userId = localStorage.getItem('sv_user_id') || '';
        if (!userId) {
            try {
                userId = String(JSON.parse(localStorage.getItem('sv_user') || 'null')?.id || '');
            } catch { /* ignore */ }
        }
        // Only bounce to login if genuinely unauthenticated. If a valid token is
        // present (the plans page already loaded with it), proceed — otherwise a
        // missing sv_user_id was wrongly sending logged-in users back to /login.
        if (!svToken && !userId) {
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
                    ...(userId ? { 'X-User-Id': userId } : {}),
                    ...(svToken ? { Authorization: `Bearer ${svToken}` } : {}),
                },
                body: JSON.stringify({ plan: slug }),
            });
            const data = await res.json().catch(() => ({}));
            if (data.success) {
                await refreshPlan();
                navigate('/dashboard');
                return;
            }
            // Paid plan -> route through PayU (success redirects the page away).
            if (res.status === 402 || data.requires_payment) {
                // After payment, return to THIS subscription page (where they
                // started) so they see their now-active plan — not a generic dashboard.
                const r = await startPayuCheckout('user_plan', slug, '/subscription', autoRenew && isFeatureEnabled('recurring_payment'));
                if (!r.ok) alert(payuErrorMessage(r.error, r.isTenantLicense));
                return;
            }
            alert(payuErrorMessage(data.error));
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

    // The user is "on" an active, non-expired plan -> paid cards read "Upgrade"
    // rather than "Choose plan".
    const hasActivePlan = !!current && !current.is_expired;

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4">
            <div className="max-w-5xl mx-auto space-y-8">
                <Button variant="ghost" onClick={() => navigate('/dashboard')} className="mb-2">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Dashboard
                </Button>
                <div className="text-center">
                    <Crown className="h-10 w-10 mx-auto text-amber-500 mb-3" />
                    <h1 className="text-3xl font-bold">Your Subscription</h1>
                    {!current && (
                        <p className="text-muted-foreground mt-1">
                            Current plan: <span className="font-semibold capitalize">{PLAN_LABELS[currentPlan] || currentPlan}</span>
                        </p>
                    )}
                </div>

                {isFeatureEnabled('recurring_payment') && (
                  <>
                    {/* Auto-renew: current status + cancel */}
                    <AutoRenewManager />

                    {/* Auto-renew opt-in applied to the next checkout */}
                    <label className="flex items-center gap-2 justify-center text-sm text-muted-foreground cursor-pointer">
                        <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="h-4 w-4" />
                        Auto-renew my plan each period (recurring payment via PayU) — you can turn this off anytime.
                    </label>
                  </>
                )}

                {current?.has_selected_plan && (() => {
                    const planName =
                        PLAN_LABELS[current.effective_plan] ||
                        current.effective_plan ||
                        current.plan_slug;
                    const expiryIso = relevantExpiryDate(current);
                    const days = expiryIso ? daysUntil(expiryIso) : null;

                    // Color-code the expiry badge: red when expired, amber when
                    // within two weeks, emerald otherwise.
                    let badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                    let expiryText = 'No expiry';
                    if (current.is_expired) {
                        badgeClass = 'bg-red-100 text-red-800 border-red-200';
                        expiryText = 'Expired';
                    } else if (expiryIso && days != null) {
                        if (days <= 0) {
                            badgeClass = 'bg-red-100 text-red-800 border-red-200';
                            expiryText = `Expires ${formatExpiryDate(expiryIso)} (today)`;
                        } else {
                            if (days <= 14) badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
                            const rel = days === 1 ? 'in 1 day' : `in ${days} days`;
                            expiryText = `Expires ${formatExpiryDate(expiryIso)} (${rel})`;
                        }
                    }

                    return (
                        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
                            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">Current plan</p>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-2xl font-bold capitalize">{planName}</span>
                                        {current.is_private_slot && (
                                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                                                <Lock className="h-3 w-3" /> Private plan
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className={`inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1 text-sm font-semibold ${badgeClass}`}>
                                    <CalendarClock className="h-4 w-4" /> {expiryText}
                                </span>
                            </CardContent>
                        </Card>
                    );
                })()}

                {usage && (
                    <Card>
                        <CardContent className="p-6">
                            <UsagePanel title="Current usage" rows={usageRowsFrom(usage)} />
                        </CardContent>
                    </Card>
                )}

                <div>
                    <h2 className="text-xl font-semibold">
                        {current?.is_private_slot ? 'Your private plans' : 'Available plans'}
                    </h2>
                    {current?.is_private_slot && (
                        <p className="text-sm text-muted-foreground mt-1">
                            These plans are available only to your account.
                        </p>
                    )}
                </div>

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(plans).map(([slug, raw]) => {
                        const info = raw as PlanInfo;
                        // The active plan is the effective plan when /my-plans gave us
                        // `current`; otherwise fall back to the context plan (used by the
                        // logged-out public catalog path).
                        // Highlight a plan as "Current" ONLY when the user has actively
                        // selected/paid one — a brand-new user (default/baseline plan)
                        // shows nothing pre-selected and must pick a plan.
                        const isActive = current
                            ? (current.has_selected_plan === true && slug === current.effective_plan)
                            : slug === currentPlan;
                        const isPrivate = info.plan_scope === 'private';
                        const { items, extra } = buildHighlights(info);
                        const isPaid = info.price_monthly_inr != null && info.price_monthly_inr > 0;
                        // Admin-set promotional note. Only render when it's a non-empty string.
                        const offerText =
                            typeof info.offer_text === 'string' ? info.offer_text.trim() : '';

                        return (
                            <Card
                                key={slug}
                                className={`flex h-full flex-col transition-shadow hover:shadow-md ${
                                    isActive
                                        ? 'border-emerald-500 ring-2 ring-emerald-500 shadow-sm'
                                        : 'border-slate-200'
                                }`}
                            >
                                <CardHeader className="space-y-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <CardTitle className="capitalize">{String(info.name || slug)}</CardTitle>
                                        {isActive && (
                                            <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                                                <Check className="mr-1 h-3 w-3" /> Current
                                            </Badge>
                                        )}
                                        {isPrivate && (
                                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">
                                                <Lock className="mr-1 h-3 w-3" /> Private
                                            </Badge>
                                        )}
                                    </div>
                                    {offerText && (
                                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                                            <Tag className="mt-0.5 h-4 w-4 shrink-0" />
                                            <span className="break-words leading-snug">{offerText}</span>
                                        </div>
                                    )}
                                    <PriceBlock info={info} />
                                    {info.description && (
                                        <p className="text-sm text-muted-foreground">{info.description}</p>
                                    )}
                                </CardHeader>
                                <CardContent className="flex flex-1 flex-col">
                                    {items.length > 0 && (
                                        <div className="mb-6 space-y-2">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                What&apos;s included
                                            </p>
                                            <ul className="space-y-1.5">
                                                {items.map((item, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm">
                                                        {item.emphasis ? (
                                                            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                                        ) : (
                                                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                                                        )}
                                                        <span className={item.emphasis ? 'font-medium text-slate-800' : 'text-slate-700'}>
                                                            {item.text}
                                                        </span>
                                                    </li>
                                                ))}
                                                {extra > 0 && (
                                                    <li className="pl-6 text-sm text-muted-foreground">+{extra} more</li>
                                                )}
                                            </ul>
                                        </div>
                                    )}
                                    <div className="mt-auto">
                                        {isActive ? (
                                            <Button disabled className="w-full" variant="outline">
                                                <Check className="mr-1 h-4 w-4" /> Current Plan
                                            </Button>
                                        ) : (
                                            <Button
                                                className="w-full bg-emerald-600 hover:bg-emerald-700"
                                                onClick={() => selectPlan(slug)}
                                                disabled={selecting === slug}
                                            >
                                                {selecting === slug ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : isPaid && hasActivePlan ? (
                                                    'Upgrade'
                                                ) : (
                                                    'Choose plan'
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
