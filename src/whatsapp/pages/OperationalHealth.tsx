import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Activity, ShieldAlert, Download, RefreshCw, AlertCircle, CheckCircle2, ShieldOff, Shield, BarChart3 } from 'lucide-react';
import { exportDiagnostics, retryWebhook, refreshWebhook, toggleSafeModeOverride, getOperationalMetrics } from '../api';
import { getWorkspaceId } from '../utils/workspaceContext';
import { WHATSAPP_REST_API_PREFIX } from '@/config';
import { cachedFetch } from '../utils/waPersistentCache';
import { RefreshButton } from '../components/RefreshButton';

export function OperationalHealth({ accountId }: { accountId: number }) {
  const [operatorSecret, setOperatorSecret] = useState(localStorage.getItem('wh_operator_secret') || '');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [isAdvisoryOnly, setIsAdvisoryOnly] = useState<boolean>(true); // Would be hydrated from real state if we fetched it here
  const [ttlHours, setTtlHours] = useState<number>(24);
  const [metrics, setMetrics] = useState<any>(null);

  const fetchMetrics = async () => {
    const wsId = getWorkspaceId() || '';
    const data = await getOperationalMetrics(accountId, wsId);
    if (data && data.success) {
      setMetrics(data.metrics);
    }
  };

  React.useEffect(() => {
    fetchMetrics();
  }, [accountId]);

  const saveSecret = (val: string) => {
    setOperatorSecret(val);
    localStorage.setItem('wh_operator_secret', val);
  };

  const handleAction = async (action: string, apiCall: () => Promise<any>) => {
    setLoadingAction(action);
    setActionResult(null);
    try {
      const result = await apiCall();
      if (result && result.success) {
        setActionResult({ type: 'success', message: `${action} completed successfully.` });
      } else {
        setActionResult({ type: 'error', message: result?.error || `Failed to execute ${action}.` });
      }
    } catch (err) {
      setActionResult({ type: 'error', message: `An unexpected error occurred during ${action}.` });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleExportDiagnostics = async () => {
    setLoadingAction('export');
    setActionResult(null);
    try {
      // Temporarily override fetch for the export endpoint to inject secret
      const wsId = getWorkspaceId() || '';
      const params = wsId ? `?workspace_id=${wsId}` : '';
      const url = `${WHATSAPP_REST_API_PREFIX}/accounts/${accountId}/diagnostics/export${params}`;
      
      const res = await cachedFetch(url, {
        headers: {
          'Authorization': `Bearer ${operatorSecret}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await res.json();
      if (data.success) {
        const blob = new Blob([JSON.stringify(data.diagnostics, null, 2)], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `whatsapp_diagnostics_${accountId}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        setActionResult({ type: 'success', message: 'Diagnostics exported successfully.' });
      } else {
        setActionResult({ type: 'error', message: data.error || 'Failed to export diagnostics.' });
      }
    } catch (err) {
      setActionResult({ type: 'error', message: 'Network error exporting diagnostics.' });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleWebhookRetry = async () => {
    // Requires operator secret in future implementation if endpoint is protected.
    // Currently relying on backend API wrapper.
    // We should patch the API to inject the secret. For now, simulate the call with fetch directly.
    const wsId = getWorkspaceId() || '';
    handleAction('Webhook Retry', async () => {
      const res = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/accounts/${accountId}/webhook/retry`, {
        method: 'POST',
        headers: {
          'Authorization': operatorSecret ? `Bearer ${operatorSecret}` : '',
          'X-Operator-Secret': operatorSecret || '',
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ workspace_id: wsId, operator_secret: operatorSecret || undefined })
      });
      return res.json();
    });
  };

  const handleToggleSafeMode = async () => {
    const wsId = getWorkspaceId() || '';
    handleAction('Toggle Safe Mode', async () => {
      const targetState = !isAdvisoryOnly;
      const res = await toggleSafeModeOverride(accountId, targetState, operatorSecret, wsId, ttlHours);
      if (res && res.success) {
        setIsAdvisoryOnly(res.safe_mode_advisory_only);
      }
      return res;
    });
  };

  return (
    <div className="space-y-6">
      
      {metrics && (
        <Card className="border-blue-200">
          <CardHeader className="bg-blue-50 border-b border-blue-200 pb-4 rounded-t-lg">
            <CardTitle className="text-blue-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Operational Stability Metrics
            </CardTitle>
            <CardDescription className="text-blue-700/80">
              Noise tracking, degradation frequency, and retry budgets.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Degradations</p>
                <p className="text-2xl font-bold mt-1 text-slate-800">{metrics.degradation_count}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Recoveries</p>
                <p className="text-2xl font-bold mt-1 text-slate-800">{metrics.recovery_count}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Safe Mode Entries</p>
                <p className="text-2xl font-bold mt-1 text-slate-800">{metrics.safe_mode_entries_count}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-md border border-slate-100">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Webhook Fails Today</p>
                <p className="text-2xl font-bold mt-1 text-slate-800">{metrics.webhook_failure_count}</p>
              </div>
            </div>
            {metrics.webhook_cooldown_ends_at && (
              <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 rounded-md border border-yellow-200 flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4" />
                Active Cooldown: Self-healing disabled until {new Date(metrics.webhook_cooldown_ends_at).toLocaleString()}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <Card className="border-orange-200">
        <CardHeader className="bg-orange-50 border-b border-orange-200 pb-4 rounded-t-lg">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-orange-800 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                Support / Operator Tools
              </CardTitle>
              <CardDescription className="text-orange-700/80">
                Advanced operational tools. Requires an Operator Secret to execute actions.
              </CardDescription>
            </div>
            <RefreshButton onRefresh={fetchMetrics} title="Refresh" />
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 max-w-sm">
            <label className="text-sm font-medium text-gray-700 mb-1 block">Operator Secret</label>
            <Input 
              type="password" 
              placeholder="Enter operator secret..." 
              value={operatorSecret}
              onChange={(e) => saveSecret(e.target.value)}
            />
          </div>

          {actionResult && (
            <div className={`p-4 rounded-md mb-6 flex items-start gap-3 ${
              actionResult.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {actionResult.type === 'success' ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <AlertCircle className="w-5 h-5 mt-0.5" />}
              <p className="text-sm font-medium">{actionResult.message}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg hover:shadow-sm transition-shadow bg-white">
              <h4 className="font-semibold mb-1 flex items-center gap-2">
                <Download className="w-4 h-4 text-blue-600" />
                Export Diagnostics
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                Download a complete JSON dump of account state, capabilities, webhook health, and trust snapshots for support tickets.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportDiagnostics}
                disabled={!operatorSecret || loadingAction !== null}
              >
                {loadingAction === 'export' ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
                Download JSON
              </Button>
            </div>

            <div className="p-4 border rounded-lg hover:shadow-sm transition-shadow bg-white">
              <h4 className="font-semibold mb-1 flex items-center gap-2">
                <Activity className="w-4 h-4 text-orange-600" />
                Retry Webhook Subscription
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                Force re-subscribes the WABA to our webhook endpoints. Use this if webhooks are failing or missing.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleWebhookRetry}
                disabled={loadingAction !== null}
              >
                {loadingAction === 'Webhook Retry' ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
                Execute Retry
              </Button>
            </div>

            <div className="p-4 border rounded-lg hover:shadow-sm transition-shadow bg-white md:col-span-2">
              <h4 className="font-semibold mb-1 flex items-center gap-2">
                {isAdvisoryOnly ? <Shield className="w-4 h-4 text-green-600" /> : <ShieldOff className="w-4 h-4 text-red-600" />}
                Safe Mode Enforcement Override
              </h4>
              <p className="text-sm text-muted-foreground mb-4">
                When enabled (Advisory), the system relies on self-healing logic but operators can force hard restrictions by disabling this.
                Currently: <strong>{isAdvisoryOnly ? "Advisory Only" : "Hard Enforcement"}</strong>
              </p>
              
              {isAdvisoryOnly && (
                <div className="mb-4 max-w-xs">
                  <label className="text-xs font-medium text-gray-700 mb-1 block">Override TTL (Hours)</label>
                  <Input 
                    type="number" 
                    min="1" 
                    max="72" 
                    value={ttlHours}
                    onChange={(e) => setTtlHours(parseInt(e.target.value) || 24)}
                    className="h-8"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Override will automatically expire and revert to Advisory after this time.</p>
                </div>
              )}

              <Button 
                variant={isAdvisoryOnly ? "destructive" : "default"}
                size="sm" 
                onClick={handleToggleSafeMode}
                disabled={!operatorSecret || loadingAction !== null}
              >
                {loadingAction === 'Toggle Safe Mode' ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null}
                {isAdvisoryOnly ? "Switch to Hard Enforcement" : "Switch to Advisory Only"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
