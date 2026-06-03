// WhatsApp Settings Page
// ======================
// Redesigned: User-friendly settings page for non-technical users
// Follows multi-tenant SaaS patterns (Slack, HubSpot, Intercom style)

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getWhatsAppAccounts } from '../api';
import { WhatsAppAccountCard } from '../components/WhatsAppAccountCard';
import { OnboardingProgressPanel } from '../components/OnboardingProgressPanel';
import { isAccountFullyConnected } from '../constants/onboardingStatus';
import { SettingsLoadingScreen } from '../components/SettingsLoadingScreen';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AgentsManager from '@/agent_frontend/components/AgentsManager';
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
  HelpCircle
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import logo from '@/assets/sociovia_logo.png';
import { API_BASE_URL } from "@/config";
import { getNotificationSettings, updateNotificationSettings } from '@/whatsapp_automation/api/whatsappApi';
import { setStoredAccountId } from '../utils/accountContext';
// WhatsAppConnectSuccessPopup removed for standalone product

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
  display_phone_number: string | null;
  verified_name: string | null;
  quality_score: string | null;
  messaging_limit: number | null;
  token_type: string;
  is_active: boolean;
  onboarding_status?: string | null;
  onboarding_error?: string | null;
  is_coexistence?: boolean;
  mps_limit?: number;
  created_at: string;
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
      const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/debug`, {
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
              <p className="text-xs text-muted-foreground">Access Token</p>
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
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');
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
        if (result.success && result.notification_phone_number) {
          setNotificationPhone(result.notification_phone_number);
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
        notification_phone_number: editValue
      });
      if (result.success) {
        setNotificationPhone(result.notification_phone_number || '');
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
    setEditValue(notificationPhone);
    setEditMode(true);
    setError(null);
  };

  const handleCancel = () => {
    setEditMode(false);
    setEditValue('');
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
              Receive WhatsApp alerts about Meta/WhatsApp platform updates and account status
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
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="919876543210 (with country code, no +)"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value.replace(/[^0-9]/g, ''))}
                  className="flex-1 font-mono"
                />
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
              <p className="text-xs text-muted-foreground mt-1.5">
                Enter the phone number with country code (e.g., 919876543210 for India)
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
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {notificationPhone ? formatDisplayPhone(notificationPhone) : 'Not configured'}
                </p>
                {notificationPhone && (
                  <p className="text-xs text-muted-foreground">
                    Receives alerts about Meta updates & account status changes
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleEdit}
              className="gap-1"
            >
              <Edit2 className="w-4 h-4" />
              {notificationPhone ? 'Edit' : 'Add Number'}
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
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [workspaceNameInput, setWorkspaceNameInput] = useState('');
  const [updatingWorkspace, setUpdatingWorkspace] = useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);

  // Get base path from current location (agent or dashboard)
  const basePath = location.pathname.startsWith('/agent') ? '/agent' : '/dashboard';

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
  };

  const handlePopupClose = () => {
    const callback = popupState.onClosed;
    setPopupState(prev => ({ ...prev, isOpen: false }));
    if (callback) {
      callback();
    }
  };

  // Fetch workspaces
  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        // Check auth: try storage first (fastest), then verify with API
        let user = null;
        const userStr = localStorage.getItem('sv_user') || sessionStorage.getItem('sv_user');
        if (userStr) {
          try { user = JSON.parse(userStr); } catch { }
        }

        // If no stored user, try API (needs Bearer token from sv_token in apiClient)
        if (!user?.id) {
          try {
            const token = localStorage.getItem('sv_token') || sessionStorage.getItem('sv_token');
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const meRes = await fetch(`${API_BASE}/api/me`, {
              credentials: 'include',
              headers
            });
            if (meRes.ok) {
              const meData = await meRes.json();
              user = meData.user || meData;
              // Update storage
              if (user?.id) {
                localStorage.setItem('sv_user', JSON.stringify(user));
                localStorage.setItem('sv_user_id', String(user.id));
              }
            }
          } catch (e) {
            console.log('Could not fetch user from /api/me');
          }
        }

        if (!user?.id) {
          setError('Please log in to view settings');
          setLoadingWorkspaces(false);
          return;
        }

        // Fetch workspaces with auth
        const token = localStorage.getItem('sv_token') || sessionStorage.getItem('sv_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        const userId = localStorage.getItem('sv_user_id');
        if (userId) headers['X-User-Id'] = userId;

        const response = await fetch(`${API_BASE}/api/workspaces`, {
          credentials: 'include',
          headers
        });
        const data = await response.json();
        if (data.workspaces) {
          setWorkspaces(data.workspaces);
          const storedWsId = sessionStorage.getItem('sv_whatsapp_workspace_id') ||
            localStorage.getItem('sv_whatsapp_workspace_id');
          if (storedWsId && data.workspaces.some((w: Workspace) => String(w.id) === String(storedWsId))) {
            setWorkspaceId(storedWsId);
          } else if (data.workspaces.length > 0) {
            setWorkspaceId(data.workspaces[0].id);
            sessionStorage.setItem('sv_whatsapp_workspace_id', data.workspaces[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching workspaces:', err);
        setError('Failed to load workspaces');
      } finally {
        setLoadingWorkspaces(false);
      }
    };
    fetchWorkspaces();
  }, []);

  const fetchAccounts = async (silent = false) => {
    try {
      setError(null);
      if (!silent) setLoading(true);
      const result = await getWhatsAppAccounts(workspaceId || undefined);
      setAccounts(result.accounts || []);
    } catch (err) {
      setError('Failed to load WhatsApp account');
      console.error('Error fetching accounts:', err);
    } finally {
      if (!silent) setLoading(false);
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
      window.history.replaceState({}, '', `${window.location.pathname}?${newParams.toString()}`);
    }
  }, [workspaceId, searchParams]);

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

  const account = accounts[0]; // Primary account
  const hasAccount = accounts.length > 0;
  const isFullyConnected = isAccountFullyConnected(account);
  const isOnboardingInProgress = hasAccount && !isFullyConnected;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50/20">
      <div className="max-w-[1400px] mx-auto px-6 py-10">

        {/* Simple Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-lg">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">WhatsApp Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your WhatsApp Business connection</p>
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-full border shadow-sm bg-white"
                    onClick={() => navigate(`${basePath}/whatsapp/guide`)}
                  >
                    <HelpCircle className="w-5 h-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">Need help? View Guide</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Workspace indicator */}
          {workspaceName && (
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                <Building2 className="w-4 h-4 text-primary" />
                {editingWorkspace ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={workspaceNameInput}
                      onChange={(e) => setWorkspaceNameInput(e.target.value)}
                      className="h-7 w-48 text-xs"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      className="h-7 px-2 bg-green-600 hover:bg-green-700"
                      disabled={updatingWorkspace}
                      onClick={async () => {
                        if (!workspaceNameInput.trim()) return;
                        setUpdatingWorkspace(true);
                        try {
                          const token = localStorage.getItem('sv_token') || sessionStorage.getItem('sv_token');
                          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                          if (token) headers['Authorization'] = `Bearer ${token}`;
                          const userId = localStorage.getItem('sv_user_id');
                          if (userId) headers['X-User-Id'] = userId;

                          const res = await fetch(`${API_BASE}/api/workspaces/${workspaceId}`, {
                            method: 'PUT',
                            headers,
                            credentials: 'include',
                            body: JSON.stringify({ name: workspaceNameInput })
                          });
                          if (res.ok) {
                            setEditingWorkspace(false);
                            // Refresh workspaces to update UI everywhere
                            const response = await fetch(`${API_BASE}/api/workspaces`, {
                              credentials: 'include',
                              headers
                            });
                            const data = await response.json();
                            if (data.workspaces) setWorkspaces(data.workspaces);
                          }
                        } catch (err) {
                          console.error('Failed to update workspace name:', err);
                        } finally {
                          setUpdatingWorkspace(false);
                        }
                      }}
                    >
                      {updatingWorkspace ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setEditingWorkspace(false)}
                      disabled={updatingWorkspace}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span>Workspace: <strong className="text-foreground">{workspaceName}</strong></span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-1 text-muted-foreground hover:text-primary"
                            onClick={() => {
                              setWorkspaceNameInput(workspaceName);
                              setEditingWorkspace(true);
                            }}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit workspace name</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}
              </div>
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

        {/* Loading State */}
        {(loading || loadingWorkspaces) && (
          <SettingsLoadingScreen />
        )}

        {/* ============================================================ */}
        {/* NOT CONNECTED STATE */}
        {/* ============================================================ */}
        {!loading && !loadingWorkspaces && !hasAccount && (
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

              {/* Coexistence Mode Callout */}
              <div className="mt-10 p-6 bg-blue-50 rounded-xl border border-blue-200 max-w-lg mx-auto">
                <div className="flex items-center gap-3 mb-2">
                  <Phone className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-sm text-blue-900">Already using WhatsApp Business App?</h3>
                </div>
                <p className="text-xs text-blue-700 mb-4">
                  Connect your existing WhatsApp Business App account to use it alongside
                  SocioChat. Keep your phone active while automating messages through Cloud API.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`${basePath}/whatsapp/setup?mode=coexistence`)}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Connect Existing Account
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ============================================================ */}
        {/* ONBOARDING IN PROGRESS */}
        {/* ============================================================ */}
        {!loading && !loadingWorkspaces && isOnboardingInProgress && account && workspaceId && (
          <div className="space-y-6">
            <OnboardingProgressPanel
              workspaceId={workspaceId}
              account={account}
              onUpdate={() => fetchAccounts(true)}
            />
            <WhatsAppAccountCard
              account={account}
              onUpdate={() => fetchAccounts(true)}
              onSync={handleSync}
              isSyncing={syncing}
              onPopupTrigger={handlePopupTrigger}
              onRelink={() => {
                document.querySelector('[data-reconnect-whatsapp]')?.scrollIntoView({ behavior: 'smooth' });
                (document.querySelector('[data-reconnect-whatsapp]') as HTMLButtonElement)?.click()
                  || (document.querySelector('[data-connect-whatsapp]') as HTMLButtonElement)?.click();
              }}
            />
          </div>
        )}

        {/* ============================================================ */}
        {/* CONNECTED STATE */}
        {/* ============================================================ */}
        {!loading && !loadingWorkspaces && isFullyConnected && account && (
          <div className="space-y-6">
            {/* Account Status Card */}

            {/* Account Status Card */}
            <WhatsAppAccountCard
              account={account}
              onUpdate={() => fetchAccounts(true)}
              onSync={handleSync}
              isSyncing={syncing}
              onPopupTrigger={handlePopupTrigger}
            />

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
                        <p className="font-medium text-sm capitalize">{account.token_type === 'long_lived' ? 'Long-Lived (~60 days)' : account.token_type === 'permanent' ? 'Permanent' : account.token_type || 'Unknown'}</p>
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
                          onClick={() => {
                            if (account.is_active) {
                              // Show confirmation dialog before unlinking
                              setShowUnlinkConfirm(true);
                            } else {
                              // Link directly (no confirmation needed)
                              (async () => {
                                if (processingAction) return;
                                setProcessingAction(true);
                                try {
                                  const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${account.id}/toggle-status`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    credentials: 'include',
                                    body: JSON.stringify({ is_active: true })
                                  });
                                  if (res.ok) {
                                    handlePopupTrigger(
                                      'connect',
                                      'Account Linked',
                                      'Your WhatsApp account is now active and ready to use.',
                                      account.verified_name || 'WhatsApp Business',
                                      account.display_phone_number || undefined,
                                      () => fetchAccounts()
                                    );
                                  }
                                } catch (err) {
                                  console.error('Failed to toggle account status:', err);
                                } finally {
                                  setProcessingAction(false);
                                }
                              })();
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

                        {/* Unlink Confirmation Dialog */}
                        <AlertDialog open={showUnlinkConfirm} onOpenChange={setShowUnlinkConfirm}>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
                                <AlertCircle className="w-5 h-5" />
                                Unlink WhatsApp Account?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="space-y-2">
                                <p>
                                  You are about to unlink <strong>{account.verified_name || 'WhatsApp Business'}</strong>
                                  {account.display_phone_number ? ` (${account.display_phone_number})` : ''}.
                                </p>
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                  <li>All messaging will be paused immediately</li>
                                  <li>Templates and flows will stop working</li>
                                  <li>Incoming messages will not be received</li>
                                  <li>Your data will be preserved &mdash; you can re-link anytime</li>
                                </ul>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-amber-600 hover:bg-amber-700 text-white"
                                onClick={async () => {
                                  setProcessingAction(true);
                                  try {
                                    const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${account.id}/toggle-status`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      credentials: 'include',
                                      body: JSON.stringify({ is_active: false })
                                    });
                                    if (res.ok) {
                                      // Refresh accounts list first, then show popup
                                      await fetchAccounts(true);
                                      handlePopupTrigger(
                                        'unlink',
                                        'Account Unlinked',
                                        'All messaging has been paused. You can link it again anytime.',
                                        account.verified_name || 'WhatsApp Business',
                                        account.display_phone_number || undefined,
                                        () => fetchAccounts()
                                      );
                                    }
                                  } catch (err) {
                                    console.error('Failed to unlink account:', err);
                                  } finally {
                                    setProcessingAction(false);
                                  }
                                }}
                              >
                                Yes, Unlink Account
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
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

                            setProcessingAction(true);
                            const accountName = account.verified_name || 'WhatsApp Business';
                            const accountNumber = account.display_phone_number || undefined;
                            try {
                              const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${account.id}`, {
                                method: 'DELETE',
                                credentials: 'include'
                              });
                              if (res.ok) {
                                // Show delete animation popup
                                handlePopupTrigger(
                                  'delete',
                                  'Account Deleted',
                                  'All account data has been permanently removed.',
                                  accountName,
                                  accountNumber,
                                  () => navigate(basePath)
                                );
                              }
                            } catch (err) {
                              console.error('Failed to delete account:', err);
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

          </div>
        )}

        {/* Agents Management Section */}
        {!loading && !loadingWorkspaces && workspaces.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Agents Management
              </CardTitle>
              <CardDescription>
                Create and manage agent accounts who can access specific features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={String(workspaces[0]?.id || '')} className="w-full">
                {workspaces.length > 1 && (
                  <div className="overflow-x-auto pb-2 mb-4">
                    <TabsList className="inline-flex w-max">
                      {workspaces.map((ws) => (
                        <TabsTrigger key={ws.id} value={String(ws.id)} className="whitespace-nowrap">
                          {ws.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </div>
                )}
                {workspaces.map((ws) => (
                  <TabsContent key={ws.id} value={String(ws.id)}>
                    <AgentsManager workspaceId={Number(ws.id)} />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="mt-16 text-center">
          <p className="text-xs text-muted-foreground/60 flex items-center justify-center gap-2">
            <img src={logo} alt="SocioChat" className="w-4 h-4 opacity-50" />
            Powered by Meta WhatsApp Business Platform
          </p>
        </div>
        {/* WhatsAppConnectSuccessPopup removed for standalone product */}
      </div>
    </div>
  );
}
