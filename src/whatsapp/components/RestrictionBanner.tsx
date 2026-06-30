import React, { useEffect, useState } from 'react';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import { getVerificationStatus } from '../api';
import { getWorkspaceId } from '../utils/workspaceContext';

export function RestrictionBanner({ accountId }: { accountId: number }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      const wsId = getWorkspaceId() || '';
      const result = await getVerificationStatus(accountId, wsId);
      if (result && result.success) {
        setData(result.status);
      }
    };
    if (accountId) fetchStatus();
  }, [accountId]);

  if (!data) return null;

  const { maturity_state, actions_required, operational_mode, safe_mode_reason } = data;
  const isRestricted = maturity_state === 'restricted' || operational_mode === 'restricted';
  const isWarmingUp = maturity_state === 'warming_up' || operational_mode === 'warming_up';
  const isAdvisorySafeMode = operational_mode === 'advisory_safe_mode';
  const isDegraded = operational_mode === 'degraded';
  const hasReconnectAction = actions_required?.find((a: any) => a.type === 'reconnect_meta');
  const hasWebhookAction = actions_required?.find((a: any) => a.type === 'webhook_unhealthy');

  if (!isRestricted && !isWarmingUp && !isAdvisorySafeMode && !isDegraded && !hasReconnectAction && !hasWebhookAction) {
    return null;
  }

  if (isRestricted) {
    return (
      <div className="mb-6 p-4 bg-red-50 text-red-900 rounded-xl border border-red-200 flex items-start gap-3 shadow-sm">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-red-800">Account Restricted</h4>
          <p className="text-sm mt-1">
            Meta has placed restrictions on your account. Some features like sending bulk messages or creating templates may be disabled.
            Please check the <strong>Health & Trust</strong> section in Settings for details.
          </p>
        </div>
      </div>
    );
  }

  if (hasReconnectAction) {
    return (
      <div className="mb-6 p-4 bg-red-50 text-red-900 rounded-xl border border-red-200 flex items-start gap-3 shadow-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-red-800">Connection Corrupted</h4>
          <p className="text-sm mt-1 mb-3">
            {hasReconnectAction.message || "Your Meta access token is corrupted or expired. You must reconnect your account to continue sending messages."}
          </p>
          <a href="/settings/whatsapp/connect" className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg shadow-sm hover:bg-red-700">
            Reconnect Meta
          </a>
        </div>
      </div>
    );
  }

  if (hasWebhookAction) {
    return (
      <div className="mb-6 p-4 bg-orange-50 text-orange-900 rounded-xl border border-orange-200 flex items-start gap-3 shadow-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0 text-orange-600 mt-0.5" />
        <div className="flex-1">
          <h4 className="font-semibold text-orange-800">Webhook Connectivity Issue</h4>
          <p className="text-sm mt-1 mb-3">
            {hasWebhookAction.message || "We are having trouble receiving messages from Meta. Please retry the webhook subscription."}
          </p>
          <a href="/settings/whatsapp/advanced" className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-lg shadow-sm hover:bg-orange-700">
            Fix Webhook Connection
          </a>
        </div>
      </div>
    );
  }

  if (isWarmingUp) {
    return (
      <div className="mb-6 p-4 bg-yellow-50 text-yellow-900 rounded-xl border border-yellow-200 flex items-start gap-3 shadow-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0 text-yellow-600 mt-0.5" />
        <div>
          <h4 className="font-semibold text-yellow-800">Account in Warmup Mode</h4>
          <p className="text-sm mt-1">
            Your account is currently warming up to establish a trusted sending reputation. Daily messaging limits apply. Avoid sudden spikes in volume.
          </p>
        </div>
      </div>
    );
  }

  if (isDegraded) {
    return (
      <div className="mb-6 p-4 bg-orange-50 text-orange-900 rounded-xl border border-orange-200 flex items-start gap-3 shadow-sm">
        <AlertCircle className="w-5 h-5 flex-shrink-0 text-orange-600 mt-0.5" />
        <div>
          <h4 className="font-semibold text-orange-800">Account Degraded</h4>
          <p className="text-sm mt-1">
            {safe_mode_reason || "System metrics show prolonged instability."} The platform has automatically paused high-risk outbound traffic to protect your sending reputation.
          </p>
        </div>
      </div>
    );
  }

  if (isAdvisorySafeMode) {
    return (
      <div className="mb-6 p-4 bg-yellow-50 text-yellow-900 rounded-xl border border-yellow-200 flex items-start gap-3 shadow-sm">
        <ShieldAlert className="w-5 h-5 flex-shrink-0 text-yellow-600 mt-0.5" />
        <div>
          <h4 className="font-semibold text-yellow-800">Advisory Safe Mode Active</h4>
          <p className="text-sm mt-1">
            {safe_mode_reason || "Quality drop detected."} Non-essential bulk campaigns and high-risk automation are throttled to allow your quality score to recover.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
