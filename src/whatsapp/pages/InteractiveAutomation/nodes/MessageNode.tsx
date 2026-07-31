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
    List,
    FileDown
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { canMessageButtonRoute } from '../connection-rules';
import type { MessageButton, ButtonActionType } from '../types';
import { NODE_COLORS } from '../constants';

interface MessageNodeData {
    interactiveType?: 'button' | 'list';
    header?: string;
    body: string;
    footer?: string;
    buttons: MessageButton[];
    buttonText?: string; // For list type
    sections?: any[]; // For list type
}

const ButtonIcons: Record<string, React.ElementType> = {
    quick_reply: ArrowRight,
    url: Link,
    call: Phone,
    location: MapPin,
    catalog: ShoppingBag,
    product_list: List,
    send_document: FileDown,
};

const ButtonColors: Record<ButtonActionType, string> = {
    quick_reply: '#10B981', // green
    url: '#3B82F6', // blue
    call: '#8B5CF6', // purple
    location: '#F59E0B', // amber
    catalog: '#EC4899', // pink
    product_list: '#06B6D4', // cyan
    send_document: '#64748B', // slate
};

export const MessageNode = memo(({ data, selected }: NodeProps<MessageNodeData>) => {
    const colors = NODE_COLORS.message;

    return (
        <div
            className={`
                relative px-0 py-0 rounded-xl shadow-lg border-2 min-w-[300px] max-w-[320px]
                transition-all duration-200 bg-white
                ${selected ? 'ring-2 ring-green-400 ring-offset-0' : ''}
                ${selected && (data as any).validationIssues?.length > 0 ? 'node-error' : ''}
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

            {/* Default Output Handle (Fallback for any selection not specifically routed) */}
            <Handle
                type="source"
                position={Position.Bottom}
                id="output"
                className={`w-4 h-4 !bg-gray-400 border-2 border-white shadow-md hover:!bg-green-500 transition-colors ${
                    (data as any).validationIssues?.some((i: any) => i.handleId === 'output') ? 'react-flow__handle-glow-error' : ''
                }`}
                style={{ bottom: -8 }}
                title="Default fallback for unrouted options"
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

            {/* Buttons / List Menu */}
            <div className="border-t border-gray-100 rounded-b-[10px]">
                {/* BUTTONS TYPE */}
                {(data.interactiveType === 'button' || !data.interactiveType) && (
                    <>
                        {data.buttons.map((button, index) => {
                            const Icon = ButtonIcons[button.action.type] || ArrowRight;
                            const buttonColor = ButtonColors[button.action.type] || '#10B981';
                            const canRoute = canMessageButtonRoute(button.action.type);
                            const actionLabel = button.action.type.replace('_', ' ');

                            const row = (
                                <div
                                    className={`
                                        relative flex items-center justify-between px-4 py-2.5
                                        hover:bg-gray-50 transition-colors cursor-pointer
                                        ${index < data.buttons.length - 1 ? 'border-b border-gray-100' : ''}
                                        ${!canRoute ? 'opacity-80' : ''}
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
                                            {actionLabel}
                                        </Badge>
                                    )}

                                    {/* Source Handle for this button. Non-routing "special"
                                        buttons (URL/Call/Location/Catalog/Product-list) get a
                                        greyed, disabled dot with a styled tooltip explaining why. */}
                                    {canRoute ? (
                                        <Handle
                                            type="source"
                                            position={Position.Right}
                                            id={button.id}
                                            className={`w-3 h-3 border-2 border-white shadow-md ${
                                                (data as any).validationIssues?.some((i: any) => i.handleId === button.id) ? 'react-flow__handle-glow-error' : ''
                                            }`}
                                            style={{
                                                backgroundColor: buttonColor,
                                                right: -6,
                                            }}
                                        />
                                    ) : (
                                        <Handle
                                            type="source"
                                            position={Position.Right}
                                            id={button.id}
                                            isConnectable={false}
                                            className="w-3 h-3 border-2 border-white shadow-md !bg-gray-300 opacity-60 cursor-not-allowed"
                                            style={{ right: -6 }}
                                        />
                                    )}
                                </div>
                            );

                            // Routable buttons: plain row. Special buttons: wrap in a styled
                            // tooltip that explains why the dot is disabled + the alternative.
                            if (canRoute) {
                                return <React.Fragment key={button.id}>{row}</React.Fragment>;
                            }

                            return (
                                <TooltipProvider key={button.id} delayDuration={150}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>{row}</TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-[240px]">
                                            <p className="font-semibold capitalize mb-0.5">
                                                {actionLabel} button — no routing
                                            </p>
                                            <p className="text-xs opacity-90 leading-snug">
                                                It performs an action on the customer's phone and ends that
                                                branch. Use a <span className="font-medium">Quick Reply</span>{' '}
                                                button to continue the flow.
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            );
                        })}

                        {/* Empty state buttons */}
                        {data.buttons.length === 0 && (
                            <div className="px-4 py-3 text-center text-gray-400 text-sm italic">
                                No buttons configured
                            </div>
                        )}
                    </>
                )}

                {/* LIST TYPE */}
                {data.interactiveType === 'list' && (
                    <div className="bg-gray-50/50">
                        {/* List CTA Button - The one user clicks to see the menu */}
                        <div className="px-4 py-3 border-b border-gray-100 bg-white flex items-center justify-center gap-2">
                            <List className="w-4 h-4 text-green-600" />
                            <span className="text-sm font-bold text-green-600">
                                {data.buttonText || 'Select Option'}
                            </span>
                        </div>

                        {/* Preview of rows across all sections - NO scrollbar, auto-height */}
                        <div className="flex flex-col">
                            {(data.sections || []).length === 0 ? (
                                <div className="px-4 py-3 text-center text-gray-400 text-sm italic">
                                    No sections configured
                                </div>
                            ) : (
                                (data.sections || []).map((section, sIdx) => (
                                    <div key={sIdx} className="border-b last:border-b-0 border-gray-100">
                                        {/* Section title if exists */}
                                        {section.title && (
                                            <div className="px-4 py-1.5 bg-gray-100/80 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                                                {section.title}
                                            </div>
                                        )}
                                        {/* Rows as branching points */}
                                        {(section.rows || []).map((row: any, rIdx: number) => (
                                            <div 
                                                key={row.id || `${sIdx}-${rIdx}`}
                                                className="relative flex flex-col px-4 py-2 hover:bg-white transition-colors border-b last:border-b-0 border-gray-50"
                                            >
                                                <span className="text-sm font-medium text-gray-700">
                                                    {row.title || 'Untitled Row'}
                                                </span>
                                                {row.description && (
                                                    <span className="text-[10px] text-gray-500 line-clamp-1">
                                                        {row.description}
                                                    </span>
                                                )}
                                                
                                                {/* Source Handle for this row */}
                                                <Handle
                                                    type="source"
                                                    position={Position.Right}
                                                    id={row.id}
                                                    className={`w-3 h-3 border-2 border-white shadow-md !bg-green-500 ${
                                                        (data as any).validationIssues?.some((i: any) => i.handleId === row.id) ? 'react-flow__handle-glow-error' : ''
                                                    }`}
                                                    style={{ right: -6 }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
});

MessageNode.displayName = 'MessageNode';
