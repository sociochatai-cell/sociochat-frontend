// src/pages/superadmin/TenantEditPage.tsx
// Edit an existing tenant: Basic / Branding / Subscription / Features tabs plus
// lifecycle actions (suspend/activate/delete/impersonate). Every tab edits a
// DRAFT in React state; nothing persists until that tab's Save button is
// pressed. The Branding tab shares the same live preview as the creation wizard.
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft, Loader2, Maximize2, Monitor, Tablet, Smartphone,
    Pause, Play, Trash2, LogIn, Save, Plus, ChevronUp,
    Globe, ShieldCheck, ShieldOff, CheckCircle2, Ban,
    KeyRound, Copy, Users, Plug, Gauge, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import {
    superAdminApi, mergeBranding,
    type Branding, type FeatureCatalogItem, type FeatureOverrideMap,
    type PlanItem, type TenantPlan, type TenantDetail, type FeatureOverride, type CustomPlan,
    type DomainStatus, type TenantUser, type TenantIntegration, type SaveIntegrationPayload,
} from '@/components/superadmin/useSuperAdminApi';
import { PlanPicker } from '@/components/superadmin/PlanPicker';
import { getExpiryStatus, EXPIRY_TONE_CLASS } from '@/components/superadmin/subscriptionDisplay';
import { BrandingForm } from '@/components/superadmin/BrandingForm';
import { FeaturesEditor } from '@/components/superadmin/FeaturesEditor';
import { BrandingPreview, type PreviewDevice } from '@/components/superadmin/BrandingPreview';
import { FullPreviewModal } from '@/components/superadmin/FullPreviewModal';
import { useBranding } from '@/branding/BrandingContext';
import { beginImpersonation } from '@/lib/impersonation';
import { UsagePanel, usageRowsFrom } from '@/components/usage/UsageMeter';

const DEVICES: { id: PreviewDevice; icon: typeof Monitor; label: string }[] = [
    { id: 'desktop', icon: Monitor, label: 'Desktop' },
    { id: 'tablet', icon: Tablet, label: 'Tablet' },
    { id: 'mobile', icon: Smartphone, label: 'Mobile' },
];

function overridesToMap(rows: FeatureOverride[] | undefined): FeatureOverrideMap {
    const map: FeatureOverrideMap = {};
    for (const r of rows || []) {
        map[r.feature_key] = {};
        if (r.enabled !== null && r.enabled !== undefined) map[r.feature_key].enabled = r.enabled;
        if (r.limit_value !== null && r.limit_value !== undefined) map[r.feature_key].limit_value = r.limit_value;
    }
    return map;
}

// Color + label for the domain status badge. active=green, pending=amber,
// disabled=red, none=slate.
const DOMAIN_STATUS_META: Record<DomainStatus, { label: string; className: string }> = {
    none: { label: 'None', className: 'bg-slate-100 text-slate-600' },
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
    active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700' },
    disabled: { label: 'Disabled', className: 'bg-red-100 text-red-700' },
};

