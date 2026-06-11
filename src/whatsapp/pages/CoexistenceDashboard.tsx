// WhatsApp Coexistence Dashboard
// ================================
// Dashboard for managing WhatsApp Business App Coexistence accounts
// Shows device status, rate limits, history sync, echo messages, and contacts

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  Smartphone,
  Activity,
  Gauge,
  Clock,
  MessageCircle,
  Users,
  History,
  ArrowUpCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Wifi,
  WifiOff,
  TrendingUp,
  Eye,
  Shield,
  Loader2,
} from 'lucide-react';
import {
  getCoexistenceDashboard,
  getCoexistenceStatus,
  getEchoMessages,
  getCoexistenceContacts,
  getHistorySyncStatus,
  markHistorySyncComplete,
  upgradeToStandard,
  checkAllDevices,
  type DeviceStatus,
  type RateLimitStatus,
  type HistorySyncStatus,
  type EchoMessage,
  type CoexistenceContact,
  type HistorySyncLog,
} from '../api/coexistenceApi';
import { API_BASE_URL } from '@/config';
import { getWorkspaceId } from '../utils/workspaceContext';
import { ConnectWhatsAppButton } from '../components/ConnectWhatsAppButton';

// ── Helpers ──

function getDeviceStatusColor(status: DeviceStatus['status']) {
  switch (status) {
    case 'active': return 'text-green-600 bg-green-100';
    case 'idle': return 'text-yellow-600 bg-yellow-100';
    case 'at_risk': return 'text-orange-600 bg-orange-100';
    case 'inactive': return 'text-red-600 bg-red-100';
    default: return 'text-gray-600 bg-gray-100';
  }
}

function getDeviceStatusIcon(status: DeviceStatus['status']) {
  switch (status) {
    case 'active': return <Wifi className="w-5 h-5" />;
    case 'idle': return <Clock className="w-5 h-5" />;
    case 'at_risk': return <AlertTriangle className="w-5 h-5" />;
    case 'inactive': return <WifiOff className="w-5 h-5" />;
    default: return <Smartphone className="w-5 h-5" />;
  }
}

function getHealthBadge(health: DeviceStatus['health']) {
  const styles: Record<string, string> = {
    healthy: 'bg-green-100 text-green-700 border-green-300',
    warning: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    critical: 'bg-orange-100 text-orange-700 border-orange-300',
    danger: 'bg-red-100 text-red-700 border-red-300',
  };
  return (
    <Badge variant="outline" className={styles[health] || styles.healthy}>
      {health.charAt(0).toUpperCase() + health.slice(1)}
    </Badge>
  );
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffH < 1) return 'Just now';
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

// ── Main Component ──

interface CoexistenceDashboardProps {
  accountId?: number;
}

