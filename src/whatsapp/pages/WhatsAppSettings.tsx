// WhatsApp Settings Page
// ======================
// Redesigned: User-friendly settings page for non-technical users
// Follows multi-tenant SaaS patterns (Slack, HubSpot, Intercom style)

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getWhatsAppAccounts, retryWebhook } from '../api';
import { fetchWithTimeout, FetchTimeoutError } from '@/lib/fetchWithTimeout';
import { WhatsAppAccountCard } from '../components/WhatsAppAccountCard';
import { SettingsLoadingScreen } from '../components/SettingsLoadingScreen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConnectFacebookAdsCard } from '@/ctwa/components/ConnectFacebookAdsCard';
import { AdAccountSettingsCard } from '@/ctwa/components/AdAccountSettingsCard';
import OwnerAgentsManager from '@/agent_login/components/AgentsManager';
import DepartmentsManager from '@/whatsapp/jom/DepartmentsManager';
import { isJomWorkspace } from '@/whatsapp/jom/jomApi';
import PaymentsSettings from '@/whatsapp/commerce/PaymentsSettings';
import { usePlan } from '@/contexts/PlanContext';
import apiClient from '@/lib/apiClient';
import { makeOwnerAgentApi } from '@/agent_login/lib/agentAdminApi';
import {
  ChevronDown,
  MessageCircle,
  Zap,
  LayoutDashboard,
  Inbox,
  Building2,
  Info,
  Shield,
  Send,
  FileText,
  Phone,
  Settings,
  CheckCircle,
  RefreshCw,
  BarChart3,
  AlertCircle,
  ExternalLink,
  Trash2,
  Link,
  Link2Off,
  Pause,
  Play,
  GitBranch,
  Bell,
  Edit2,
  Save,
  X,
  Loader2,
  Bot,
  ClipboardList,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import logo from '@/assets/sociovia_logo.png';
import { API_BASE_URL, WHATSAPP_REST_API_PREFIX } from "@/config";
import { getNotificationSettings, updateNotificationSettings } from '@/whatsapp_automation/api/whatsappApi';
import { setStoredAccountId } from '../utils/accountContext';
import { getWorkspaceId, setWorkspaceId as setStoredWorkspaceId } from '../utils/workspaceContext';
import WhatsAppConnectSuccessPopup from '@/components/WhatsAppConnectSuccessPopup';
import { requestWhatsAppAccountStatusPopup } from '@/whatsapp/utils/accountStatusPopup';
import { VerificationCenter } from './VerificationCenter';
import { TrustCenter } from './TrustCenter';
import { OperationalHealth } from './OperationalHealth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { isWaOpsQaNavVisible } from '../utils/waOpsNavVisible';
import { cachedFetch } from '../utils/waPersistentCache';

const WA_SETTINGS_TABS = ['general', 'verification', 'trust', 'operator', 'agents', 'payments'] as const;
type WaSettingsTab = (typeof WA_SETTINGS_TABS)[number];

function normalizeWaTab(raw: string | null): WaSettingsTab {
  const v = (raw || '').toLowerCase();
  return (WA_SETTINGS_TABS as readonly string[]).includes(v) ? (v as WaSettingsTab) : 'general';
}

const API_BASE = API_BASE_URL;

interface Workspace {
  id: string;
  name: string;
}

interface WhatsAppAccount {
  id: number;
  workspace_id: string | null;
  waba_id: string;
  phone_number_id: string;
  meta_business_id?: string | null;
  display_phone_number: string | null;
  verified_name: string | null;
  quality_score: string | null;
  messaging_limit: number | null;
  token_type: string;
  is_active: boolean;
  created_at: string;
}

interface HealthCheckItem {
  name: string;
  status: 'healthy' | 'warning' | 'error' | 'critical';
  message: string;
  details?: Record<string, unknown>;
  auto_fix_available?: boolean;
  fixed?: boolean;
  fix_result?: {
    success?: boolean;
    message?: string;
    details?: Record<string, unknown>;
  } | null;
}

interface AccountHealthReport {
  success: boolean;
  account_id: number;
  overall_status: 'healthy' | 'warning' | 'error' | 'critical';
  action_required?: string | null;
  checks: HealthCheckItem[];
  auto_fixes_applied?: number;
  checked_at?: string;
}

// Debug Token Section Component - FOR TESTING ONLY
function DebugTokenSection({ accountId }: { accountId: number }) {
  const [debugInfo, setDebugInfo] = useState<{
    access_token?: string;
    waba_id?: string;
    phone_number_id?: string;
    has_flow_keys?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchDebugInfo = async () => {
    setLoading(true);
    try {
      const res = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/accounts/${accountId}/debug`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        setDebugInfo(data.account);
      }
    } catch (err) {
      console.error('Failed to fetch debug info:', err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-yellow-600" />
          <p className="font-medium text-sm text-yellow-900">🔧 Debug Info (Testing Only)</p>
        </div>
        {!debugInfo && (
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDebugInfo}
            disabled={loading}
            className="text-xs"
          >
            {loading ? 'Loading...' : 'Load Debug Info'}
          </Button>
        )}
      </div>

      {debugInfo && (
        <div className="space-y-3 mt-3">
          {/* WABA ID */}
          <div className="flex items-center justify-between p-2 bg-white rounded border">
            <div>
              <p className="text-xs text-muted-foreground">WABA ID</p>
              <p className="font-mono text-xs select-all">{debugInfo.waba_id}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(debugInfo.waba_id || '', 'waba')}
              className="text-xs h-7"
            >
              {copied === 'waba' ? '✓ Copied' : 'Copy'}
            </Button>
          </div>

          {/* Phone Number ID */}
          <div className="flex items-center justify-between p-2 bg-white rounded border">
            <div>
              <p className="text-xs text-muted-foreground">Phone Number ID</p>
              <p className="font-mono text-xs select-all">{debugInfo.phone_number_id}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(debugInfo.phone_number_id || '', 'phone')}
              className="text-xs h-7"
            >
              {copied === 'phone' ? '✓ Copied' : 'Copy'}
            </Button>
          </div>

          {/* Access Token */}
          <div className="p-2 bg-white rounded border">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">Access Token (Permanent)</p>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowToken(!showToken)}
                  className="text-xs h-7"
                >
                  {showToken ? 'Hide' : 'Show'}
                </Button>
                {showToken && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(debugInfo.access_token || '', 'token')}
                    className="text-xs h-7"
                  >
                    {copied === 'token' ? '✓ Copied' : 'Copy'}
                  </Button>
                )}
              </div>
            </div>
            {showToken ? (
              <p className="font-mono text-xs break-all select-all bg-gray-100 p-2 rounded max-h-24 overflow-y-auto">
                {debugInfo.access_token}
              </p>
            ) : (
              <p className="font-mono text-xs text-gray-400">••••••••••••••••••••••••••••••••</p>
            )}
          </div>

          {/* Flow Keys Status */}
          <div className="flex items-center gap-2 p-2 bg-white rounded border">
            <p className="text-xs text-muted-foreground">Flow Keys:</p>
            <span className={`text-xs font-medium ${debugInfo.has_flow_keys ? 'text-green-600' : 'text-red-600'}`}>
              {debugInfo.has_flow_keys ? '✓ Configured' : '✗ Not Set'}
            </span>
          </div>

          <p className="text-xs text-yellow-700 mt-2">
            ⚠️ Keep these credentials secure. Never share your access token publicly.
          </p>
        </div>
      )}
    </div>
  );
}

// Notification Settings Component
function NotificationSettingsSection({ accountId, workspaceId }: { accountId: number; workspaceId: string | null }) {
  const [notificationPhone, setNotificationPhone] = useState<string>('');
  const [notificationEmail, setNotificationEmail] = useState<string>('');
  const [editMode, setEditMode] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load notification settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const result = await getNotificationSettings({
          account_id: accountId,
          workspace_id: workspaceId || undefined
        });
        if (result.success) {
          if (result.notification_phone_number) {
            setNotificationPhone(result.notification_phone_number);
          }
          if (result.notification_email) {
            setNotificationEmail(result.notification_email);
          }
        }
      } catch (err) {
        console.error('Failed to load notification settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [accountId, workspaceId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const result = await updateNotificationSettings({
        account_id: accountId,
        workspace_id: workspaceId || undefined,
        notification_phone_number: editPhone,
        notification_email: editEmail,
      });
      if (result.success) {
        setNotificationPhone(result.notification_phone_number || '');
        setNotificationEmail(result.notification_email || '');
        setEditMode(false);
      } else {
        setError(result.error || 'Failed to save');
      }
    } catch (err) {
      setError('Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setEditPhone(notificationPhone);
    setEditEmail(notificationEmail);
    setEditMode(true);
    setError(null);
  };

  const handleCancel = () => {
    setEditMode(false);
    setEditPhone('');
    setEditEmail('');
    setError(null);
  };

  // Format phone number for display
  const formatDisplayPhone = (phone: string) => {
    if (!phone) return 'Not configured';
    // Simple formatting: add + prefix if not present
    const formatted = phone.startsWith('+') ? phone : `+${phone}`;
    return formatted;
  };

  return (
    <Card className="border shadow-sm bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-100">
            <Bell className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <CardTitle className="text-base">Notification Settings</CardTitle>
            <CardDescription className="text-sm">
              Phone for platform alerts; email for AI human-required escalations
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : editMode ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Notification Phone Number
              </label>
              <Input
                type="tel"
                placeholder="919876543210 (with country code, no +)"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value.replace(/[^0-9]/g, ''))}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Platform / Meta status alerts (WhatsApp)
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Escalation Email
              </label>
              <Input
                type="email"
                placeholder="team@yourcompany.com"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value.trim())}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Receives email when AI cannot answer and a human must take over
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="gap-1 bg-green-600 hover:bg-green-700"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                className="gap-1"
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
            </div>
            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {notificationPhone ? formatDisplayPhone(notificationPhone) : 'Phone not configured'}
                  </p>
                  <p className="text-xs text-muted-foreground">Meta / account status (WhatsApp)</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {notificationEmail || 'Email not configured'}
                  </p>
                  <p className="text-xs text-muted-foreground">AI human-required escalations</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleEdit}
                className="gap-1"
              >
                <Edit2 className="w-4 h-4" />
                {notificationPhone || notificationEmail ? 'Edit' : 'Add'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MetaBusinessIdSection({
  account,
  onSaved,
}: {
  account: WhatsAppAccount;
  onSaved: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [value, setValue] = useState(account.meta_business_id || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(account.meta_business_id || '');
    setEditMode(false);
    setError(null);
  }, [account.id, account.meta_business_id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/accounts/${account.id}/meta-business-id`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ meta_business_id: value }),
      });
      const data = await res.json();
      if (!res.ok || data.success === false) {
        setError(data.error || 'Failed to save Meta Business Manager ID');
        return;
      }
      setEditMode(false);
      onSaved();
    } catch (err) {
      setError('Failed to save Meta Business Manager ID');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border shadow-sm bg-white">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-base">Meta Business Manager ID</CardTitle>
            <CardDescription className="text-sm">
              Required for WhatsApp catalog creation and connecting business-owned Meta catalogs
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {editMode ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Business Manager ID
              </label>
              <div className="flex gap-2">
                <Input
                  value={value}
                  onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 123456789012345"
                  className="flex-1 font-mono"
                />
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="gap-1 bg-green-600 hover:bg-green-700"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setValue(account.meta_business_id || '');
                    setEditMode(false);
                    setError(null);
                  }}
                  className="gap-1"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Find this in Meta Business Settings or Commerce Manager. Use digits only.
              </p>
            </div>
            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium font-mono break-all">
                {account.meta_business_id || 'Not configured'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Add this once, then the Catalog page can list and create Meta product catalogs.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditMode(true)}
              className="gap-1 shrink-0"
            >
              <Edit2 className="w-4 h-4" />
              {account.meta_business_id ? 'Edit' : 'Add ID'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function WhatsAppSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [settingsTab, setSettingsTab] = useState<WaSettingsTab>(() => normalizeWaTab(searchParams.get('wa_tab')));
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [workspaceFetchError, setWorkspaceFetchError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [migratingResources, setMigratingResources] = useState(false);
  const [healthReport, setHealthReport] = useState<AccountHealthReport | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [fixActionLoading, setFixActionLoading] = useState<string | null>(null);
  const [fixActionMessage, setFixActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const account = accounts[0]; // Primary account

  // Owner-authenticated adapter for the shared AgentsManager UI. Created once so
  // its stable identity doesn't retrigger the manager's data-loading effect.
  const ownerAgentApi = useMemo(() => makeOwnerAgentApi(), []);

  // Payments tab (PayU) is gated to the internal SocioChat tenant — the backend
  // reports availability so white-label tenants never see the tab.
  const [paymentsAvailable, setPaymentsAvailable] = useState(false);
  const { isFeatureEnabled } = usePlan();  // feature gating (agent_login / commerce_payment)
  useEffect(() => {
    let alive = true;
    apiClient.get('/whatsapp/commerce/payment-config')
      .then((res) => { if (alive && res.ok && res.data?.success) setPaymentsAvailable(!!res.data.available); })
      .catch(() => { /* leave hidden on error */ });
    return () => { alive = false; };
  }, []);

  const sendPermissionCheck = healthReport?.checks?.find((c) => c.name === 'messaging_send_permission');
  const webhookSubscriptionCheck = healthReport?.checks?.find((c) => c.name === 'webhook_subscription');
  // Access-token check: goes critical when the token is invalid/expired (Meta code 190).
  // The reconnect CTA must surface for THIS too — an expired token is exactly when the
  // user needs to re-supply a System User token, but the CTA previously only showed for
  // send-permission / webhook failures, so an expired-token account saw no reconnect button.
  const accessTokenCheck = healthReport?.checks?.find((c) => c.name === 'access_token');
  const sendPermissionHints = (sendPermissionCheck?.details?.hints as string[] | undefined) || [];

  // Get base path from current location (agent or dashboard)
  const basePath = location.pathname.startsWith('/agent') ? '/agent' : '/dashboard';

  useEffect(() => {
    setSettingsTab(normalizeWaTab(searchParams.get('wa_tab')));
  }, [searchParams]);

  const handleSettingsTabChange = (value: string) => {
    const next = normalizeWaTab(value);
    setSettingsTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === 'general') {
      params.delete('wa_tab');
    } else {
      params.set('wa_tab', next);
    }
    const qs = params.toString();
    navigate({ pathname: location.pathname, search: qs ? `?${qs}` : '' }, { replace: true });
  };

  const [popupState, setPopupState] = useState<{
    isOpen: boolean;
    variant: 'connect' | 'unlink' | 'delete' | 'error';
    title?: string;
    subtitle?: string;
    accountName?: string;
    accountNumber?: string;
    onClosed?: () => void;
  }>({
    isOpen: false,
    variant: 'connect'
  });

  const handlePopupTrigger = (
    variant: 'connect' | 'unlink' | 'delete' | 'error',
    title: string,
    subtitle: string,
    accountName?: string,
    accountNumber?: string,
    onClosed?: () => void
  ) => {
    setPopupState({
      isOpen: true,
      variant,
      title,
      subtitle,
      accountName,
      accountNumber,
      onClosed
    });
    if (variant === 'connect') {
      requestWhatsAppAccountStatusPopup(workspaceId || undefined);
    }
  };

  const handlePopupClose = () => {
    const callback = popupState.onClosed;
    setPopupState(prev => ({ ...prev, isOpen: false }));
    if (callback) {
      callback();
    }
  };

  // Fetch workspaces (monolith :5000 / devtunnel -5000) — must finish or timeout so UI is not stuck
  useEffect(() => {
    let cancelled = false;

    const fetchWorkspaces = async () => {
      setLoadingWorkspaces(true);
      setWorkspaceFetchError(null);

      try {
        let user: { id?: string | number } | null = null;
        try {
          const meRes = await fetchWithTimeout(
            `${API_BASE}/api/me`,
            { credentials: 'include' },
            20_000,
          );
          if (meRes.ok) {
            user = await meRes.json();
          }
        } catch (e) {
          console.warn('Could not fetch user from /api/me', e);
        }

        if (!user?.id) {
          const userStr = localStorage.getItem('sv_user') || sessionStorage.getItem('sv_user');
          user = userStr ? JSON.parse(userStr) : null;
        }

        if (!user?.id) {
          if (!cancelled) {
            setWorkspaceFetchError('Please log in to view settings.');
            setError('Please log in to view settings');
          }
          return;
        }

        const wsUrl = `${API_BASE}/api/workspaces?user_id=${encodeURIComponent(String(user.id))}`;
        const response = await fetchWithTimeout(wsUrl, { credentials: 'include' }, 25_000);

        if (!response.ok) {
          const errText = await response.text().catch(() => '');
          console.error('Workspaces fetch failed:', response.status, errText);
          if (!cancelled) {
            const msg =
              response.status === 502 || response.status === 503
                ? 'Backend unavailable (502). Start the monolith on port 5000 and ensure devtunnel port 5000 is forwarded.'
                : `Failed to load workspaces (${response.status}).`;
            setWorkspaceFetchError(msg);
            setError(msg);
          }
          return;
        }

        const data = await response.json();
        const rawList = data.workspaces ?? data.workspace ?? [];
        const list = Array.isArray(rawList) ? rawList : rawList ? [rawList] : [];
        const mapped: Workspace[] = list
          .map((w: { id?: string | number; workspace_id?: string | number; business_name?: string; name?: string }) => ({
            id: String(w.id ?? w.workspace_id ?? ''),
            name: w.business_name || w.name || `Workspace ${w.id ?? w.workspace_id ?? ''}`,
          }))
          .filter((w: Workspace) => w.id);

        if (cancelled) return;

        setWorkspaces(mapped);
        const storedWsId = getWorkspaceId();
        if (storedWsId && mapped.some((w) => String(w.id) === String(storedWsId))) {
          setWorkspaceId(storedWsId);
        } else if (mapped.length > 0) {
          setWorkspaceId(mapped[0].id);
          setStoredWorkspaceId(mapped[0].id);
        } else {
          setWorkspaceFetchError('No workspaces found for this account.');
        }
      } catch (err) {
        console.error('Error fetching workspaces:', err);
        if (cancelled) return;
        const msg =
          err instanceof FetchTimeoutError
            ? 'Workspaces request timed out. Check monolith on port 5000 and devtunnel -5000.'
            : 'Failed to load workspaces. Is the backend (port 5000) running?';
        setWorkspaceFetchError(msg);
        setError(msg);
      } finally {
        if (!cancelled) {
          setLoadingWorkspaces(false);
          const stored = getWorkspaceId();
          if (stored && !workspaceId) {
            setWorkspaceId(stored);
          }
        }
      }
    };

    void fetchWorkspaces();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAccounts = async (silent = false) => {
    if (!workspaceId) {
      if (!silent) setLoading(false);
      return;
    }
    try {
      if (!silent) setLoading(true);
      const result = await getWhatsAppAccounts(workspaceId);
      setAccounts(result.accounts || []);
      if (!result.success && !silent) {
        setError('Failed to load WhatsApp account (whatsapp-service on port 5005).');
      }
    } catch (err) {
      setError('Failed to load WhatsApp account');
      console.error('Error fetching accounts:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleRetryWebhookSubscription = async () => {
    if (!account?.id) return;
    setFixActionLoading('webhook');
    setFixActionMessage(null);
    try {
      const wsId = getWorkspaceId() || workspaceId || '';
      const result = await retryWebhook(account.id, wsId);
      if (result?.success) {
        setFixActionMessage({
          type: 'success',
          text: result.message || 'Webhook subscription retry completed.',
        });
        await runHealthCheck(false);
      } else {
        setFixActionMessage({
          type: 'error',
          text: result?.error || result?.subscribe_result?.error?.message || 'Webhook retry failed.',
        });
      }
    } catch {
      setFixActionMessage({ type: 'error', text: 'Network error while retrying webhook subscription.' });
    } finally {
      setFixActionLoading(null);
    }
  };

  const runHealthCheck = async (autoFix = false) => {
    if (!account?.id) return;
    setHealthLoading(true);
    setHealthError(null);

    try {
      const response = await fetch(`${WHATSAPP_REST_API_PREFIX}/accounts/${account.id}/full-health-check`, {
        method: autoFix ? 'POST' : 'GET',
        credentials: 'include',
      });
      const data = await response.json();

      if (!response.ok || data?.success === false) {
        setHealthError(data?.error || 'Failed to run health check');
        setHealthReport(null);
        return;
      }

      setHealthReport(data as AccountHealthReport);
      if (autoFix) {
        fetchAccounts(true);
      }
    } catch (err) {
      console.error('Health check failed:', err);
      setHealthError('Failed to run health check');
      setHealthReport(null);
    } finally {
      setHealthLoading(false);
    }
  };

  const migrateResourcesToCurrentAccount = async (accountId: number) => {
    if (migratingResources) return;

    setMigratingResources(true);
    try {
      // Step 1: preview migration impact
      const previewRes = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/accounts/${accountId}/migrate-resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dry_run: true, include_active_sources: false }),
      });
      const previewData = await previewRes.json();

      if (!previewRes.ok || previewData.success === false) {
        alert(`Migration preview failed: ${previewData.error || 'Unknown error'}`);
        return;
      }

      const summary = previewData.summary || {};
      const templateCount = summary.templates?.migrated || 0;
      const flowCount = summary.flows?.migrated || 0;
      const triggerCount = summary.triggers?.migrated || 0;
      const ruleCount = summary.automation_rules?.migrated || 0;
      const visualCount = summary.visual_automations?.migrated || 0;
      const faqCount = summary.faqs?.migrated || 0;
      const dripCount = summary.drip_campaigns?.migrated || 0;

      const confirmed = window.confirm(
        `Migration Preview (from old/unlinked accounts):\n\n` +
        `Templates: ${templateCount}\n` +
        `Flows: ${flowCount}\n` +
        `Triggers: ${triggerCount}\n` +
        `Automation Rules: ${ruleCount}\n` +
        `Interactive Automations: ${visualCount}\n` +
        `FAQs: ${faqCount}\n` +
        `Drip Campaigns: ${dripCount}\n\n` +
        `Do you want to migrate these resources to the current linked account now?`
      );

      if (!confirmed) return;

      // Step 2: execute migration
      const runRes = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/accounts/${accountId}/migrate-resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ dry_run: false, include_active_sources: false }),
      });
      const runData = await runRes.json();

      if (!runRes.ok || runData.success === false) {
        alert(`Migration failed: ${runData.error || 'Unknown error'}`);
        return;
      }

      alert('Migration completed successfully. Resources from old unlinked accounts were aligned to this account.');
      fetchAccounts(true);
    } catch (err) {
      console.error('Resource migration failed:', err);
      alert('Migration failed due to a network/server error.');
    } finally {
      setMigratingResources(false);
    }
  };

  useEffect(() => {
    if (workspaceId) {
      fetchAccounts();
    }

    if (searchParams.get('connected') === 'true') {
      setTimeout(() => {
        if (workspaceId) {
          fetchAccounts();
        }
      }, 1000);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('connected');
      const qs = newParams.toString();
      navigate({ pathname: location.pathname, search: qs ? `?${qs}` : '' }, { replace: true });
    }
  }, [workspaceId, searchParams, navigate, location.pathname]);

  // Diagnostics are intentionally manual-only (run on user click).
  useEffect(() => {
    setHealthReport(null);
    setHealthError(null);
  }, [account?.id]);

  // Sync account status
  const handleSync = async () => {
    setSyncing(true);
    await fetchAccounts(true); // Silent sync
    setTimeout(() => setSyncing(false), 500);
  };

  // Get quality badge color
  const getQualityColor = (quality: string | null) => {
    if (!quality) return 'bg-gray-100 text-gray-600';
    const q = quality.toLowerCase();
    if (q === 'green' || q === 'high') return 'bg-green-100 text-green-700';
    if (q === 'yellow' || q === 'medium') return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  // Format phone number for display
  const formatPhone = (phone: string | null) => {
    if (!phone) return 'No phone number';
    // Already formatted
    if (phone.includes(' ') || phone.includes('-')) return phone;
    // Add formatting for Indian numbers
    if (phone.startsWith('+91') && phone.length >= 13) {
      return `+91 ${phone.slice(3, 8)} ${phone.slice(8)}`;
    }
    return phone;
  };

  const getStatusBadgeClass = (status?: string) => {
    switch ((status || '').toLowerCase()) {
      case 'healthy':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'critical':
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getCheckCardClass = (status?: string) => {
    const base = 'rounded-lg border p-4 transition-all';
    const normalized = (status || '').toLowerCase();

    if (normalized === 'critical' || normalized === 'error') {
      return `${base} border-red-300 bg-red-50 shadow-[0_0_0_2px_rgba(239,68,68,0.25)] animate-pulse`;
    }
    if (normalized === 'warning') {
      return `${base} border-amber-300 bg-amber-50`;
    }
    if (normalized === 'healthy') {
      return `${base} border-emerald-200 bg-emerald-50/60`;
    }
    return `${base} border-gray-200 bg-gray-50`;
  };

  const formatDetailValue = (value: unknown) => {
    if (value === null || value === undefined || value === '') return 'n/a';
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  };

  // Show dashboard if we have ANY account, even if inactive (so user can re-link)
  const isConnected = accounts.length > 0;
  const workspaceName = workspaces.find(w => String(w.id) === String(workspaceId))?.name;

  // Store active account ID when accounts are loaded
  useEffect(() => {
    if (account?.id && account?.is_active) {
      setStoredAccountId(account.id);
      console.log('[WhatsAppSettings] Stored active account:', account.id);
    }
  }, [account?.id, account?.is_active]);

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50/30">
      <div className="w-full px-6 py-6">

        {/* Simple Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-lg">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">WhatsApp Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your WhatsApp Business connection</p>
            </div>
          </div>

          {/* Workspace indicator */}
          {workspaceName && (
            <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
              <Building2 className="w-4 h-4" />
              <span>Workspace: <strong className="text-foreground">{workspaceName}</strong></span>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State — only while bootstrapping; never block forever on pending API */}
        {loadingWorkspaces && workspaces.length === 0 && !workspaceFetchError && (
          <SettingsLoadingScreen />
        )}
        {loading && !loadingWorkspaces && workspaceId && (
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading WhatsApp account…
          </div>
        )}
        {workspaceFetchError && workspaces.length === 0 && (
          <div className="mb-6 p-4 bg-amber-50 text-amber-900 rounded-xl border border-amber-200">
            <p className="font-medium mb-1">Could not load workspaces</p>
            <p className="text-sm">{workspaceFetchError}</p>
            <p className="text-xs mt-2 text-amber-800">
              Dev setup: UI on tunnel <strong>8080</strong>, monolith on <strong>5000</strong>, WhatsApp API on{' '}
              <strong>5005</strong>. Start both backends and forward all three ports.
            </p>
          </div>
        )}

        {/* ============================================================ */}
        {/* NOT CONNECTED STATE */}
        {/* ============================================================ */}
        {!loading && !loadingWorkspaces && !isConnected && (
          <Card className="border-0 shadow-xl bg-white overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-[#25D366] via-[#128C7E] to-[#25D366]" />
            <CardContent className="py-16 px-8 text-center">
              {/* Illustration */}
              <div className="relative mx-auto w-32 h-32 mb-8">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#25D366]/20 to-[#128C7E]/20 animate-pulse" />
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-[#25D366]/30 to-[#128C7E]/30" />
                <div className="absolute inset-8 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center shadow-lg">
                  <MessageCircle className="w-8 h-8 text-white" />
                </div>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Connect Your WhatsApp Business
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-8">
                Link your WhatsApp Business Account to start sending messages,
                managing templates, and engaging with your customers.
              </p>

              <Button
                size="lg"
                onClick={() => navigate(`${basePath}/whatsapp/setup`)}
                className="bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#128C7E] hover:to-[#075E54] text-white gap-2 px-8 shadow-lg"
              >
                <Zap className="w-5 h-5" />
                Get Started
              </Button>

              {/* Benefits */}
              <div className="mt-12 grid sm:grid-cols-3 gap-6 text-left max-w-2xl mx-auto">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-green-100 shrink-0">
                    <Send className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Send Messages</p>
                    <p className="text-xs text-muted-foreground">Templates & broadcasts</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 shrink-0">
                    <Inbox className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Unified Inbox</p>
                    <p className="text-xs text-muted-foreground">All chats in one place</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 shrink-0">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Analytics</p>
                    <p className="text-xs text-muted-foreground">Track performance</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================================ */}
        {/* CONNECTED STATE */}
        {/* ============================================================ */}
        {!loading && !loadingWorkspaces && isConnected && account && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Sidebar - Navigation */}
            <div className="lg:col-span-3 space-y-6">
              <Card className="border shadow-sm bg-slate-50/50">
                <CardContent className="p-3">
                  <p className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Menu</p>
                  <div className="space-y-1">
                    <button
                      onClick={() => navigate(`${basePath}/whatsapp/inbox`)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-left group"
                    >
                      <div className="p-1.5 rounded-md bg-green-100 group-hover:bg-green-200 transition-colors">
                        <Inbox className="w-4 h-4 text-green-700" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">Inbox</span>
                    </button>

                    <button
                      onClick={() => navigate(`${basePath}/whatsapp/templates`)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-left group"
                    >
                      <div className="p-1.5 rounded-md bg-blue-100 group-hover:bg-blue-200 transition-colors">
                        <FileText className="w-4 h-4 text-blue-700" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">Templates</span>
                    </button>

                    <button
                      onClick={() => navigate(`${basePath}/whatsapp/bulk`)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-left group"
                    >
                      <div className="p-1.5 rounded-md bg-purple-100 group-hover:bg-purple-200 transition-colors">
                        <BarChart3 className="w-4 h-4 text-purple-700" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">Bulk Messages</span>
                    </button>

                    <button
                      onClick={() => navigate(`${basePath}/whatsapp/automation`)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-left group"
                    >
                      <div className="p-1.5 rounded-md bg-orange-100 group-hover:bg-orange-200 transition-colors">
                        <Zap className="w-4 h-4 text-orange-700" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">Automation</span>
                    </button>

                    <button
                      onClick={() => navigate(`${basePath}/whatsapp/interactive-automation`)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-left group"
                    >
                      <div className="p-1.5 rounded-md bg-orange-100 group-hover:bg-orange-200 transition-colors">
                        <Bot className="w-4 h-4 text-orange-700" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">Conversational Flows</span>
                    </button>

                    <button
                      onClick={() => navigate(`${basePath}/whatsapp/flows`)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-left group"
                    >
                      <div className="p-1.5 rounded-md bg-emerald-100 group-hover:bg-emerald-200 transition-colors">
                        <ClipboardList className="w-4 h-4 text-emerald-700" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">WhatsApp Forms</span>
                    </button>

                    <button
                      onClick={() => navigate(`${basePath}/whatsapp/coexistence`)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-left group"
                    >
                      <div className="p-1.5 rounded-md bg-teal-100 group-hover:bg-teal-200 transition-colors">
                        <Phone className="w-4 h-4 text-teal-700" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">Coexistence</span>
                    </button>

                    <button
                      onClick={() => navigate(`${basePath}/whatsapp/setup?manual=1`)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white hover:shadow-sm transition-all text-left group"
                    >
                      <div className="p-1.5 rounded-md bg-amber-100 group-hover:bg-amber-200 transition-colors">
                        <RefreshCw className="w-4 h-4 text-amber-700" />
                      </div>
                      <span className="text-sm font-medium text-slate-700">Update / Permanent Token</span>
                    </button>
                  </div>
                </CardContent>
              </Card>

              {/* Help Card in sidebar */}
              <Card className="border shadow-sm bg-gradient-to-br from-gray-50 to-white">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-muted-foreground" />
                      <p className="font-medium text-sm">Need help?</p>
                    </div>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => navigate(`${basePath}/whatsapp/guide`)}>
                      <ExternalLink className="w-3 h-3" />
                      View Guide
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Content */}
            <div className="lg:col-span-9 space-y-6">
              <Tabs value={settingsTab} onValueChange={handleSettingsTabChange} className="w-full">
                <TabsList className="mb-4 bg-white border shadow-sm">
                  <TabsTrigger value="general">General</TabsTrigger>
                  <TabsTrigger value="verification">Verification Center</TabsTrigger>
                  <TabsTrigger value="trust">Trust Timeline</TabsTrigger>
                  <TabsTrigger value="operator">Operator Tools</TabsTrigger>
                  {isFeatureEnabled('agent_login') && <TabsTrigger value="agents">Agents</TabsTrigger>}
                  {isJomWorkspace(workspaceId) && <TabsTrigger value="departments">Departments</TabsTrigger>}
                  {paymentsAvailable && isFeatureEnabled('commerce_payment') && <TabsTrigger value="payments">Payments</TabsTrigger>}
                </TabsList>
                {isWaOpsQaNavVisible(location.search) && (
                  <Alert className="mb-4 border-dashed border-amber-300 bg-amber-50/80">
                    <AlertTitle className="text-sm">Phase 7–9 QA shortcuts</AlertTitle>
                    <AlertDescription className="text-xs space-y-2 pt-1">
                      <p className="text-muted-foreground">
                        Stable deep links (also work when pasted). Enable this panel in staging with{' '}
                        <code className="rounded bg-white px-1">?wa_qa=1</code> or{' '}
                        <code className="rounded bg-white px-1">localStorage.sociovia_wa_ops_nav = &quot;1&quot;</code>.
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <RouterLink className="text-primary underline" to={`${basePath}/whatsapp/ops/onboarding`}>
                          Onboarding lifecycle
                        </RouterLink>
                        <RouterLink className="text-primary underline" to={`${basePath}/whatsapp/ops/verification`}>
                          Verification center
                        </RouterLink>
                        <RouterLink className="text-primary underline" to={`${basePath}/whatsapp/ops/trust`}>
                          Trust center
                        </RouterLink>
                        <RouterLink className="text-primary underline" to={`${basePath}/whatsapp/ops/operator`}>
                          Operational health
                        </RouterLink>
                        <RouterLink className="text-primary underline" to={`${basePath}/whatsapp/ops/warmup`}>
                          Warmup / safe mode (operator)
                        </RouterLink>
                        <RouterLink className="text-primary underline" to={`${basePath}/whatsapp/automation`}>
                          Restriction banner (automation)
                        </RouterLink>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                
                <TabsContent value="general" className="space-y-6 mt-0">
              {/* Account Status Card */}
              <WhatsAppAccountCard
                account={account}
                onUpdate={() => fetchAccounts(true)}
                onSync={handleSync}
                isSyncing={syncing}
                onPopupTrigger={handlePopupTrigger}
              />

              <MetaBusinessIdSection
                account={account}
                onSaved={() => fetchAccounts(true)}
              />

              {/* Facebook Ads connection (Ad Account + Page) — required for Status/CTWA ads */}
              <ConnectFacebookAdsCard />

              {/* One-time ad account setup — pick Ad Account + Page + Number per workspace */}
              <AdAccountSettingsCard />

              {/* Notification Settings */}
              <NotificationSettingsSection accountId={account.id} workspaceId={workspaceId} />

              {/* Connection Details (Collapsible) */}
              <Card className="border shadow-sm bg-white">
                <CardHeader
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Settings className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <CardTitle className="text-base">Connection Details</CardTitle>
                        <CardDescription className="text-sm">Technical information for advanced users</CardDescription>
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>

                {showAdvanced && (
                  <CardContent className="border-t pt-6">
                    <div className="space-y-4">
                      {/* WhatsApp Health & Error Diagnostics */}
                      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-sm flex items-center gap-2">
                              <Shield className="w-4 h-4 text-slate-700" />
                              WhatsApp Health & Error Diagnostics
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Checks token validity, webhook subscription, phone status, and Meta-side errors before messaging starts.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => runHealthCheck(false)}
                              disabled={healthLoading}
                              className="gap-2"
                            >
                              {healthLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                              Run Check
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => runHealthCheck(true)}
                              disabled={healthLoading}
                              className="gap-2 bg-slate-900 hover:bg-slate-800 text-white"
                            >
                              {healthLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                              Auto-Fix & Recheck
                            </Button>
                          </div>
                        </div>

                        {healthError && (
                          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2 shadow-[0_0_0_2px_rgba(239,68,68,0.2)] animate-pulse">
                            <AlertCircle className="w-4 h-4 mt-0.5" />
                            <span>{healthError}</span>
                          </div>
                        )}

                        {healthReport && (
                          <>
                            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(healthReport.overall_status)}`}>
                                {healthReport.overall_status === 'healthy' ? 'Status OK' : `Status ${healthReport.overall_status.toUpperCase()}`}
                              </span>
                              {healthReport.checked_at && (
                                <span className="text-xs text-muted-foreground">
                                  Checked at: {new Date(healthReport.checked_at).toLocaleString()}
                                </span>
                              )}
                              {!!healthReport.auto_fixes_applied && (
                                <span className="text-xs text-emerald-700 font-medium">
                                  Auto fixes applied: {healthReport.auto_fixes_applied}
                                </span>
                              )}
                            </div>

                            {!!healthReport.action_required && (
                              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                                <span className="font-medium">Action required:</span> {healthReport.action_required}
                              </div>
                            )}

                            {(accessTokenCheck?.status === 'critical' ||
                              sendPermissionCheck?.status === 'critical' ||
                              webhookSubscriptionCheck?.status === 'critical' ||
                              webhookSubscriptionCheck?.status === 'warning') && (
                              <div className="rounded-lg border border-red-200 bg-red-50/80 p-4 space-y-3">
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                                  <div>
                                    <p className="font-semibold text-sm text-red-900">Fix connection issues</p>
                                    <p className="text-sm text-red-800 mt-1">
                                      Facebook Login stores a personal user token. Partner WABAs (Trusthomes) require a{' '}
                                      <strong>System User</strong> token from Sociovia Business Manager to send messages and
                                      manage webhooks.
                                    </p>
                                  </div>
                                </div>

                                {sendPermissionCheck?.message && (
                                  <p className="text-xs text-red-700 font-mono bg-white/70 rounded px-2 py-1.5 border border-red-100">
                                    {sendPermissionCheck.message}
                                  </p>
                                )}

                                {sendPermissionHints.length > 0 && (
                                  <ol className="list-decimal list-inside text-sm text-red-900 space-y-1">
                                    {sendPermissionHints.map((hint, i) => (
                                      <li key={i}>{hint}</li>
                                    ))}
                                  </ol>
                                )}

                                <div className="flex flex-wrap gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    className="bg-red-700 hover:bg-red-800 text-white"
                                    onClick={() => navigate(`${basePath}/whatsapp/setup?manual=1`)}
                                  >
                                    Reconnect with System User token
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-300"
                                    onClick={handleRetryWebhookSubscription}
                                    disabled={fixActionLoading === 'webhook'}
                                  >
                                    {fixActionLoading === 'webhook' ? (
                                      <RefreshCw className="w-4 h-4 animate-spin mr-1" />
                                    ) : null}
                                    Retry webhook subscription
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => runHealthCheck(false)}
                                    disabled={healthLoading}
                                  >
                                    Re-run health check
                                  </Button>
                                </div>

                                {fixActionMessage && (
                                  <p
                                    className={`text-xs ${fixActionMessage.type === 'success' ? 'text-emerald-800' : 'text-red-800'}`}
                                  >
                                    {fixActionMessage.text}
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="space-y-3">
                              {healthReport.checks?.map((check) => {
                                const detailEntries = Object.entries(check.details || {});
                                return (
                                  <div key={check.name} className={getCheckCardClass(check.status)}>
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                      <div className="font-medium text-sm capitalize">{check.name.replace(/_/g, ' ')}</div>
                                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getStatusBadgeClass(check.status)}`}>
                                        {check.status.toUpperCase()}
                                      </span>
                                    </div>

                                    <p className="text-sm text-slate-700">{check.message}</p>

                                    {!!detailEntries.length && (
                                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {detailEntries.map(([key, value]) => (
                                          <div key={`${check.name}-${key}`} className="rounded border border-slate-200 bg-white px-2 py-1.5">
                                            <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{key}</div>
                                            <div className="text-xs font-mono break-all text-slate-700">{formatDetailValue(value)}</div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {check.fix_result && (
                                      <div className={`mt-3 rounded border px-2.5 py-2 text-xs ${check.fix_result.success ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                                        <span className="font-semibold">Auto-fix:</span> {check.fix_result.message || (check.fix_result.success ? 'Applied' : 'Failed')}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}

                        {!healthError && !healthReport && (
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                            Click Run Check to view all Meta-side and account-side issues.
                          </div>
                        )}
                      </div>

                      {/* Account Details */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Business Account ID (WABA ID)</p>
                          <p className="font-mono text-sm select-all">{account.waba_id}</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Phone Number ID</p>
                          <p className="font-mono text-sm select-all">{account.phone_number_id}</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Token Type</p>
                          <p className="font-medium text-sm capitalize">{account.token_type || 'Permanent'}</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-xs text-muted-foreground mb-1">Connected On</p>
                          <p className="font-medium text-sm">
                            {new Date(account.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Debug Token Section */}
                      <DebugTokenSection accountId={account.id} />

                      {/* Permissions Summary */}
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield className="w-4 h-4 text-blue-600" />
                          <p className="font-medium text-sm text-blue-900">Granted Permissions</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {['Send Messages', 'Manage Templates', 'View Analytics', 'Receive Webhooks'].map((perm) => (
                            <span key={perm} className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded text-xs border border-blue-200">
                              <CheckCircle className="w-3 h-3 text-green-500" />
                              {perm}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-4 border-t space-y-4">
                        {/* Resource Migration (old account -> current) */}
                        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-100">
                              <RefreshCw className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-blue-900">Align Resources to Current Account</p>
                              <p className="text-xs text-blue-700/90">
                                Migrates templates, flows, triggers, automations, FAQs, and drip campaigns from old unlinked accounts.
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={migratingResources || processingAction}
                            onClick={() => migrateResourcesToCurrentAccount(account.id)}
                            className="border-blue-300 text-blue-700 hover:bg-blue-100 gap-2"
                          >
                            {migratingResources ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            {migratingResources ? 'Migrating...' : 'Preview & Migrate'}
                          </Button>
                        </div>

                        {/* Unlink/Link Toggle */}
                        <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg border border-amber-200">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${account.is_active ? 'bg-amber-100' : 'bg-gray-100'}`}>
                              {account.is_active ? <Pause className="w-4 h-4 text-amber-600" /> : <Play className="w-4 h-4 text-green-600" />}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {account.is_active ? 'Unlink Account' : 'Link Account'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {account.is_active
                                  ? 'Pause all messaging, templates & flows'
                                  : 'Resume account activity'}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={processingAction}
                            onClick={async () => {
                              if (processingAction) return;

                              // Show confirmation for Unlink action
                              if (account.is_active) {
                                if (!confirm('Are you sure you want to unlink this account? All messaging, templates, and flows will be paused until you link it again.')) {
                                  return;
                                }
                              }

                              setProcessingAction(true);
                              try {
                                const res = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/accounts/${account.id}/toggle-status`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({ is_active: !account.is_active })
                                });
                                if (res.ok) {
                                  // Show unlink animation popup
                                  if (account.is_active) {
                                    handlePopupTrigger(
                                      'unlink',
                                      'Account Unlinked',
                                      'All messaging has been paused. You can link it again anytime.',
                                      account.verified_name || 'WhatsApp Business',
                                      account.display_phone_number || undefined,
                                      () => fetchAccounts()
                                    );
                                  } else {
                                    // Show connect animation for linking
                                    handlePopupTrigger(
                                      'connect',
                                      'Account Linked',
                                      'Your WhatsApp account is now active and ready to use.',
                                      account.verified_name || 'WhatsApp Business',
                                      account.display_phone_number || undefined,
                                      () => fetchAccounts()
                                    );
                                  }
                                }
                              } catch (err) {
                                console.error('Failed to toggle account status:', err);
                              } finally {
                                setProcessingAction(false);
                              }
                            }}
                            className={account.is_active
                              ? 'border-amber-300 text-amber-700 hover:bg-amber-100 gap-2'
                              : 'border-green-300 text-green-700 hover:bg-green-100 gap-2'
                            }
                          >
                            {processingAction ? <RefreshCw className="w-4 h-4 animate-spin" /> : (account.is_active ? <Link2Off className="w-4 h-4" /> : <Link className="w-4 h-4" />)}
                            {account.is_active ? 'Unlink' : 'Link'}
                          </Button>
                        </div>

                        {/* Delete Account - Danger Zone */}
                        <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-100">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-red-900">Delete Account</p>
                              <p className="text-xs text-red-600/80">
                                Permanently remove account and all conversation data
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={processingAction}
                            onClick={async () => {
                              if (processingAction) return;

                              if (!confirm('Are you sure? This will delete all conversations, messages, and data for this account. This action cannot be undone.')) {
                                return;
                              }

                              setProcessingAction(true);
                              const accountName = account.verified_name || 'WhatsApp Business';
                              const accountNumber = account.display_phone_number || undefined;
                              try {
                                const res = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/accounts/${account.id}`, {
                                  method: 'DELETE',
                                  credentials: 'include'
                                });
                                const payload = await res.json().catch(() => ({}));
                                if (res.ok && payload?.success !== false) {
                                  // Show delete animation popup
                                  handlePopupTrigger(
                                    'delete',
                                    'Account Deleted',
                                    'All account data has been permanently removed.',
                                    accountName,
                                    accountNumber,
                                    () => fetchAccounts()
                                  );
                                } else {
                                  const errorMessage = payload?.error || 'Failed to delete account';
                                  alert(`Delete failed: ${errorMessage}`);
                                }
                              } catch (err) {
                                console.error('Failed to delete account:', err);
                                alert('Delete failed due to a network/server error.');
                              } finally {
                                setProcessingAction(false);
                              }
                            }}
                            className="border-red-300 text-red-600 hover:bg-red-100 gap-2"
                          >
                            {processingAction ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Delete
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
                </TabsContent>

                <TabsContent value="verification" className="mt-0">
                  <VerificationCenter accountId={account.id} />
                </TabsContent>

                <TabsContent value="trust" className="mt-0">
                  <TrustCenter accountId={account.id} />
                </TabsContent>

                <TabsContent value="operator" className="mt-0">
                  <OperationalHealth accountId={account.id} />
                </TabsContent>

                {isFeatureEnabled('agent_login') && (
                  <TabsContent value="agents" className="mt-0">
                    <div className="mb-4">
                      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary" />
                        Agents
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Create and manage agent logins for your account.
                      </p>
                    </div>
                    <OwnerAgentsManager api={ownerAgentApi} />
                  </TabsContent>
                )}

                {isJomWorkspace(workspaceId) && (
                  <TabsContent value="departments" className="mt-0">
                    <div className="mb-4">
                      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary" />
                        Departments
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Destination-based routing. Incoming leads are matched by keyword to a department and auto-assigned (round-robin) to one of its agents.
                      </p>
                    </div>
                    {workspaceId && <DepartmentsManager workspaceId={workspaceId} />}
                  </TabsContent>
                )}

                {paymentsAvailable && isFeatureEnabled('commerce_payment') && (
                  <TabsContent value="payments" className="mt-0">
                    <PaymentsSettings />
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-muted-foreground/60 flex items-center justify-center gap-2">
            <img src={logo} alt="Sociovia" className="w-4 h-4 opacity-50" />
            Powered by Meta WhatsApp Business Platform
          </p>
        </div>
        <WhatsAppConnectSuccessPopup
          isOpen={popupState.isOpen}
          onClose={handlePopupClose}
          variant={popupState.variant}
          title={popupState.title}
          subtitle={popupState.subtitle}
          accountName={popupState.accountName}
          accountNumber={popupState.accountNumber}
          duration={3000} // Longer duration for connection flair
        />
      </div>
    </div>
  );
}
