/**
 * WhatsApp Coexistence Page
 * =========================
 * 
 * Allows businesses to connect their existing WhatsApp Business number
 * while keeping their mobile WhatsApp app active (Coexistence Mode).
 * 
 * Features:
 * - Connect via Embedded Signup (coexistence mode)
 * - QR pairing status & device activity monitoring
 * - History sync progress
 * - Rate limit dashboard (5 MPS limit)
 * - Upgrade to standard (full API, removes mobile)
 * - Error monitoring panel
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MessageCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Smartphone,
  Wifi,
  WifiOff,
  ArrowUpCircle,
  Activity,
  Clock,
  Shield,
  Zap,
  BarChart3,
  AlertCircle,
  History,
  Signal,
  PhoneCall,
  Link2,
  Settings,
  ExternalLink,
} from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { getWorkspaceId } from '../utils/workspaceContext';
import { toast } from '@/hooks/use-toast';
import { ConnectWhatsAppButton } from '../components/ConnectWhatsAppButton';

const API_BASE = API_BASE_URL;

// ============================================================
// Types
// ============================================================

interface CoexistenceAccount {
  id: number;
  waba_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  is_coexistence: boolean;
  mps_limit: number;
  sync_status: string;
  last_echo_at: string | null;
  coexistence_paired_at: string | null;
  history_sync_completed: boolean;
  is_active: boolean;
  quality_score: string | null;
  created_at: string;
}

interface DeviceActivity {
  last_echo_at: string | null;
  device_status: 'active' | 'warning' | 'critical' | 'unknown';
  minutes_since_last_echo: number | null;
  message: string;
}

interface RateLimitInfo {
  mps_limit: number;
  tokens_available: number;
  capacity: number;
  usage_percent: number;
  messages_sent_last_hour: number;
}

interface HistorySyncInfo {
  sync_status: string;
  history_sync_completed: boolean;
  conversations_synced: number;
  messages_synced: number;
  last_sync_at: string | null;
}

interface CoexistenceError {
  code: number;
  title: string;
  message: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
}

// ============================================================
// Helper Functions
// ============================================================

async function coexistenceApi(path: string, options?: RequestInit) {
  const url = `${API_BASE}/api/whatsapp/coexistence${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    credentials: 'include',
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Server returned ${res.status} — coexistence endpoint not available`);
  }
  return res.json();
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

// ============================================================
// Device Status Indicator
// ============================================================

function DeviceStatusIndicator({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return (
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-green-700 font-medium">Mobile Active</span>
        </div>
      );
    case 'warning':
      return (
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <span className="text-sm text-yellow-700 font-medium">Mobile Idle</span>
        </div>
      );
    case 'critical':
      return (
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="text-sm text-red-700 font-medium">Mobile Disconnected</span>
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          <span className="text-sm text-gray-600 font-medium">Unknown</span>
        </div>
      );
  }
}

// ============================================================
// Not Connected View
// ============================================================

function NotConnectedView({
  workspaceId,
  onConnected,
}: {
  workspaceId: string;
  onConnected: () => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [fbReady, setFbReady] = useState(false);

  // Load Facebook SDK (same as ConnectWhatsAppButton)
  useEffect(() => {
    if (window.FB) {
      setFbReady(true);
      return;
    }
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: import.meta.env.VITE_FB_APP_ID || '1782321995750055',
        cookie: true,
        xfbml: true,
        version: 'v23.0',
      });
      setFbReady(true);
    };
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
    }
  }, []);

  // Listen for WA_EMBEDDED_SIGNUP session events from Meta
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.origin === 'string' && !event.origin.endsWith('facebook.com')) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          console.log('[coexistence] WA_EMBEDDED_SIGNUP event:', data);
          if (data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
            console.log('[coexistence] Coexistence onboarding completed - WABA:', data.data?.waba_id);
          } else if (data.event === 'CANCEL') {
            console.log('[coexistence] User cancelled at step:', data.data?.current_step);
          }
        }
      } catch {
        // Non-JSON message, ignore
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleCoexistenceConnect = async () => {
    if (!workspaceId) {
      toast({ title: 'Error', description: 'No workspace selected', variant: 'destructive' });
      return;
    }

    if (!fbReady || !window.FB) {
      toast({ title: 'Loading...', description: 'Facebook SDK is still loading. Please try again.', variant: 'destructive' });
      return;
    }

    setConnecting(true);

    // Launch Facebook Embedded Signup flow with WhatsApp Business App onboarding (coexistence)
    window.FB.login(
      function (response: any) {
        if (response.authResponse?.code) {
          // Got auth code — send to coexistence connect endpoint
          coexistenceApi('/connect', {
            method: 'POST',
            body: JSON.stringify({
              code: response.authResponse.code,
              workspace_id: workspaceId,
            }),
          })
            .then((data) => {
              if (data.success) {
                toast({
                  title: 'Connection Started!',
                  description: 'Your coexistence account is being set up. Complete the QR pairing to activate.',
                });
                onConnected();
              } else {
                toast({ title: 'Error', description: data.error || 'Failed to connect', variant: 'destructive' });
              }
            })
            .catch((err: any) => {
              toast({ title: 'Connection Error', description: err.message, variant: 'destructive' });
            })
            .finally(() => setConnecting(false));
        } else if (response.authResponse?.accessToken) {
          // FB.login returned an access token directly
          coexistenceApi('/connect', {
            method: 'POST',
            body: JSON.stringify({
              access_token: response.authResponse.accessToken,
              workspace_id: workspaceId,
            }),
          })
            .then((data) => {
              if (data.success) {
                toast({
                  title: 'Connection Started!',
                  description: 'Your coexistence account is being set up.',
                });
                onConnected();
              } else {
                toast({ title: 'Error', description: data.error || 'Failed to connect', variant: 'destructive' });
              }
            })
            .catch((err: any) => {
              toast({ title: 'Connection Error', description: err.message, variant: 'destructive' });
            })
            .finally(() => setConnecting(false));
        } else {
          toast({ title: 'Cancelled', description: 'WhatsApp connection was cancelled', variant: 'destructive' });
          setConnecting(false);
        }
      },
      {
        config_id: import.meta.env.VITE_WHATSAPP_CONFIG_ID || '1684758789571645',
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: 'whatsapp_business_app_onboarding',
          sessionInfoVersion: '3',
        },
      }
    );
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] mb-6">
          <Smartphone className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold mb-3">WhatsApp Coexistence Mode</h2>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Connect your existing WhatsApp Business number to Sociovia while keeping your
          mobile WhatsApp app active. Send and receive messages from both devices simultaneously.
        </p>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-5 text-center">
            <Smartphone className="w-8 h-8 text-green-600 mx-auto mb-3" />
            <h4 className="font-semibold text-sm mb-1">Keep Mobile App</h4>
            <p className="text-xs text-muted-foreground">
              Your WhatsApp mobile app stays active — no disconnection required
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-5 text-center">
            <Zap className="w-8 h-8 text-blue-600 mx-auto mb-3" />
            <h4 className="font-semibold text-sm mb-1">Cloud API Access</h4>
            <p className="text-xs text-muted-foreground">
              Full Cloud API for automation, templates, and broadcasts (5 MPS)
            </p>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="p-5 text-center">
            <History className="w-8 h-8 text-purple-600 mx-auto mb-3" />
            <h4 className="font-semibold text-sm mb-1">History Sync</h4>
            <p className="text-xs text-muted-foreground">
              Import up to 180 days of chat history automatically
            </p>
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { step: 1, title: 'Connect via Meta', desc: 'Sign in with Facebook and select your WhatsApp Business Account' },
              { step: 2, title: 'Scan QR Code', desc: 'Pair your mobile device by scanning the QR code from WhatsApp Web' },
              { step: 3, title: 'Start Messaging', desc: 'Send messages from both mobile and Sociovia — everything stays in sync' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-bold text-sm shrink-0">
                  {step}
                </div>
                <div>
                  <h4 className="font-semibold text-sm">{title}</h4>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Connect Actions */}
      <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
        <Button
          onClick={handleCoexistenceConnect}
          disabled={connecting || !workspaceId || !fbReady}
          className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white h-12 text-base"
          size="lg"
        >
          {connecting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Setting up...
            </>
          ) : (
            <>
              <Smartphone className="w-5 h-5 mr-2" />
              Connect in Coexistence Mode
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          This will start the Meta Embedded Signup flow with coexistence enabled.
          Your mobile WhatsApp will remain active.
        </p>
      </div>

      {/* Limitation Notice */}
      <Alert className="max-w-2xl mx-auto">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Coexistence Limitations</AlertTitle>
        <AlertDescription className="text-sm">
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Message throughput is limited to <strong>5 messages per second</strong> (vs 80+ for standard)</li>
            <li>Messages sent from mobile appear as "echoes" in Sociovia</li>
            <li>You can upgrade to standard mode later (disconnects mobile app)</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}

