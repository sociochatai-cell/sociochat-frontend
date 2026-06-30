// FlowResponsesPanel Component
// ============================
// Right sidebar showing the live interactive-automation flow state for a
// conversation: which automation is running, the current node, whether it is
// waiting for input, and every response the customer has given so far.
// Mirrors ContactInfoPanel's slide-in animation and layout.

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Workflow,
    ListChecks,
    Loader2,
    MapPin,
    Hourglass,
    CheckCircle2,
    Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Conversation, FlowState } from '../types';
import { getConversationFlowState } from '../api';
import { WHATSAPP_REST_API_PREFIX } from '@/config';
import { getWorkspaceId } from '../utils/workspaceContext';
import { VALIDATION_TYPE_LABELS } from '../pages/InteractiveAutomation/constants';

interface FlowResponsesPanelProps {
    conversation: Conversation | null;
    isOpen: boolean;
    onClose: () => void;
}

// Friendly label for a validation type. Falls back to the raw value when the
// constants map doesn't know about it.
const getValidationTypeLabel = (validationType?: string | null): string | null => {
    if (!validationType) return null;
    const labels = VALIDATION_TYPE_LABELS as Record<string, string>;
    return labels[validationType] || validationType;
};

const formatResponseValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

export function FlowResponsesPanel({
    conversation,
    isOpen,
    onClose,
}: FlowResponsesPanelProps) {
    const [flowState, setFlowState] = useState<FlowState | null>(null);
    const [loading, setLoading] = useState(false);

    // Fetch the live flow state for the selected conversation. Uses the shared
    // api helper when available, falling back to a direct fetch.
    const fetchFlowState = useCallback(async () => {
        if (!conversation?.id || conversation.id <= 0) {
            setFlowState(null);
            return;
        }

        setLoading(true);
        try {
            if (typeof getConversationFlowState === 'function') {
                const data = await getConversationFlowState(conversation.id);
                setFlowState(data?.flow_state ?? null);
            } else {
                const res = await fetch(
                    `${WHATSAPP_REST_API_PREFIX}/interactive-automations/conversation-state?conversation_id=${conversation.id}&workspace_id=${getWorkspaceId()}`,
                    { credentials: 'include' },
                );
                const data = await res.json();
                setFlowState(data?.flow_state ?? null);
            }
        } catch (err) {
            console.error('Failed to fetch flow state:', err);
            setFlowState(null);
        } finally {
            setLoading(false);
        }
    }, [conversation?.id]);

    useEffect(() => {
        if (isOpen && conversation?.id && conversation.id > 0) {
            fetchFlowState();
        } else {
            setFlowState(null);
        }
    }, [isOpen, conversation?.id, fetchFlowState]);

    if (!conversation) return null;

    const responses = [...(flowState?.responses ?? [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    const hasFlow = Boolean(
        flowState && (flowState.automationId !== null || responses.length > 0),
    );
    const currentValidationLabel = getValidationTypeLabel(
        responses.find((r) => r.field === flowState?.currentField)?.validationType,
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="h-full border-l bg-background flex flex-col overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Workflow className="w-4 h-4 text-primary" />
                            Flow Responses
                        </h3>
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center gap-3 p-10 text-center text-muted-foreground">
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <p className="text-sm">Loading flow state…</p>
                            </div>
                        ) : !hasFlow ? (
                            <div className="flex flex-col items-center justify-center gap-3 p-10 text-center">
                                <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
                                    <Inbox className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <h4 className="text-sm font-semibold">No active flow</h4>
                                <p className="text-xs text-muted-foreground">
                                    This conversation isn't currently running an interactive
                                    automation. Responses will appear here once a flow starts.
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Progress Header */}
                                <div className="p-4 border-b">
                                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                        <Workflow className="w-4 h-4" />
                                        {flowState?.automationName || 'Automation'}
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground flex items-center gap-2">
                                                <MapPin className="w-4 h-4" />
                                                Current Node
                                            </span>
                                            <span className="font-medium truncate max-w-[150px] text-right">
                                                {flowState?.currentNodeId || '-'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-muted-foreground flex items-center gap-2">
                                                {flowState?.waitingForInput ? (
                                                    <Hourglass className="w-4 h-4" />
                                                ) : (
                                                    <CheckCircle2 className="w-4 h-4" />
                                                )}
                                                Status
                                            </span>
                                            <span
                                                className={cn(
                                                    'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
                                                    flowState?.waitingForInput
                                                        ? 'bg-orange-100 text-orange-700'
                                                        : 'bg-green-100 text-green-700',
                                                )}
                                            >
                                                <span
                                                    className={cn(
                                                        'w-2 h-2 rounded-full',
                                                        flowState?.waitingForInput
                                                            ? 'bg-orange-500'
                                                            : 'bg-green-500',
                                                    )}
                                                />
                                                {flowState?.waitingForInput ? 'Waiting for input' : 'Running'}
                                            </span>
                                        </div>
                                        {flowState?.waitingForInput && flowState?.currentField && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-muted-foreground flex items-center gap-2">
                                                    <ListChecks className="w-4 h-4" />
                                                    Awaiting Field
                                                </span>
                                                <span className="font-medium text-right">
                                                    {flowState.currentField}
                                                    {currentValidationLabel && (
                                                        <span className="block text-xs text-muted-foreground">
                                                            {currentValidationLabel}
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Responses Section */}
                                <div className="p-4">
                                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                        <ListChecks className="w-4 h-4" />
                                        Responses ({responses.length})
                                    </h4>
                                    {responses.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic">
                                            No responses captured yet.
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {responses.map((response, idx) => (
                                                <div
                                                    key={`${response.field}-${idx}`}
                                                    className="p-3 rounded-lg bg-muted/50"
                                                >
                                                    <div className="text-xs text-muted-foreground">
                                                        {response.label || response.field}
                                                    </div>
                                                    <div className="text-sm font-medium break-words">
                                                        {formatResponseValue(response.value)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
