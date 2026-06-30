import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ListChecks,
  MessageCircle,
  Phone,
  Route,
  ShieldAlert,
  ShieldCheck,
  Timer,
  X,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  deriveOperationalProfile,
  type ConnectionAuthorityMode,
} from '@/whatsapp/utils/operationalProfile';

export interface WhatsAppStatusCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'critical';
  message: string;
  fixed?: boolean;
  details?: Record<string, unknown>;
}

export interface CapabilityMatrixEntry {
  enabled: boolean;
  reason?: string;
  auto_fixable?: boolean;
  fixed?: boolean;
}

export interface WhatsAppAccountStatusPayload {
  connectionStatus: string;
  connectionReason?: string;
  accountName?: string;
  accountPhone?: string;
  wabaId?: string;
  overallHealth?: 'healthy' | 'warning' | 'error' | 'critical';
  actionRequired?: string | null;
  checks?: WhatsAppStatusCheck[];
  readinessScore?: number;
  capabilityMatrix?: Record<string, CapabilityMatrixEntry>;
  warmupState?: {
    in_warmup_window?: boolean;
    warmup_ends_at?: string;
    countdown_seconds?: number;
    restrictions?: Array<{ feature: string; enabled: boolean; reason: string }>;
    effective_daily_send_cap?: number;
  };
  provisioningState?: string;
  operationalLifecycle?: string;
}

interface WhatsAppAccountStatusPopupProps {
  isOpen: boolean;
  onClose: () => void;
  data: WhatsAppAccountStatusPayload | null;
  loading?: boolean;
  durationMs?: number;
  onOpenSettings?: () => void;
  onOpenSetup?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  CONNECTED: 'Connected',
  RELINK_REQUIRED: 'Reconnect required',
  PARTIAL: 'Setup incomplete',
  NO_ACCOUNT: 'Not connected',
  DISCONNECTED: 'Disconnected',
  NOT_CONFIGURED: 'Not configured',
  ERROR: 'Error checking status',
};

const MODE_BADGE: Record<ConnectionAuthorityMode, string> = {
  APP_OWNED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CLIENT_SHARED: 'bg-blue-100 text-blue-800 border-blue-200',
  CLIENT_DIRECT: 'bg-amber-100 text-amber-900 border-amber-200',
};

