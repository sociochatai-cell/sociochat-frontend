/**
 * TemplateNode Component
 * ======================
 * Template message node for using existing WhatsApp templates in flows.
 * Quick reply and Flow form buttons have source handles for connections.
 * URL/Phone buttons are display-only (they exit the flow).
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
    FileText,
    ArrowRight,
    Link,
    Phone,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TemplateButtonMapping } from '../types';
import { NODE_COLORS } from '../constants';

interface TemplateNodeData {
    templateId?: number;
    templateName?: string;
    templateLanguage?: string;
    templateCategory?: string;
    templateStatus?: string;
    buttonMappings: TemplateButtonMapping[];
    variables?: Record<string, string>;
}

const ButtonIcons: Record<string, React.ElementType> = {
    quick_reply: ArrowRight,
    flow: FileText,
    url: Link,
    phone: Phone,
};

const ButtonColors: Record<string, string> = {
    quick_reply: '#8B5CF6', // purple for template buttons
    flow: '#7C3AED', // violet for WhatsApp Flow forms
    url: '#3B82F6', // blue
    phone: '#10B981', // green
};

const StatusColors: Record<string, string> = {
    APPROVED: '#10B981',
    PENDING: '#F59E0B',
    REJECTED: '#EF4444',
};

export const TemplateNode = memo(({ data, selected }: NodeProps<TemplateNodeData>) => {
    const colors = NODE_COLORS.template;
    const statusColor = data.templateStatus ? StatusColors[data.templateStatus] || '#6B7280' : '#6B7280';

    return (
        <div
            className={`
                relative px-0 py-0 rounded-xl shadow-lg border-2 min-w-[300px] max-w-[320px]
                transition-all duration-200 bg-white
                ${selected ? 'ring-2 ring-purple-400 ring-offset-0' : ''}
                ${(data as any).validationIssues?.some((i: any) => !i.handleId) ? 'node-error' : ''}
            `}
            style={{
                borderColor: colors.border,
            }}
        >
            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Top}
                id="input"
                className="w-4 h-4 !bg-purple-500 border-2 border-white shadow-md"
                style={{ top: -8 }}
            />

            {/* Header Bar */}
            <div
                className="px-4 py-2 flex items-center justify-between rounded-t-[10px]"
                style={{ backgroundColor: colors.bg }}
            >
                <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" style={{ color: colors.border }} />
                    <span className="text-xs font-medium" style={{ color: colors.text }}>
                        Template Message
                    </span>
                </div>
                {data.templateStatus && (
                    <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 flex items-center gap-1"
                        style={{ 
                            borderColor: statusColor,
                            color: statusColor 
                        }}
                    >
                        {data.templateStatus === 'APPROVED' ? (
                            <CheckCircle2 className="w-3 h-3" />
                        ) : (
                            <AlertCircle className="w-3 h-3" />
                        )}
                        {data.templateStatus}
                    </Badge>
                )}
            </div>

            {/* Template Info */}
            <div className="p-4">
                {data.templateName ? (
                    <>
                        <div className="font-semibold text-sm text-gray-800 mb-1">
                            {data.templateName}
                        </div>
                        {data.templateCategory && (
                            <Badge variant="secondary" className="text-[10px] mb-2">
                                {data.templateCategory}
                            </Badge>
                        )}
                        {data.templateLanguage && (
                            <div className="text-xs text-gray-500 mt-1">
                                Language: {data.templateLanguage}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-sm text-gray-400 italic flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Select a template...
                    </div>
                )}
            </div>

            {/* Button Mappings */}
            <div className="border-t border-gray-100 rounded-b-[10px]">
                {data.buttonMappings.map((mapping, index) => {
                    const Icon = ButtonIcons[mapping.buttonType] || ArrowRight;
                    const buttonColor = ButtonColors[mapping.buttonType] || '#8B5CF6';
                    const canConnect = mapping.buttonType === 'quick_reply' || mapping.buttonType === 'flow';

                    return (
                        <div
                            key={index}
                            className={`
                                relative flex items-center justify-between px-4 py-2.5
                                hover:bg-gray-50 transition-colors
                                ${index < data.buttonMappings.length - 1 ? 'border-b border-gray-100' : ''}
                                ${canConnect ? 'cursor-pointer' : 'cursor-not-allowed opacity-75'}
                            `}
                        >
                            <div className="flex items-center gap-2">
                                <Icon
                                    className="w-4 h-4"
                                    style={{ color: buttonColor }}
                                />
                                <span
                                    className="text-sm font-medium"
                                    style={{ color: canConnect ? buttonColor : '#9CA3AF' }}
                                >
                                    {mapping.buttonText || `Button ${index + 1}`}
                                </span>
                            </div>

                            {/* Badge for non-connectable buttons */}
                            {!canConnect && (
                                <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0"
                                >
                                    {mapping.buttonType === 'flow' ? 'Opens Form' : mapping.buttonType === 'url' ? 'Opens URL' : 'Calls Phone'}
                                </Badge>
                            )}

                            {/* Source Handle for quick_reply buttons only */}
                            {canConnect && (
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={`btn-${index}`}
                                    className={`w-3 h-3 border-2 border-white shadow-md ${
                                        (data as any).validationIssues?.some((i: any) => i.handleId === `btn-${index}`) ? 'react-flow__handle-glow-error' : ''
                                    }`}
                                    style={{
                                        backgroundColor: buttonColor,
                                        right: -6,
                                    }}
                                />
                            )}
                        </div>
                    );
                })}

                {/* Empty state */}
                {(!data.buttonMappings || data.buttonMappings.length === 0) && data.templateName && (
                    <div className="px-4 py-3 text-center text-gray-400 text-sm">
                        No buttons in template
                    </div>
                )}

                {/* Hint for templates without quick reply buttons */}
                {data.buttonMappings && 
                 data.buttonMappings.length > 0 && 
                 !data.buttonMappings.some(m => m.buttonType === 'quick_reply' || m.buttonType === 'flow') && (
                    <div className="px-4 py-2 text-center text-amber-600 text-xs bg-amber-50 border-t border-dashed border-amber-200">
                        ⚠️ No routable buttons - automation ends here
                    </div>
                )}
            </div>
        </div>
    );
});

TemplateNode.displayName = 'TemplateNode';
