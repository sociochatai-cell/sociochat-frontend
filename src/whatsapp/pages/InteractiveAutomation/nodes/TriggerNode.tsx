/**
 * TriggerNode Component
 * =====================
 * Entry point node for the automation flow.
 * Shows trigger configuration and has a single output handle.
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Zap, Settings, MessageCircle, Hash, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TriggerType } from '../types';
import { TRIGGER_TYPE_LABELS, NODE_COLORS } from '../constants';

interface TriggerNodeData {
    triggerType: TriggerType;
    templateId?: string;
    keywords?: string[];
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
                ${selected ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}
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

            {/* Output Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="output"
                className="w-4 h-4 !bg-indigo-500 border-2 border-white shadow-md"
                style={{ bottom: -8 }}
            />
        </div>
    );
});

TriggerNode.displayName = 'TriggerNode';
