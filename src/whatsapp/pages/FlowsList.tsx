import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { SubmissionsTab } from './FlowOS/SubmissionsTab';
import { BookingsTab } from './FlowOS/BookingsTab';
import { AnalyticsTab } from './FlowOS/AnalyticsTab';

import {
    Plus, Edit, Trash2, Loader2, CheckCircle, Clock, XCircle,
    Send, MessageCircle, RefreshCw, Eye, Archive, FileText, Calendar, BarChart3, ClipboardList,
    Bell, BellOff, Settings, Copy, Phone, AlertCircle, CheckCircle2, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WHATSAPP_API_BASE_URL } from "@/config";
import { useDataCache } from '../hooks/useDataCache';
import { CACHE_KEYS, POLL_INTERVALS, useWhatsAppConnection } from '../hooks/useWhatsAppData';
import { getWorkspaceId } from '../utils/workspaceContext';
import { cachedFetch } from '../utils/waPersistentCache';

const API_BASE = WHATSAPP_API_BASE_URL;

interface Flow {
    id: number;
    name: string;
    category: string;
    status: string;
    flow_version: number;
    screen_count: number;
    meta_flow_id: string | null;
    notify_owner_whatsapp: boolean;
    created_at: string;
    updated_at: string;
    published_at: string | null;
}

