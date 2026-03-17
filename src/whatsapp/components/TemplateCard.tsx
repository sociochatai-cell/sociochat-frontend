// Template Card Component
// ========================
// Displays a single template card (real or suggestion)

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TemplateStatusBadge } from './TemplateStatusBadge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Send, Sparkles, FileText, ShoppingCart, Shield, Megaphone, RefreshCw, Clock, AlertTriangle, MoreHorizontal, Copy, Archive, Trash2 } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

export interface Template {
    id: number | string;
    name: string;
    category: string;
    language: string;
    status?: string;
    body_text?: string;
    header_text?: string;
    header_format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'; // Header format type
    header_image_url?: string; // Stored header image URL from template creation
    footer_text?: string;
    variable_count?: number;
    variable_mapping?: Record<string, string> | null; // User-defined names for {{1}}, {{2}}, etc.
    rejection_reason?: string;
    quality_score?: string; // GREEN, YELLOW, RED
    last_synced_at?: string; // ISO timestamp
    components?: Array<{ type: string; format?: string; text?: string; example?: unknown }>;
    // Phase 2: Dual Status
    local_status?: string; // DRAFT, SUBMITTED, ARCHIVED
    meta_status?: string; // APPROVED, REJECTED, PENDING
    is_archived?: boolean;
    archived_at?: string;
    created_at?: string;
    // For suggestions
    title?: string;
    preview?: string;
    description?: string;
    variables?: number;
}

interface TemplateCardProps {
    template: Template;
    isReal: boolean; // true = real template from Meta, false = suggestion
    onSend?: () => void;
    onUse?: () => void;
    onEdit?: () => void;
    onDuplicate?: () => void;
    onArchive?: () => void;
    onDelete?: () => void;
    onSync?: () => void; // Sync single template
    isSyncing?: boolean; // Loading state for sync
    disabled?: boolean;
}

const categoryConfig: Record<string, { icon: typeof FileText; color: string }> = {
    UTILITY: { icon: ShoppingCart, color: 'bg-blue-100 text-blue-700' },
    MARKETING: { icon: Megaphone, color: 'bg-purple-100 text-purple-700' },
    AUTHENTICATION: { icon: Shield, color: 'bg-amber-100 text-amber-700' },
};

