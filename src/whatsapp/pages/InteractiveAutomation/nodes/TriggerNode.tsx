/**
 * TriggerNode Component
 * =====================
 * Entry point node for the automation flow.
 * Shows trigger configuration and has a single output handle.
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Zap, Settings, MessageCircle, Hash, Clock, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TriggerType } from '../types';
import { TRIGGER_TYPE_LABELS, NODE_COLORS } from '../constants';

interface TriggerNodeData {
    triggerType: TriggerType;
    templateId?: string;
    keywords?: string[];
    firstMessageOnly?: boolean;
    oneTimeOnly?: boolean;
}

const TriggerIcons: Record<TriggerType, React.ElementType> = {
    any_reply: MessageCircle,
    specific_template: Settings,
    window_open: Clock,
    keyword: Hash,
};

export const TriggerNode = memo(({ data, selected }: NodeProps<TriggerNodeData>) => {
    const Icon = TriggerIcons[data.triggerType] || Zap;
    const colors = NODE_COLORS.trigger;

    return (
        <div
            className={`
                relative px-5 py-4 rounded-xl shadow-lg border-2 min-w-[260px]
                transition-all duration-200
                ${selected ? 'ring-2 ring-indigo-400 ring-offset-0' : ''}
                ${(data as any).validationIssues?.some((i: any) => !i.handleId) ? 'node-error' : ''}
            `}
            style={{
                backgroundColor: colors.bg,
                borderColor: colors.border,
            }}
        >
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: colors.border }}
                >
                    <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                    <div className="font-semibold text-sm" style={{ color: colors.text }}>
                        Trigger
                    </div>
                    <div className="text-xs text-gray-500">
                        Start of automation
                    </div>
                </div>
            </div>

            {/* Trigger Type */}
            <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)' }}
            >
                <Icon className="w-4 h-4" style={{ color: colors.border }} />
                <span style={{ color: colors.text }}>
                    {TRIGGER_TYPE_LABELS[data.triggerType]}
                </span>
            </div>

            {/* First Message Only Badge */}
            {data.firstMessageOnly && (
                <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                    <Lock className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-xs text-amber-700 font-medium">First message only</span>
                </div>
            )}

            {data.oneTimeOnly && (
                <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-xs text-emerald-700 font-medium">One time only</span>
                </div>
            )}

            {/* Keywords badge if applicable */}
            {data.triggerType === 'keyword' && data.keywords && data.keywords.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {data.keywords.slice(0, 3).map((kw, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                            {kw}
                        </Badge>
                    ))}
                    {data.keywords.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                            +{data.keywords.length - 3} more
                        </Badge>
                    )}
                </div>
            )}

            {/* Output Handle - Always needed for Trigger */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="output"
                className={`w-4 h-4 !bg-indigo-500 border-2 border-white shadow-md ${
                    (data as any).validationIssues?.some((i: any) => i.handleId === 'output') ? 'react-flow__handle-glow-error' : ''
                }`}
                style={{ bottom: -8 }}
            />
        </div>
    );
});

TriggerNode.displayName = 'TriggerNode';
