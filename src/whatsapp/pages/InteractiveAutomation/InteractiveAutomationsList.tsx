/**
 * Interactive Automations List Page
 * 
 * Displays all saved interactive automation flows with options to:
 * - Create new automation
 * - Edit existing automations
 * - Delete automations
 * - Publish/Pause automations
 * - View status and statistics
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
    Plus,
    GitBranch,
    Play,
    Pause,
    Pencil,
    Trash2,
    MoreHorizontal,
    Search,
    Calendar,
    Zap,
    ArrowUpRight,
    RefreshCw,
    AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { toast } from 'sonner';
import { getStoredAccountId, getActiveAccountId } from '@/whatsapp/utils/accountContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface InteractiveAutomation {
    id: number;
    workspace_id?: string;
    workspaceId?: string;
    account_id?: number;
    accountId?: number;
    name: string;
    description?: string;
    trigger_type?: string;
    triggerType?: string;
    status: 'draft' | 'active' | 'paused';
    is_active?: boolean;
    isActive?: boolean;
    trigger_count?: number;
    triggerCount?: number;
    last_triggered_at?: string;
    lastTriggeredAt?: string;
    created_at?: string;
    createdAt?: string;
    updated_at?: string;
    updatedAt?: string;
}

const InteractiveAutomationsList: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    // Get base path from current location (agent or dashboard)
    const basePath = location.pathname.startsWith('/agent') ? '/agent' : '/dashboard';

    // Get workspace_id from multiple sources (same as flow builder)
    const workspaceId = searchParams.get('workspace_id')
        || localStorage.getItem('sv_whatsapp_workspace_id')
        || sessionStorage.getItem('sv_whatsapp_workspace_id')
        || localStorage.getItem('current_workspace_id')
        || '';

    // Get account_id from query params or stored value
    const [accountId, setAccountId] = useState<string>(
        searchParams.get('account_id')
        || String(getStoredAccountId() || '')
    );

    // Auto-fetch account ID if not available
    useEffect(() => {
        if (!accountId) {
            getActiveAccountId(API_BASE).then((id) => {
                if (id) setAccountId(String(id));
            });
        }
    }, [accountId]);

    const [automations, setAutomations] = useState<InteractiveAutomation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [automationToDelete, setAutomationToDelete] = useState<InteractiveAutomation | null>(null);

    // Fetch automations
    const fetchAutomations = useCallback(async () => {
        setError(null);

        if (!workspaceId) {
            console.warn('No workspace_id available, checking localStorage...');
            setLoading(false);
            setError('No workspace selected. Please select a workspace first.');
            return;
        }

        try {
            setLoading(true);
            const url = `${API_BASE}/api/whatsapp/interactive-automations?workspace_id=${workspaceId}${accountId ? `&account_id=${accountId}` : ''}`;
            console.log('Fetching automations from:', url);

            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });

            console.log('Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error:', errorText);
                throw new Error(`Failed to fetch automations: ${response.status}`);
            }

            const data = await response.json();
            console.log('API Response:', data);

            if (data.success) {
                setAutomations(data.automations || []);
                console.log('Loaded automations:', data.automations?.length || 0);
            } else {
                setError(data.error || 'Failed to load automations');
            }
        } catch (error) {
            console.error('Error fetching automations:', error);
            setError('Failed to load automations. Please try again.');
            toast.error('Failed to load automations');
        } finally {
            setLoading(false);
        }
    }, [workspaceId, accountId]);

    useEffect(() => {
        fetchAutomations();
    }, [fetchAutomations]);

    // Handle publish/pause
    const handleToggleStatus = async (automation: InteractiveAutomation) => {
        const isCurrentlyActive = automation.is_active ?? automation.isActive;
        const action = isCurrentlyActive ? 'pause' : 'publish';
        try {
            const response = await fetch(
                `${API_BASE}/api/whatsapp/interactive-automations/${automation.id}/${action}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to ${action} automation`);
            }

            toast.success(`Automation ${action === 'publish' ? 'published' : 'paused'} successfully`);
            fetchAutomations();
        } catch (error) {
            console.error(`Error ${action}ing automation:`, error);
            toast.error(`Failed to ${action} automation`);
        }
    };

    // Handle delete
    const handleDelete = async () => {
        if (!automationToDelete) return;

        try {
            const response = await fetch(
                `${API_BASE}/api/whatsapp/interactive-automations/${automationToDelete.id}`,
                {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                }
            );

            if (!response.ok) {
                throw new Error('Failed to delete automation');
            }

            toast.success('Automation deleted successfully');
            setDeleteDialogOpen(false);
            setAutomationToDelete(null);
            fetchAutomations();
        } catch (error) {
            console.error('Error deleting automation:', error);
            toast.error('Failed to delete automation');
        }
    };

    // Filter automations by search query
    const filteredAutomations = automations.filter((a) =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Status badge variant - handle both camelCase and snake_case
    const getStatusBadge = (automation: InteractiveAutomation) => {
        const isActive = automation.is_active ?? automation.isActive;
        if (automation.status === 'active' && isActive) {
            return <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>;
        } else if (automation.status === 'paused') {
            return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Paused</Badge>;
        }
        return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Draft</Badge>;
    };

    // Format date - handle both formats
    const formatDate = (automation: InteractiveAutomation) => {
        const dateString = automation.updated_at || automation.updatedAt || automation.created_at || automation.createdAt;
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    // Trigger type display - handle both formats
    const getTriggerLabel = (automation: InteractiveAutomation) => {
        const type = automation.trigger_type || automation.triggerType || 'any_reply';
        const labels: Record<string, string> = {
            any_reply: 'Any Message',
            keyword: 'Keyword Match',
            exact_match: 'Exact Match',
        };
        return labels[type] || type;
    };

    // Get trigger count - handle both formats
    const getTriggerCount = (automation: InteractiveAutomation) => {
        return automation.trigger_count ?? automation.triggerCount ?? 0;
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                            <GitBranch className="w-8 h-8 text-green-600" />
                            Interactive Automations
                        </h1>
                        <p className="text-gray-500 mt-2">
                            Create and manage visual conversation flows for WhatsApp
                        </p>
                    </div>
                    <Button
                        onClick={() => navigate(`${basePath}/interactive-automation/new?workspace_id=${workspaceId}&account_id=${accountId}`)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Automation
                    </Button>
                </div>

                {/* Search and Filters */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Search automations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-white border-gray-200 text-gray-800 placeholder:text-gray-400"
                        />
                    </div>
                    <Button
                        variant="outline"
                        onClick={fetchAutomations}
                        className="border-gray-200 text-gray-600 hover:bg-gray-100"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>

                {/* Debug Info */}
                {!loading && !error && automations.length === 0 && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                        <strong>Debug:</strong> workspace_id={workspaceId || 'none'}, account_id={accountId || 'none'}
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <Card className="bg-red-50 border-red-200 mb-6">
                        <CardContent className="flex items-center gap-3 py-4">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            <span className="text-red-700">{error}</span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={fetchAutomations}
                                className="ml-auto border-red-200 text-red-600 hover:bg-red-100"
                            >
                                Try Again
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Loading State */}
                {loading && (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    </div>
                )}

                {/* Empty State */}
                {!loading && !error && filteredAutomations.length === 0 && (
                    <Card className="bg-white border-gray-200 shadow-sm">
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                <GitBranch className="w-8 h-8 text-gray-400" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800 mb-2">
                                No automations yet
                            </h3>
                            <p className="text-gray-500 mb-6 text-center max-w-md">
                                Create your first interactive automation to build engaging
                                WhatsApp conversation flows with buttons and branching logic.
                            </p>
                            <Button
                                onClick={() => navigate(`${basePath}/interactive-automation/new?workspace_id=${workspaceId}&account_id=${accountId}`)}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Create Your First Automation
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Automations Grid */}
                {!loading && !error && filteredAutomations.length > 0 && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredAutomations.map((automation) => (
                            <Card
                                key={automation.id}
                                className="bg-white border-gray-200 hover:border-green-300 hover:shadow-md transition-all cursor-pointer group"
                                onClick={() => navigate(`${basePath}/interactive-automation/${automation.id}?workspace_id=${workspaceId}&account_id=${accountId}`)}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <CardTitle className="text-lg text-gray-800 group-hover:text-green-600 transition-colors flex items-center gap-2">
                                                {automation.name}
                                                <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </CardTitle>
                                            <CardDescription className="text-gray-500 mt-1">
                                                {automation.description || 'No description'}
                                            </CardDescription>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                                                >
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="bg-white border-gray-200">
                                                <DropdownMenuItem
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`${basePath}/interactive-automation/${automation.id}?workspace_id=${workspaceId}&account_id=${accountId}`);
                                                    }}
                                                    className="text-gray-700 hover:bg-gray-100"
                                                >
                                                    <Pencil className="w-4 h-4 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleStatus(automation);
                                                    }}
                                                    className="text-gray-700 hover:bg-gray-100"
                                                >
                                                    {(automation.is_active ?? automation.isActive) ? (
                                                        <>
                                                            <Pause className="w-4 h-4 mr-2" />
                                                            Pause
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play className="w-4 h-4 mr-2" />
                                                            Publish
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAutomationToDelete(automation);
                                                        setDeleteDialogOpen(true);
                                                    }}
                                                    className="text-red-600 hover:bg-red-50"
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-2 mb-4">
                                        {getStatusBadge(automation)}
                                        <Badge variant="outline" className="border-gray-200 text-gray-600">
                                            {getTriggerLabel(automation)}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between text-sm text-gray-500">
                                        <div className="flex items-center gap-1">
                                            <Zap className="w-3.5 h-3.5" />
                                            <span>{getTriggerCount(automation)} triggers</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span>{formatDate(automation)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Delete Confirmation Dialog */}
                <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <AlertDialogContent className="bg-white border-gray-200">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-gray-800">Delete Automation?</AlertDialogTitle>
                            <AlertDialogDescription className="text-gray-500">
                                This will permanently delete "{automationToDelete?.name}".
                                This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200">
                                Cancel
                            </AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDelete}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
    );
};

export default InteractiveAutomationsList;
