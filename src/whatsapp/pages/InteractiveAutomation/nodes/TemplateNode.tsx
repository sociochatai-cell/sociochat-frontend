/**
 * TemplateNode Component
 * ======================
 * WhatsApp template node for automation flows.
 * Displays template preview with quick_reply buttons as connection handles.
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { FileText, ArrowRight, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TemplateButton } from '../types';
import { NODE_COLORS } from '../constants';

interface TemplateNodeData {
    templateId: number;
    templateName: string;
    languageCode: string;
    category: string;
    headerText?: string;
    bodyText?: string;
    footerText?: string;
    buttons: TemplateButton[];
    variableCount: number;
    bodyParams?: string[];
    headerTextVar?: string;
    headerImageUrl?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
    UTILITY: '#10B981',
    MARKETING: '#F59E0B',
    AUTHENTICATION: '#8B5CF6',
};

export const TemplateNode = memo(({ data, selected }: NodeProps<TemplateNodeData>) => {
    const colors = NODE_COLORS.template;
    const categoryColor = CATEGORY_COLORS[data.category] || '#6B7280';

    return (
        <div
            className={`
                relative px-0 py-0 rounded-xl shadow-lg border-2 min-w-[300px] max-w-[320px]
                transition-all duration-200 bg-white
                ${selected ? 'ring-2 ring-blue-400 ring-offset-2' : ''}
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
                className="w-4 h-4 !bg-blue-500 border-2 border-white shadow-md"
                style={{ top: -8 }}
            />

            {/* Header Bar */}
            <div
                className="px-4 py-2 flex items-center gap-2 rounded-t-[10px]"
                style={{ backgroundColor: colors.bg }}
            >
                <FileText className="w-4 h-4" style={{ color: colors.border }} />
                <span className="text-xs font-medium" style={{ color: colors.text }}>
                    Template Message
                </span>
                <Badge
                    className="ml-auto text-[10px] px-1.5 py-0 text-white"
                    style={{ backgroundColor: categoryColor }}
                >
                    {data.category}
                </Badge>
            </div>

            {/* Template Info */}
            <div className="p-4">
                {/* Template name */}
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-800 truncate">
                        {data.templateName || 'Select template...'}
                    </span>
                    {data.languageCode && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                            {data.languageCode}
                        </Badge>
                    )}
                </div>

                {/* Header text */}
                {data.headerText && (
                    <div className="font-medium text-sm text-gray-800 mb-1">
                        {data.headerText}
                    </div>
                )}

                {/* Body preview */}
                <div className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                    {data.bodyText || 'No body text'}
                </div>

                {/* Footer */}
                {data.footerText && (
                    <div className="text-xs text-gray-400 mt-2">
                        {data.footerText}
                    </div>
                )}

                {/* Variable count indicator */}
                {data.variableCount > 0 && (
                    <div className="mt-2 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 text-blue-400" />
                        <span className="text-[10px] text-blue-500">
                            {data.variableCount} variable{data.variableCount > 1 ? 's' : ''}
                        </span>
                    </div>
                )}
            </div>

            {/* Quick Reply Buttons */}
            <div className="border-t border-gray-100 rounded-b-[10px]">
                {data.buttons.map((button, index) => (
                    <div
                        key={button.handleId}
                        className={`
                            relative flex items-center justify-between px-4 py-2.5
                            hover:bg-blue-50/50 transition-colors
                            ${index < data.buttons.length - 1 ? 'border-b border-gray-100' : ''}
                        `}
                    >
                        <div className="flex items-center gap-2">
                            <ArrowRight
                                className="w-4 h-4"
                                style={{ color: colors.border }}
                            />
                            <span
                                className="text-sm font-medium"
                                style={{ color: colors.border }}
                            >
                                {button.text}
                            </span>
                        </div>

                        {/* Source Handle for this button */}
                        <Handle
                            type="source"
                            position={Position.Right}
                            id={button.handleId}
                            className="w-3 h-3 border-2 border-white shadow-md"
                            style={{
                                backgroundColor: colors.border,
                                right: -6,
                            }}
                        />
                    </div>
                ))}

                {/* Empty state */}
                {data.buttons.length === 0 && (
                    <div className="px-4 py-3 text-center text-gray-400 text-sm">
                        No quick reply buttons
                    </div>
                )}
            </div>
        </div>
    );
});

TemplateNode.displayName = 'TemplateNode';
