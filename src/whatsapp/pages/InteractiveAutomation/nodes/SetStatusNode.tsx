/**
 * SetStatusNode Component
 * =======================
 * Silently sets the lead's CRM status when the flow reaches this node.
 * No message is sent to the customer.
 * Has a single input handle (top) and a single output handle (bottom).
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Tag, Flag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SetStatusNode as SetStatusNodeType } from '../types';
import { NODE_COLORS, LEAD_STATUS_LABELS, SET_STATUS_MODE_LABELS } from '../constants';

export const SetStatusNode = memo(({ data, selected }: NodeProps<SetStatusNodeType['data']>) => {
    const colors = NODE_COLORS.set_status;
    // Fall back to sensible defaults so legacy nodes saved without status/mode never render blank.
    const status = data.status || 'qualified';
    const mode = data.mode || 'advance';
    const statusLabel = LEAD_STATUS_LABELS[status] || status;
    const modeLabel = SET_STATUS_MODE_LABELS[mode] || mode;

    return (
        <div
            className={`
                relative px-5 py-4 rounded-xl shadow-lg border-2 min-w-[280px]
                transition-all duration-200 bg-white
                ${selected ? 'ring-2 ring-emerald-400 ring-offset-0' : ''}
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
                    <Tag className="w-5 h-5" style={{ color: colors.text }} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: colors.text }}>
                        Set Status: {statusLabel}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                        {modeLabel}
                    </div>
                </div>
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg p-2.5 mb-3 border border-gray-100 min-h-[40px]">
                <Flag className="w-4 h-4 shrink-0" style={{ color: colors.text }} />
                <span className="text-gray-500">Lead status</span>
                <Badge
                    variant="secondary"
                    className="ml-auto px-2 py-0 h-5 text-[11px] font-medium"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                    {statusLabel}
                </Badge>
            </div>

            {/* Silent note */}
            <div className="text-[11px] text-gray-400 italic mb-4 px-1">
                Silent — no message is sent.
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
                    className="w-4 h-4 border-2 border-white shadow-md z-10 !bg-gray-400 transition-all group-hover:scale-125 group-hover:!bg-emerald-500"
                    style={{ bottom: -8 }}
                />
            </div>
        </div>
    );
});

SetStatusNode.displayName = 'SetStatusNode';
