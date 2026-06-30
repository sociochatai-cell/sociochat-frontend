import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertCircle,
  CheckCircle,
  Info,
  RefreshCw,
  ShieldAlert,
  ExternalLink,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ListChecks,
  MessageCircle,
  Phone,
  Route,
  ShieldCheck,
  Timer,
  Wrench,
} from 'lucide-react';
import { getVerificationStatus } from '../api';
import { getWorkspaceId } from '../utils/workspaceContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { deriveOperationalProfile } from '@/whatsapp/utils/operationalProfile';
import { fetchAccountStatusPayload } from '@/whatsapp/utils/accountStatusFetcher';
import type { WhatsAppAccountStatusPayload, WhatsAppStatusCheck } from '@/components/WhatsAppAccountStatusPopup';

const STATUS_LABELS: Record<string, string> = {
  CONNECTED: 'Connected',
  RELINK_REQUIRED: 'Reconnect required',
  PARTIAL: 'Setup incomplete',
  NO_ACCOUNT: 'Not connected',
  DISCONNECTED: 'Disconnected',
  NOT_CONFIGURED: 'Not configured',
  ERROR: 'Error checking status',
};

const MODE_BADGE: Record<string, string> = {
  APP_OWNED: 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
  CLIENT_SHARED: 'bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100',
  CLIENT_DIRECT: 'bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-100',
};

function badgeClass(status?: string): string {
  switch (status) {
    case 'healthy':
    case 'CONNECTED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100';
    case 'warning':
    case 'RELINK_REQUIRED':
    case 'PARTIAL':
      return 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100';
    case 'critical':
    case 'error':
    case 'DISCONNECTED':
    case 'NO_ACCOUNT':
    case 'NOT_CONFIGURED':
    case 'ERROR':
      return 'bg-red-100 text-red-800 border-red-200 hover:bg-red-100';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100';
  }
}

