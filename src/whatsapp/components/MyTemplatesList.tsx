// My Templates List Component
// ============================
// Section 1: Real templates from user's WABA (synced from Meta)

import { useState, useEffect } from 'react';
import { useAgentAwareNavigation } from '@/hooks/useAgentAwareNavigation';
import { Button } from '@/components/ui/button';
import { TemplateCard, Template } from './TemplateCard';
import { RefreshCw, Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { API_BASE_URL } from "@/config";

const API_BASE = API_BASE_URL;

interface MyTemplatesListProps {
    accountId: number | null;
    onSendTemplate: (template: Template) => void;
}

export function MyTemplatesList({ accountId, onSendTemplate }: MyTemplatesListProps) {
    const { convertPath, navigateTo } = useAgentAwareNavigation();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncingTemplateId, setSyncingTemplateId] = useState<number | string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');

    // Confirmation dialog state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
    const [selectedTemplateForAction, setSelectedTemplateForAction] = useState<Template | null>(null);

    const fetchTemplates = async () => {
        if (!accountId) return;

        try {
            setLoading(true);
            const params = new URLSearchParams({ account_id: accountId.toString() });
            if (statusFilter) params.append('status', statusFilter);

            const res = await fetch(`${API_BASE}/api/whatsapp/templates?${params}`, {
                credentials: 'include',
            });
            const data = await res.json();

            if (data.success) {
                setTemplates(data.templates || []);
            }
        } catch (err) {
            console.error('Failed to fetch templates:', err);
        } finally {
            setLoading(false);
        }
    };

    const syncTemplates = async () => {
        if (!accountId) return;

        try {
            setSyncing(true);
            const res = await fetch(`${API_BASE}/api/whatsapp/templates/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ account_id: accountId }),
            });
            const data = await res.json();

            if (data.success) {
                // Re-fetch templates with current filter instead of using sync result
                await fetchTemplates();
                toast({
                    title: 'Templates Refreshed',
                    description: `${data.synced} templates updated from Meta`,
                });
            } else {
                toast({
                    title: 'Refresh Failed',
                    description: data.error || 'Failed to refresh templates',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            console.error('Failed to refresh templates:', err);
            toast({
                title: 'Refresh Failed',
                description: 'Network error while refreshing',
                variant: 'destructive',
            });
        } finally {
            setSyncing(false);
        }
    };

    // Sync single template
    const syncSingleTemplate = async (template: Template) => {
        if (!accountId) return;

        try {
            setSyncingTemplateId(template.id);
            const res = await fetch(`${API_BASE}/api/whatsapp/templates/${template.id}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ account_id: accountId }),
            });
            const data = await res.json();

            if (data.success) {
                // Update template in local state
                setTemplates(prev => prev.map(t =>
                    t.id === template.id ? { ...t, ...data.template, status: data.template?.status || t.status } : t
                ));
                toast({
                    title: 'Template Synced',
                    description: `Status updated for "${template.name}"`,
                });
            } else {
                toast({
                    title: 'Sync Failed',
                    description: data.error || 'Failed to sync template',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            console.error('Failed to sync template:', err);
            toast({
                title: 'Sync Failed',
                description: 'Network error',
                variant: 'destructive',
            });
        } finally {
            setSyncingTemplateId(null);
        }
    };

    // Archive template
    const archiveTemplate = async () => {
        if (!selectedTemplateForAction || !accountId) return;

        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/templates/${selectedTemplateForAction.id}/archive`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ account_id: accountId }),
            });
            const data = await res.json();

            if (data.success) {
                // Remove from local list or mark as archived
                setTemplates(prev => prev.filter(t => t.id !== selectedTemplateForAction.id));
                toast({
                    title: 'Template Archived',
                    description: `"${selectedTemplateForAction.name}" has been archived`,
                });
            } else {
                toast({
                    title: 'Archive Failed',
                    description: data.error || 'Failed to archive template',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            console.error('Failed to archive template:', err);
            toast({
                title: 'Archive Failed',
                description: 'Network error',
                variant: 'destructive',
            });
        } finally {
            setArchiveConfirmOpen(false);
            setSelectedTemplateForAction(null);
        }
    };

    // Delete template
    const deleteTemplate = async () => {
        if (!selectedTemplateForAction || !accountId) return;

        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/templates/${selectedTemplateForAction.id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ account_id: accountId }),
            });
            const data = await res.json();

            if (data.success) {
                // Remove from local list
                setTemplates(prev => prev.filter(t => t.id !== selectedTemplateForAction.id));
                toast({
                    title: 'Template Deleted',
                    description: `"${selectedTemplateForAction.name}" has been deleted`,
                });
            } else {
                toast({
                    title: 'Delete Failed',
                    description: data.error || 'Failed to delete template',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            console.error('Failed to delete template:', err);
            toast({
                title: 'Delete Failed',
                description: 'Network error',
                variant: 'destructive',
            });
        } finally {
            setDeleteConfirmOpen(false);
            setSelectedTemplateForAction(null);
        }
    };

    // Duplicate template
    const duplicateTemplate = (template: Template) => {
        // Navigate to create page with template data pre-filled
        navigateTo(`whatsapp/templates/new?duplicate=${template.id}`);
    };

    useEffect(() => {
        fetchTemplates();
    }, [accountId, statusFilter]);

    const filteredTemplates = templates.filter(t => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            t.name?.toLowerCase().includes(query) ||
            t.body_text?.toLowerCase().includes(query)
        );
    });

    if (!accountId) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <p>Select an account to view templates</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {/* Header with sync and search */}
            <div className="p-4 border-b space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold">My Templates</h3>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            onClick={() => navigateTo('whatsapp/templates/new')}
                            className="gap-1"
                        >
                            <Plus className="w-4 h-4" />
                            Create Template
                        </Button>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={syncTemplates}
                                        disabled={syncing}
                                        className="gap-1"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Fetch latest template status from Meta</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search templates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>

                {/* Status filter */}
                <div className="flex gap-2 flex-wrap">
                    {['', 'APPROVED', 'PENDING', 'REJECTED'].map(status => (
                        <Button
                            key={status || 'all'}
                            size="sm"
                            variant={statusFilter === status ? 'default' : 'outline'}
                            onClick={() => setStatusFilter(status)}
                            className="text-xs"
                        >
                            {status || 'All'}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Templates list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredTemplates.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                        <p>No templates found</p>
                        <p className="text-sm mt-2">Click "Refresh" to fetch from Meta</p>
                    </div>
                ) : (
                    filteredTemplates.map((template) => (
                        <TemplateCard
                            key={template.id}
                            template={template}
                            isReal={true}
                            onSend={() => onSendTemplate(template)}
                            onEdit={() => navigateTo(`whatsapp/templates/${template.id}/edit`)}
                            onSync={() => syncSingleTemplate(template)}
                            isSyncing={syncingTemplateId === template.id}
                            onDuplicate={() => duplicateTemplate(template)}
                            onArchive={() => {
                                setSelectedTemplateForAction(template);
                                setArchiveConfirmOpen(true);
                            }}
                            onDelete={() => {
                                setSelectedTemplateForAction(template);
                                setDeleteConfirmOpen(true);
                            }}
                        />
                    ))
                )}
            </div>

            {/* Archive Confirmation Dialog */}
            <AlertDialog open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Archive Template</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to archive "{selectedTemplateForAction?.name}"?
                            Archived templates will be hidden from your list but can be restored later.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={archiveTemplate} className="bg-amber-600 hover:bg-amber-700">
                            Archive
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Template</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{selectedTemplateForAction?.name}"?
                            This will also delete the template from Meta's servers. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={deleteTemplate} className="bg-red-600 hover:bg-red-700">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
