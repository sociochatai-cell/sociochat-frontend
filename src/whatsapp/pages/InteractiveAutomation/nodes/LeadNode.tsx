/**
 * LeadNode Component
 * ==================
 * Dedicated "Mark as Lead" step. Creates / updates a CRM lead when reached.
 * Has an input handle only (the node itself is the terminal action), mirroring
 * the EndNode's shape.
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { UserPlus } from 'lucide-react';
import { NODE_COLORS } from '../constants';
import type { LeadNode as LeadNodeType } from '../types';

export const LeadNode = memo(({ data, selected }: NodeProps<LeadNodeType['data']>) => {
    const colors = NODE_COLORS.lead;
    const stageLabel = data.stage ? ` → ${data.stage}` : '';

    return (
        <div
            className={`
                relative px-5 py-4 rounded-xl shadow-lg border-2 min-w-[220px]
                transition-all duration-200
                ${selected ? 'ring-2 ring-emerald-400 ring-offset-0' : ''}
                ${selected && (data as any).validationIssues?.length > 0 ? 'node-error' : ''}
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
                className="w-4 h-4 !bg-emerald-500 border-2 border-white shadow-md"
                style={{ top: -8 }}
            />

            {/* Header */}
            <div className="flex items-center gap-3 mb-1">
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: colors.border }}
                >
                    <UserPlus className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: colors.text }}>
                        {`Mark as Lead${stageLabel}`}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                        {data.leadType ? `Type: ${data.leadType}` : 'Create / update CRM lead'}
                    </div>
                </div>
            </div>
        </div>
    );
});

LeadNode.displayName = 'LeadNode';
