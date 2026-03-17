import React, { useState, useEffect, useCallback, useId } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  FileText,
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Eye,
  Filter,
  MessageSquare,
  Link as LinkIcon,
  Image as ImageIcon,
  Video,
  Loader2,
  X,
  ChevronDown,
  Trash2,
  Plus,
  ExternalLink,
  Settings2
} from 'lucide-react';
import { VariableMappingEditor } from '@/whatsapp/components/VariableMappingEditor';
import { whatsappApi, type MessageTemplate } from '../api';
import { API_BASE_URL } from "@/config";

const API_BASE = API_BASE_URL;

// ============================================================
// Types
// ============================================================

interface TemplateManagerProps {
  workspaceId?: string;
}

type TemplateStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'all';

// ============================================================
// Helper Components
// ============================================================

const TemplateSkeleton: React.FC = () => (
  <TableRow>
    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
    <TableCell><Skeleton className="h-8 w-16" /></TableCell>
  </TableRow>
);

const StatusBadge: React.FC<{ status: MessageTemplate['status'] }> = ({ status }) => {
  switch (status) {
    case 'APPROVED':
      return (
        <Badge variant="default" className="bg-green-500 hover:bg-green-600">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Approved
        </Badge>
      );
    case 'PENDING':
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    case 'REJECTED':
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Rejected
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const CategoryBadge: React.FC<{ category: string }> = ({ category }) => {
  const categoryColors: Record<string, string> = {
    MARKETING: 'bg-purple-100 text-purple-800',
    UTILITY: 'bg-blue-100 text-blue-800',
    AUTHENTICATION: 'bg-orange-100 text-orange-800',
  };

  return (
    <Badge variant="outline" className={categoryColors[category] || ''}>
      {category.charAt(0) + category.slice(1).toLowerCase()}
    </Badge>
  );
};

// ============================================================
// Template Preview Dialog
// ============================================================

interface TemplatePreviewProps {
  template: MessageTemplate | null;
  isOpen: boolean;
  onClose: () => void;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({ template, isOpen, onClose }) => {
  if (!template) return null;

  const getComponentIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'header':
        return <ImageIcon className="w-4 h-4" />;
      case 'body':
        return <MessageSquare className="w-4 h-4" />;
      case 'footer':
        return <FileText className="w-4 h-4" />;
      case 'buttons':
        return <LinkIcon className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  // Replace {{1}}, {{2}} with {{alias}} if mapping exists
  const getDisplayText = (text: string | undefined): string => {
    if (!text) return '';
    let result = text;
    if (template.variable_mapping) {
      Object.entries(template.variable_mapping).forEach(([pos, alias]) => {
        result = result.replace(new RegExp(`\\{\\{${pos}\\}\\}`, 'g'), `{{${alias}}}`);
      });
    }
    return result;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-500" />
            {template.name}
          </DialogTitle>
          <DialogDescription>
            Template preview and details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status and Meta */}
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={template.status} />
            <CategoryBadge category={template.category} />
            <Badge variant="outline">{template.language}</Badge>
            {(template.variable_count || 0) > 0 && (
              <Badge variant="secondary" className="gap-1">
                📝 {template.variable_count} variable{(template.variable_count || 0) > 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {/* Variable Aliases Info */}
          {template.variable_mapping && Object.keys(template.variable_mapping).length > 0 && (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-xs font-medium text-green-800 mb-2">Configured Aliases:</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(template.variable_mapping).map(([pos, alias]) => (
                  <Badge key={pos} variant="outline" className="text-xs bg-white">
                    {`{{${pos}}} → {{${alias}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Template Preview */}
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="bg-background rounded-lg p-4 border max-w-[280px] mx-auto shadow-sm">
                {template.components.map((component, index) => (
                  <div key={index} className="mb-3 last:mb-0">
                    {component.type.toUpperCase() === 'HEADER' && (
                      <div className="mb-2">
                        {component.format === 'IMAGE' ? (
                          <div className="w-full h-32 bg-muted rounded flex items-center justify-center">
                            <ImageIcon className="w-8 h-8 text-muted-foreground" />
                          </div>
                        ) : component.format === 'VIDEO' ? (
                          <div className="w-full h-32 bg-muted rounded flex items-center justify-center">
                            <Video className="w-8 h-8 text-muted-foreground" />
                          </div>
                        ) : component.text ? (
                          <p className="font-semibold text-sm">{getDisplayText(component.text)}</p>
                        ) : null}
                      </div>
                    )}

                    {component.type.toUpperCase() === 'BODY' && (
                      <p className="text-sm whitespace-pre-wrap">{getDisplayText(component.text)}</p>
                    ) || (component.type.toLowerCase() === 'body' && (
                      <p className="text-sm whitespace-pre-wrap">{getDisplayText(component.text)}</p>
                    ))}

                    {component.type.toUpperCase() === 'FOOTER' && (
                      <p className="text-xs text-muted-foreground mt-2">{getDisplayText(component.text)}</p>
                    )}

                    {component.type.toUpperCase() === 'BUTTONS' && component.buttons && (
                      <div className="mt-3 space-y-1">
                        {component.buttons.map((button, btnIndex) => (
                          <div
                            key={btnIndex}
                            className="w-full p-2 text-center text-sm text-blue-500 border-t first:border-t-0 cursor-pointer hover:bg-muted/50"
                          >
                            {button.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Components List */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Components</h4>
            {template.components.map((component, index) => (
              <div key={index} className="flex items-start gap-2 p-2 bg-muted/50 rounded text-sm">
                {getComponentIcon(component.type)}
                <div>
                  <span className="font-medium capitalize">{component.type.toLowerCase()}</span>
                  {component.format && (
                    <span className="text-muted-foreground ml-2">({component.format})</span>
                  )}
                  {component.text && (
                    <p className="text-muted-foreground text-xs mt-1 truncate max-w-[350px]">
                      {component.text}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// Main Component
// ============================================================

const TemplateManager: React.FC<TemplateManagerProps> = ({ workspaceId: propWorkspaceId }) => {
  const { id: routeWorkspaceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const wsFromStorage = localStorage.getItem('sv_whatsapp_workspace_id') || sessionStorage.getItem('sv_whatsapp_workspace_id');
  const workspaceId = propWorkspaceId || routeWorkspaceId || wsFromStorage || 'default';

  // Connection state
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [accountName, setAccountName] = useState<string | null>(null);

  // State
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TemplateStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<MessageTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Variable mapping editor state
  const [mappingEditorOpen, setMappingEditorOpen] = useState(false);
  const [templateToConfigureAliases, setTemplateToConfigureAliases] = useState<MessageTemplate | null>(null);

  const componentId = useId();

  // Check connection status first
  useEffect(() => {
    const checkConnection = async () => {
      setCheckingConnection(true);
      try {
        const res = await fetch(`${API_BASE}/api/whatsapp/connection-path?workspace_id=${workspaceId}`, {
          credentials: 'include',
        });
        const data = await res.json();

        if (data.status === 'CONNECTED') {
          setIsConnected(true);
          setAccountName(data.account_summary?.verified_name || null);
        } else {
          setIsConnected(false);
        }
      } catch (err) {
        console.error('Failed to check connection:', err);
        setIsConnected(false);
      } finally {
        setCheckingConnection(false);
      }
    };
    checkConnection();
  }, [workspaceId]);

  // ============================================================
  // Data Fetching
  // ============================================================

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const status = statusFilter === 'all' ? undefined : statusFilter;
      const response = await whatsappApi.getTemplates(workspaceId, status);

      if (response.error) {
        throw new Error(response.error);
      }

      setTemplates(response.templates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, statusFilter]);

  const handleSyncTemplates = useCallback(async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const response = await whatsappApi.syncTemplates(workspaceId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to sync templates');
      }

      // Refresh the list after syncing
      await fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync templates');
    } finally {
      setIsSyncing(false);
    }
  }, [workspaceId, fetchTemplates]);

  // Delete template handler
  const handleDeleteTemplate = useCallback(async () => {
    if (!templateToDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      // Use meta_template_id if available, otherwise fall back to local id
      const templateId = templateToDelete.meta_template_id || templateToDelete.id;
      const response = await whatsappApi.deleteTemplate(templateId, workspaceId);

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete template');
      }

      // Refresh the list after deleting
      await fetchTemplates();
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setIsDeleting(false);
    }
  }, [templateToDelete, workspaceId, fetchTemplates]);

  const openDeleteConfirm = useCallback((template: MessageTemplate) => {
    setTemplateToDelete(template);
    setDeleteConfirmOpen(true);
  }, []);

  // Load templates on mount and when filter changes
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Auto-sync from Meta on mount to pick up new/updated templates
  useEffect(() => {
    if (!isConnected || !workspaceId) return;
    // Run a background sync silently (don't show loading spinner)
    const autoSync = async () => {
      try {
        await whatsappApi.syncTemplates(workspaceId);
        // Re-fetch after sync to show latest
        await fetchTemplates();
      } catch {
        // Silent fail — manual sync button still available
      }
    };
    autoSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, workspaceId]);

  // ============================================================
  // Handlers
  // ============================================================

  const handleViewTemplate = useCallback((template: MessageTemplate) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  }, []);

  const handleConfigureAliases = useCallback((template: MessageTemplate) => {
    setTemplateToConfigureAliases(template);
    setMappingEditorOpen(true);
  }, []);

  const handleMappingSaved = useCallback((mapping: Record<string, string>) => {
    // Update the template in the list with the new mapping
    if (templateToConfigureAliases) {
      setTemplates(prev =>
        prev.map(t =>
          t.id === templateToConfigureAliases.id
            ? { ...t, variable_mapping: mapping }
            : t
        )
      );
    }
  }, [templateToConfigureAliases]);

  // ============================================================
  // Filtered & Computed Data
  // ============================================================

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(templates.map(t => t.category))];

  const stats = {
    total: templates.length,
    approved: templates.filter(t => t.status === 'APPROVED').length,
    pending: templates.filter(t => t.status === 'PENDING').length,
    rejected: templates.filter(t => t.status === 'REJECTED').length,
  };

  // ============================================================
  // Render
  // ============================================================

  // Loading state while checking connection
  if (checkingConnection) {
    return (
      <div className="p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-green-500" />
          <p className="text-muted-foreground">Checking WhatsApp connection...</p>
        </div>
      </div>
    );
  }

  // Not connected state
  if (isConnected === false) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Card className="max-w-md mx-auto">
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No WhatsApp Account Connected</h3>
            <p className="text-muted-foreground mb-6">Connect a WhatsApp Business Account to view and manage templates</p>
            <Button onClick={() => navigate('/dashboard/setup')} className="!bg-green-600 hover:!bg-green-700 !text-white">
              Connect WhatsApp
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-6 h-6 text-green-500" />
          Message Templates
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your WhatsApp Business message templates
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Templates</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="w-8 h-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TemplateStatus)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0) + cat.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sync Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleSyncTemplates}
                    disabled={isSyncing}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Syncing...' : 'Sync from Meta'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Sync templates from your WhatsApp Business Account
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* New Template Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => {
                      // Detect if we're in agent context and use appropriate path
                      const isAgentContext = window.location.pathname.startsWith('/agent');
                      const basePath = isAgentContext ? '/agent' : '/dashboard';
                      navigate(`${basePath}/templates/new`);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Template
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  Create a new message template
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Templates ({filteredTemplates.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <>
                  <TemplateSkeleton />
                  <TemplateSkeleton />
                  <TemplateSkeleton />
                </>
              ) : filteredTemplates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all'
                        ? 'No templates match your filters'
                        : 'No templates found. Click "Sync from Meta" to import your templates.'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTemplates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="font-medium">{template.name}</div>
                      <div className="text-xs text-muted-foreground">ID: {template.id}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{template.language}</Badge>
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={template.category} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={template.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Configure Aliases - only show if template has variables */}
                        {(template.variable_count || 0) > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleConfigureAliases(template)}
                                  className={
                                    template.variable_mapping && Object.keys(template.variable_mapping).length > 0
                                      ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                      : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'
                                  }
                                >
                                  <Settings2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {template.variable_mapping && Object.keys(template.variable_mapping).length > 0
                                  ? 'Edit Variable Aliases'
                                  : 'Configure Variable Aliases'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewTemplate(template)}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Template</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteConfirm(template)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete Template</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Template Preview Dialog */}
      <TemplatePreview
        template={selectedTemplate}
        isOpen={showPreview}
        onClose={() => {
          setShowPreview(false);
          setSelectedTemplate(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Template
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the template "{templateToDelete?.name}"?
              This will permanently remove it from both Meta and our database.
              <br /><br />
              <strong>Note:</strong> This will delete ALL language versions of this template.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setTemplateToDelete(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTemplate}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error Alert */}
      {error && (
        <div className="fixed bottom-4 right-4 max-w-sm">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="ml-2"
              >
                <X className="w-3 h-3" />
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Variable Mapping Editor Modal */}
      {templateToConfigureAliases && (
        <VariableMappingEditor
          open={mappingEditorOpen}
          onOpenChange={setMappingEditorOpen}
          templateId={parseInt(String(templateToConfigureAliases.id))}
          templateName={templateToConfigureAliases.name}
          variableCount={templateToConfigureAliases.variable_count || 0}
          bodyText={templateToConfigureAliases.body_text || templateToConfigureAliases.components?.find(c => c.type === 'BODY')?.text}
          headerText={templateToConfigureAliases.components?.find(c => c.type === 'HEADER')?.text}
          footerText={templateToConfigureAliases.components?.find(c => c.type === 'FOOTER')?.text}
          existingMapping={templateToConfigureAliases.variable_mapping}
          onSaved={handleMappingSaved}
        />
      )}
    </div>
  );
};

export default TemplateManager;
