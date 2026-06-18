/**
 * InputNode Component
 * ===================
 * Captures a free-text user response and stores it into a flow variable.
 * Has a single input handle (top) and a single output handle (bottom).
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Keyboard, HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { InputNode as InputNodeType } from '../types';
import { NODE_COLORS, VALIDATION_TYPE_LABELS } from '../constants';

export const InputNode = memo(({ data, selected }: NodeProps<InputNodeType['data']>) => {
    const colors = NODE_COLORS.input;

    return (
        <div
            className={`
                relative px-5 py-4 rounded-xl shadow-lg border-2 min-w-[280px]
                transition-all duration-200 bg-white
                ${selected ? 'ring-2 ring-sky-400 ring-offset-0' : ''}
            `}
            style={{ borderColor: colors.border }}
        >
            {/* Input Handle */}
            <Handle
                type="target"
                position={Position.Top}
                id="input"
                className="w-4 h-4 border-2 border-white shadow-md z-10"
                style={{ top: -8, backgroundColor: colors.border }}
            />

            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
                >
                    <Keyboard className="w-5 h-5" style={{ color: colors.text }} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: colors.text }}>
                        Input
                    </div>
                    <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                        Save to
                        <Badge variant="secondary" className="px-1 py-0 h-4 text-[10px] ml-1 font-normal">
                            {data.field || 'unnamed'}
                        </Badge>
                    </div>
                </div>
            </div>

            {/* Question Text */}
            <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-2.5 mb-3 border border-gray-100 min-h-[40px] flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                <span className="line-clamp-3 leading-tight break-words">
                    {data.body || <span className="text-gray-400 italic">No question set...</span>}
                </span>
            </div>

            {/* Validation Type */}
            <div className="flex items-center justify-between text-xs text-gray-500 mb-4 px-1">
                <span>Validation:</span>
                <span className="font-medium" style={{ color: colors.text }}>
                    {VALIDATION_TYPE_LABELS[data.validationType] || data.validationType}
                </span>
            </div>

            {/* Output / "Next step" */}
            <div className="relative group">
                <div className="w-full text-center py-2 bg-gray-50 hover:bg-gray-100 rounded-md text-sm text-gray-600 transition-colors">
                    Next step
                </div>
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id="output"
                    className="w-4 h-4 border-2 border-white shadow-md z-10 !bg-gray-400 transition-all group-hover:scale-125 group-hover:!bg-sky-500"
                    style={{ bottom: -8 }}
                />
            </div>
        </div>
    );
});

InputNode.displayName = 'InputNode';