export function FlowsList() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [publishing, setPublishing] = useState<number | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [togglingNotify, setTogglingNotify] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'flows' | 'submissions' | 'bookings' | 'analytics'>('flows');
    const [showNotifySettings, setShowNotifySettings] = useState(false);
    const [notifyPhone, setNotifyPhone] = useState('');
    const [notifyPhoneSaving, setNotifyPhoneSaving] = useState(false);
    const [notifySettings, setNotifySettings] = useState<any>(null);
    const [notifySettingsLoading, setNotifySettingsLoading] = useState(false);
    const [checkingTemplate, setCheckingTemplate] = useState(false);

    // Get workspace_id from storage (set during login/workspace selection)
    const workspaceId = getWorkspaceId();

    // Use cached connection status - shows instantly, refreshes silently
    const { data: connectionData, isLoading: checkingConnection } = useWhatsAppConnection(workspaceId || '');

    // Derived account info from cached connection
    const accountId = useMemo(() => {
        if (!connectionData || connectionData.status !== 'CONNECTED') return null;
        const id = String(connectionData.account_summary?.id || '');
        if (id) localStorage.setItem('selectedAccountId', id);
        return id;
    }, [connectionData]);

    const accountName = useMemo(() => {
        if (!connectionData || connectionData.status !== 'CONNECTED') return null;
        return connectionData.account_summary?.verified_name || null;
    }, [connectionData]);

    // Use cached flows data
    const {
        data: cachedFlows,
        isLoading: flowsLoading,
        isRefreshing,
        refresh: refreshFlows,
        setData: setFlows,
        lastUpdated,
    } = useDataCache<Flow[]>({
        key: CACHE_KEYS.FLOWS(accountId || ''),
        fetcher: async () => {
            if (!accountId) return [];
            const res = await cachedFetch(`${API_BASE}/api/whatsapp/flows?account_id=${accountId}`);
            const data = await res.json();
            return data.success ? data.flows || [] : [];
        },
        pollInterval: POLL_INTERVALS.NORMAL,
        enabled: !!accountId, // Enable as soon as we have accountId from cache
        onError: () => {
            toast({ title: 'Error', description: 'Failed to load forms', variant: 'destructive' });
        },
    });

    const flows = useMemo(() => cachedFlows || [], [cachedFlows]);

    // Combined loading state: first load when checking connection OR loading flows with no data
    const loading = (checkingConnection && !connectionData) || flowsLoading;

    const publishFlow = async (flowId: number) => {
        try {
            setPublishing(flowId);
            const res = await cachedFetch(`${API_BASE}/api/whatsapp/flows/${flowId}/publish`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Published!', description: 'Form published successfully to Meta' });
                refreshFlows(); // Refresh list
            } else {
                // Show specific error message with action URL if available
                let errorMsg = data.message || data.error || 'Failed to publish form';

                if (data.error === 'validation_failed' && Array.isArray(data.validation?.errors)) {
                    const details = data.validation.errors
                        .slice(0, 3)
                        .map((err: any) => {
                            const label = err.screen_id ? `${err.screen_id}: ` : '';
                            return `${label}${err.message}`;
                        })
                        .join(' • ');

                    if (details) {
                        errorMsg = `Fix the form in the editor before publishing. ${details}`;
                    }
                }

                // Add action hint for specific error types
                if (data.error === 'business_not_verified') {
                    errorMsg += '. Go to Meta Business Manager to complete verification.';
                } else if (data.error === 'flows_not_enabled') {
                    errorMsg += '. Contact Meta Support to enable Forms.';
                } else if (data.error === 'token_expired' || data.error === 'token_missing') {
                    errorMsg += '. Please reconnect your WhatsApp account.';
                }

                toast({ title: 'Publish Failed', description: errorMsg, variant: 'destructive' });
            }
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to publish form', variant: 'destructive' });
        } finally {
            setPublishing(null);
        }
    };

    const deleteFlow = async (flowId: number) => {
        if (!confirm('Are you sure you want to delete this form?')) return;

        try {
            const res = await cachedFetch(`${API_BASE}/api/whatsapp/flows/${flowId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Deleted', description: 'Form deleted successfully' });
                refreshFlows();
            } else {
                toast({ title: 'Error', description: data.error, variant: 'destructive' });
            }
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to delete form', variant: 'destructive' });
        }
    };

    const deprecateFlow = async (flowId: number) => {
        if (!confirm('Deprecate this published form? It will no longer be sendable.')) return;

        try {
            const res = await cachedFetch(`${API_BASE}/api/whatsapp/flows/${flowId}/deprecate`, {
                method: 'POST'
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Deprecated', description: 'Form deprecated successfully' });
                refreshFlows();
            } else {
                toast({ title: 'Error', description: data.error || data.message || 'Failed to deprecate form', variant: 'destructive' });
            }
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to deprecate form', variant: 'destructive' });
        }
    };

    const syncFlows = async () => {
        if (!accountId) return;

        try {
            setSyncing(true);
            const res = await cachedFetch(`${API_BASE}/api/whatsapp/flows/sync?account_id=${accountId}`, {
                method: 'POST',
            });
            const data = await res.json();

            if (data.success) {
                toast({
                    title: 'Synced',
                    description: data.updated ? `Updated ${data.updated} form(s) from Meta` : 'Form statuses are already up to date',
                });
                refreshFlows();
            } else {
                toast({ title: 'Error', description: data.error || data.message || 'Failed to sync forms', variant: 'destructive' });
            }
        } catch (err) {
            toast({ title: 'Error', description: 'Failed to sync forms', variant: 'destructive' });
        } finally {
            setSyncing(false);
        }
    };

    const loadNotifySettings = async () => {
        if (!workspaceId) return;
        try {
            setNotifySettingsLoading(true);
            const res = await cachedFetch(`${API_BASE}/api/whatsapp/flows/notification-settings?workspace_id=${workspaceId}`);
            const data = await res.json();
            if (data.success) {
                setNotifySettings(data);
                setNotifyPhone(data.notification_phone_number || '');
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to load notification settings', variant: 'destructive' });
        } finally {
            setNotifySettingsLoading(false);
        }
    };

    const saveNotifyPhone = async () => {
        if (!workspaceId || !notifyPhone.trim()) return;
        try {
            setNotifyPhoneSaving(true);
            const res = await cachedFetch(`${API_BASE}/api/whatsapp/flows/notification-settings?workspace_id=${workspaceId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notification_phone_number: notifyPhone.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Saved', description: 'Notification phone number saved' });
                setNotifySettings((prev: any) => ({ ...prev, notification_phone_number: data.notification_phone_number }));
            } else {
                toast({ title: 'Error', description: data.error || 'Failed to save', variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to save phone number', variant: 'destructive' });
        } finally {
            setNotifyPhoneSaving(false);
        }
    };

    const checkTemplateStatus = async () => {
        if (!workspaceId) return;
        try {
            setCheckingTemplate(true);
            const res = await cachedFetch(`${API_BASE}/api/whatsapp/flows/check-template-status?workspace_id=${workspaceId}`, {
                method: 'POST',
            });
            const data = await res.json();
            if (data.success) {
                setNotifySettings((prev: any) => ({ ...prev, template_status: data.template_status }));
                const statusMsg: Record<string, string> = {
                    approved: 'Template approved and ready!',
                    pending: 'Template is pending approval from Meta',
                    rejected: 'Template was rejected by Meta. Please recreate it.',
                    not_created: 'Template not found. Please create it following the guide below.',
                    fallback_approved: 'Using fallback template (human_required). Create the dedicated template for better formatting.',
                };
                toast({ title: 'Template Status', description: statusMsg[data.template_status] || data.template_status });
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to check template status', variant: 'destructive' });
        } finally {
            setCheckingTemplate(false);
        }
    };

    const openNotifySettings = () => {
        setShowNotifySettings(true);
        loadNotifySettings();
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: 'Copied', description: `${label} copied to clipboard` });
        });
    };

    const toggleNotify = async (flow: Flow) => {
        try {
            setTogglingNotify(flow.id);
            const res = await cachedFetch(`${API_BASE}/api/whatsapp/flows/${flow.id}/notify-toggle`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !flow.notify_owner_whatsapp }),
            });
            const data = await res.json();
            if (data.success) {
                setFlows((prev: Flow[] | null) =>
                    (prev || []).map(f => f.id === flow.id ? { ...f, notify_owner_whatsapp: data.notify_owner_whatsapp } : f)
                );
                toast({
                    title: data.notify_owner_whatsapp ? 'Notifications On' : 'Notifications Off',
                    description: data.notify_owner_whatsapp
                        ? 'You will receive form submissions on your WhatsApp number'
                        : 'WhatsApp submission notifications turned off',
                });
            } else {
                if (data.error === 'setup_required' || data.error === 'template_missing' || data.error === 'same_as_business') {
                    toast({ title: 'Setup Required', description: data.message, variant: 'destructive' });
                    openNotifySettings();
                } else {
                    toast({ title: 'Error', description: data.message || data.error || 'Failed to update', variant: 'destructive' });
                }
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to update notification setting', variant: 'destructive' });
        } finally {
            setTogglingNotify(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'PUBLISHED':
                return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white"><CheckCircle className="w-3 h-3 mr-1" /> Published</Badge>;
            case 'DRAFT':
                return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Draft</Badge>;
            case 'DEPRECATED':
                return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Deprecated</Badge>;
            default:
                return <Badge>{status}</Badge>;
        }
    };

    const tabs = [
        { id: 'flows' as const, label: 'Forms', icon: ClipboardList },
        { id: 'submissions' as const, label: 'Submissions', icon: FileText },
        { id: 'bookings' as const, label: 'Bookings', icon: Calendar },
        { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
    ];

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-2xl font-bold">{accountName ? <><span className="text-emerald-600">{accountName}'s</span> WhatsApp Forms</> : 'WhatsApp Forms'}</h1>
                    <p className="text-sm text-muted-foreground">Manage native forms, submissions, bookings & analytics</p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && !loading && (
                        <span className="text-xs text-muted-foreground hidden sm:block">
                            Updated {Math.round((Date.now() - lastUpdated) / 1000)}s ago
                        </span>
                    )}
                    <Button variant="outline" size="icon" onClick={syncFlows} disabled={isRefreshing || syncing || !accountId} title="Sync from Meta">
                        <RefreshCw className={cn("w-4 h-4", (isRefreshing || syncing) && "animate-spin")} />
                    </Button>
                    {activeTab === 'flows' && (<>
                        <Button variant="outline" size="icon" onClick={openNotifySettings} title="Notification Settings">
                            <Settings className="w-4 h-4" />
                        </Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => navigate('/dashboard/whatsapp/flows/new')}>
                            <Plus className="w-4 h-4 mr-2" /> Create Form
                        </Button>
                    </>)}
                </div>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-1 mb-6 p-1 bg-muted/50 rounded-lg w-fit">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={cn(
                            "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all",
                            activeTab === t.id
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        )}
                    >
                        <t.icon className="w-4 h-4" />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Tab: Submissions */}
            {activeTab === 'submissions' && <SubmissionsTab accountId={accountId} />}

            {/* Tab: Bookings */}
            {activeTab === 'bookings' && <BookingsTab accountId={accountId} />}

            {/* Tab: Analytics */}
            {activeTab === 'analytics' && <AnalyticsTab accountId={accountId} />}

            {/* Tab: Flows (original content) */}
            {activeTab === 'flows' && (<>

            {loading ? (
                <div className="flex justify-center items-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : !workspaceId ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No Workspace Selected</h3>
                        <p className="text-muted-foreground mb-4">Please select a workspace from the dashboard first</p>
                    </CardContent>
                </Card>
            ) : !accountId ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No WhatsApp Account Connected</h3>
                        <p className="text-muted-foreground mb-4">Connect a WhatsApp Business Account to create forms</p>
                        <Button
                            onClick={() => navigate('/dashboard/whatsapp/setup')}
                            className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#128C7E] hover:to-[#075E54] text-white gap-2"
                        >
                            <MessageCircle className="w-5 h-5" />
                            Connect WhatsApp Account
                        </Button>
                    </CardContent>
                </Card>
            ) : flows.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <ClipboardList className="w-12 h-12 mx-auto text-emerald-500 mb-4" />
                        <h3 className="text-lg font-medium mb-2">No forms yet</h3>
                        <p className="text-muted-foreground mb-4">Create your first native WhatsApp form</p>
                        <Button onClick={() => navigate('/dashboard/whatsapp/flows/new')}>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Form
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {flows.map(flow => (
                        <Card key={flow.id} className="hover:shadow-lg transition-shadow border-emerald-100/50 dark:border-emerald-950/20">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <ClipboardList className="w-5 h-5 text-emerald-500" />
                                            {flow.name}
                                        </CardTitle>
                                        <CardDescription>{flow.category}</CardDescription>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleNotify(flow); }}
                                            disabled={togglingNotify === flow.id}
                                            title={flow.notify_owner_whatsapp ? 'WhatsApp notifications ON — click to turn off' : 'WhatsApp notifications OFF — click to turn on'}
                                            className={cn(
                                                "p-1.5 rounded-md transition-colors",
                                                flow.notify_owner_whatsapp
                                                    ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
                                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                            )}
                                        >
                                            {togglingNotify === flow.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : flow.notify_owner_whatsapp ? (
                                                <Bell className="w-4 h-4" />
                                            ) : (
                                                <BellOff className="w-4 h-4" />
                                            )}
                                        </button>
                                        {getStatusBadge(flow.status)}
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-muted-foreground space-y-1 mb-4">
                                    <p>Screens: {flow.screen_count}</p>
                                    <p>Version: {flow.flow_version}</p>
                                    {flow.meta_flow_id && (
                                        <p className="text-xs truncate">
                                            Form ID: {flow.meta_flow_id}
                                        </p>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    {flow.status === 'DRAFT' && (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => navigate(`/dashboard/whatsapp/flows/new?edit=${flow.id}`)}
                                            >
                                                <Edit className="w-4 h-4 mr-1" />
                                                Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                                onClick={() => publishFlow(flow.id)}
                                                disabled={publishing === flow.id}
                                            >
                                                {publishing === flow.id ? (
                                                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                                ) : (
                                                    <Send className="w-4 h-4 mr-1" />
                                                )}
                                                Publish
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-destructive"
                                                onClick={() => deleteFlow(flow.id)}
                                                title="Delete draft form"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </>
                                    )}
                                    {flow.status === 'PUBLISHED' && (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => navigate(`/dashboard/whatsapp/flows/${flow.id}/edit`)}
                                            >
                                                <Eye className="w-4 h-4 mr-1" />
                                                View
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => deprecateFlow(flow.id)}
                                            >
                                                <Archive className="w-4 h-4 mr-1" />
                                                Deprecate
                                            </Button>
                                            <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 ml-auto">
                                                ✓ Ready to use in templates
                                            </Badge>
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
            </>)}

            {/* Notification Settings Panel */}
            {showNotifySettings && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowNotifySettings(false)}>
                    <div className="bg-background border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between p-4 border-b">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Bell className="w-5 h-5 text-emerald-600" />
                                Notification Settings
                            </h2>
                            <button onClick={() => setShowNotifySettings(false)} className="p-1 rounded hover:bg-muted">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {notifySettingsLoading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <div className="p-4 space-y-6">

                                {/* Step 1: Phone Number */}
                                <div className="space-y-3">
                                    <h3 className="font-medium flex items-center gap-2">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold dark:bg-emerald-950 dark:text-emerald-400">1</span>
                                        Notification Phone Number
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Enter your personal WhatsApp number to receive form submission notifications. This cannot be your business number.
                                    </p>
                                    {notifySettings?.business_phone_number && (
                                        <p className="text-xs text-muted-foreground">
                                            Your business number: <span className="font-mono">{notifySettings.business_phone_number}</span>
                                        </p>
                                    )}
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                            <input
                                                type="tel"
                                                placeholder="e.g. 919876543210"
                                                value={notifyPhone}
                                                onChange={e => setNotifyPhone(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 border rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                            />
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={saveNotifyPhone}
                                            disabled={notifyPhoneSaving || !notifyPhone.trim()}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                        >
                                            {notifyPhoneSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                                        </Button>
                                    </div>
                                    {notifySettings?.notification_phone_number && (
                                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3" /> Saved: {notifySettings.notification_phone_number}
                                        </p>
                                    )}
                                </div>

                                <hr />

                                {/* Step 2: Template Setup */}
                                <div className="space-y-3">
                                    <h3 className="font-medium flex items-center gap-2">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold dark:bg-emerald-950 dark:text-emerald-400">2</span>
                                        WhatsApp Template Setup
                                    </h3>

                                    {/* Template Status */}
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm">Status:</span>
                                        {notifySettings?.template_status === 'approved' ? (
                                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">Approved</Badge>
                                        ) : notifySettings?.template_status === 'fallback_approved' ? (
                                            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">Using Fallback</Badge>
                                        ) : notifySettings?.template_status === 'pending' ? (
                                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">Pending Approval</Badge>
                                        ) : notifySettings?.template_status === 'rejected' ? (
                                            <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">Rejected</Badge>
                                        ) : (
                                            <Badge variant="outline">Not Created</Badge>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={checkTemplateStatus} disabled={checkingTemplate}>
                                            {checkingTemplate ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                            <span className="ml-1 text-xs">Check</span>
                                        </Button>
                                    </div>

                                    {notifySettings?.template_status === 'approved' ? (
                                        <p className="text-sm text-emerald-600 flex items-center gap-1">
                                            <CheckCircle2 className="w-4 h-4" /> Template is approved and ready. You can enable notifications on any form.
                                        </p>
                                    ) : (
                                        <>
                                            <p className="text-sm text-muted-foreground">
                                                {notifySettings?.template_status === 'fallback_approved'
                                                    ? 'Notifications work with the fallback template. For better formatting, create the dedicated template below.'
                                                    : 'Create this template in Meta Business Manager for form notifications to work.'
                                                }
                                            </p>

                                            {/* Template creation guide */}
                                            <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                                                <p className="font-medium">How to create the template:</p>
                                                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                                                    <li>Go to <strong>Meta Business Manager</strong> &rarr; WhatsApp Manager &rarr; Message Templates</li>
                                                    <li>Click <strong>"Create Template"</strong></li>
                                                    <li>Category: Select <strong>Utility</strong></li>
                                                    <li>
                                                        Name: Enter exactly
                                                        <button
                                                            onClick={() => copyToClipboard(notifySettings?.template_to_create?.name || 'form_submission_alert', 'Template name')}
                                                            className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 bg-background border rounded text-xs font-mono hover:bg-muted"
                                                        >
                                                            {notifySettings?.template_to_create?.name || 'form_submission_alert'}
                                                            <Copy className="w-3 h-3" />
                                                        </button>
                                                    </li>
                                                    <li>Language: <strong>English</strong></li>
                                                    <li>
                                                        Body: Paste the text below
                                                    </li>
                                                    <li>Submit for approval (usually approved within minutes)</li>
                                                    <li>Come back here and click <strong>"Check"</strong> above</li>
                                                </ol>
                                            </div>

                                            {/* Template body to copy */}
                                            <div className="relative">
                                                <pre className="bg-muted/50 border rounded-lg p-3 text-xs whitespace-pre-wrap font-mono">
{notifySettings?.template_to_create?.body || `📋 *New Form Submission*

Form: {{1}}
From: {{2}}
Submission Details: {{3}}
Submitted at: {{4}}

Please respond to the customer promptly.`}
                                                </pre>
                                                <button
                                                    onClick={() => copyToClipboard(
                                                        notifySettings?.template_to_create?.body || "📋 *New Form Submission*\n\nForm: {{1}}\nFrom: {{2}}\nSubmission Details: {{3}}\nSubmitted at: {{4}}\n\nPlease respond to the customer promptly.",
                                                        'Template body'
                                                    )}
                                                    className="absolute top-2 right-2 p-1.5 rounded bg-background border hover:bg-muted"
                                                    title="Copy template body"
                                                >
                                                    <Copy className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <hr />

                                {/* Step 3: Enable */}
                                <div className="space-y-2">
                                    <h3 className="font-medium flex items-center gap-2">
                                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold dark:bg-emerald-950 dark:text-emerald-400">3</span>
                                        Enable Notifications
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Once setup is complete, click the <Bell className="w-3.5 h-3.5 inline" /> bell icon on any form card to enable notifications for that form.
                                    </p>
                                    {notifySettings?.notification_phone_number && (notifySettings?.template_status === 'approved' || notifySettings?.template_status === 'fallback_approved') ? (
                                        <p className="text-sm text-emerald-600 flex items-center gap-1">
                                            <CheckCircle2 className="w-4 h-4" /> All set! You can enable notifications on individual forms now.
                                        </p>
                                    ) : (
                                        <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md dark:bg-amber-950/20 dark:border-amber-800">
                                            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                                {!notifySettings?.notification_phone_number
                                                    ? 'Set your notification phone number above (Step 1)'
                                                    : 'Create and get the template approved (Step 2)'
                                                }
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