export function CoexistenceDashboard({ accountId: propAccountId }: CoexistenceDashboardProps) {
  const navigate = useNavigate();
  const [accountId, setAccountId] = useState<number | null>(propAccountId || null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dashboard data
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitStatus | null>(null);
  const [historySyncStatus, setHistorySyncStatus] = useState<HistorySyncStatus | null>(null);
  const [historySyncLogs, setHistorySyncLogs] = useState<HistorySyncLog[]>([]);
  const [stats7d, setStats7d] = useState<{
    incoming: number;
    outgoing: number;
    echo: number;
    failed: number;
  } | null>(null);
  const [totalContacts, setTotalContacts] = useState(0);
  const [echoMessages, setEchoMessages] = useState<EchoMessage[]>([]);
  const [contacts, setContacts] = useState<CoexistenceContact[]>([]);
  const [upgrading, setUpgrading] = useState(false);

  // Load coexistence accounts
  useEffect(() => {
    async function loadAccounts() {
      const workspaceId = getWorkspaceId();
      try {
        const qs = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : '';
        const res = await fetch(`${API_BASE_URL}/api/whatsapp/accounts${qs}`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (data.success) {
          const coexAccounts = data.accounts.filter(
            (a: any) => a.is_coexistence === true
          );
          setAccounts(coexAccounts);
          if (!accountId && coexAccounts.length > 0) {
            setAccountId(coexAccounts[0].id);
          }
          if (coexAccounts.length === 0) {
            setLoading(false);
          }
        }
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load accounts',
          variant: 'destructive',
        });
        setLoading(false);
      }
    }
    loadAccounts();
  }, []);

  // Load dashboard data
  const loadDashboard = useCallback(async () => {
    if (!accountId) return;
    try {
      const [dashData, echoData, contactsData, historyData] = await Promise.all([
        getCoexistenceDashboard(accountId),
        getEchoMessages(accountId, { per_page: 10 }),
        getCoexistenceContacts({ account_id: accountId, per_page: 5 }),
        getHistorySyncStatus(accountId),
      ]);

      if (dashData.success) {
        setDeviceStatus(dashData.dashboard.device_status);
        setRateLimit(dashData.dashboard.rate_limit);
        setStats7d(dashData.dashboard.stats_7d);
        setTotalContacts(dashData.dashboard.total_contacts);
        setHistorySyncStatus(dashData.dashboard.history_sync);
      }
      if (echoData.success) setEchoMessages(echoData.echo_messages);
      if (contactsData.success) setContacts(contactsData.contacts);
      if (historyData.success) {
        setHistorySyncLogs(historyData.logs);
        if (historyData.history_sync) {
          setHistorySyncStatus(historyData.history_sync);
        }
      }
    } catch (err: any) {
      console.error('Dashboard load error:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to load dashboard',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accountId]);

  useEffect(() => {
    if (accountId) {
      setLoading(true);
      loadDashboard();
    }
  }, [accountId, loadDashboard]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const handleUpgrade = async () => {
    if (!accountId) return;
    if (!confirm('Are you sure you want to upgrade to Standard Cloud API? This will disconnect your mobile WhatsApp Business app.')) return;
    setUpgrading(true);
    try {
      const res = await upgradeToStandard(accountId);
      toast({
        title: 'Upgraded!',
        description: `Now using Standard Cloud API with ${res.new_mps_limit} MPS`,
      });
      loadDashboard();
    } catch (err: any) {
      toast({
        title: 'Upgrade Failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setUpgrading(false);
    }
  };

  // ── No Coexistence Accounts ──
  if (!loading && accounts.length === 0) {
    const workspaceId = getWorkspaceId() || '';
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 p-8">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <Smartphone className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-semibold">No Coexistence Accounts</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Connect your existing WhatsApp Business App to use it alongside SocioChat's Cloud API.
          Keep your phone active while automating messages.
        </p>
        <ConnectWhatsAppButton
          workspaceId={workspaceId}
          coexistenceMode
          onConnected={() => window.location.reload()}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-emerald-600" />
            Coexistence Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor your WhatsApp Business App running alongside Cloud API
          </p>
        </div>
        <div className="flex items-center gap-2">
          {accounts.length > 1 && (
            <select
              className="border rounded-md px-3 py-2 text-sm"
              value={accountId || ''}
              onChange={(e) => setAccountId(Number(e.target.value))}
            >
              {accounts.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.verified_name || a.display_phone_number || `Account #${a.id}`}
                </option>
              ))}
            </select>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Device Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Device Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deviceStatus ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${getDeviceStatusColor(deviceStatus.status)}`}>
                    {getDeviceStatusIcon(deviceStatus.status)}
                  </div>
                  <div>
                    <p className="font-semibold capitalize">{deviceStatus.status}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimeAgo(deviceStatus.last_mobile_activity_at)}
                    </p>
                  </div>
                </div>
                {getHealthBadge(deviceStatus.health)}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>

        {/* Rate Limit */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Rate Limit
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rateLimit ? (
              <div className="space-y-2">
                <p className="text-2xl font-bold">
                  {rateLimit.mps_limit} <span className="text-sm font-normal text-muted-foreground">MPS</span>
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Tokens: {rateLimit.tokens_available}/{rateLimit.max_tokens}</span>
                    <span>{rateLimit.utilization_percent.toFixed(0)}%</span>
                  </div>
                  <Progress
                    value={100 - rateLimit.utilization_percent}
                    className="h-2"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {rateLimit.messages_sent_today} sent today
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>

        {/* 7-Day Messages */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              7-Day Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats7d ? (
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{stats7d.incoming + stats7d.outgoing + stats7d.echo}</p>
                  <span className="text-xs text-muted-foreground">total messages</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-blue-600">Incoming: {stats7d.incoming}</span>
                  <span className="text-emerald-600">Outgoing: {stats7d.outgoing}</span>
                  <span className="text-purple-600">Echo: {stats7d.echo}</span>
                  {stats7d.failed > 0 && (
                    <span className="text-red-600">Failed: {stats7d.failed}</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading...</p>
            )}
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              CRM Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalContacts}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Synced from conversations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="echoes">Echo Messages</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="history">History Sync</TabsTrigger>
          <TabsTrigger value="upgrade">Upgrade</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Device Activity Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  Device Activity
                </CardTitle>
                <CardDescription>
                  Your mobile WhatsApp Business app status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {deviceStatus && (
                  <>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${getDeviceStatusColor(deviceStatus.status)}`}>
                          {getDeviceStatusIcon(deviceStatus.status)}
                        </div>
                        <div>
                          <p className="font-medium capitalize">{deviceStatus.status}</p>
                          <p className="text-xs text-muted-foreground">
                            Last activity: {formatTimeAgo(deviceStatus.last_mobile_activity_at)}
                          </p>
                        </div>
                      </div>
                      {getHealthBadge(deviceStatus.health)}
                    </div>
                    {deviceStatus.status === 'at_risk' && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200">
                        <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5" />
                        <div className="text-sm text-orange-800">
                          <p className="font-medium">Device activity declining</p>
                          <p className="text-xs mt-1">
                            Keep WhatsApp Business open on your phone to maintain the connection.
                            Inactive devices may be disconnected after 14 days.
                          </p>
                        </div>
                      </div>
                    )}
                    {deviceStatus.status === 'inactive' && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                        <XCircle className="w-4 h-4 text-red-600 mt-0.5" />
                        <div className="text-sm text-red-800">
                          <p className="font-medium">Device inactive</p>
                          <p className="text-xs mt-1">
                            Your phone has been inactive for too long. Open WhatsApp Business
                            on your phone to restore the connection, or upgrade to Standard Cloud API.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Rate Limit Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-600" />
                  Rate Limiting
                </CardTitle>
                <CardDescription>
                  Coexistence mode: 5 messages per second limit
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {rateLimit && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{rateLimit.mps_limit}</p>
                        <p className="text-xs text-muted-foreground">Max MPS</p>
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50 text-center">
                        <p className="text-2xl font-bold">{rateLimit.messages_sent_today}</p>
                        <p className="text-xs text-muted-foreground">Sent Today</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Token Bucket</span>
                        <span className="font-medium">{rateLimit.tokens_available}/{rateLimit.max_tokens}</span>
                      </div>
                      <Progress value={(rateLimit.tokens_available / rateLimit.max_tokens) * 100} className="h-3" />
                      <p className="text-xs text-muted-foreground">
                        Tokens refill automatically at {rateLimit.mps_limit}/second
                      </p>
                    </div>
                    {rateLimit.is_coexistence && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                        <Activity className="w-4 h-4 text-blue-600 mt-0.5" />
                        <p className="text-xs text-blue-800">
                          Coexistence mode has a 5 MPS limit. Upgrade to Standard Cloud API
                          for 80+ MPS throughput.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Echo Messages Tab */}
        <TabsContent value="echoes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-600" />
                Echo Messages
              </CardTitle>
              <CardDescription>
                Messages sent from your mobile WhatsApp Business app, echoed here for visibility
              </CardDescription>
            </CardHeader>
            <CardContent>
              {echoMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No echo messages yet</p>
                  <p className="text-xs mt-1">
                    Messages sent from your mobile app will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {echoMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50"
                    >
                      <div className="p-1.5 rounded-full bg-purple-100">
                        <Smartphone className="w-3 h-3 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                            Echo
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {msg.type}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(msg.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm mt-1 truncate">
                          {typeof msg.content === 'string'
                            ? msg.content
                            : (msg.content as any)?.body || (msg.content as any)?.text?.body || JSON.stringify(msg.content).slice(0, 100)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                CRM Contacts
              </CardTitle>
              <CardDescription>
                Contacts synced from your WhatsApp conversations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No contacts yet</p>
                  <p className="text-xs mt-1">
                    Contacts are automatically created from incoming conversations
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {contacts.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-700">
                          {(c.name || c.phone).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{c.name || c.phone}</p>
                        <p className="text-xs text-muted-foreground">{c.phone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {c.labels.map((label) => (
                          <Badge key={label} variant="secondary" className="text-xs">
                            {label}
                          </Badge>
                        ))}
                        <span className="text-xs text-muted-foreground">
                          {c.total_messages} msgs
                        </span>
                      </div>
                    </div>
                  ))}
                  {totalContacts > contacts.length && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => navigate('/dashboard/contacts')}
                    >
                      View all {totalContacts} contacts
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Sync Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-600" />
                History Sync
              </CardTitle>
              <CardDescription>
                Sync up to 180 days of message history from your mobile app
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {historySyncStatus && (
                <>
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">
                        Status: <span className="capitalize">{historySyncStatus.sync_status}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {historySyncStatus.history_sync_completed
                          ? 'History sync is complete'
                          : 'Waiting for messages from your mobile app'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {historySyncStatus.history_sync_completed ? (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Complete
                        </Badge>
                      ) : (
                        <>
                          <Badge variant="outline" className="bg-amber-50 text-amber-700">
                            {historySyncStatus.history_sync_progress}%
                          </Badge>
                          {!historySyncStatus.history_sync_completed && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                if (!accountId) return;
                                try {
                                  await markHistorySyncComplete(accountId);
                                  toast({ title: 'Marked complete' });
                                  loadDashboard();
                                } catch (err: any) {
                                  toast({
                                    title: 'Error',
                                    description: err.message,
                                    variant: 'destructive',
                                  });
                                }
                              }}
                            >
                              Mark Complete
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {!historySyncStatus.history_sync_completed && (
                    <Progress value={historySyncStatus.history_sync_progress} className="h-3" />
                  )}
                </>
              )}

              {/* Sync Logs */}
              {historySyncLogs.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h4 className="font-medium text-sm">Sync Batches</h4>
                  {historySyncLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-2 rounded border text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={
                          log.status === 'completed' ? 'bg-green-50 text-green-700' :
                          log.status === 'failed' ? 'bg-red-50 text-red-700' :
                          'bg-blue-50 text-blue-700'
                        }>
                          {log.status}
                        </Badge>
                        <span className="text-muted-foreground">{log.batch_id.slice(0, 8)}...</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span>{log.messages_stored} stored</span>
                        <span className="text-muted-foreground">{log.messages_duplicated} dupes</span>
                        <span className="text-muted-foreground">
                          {new Date(log.started_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upgrade Tab */}
        <TabsContent value="upgrade" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
                Upgrade to Standard Cloud API
              </CardTitle>
              <CardDescription>
                Remove the mobile app dependency and unlock higher throughput
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Comparison */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border-2 border-muted">
                  <h4 className="font-semibold flex items-center gap-2 mb-3">
                    <Smartphone className="w-4 h-4" />
                    Current: Coexistence
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      Keep mobile app active
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      Echo messages from phone
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-yellow-500" />
                      5 MPS limit
                    </li>
                    <li className="flex items-center gap-2">
                      <AlertTriangle className="w-3 h-3 text-yellow-500" />
                      Phone must stay connected
                    </li>
                  </ul>
                </div>
                <div className="p-4 rounded-lg border-2 border-emerald-200 bg-emerald-50/50">
                  <h4 className="font-semibold flex items-center gap-2 mb-3 text-emerald-700">
                    <ArrowUpCircle className="w-4 h-4" />
                    Standard Cloud API
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      No phone required
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      80+ MPS throughput
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      Full automation support
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      No device monitoring needed
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">Important</p>
                  <p className="text-xs mt-1">
                    Upgrading will disconnect your mobile WhatsApp Business app from this number.
                    You won't be able to send/receive messages on the phone app anymore.
                    All existing conversations and history will be preserved in SocioChat.
                  </p>
                </div>
              </div>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                size="lg"
                onClick={handleUpgrade}
                disabled={upgrading}
              >
                {upgrading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Upgrading...
                  </>
                ) : (
                  <>
                    <ArrowUpCircle className="w-4 h-4 mr-2" />
                    Upgrade to Standard Cloud API
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default CoexistenceDashboard;
