// src/pages/superadmin/TenantWizardPage.tsx
// 5-step "Create Tenant" wizard. ALL edits live in React state (draft); nothing
// is persisted until the final "Create Tenant" button on the Create step.
// The Preview step reads the draft branding and updates in real time.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    Monitor,
    Tablet,
    Smartphone,
    Maximize2,
    Loader2,
    PartyPopper,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
    superAdminApi,
    DEFAULT_BRANDING,
    type Branding,
    type FeatureCatalogItem,
    type PlanItem,
    type TenantPlan,
    type FeatureOverrideMap,
    type CreateTenantCredentials,
    type CreateTenantPayload,
} from '@/components/superadmin/useSuperAdminApi';
import { BrandingForm } from '@/components/superadmin/BrandingForm';
import { PlanPicker } from '@/components/superadmin/PlanPicker';
import { FeaturesEditor } from '@/components/superadmin/FeaturesEditor';
import { BrandingPreview, type PreviewDevice } from '@/components/superadmin/BrandingPreview';
import { FullPreviewModal } from '@/components/superadmin/FullPreviewModal';
import { CredentialsCard } from '@/components/superadmin/CredentialsCard';

const STEPS = ['Basic Info', 'Branding', 'Features', 'Preview', 'Create'];

interface BasicInfo {
    company_name: string;
    tenant_code: string;
    custom_domain: string;
    phone_number: string;
    plan: string;
    expires_at: string; // YYYY-MM-DD; blank = never expires
    admin_email: string;
    demo_email: string;
}

const DEVICES: { id: PreviewDevice; icon: typeof Monitor; label: string }[] = [
    { id: 'desktop', icon: Monitor, label: 'Desktop' },
    { id: 'tablet', icon: Tablet, label: 'Tablet' },
    { id: 'mobile', icon: Smartphone, label: 'Mobile' },
];