function badgeClass(status?: string): string {
  switch (status) {
    case 'healthy':
    case 'CONNECTED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'warning':
    case 'RELINK_REQUIRED':
    case 'PARTIAL':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'critical':
    case 'error':
    case 'DISCONNECTED':
    case 'NO_ACCOUNT':
    case 'NOT_CONFIGURED':
    case 'ERROR':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function checkIcon(status: WhatsAppStatusCheck['status']) {
  if (status === 'healthy') return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
  if (status === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />;
  return <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />;
}

export default function WhatsAppAccountStatusPopup({
  isOpen,
  onClose,
  data,
  loading = false,
  durationMs = 20000,
  onOpenSettings,
  onOpenSetup,
}: WhatsAppAccountStatusPopupProps) {
  const onCloseRef = useRef(onClose);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(durationMs / 1000));
  const [progress, setProgress] = useState(100);

  const resultsReady = isOpen && !loading;
  const profile = useMemo(() => deriveOperationalProfile(data), [data]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      setSecondsLeft(Math.ceil(durationMs / 1000));
      setProgress(100);
      return;
    }

    if (!resultsReady) {
      setSecondsLeft(Math.ceil(durationMs / 1000));
      setProgress(100);
      return;
    }

    const started = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - started;
      const remaining = Math.max(0, durationMs - elapsed);
      setSecondsLeft(Math.ceil(remaining / 1000));
      setProgress((remaining / durationMs) * 100);
      if (remaining <= 0) {
        window.clearInterval(tick);
        onCloseRef.current();
      }
    }, 200);

    return () => window.clearInterval(tick);
  }, [isOpen, resultsReady, durationMs]);

  const headline = useMemo(() => {
    if (loading) return 'Checking WhatsApp account…';
    if (!data) return 'WhatsApp account status';
    if (profile && !profile.canSendMessages && data.connectionStatus === 'CONNECTED') {
      return 'Connected — messaging authority limited';
    }
    if (data.overallHealth === 'healthy' && data.connectionStatus === 'CONNECTED') {
      return 'WhatsApp account is ready';
    }
    if (data.connectionStatus === 'CONNECTED') {
      return 'WhatsApp connected — review permissions';
    }
    return STATUS_LABELS[data.connectionStatus] || 'WhatsApp account status';
  }, [data, loading, profile]);

  const visibleChecks = (data?.checks || [])
    .filter((c) => c.status !== 'healthy' || c.name.includes('send') || c.name.includes('permission'))
    .slice(0, 5);

  const content = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
        >
          <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />

          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/60 bg-white/95 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wa-status-popup-title"
          >
            <motion.div
              className={`h-1.5 bg-gradient-to-r sticky top-0 z-10 ${
                profile?.canSendMessages && data?.connectionStatus === 'CONNECTED'
                  ? 'from-emerald-500 to-green-600'
                  : 'from-amber-500 to-orange-600'
              }`}
            />

            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-[#128C7E]" />
                  </div>
                  <div>
                    <h2 id="wa-status-popup-title" className="text-lg font-semibold text-gray-900">
                      {headline}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {loading
                        ? 'Running connection, health, and permission checks…'
                        : `Results ready — auto-closes in ${secondsLeft}s`}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {resultsReady && <Progress value={progress} className="h-1.5 mb-5" />}

              {loading ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-muted-foreground text-center flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                  Loading connection and health details…
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(
                        data?.connectionStatus
                      )}`}
                    >
                      {STATUS_LABELS[data?.connectionStatus || ''] || data?.connectionStatus || 'Unknown'}
                    </span>
                    {data?.overallHealth && (
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(
                          data.overallHealth
                        )}`}
                      >
                        Health: {data.overallHealth.toUpperCase()}
                      </span>
                    )}
                    {profile && (
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${MODE_BADGE[profile.mode]}`}
                      >
                        {profile.modeLabel}
                      </span>
                    )}
                  </div>

                  {profile && (
                    <p className="text-sm text-slate-600">{profile.modeDescription}</p>
                  )}

                  {(data?.accountName || data?.accountPhone) && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                      {data.accountName && (
                        <div className="flex items-center gap-2 text-sm">
                          <MessageCircle className="w-4 h-4 text-slate-500" />
                          <span className="font-medium">{data.accountName}</span>
                        </div>
                      )}
                      {data.accountPhone && (
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Phone className="w-4 h-4 text-slate-500" />
                          <span>{data.accountPhone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {profile && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800 mb-2 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Works now
                        </div>
                        <ul className="space-y-1">
                          {profile.workingFeatures.map((f) => (
                            <li key={f.id} className="text-xs text-emerald-900 flex items-start gap-1.5">
                              <span className="mt-0.5">•</span>
                              {f.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div
                        className={`rounded-xl border p-3 ${
                          profile.limitedFeatures.length
                            ? 'border-red-200 bg-red-50/80'
                            : 'border-slate-200 bg-slate-50'
                        }`}
                      >
                        <div
                          className={`text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1 ${
                            profile.limitedFeatures.length ? 'text-red-800' : 'text-slate-600'
                          }`}
                        >
                          <Ban className="w-3.5 h-3.5" /> Limited / blocked
                        </div>
                        {profile.limitedFeatures.length === 0 ? (
                          <p className="text-xs text-slate-600">No major feature blocks detected.</p>
                        ) : (
                          <ul className="space-y-2">
                            {profile.limitedFeatures.map((f) => (
                              <li key={f.id}>
                                <div className="text-xs font-medium text-red-900">{f.label}</div>
                                <div className="text-[11px] text-red-800/90">{f.description}</div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  {data?.actionRequired && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      <span className="font-medium">Action required:</span> {data.actionRequired}
                    </div>
                  )}

                  {profile && profile.roadmap.length > 0 && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 mb-3">
                        <Route className="w-4 h-4" />
                        Roadmap to enable full messaging
                      </div>
                      <ol className="space-y-3">
                        {profile.roadmap.map((step, index) => (
                          <li key={step.id} className="flex gap-3 text-sm">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-200 text-xs font-bold text-blue-900">
                              {index + 1}
                            </span>
                            <div>
                              <div className="font-medium text-blue-950">
                                {step.title}
                                {step.optional && (
                                  <span className="ml-1 text-[10px] font-normal text-blue-600">(optional)</span>
                                )}
                              </div>
                              <p className="text-xs text-blue-800/90 mt-0.5">{step.description}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {visibleChecks.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1">
                        <ListChecks className="w-3.5 h-3.5" /> Diagnostic checks
                      </div>
                      {visibleChecks.map((check) => (
                        <div
                          key={check.name}
                          className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5"
                        >
                          {checkIcon(check.status)}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                {check.name.replace(/_/g, ' ')}
                              </span>
                              {check.fixed && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                  <Wrench className="w-2.5 h-2.5" /> Auto-fixed
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-slate-800 break-words">{check.message}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {typeof data?.readinessScore === 'number' && (
                    <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4" /> Readiness Score
                        </span>
                        <span
                          className={`text-2xl font-bold ${
                            data.readinessScore >= 80
                              ? 'text-emerald-600'
                              : data.readinessScore >= 50
                                ? 'text-amber-600'
                                : 'text-red-600'
                          }`}
                        >
                          {data.readinessScore}
                          <span className="text-sm text-slate-400">/100</span>
                        </span>
                      </div>
                      <Progress value={data.readinessScore} className="h-2" />
                    </div>
                  )}

                  {data?.warmupState?.in_warmup_window && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Timer className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-semibold text-amber-800">Warmup active</span>
                      </div>
                      {data.warmupState.effective_daily_send_cap != null && (
                        <div className="text-xs text-amber-700">
                          Daily send cap during warmup: {data.warmupState.effective_daily_send_cap}
                        </div>
                      )}
                    </div>
                  )}

                  {!data?.accountName && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                      No WhatsApp Business account is linked to this workspace yet.
                    </div>
                  )}

                  {data?.accountName && data.connectionStatus === 'CONNECTED' && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
                      <p className="font-semibold text-blue-900 mb-1">Meta billing (your Business Manager)</p>
                      <p className="text-blue-800 mb-3">
                        WhatsApp conversation charges are billed by Meta to your account — not Sociovia.
                        Add a payment method in WhatsApp Manager to avoid messaging limits.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href="https://business.facebook.com/wa/manage/home/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Open WhatsApp Manager
                        </a>
                        <a
                          href="https://www.facebook.com/business/help/488291839463771"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-md border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100"
                        >
                          How to add payment
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                {onOpenSetup && profile && !profile.canSendMessages && (
                  <Button variant="default" size="sm" className="bg-[#128C7E] hover:bg-[#0d6b5c]" onClick={onOpenSetup}>
                    Fix connection (setup)
                  </Button>
                )}
                {onOpenSettings && (
                  <Button variant="outline" size="sm" onClick={onOpenSettings}>
                    WhatsApp settings
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={onClose}>
                  Dismiss
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