export default function TenantEditPage() {
    const { id = '' } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    // Global tenant-branding applier (distinct from the local draft `setBranding`).
    const { setBranding: applyGlobalBranding } = useBranding();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [tenant, setTenant] = useState<TenantDetail | null>(null);
    const [usersCount, setUsersCount] = useState(0);

    // Draft state per tab (nothing is saved until the tab's Save button).
    const [companyName, setCompanyName] = useState('');
    const [customDomain, setCustomDomain] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [status, setStatus] = useState('active');
    const [branding, setBranding] = useState<Branding>(mergeBranding(null));

    // White-label LICENSE plans assignable to this tenant (universal catalog +
    // any custom license plans scoped to this tenant). Used by the Subscription
    // tab's plan picker — distinct from the end-user custom plans below.
    const [licensePlans, setLicensePlans] = useState<TenantPlan[]>([]);
    // The LICENSE plan currently assigned to this tenant (from the detail call).
    const [tenantPlan, setTenantPlan] = useState<TenantPlan | null>(null);
    const [planSlug, setPlanSlug] = useState('starter');
    const [expiresAt, setExpiresAt] = useState('');

    // Custom per-tenant END-USER plans (a plan that exists for THIS tenant only).
    const [customPlans, setCustomPlans] = useState<CustomPlan[]>([]);
    const [showCreatePlan, setShowCreatePlan] = useState(false);
    const [creatingPlan, setCreatingPlan] = useState(false);
    const [newPlanName, setNewPlanName] = useState('');
    const [newPlanPrice, setNewPlanPrice] = useState('');
    const [customPlanOverrides, setCustomPlanOverrides] = useState<FeatureOverrideMap>({});

    const [features, setFeatures] = useState<FeatureCatalogItem[]>([]);
    const [overrides, setOverrides] = useState<FeatureOverrideMap>({});

    const [device, setDevice] = useState<PreviewDevice>('desktop');
    const [fullPreview, setFullPreview] = useState(false);

    // Domain configuration (separate from the Basic tab's stored "custom domain").
    const [domainValue, setDomainValue] = useState('');
    const [domainVerified, setDomainVerified] = useState(false);
    const [sslEnabled, setSslEnabled] = useState(false);
    const [domainStatus, setDomainStatus] = useState<DomainStatus>('none');
    const [domainBusy, setDomainBusy] = useState(false);

    // Tenant users (password recovery).
    const [users, setUsers] = useState<TenantUser[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [resettingUserId, setResettingUserId] = useState<number | null>(null);
    // The most recently reset credentials, shown once in a copyable callout.
    const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);
    // Per-row impersonation spinner (the user currently being logged in as).
    const [impersonatingUserId, setImpersonatingUserId] = useState<number | null>(null);
    // Delete-user confirm (requires the super-admin's password).
    const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
    const [deleteUserTarget, setDeleteUserTarget] = useState<TenantUser | null>(null);
    const [deleteUserPassword, setDeleteUserPassword] = useState('');
    // Per-user usage expander (super-admin view of a tenant user's exhaustion).
    const [usageOpenId, setUsageOpenId] = useState<number | null>(null);
    const [usageLoadingId, setUsageLoadingId] = useState<number | null>(null);
    const [usageById, setUsageById] = useState<Record<number, Record<string, unknown>>>({});

    // Per-tenant Meta / WhatsApp app credentials. Plain fields are prefilled
    // from the API; secrets are write-only so we track only whether each is set
    // (has_*) and a separate "typed" buffer that is sent ONLY when non-empty.
    const [integration, setIntegration] = useState<TenantIntegration | null>(null);
    const [intAppId, setIntAppId] = useState('');
    const [intConfigId, setIntConfigId] = useState('');
    const [intRedirectUrl, setIntRedirectUrl] = useState('');
    const [intWebhookUrl, setIntWebhookUrl] = useState('');
    const [intAppSecret, setIntAppSecret] = useState('');
    const [intVerifyToken, setIntVerifyToken] = useState('');
    // API versions (plain).
    const [intWhatsappApiVersion, setIntWhatsappApiVersion] = useState('');
    const [intFbApiVersion, setIntFbApiVersion] = useState('');
    // Email / SMTP (plain fields + write-only password buffer).
    const [intSmtpHost, setIntSmtpHost] = useState('');
    const [intSmtpPort, setIntSmtpPort] = useState('');
    const [intSmtpUser, setIntSmtpUser] = useState('');
    const [intMailFrom, setIntMailFrom] = useState('');
    const [intSmtpPass, setIntSmtpPass] = useState('');
    // AI keys (write-only secret buffers).
    const [intGeminiApiKey, setIntGeminiApiKey] = useState('');
    const [intGoogleSaJson, setIntGoogleSaJson] = useState('');
    // SMS gateway (plain fields + write-only API-key buffer).
    const [intSmsProvider, setIntSmsProvider] = useState('');
    const [intSmsSenderId, setIntSmsSenderId] = useState('');
    const [intSmsApiKey, setIntSmsApiKey] = useState('');
    // Payment gateway / PayU (plain fields + write-only merchant-salt buffer).
    const [intPayuKey, setIntPayuKey] = useState('');
    const [intPayuMode, setIntPayuMode] = useState('test');
    const [intPayuSaltVersion, setIntPayuSaltVersion] = useState('v1');
    const [intPayuSalt, setIntPayuSalt] = useState('');
    const [savingIntegration, setSavingIntegration] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const [detail, licenseRes, featRes] = await Promise.all([
                    superAdminApi.getTenant(id),
                    superAdminApi.listAssignableLicensePlans(id).catch(() => ({
                        success: false,
                        universal_plans: [] as TenantPlan[],
                        custom_plans: [] as TenantPlan[],
                    })),
                    superAdminApi.listFeatures().catch(() => ({ success: false, features: [] as FeatureCatalogItem[] })),
                ]);
                if (!active) return;
                setTenant(detail.tenant);
                setTenantPlan(detail.tenant_plan ?? null);
                setUsersCount(detail.users_count ?? 0);
                setCompanyName(detail.tenant.company_name || '');
                setCustomDomain(detail.tenant.custom_domain || '');
                setPhoneNumber(detail.tenant.phone_number || '');
                setStatus(detail.tenant.status || 'active');
                setDomainValue(detail.tenant.custom_domain || '');
                setDomainVerified(!!detail.tenant.domain_verified);
                setSslEnabled(!!detail.tenant.ssl_enabled);
                setDomainStatus(detail.tenant.domain_status || 'none');
                setBranding(mergeBranding(detail.tenant.branding));
                setPlanSlug(detail.subscription?.plan_slug || detail.tenant_plan?.slug || detail.tenant.subscription_plan || 'starter');
                setExpiresAt(detail.subscription?.subscription_expires_at?.slice(0, 10) || '');
                setOverrides(overridesToMap(detail.feature_overrides));
                // Merge universal + custom LICENSE plans for the picker.
                setLicensePlans([...(licenseRes.universal_plans || []), ...(licenseRes.custom_plans || [])]);
                setFeatures(featRes.features || []);
            } catch (e: any) {
                toast({ title: 'Failed to load tenant', description: e?.message, variant: 'destructive' });
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [id]);

    // Custom per-tenant plans load on mount and are refetched after create/delete.
    const loadCustomPlans = async () => {
        try {
            const res = await superAdminApi.listTenantPlans(id);
            setCustomPlans(res.custom_plans || []);
        } catch {
            // Non-fatal: the tenant may pre-date the custom-plan feature.
            setCustomPlans([]);
        }
    };

    useEffect(() => {
        if (!id) return;
        loadCustomPlans();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Adapt the assignable white-label LICENSE plans into PlanPicker's shape so
    // the admin can pick which license this tenant is sold.
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

    const submitCustomPlan = async () => {
        const name = newPlanName.trim();
        if (!name) {
            toast({ title: 'Plan name required', variant: 'destructive' });
            return;
        }
        setCreatingPlan(true);
        try {
            const price = newPlanPrice.trim() === '' ? undefined : Number(newPlanPrice);
            await superAdminApi.createCustomPlan(id, {
                name,
                price_monthly_inr: Number.isNaN(price as number) ? undefined : price,
                features: customPlanOverrides,
            });
            await loadCustomPlans();
            setNewPlanName('');
            setNewPlanPrice('');
            setCustomPlanOverrides({});
            setShowCreatePlan(false);
            toast({ title: 'Custom plan created', description: `"${name}" is now assignable to this tenant.` });
        } catch (e: any) {
            toast({ title: 'Create failed', description: e?.message, variant: 'destructive' });
        } finally {
            setCreatingPlan(false);
        }
    };

    const removeCustomPlan = async (plan: CustomPlan) => {
        if (!window.confirm(`Delete custom plan "${plan.name}"? Users currently on it will fall back to the default plan.`)) return;
        try {
            await superAdminApi.deleteCustomPlan(id, plan.id);
            await loadCustomPlans();
            if (planSlug === plan.slug) setPlanSlug('starter');
            toast({ title: 'Custom plan deleted' });
        } catch (e: any) {
            toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' });
        }
    };

    /* ----------------------- Tenant users ----------------------- */

    const loadUsers = async () => {
        setUsersLoading(true);
        try {
            const res = await superAdminApi.listTenantUsers(id);
            setUsers(res.users || []);
        } catch (e: any) {
            toast({ title: 'Failed to load users', description: e?.message, variant: 'destructive' });
            setUsers([]);
        } finally {
            setUsersLoading(false);
        }
    };

    useEffect(() => {
        if (!id) return;
        loadUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    /* ----------------- Per-tenant Meta / WhatsApp integration ----------------- */

    // Pull the integration record and prefill the plain fields. Secrets are
    // never returned, so the password inputs always start blank and the has_*
    // flags drive the "Set / Not set" badges + placeholders.
    const loadIntegration = async () => {
        try {
            const res = await superAdminApi.getIntegration(id);
            const it = res.integration;
            setIntegration(it);
            setIntAppId(it?.meta_app_id || '');
            setIntConfigId(it?.whatsapp_config_id || '');
            setIntRedirectUrl(it?.oauth_redirect_url || '');
            setIntWebhookUrl(it?.webhook_url || '');
            // API versions (plain).
            setIntWhatsappApiVersion(it?.whatsapp_api_version || '');
            setIntFbApiVersion(it?.fb_api_version || '');
            // Email / SMTP (plain).
            setIntSmtpHost(it?.smtp_host || '');
            setIntSmtpPort(it?.smtp_port != null ? String(it.smtp_port) : '');
            setIntSmtpUser(it?.smtp_user || '');
            setIntMailFrom(it?.mail_from || '');
            // SMS gateway (plain).
            setIntSmsProvider(it?.sms_provider || '');
            setIntSmsSenderId(it?.sms_sender_id || '');
            // Payment gateway / PayU (plain).
            setIntPayuKey(it?.payu_key || '');
            setIntPayuMode(it?.payu_mode || 'test');
            setIntPayuSaltVersion(it?.payu_salt_version || 'v1');
            // Always clear the secret buffers — they are write-only.
            setIntAppSecret('');
            setIntVerifyToken('');
            setIntSmtpPass('');
            setIntGeminiApiKey('');
            setIntGoogleSaJson('');
            setIntSmsApiKey('');
            setIntPayuSalt('');
        } catch {
            // Non-fatal: the tenant may not have an integration row yet.
            setIntegration(null);
        }
    };

    useEffect(() => {
        if (!id) return;
        loadIntegration();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const saveIntegration = async () => {
        setSavingIntegration(true);
        try {
            // Plain fields are always sent; secrets only when the admin typed a
            // non-empty value (blank leaves the existing encrypted secret intact).
            const payload: SaveIntegrationPayload = {
                meta_app_id: intAppId.trim(),
                whatsapp_config_id: intConfigId.trim(),
                oauth_redirect_url: intRedirectUrl.trim(),
                webhook_url: intWebhookUrl.trim(),
                // API versions (plain).
                whatsapp_api_version: intWhatsappApiVersion.trim(),
                fb_api_version: intFbApiVersion.trim(),
                // Email / SMTP (plain).
                smtp_host: intSmtpHost.trim(),
                smtp_user: intSmtpUser.trim(),
                mail_from: intMailFrom.trim(),
                // SMS gateway (plain).
                sms_provider: intSmsProvider.trim(),
                sms_sender_id: intSmsSenderId.trim(),
                // Payment gateway / PayU (plain).
                payu_key: intPayuKey.trim(),
                payu_mode: intPayuMode.trim() || 'test',
                payu_salt_version: intPayuSaltVersion.trim() || 'v1',
            };
            // smtp_port is a number; only send it when a valid value was entered.
            const portTrimmed = intSmtpPort.trim();
            if (portTrimmed !== '') {
                const port = Number(portTrimmed);
                if (!Number.isNaN(port)) payload.smtp_port = port;
            }
            if (intAppSecret.trim() !== '') payload.meta_app_secret = intAppSecret.trim();
            if (intVerifyToken.trim() !== '') payload.webhook_verify_token = intVerifyToken.trim();
            // Write-only secrets — only sent when the admin typed a non-empty value.
            if (intSmtpPass.trim() !== '') payload.smtp_pass = intSmtpPass.trim();
            if (intGeminiApiKey.trim() !== '') payload.gemini_api_key = intGeminiApiKey.trim();
            // google_sa_json is a big JSON blob; don't trim its contents, only
            // check that it isn't whitespace-only before sending.
            if (intGoogleSaJson.trim() !== '') payload.google_sa_json = intGoogleSaJson;
            if (intSmsApiKey.trim() !== '') payload.sms_api_key = intSmsApiKey.trim();
            // PayU merchant salt is write-only — only sent when typed.
            if (intPayuSalt.trim() !== '') payload.payu_salt = intPayuSalt.trim();
            await superAdminApi.saveIntegration(id, payload);
            // Reload so the has_* badges reflect any newly-stored secrets, and
            // clear the secret buffers.
            await loadIntegration();
            toast({ title: 'Integration saved', description: 'Meta / WhatsApp app credentials updated for this tenant.' });
        } catch (e: any) {
            toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
        } finally {
            setSavingIntegration(false);
        }
    };

    const copyPassword = async (value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            toast({ title: 'Copied', description: 'Password copied to clipboard.' });
        } catch {
            toast({ title: 'Copy failed', description: 'Select and copy it manually.', variant: 'destructive' });
        }
    };

    const resetUserPassword = async (user: TenantUser) => {
        if (!window.confirm(`Reset the password for ${user.email}? Their current password will stop working immediately.`)) return;
        setResettingUserId(user.id);
        try {
            const res = await superAdminApi.resetTenantUserPassword(id, user.id);
            setResetResult({ email: res.email, password: res.password });
            toast({
                title: 'Password reset',
                description: `New password for ${res.email}: ${res.password} (shown once — copy it now)`,
            });
        } catch (e: any) {
            toast({ title: 'Reset failed', description: e?.message, variant: 'destructive' });
        } finally {
            setResettingUserId(null);
        }
    };

    const saveBasicAndBranding = async () => {
        setSaving(true);
        try {
            await superAdminApi.updateTenant(id, {
                company_name: companyName,
                custom_domain: customDomain || undefined,
                phone_number: phoneNumber.trim() || undefined,
                status,
                branding,
            });
            toast({ title: 'Saved', description: 'Tenant details and branding updated.' });
        } catch (e: any) {
            toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const saveSubscription = async () => {
        setSaving(true);
        try {
            await superAdminApi.updateSubscription(id, {
                plan_slug: planSlug,
                subscription_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
            });
            toast({ title: 'Subscription updated', description: `Plan set to ${planSlug}.` });
        } catch (e: any) {
            toast({ title: 'Update failed', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const saveFeatures = async () => {
        setSaving(true);
        try {
            await superAdminApi.updateFeatures(id, overrides);
            toast({ title: 'Feature overrides saved' });
        } catch (e: any) {
            toast({ title: 'Save failed', description: e?.message, variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    /* ----------------------- Domain configuration ----------------------- */

    const saveDomain = async () => {
        const value = domainValue.trim();
        setDomainBusy(true);
        try {
            const res = await superAdminApi.saveDomain(id, value);
            // Reflect the returned tenant back into local state.
            setDomainValue(res.tenant.custom_domain || '');
            setCustomDomain(res.tenant.custom_domain || '');
            setDomainVerified(!!res.tenant.domain_verified);
            setSslEnabled(!!res.tenant.ssl_enabled);
            setDomainStatus(res.tenant.domain_status || 'none');
            toast({ title: 'Domain saved', description: value ? `Custom domain set to ${value}.` : 'Custom domain cleared.' });
        } catch (e: any) {
            const msg: string = e?.message || '';
            if (/domain_taken/i.test(msg)) {
                toast({
                    title: 'Domain already in use',
                    description: 'This domain is already assigned to another tenant. Choose a different domain.',
                    variant: 'destructive',
                });
            } else {
                toast({ title: 'Save failed', description: msg, variant: 'destructive' });
            }
        } finally {
            setDomainBusy(false);
        }
    };

    const verifyDomain = async () => {
        setDomainBusy(true);
        try {
            const res = await superAdminApi.verifyDomain(id);
            setDomainVerified(!!res.domain_verified);
            setDomainStatus(res.domain_status || 'none');
            toast({
                title: res.domain_verified ? 'Domain verified' : 'Verification pending',
                description: res.resolved_ip
                    ? `Resolved IP: ${res.resolved_ip}`
                    : 'DNS does not yet point to the platform. Try again after it propagates.',
                variant: res.domain_verified ? undefined : 'destructive',
            });
        } catch (e: any) {
            toast({ title: 'Verification failed', description: e?.message, variant: 'destructive' });
        } finally {
            setDomainBusy(false);
        }
    };

    const toggleDomainSsl = async () => {
        const next = !sslEnabled;
        setDomainBusy(true);
        try {
            const res = await superAdminApi.setDomainSsl(id, next);
            setSslEnabled(!!res.ssl_enabled);
            toast({ title: res.ssl_enabled ? 'SSL enabled' : 'SSL disabled' });
        } catch (e: any) {
            toast({ title: 'SSL update failed', description: e?.message, variant: 'destructive' });
        } finally {
            setDomainBusy(false);
        }
    };

    const disableDomain = async () => {
        if (!window.confirm('Disable this custom domain? Users will no longer be able to reach the portal through it.')) return;
        setDomainBusy(true);
        try {
            const res = await superAdminApi.disableDomain(id);
            setDomainStatus(res.domain_status || 'disabled');
            toast({ title: 'Domain disabled' });
        } catch (e: any) {
            toast({ title: 'Disable failed', description: e?.message, variant: 'destructive' });
        } finally {
            setDomainBusy(false);
        }
    };

    const toggleStatus = async () => {
        try {
            if (status === 'active') {
                await superAdminApi.suspendTenant(id);
                setStatus('suspended');
            } else {
                await superAdminApi.activateTenant(id);
                setStatus('active');
            }
        } catch (e: any) {
            toast({ title: 'Action failed', description: e?.message, variant: 'destructive' });
        }
    };

    const remove = async () => {
        if (!window.confirm(`Delete tenant "${tenant?.company_name}"? This removes its accounts and cannot be undone.`)) return;
        try {
            await superAdminApi.deleteTenant(id);
            toast({ title: 'Tenant deleted' });
            navigate('/superadmin/tenants');
        } catch (e: any) {
            toast({ title: 'Delete failed', description: e?.message, variant: 'destructive' });
        }
    };

    const impersonate = async () => {
        try {
            const res = await superAdminApi.impersonate(id);
            // Save the admin session BEFORE the full identity switch below (which
            // clears the admin markers) so "Return to Admin" can restore it. The
            // call above doesn't touch storage, so the admin token is still intact.
            beginImpersonation(`/superadmin/tenants/${id}`);
            // Persist the impersonated user so the dashboard can pick it up, and
            // FULLY switch identity to that user: use the user token as the Bearer
            // and drop the admin markers — otherwise /auth/me keeps resolving the
            // admin and post-payment/redirects land on the admin dashboard.
            try {
                localStorage.setItem('sv_user', JSON.stringify(res.user));
                sessionStorage.setItem('sv_user', JSON.stringify(res.user));
                localStorage.setItem('sv_user_id', String(res.user?.id));
                if ((res as any).token) {
                    localStorage.setItem('sv_token', (res as any).token);
                    sessionStorage.setItem('sv_token', (res as any).token);
                }
                localStorage.removeItem('sv_admin_id');
                sessionStorage.removeItem('sv_admin_id');
            } catch { /* ignore */ }
            // Apply the impersonated tenant's branding immediately so the app
            // shows its colors / font / logo (not the previous/old branding).
            const t = (res as any)?.tenant;
            if (t?.branding) applyGlobalBranding(t.branding, t.tenant_code);
            const dest = res.user?.role === 'tenant_admin' ? '/tenant-admin' : '/dashboard';
            navigate(dest);
        } catch (e: any) {
            toast({ title: 'Impersonation failed', description: e?.message, variant: 'destructive' });
        }
    };

    // Permanently delete a tenant user — requires the super-admin's own password.
    const confirmDeleteUser = async () => {
        if (!deleteUserTarget) return;
        if (!deleteUserPassword.trim()) {
            toast({ title: 'Enter your admin password to confirm', variant: 'destructive' });
            return;
        }
        const u = deleteUserTarget;
        setDeletingUserId(u.id);
        try {
            await superAdminApi.deleteTenantUser(id, u.id, deleteUserPassword);
            toast({ title: 'User deleted', description: u.email });
            setUsers((prev) => prev.filter((x) => x.id !== u.id));
            setDeleteUserTarget(null);
            setDeleteUserPassword('');
        } catch (e: any) {
            toast({ title: 'Could not delete user', description: e?.message || 'Delete failed', variant: 'destructive' });
        } finally {
            setDeletingUserId(null);
        }
    };

    // "Login as" a SPECIFIC tenant user. Mirrors the top-of-page impersonate
    // handler but targets one user_id and shows a per-row spinner.
    const impersonateUser = async (user: TenantUser) => {
        setImpersonatingUserId(user.id);
        try {
            const res = await superAdminApi.impersonate(id, user.id);
            // Save the admin session BEFORE the identity switch (see impersonate()).
            beginImpersonation(`/superadmin/tenants/${id}`);
            // Persist the impersonated user and FULLY switch identity to them
            // (user token as Bearer, drop admin markers) — see impersonate() above.
            try {
                localStorage.setItem('sv_user', JSON.stringify(res.user));
                sessionStorage.setItem('sv_user', JSON.stringify(res.user));
                localStorage.setItem('sv_user_id', String(res.user?.id));
                if ((res as any).token) {
                    localStorage.setItem('sv_token', (res as any).token);
                    sessionStorage.setItem('sv_token', (res as any).token);
                }
                localStorage.removeItem('sv_admin_id');
                sessionStorage.removeItem('sv_admin_id');
                const tenantCode = (res as any)?.tenant?.tenant_code;
                if (tenantCode) localStorage.setItem('sv_tenant_code', String(tenantCode));
            } catch { /* ignore */ }
            // Apply the impersonated tenant's branding immediately.
            const t = (res as any)?.tenant;
            if (t?.branding) applyGlobalBranding(t.branding, t.tenant_code);
            const dest = res.user?.role === 'tenant_admin' ? '/tenant-admin' : '/dashboard';
            navigate(dest);
        } catch (e: any) {
            toast({ title: 'Login as user failed', description: e?.message, variant: 'destructive' });
        } finally {
            setImpersonatingUserId(null);
        }
    };

    // Toggle a per-user usage expander; fetch (and cache) the user's usage the
    // first time it's opened.
    const toggleUsage = async (user: TenantUser) => {
        if (usageOpenId === user.id) {
            setUsageOpenId(null);
            return;
        }
        setUsageOpenId(user.id);
        if (usageById[user.id]) return;
        setUsageLoadingId(user.id);
        try {
            const res = await superAdminApi.getTenantUserUsage(id, user.id);
            setUsageById((prev) => ({ ...prev, [user.id]: res.usage }));
        } catch (e: any) {
            toast({ title: 'Could not load usage', description: e?.message, variant: 'destructive' });
            setUsageOpenId((cur) => (cur === user.id ? null : cur));
        } finally {
            setUsageLoadingId(null);
        }
    };

    // At-a-glance LICENSE summary for the header (which white-label license + when
    // it lapses). Prefer the picker selection, then the detail's assigned license.
    const currentPlanName =
        planOptions.find((p) => p.slug === planSlug)?.name
        || (tenantPlan?.slug === planSlug ? tenantPlan?.name : undefined)
        || tenantPlan?.name
        || planSlug;
    const expiry = getExpiryStatus(expiresAt || null);

    if (loading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (!tenant) {
        return (
            <div className="w-full min-w-0">
                <Button variant="ghost" size="sm" onClick={() => navigate('/superadmin/tenants')}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <p className="mt-4 text-sm text-muted-foreground">Tenant not found.</p>
            </div>
        );
    }

    return (
        <div className="w-full min-w-0 space-y-6">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate('/superadmin/tenants')}>
                        <ArrowLeft className="h-4 w-4 mr-1" /> All tenants
                    </Button>
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-xl font-semibold break-words">{tenant.company_name}</h1>
                        <Badge variant="outline" className="font-mono">{tenant.tenant_code}</Badge>
                        <Badge className={cn(status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                            {status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{usersCount} user(s)</span>
                    </div>
                    {/* Subscription at a glance: which plan + when it expires. */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Subscription
                        </span>
                        <Badge variant="outline" className="capitalize">{currentPlanName}</Badge>
                        <Badge className={cn('font-normal', EXPIRY_TONE_CLASS[expiry.tone])}>
                            {expiry.label}
                        </Badge>
                        {expiry.expiresOn && (
                            <span className="text-xs text-muted-foreground">on {expiry.expiresOn}</span>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={impersonate}>
                        <LogIn className="h-4 w-4 mr-1" /> Impersonate
                    </Button>
                    <Button variant="outline" size="sm" onClick={toggleStatus}>
                        {status === 'active'
                            ? (<><Pause className="h-4 w-4 mr-1" /> Suspend</>)
                            : (<><Play className="h-4 w-4 mr-1" /> Activate</>)}
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700" onClick={remove}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="branding" className="min-w-0">
                <div className="overflow-x-auto">
                    <TabsList>
                        <TabsTrigger value="basic">Basic</TabsTrigger>
                        <TabsTrigger value="branding">Branding</TabsTrigger>
                        <TabsTrigger value="domain">Domain</TabsTrigger>
                        <TabsTrigger value="subscription">Subscription</TabsTrigger>
                        <TabsTrigger value="features">Features</TabsTrigger>
                        <TabsTrigger value="integration">Integration</TabsTrigger>
                        <TabsTrigger value="users">Users</TabsTrigger>
                    </TabsList>
                </div>

                {/* Basic */}
                <TabsContent value="basic" className="mt-4">
                    <Card><CardContent className="p-6 space-y-4 max-w-xl">
                        <div className="space-y-1.5">
                            <Label>Company name</Label>
                            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Custom domain</Label>
                            <Input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="abc.company.com" />
                            <p className="text-xs text-muted-foreground">Stored only — Tenant Code remains the login identifier.</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Phone number</Label>
                            <Input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+91 98765 43210" />
                        </div>
                        <Button onClick={saveBasicAndBranding} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                            Save changes
                        </Button>
                    </CardContent></Card>
                </TabsContent>

                {/* Branding + live preview */}
                <TabsContent value="branding" className="mt-4">
                    <div className="grid gap-6 min-w-0 lg:grid-cols-2">
                        <Card className="min-w-0"><CardContent className="p-6">
                            <BrandingForm branding={branding} onChange={setBranding} />
                            <div className="mt-6">
                                <Button onClick={saveBasicAndBranding} disabled={saving}>
                                    {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                                    Save changes
                                </Button>
                            </div>
                        </CardContent></Card>

                        <div className="space-y-3 min-w-0">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                                    {DEVICES.map((d) => (
                                        <button key={d.id} type="button" title={d.label} onClick={() => setDevice(d.id)}
                                            className={cn('flex h-8 w-8 items-center justify-center rounded-md',
                                                device === d.id ? 'bg-white shadow text-slate-900' : 'text-slate-500')}>
                                            <d.icon className="h-4 w-4" />
                                        </button>
                                    ))}
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setFullPreview(true)}>
                                    <Maximize2 className="h-4 w-4 mr-1" /> Open Full Preview
                                </Button>
                            </div>
                            <Card className="min-w-0 overflow-hidden"><CardContent className="p-3 min-w-0">
                                <BrandingPreview branding={branding} device={device} />
                            </CardContent></Card>
                            <p className="text-xs text-muted-foreground">Live preview of draft branding — nothing is saved until you press Save.</p>
                        </div>
                    </div>
                </TabsContent>

                {/* Domain */}
                <TabsContent value="domain" className="mt-4">
                    <Card className="min-w-0"><CardContent className="p-6 space-y-6 min-w-0">
                        <div className="flex items-center gap-2">
                            <Globe className="h-5 w-5 text-emerald-600" />
                            <h2 className="text-base font-semibold">Domain Configuration</h2>
                        </div>

                        {/* Custom domain + save */}
                        <div className="space-y-1.5 max-w-xl">
                            <Label>Custom Domain</Label>
                            <div className="flex flex-wrap items-center gap-2">
                                <Input
                                    className="min-w-0 flex-1"
                                    value={domainValue}
                                    onChange={(e) => setDomainValue(e.target.value)}
                                    placeholder="portal.abccompany.com"
                                />
                                <Button onClick={saveDomain} disabled={domainBusy}>
                                    {domainBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                                    Save Domain
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Point the domain&apos;s DNS to the platform, then click Verify. The internal SocioChat tenant uses sociochat.ai.
                            </p>
                        </div>

                        {/* Status row */}
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification</span>
                                <Badge className={cn(domainVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                                    {domainVerified ? 'Verified' : 'Not verified'}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">SSL</span>
                                <Badge className={cn(sslEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
                                    {sslEnabled ? 'Enabled' : 'Disabled'}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Domain Status</span>
                                <Badge className={cn(DOMAIN_STATUS_META[domainStatus].className)}>
                                    {DOMAIN_STATUS_META[domainStatus].label}
                                </Badge>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="outline" onClick={verifyDomain} disabled={domainBusy}>
                                {domainBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                                Verify Domain
                            </Button>
                            <Button variant="outline" onClick={toggleDomainSsl} disabled={domainBusy}>
                                {sslEnabled
                                    ? (<><ShieldOff className="h-4 w-4 mr-1" /> Disable SSL</>)
                                    : (<><ShieldCheck className="h-4 w-4 mr-1" /> Enable SSL</>)}
                            </Button>
                            <Button
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                                onClick={disableDomain}
                                disabled={domainBusy}
                            >
                                <Ban className="h-4 w-4 mr-1" /> Disable Domain
                            </Button>
                        </div>
                    </CardContent></Card>
                </TabsContent>

                {/* Subscription */}
                <TabsContent value="subscription" className="mt-4 space-y-6">
                    <Card><CardContent className="p-6 space-y-4 max-w-xl">
                        <div>
                            <h2 className="text-sm font-semibold">White-label license plan</h2>
                            <p className="text-xs text-muted-foreground">
                                The white-label license currently sold to this tenant. Choose from the universal
                                license catalog plus any custom licenses scoped to this tenant.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>License plan</Label>
                            <PlanPicker plans={planOptions} value={planSlug} onChange={setPlanSlug} />
                            <p className="text-xs text-muted-foreground">
                                Sets this tenant owner&apos;s license limits (max end-users / workspaces). Manage the
                                catalog under Tenant Plans.
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Expires at (optional)</Label>
                            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <Badge className={cn('font-normal', EXPIRY_TONE_CLASS[expiry.tone])}>
                                    {expiry.label}
                                </Badge>
                                {expiry.expiresOn && (
                                    <span className="text-xs text-muted-foreground">on {expiry.expiresOn}</span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                    Leave blank for a subscription that never expires.
                                </span>
                            </div>
                        </div>
                        <Button onClick={saveSubscription} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                            Update subscription
                        </Button>
                    </CardContent></Card>

                    {/* Custom plans for this tenant only */}
                    <Card><CardContent className="p-6 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                                <h2 className="text-sm font-semibold">End-user plans &mdash; this tenant&apos;s own catalog</h2>
                                <p className="text-xs text-muted-foreground">
                                    The subscription plans this tenant&apos;s OWN users choose from (NOT the white-label
                                    license above). Create one or more end-user plans visible only to this tenant.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowCreatePlan((v) => !v)}
                            >
                                {showCreatePlan
                                    ? (<><ChevronUp className="h-4 w-4 mr-1" /> Close</>)
                                    : (<><Plus className="h-4 w-4 mr-1" /> Create custom plan for this tenant</>)}
                            </Button>
                        </div>

                        {/* Existing custom plans */}
                        {customPlans.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No custom plans yet. Use &ldquo;Create custom plan for this tenant&rdquo; to add one.
                            </p>
                        ) : (
                            <div className="rounded-lg border divide-y">
                                {customPlans.map((cp) => (
                                    <div key={cp.id} className="flex flex-wrap items-center gap-3 p-3">
                                        <div className="flex-1 min-w-[180px]">
                                            <p className="text-sm font-medium">{cp.name}</p>
                                            <p className="text-xs text-muted-foreground font-mono">{cp.slug}</p>
                                        </div>
                                        <Badge variant="outline">₹{cp.price_monthly_inr ?? 0}/mo</Badge>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700"
                                            onClick={() => removeCustomPlan(cp)}
                                        >
                                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Create custom plan form */}
                        {showCreatePlan && (
                            <div className="rounded-lg border p-4 space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <Label>Plan name</Label>
                                        <Input
                                            value={newPlanName}
                                            onChange={(e) => setNewPlanName(e.target.value)}
                                            placeholder="e.g. Acme Pro"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Price (INR / month)</Label>
                                        <Input
                                            type="number"
                                            value={newPlanPrice}
                                            onChange={(e) => setNewPlanPrice(e.target.value)}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        Features &amp; limits
                                    </Label>
                                    <FeaturesEditor
                                        features={features}
                                        overrides={customPlanOverrides}
                                        onChange={setCustomPlanOverrides}
                                    />
                                </div>
                                <Button onClick={submitCustomPlan} disabled={creatingPlan}>
                                    {creatingPlan ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                                    Create custom plan
                                </Button>
                            </div>
                        )}
                    </CardContent></Card>
                </TabsContent>

                {/* Features */}
                <TabsContent value="features" className="mt-4">
                    <Card><CardContent className="p-6">
                        <p className="mb-4 text-sm text-muted-foreground">
                            Super-admin feature overrides for this tenant. Hierarchy: tenant override → plan → default.
                        </p>
                        <FeaturesEditor features={features} overrides={overrides} onChange={setOverrides} />
                        <div className="mt-6">
                            <Button onClick={saveFeatures} disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                                Save overrides
                            </Button>
                        </div>
                    </CardContent></Card>
                </TabsContent>

                {/* Integration — this tenant's own Meta / WhatsApp app */}
                <TabsContent value="integration" className="mt-4">
                    <Card className="min-w-0"><CardContent className="p-6 space-y-6 min-w-0">
                        <div className="flex items-center gap-2">
                            <Plug className="h-5 w-5 text-emerald-600" />
                            <h2 className="text-base font-semibold">Meta / WhatsApp app (this tenant&apos;s own)</h2>
                        </div>

                        <p className="text-xs text-muted-foreground max-w-2xl">
                            Leave SocioChat&apos;s default by leaving blank — these override the platform&apos;s Meta app
                            for THIS tenant only. Secrets are stored encrypted and never shown again.
                        </p>

                        {/* Plain (prefilled) fields */}
                        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                            <div className="space-y-1.5">
                                <Label>App ID</Label>
                                <Input
                                    value={intAppId}
                                    onChange={(e) => setIntAppId(e.target.value)}
                                    placeholder="e.g. 1234567890123456"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Embedded-Signup config_id</Label>
                                <Input
                                    value={intConfigId}
                                    onChange={(e) => setIntConfigId(e.target.value)}
                                    placeholder="e.g. 987654321098765"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>OAuth Redirect URL</Label>
                                <Input
                                    value={intRedirectUrl}
                                    onChange={(e) => setIntRedirectUrl(e.target.value)}
                                    placeholder="https://portal.example.com/oauth/callback"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Webhook URL</Label>
                                <Input
                                    value={intWebhookUrl}
                                    onChange={(e) => setIntWebhookUrl(e.target.value)}
                                    placeholder="https://api.example.com/webhooks/meta"
                                />
                            </div>
                        </div>

                        {/* Write-only secrets */}
                        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <Label>App Secret</Label>
                                    <Badge className={cn(
                                        integration?.has_app_secret
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-slate-100 text-slate-600',
                                    )}>
                                        {integration?.has_app_secret ? 'Set' : 'Not set'}
                                    </Badge>
                                </div>
                                <Input
                                    type="password"
                                    value={intAppSecret}
                                    onChange={(e) => setIntAppSecret(e.target.value)}
                                    placeholder={integration?.has_app_secret ? '•••• set' : 'not set'}
                                    autoComplete="new-password"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <Label>Webhook Verify Token</Label>
                                    <Badge className={cn(
                                        integration?.has_verify_token
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : 'bg-slate-100 text-slate-600',
                                    )}>
                                        {integration?.has_verify_token ? 'Set' : 'Not set'}
                                    </Badge>
                                </div>
                                <Input
                                    type="password"
                                    value={intVerifyToken}
                                    onChange={(e) => setIntVerifyToken(e.target.value)}
                                    placeholder={integration?.has_verify_token ? '•••• set' : 'not set'}
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Secrets are write-only — leave a secret field blank to keep the current value.
                        </p>

                        {/* ---- WhatsApp / Facebook API versions ---- */}
                        <div className="space-y-3 border-t pt-6">
                            <h3 className="text-sm font-semibold">API versions</h3>
                            <p className="text-xs text-muted-foreground max-w-2xl">
                                Graph API versions used for this tenant&apos;s WhatsApp / Facebook calls. Leave blank to use the platform default.
                            </p>
                            <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                                <div className="space-y-1.5">
                                    <Label>WhatsApp API version</Label>
                                    <Input
                                        value={intWhatsappApiVersion}
                                        onChange={(e) => setIntWhatsappApiVersion(e.target.value)}
                                        placeholder="v22.0"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Facebook API version</Label>
                                    <Input
                                        value={intFbApiVersion}
                                        onChange={(e) => setIntFbApiVersion(e.target.value)}
                                        placeholder="v22.0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ---- Email / SMTP ---- */}
                        <div className="space-y-3 border-t pt-6">
                            <h3 className="text-sm font-semibold">Email / SMTP</h3>
                            <p className="text-xs text-muted-foreground max-w-2xl">
                                Send transactional mail from this tenant&apos;s own domain. Leave blank to use the platform mailer.
                            </p>
                            <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                                <div className="space-y-1.5">
                                    <Label>SMTP host</Label>
                                    <Input
                                        value={intSmtpHost}
                                        onChange={(e) => setIntSmtpHost(e.target.value)}
                                        placeholder="smtp.example.com"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>SMTP port</Label>
                                    <Input
                                        type="number"
                                        value={intSmtpPort}
                                        onChange={(e) => setIntSmtpPort(e.target.value)}
                                        placeholder="587"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>SMTP username</Label>
                                    <Input
                                        value={intSmtpUser}
                                        onChange={(e) => setIntSmtpUser(e.target.value)}
                                        placeholder="apikey or user@example.com"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>From address (mail_from)</Label>
                                    <Input
                                        value={intMailFrom}
                                        onChange={(e) => setIntMailFrom(e.target.value)}
                                        placeholder="no-reply@example.com"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <Label>SMTP password</Label>
                                        <Badge className={cn(
                                            integration?.has_smtp_pass
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-600',
                                        )}>
                                            {integration?.has_smtp_pass ? 'Set' : 'Not set'}
                                        </Badge>
                                    </div>
                                    <Input
                                        type="password"
                                        value={intSmtpPass}
                                        onChange={(e) => setIntSmtpPass(e.target.value)}
                                        placeholder={integration?.has_smtp_pass ? '•••• set' : 'not set'}
                                        autoComplete="new-password"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ---- AI keys ---- */}
                        <div className="space-y-3 border-t pt-6">
                            <h3 className="text-sm font-semibold">AI keys</h3>
                            <p className="text-xs text-muted-foreground max-w-2xl">
                                Per-tenant AI credentials. Stored encrypted and never shown again — leave blank to keep the current value.
                            </p>
                            <div className="space-y-4 max-w-2xl">
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <Label>Gemini API key</Label>
                                        <Badge className={cn(
                                            integration?.has_gemini_api_key
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-600',
                                        )}>
                                            {integration?.has_gemini_api_key ? 'Set' : 'Not set'}
                                        </Badge>
                                    </div>
                                    <Input
                                        type="password"
                                        value={intGeminiApiKey}
                                        onChange={(e) => setIntGeminiApiKey(e.target.value)}
                                        placeholder={integration?.has_gemini_api_key ? '•••• set' : 'not set'}
                                        autoComplete="new-password"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <Label>Google service-account JSON</Label>
                                        <Badge className={cn(
                                            integration?.has_google_sa_json
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-600',
                                        )}>
                                            {integration?.has_google_sa_json ? 'Set' : 'Not set'}
                                        </Badge>
                                    </div>
                                    <textarea
                                        className={cn(
                                            'flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm font-mono',
                                        )}
                                        value={intGoogleSaJson}
                                        onChange={(e) => setIntGoogleSaJson(e.target.value)}
                                        placeholder={integration?.has_google_sa_json
                                            ? '•••• set — paste new JSON to replace'
                                            : 'Paste the full service-account JSON here'}
                                        autoComplete="off"
                                        spellCheck={false}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ---- SMS gateway (password-reset OTP) ---- */}
                        <div className="space-y-3 border-t pt-6">
                            <h3 className="text-sm font-semibold">SMS gateway (password-reset OTP)</h3>
                            <p className="text-xs text-muted-foreground max-w-2xl">
                                Send signup &amp; password-reset one-time passwords from this tenant&apos;s own SMS provider. This is <strong>required</strong> for each tenant — if left blank, signup and SMS password-reset for this tenant&apos;s users will fail with an error (there is no platform fallback). Supported providers: <code>msg91</code>, <code>twilio</code>.
                            </p>
                            <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                                <div className="space-y-1.5">
                                    <Label>SMS provider</Label>
                                    <Input
                                        value={intSmsProvider}
                                        onChange={(e) => setIntSmsProvider(e.target.value)}
                                        placeholder="msg91"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Sender ID</Label>
                                    <Input
                                        value={intSmsSenderId}
                                        onChange={(e) => setIntSmsSenderId(e.target.value)}
                                        placeholder="Sender ID / from number"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        For Twilio use &ldquo;AccountSID|FromNumber&rdquo;.
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <Label>SMS API key</Label>
                                        <Badge className={cn(
                                            integration?.has_sms_api_key
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-600',
                                        )}>
                                            {integration?.has_sms_api_key ? 'Set' : 'Not set'}
                                        </Badge>
                                    </div>
                                    <Input
                                        type="password"
                                        value={intSmsApiKey}
                                        onChange={(e) => setIntSmsApiKey(e.target.value)}
                                        placeholder={integration?.has_sms_api_key ? '•••• set' : 'not set'}
                                        autoComplete="new-password"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Write-only — leave blank to keep the current value.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ---- Payment gateway (PayU) ---- */}
                        <div className="space-y-3 border-t pt-6">
                            <h3 className="text-sm font-semibold">Payment Gateway (PayU)</h3>
                            <p className="text-xs text-muted-foreground max-w-2xl">
                                This tenant&apos;s own PayU account — used for THEIR end-users&apos; plan payments. Leave blank to disable payments for this tenant.
                            </p>
                            <div className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                                <div className="space-y-1.5">
                                    <Label>Merchant Key</Label>
                                    <Input
                                        value={intPayuKey}
                                        onChange={(e) => setIntPayuKey(e.target.value)}
                                        placeholder="e.g. gtKFFx"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Mode</Label>
                                    <select
                                        className={cn(
                                            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                                        )}
                                        value={intPayuMode}
                                        onChange={(e) => setIntPayuMode(e.target.value)}
                                    >
                                        <option value="test">test</option>
                                        <option value="production">production</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Salt Version</Label>
                                    <Input
                                        value={intPayuSaltVersion}
                                        onChange={(e) => setIntPayuSaltVersion(e.target.value)}
                                        placeholder="v1"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <Label>Merchant Salt</Label>
                                        <Badge className={cn(
                                            integration?.has_payu_salt
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-600',
                                        )}>
                                            {integration?.has_payu_salt ? 'Set' : 'Not set'}
                                        </Badge>
                                    </div>
                                    <Input
                                        type="password"
                                        value={intPayuSalt}
                                        onChange={(e) => setIntPayuSalt(e.target.value)}
                                        placeholder={integration?.has_payu_salt ? '•••• set' : 'not set'}
                                        autoComplete="new-password"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Write-only — leave blank to keep the current value.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Button onClick={saveIntegration} disabled={savingIntegration}>
                            {savingIntegration ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                            Save
                        </Button>
                    </CardContent></Card>
                </TabsContent>

                {/* Users */}
                <TabsContent value="users" className="mt-4 space-y-4">
                    <Card className="min-w-0"><CardContent className="p-6 space-y-4 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-emerald-600" />
                                <div>
                                    <h2 className="text-base font-semibold">Tenant Users</h2>
                                    <p className="text-xs text-muted-foreground">
                                        Log in as any user to troubleshoot in their session, or reset a user&apos;s password to recover access. New passwords are shown once.
                                    </p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={loadUsers} disabled={usersLoading}>
                                {usersLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                                Refresh
                            </Button>
                        </div>

                        {/* Show-once new password callout (persists so it can be copied). */}
                        {resetResult && (
                            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <KeyRound className="h-4 w-4 text-amber-700" />
                                    <p className="text-sm font-semibold text-amber-800">
                                        New password for {resetResult.email}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <code className="rounded bg-white px-2 py-1 font-mono text-sm text-amber-900 break-all border border-amber-200">
                                        {resetResult.password}
                                    </code>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => copyPassword(resetResult.password)}
                                    >
                                        <Copy className="h-4 w-4 mr-1" /> Copy
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setResetResult(null)}
                                    >
                                        Dismiss
                                    </Button>
                                </div>
                                <p className="text-xs text-amber-700">
                                    Shown once — copy it now. It cannot be retrieved again.
                                </p>
                            </div>
                        )}

                        {usersLoading && users.length === 0 ? (
                            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
                            </div>
                        ) : users.length === 0 ? (
                            <p className="py-6 text-sm text-muted-foreground">No users found for this tenant.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[640px] text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            <th className="py-2 pr-4">Name</th>
                                            <th className="py-2 pr-4">Email</th>
                                            <th className="py-2 pr-4">Role</th>
                                            <th className="py-2 pr-4">Status</th>
                                            <th className="py-2 pr-0 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((u) => (
                                            <Fragment key={u.id}>
                                            <tr className="border-b last:border-0">
                                                <td className="py-2 pr-4 font-medium">{u.name || '—'}</td>
                                                <td className="py-2 pr-4 break-all">{u.email}</td>
                                                <td className="py-2 pr-4">
                                                    <Badge variant="outline">{u.role || 'user'}</Badge>
                                                </td>
                                                <td className="py-2 pr-4">
                                                    <Badge className={cn(
                                                        u.status === 'active'
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-slate-100 text-slate-600',
                                                    )}>
                                                        {u.status || 'unknown'}
                                                    </Badge>
                                                </td>
                                                <td className="py-2 pr-0 text-right">
                                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => toggleUsage(u)}
                                                            disabled={usageLoadingId === u.id}
                                                            title="View this user's usage"
                                                        >
                                                            {usageLoadingId === u.id
                                                                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                                : <Gauge className="h-4 w-4 mr-1" />}
                                                            Usage
                                                            <ChevronDown className={cn('h-3 w-3 ml-1 transition-transform', usageOpenId === u.id && 'rotate-180')} />
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => impersonateUser(u)}
                                                            disabled={impersonatingUserId === u.id}
                                                            title="Log in as this user (impersonate)"
                                                        >
                                                            {impersonatingUserId === u.id
                                                                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                                : <LogIn className="h-4 w-4 mr-1" />}
                                                            Login as
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => resetUserPassword(u)}
                                                            disabled={resettingUserId === u.id}
                                                        >
                                                            {resettingUserId === u.id
                                                                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                                : <KeyRound className="h-4 w-4 mr-1" />}
                                                            Reset Password
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-destructive hover:bg-destructive/10"
                                                            onClick={() => { setDeleteUserTarget(u); setDeleteUserPassword(''); }}
                                                            disabled={deletingUserId === u.id}
                                                            title="Delete this user"
                                                        >
                                                            {deletingUserId === u.id
                                                                ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                                : <Trash2 className="h-4 w-4 mr-1" />}
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {usageOpenId === u.id && (
                                                <tr>
                                                    <td colSpan={5} className="bg-slate-50 px-4 py-3">
                                                        {usageById[u.id] ? (
                                                            <UsagePanel dense rows={usageRowsFrom(usageById[u.id])} />
                                                        ) : (
                                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                                <Loader2 className="h-4 w-4 animate-spin" /> Loading usage…
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )}
                                            </Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent></Card>
                </TabsContent>
            </Tabs>
          </div>

            {/* Delete tenant user — requires the super-admin's password */}
            <Dialog
                open={!!deleteUserTarget}
                onOpenChange={(o) => {
                    if (!o) {
                        setDeleteUserTarget(null);
                        setDeleteUserPassword('');
                    }
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-destructive">Delete user?</DialogTitle>
                        <DialogDescription className="break-all">
                            This permanently removes <strong>{deleteUserTarget?.name || deleteUserTarget?.email}</strong> and
                            their workspaces. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="sa-delete-password">Enter your admin password to confirm</Label>
                        <Input
                            id="sa-delete-password"
                            type="password"
                            autoComplete="current-password"
                            value={deleteUserPassword}
                            onChange={(e) => setDeleteUserPassword(e.target.value)}
                            placeholder="Your admin portal password"
                            onKeyDown={(e) => { if (e.key === 'Enter' && deleteUserPassword.trim()) confirmDeleteUser(); }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setDeleteUserTarget(null); setDeleteUserPassword(''); }}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={!deleteUserPassword.trim() || deletingUserId === deleteUserTarget?.id}
                            onClick={confirmDeleteUser}
                        >
                            {deletingUserId === deleteUserTarget?.id ? 'Deleting…' : 'Delete user'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <FullPreviewModal open={fullPreview} onClose={() => setFullPreview(false)} branding={branding} />
        </div>
    );
}
