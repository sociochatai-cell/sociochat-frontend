/**
 * EndNode Component
 * =================
 * Terminal node for conversation endings.
 * Shows final message and has no output handles.
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { CheckCircle, ThumbsUp } from 'lucide-react';
import { NODE_COLORS } from '../constants';

interface EndNodeData {
    message?: string;
    showSatisfactionSurvey?: boolean;
}

export const EndNode = memo(({ data, selected }: NodeProps<EndNodeData>) => {
    const colors = NODE_COLORS.end;

    return (
        <div
            className={`
                relative px-5 py-4 rounded-xl shadow-lg border-2 min-w-[220px]
                transition-all duration-200
                ${selected ? 'ring-2 ring-amber-400 ring-offset-2' : ''}
            `}
            style={{
                backgroundColor: colors.bg,
                borderColor: colors.border,
            }}
        >
            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Top}
                id="input"
                className="w-4 h-4 !bg-amber-500 border-2 border-white shadow-md"
                style={{ top: -8 }}
            />

            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: colors.border }}
                >
                    <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                    <div className="font-semibold text-sm" style={{ color: colors.text }}>
                        End
                    </div>
                    <div className="text-xs text-gray-500">
                        Conversation ends
                    </div>
                </div>
            </div>

            {/* Final Message */}
            {data.message && (
                <div
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
                >
                    <span style={{ color: colors.text }}>
                        {data.message}
                    </span>
                </div>
            )}

            {/* Satisfaction Survey indicator */}
            {data.showSatisfactionSurvey && (
                <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <ThumbsUp className="w-3 h-3" />
                    <span>Satisfaction survey enabled</span>
                </div>
            )}
        </div>
    );
});

EndNode.displayName = 'EndNode';
