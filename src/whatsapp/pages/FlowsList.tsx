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
    Send, MessageCircle, RefreshCw, Eye, Archive, FileText, Calendar, BarChart3, ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/config';
import { useDataCache } from '../hooks/useDataCache';
import { CACHE_KEYS, POLL_INTERVALS, useWhatsAppConnection } from '../hooks/useWhatsAppData';
import { getWorkspaceId } from '../utils/workspaceContext';
import { cachedFetch } from '../utils/waPersistentCache';

const API_BASE = API_BASE_URL;

interface Flow {
    id: number;
    name: string;
    category: string;
    status: string;
    flow_version: number;
    screen_count: number;
    meta_flow_id: string | null;
    created_at: string;
    updated_at: string;
    published_at: string | null;
}

export function FlowsList() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [publishing, setPublishing] = useState<number | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [activeTab, setActiveTab] = useState<'flows' | 'submissions' | 'bookings' | 'analytics'>('flows');

    const workspaceId = getWorkspaceId();
    const { data: connectionData, isLoading: checkingConnection } = useWhatsAppConnection(workspaceId || '');

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

    const {
        data: cachedFlows,
        isLoading: flowsLoading,
        isRefreshing,
        refresh: refreshFlows,
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
        enabled: !!accountId,
        onError: () => {
            toast({ title: 'Error', description: 'Failed to load forms', variant: 'destructive' });
        },
    });

    const flows = useMemo(() => cachedFlows || [], [cachedFlows]);
    const loading = (checkingConnection && !connectionData) || flowsLoading;

    const publishFlow = async (flowId: number) => {
        try {
            setPublishing(flowId);
            const res = await cachedFetch(`${API_BASE}/api/whatsapp/flows/${flowId}/publish`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Published!', description: 'Form published successfully to Meta' });
                refreshFlows();
            } else {
                let errorMsg = data.message || data.error || 'Failed to publish form';
                if (data.error === 'validation_failed' && Array.isArray(data.validation?.errors)) {
                    const details = data.validation.errors.slice(0, 3).map((err: { screen_id?: string; message?: string }) => {
                        const label = err.screen_id ? `${err.screen_id}: ` : '';
                        return `${label}${err.message}`;
                    }).join(' • ');
                    if (details) errorMsg = `Fix the form in the editor before publishing. ${details}`;
                }
                toast({ title: 'Publish Failed', description: errorMsg, variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to publish form', variant: 'destructive' });
        } finally {
            setPublishing(null);
        }
    };

    const deleteFlow = async (flowId: number) => {
        if (!confirm('Are you sure you want to delete this form?')) return;
        try {
            const res = await cachedFetch(`${API_BASE}/api/whatsapp/flows/${flowId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Deleted', description: 'Form deleted successfully' });
                refreshFlows();
            } else {
                toast({ title: 'Error', description: data.error, variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to delete form', variant: 'destructive' });
        }
    };

    const deprecateFlow = async (flowId: number) => {
        if (!confirm('Deprecate this published form? It will no longer be sendable.')) return;
        try {
            const res = await cachedFetch(`${API_BASE}/api/whatsapp/flows/${flowId}/deprecate`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                toast({ title: 'Deprecated', description: 'Form deprecated successfully' });
                refreshFlows();
            } else {
                toast({ title: 'Error', description: data.error || data.message || 'Failed to deprecate form', variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to deprecate form', variant: 'destructive' });
        }
    };

    const syncFlows = async () => {
        if (!accountId) return;
        try {
            setSyncing(true);
            const res = await cachedFetch(`${API_BASE}/api/whatsapp/flows/sync?account_id=${accountId}`, { method: 'POST' });
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
        } catch {
            toast({ title: 'Error', description: 'Failed to sync forms', variant: 'destructive' });
        } finally {
            setSyncing(false);
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
                    {activeTab === 'flows' && (
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => navigate('/dashboard/flows/new')}>
                            <Plus className="w-4 h-4 mr-2" /> Create Form
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex gap-1 mb-6 p-1 bg-muted/50 rounded-lg w-fit overflow-x-auto">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={cn(
                            "flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap",
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

            {activeTab === 'submissions' && <SubmissionsTab accountId={accountId} />}
            {activeTab === 'bookings' && <BookingsTab accountId={accountId} />}
            {activeTab === 'analytics' && <AnalyticsTab accountId={accountId} />}

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
                        <Button onClick={() => navigate('/dashboard/setup')} className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white gap-2">
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
                        <Button onClick={() => navigate('/dashboard/flows/new')}>
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
                                    {getStatusBadge(flow.status)}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="text-sm text-muted-foreground space-y-1 mb-4">
                                    <p>Screens: {flow.screen_count}</p>
                                    <p>Version: {flow.flow_version}</p>
                                    {flow.meta_flow_id && <p className="text-xs truncate">Form ID: {flow.meta_flow_id}</p>}
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    {flow.status === 'DRAFT' && (
                                        <>
                                            <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/flows/new?edit=${flow.id}`)}>
                                                <Edit className="w-4 h-4 mr-1" /> Edit
                                            </Button>
                                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => publishFlow(flow.id)} disabled={publishing === flow.id}>
                                                {publishing === flow.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                                                Publish
                                            </Button>
                                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteFlow(flow.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </>
                                    )}
                                    {flow.status === 'PUBLISHED' && (
                                        <>
                                            <Button size="sm" variant="outline" onClick={() => navigate(`/dashboard/flows/${flow.id}`)}>
                                                <Eye className="w-4 h-4 mr-1" /> View
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => deprecateFlow(flow.id)}>
                                                <Archive className="w-4 h-4 mr-1" /> Deprecate
                                            </Button>
                                            <Badge variant="outline" className="border-emerald-200 text-emerald-600 bg-emerald-50/50 ml-auto">
                                                Ready for templates
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
        </div>
    );
}