// Format relative time
function formatLastSynced(isoDate?: string): string {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

export function TemplateCard({ template, isReal, onSend, onUse, onEdit, onDuplicate, onArchive, onDelete, onSync, isSyncing, disabled }: TemplateCardProps) {
    const name = template.title || template.name;
    const body = template.preview || template.body_text || '';
    const desc = template.description;
    const category = template.category?.toUpperCase() || 'UTILITY';

    // Determine Display Status
    let status = template.status?.toUpperCase() || 'PENDING';
    if (template.is_archived) status = 'ARCHIVED';
    else if (template.local_status === 'DRAFT') status = 'DRAFT';
    else if (template.meta_status) status = template.meta_status.toUpperCase();

    const variableCount = template.variables ?? template.variable_count ?? 0;
    const isApproved = status === 'APPROVED';
    const isRejected = status === 'REJECTED';
    const isPaused = status === 'PAUSED';
    const isPending = status === 'PENDING';

    const catConfig = categoryConfig[category] || categoryConfig.UTILITY;
    const CategoryIcon = catConfig.icon;

    return (
        <Card className={cn(
            'relative overflow-hidden transition-all duration-200 hover:shadow-md',
            'border-l-4',
            isReal
                ? (isApproved ? 'border-l-green-500' : isRejected ? 'border-l-red-500' : 'border-l-yellow-500')
                : 'border-l-primary/50',
            !isReal && 'bg-gradient-to-br from-background to-primary/5'
        )}>
            {/* Suggestion indicator */}
            {!isReal && (
                <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="gap-1 text-xs">
                        <Sparkles className="w-3 h-3" />
                        Suggestion
                    </Badge>
                </div>
            )}

            <CardContent className="p-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Badge variant="outline" className={cn('gap-1 shrink-0', catConfig.color)}>
                            <CategoryIcon className="w-3 h-3" />
                            {category}
                        </Badge>
                        <span className="text-xs text-muted-foreground shrink-0">{template.language}</span>
                    </div>
                    {isReal && status && (
                        <TemplateStatusBadge status={status} className="shrink-0" />
                    )}
                </div>

                {/* Template name */}
                <h4 className="font-semibold text-sm mb-1 truncate">{name}</h4>

                {/* Description for suggestions */}
                {desc && !isReal && (
                    <p className="text-xs text-muted-foreground mb-2">{desc}</p>
                )}

                {/* Body preview */}
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {body || 'No preview available'}
                </p>

                {/* Variables indicator */}
                {variableCount > 0 && (
                    <p className="text-xs text-muted-foreground mb-3">
                        📝 {variableCount} variable{variableCount > 1 ? 's' : ''} required
                    </p>
                )}

                {/* Rejection reason */}
                {isReal && isRejected && template.rejection_reason && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="text-xs text-red-600 bg-red-50 p-2 rounded mb-3 cursor-help flex items-start gap-1">
                                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                                    <span className="line-clamp-2"><strong>Reason:</strong> {template.rejection_reason}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                <p className="text-sm">{template.rejection_reason}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* Paused warning */}
                {isReal && isPaused && (
                    <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded mb-3 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Template paused due to low quality rating</span>
                    </div>
                )}

                {/* Quality score badge (if available and not GREEN) */}
                {isReal && template.quality_score && template.quality_score !== 'GREEN' && (
                    <div className={cn(
                        'text-xs p-2 rounded mb-3 flex items-center gap-1',
                        template.quality_score === 'YELLOW' && 'text-amber-700 bg-amber-50',
                        template.quality_score === 'RED' && 'text-red-700 bg-red-50'
                    )}>
                        <AlertTriangle className="w-3 h-3" />
                        <span>Quality: {template.quality_score}</span>
                    </div>
                )}

                {/* Last synced indicator */}
                {isReal && template.last_synced_at && (
                    <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Synced {formatLastSynced(template.last_synced_at)}</span>
                    </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {isReal ? (
                        <>
                            <Button
                                size="sm"
                                onClick={onSend}
                                disabled={disabled || !isApproved}
                                className={cn(
                                    'flex-1',
                                    isApproved
                                        ? 'bg-[#25D366] hover:bg-[#128C7E] text-white'
                                        : 'opacity-50 cursor-not-allowed'
                                )}
                            >
                                <Send className="w-3 h-3 mr-1" />
                                {isApproved ? 'Send' : isPending ? 'Pending' : 'Cannot Send'}
                            </Button>
                            {isRejected && onEdit && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={onEdit}
                                    className="border-orange-500 text-orange-600 hover:bg-orange-50"
                                >
                                    Edit & Resubmit
                                </Button>
                            )}
                            {/* Sync button */}
                            {onSync && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={onSync}
                                                disabled={isSyncing}
                                                className="px-2"
                                            >
                                                <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Sync status from Meta</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </>
                    ) : (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onUse}
                            disabled={disabled}
                            className="flex-1 border-primary text-primary hover:bg-primary hover:text-white"
                        >
                            <FileText className="w-3 h-3 mr-1" />
                            Use this template
                        </Button>
                    )}

                    {/* More Actions Dropdown */}
                    {isReal && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={onEdit} disabled={template.is_archived}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    <span>Edit</span>
                                </DropdownMenuItem>
                                {onDuplicate && (
                                    <DropdownMenuItem onClick={onDuplicate}>
                                        <Copy className="mr-2 h-4 w-4" />
                                        <span>Duplicate as Draft</span>
                                    </DropdownMenuItem>
                                )}
                                {onArchive && !template.is_archived && (
                                    <DropdownMenuItem onClick={onArchive} className="text-amber-600 focus:text-amber-600">
                                        <Archive className="mr-2 h-4 w-4" />
                                        <span>Archive</span>
                                    </DropdownMenuItem>
                                )}
                                {onDelete && (
                                    <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        <span>Delete</span>
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
