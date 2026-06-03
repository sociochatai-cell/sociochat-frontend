// Onboarding progress panel — shown when WhatsApp account exists but is not ACTIVE
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { ConnectWhatsAppButton } from './ConnectWhatsAppButton';
import {
  type OnboardingStatus,
  isOnboardingPending,
  userMessageForStatus,
} from '../constants/onboardingStatus';
import { getOnboardingHealth, type OnboardingHealthResponse } from '@/whatsapp_automation/api/whatsappApi';

interface OnboardingProgressPanelProps {
  workspaceId: string;
  account: {
    id: number;
    onboarding_status?: string | null;
    onboarding_error?: string | null;
    token_type?: string;
    is_active?: boolean;
  };
  onUpdate?: () => void;
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-red-500 shrink-0" />
      )}
      <span className={ok ? 'text-gray-700' : 'text-gray-600'}>{label}</span>
    </div>
  );
}

export function OnboardingProgressPanel({
  workspaceId,
  account,
  onUpdate,
}: OnboardingProgressPanelProps) {
  const status = (account.onboarding_status || 'PENDING') as OnboardingStatus;
  const [health, setHealth] = useState<OnboardingHealthResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  const fetchHealth = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingHealth(true);
    try {
      const data = await getOnboardingHealth(workspaceId);
      setHealth(data);
    } finally {
      setLoadingHealth(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth, account.onboarding_status]);

  useEffect(() => {
    if (!isOnboardingPending(status)) return;
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [status, fetchHealth]);

  const displayMessage =
    health?.user_message
    || userMessageForStatus(status, account.onboarding_error || health?.onboarding_error);

  const showReconnect = status === 'RECONNECT_REQUIRED' || status === 'FAILED';

  return (
    <Card className="border-amber-200 bg-amber-50/30 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">WhatsApp Setup In Progress</CardTitle>
            <CardDescription>
              Complete onboarding before messaging is available
            </CardDescription>
          </div>
          <ConnectionStatusBadge
            isActive={false}
            tokenType={account.token_type}
            onboardingStatus={status}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant={showReconnect ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{showReconnect ? 'Action Required' : 'Setup Pending'}</AlertTitle>
          <AlertDescription>{displayMessage}</AlertDescription>
        </Alert>

        {account.onboarding_error && (
          <p className="text-xs text-muted-foreground font-mono bg-white/80 p-2 rounded border">
            {account.onboarding_error}
          </p>
        )}

        {health && (
          <div className="grid sm:grid-cols-2 gap-2 p-4 bg-white rounded-lg border">
            <CheckRow label="Portfolio linked" ok={health.portfolio_visible} />
            <CheckRow label="WABA visible" ok={health.waba_visible} />
            <CheckRow label="Phone number visible" ok={health.phone_visible} />
            <CheckRow label="App subscribed" ok={health.app_subscribed} />
            <CheckRow label="Token valid" ok={health.token_valid} />
            <CheckRow label="Permissions valid" ok={health.permissions_valid ?? false} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {showReconnect ? (
            <ConnectWhatsAppButton
              workspaceId={workspaceId}
              variant="reconnect"
              onConnected={() => {
                fetchHealth();
                onUpdate?.();
              }}
            />
          ) : (
            <>
              <ConnectWhatsAppButton
                workspaceId={workspaceId}
                onConnected={() => {
                  fetchHealth();
                  onUpdate?.();
                }}
              />
              {isOnboardingPending(status) && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Retrying automatically every few minutes…
                </p>
              )}
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchHealth();
              onUpdate?.();
            }}
            disabled={loadingHealth}
          >
            {loadingHealth ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-1" />
                Refresh status
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
