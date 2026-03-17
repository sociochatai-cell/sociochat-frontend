/**
 * MessageNode Component
 * =====================
 * Interactive message node with buttons.
 * Each button has its own source handle for connections.
 */

import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import {
    MessageCircle,
    ArrowRight,
    Link,
    Phone,
    MapPin,
    ShoppingBag,
    List
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { MessageButton, ButtonActionType } from '../types';
import { NODE_COLORS, LIMITS } from '../constants';

interface MessageNodeData {
    header?: string;
    body: string;
    footer?: string;
    buttons: MessageButton[];
}

const ButtonIcons: Record<ButtonActionType, React.ElementType> = {
    quick_reply: ArrowRight,
    url: Link,
    call: Phone,
    location: MapPin,
    catalog: ShoppingBag,
    product_list: List,
};

const ButtonColors: Record<ButtonActionType, string> = {
    quick_reply: '#10B981', // green
    url: '#3B82F6', // blue
    call: '#8B5CF6', // purple
    location: '#F59E0B', // amber
    catalog: '#EC4899', // pink
    product_list: '#06B6D4', // cyan
};

export const MessageNode = memo(({ data, selected }: NodeProps<MessageNodeData>) => {
    const colors = NODE_COLORS.message;

    return (
        <div
            className={`
                relative px-0 py-0 rounded-xl shadow-lg border-2 min-w-[300px] max-w-[320px]
                transition-all duration-200 bg-white
                ${selected ? 'ring-2 ring-green-400 ring-offset-2' : ''}
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
                className="w-4 h-4 !bg-green-500 border-2 border-white shadow-md"
                style={{ top: -8 }}
            />

            {/* Header Bar */}
            <div
                className="px-4 py-2 flex items-center gap-2 rounded-t-[10px]"
                style={{ backgroundColor: colors.bg }}
            >
                <MessageCircle className="w-4 h-4" style={{ color: colors.border }} />
                <span className="text-xs font-medium" style={{ color: colors.text }}>
                    Interactive Message
                </span>
            </div>

            {/* Message Content (WhatsApp-like bubble) */}
            <div className="p-4">
                {/* Header text */}
                {data.header && (
                    <div className="font-semibold text-sm text-gray-800 mb-1">
                        {data.header}
                    </div>
                )}

                {/* Body */}
                <div className="text-sm text-gray-700 leading-relaxed">
                    {data.body || 'Enter message...'}
                </div>

                {/* Footer */}
                {data.footer && (
                    <div className="text-xs text-gray-500 mt-2">
                        {data.footer}
                    </div>
                )}
            </div>

            {/* Buttons */}
            <div className="border-t border-gray-100 rounded-b-[10px]">
                {data.buttons.map((button, index) => {
                    const Icon = ButtonIcons[button.action.type] || ArrowRight;
                    const buttonColor = ButtonColors[button.action.type] || '#10B981';

                    return (
                        <div
                            key={button.id}
                            className={`
                                relative flex items-center justify-between px-4 py-2.5
                                hover:bg-gray-50 transition-colors cursor-pointer
                                ${index < data.buttons.length - 1 ? 'border-b border-gray-100' : ''}
                            `}
                        >
                            <div className="flex items-center gap-2">
                                <Icon
                                    className="w-4 h-4"
                                    style={{ color: buttonColor }}
                                />
                                <span
                                    className="text-sm font-medium"
                                    style={{ color: buttonColor }}
                                >
                                    {button.label || 'Button'}
                                </span>
                            </div>

                            {/* Badge for action type */}
                            {button.action.type !== 'quick_reply' && (
                                <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0"
                                >
                                    {button.action.type.replace('_', ' ')}
                                </Badge>
                            )}

                            {/* Source Handle for this button */}
                            <Handle
                                type="source"
                                position={Position.Right}
                                id={button.id}
                                className="w-3 h-3 border-2 border-white shadow-md"
                                style={{
                                    backgroundColor: buttonColor,
                                    right: -6,
                                }}
                            />
                        </div>
                    );
                })}

                {/* Empty state */}
                {data.buttons.length === 0 && (
                    <div className="px-4 py-3 text-center text-gray-400 text-sm">
                        No buttons yet
                    </div>
                )}

                {/* Add button hint */}
                {data.buttons.length < LIMITS.MAX_BUTTONS_PER_MESSAGE && (
                    <div className="px-4 py-2 text-center text-gray-400 text-xs border-t border-dashed border-gray-200">
                        Click to add button ({LIMITS.MAX_BUTTONS_PER_MESSAGE - data.buttons.length} remaining)
                    </div>
                )}
            </div>
        </div>
    );
});

MessageNode.displayName = 'MessageNode';
