// src/pages/tenant-admin/TenantAdminOverview.tsx
// Tenant Admin landing page: high-level cards for the current tenant —
// company, tenant code, status, plan, and total user count from /overview.
import { useEffect, useState } from 'react';
import {
    Building2,
    Hash,
    BadgeCheck,
    CreditCard,
    Users,
    RefreshCw,
    Globe,
    ShieldCheck,
    Copy,
    Check,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import {
    tenantAdminApi,
    type OverviewResponse,
    type DomainInfoResponse,
    type DnsRecord,
    type TenantPlan,
} from './tenantAdminApi';

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'default';
    if (s === 'suspended') return 'destructive';
    return 'secondary';
}

function formatDate(d?: string | null): string {
    if (!d) return '—';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return d;
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

interface StatCardProps {
    label: string;
    value: React.ReactNode;
    icon: React.ElementType;
    hint?: string;
}

function StatCard({ label, value, icon: Icon, hint }: StatCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
                <Icon className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-slate-900 break-words">{value}</div>
                {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
            </CardContent>
        </Card>
    );
}

/** A copyable monospace DNS record row (Type / Host / Target). */
function DnsRow({ type, record }: { type: string; record: DnsRecord }) {
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        const text = `${record.host} ${record.target}`;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            toast({
                title: 'Copy failed',
                description: 'Copy the record values manually.',
                variant: 'destructive',
            });
        }
    };

    return (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-slate-50 px-3 py-2">
            <div className="min-w-0 font-mono text-xs text-slate-700">
                <span className="mr-2 inline-block rounded bg-slate-200 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    {type}
                </span>
                <span className="text-slate-500">Host:</span>{' '}
                <span className="break-all text-slate-900">{record.host}</span>
                <span className="mx-2 text-slate-300">|</span>
                <span className="text-slate-500">Target:</span>{' '}
                <span className="break-all text-slate-900">{record.target}</span>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={copy}
                aria-label={`Copy ${type} record`}
            >
                {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-500" />
                )}
            </Button>
        </div>
    );
}

/** The Custom Domain + DNS Instructions card. */
function DomainCard({
    info,
    loading,
}: {
    info: DomainInfoResponse | null;
    loading: boolean;
}) {
    const customDomain = info?.custom_domain || null;
    const status = info?.domain_status || (customDomain ? 'pending' : 'none');
    const verified = Boolean(info?.domain_verified);
    const ssl = Boolean(info?.ssl_enabled);

    const cname = info?.dns_instructions?.cname || null;
    const aRecord = info?.dns_instructions?.a_record || null;
    const hasInstructions = Boolean(cname || aRecord);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-900">
                    <Globe className="h-5 w-5 text-emerald-600" /> Custom Domain
                </CardTitle>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <Badge variant={statusVariant(status)} className="capitalize">
                        {status}
                    </Badge>
                    <Badge variant={verified ? 'default' : 'secondary'} className="gap-1">
                        <BadgeCheck className="h-3 w-3" />
                        {verified ? 'Verified' : 'Unverified'}
                    </Badge>
                    <Badge variant={ssl ? 'default' : 'outline'} className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {ssl ? 'SSL on' : 'No SSL'}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                        Domain
                    </p>
                    {loading ? (
                        <p className="mt-1 text-sm text-muted-foreground">Loading…</p>
                    ) : (
                        <p className="mt-1 font-mono text-lg font-semibold text-slate-900 break-all">
                            {customDomain || (
                                <span className="font-sans text-base font-normal text-muted-foreground">
                                    Not configured
                                </span>
                            )}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">DNS Instructions</p>
                    <p className="text-xs text-muted-foreground">
                        Create ONE of these records at your DNS provider, then ask your
                        administrator to verify.
                    </p>
                    {hasInstructions ? (
                        <div className="space-y-2">
                            {cname && <DnsRow type="CNAME" record={cname} />}
                            {aRecord && <DnsRow type="A" record={aRecord} />}
                        </div>
                    ) : (
                        <DnsRow
                            type="CNAME"
                            record={{ host: 'www', target: 'app.sociochat.ai' }}
                        />
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default function TenantAdminOverview() {
    const { toast } = useToast();
    const [data, setData] = useState<OverviewResponse | null>(null);
    const [domainInfo, setDomainInfo] = useState<DomainInfoResponse | null>(null);
    const [domainLoading, setDomainLoading] = useState(true);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        setLoading(true);
        setDomainLoading(true);
        try {
            const res = await tenantAdminApi.overview();
            setData(res);
        } catch (err) {
            toast({
                title: 'Error',
                description: err instanceof Error ? err.message : 'Failed to load overview',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }

        // Domain info is non-critical: a failure (or no domain) must not break
        // the page — fall back to showing the platform-target instructions.
        try {
            const dom = await tenantAdminApi.getDomainInfo();
            setDomainInfo(dom);
        } catch {
            setDomainInfo(null);
        } finally {
            setDomainLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const tenant = data?.tenant;
    const tenantPlan: TenantPlan | null | undefined = data?.tenant_plan;
    // Prefer the white-label license NAME; fall back to the subscription slug.
    const license =
        tenantPlan?.name || data?.subscription?.plan_slug || tenant?.subscription_plan || '—';
    // Renews hint takes priority; otherwise show the license price if available.
    const licenseHint = data?.subscription?.subscription_expires_at
        ? `Renews ${formatDate(data.subscription.subscription_expires_at)}`
        : tenantPlan?.price_inr != null
          ? `₹${tenantPlan.price_inr}/mo`
          : undefined;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-emerald-600" /> Overview
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        Your workspace at a glance.
                    </p>
                </div>
                <Button variant="outline" onClick={load} disabled={loading}>
                    <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                    Refresh
                </Button>
            </div>

            {loading ? (
                <p className="text-sm text-muted-foreground py-6">Loading overview…</p>
            ) : !tenant ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Building2 className="mx-auto h-10 w-10 text-slate-300" />
                        <p className="mt-3 text-sm text-muted-foreground">No tenant data available.</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <StatCard label="Company" value={tenant.company_name} icon={Building2} />
                        <StatCard
                            label="Tenant Code"
                            value={<span className="font-mono text-xl">{tenant.tenant_code}</span>}
                            icon={Hash}
                        />
                        <StatCard
                            label="Status"
                            value={
                                <Badge variant={statusVariant(tenant.status)} className="capitalize text-sm">
                                    {tenant.status || 'unknown'}
                                </Badge>
                            }
                            icon={BadgeCheck}
                        />
                        <StatCard
                            label="License"
                            value={<span className="capitalize">{license}</span>}
                            icon={CreditCard}
                            hint={licenseHint}
                        />
                        <StatCard label="Users" value={data?.users_count ?? 0} icon={Users} hint="Total members" />
                    </div>

                    <DomainCard info={domainInfo} loading={domainLoading} />
                </>
            )}
        </div>
    );
}
