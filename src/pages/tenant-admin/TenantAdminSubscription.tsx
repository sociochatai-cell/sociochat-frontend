// src/pages/tenant-admin/TenantAdminSubscription.tsx
// Tenant owner's self-service "My Subscription": view the white-label LICENSE
// the platform granted this tenant and switch license plans themselves via a
// two-step placeholder PAYMENT FLOW (checkout -> "pay" -> activate). The
// gateway is a placeholder for now: "Proceed to payment" records the chosen
// plan as pending + returns the amount due, and "Pay now (demo)" marks it
// active/paid. Everything is scoped to the admin's own tenant via
// /api/tenant/admin/subscription and uses tenantAdminApi. Brand-remapped
// emerald/slate utilities, matching the other tenant-admin pages.
import { useEffect, useState } from 'react';
import {
    CreditCard,
    RefreshCw,
    Loader2,
    CheckCircle2,
    Users,
    LayoutGrid,
    CalendarClock,
    BadgeIndianRupee,
    Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
    tenantAdminApi,
    type AdminSubscriptionResponse,
    type TenantPlan,
    type TenantPayuConfig,
} from './tenantAdminApi';
import { Input } from '@/components/ui/input';
import { KeyRound } from 'lucide-react';
import { startPayuCheckout, payuErrorMessage } from '@/lib/payu';

/* -------------------------------- Helpers -------------------------------- */

/** Normalize a billing period to a short "/mo" | "/yr" suffix. */
function periodSuffix(period?: string | null): string {
    const p = (period || '').toLowerCase();
    return p.startsWith('year') || p === 'yr' || p === 'yearly' || p === 'annual' || p === 'annually'
        ? '/yr'
        : '/mo';
}

/** Human-friendly price string for a plan. null ⇒ "Custom pricing"; <=0 ⇒ "Free". */
function formatPrice(plan: TenantPlan): string {
    const price = plan.price_inr;
    if (price == null) return 'Custom pricing';
    if (price <= 0) return 'Free';
    return `₹${price}${periodSuffix(plan.billing_period)}`;
}

/** Limit display: -1 or null ⇒ "Unlimited"; otherwise the number. */
function formatLimit(value?: number | null): string {
    if (value == null || value === -1) return 'Unlimited';
    return String(value);
}