// ============================================================
// Connected Dashboard
// ============================================================

function ConnectedDashboard({
  account,
  workspaceId,
  onRefresh,
}: {
  account: CoexistenceAccount;
  workspaceId: string;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [deviceActivity, setDeviceActivity] = useState<DeviceActivity | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [historySyncInfo, setHistorySyncInfo] = useState<HistorySyncInfo | null>(null);
  const [errors, setErrors] = useState<CoexistenceError[]>([]);
  const [upgrading, setUpgrading] = useState(false);
  const [showUpgradeConfirm, setShowUpgradeConfirm] = useState(false);
  const [loadingStates, setLoadingStates] = useState({
    device: false,
    rateLimit: false,
    historySync: false,
    errors: false,
  });

  const fetchDeviceActivity = useCallback(async () => {
    setLoadingStates(s => ({ ...s, device: true }));
    try {
      const data = await coexistenceApi(`/device-activity?account_id=${account.id}&workspace_id=${workspaceId}`);
      if (data.success) {
        setDeviceActivity(data.device_activity);
      }
    } catch { /* silent */ }
    setLoadingStates(s => ({ ...s, device: false }));
  }, [account.id, workspaceId]);

  const fetchRateLimit = useCallback(async () => {
    setLoadingStates(s => ({ ...s, rateLimit: true }));
    try {
      const data = await coexistenceApi(`/rate-limit?account_id=${account.id}&workspace_id=${workspaceId}`);
      if (data.success) {
        setRateLimitInfo(data.rate_limit);
      }
    } catch { /* silent */ }
    setLoadingStates(s => ({ ...s, rateLimit: false }));
  }, [account.id, workspaceId]);

  const fetchHistorySync = useCallback(async () => {
    setLoadingStates(s => ({ ...s, historySync: true }));
    try {
      const data = await coexistenceApi(`/history-sync?account_id=${account.id}&workspace_id=${workspaceId}`);
      if (data.success) {
        setHistorySyncInfo(data.history_sync);
      }
    } catch { /* silent */ }
    setLoadingStates(s => ({ ...s, historySync: false }));
  }, [account.id, workspaceId]);

  const fetchErrors = useCallback(async () => {
    setLoadingStates(s => ({ ...s, errors: true }));
    try {
      const data = await coexistenceApi(`/errors?account_id=${account.id}&workspace_id=${workspaceId}`);
      if (data.success) {
        setErrors(data.errors || []);
      }
    } catch { /* silent */ }
    setLoadingStates(s => ({ ...s, errors: false }));
  }, [account.id, workspaceId]);

  useEffect(() => {
    fetchDeviceActivity();
    fetchRateLimit();
    fetchHistorySync();
    fetchErrors();
  }, [fetchDeviceActivity, fetchRateLimit, fetchHistorySync, fetchErrors]);

  // Auto-refresh device activity every 60s
  useEffect(() => {
    const interval = setInterval(fetchDeviceActivity, 60000);
    return () => clearInterval(interval);
  }, [fetchDeviceActivity]);

  const handleUpgrade = async () => {
    setUpgrading(true);
    try {
      const data = await coexistenceApi('/upgrade', {
        method: 'POST',
        body: JSON.stringify({ account_id: account.id, workspace_id: workspaceId }),
      });

      if (data.success) {
        toast({
          title: 'Upgrade Complete!',
          description: 'Your account is now in standard mode with full API throughput.',
        });
        setShowUpgradeConfirm(false);
        onRefresh();
      } else {
        toast({ title: 'Upgrade Failed', description: data.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Account Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">
                {account.verified_name || 'WhatsApp Business'}
              </h3>
              <Badge className="bg-green-100 text-green-800">Coexistence</Badge>
              {account.is_active && (
                <Badge variant="outline" className="border-green-300 text-green-700">Active</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {account.display_phone_number || account.phone_number_id}
              {" · "}5 MPS Limit
              {account.coexistence_paired_at && ` · Paired ${timeAgo(account.coexistence_paired_at)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/dashboard/whatsapp/settings')}
          >
            <Settings className="w-4 h-4 mr-1" />
            Settings
          </Button>
        </div>
      </div>

      {/* Device Alert Banner */}
      {deviceActivity?.device_status === 'critical' && (
        <Alert variant="destructive">
          <WifiOff className="h-4 w-4" />
          <AlertTitle>Mobile Device Disconnected</AlertTitle>
          <AlertDescription>
            Your mobile WhatsApp hasn't sent any echoes recently. 
            Make sure the phone is on and connected to the internet.
            Coexistence requires active mobile connectivity.
          </AlertDescription>
        </Alert>
      )}
      {deviceActivity?.device_status === 'warning' && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Mobile Device Idle</AlertTitle>
          <AlertDescription>
            {deviceActivity.message || 'No recent activity from your mobile WhatsApp.'}
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="overview" className="gap-1.5">
            <Activity className="w-3.5 h-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="device" className="gap-1.5">
            <Smartphone className="w-3.5 h-3.5" />
            Device
          </TabsTrigger>
          <TabsTrigger value="rate-limit" className="gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Rate Limit
          </TabsTrigger>
          <TabsTrigger value="errors" className="gap-1.5 relative">
            <AlertCircle className="w-3.5 h-3.5" />
            Errors
            {errors.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                {errors.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ==================== OVERVIEW TAB ==================== */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Status Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Signal className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-medium text-muted-foreground">Device</span>
                </div>
                {loadingStates.device ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <DeviceStatusIndicator status={deviceActivity?.device_status || 'unknown'} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-muted-foreground">MPS</span>
                </div>
                <p className="text-lg font-bold">{account.mps_limit}</p>
                <p className="text-xs text-muted-foreground">msgs/sec</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <History className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-medium text-muted-foreground">Sync</span>
                </div>
                {account.history_sync_completed ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Done</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm font-medium text-blue-700">Syncing</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-medium text-muted-foreground">Quality</span>
                </div>
                <Badge className={
                  account.quality_score === 'GREEN' ? 'bg-green-100 text-green-800' :
                  account.quality_score === 'YELLOW' ? 'bg-yellow-100 text-yellow-800' :
                  account.quality_score === 'RED' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }>
                  {account.quality_score || 'N/A'}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button
              onClick={() => navigate('/dashboard/whatsapp/inbox')}
              className="w-full !bg-green-600 hover:!bg-green-700 !text-white"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Open Inbox
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard/whatsapp/templates')}
              className="w-full"
            >
              Templates
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/dashboard/whatsapp/bulk')}
              className="w-full"
            >
              Bulk Messaging
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowUpgradeConfirm(true)}
              className="w-full text-orange-700 border-orange-300 hover:bg-orange-50"
            >
              <ArrowUpCircle className="w-4 h-4 mr-2" />
              Upgrade
            </Button>
          </div>

          {/* History Sync Progress */}
          {!account.history_sync_completed && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-purple-600" />
                    <span className="font-medium text-sm">History Sync</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={fetchHistorySync}>
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
                <Progress
                  value={historySyncInfo?.history_sync_completed ? 100 : 50}
                  className="h-2 mb-2"
                />
                <p className="text-xs text-muted-foreground">
                  {historySyncInfo
                    ? `${historySyncInfo.conversations_synced} conversations, ${historySyncInfo.messages_synced} messages synced`
                    : 'Importing up to 180 days of chat history...'
                  }
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ==================== DEVICE TAB ==================== */}
        <TabsContent value="device" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Mobile Device Activity
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={fetchDeviceActivity} disabled={loadingStates.device}>
                  {loadingStates.device ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>
              <CardDescription>
                Monitor your mobile WhatsApp connection status. Coexistence requires an active mobile device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {deviceActivity ? (
                <>
                  <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Connection Status</p>
                      <DeviceStatusIndicator status={deviceActivity.device_status} />
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Last Echo</p>
                      <p className="font-medium text-sm">
                        {deviceActivity.last_echo_at ? timeAgo(deviceActivity.last_echo_at) : 'No echoes yet'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      What are Message Echoes?
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      When you send or receive messages on your mobile WhatsApp, the Cloud API receives
                      "echo" notifications. These echoes confirm your mobile device is active and connected.
                    </p>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div className="p-3 bg-green-50 rounded-lg text-center">
                        <Wifi className="w-5 h-5 text-green-600 mx-auto mb-1" />
                        <p className="text-xs font-medium text-green-800">Active</p>
                        <p className="text-[10px] text-green-600">Echoes in last 24h</p>
                      </div>
                      <div className="p-3 bg-yellow-50 rounded-lg text-center">
                        <Clock className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
                        <p className="text-xs font-medium text-yellow-800">Warning</p>
                        <p className="text-[10px] text-yellow-600">No echo for 10+ days</p>
                      </div>
                      <div className="p-3 bg-red-50 rounded-lg text-center">
                        <WifiOff className="w-5 h-5 text-red-600 mx-auto mb-1" />
                        <p className="text-xs font-medium text-red-800">Critical</p>
                        <p className="text-[10px] text-red-600">No echo for 20+ days</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : loadingStates.device ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Unable to load device activity data.
                </p>
              )}
            </CardContent>
          </Card>

          {/* History Sync Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="w-5 h-5" />
                  History Sync
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={fetchHistorySync} disabled={loadingStates.historySync}>
                  {loadingStates.historySync ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>
              <CardDescription>
                Chat history from the last 180 days is imported after QR pairing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historySyncInfo ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    <Badge className={
                      historySyncInfo.sync_status === 'synced' ? 'bg-green-100 text-green-800' :
                      historySyncInfo.sync_status === 'syncing' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }>
                      {historySyncInfo.sync_status}
                    </Badge>
                  </div>
                  <Progress
                    value={historySyncInfo.history_sync_completed ? 100 : 50}
                    className="h-2"
                  />
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-lg font-bold">{historySyncInfo.conversations_synced}</p>
                      <p className="text-xs text-muted-foreground">Conversations</p>
                    </div>
                    <div className="p-3 bg-muted/30 rounded-lg">
                      <p className="text-lg font-bold">{historySyncInfo.messages_synced}</p>
                      <p className="text-xs text-muted-foreground">Messages</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  {loadingStates.historySync ? (
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  ) : (
                    <p className="text-sm text-muted-foreground">No sync data available yet.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== RATE LIMIT TAB ==================== */}
        <TabsContent value="rate-limit" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Rate Limit Status
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={fetchRateLimit} disabled={loadingStates.rateLimit}>
                  {loadingStates.rateLimit ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>
              <CardDescription>
                Coexistence mode limits messaging to {account.mps_limit} messages per second.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {rateLimitInfo ? (
                <>
                  {/* Usage Meter */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Token Usage</span>
                      <span className="font-medium">{Math.round(rateLimitInfo.usage_percent)}%</span>
                    </div>
                    <Progress
                      value={rateLimitInfo.usage_percent}
                      className={`h-3 ${
                        rateLimitInfo.usage_percent > 80 ? '[&>div]:bg-red-500' :
                        rateLimitInfo.usage_percent > 50 ? '[&>div]:bg-yellow-500' :
                        '[&>div]:bg-green-500'
                      }`}
                    />
                    <p className="text-xs text-muted-foreground">
                      {rateLimitInfo.tokens_available} / {rateLimitInfo.capacity} tokens available
                    </p>
                  </div>

                  {/* Rate Limit Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-muted/30 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-600">{rateLimitInfo.mps_limit}</p>
                      <p className="text-xs text-muted-foreground">MPS Limit</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg text-center">
                      <p className="text-2xl font-bold text-green-600">{rateLimitInfo.tokens_available}</p>
                      <p className="text-xs text-muted-foreground">Available Tokens</p>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg text-center">
                      <p className="text-2xl font-bold text-purple-600">{rateLimitInfo.messages_sent_last_hour}</p>
                      <p className="text-xs text-muted-foreground">Sent (Last Hour)</p>
                    </div>
                  </div>

                  {/* Upgrade CTA */}
                  <div className="p-4 border-2 border-dashed border-orange-200 rounded-lg bg-orange-50/50">
                    <div className="flex items-start gap-3">
                      <ArrowUpCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-sm text-orange-900">Need More Throughput?</h4>
                        <p className="text-xs text-orange-700 mt-1">
                          Upgrade to standard mode for 80+ MPS. This will disconnect your mobile app
                          and gives full Cloud API throughput.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 text-orange-700 border-orange-300"
                          onClick={() => setShowUpgradeConfirm(true)}
                        >
                          Upgrade to Standard
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  {loadingStates.rateLimit ? (
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  ) : (
                    <p className="text-sm text-muted-foreground">Rate limit data unavailable.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== ERRORS TAB ==================== */}
        <TabsContent value="errors" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  Error Monitoring
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={fetchErrors} disabled={loadingStates.errors}>
                  {loadingStates.errors ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                </Button>
              </div>
              <CardDescription>
                Recent errors specific to coexistence mode (rate limits, device conflicts, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {errors.length > 0 ? (
                <div className="space-y-3">
                  {errors.map((error, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${
                        error.severity === 'critical' ? 'bg-red-50 border-red-200' :
                        error.severity === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                        'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {error.severity === 'critical' ? (
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          ) : error.severity === 'warning' ? (
                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-blue-600" />
                          )}
                          <span className="font-medium text-sm">{error.title}</span>
                          <Badge variant="outline" className="text-xs">
                            {error.code}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {timeAgo(error.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-6">
                        {error.message}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
                  <p className="font-medium text-sm">No Errors</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Your coexistence account is running smoothly.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upgrade Confirmation Dialog */}
      {showUpgradeConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpCircle className="w-5 h-5 text-orange-600" />
                Upgrade to Standard Mode
              </CardTitle>
              <CardDescription>
                This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  Upgrading to standard mode will:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li><strong>Disconnect</strong> your mobile WhatsApp app</li>
                    <li>Increase throughput to <strong>80+ MPS</strong></li>
                    <li>Stop receiving mobile echo messages</li>
                    <li>You will only be able to use WhatsApp via Sociovia</li>
                  </ul>
                </AlertDescription>
              </Alert>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowUpgradeConfirm(false)}
                  disabled={upgrading}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={handleUpgrade}
                  disabled={upgrading}
                >
                  {upgrading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Upgrading...
                    </>
                  ) : (
                    'Confirm Upgrade'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main WhatsApp Coexistence Page
// ============================================================

export function WhatsAppCoexistence() {
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<CoexistenceAccount | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workspaceId = getWorkspaceId() || '';

  const fetchStatus = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      setError('No workspace selected. Please select a workspace first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await coexistenceApi(`/status?workspace_id=${workspaceId}`);

      if (data.success && data.account) {
        setAccount(data.account);
      } else {
        setAccount(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch coexistence status');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Loading State
  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-green-500" />
              WhatsApp Coexistence
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-green-500" />
              <span className="text-muted-foreground">Checking coexistence status...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error State
  if (error) {
    return (
      <div className="container mx-auto max-w-4xl py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-green-500" />
              WhatsApp Coexistence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button variant="outline" size="sm" onClick={fetchStatus}>
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-green-500" />
              <CardTitle>WhatsApp Coexistence</CardTitle>
            </div>
            {account && (
              <Badge className="bg-green-100 text-green-800">Connected</Badge>
            )}
          </div>
          <CardDescription>
            {account
              ? 'Manage your coexistence connection — mobile app + Cloud API running together'
              : 'Connect your existing WhatsApp Business number while keeping your mobile app active'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {account ? (
            <ConnectedDashboard
              account={account}
              workspaceId={workspaceId}
              onRefresh={fetchStatus}
            />
          ) : (
            <NotConnectedView
              workspaceId={workspaceId}
              onConnected={fetchStatus}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default WhatsAppCoexistence;
