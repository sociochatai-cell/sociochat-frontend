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
    FileText,
    Flag
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
    onAddEndNode: () => void;
    onAutoLayout: () => void;
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
    onAddEndNode,
    onAutoLayout,
}: FlowToolbarProps) {
    const navigate = useNavigate();

    const errorCount = validationIssues.filter(i => i.severity === 'error').length;
    const warningCount = validationIssues.filter(i => i.severity === 'warning').length;
    const hasErrors = errorCount > 0;

    return (
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
            {/* Left Section */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/dashboard/automation')}
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
                    {flowStatus === 'published' && (
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
                {/* Validation Status */}
                {hasErrors ? (
                    <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {errorCount} error{errorCount > 1 ? 's' : ''}
                    </Badge>
                ) : warningCount > 0 ? (
                    <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {warningCount} warning{warningCount > 1 ? 's' : ''}
                    </Badge>
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
                            <FileText className="w-4 h-4 mr-2 text-blue-600" />
                            Template Node
                        </DropdownMenuItem>
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
                    disabled={isPublishing || hasErrors || flowStatus === 'published'}
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