function checkIcon(status: WhatsAppStatusCheck['status']) {
  if (status === 'healthy') return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
  if (status === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
  return <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />;
}

export function VerificationCenter({ accountId }: { accountId: number }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [diagPayload, setDiagPayload] = useState<WhatsAppAccountStatusPayload | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [cachedTime, setCachedTime] = useState<string | null>(null);

  // Load cached status from localStorage on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('sv_whatsapp_status_payload');
      const time = localStorage.getItem('sv_whatsapp_status_timestamp');
      if (cached) {
        setDiagPayload(JSON.parse(cached));
      }
      if (time) {
        setCachedTime(time);
      }
    } catch (e) {
      console.warn('Failed to load cached WhatsApp status:', e);
    }
  }, []);

  const refreshAll = async () => {
    setLoading(true);
    setDiagLoading(true);
    const wsId = getWorkspaceId() || '';

    // Fetch both status endpoints concurrently
    await Promise.all([
      (async () => {
        try {
          const result = await getVerificationStatus(accountId, wsId);
          if (result && result.success) {
            setData(result.status);
          }
        } catch (e) {
          console.error('Failed to fetch verification status:', e);
        }
      })(),
      (async () => {
        try {
          const payload = await fetchAccountStatusPayload(wsId);
          setDiagPayload(payload);
          setCachedTime(new Date().toISOString());
        } catch (e) {
          console.error('Failed to fetch connection diagnostics:', e);
        }
      })()
    ]);

    setLoading(false);
    setDiagLoading(false);
  };

  useEffect(() => {
    if (accountId) {
      refreshAll();
    }
  }, [accountId]);

  const profile = useMemo(() => deriveOperationalProfile(diagPayload), [diagPayload]);

  const renderActionGuidance = (action: any, index: number) => {
    const isCritical = action.severity === 'critical';
    const isError = action.severity === 'error';

    return (
      <div key={index} className={`p-4 rounded-lg border mb-3 flex items-start gap-3 ${
        isCritical ? 'bg-red-50 border-red-200 text-red-900' :
        isError ? 'bg-orange-50 border-orange-200 text-orange-900' :
        'bg-blue-50 border-blue-200 text-blue-900'
      }`}>
        <div className="mt-0.5">
          {isCritical ? <ShieldAlert className="w-5 h-5 text-red-600" /> :
           isError ? <AlertCircle className="w-5 h-5 text-orange-600" /> :
           <Info className="w-5 h-5 text-blue-600" />}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm mb-1">
            {action.type.replace(/_/g, ' ').toUpperCase()}
          </h4>
          <p className="text-sm opacity-90">{action.message}</p>

          {action.type === 'display_name' && (
            <a href="https://business.facebook.com/settings/info" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium mt-2 hover:underline">
              Go to Meta Business Settings <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    );
  };

  const getMaturityColor = (state: string) => {
    switch(state) {
      case 'trusted': return 'bg-green-100 text-green-800 border-green-200';
      case 'mature': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'warming_up': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'restricted': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const metaData = data || {};
  const { completeness_score, actions_required, maturity_state, verified_name, display_name_status } = metaData;

  return (
    <div className="space-y-6">
      {/* Top Header with Refresh Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Verification & Operational Center</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor Meta business verification, API connection health, and feature permissions
          </p>
        </div>
        <button
          onClick={refreshAll}
          disabled={loading || diagLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50 h-9 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading || diagLoading ? 'animate-spin' : ''}`} />
          Refresh Health & Status
        </button>
      </div>

      <Tabs defaultValue="meta" className="w-full">
        <TabsList className="bg-slate-100/80 p-1 rounded-xl mb-6">
          <TabsTrigger value="meta" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-xs">Meta Business Verification</TabsTrigger>
          <TabsTrigger value="diagnostics" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-xs">Connection & Diagnostics</TabsTrigger>
        </TabsList>

        <TabsContent value="meta" className="space-y-6 mt-0">
          {loading && !data ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <span>Loading Verification Status...</span>
              </CardContent>
            </Card>
          ) : !data ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Failed to load verification status. Click **Refresh Health & Status** to retry.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Overview Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Onboarding Completeness</CardTitle>
                    <CardDescription>Overall setup progress</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold">{completeness_score}%</span>
                      {completeness_score === 100 ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Complete</Badge>
                      ) : (
                        <Badge variant="outline">In Progress</Badge>
                      )}
                    </div>
                    <Progress value={completeness_score} className="h-2" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Account Maturity</CardTitle>
                    <CardDescription>Current lifecycle stage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getMaturityColor(maturity_state)}`}>
                        {maturity_state.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {maturity_state === 'warming_up' && "Your account is gradually scaling messaging limits. Send high-quality messages to progress."}
                      {maturity_state === 'trusted' && "Your account has high quality and no restrictions. You have full access to platform capabilities."}
                      {maturity_state === 'restricted' && "Your account has active Meta restrictions limiting capabilities."}
                      {maturity_state === 'onboarding' && "Complete required Meta actions to begin messaging."}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Required Actions Guidance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-blue-600" />
                    Meta Action Required
                  </CardTitle>
                  <CardDescription>
                    Tasks you need to complete to unlock full capabilities.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {actions_required && actions_required.length > 0 ? (
                    <div>
                      {actions_required.map((action: any, i: number) => renderActionGuidance(action, i))}
                    </div>
                  ) : (
                    <div className="p-6 border rounded-lg bg-green-50 border-green-200 flex flex-col items-center justify-center text-center">
                      <CheckCircle className="w-10 h-10 text-green-500 mb-3" />
                      <h4 className="font-medium text-green-900 text-lg">You're all set!</h4>
                      <p className="text-green-700 mt-1">No pending Meta actions. Your account is fully configured.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Details List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-md">Verification Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    <div className="py-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium">Display Name Status</p>
                        <p className="text-sm text-muted-foreground">The name shown on your WhatsApp profile</p>
                      </div>
                      <Badge variant={display_name_status === 'APPROVED' ? 'default' : 'outline'}>
                        {display_name_status || 'UNKNOWN'}
                      </Badge>
                    </div>
                    <div className="py-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium">Verified Name</p>
                        <p className="text-sm text-muted-foreground">Confirmed business name by Meta</p>
                      </div>
                      <span className="font-mono text-sm">{verified_name || 'Not available'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="diagnostics" className="space-y-6 mt-0">
          {diagLoading && !diagPayload ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <span>Loading Connection and Health Details...</span>
              </CardContent>
            </Card>
          ) : !diagPayload ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No connection diagnostics data cached yet. Click **Refresh Health & Status** to fetch it.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Header Info Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-[#128C7E]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {profile && !profile.canSendMessages && diagPayload.connectionStatus === 'CONNECTED'
                        ? 'Connected — Messaging Authority Limited'
                        : diagPayload.overallHealth === 'healthy' && diagPayload.connectionStatus === 'CONNECTED'
                          ? 'WhatsApp Account is Ready'
                          : diagPayload.connectionStatus === 'CONNECTED'
                            ? 'WhatsApp Connected — Review Permissions'
                            : STATUS_LABELS[diagPayload.connectionStatus] || 'WhatsApp Account Status'}
                    </h3>
                    {cachedTime && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Status last refreshed: {new Date(cachedTime).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`${badgeClass(diagPayload.connectionStatus)} border font-semibold`}>
                    {STATUS_LABELS[diagPayload.connectionStatus] || diagPayload.connectionStatus}
                  </Badge>
                  {diagPayload.overallHealth && (
                    <Badge className={`${badgeClass(diagPayload.overallHealth)} border font-semibold`}>
                      Health: {diagPayload.overallHealth.toUpperCase()}
                    </Badge>
                  )}
                  {profile && (
                    <Badge className={`border font-semibold ${MODE_BADGE[profile.mode] || ''}`}>
                      {profile.modeLabel}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Mode Description & Account Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 shadow-sm border border-slate-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-md">Authority & Integration Details</CardTitle>
                    <CardDescription>How your WhatsApp Business Account links to Sociovia</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {profile && <p className="text-sm text-slate-600 leading-relaxed">{profile.modeDescription}</p>}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                      {diagPayload.accountName && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase tracking-wider">Account Verified Name</span>
                          <p className="font-semibold text-slate-800 text-sm mt-0.5">{diagPayload.accountName}</p>
                        </div>
                      )}
                      {diagPayload.accountPhone && (
                        <div>
                          <span className="text-xs text-muted-foreground uppercase tracking-wider">Phone Number</span>
                          <p className="font-semibold text-slate-800 text-sm mt-0.5">{diagPayload.accountPhone}</p>
                        </div>
                      )}
                      {diagPayload.wabaId && (
                        <div className="sm:col-span-2">
                          <span className="text-xs text-muted-foreground uppercase tracking-wider">WhatsApp Business Account ID</span>
                          <p className="font-mono text-xs text-slate-700 mt-1 select-all">{diagPayload.wabaId}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Readiness Score Card */}
                <Card className="shadow-sm border border-slate-200 flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-md flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#128C7E]" />
                      Readiness Score
                    </CardTitle>
                    <CardDescription>Overall setup capability index</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-6 flex-1 flex flex-col justify-center">
                    {typeof diagPayload.readinessScore === 'number' ? (
                      <div className="space-y-4">
                        <div className="flex items-baseline justify-between">
                          <span
                            className={`text-4xl font-extrabold ${
                              diagPayload.readinessScore >= 80
                                ? 'text-emerald-600'
                                : diagPayload.readinessScore >= 50
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                            }`}
                          >
                            {diagPayload.readinessScore}
                            <span className="text-sm font-normal text-slate-400">/100</span>
                          </span>
                        </div>
                        <Progress value={diagPayload.readinessScore} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                          {diagPayload.readinessScore >= 80
                            ? 'Your connection is highly optimized and ready for scaling.'
                            : diagPayload.readinessScore >= 50
                              ? 'Connection active but missing features like warmup limits or profile data.'
                              : 'Crucial setups missing. Review the Roadmap steps below.'}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Readiness rating not calculated yet.</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Working vs Limited Capabilities */}
              {profile && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Works Now */}
                  <Card className="border border-emerald-100 bg-emerald-50/20 shadow-sm">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold uppercase tracking-wide text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Active Platform Access
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {profile.workingFeatures.map((feature) => (
                          <li key={feature.id} className="text-sm text-emerald-950 flex items-start gap-2">
                            <span className="text-emerald-600 mt-1">•</span>
                            <span>{feature.label}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>

                  {/* Limited/Blocked Features */}
                  <Card className={`border shadow-sm ${
                    profile.limitedFeatures.length
                      ? 'border-red-100 bg-red-50/20'
                      : 'border-slate-100 bg-slate-50/40'
                  }`}>
                    <CardHeader className="pb-3">
                      <CardTitle className={`text-sm font-bold uppercase tracking-wide flex items-center gap-1.5 ${
                        profile.limitedFeatures.length ? 'text-red-800' : 'text-slate-600'
                      }`}>
                        <Ban className="w-4 h-4" />
                        Platform Restrictions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {profile.limitedFeatures.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No active capability limits detected.</p>
                      ) : (
                        <ul className="space-y-3">
                          {profile.limitedFeatures.map((feature) => (
                            <li key={feature.id} className="flex gap-2">
                              <span className="text-red-500 mt-1">•</span>
                              <div>
                                <div className="text-sm font-semibold text-red-950">{feature.label}</div>
                                <div className="text-xs text-red-800/80 mt-0.5 leading-relaxed">{feature.description}</div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Action Required Banner */}
              {diagPayload.actionRequired && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 mt-0.5 text-red-600 shrink-0" />
                  <div>
                    <span className="font-semibold">Action Required on Connection:</span> {diagPayload.actionRequired}
                  </div>
                </div>
              )}

              {/* Warmup State Card */}
              {diagPayload.warmupState?.in_warmup_window && (
                <Card className="border border-amber-200 bg-amber-50/50 shadow-sm">
                  <CardContent className="p-4 flex items-start gap-3">
                    <Timer className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-800 text-sm">Account Warmup Active</h4>
                      <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        To maintain high quality, Meta limits newly connected numbers. Your daily sending cap during the warmup window is <strong>{diagPayload.warmupState.effective_daily_send_cap ?? 'restricted'}</strong>. Drip campaigns and massive broadcasts may experience delays.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Roadmap to Enable Full Messaging */}
              {profile && profile.roadmap.length > 0 && (
                <Card className="border border-blue-200 bg-blue-50/30 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold text-blue-900 flex items-center gap-1.5">
                      <Route className="w-4 h-4 text-blue-700" />
                      Roadmap to Enable Full Messaging Authority
                    </CardTitle>
                    <CardDescription className="text-xs text-blue-800/70">
                      Steps to resolve send limitations on client-owned or restricted Business Accounts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-4">
                      {profile.roadmap.map((step, idx) => (
                        <li key={step.id} className="flex gap-3 text-sm">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-950">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-semibold text-blue-950">
                              {step.title}
                              {step.optional && (
                                <span className="ml-1 text-[10px] font-normal text-blue-600 bg-blue-100 px-1 py-0.5 rounded">(optional)</span>
                              )}
                            </div>
                            <p className="text-xs text-blue-800/90 mt-1 leading-relaxed">{step.description}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>
              )}

              {/* Diagnostic Checks List */}
              {diagPayload.checks && diagPayload.checks.length > 0 && (
                <Card className="shadow-sm border border-slate-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-md flex items-center gap-1.5">
                      <ListChecks className="w-4 h-4 text-[#128C7E]" />
                      Detailed Connection Diagnostics
                    </CardTitle>
                    <CardDescription>Independently checked system health modules</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {diagPayload.checks.map((check) => (
                      <div
                        key={check.name}
                        className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-xs"
                      >
                        {checkIcon(check.status)}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              {check.name.replace(/_/g, ' ')}
                            </span>
                            {check.fixed && (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[9px] h-4 font-extrabold flex items-center gap-0.5">
                                <Wrench className="w-2.5 h-2.5" /> Auto-fixed
                              </Badge>
                            )}
                          </div>
                          <p className="text-slate-800 text-sm mt-1 leading-relaxed">{check.message}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