export default function TenantWizardPage() {
    const navigate = useNavigate();
    const { toast } = useToast();

    const [step, setStep] = useState(0);
    const [basic, setBasic] = useState<BasicInfo>({
        company_name: '',
        tenant_code: '',
        custom_domain: '',
        phone_number: '',
        plan: '',
        expires_at: '',
        admin_email: '',
        demo_email: '',
    });
    // Draft branding — single source of truth for the live preview.
    const [branding, setBranding] = useState<Branding>({ ...DEFAULT_BRANDING });
    const [overrides, setOverrides] = useState<FeatureOverrideMap>({});

    // White-label LICENSE plans (the catalog this tenant is licensed under).
    const [licensePlans, setLicensePlans] = useState<TenantPlan[]>([]);
    const [features, setFeatures] = useState<FeatureCatalogItem[]>([]);
    const [featuresLoading, setFeaturesLoading] = useState(true);

    const [device, setDevice] = useState<PreviewDevice>('desktop');
    const [fullPreview, setFullPreview] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [created, setCreated] = useState(false);
    const [credentials, setCredentials] = useState<CreateTenantCredentials | null>(null);

    // Keep the branding company_name loosely in sync with the basic info field
    // until the user explicitly customizes branding identity.
    const setBasicField = (key: keyof BasicInfo, value: string) => {
        setBasic((prev) => ({ ...prev, [key]: value }));
        if (key === 'company_name') {
            setBranding((prev) => ({ ...prev, company_name: value || DEFAULT_BRANDING.company_name }));
        }
    };

    useEffect(() => {
        (async () => {
            try {
                const [p, f] = await Promise.all([
                    superAdminApi.listLicensePlans(),
                    superAdminApi.listFeatures(),
                ]);
                setLicensePlans(p.plans || []);
                setFeatures(f.features || []);
                // No auto-select: the white-label license is optional. The tenant owner
                // chooses and pays for a plan later using the generated admin credentials.
            } catch (err) {
                toast({
                    title: 'Error',
                    description: err instanceof Error ? err.message : 'Failed to load catalog',
                    variant: 'destructive',
                });
            } finally {
                setFeaturesLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // The white-label license is optional — only the company name is required to proceed.
    const basicValid = basic.company_name.trim().length > 0;

    const canProceed = useMemo(() => {
        if (step === 0) return basicValid;
        return true;
    }, [step, basicValid]);

    const goNext = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
    const goBack = () => setStep((s) => Math.max(s - 1, 0));

    const enabledFeatureCount = Object.values(overrides).filter((o) => o.enabled).length;

    // Adapt the white-label LICENSE catalog into the shape PlanPicker expects.
    const planOptions = useMemo<PlanItem[]>(
        () =>
            licensePlans.map((tp) => ({
                slug: tp.slug,
                name: tp.name,
                price_monthly_inr: tp.price_inr ?? null,
                description: tp.description ?? null,
            })),
        [licensePlans],
    );

    const buildPayload = (): CreateTenantPayload => ({
        company_name: basic.company_name.trim(),
        tenant_code: basic.tenant_code.trim() || undefined,
        custom_domain: basic.custom_domain.trim() || undefined,
        phone_number: basic.phone_number.trim() || undefined,
        plan: basic.plan,
        subscription_expires_at: basic.expires_at
            ? new Date(basic.expires_at).toISOString()
            : undefined,
        branding,
        features: overrides,
        admin_email: basic.admin_email.trim() || undefined,
        demo_email: basic.demo_email.trim() || undefined,
    });

    const handleCreate = async () => {
        setSubmitting(true);
        try {
            const res = await superAdminApi.createTenant(buildPayload());
            if (res.success) {
                setCredentials(res.credentials || null);
                setCreated(true);
                toast({ title: 'Tenant created', description: basic.company_name });
            }
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to create tenant',
                variant: 'destructive',
            });
        } finally {
            setSubmitting(false);
        }
    };

    /* -------------------------------- Steps -------------------------------- */

    const renderBasic = () => (
        <div className="max-w-2xl space-y-4">
            <div className="space-y-1.5">
                <Label>Company name *</Label>
                <Input
                    value={basic.company_name}
                    onChange={(e) => setBasicField('company_name', e.target.value)}
                    placeholder="Acme Marketing"
                />
            </div>
            <div className="space-y-1.5">
                <Label>Tenant code</Label>
                <Input
                    value={basic.tenant_code}
                    onChange={(e) => setBasicField('tenant_code', e.target.value)}
                    placeholder="acme"
                    className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                    Leave blank to auto-generate a unique code from the company name.
                </p>
            </div>
            <div className="space-y-1.5">
                <Label>Custom domain (optional)</Label>
                <Input
                    value={basic.custom_domain}
                    onChange={(e) => setBasicField('custom_domain', e.target.value)}
                    placeholder="app.acme.com"
                />
            </div>
            <div className="space-y-1.5">
                <Label>Phone number (optional)</Label>
                <Input
                    type="tel"
                    value={basic.phone_number}
                    onChange={(e) => setBasicField('phone_number', e.target.value)}
                    placeholder="+91 98765 43210"
                />
            </div>
            <div className="space-y-2">
                <Label>White-label license (optional)</Label>
                <p className="text-xs text-muted-foreground">
                    Leave unselected — the tenant owner can choose and pay for a plan after logging in
                    with the generated admin credentials. The selected license is highlighted.
                </p>
                <PlanPicker plans={planOptions} value={basic.plan} onChange={(v) => setBasicField('plan', v)} />
                {!basic.plan && (
                    <p className="text-xs text-muted-foreground">
                        No license selected — the tenant will choose &amp; pay for a plan later.
                    </p>
                )}
            </div>
            <div className="space-y-1.5 max-w-xs">
                <Label>License expires (optional)</Label>
                <Input
                    type="date"
                    value={basic.expires_at}
                    onChange={(e) => setBasicField('expires_at', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                    Leave blank for a license that never expires.
                </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label>Admin email (optional)</Label>
                    <Input
                        value={basic.admin_email}
                        onChange={(e) => setBasicField('admin_email', e.target.value)}
                        placeholder="admin@acme.com"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label>Demo email (optional)</Label>
                    <Input
                        value={basic.demo_email}
                        onChange={(e) => setBasicField('demo_email', e.target.value)}
                        placeholder="demo@acme.com"
                    />
                </div>
            </div>
            <p className="text-xs text-muted-foreground">
                Admin and demo accounts are generated automatically; emails are optional overrides.
            </p>
        </div>
    );

    const renderBranding = () => (
        <div className="grid gap-6 min-w-0 lg:grid-cols-2">
            <div className="min-w-0">
                <BrandingForm branding={branding} onChange={setBranding} />
            </div>
            <div className="min-w-0 lg:sticky lg:top-4 self-start w-full">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-600">Live preview</p>
                    <Button variant="outline" size="sm" onClick={() => setFullPreview(true)}>
                        <Maximize2 className="h-4 w-4" /> Full
                    </Button>
                </div>
                <div className="min-w-0 max-w-full overflow-hidden rounded-xl border bg-slate-50 p-3">
                    <BrandingPreview branding={branding} device="mobile" />
                </div>
            </div>
        </div>
    );

    const renderFeatures = () => (
        <div className="max-w-3xl">
            <p className="mb-4 text-sm text-muted-foreground">
                Toggle the features this tenant should have. Overrides set here apply on top of the
                selected plan.
            </p>
            <FeaturesEditor
                features={features}
                overrides={overrides}
                onChange={setOverrides}
                loading={featuresLoading}
            />
        </div>
    );

    const renderPreview = () => (
        <div className="space-y-5 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                    {DEVICES.map((d) => (
                        <button
                            key={d.id}
                            type="button"
                            title={d.label}
                            onClick={() => setDevice(d.id)}
                            className={cn(
                                'flex items-center justify-center h-9 w-9 rounded-md transition-colors',
                                device === d.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500',
                            )}
                        >
                            <d.icon className="h-4 w-4" />
                        </button>
                    ))}
                </div>
                <Button variant="outline" onClick={() => setFullPreview(true)}>
                    <Maximize2 className="h-4 w-4" /> Open Full Preview
                </Button>
            </div>

            <div className="min-w-0 max-w-full overflow-hidden rounded-xl border bg-slate-50 p-4">
                <BrandingPreview branding={branding} device={device} />
            </div>

            <div className="grid gap-4 min-w-0 md:grid-cols-2">
                <Card>
                    <CardContent className="p-4 space-y-2 text-sm">
                        <h3 className="font-semibold text-slate-700">Basic info</h3>
                        <dl className="space-y-1">
                            <div className="flex justify-between gap-2">
                                <dt className="text-muted-foreground">Company</dt>
                                <dd className="font-medium">{basic.company_name || '—'}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                                <dt className="text-muted-foreground">Tenant code</dt>
                                <dd className="font-mono">{basic.tenant_code || '(auto)'}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                                <dt className="text-muted-foreground">Custom domain</dt>
                                <dd>{basic.custom_domain || '—'}</dd>
                            </div>
                            <div className="flex justify-between gap-2">
                                <dt className="text-muted-foreground">License plan</dt>
                                <dd className={basic.plan ? 'capitalize' : ''}>
                                    {planOptions.find((p) => p.slug === basic.plan)?.name ||
                                        basic.plan ||
                                        'None — tenant will choose & pay'}
                                </dd>
                            </div>
                            <div className="flex justify-between gap-2">
                                <dt className="text-muted-foreground">Subscription expires</dt>
                                <dd>{basic.expires_at || 'Never'}</dd>
                            </div>
                        </dl>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 space-y-2 text-sm">
                        <h3 className="font-semibold text-slate-700">
                            Enabled features ({enabledFeatureCount})
                        </h3>
                        {enabledFeatureCount === 0 ? (
                            <p className="text-muted-foreground">No feature overrides — plan defaults apply.</p>
                        ) : (
                            <ul className="space-y-1">
                                {features
                                    .filter((f) => overrides[f.key]?.enabled)
                                    .map((f) => (
                                        <li key={f.key} className="flex items-center justify-between gap-2">
                                            <span>{f.label}</span>
                                            {overrides[f.key]?.limit_value != null && (
                                                <span className="text-xs text-muted-foreground">
                                                    limit {overrides[f.key]?.limit_value}
                                                </span>
                                            )}
                                        </li>
                                    ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );

    const renderCreate = () => {
        if (created && credentials) {
            return (
                <div className="max-w-3xl space-y-6">
                    <div className="flex items-center gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-800">
                        <PartyPopper className="h-6 w-6" />
                        <div>
                            <p className="font-semibold">Tenant created successfully</p>
                            <p className="text-sm">
                                {basic.company_name} is ready. Save the credentials below.
                            </p>
                        </div>
                    </div>
                    <CredentialsCard credentials={credentials} />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => navigate('/superadmin/tenants')}>
                            Back to tenants
                        </Button>
                    </div>
                </div>
            );
        }

        return (
            <div className="max-w-2xl space-y-6">
                <Card>
                    <CardContent className="p-5 space-y-3 text-sm">
                        <h3 className="font-semibold text-slate-700">Review &amp; create</h3>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                                <span className="text-muted-foreground">Company: </span>
                                <span className="font-medium">{basic.company_name || '—'}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Code: </span>
                                <span className="font-mono">{basic.tenant_code || '(auto)'}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">License plan: </span>
                                <span className={basic.plan ? 'capitalize' : ''}>
                                    {planOptions.find((p) => p.slug === basic.plan)?.name ||
                                        basic.plan ||
                                        'None — tenant will choose & pay'}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Expires: </span>
                                <span>{basic.expires_at || 'Never'}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Domain: </span>
                                <span>{basic.custom_domain || '—'}</span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Features enabled: </span>
                                <span>{enabledFeatureCount}</span>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground pt-2 border-t">
                            Nothing has been saved yet. Clicking the button below creates the tenant and
                            generates admin + demo credentials (shown once).
                        </p>
                    </CardContent>
                </Card>
                <div className="flex justify-end">
                    <Button size="lg" onClick={handleCreate} disabled={submitting || !basicValid}>
                        {submitting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                            </>
                        ) : (
                            <>
                                <Check className="h-4 w-4" /> Create Tenant
                            </>
                        )}
                    </Button>
                </div>
            </div>
        );
    };

    const stepContent = [
        renderBasic,
        renderBranding,
        renderFeatures,
        renderPreview,
        renderCreate,
    ][step]();

    return (
        <div className="w-full min-w-0 space-y-6">
          <div className="mx-auto w-full max-w-5xl space-y-6">
            <div>
                <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate('/superadmin/tenants')}>
                    <ArrowLeft className="h-4 w-4" /> Tenants
                </Button>
                <h1 className="text-2xl font-bold mt-1">Create Tenant</h1>
            </div>

            {/* Progress indicator — scrolls horizontally on very small screens; labels hide below sm */}
            <div className="flex items-center overflow-x-auto pb-1 -mx-1 px-1">
                {STEPS.map((label, i) => {
                    const done = i < step || (created && i <= step);
                    const isCurrent = i === step;
                    return (
                        <div key={label} className="flex items-center flex-1 last:flex-none min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <div
                                    className={cn(
                                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                                        done
                                            ? 'bg-emerald-600 text-white'
                                            : isCurrent
                                              ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500'
                                              : 'bg-slate-100 text-slate-400',
                                    )}
                                >
                                    {done ? <Check className="h-4 w-4" /> : i + 1}
                                </div>
                                <span
                                    className={cn(
                                        'text-sm font-medium hidden sm:inline whitespace-nowrap',
                                        isCurrent ? 'text-slate-900' : 'text-slate-400',
                                    )}
                                >
                                    {label}
                                </span>
                            </div>
                            {i < STEPS.length - 1 && (
                                <div
                                    className={cn(
                                        'flex-1 min-w-[1rem] h-0.5 mx-2 sm:mx-3',
                                        i < step ? 'bg-emerald-600' : 'bg-slate-200',
                                    )}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="min-h-[300px] min-w-0">{stepContent}</div>

            {/* Footer nav — hidden once created on the final step */}
            {!(created && step === STEPS.length - 1) && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <Button variant="outline" onClick={goBack} disabled={step === 0 || submitting}>
                        <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    {step < STEPS.length - 1 && (
                        <Button onClick={goNext} disabled={!canProceed}>
                            Next <ArrowRight className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            )}
          </div>

            <FullPreviewModal
                open={fullPreview}
                onClose={() => setFullPreview(false)}
                branding={branding}
                initialSection="dashboard"
                initialDevice={device}
            />
        </div>
    );
}
