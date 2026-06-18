/**
 * ApiNode Component
 * =================
 * Calls an external HTTP API mid-flow. Exposes Success, Error and per-branch
 * output handles for routing the conversation based on the response.
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Plug } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ApiNode as ApiNodeType } from '../types';
import { NODE_COLORS } from '../constants';

export const ApiNode = memo(({ data, selected }: NodeProps<ApiNodeType['data']>) => {
    const colors = NODE_COLORS.api;
    const branches = data.branches || [];
    const method = (data.method || 'GET').toUpperCase();
    const urlPreview = (data.url || '').replace(/\{\{[^}]+\}\}/g, '…');

    return (
        <div
            className={`
                relative px-5 py-4 rounded-xl shadow-lg border-2 min-w-[300px]
                transition-all duration-200 bg-white
                ${selected ? 'ring-2 ring-violet-400 ring-offset-0' : ''}
            `}
            style={{ borderColor: colors.border }}
        >
            <Handle
                type="target"
                position={Position.Top}
                id="input"
                className="w-4 h-4 border-2 border-white shadow-md z-10"
                style={{ top: -8, backgroundColor: colors.border }}
            />

            <div className="flex items-center gap-3 mb-3">
                <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
                >
                    <Plug className="w-5 h-5" style={{ color: colors.text }} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate" style={{ color: colors.text }}>
                        {data.label || 'API Call'}
                    </div>
                    <div className="text-xs text-gray-500 truncate flex items-center gap-1">
                        <Badge variant="outline" className="px-1 py-0 h-4 text-[10px] font-mono">
                            {method}
                        </Badge>
                        <span className="truncate">{urlPreview || 'No URL'}</span>
                    </div>
                </div>
            </div>

            {data.storeAs && (
                <div className="text-[11px] text-gray-500 mb-3">
                    Stores response as <code className="bg-gray-100 px-1 rounded">{data.storeAs}</code>
                </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
                <div className="relative flex-1 min-w-[88px]">
                    <div className="text-center py-1.5 px-2 bg-green-50 rounded-md text-xs text-green-800 border border-green-200 leading-tight">
                        Success
                        <div className="text-[9px] font-normal text-green-700">default next / after pick</div>
                    </div>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="success"
                        className="w-3.5 h-3.5 border-2 border-white shadow-md !bg-green-500"
                        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
                    />
                </div>
                <div className="relative flex-1 min-w-[88px]">
                    <div className="text-center py-1.5 px-2 bg-red-50 rounded-md text-xs text-red-800 border border-red-200">
                        Error
                    </div>
                    <Handle
                        type="source"
                        position={Position.Bottom}
                        id="error"
                        className="w-3.5 h-3.5 border-2 border-white shadow-md !bg-red-500"
                        style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
                    />
                </div>
                {branches.map((branch) => (
                    <div key={branch.id} className="relative flex-1 min-w-[88px]">
                        <div className="text-center py-1.5 px-2 bg-violet-50 rounded-md text-xs text-violet-800 border border-violet-200 truncate">
                            {branch.id}
                        </div>
                        <Handle
                            type="source"
                            position={Position.Bottom}
                            id={`branch-${branch.id}`}
                            className="w-3.5 h-3.5 border-2 border-white shadow-md !bg-violet-500"
                            style={{ bottom: -7, left: '50%', transform: 'translateX(-50%)' }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
});

ApiNode.displayName = 'ApiNode';