function formatDate(d?: string | null): string {
    if (!d) return 'No expiry';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Color-coded payment-status badge: pending⇒amber, active/paid⇒emerald, else⇒slate. */
function PaymentStatusBadge({ status }: { status?: string | null }) {
    const s = (status || '').toLowerCase();
    const isActive = s === 'active' || s === 'paid';
    const isPending = s === 'pending';
    const cls = isActive
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
        : isPending
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-50 text-slate-600';
    const label = isActive ? 'Active' : isPending ? 'Payment pending' : 'Not paid';
    return (
        <Badge variant="outline" className={cn(cls)}>
            {label}
        </Badge>
    );
}

interface LimitRowProps {
    label: string;
    value: React.ReactNode;
    icon: React.ElementType;
}

function LimitRow({ label, value, icon: Icon }: LimitRowProps) {
    return (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-slate-50 px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-slate-600">
                <Icon className="h-4 w-4 text-emerald-600" />
                {label}
            </span>
            <span className="text-sm font-semibold text-slate-900">{value}</span>
        </div>
    );
}


/* ---------------------- Bring-Your-Own PayU settings ---------------------- */

function PayuSettingsCard() {
    const { toast } = useToast();
    const [cfg, setCfg] = useState<TenantPayuConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [key, setKey] = useState('');
    const [salt, setSalt] = useState('');
    const [mode, setMode] = useState('test');
    const [saltVersion, setSaltVersion] = useState('v1');

    const load = async () => {
        setLoading(true);
        try {
            const res = await tenantAdminApi.getPayuConfig();
            setCfg(res.payu);
            setKey(res.payu.payu_key || '');
            setMode(res.payu.payu_mode || 'test');
            setSaltVersion(res.payu.payu_salt_version || 'v1');
        } catch (e: any) {
            toast({ title: 'Failed to load PayU settings', description: e?.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            const payload: Record<string, string> = {
                payu_key: key.trim(),
                payu_mode: mode,
                payu_salt_version: saltVersion,
            };
            // Only send the salt when the admin typed a new one (write-only field).
            if (salt.trim()) payload.payu_salt = salt.trim();
            const res = await tenantAdminApi.savePayuConfig(payload);
            setCfg(res.payu);
            setSalt('');
            toast({
                title: 'PayU settings saved',
                description: res.payu.configured
                    ? 'Your account can now collect subscription payments.'
                    : 'Add both Merchant Key and Salt to start collecting payments.',
            });
        } catch (e: any) {
            toast({ title: 'Could not save PayU settings', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    <KeyRound className="h-5 w-5 text-emerald-600" /> Payment gateway (PayU)
                </CardTitle>
                <Badge
                    variant="outline"
                    className={cn(
                        cfg?.configured
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700',
                    )}
                >
                    {cfg?.configured ? 'Connected' : 'Not configured'}
                </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Enter your own PayU credentials so your customers’ subscription payments
                    settle <span className="font-medium">directly into your account</span>. Your
                    salt is encrypted and never shown again after saving.
                </p>

                {loading ? (
                    <div className="flex h-20 items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Merchant Key</Label>
                            <Input
                                value={key}
                                onChange={(e) => setKey(e.target.value)}
                                placeholder="e.g. gtKFFx"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Merchant Salt {cfg?.has_payu_salt && <span className="text-emerald-600">(saved)</span>}</Label>
                            <Input
                                type="password"
                                value={salt}
                                onChange={(e) => setSalt(e.target.value)}
                                placeholder={cfg?.has_payu_salt ? '•••••••• (leave blank to keep)' : 'Paste your salt'}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Mode</Label>
                            <select
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={mode}
                                onChange={(e) => setMode(e.target.value)}
                            >
                                <option value="test">Test</option>
                                <option value="production">Production</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Salt version</Label>
                            <select
                                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                value={saltVersion}
                                onChange={(e) => setSaltVersion(e.target.value)}
                            >
                                <option value="v1">v1</option>
                                <option value="v2">v2</option>
                            </select>
                        </div>
                    </div>
                )}

                <div className="flex justify-end">
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={save}
                        disabled={saving || loading}
                    >
                        {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <KeyRound className="h-4 w-4 mr-1" />}
                        Save PayU settings
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default function TenantAdminSubscription() {
    const { toast } = useToast();
    const [data, setData] = useState<AdminSubscriptionResponse | null>(null);
    const [loading, setLoading] = useState(true);
    // Slug currently being processed by the page-level checkout (spinner).
    const [licenseBusy, setLicenseBusy] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await tenantAdminApi.getMySubscription();
            setData(res);
        } catch (e: any) {
            toast({
                title: 'Failed to load subscription',
                description: e?.message,
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const subscription = data?.subscription ?? null;
    const tenantPlan = data?.tenant_plan ?? null;
    const availablePlans = data?.available_plans ?? [];
    // No active plan ⇒ subscription null, empty slug, or no matching license.
    const hasActivePlan = Boolean(subscription && subscription.plan_slug && tenantPlan);
    // Currently-selected license slug — ONLY from an actual active subscription,
    // never the tenant's default/baseline plan. Without this gate a brand-new
    // tenant showed its baseline (e.g. enterprise) pre-highlighted as "Current".
    const currentSlug = hasActivePlan ? (subscription?.plan_slug ?? null) : null;

    // After a successful placeholder payment: refresh state + confirm to the user.
    const handlePaid = async (plan: TenantPlan) => {
        await load();
        toast({
            title: 'Payment successful',
            description: `${plan.name} is now active.`,
        });
    };

    // Page-level license checkout — mirrors the working end-user flow exactly
    // (no modal/Dialog in the redirect path, which can swallow the PayU form
    // submit). Priced plan -> PayU; free/custom -> applied directly.
    const payForLicense = async (plan: TenantPlan) => {
        if (plan.slug === currentSlug) return;
        setLicenseBusy(plan.slug);
        try {
            const res = await tenantAdminApi.selectMyPlanResult(plan.slug);
            if (res.ok) {
                await handlePaid(plan);
                return;
            }
            if (res.status === 402 || res.error?.requires_payment) {
                const r = await startPayuCheckout('tenant_license', plan.slug, '/tenant-admin/subscription');
                if (!r.ok) {
                    toast({
                        title: 'Could not start payment',
                        description: payuErrorMessage(r.error, true),
                        variant: 'destructive',
                    });
                    setLicenseBusy(null);
                }
                return; // success: browser is redirecting to PayU
            }
            toast({
                title: 'Could not subscribe',
                description: res.error?.error || res.error?.message || 'Request failed',
                variant: 'destructive',
            });
            setLicenseBusy(null);
        } catch (e: any) {
            toast({ title: 'Could not subscribe', description: e?.message, variant: 'destructive' });
            setLicenseBusy(null);
        }
    };

    if (loading) {
        return (
            <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
            </div>
        );
    }

    const licenseName = tenantPlan?.name || subscription?.plan_slug || '—';

    return (
        <div className="w-full min-w-0 space-y-6 mx-auto max-w-5xl">
            {/* Page header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-xl font-semibold flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-emerald-600" /> My Subscription
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Your white-label license and the plans you can subscribe to.
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={load}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                </Button>
            </div>

            {/* ===================== Your current plan ===================== */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                        <Sparkles className="h-5 w-5 text-emerald-600" /> Your current plan
                    </CardTitle>
                    {hasActivePlan && <PaymentStatusBadge status={subscription?.payment_status} />}
                </CardHeader>
                <CardContent className="space-y-4">
                    {!hasActivePlan ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            You haven't selected a plan yet — choose one below to get started.
                        </p>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-end justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                        License
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-slate-900 break-words">
                                        {licenseName}
                                    </p>
                                    {tenantPlan?.description && (
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {tenantPlan.description}
                                        </p>
                                    )}
                                </div>
                                {tenantPlan && (
                                    <div className="text-right">
                                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                            Price
                                        </p>
                                        <p className="mt-1 text-xl font-semibold text-emerald-600">
                                            {formatPrice(tenantPlan)}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                                <LimitRow
                                    label="Max end-users"
                                    value={formatLimit(tenantPlan?.max_end_users)}
                                    icon={Users}
                                />
                                <LimitRow
                                    label="Max workspaces"
                                    value={formatLimit(tenantPlan?.max_workspaces)}
                                    icon={LayoutGrid}
                                />
                                <LimitRow
                                    label="Expires"
                                    value={formatDate(subscription?.subscription_expires_at)}
                                    icon={CalendarClock}
                                />
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* ========================= Available plans ========================= */}
            <div className="space-y-3">
                <div>
                    <h2 className="text-base font-semibold text-slate-900">Available plans</h2>
                    <p className="text-xs text-muted-foreground">
                        Choose a plan to start a placeholder checkout — pay to activate your license.
                    </p>
                </div>

                {availablePlans.length === 0 ? (
                    <Card>
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            No plans are available to select right now.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {availablePlans.map((plan) => {
                            const isCurrent = plan.slug === currentSlug;
                            return (
                                <Card
                                    key={plan.id}
                                    className={cn(
                                        'flex flex-col transition-colors',
                                        isCurrent
                                            ? 'border-emerald-500 ring-1 ring-emerald-500'
                                            : 'hover:border-emerald-300',
                                    )}
                                >
                                    <CardHeader className="space-y-2 pb-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <CardTitle className="text-base font-semibold text-slate-900">
                                                {plan.name}
                                            </CardTitle>
                                            {isCurrent && (
                                                <Badge
                                                    variant="outline"
                                                    className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700"
                                                >
                                                    <CheckCircle2 className="h-3 w-3" />
                                                    Current plan
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="flex items-center gap-1 text-lg font-semibold text-emerald-600">
                                            <BadgeIndianRupee className="h-4 w-4" />
                                            {formatPrice(plan)}
                                        </p>
                                        {plan.description && (
                                            <p className="text-sm text-muted-foreground">
                                                {plan.description}
                                            </p>
                                        )}
                                    </CardHeader>
                                    <CardContent className="flex flex-1 flex-col gap-3">
                                        <div className="space-y-1.5 text-sm text-slate-600">
                                            <div className="flex items-center justify-between gap-2">
                                                <Label className="font-normal text-slate-500">
                                                    Max end-users
                                                </Label>
                                                <span className="font-medium text-slate-900">
                                                    {formatLimit(plan.max_end_users)}
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <Label className="font-normal text-slate-500">
                                                    Max workspaces
                                                </Label>
                                                <span className="font-medium text-slate-900">
                                                    {formatLimit(plan.max_workspaces)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="mt-auto pt-2">
                                            {isCurrent ? (
                                                <Button variant="outline" className="w-full" disabled>
                                                    <CheckCircle2 className="h-4 w-4 mr-1 text-emerald-600" />
                                                    Current plan
                                                </Button>
                                            ) : (
                                                <Button
                                                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                                                    onClick={() => payForLicense(plan)}
                                                    disabled={licenseBusy !== null}
                                                >
                                                    {licenseBusy === plan.slug ? (
                                                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                    ) : (
                                                        <CreditCard className="h-4 w-4 mr-1" />
                                                    )}
                                                    Choose plan
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ================= Bring-Your-Own PayU credentials ================= */}
            <PayuSettingsCard />
        </div>
    );
}
