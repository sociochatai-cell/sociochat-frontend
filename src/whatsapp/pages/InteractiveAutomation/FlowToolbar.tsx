/**
 * FlowToolbar Component
 * =====================
 * Top toolbar with flow name, actions, and validation status.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Save,
    Play,
    AlertTriangle,
    CheckCircle,
    Plus,
    Loader2,
    LayoutGrid,
    MessageCircle,
    Flag,
    FileText,
    Keyboard,
    Plug,
    Sparkles,
    KeyRound,
    UserPlus,
    BadgeCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { FlowStatus, ValidationIssue } from './types';

interface FlowToolbarProps {
    flowName: string;
    flowStatus: FlowStatus;
    isDirty: boolean;
    isSaving: boolean;
    isPublishing: boolean;
    validationIssues: ValidationIssue[];
    onNameChange: (name: string) => void;
    onSave: () => void;
    onPublish: () => void;
    onAddMessageNode: () => void;
    onAddTemplateNode: () => void;
    onAddInputNode: () => void;
    onAddApiNode: () => void;
    onAddLeadNode: () => void;
    onAddSetStatusNode?: () => void;
    onAddEndNode: () => void;
    onAutoLayout: () => void;
    onGenerateWithAi?: () => void;
    onOpenFlowSettings?: () => void;
    hasFlowVariables?: boolean;
}

export function FlowToolbar({
    flowName,
    flowStatus,
    isDirty,
    isSaving,
    isPublishing,
    validationIssues,
    onNameChange,
    onSave,
    onPublish,
    onAddMessageNode,
    onAddTemplateNode,
    onAddInputNode,
    onAddApiNode,
    onAddLeadNode,
    onAddSetStatusNode,
    onAddEndNode,
    onAutoLayout,
    onGenerateWithAi,
    onOpenFlowSettings,
    hasFlowVariables,
}: FlowToolbarProps) {
    const navigate = useNavigate();

    const errorCount = validationIssues.filter(i => i.severity === 'error').length;
    const warningCount = validationIssues.filter(i => i.severity === 'warning').length;
    const hasErrors = errorCount > 0;
    const hasWarnings = warningCount > 0;
    const hasValidationIssues = errorCount > 0 || warningCount > 0;

    const validationSummary = [
        errorCount > 0 ? `${errorCount} error${errorCount > 1 ? 's' : ''}` : null,
        warningCount > 0 ? `${warningCount} warning${warningCount > 1 ? 's' : ''}` : null,
    ].filter(Boolean).join(' • ');

    return (
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
            {/* Left Section */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/dashboard/whatsapp/automation')}
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                </Button>

                {/* Flow Name */}
                <div className="flex items-center gap-2">
                    <Input
                        value={flowName}
                        onChange={(e) => onNameChange(e.target.value)}
                        className="w-52 h-8 font-medium border-0 hover:bg-gray-100 focus-visible:ring-1"
                        placeholder="Automation name..."
                    />
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2">
                    {(flowStatus === 'published' || flowStatus === 'active') && (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            Published
                        </Badge>
                    )}
                    {flowStatus === 'draft' && (
                        <Badge variant="secondary">Draft</Badge>
                    )}
                    {isDirty && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                            Unsaved
                        </Badge>
                    )}
                </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2">
                {onOpenFlowSettings && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onOpenFlowSettings}
                        className={hasFlowVariables ? 'border-violet-200' : 'border-amber-300 text-amber-700'}
                    >
                        <KeyRound className="w-4 h-4 mr-2" />
                        Flow variables
                    </Button>
                )}
                {onGenerateWithAi && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onGenerateWithAi}
                        className="border-violet-200 text-violet-700 hover:bg-violet-50"
                    >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Do with AI
                    </Button>
                )}

                {/* Validation Status */}
                {hasValidationIssues ? (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button type="button" className="focus:outline-none">
                                <Badge
                                    variant={hasErrors ? 'destructive' : 'outline'}
                                    className={hasErrors ? 'gap-1' : 'text-amber-600 border-amber-300 gap-1'}
                                >
                                    <AlertTriangle className="w-3 h-3" />
                                    {validationSummary}
                                </Badge>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[360px]">
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-600">
                                Flow Validation Issues
                            </div>
                            <div className="max-h-72 overflow-y-auto">
                                {validationIssues.map((issue, index) => (
                                    <DropdownMenuItem
                                        key={`${issue.nodeId || 'flow'}-${issue.message}-${index}`}
                                        className="items-start gap-2 py-2"
                                    >
                                        <AlertTriangle
                                            className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                                                issue.severity === 'error' ? 'text-red-600' : 'text-amber-600'
                                            }`}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-gray-800 capitalize">
                                                {issue.severity}
                                                {issue.nodeId ? ` • ${issue.nodeId}` : ''}
                                            </div>
                                            <div className="text-xs text-gray-600 whitespace-normal break-words">
                                                {issue.message}
                                            </div>
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ) : validationIssues.length === 0 ? null : (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Ready
                    </Badge>
                )}

                {/* Add Node Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Node
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={onAddMessageNode}>
                            <MessageCircle className="w-4 h-4 mr-2 text-green-600" />
                            Message Node
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onAddTemplateNode}>
                            <FileText className="w-4 h-4 mr-2 text-purple-600" />
                            Template Node
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onAddInputNode}>
                            <Keyboard className="w-4 h-4 mr-2 text-sky-600" />
                            Input Node
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onAddApiNode}>
                            <Plug className="w-4 h-4 mr-2 text-violet-600" />
                            API Node
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={onAddLeadNode}>
                            <UserPlus className="w-4 h-4 mr-2 text-emerald-600" />
                            Lead Node
                        </DropdownMenuItem>
                        {onAddSetStatusNode && (
                            <DropdownMenuItem onClick={onAddSetStatusNode}>
                                <BadgeCheck className="w-4 h-4 mr-2 text-blue-600" />
                                Set Status (New / Contacted / Qualified)
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={onAddEndNode}>
                            <Flag className="w-4 h-4 mr-2 text-amber-600" />
                            End Node
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Auto Layout */}
                <Button variant="outline" size="sm" onClick={onAutoLayout}>
                    <LayoutGrid className="w-4 h-4 mr-2" />
                    Auto Layout
                </Button>

                {/* Save */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onSave}
                    disabled={isSaving || !isDirty}
                >
                    {isSaving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <Save className="w-4 h-4 mr-2" />
                    )}
                    Save
                </Button>

                {/* Publish */}
                <Button
                    size="sm"
                    onClick={onPublish}
                    disabled={
                        isPublishing ||
                        hasErrors ||
                        flowStatus === 'published' ||
                        flowStatus === 'active'
                    }
                    className="bg-green-600 hover:bg-green-700"
                >
                    {isPublishing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                        <Play className="w-4 h-4 mr-2" />
                    )}
                    Publish
                </Button>
            </div>
        </header>
    );
}
