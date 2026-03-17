// ChatAutomationsPanel Component
// ================================
// Slide-out panel showing automation toggle switches for a specific contact
// Allows enabling/disabling automations per-contact

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    MessageCircle,
    Clock,
    Zap,
    Hash,
    HelpCircle,
    Sparkles,
    Loader2,
    Check,
    Power,
    GitMerge
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/config';

interface AutomationOverrides {
    welcome: boolean;
    away: boolean;
    command: boolean;
    keyword: boolean;
    faq: boolean;
    ai_chat: boolean;
    interactive_flows: boolean;
}

interface ChatAutomationsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    conversationId: number;
    accountId: number;
    contactName?: string;
}

const AUTOMATION_TYPES = [
    {
        key: 'welcome',
        label: 'Welcome Message',
        description: 'Auto-reply to first message from this contact',
        icon: MessageCircle,
        color: 'from-green-500 to-emerald-500',
    },
    {
        key: 'away',
        label: 'Away Message',
        description: 'Reply when outside business hours',
        icon: Clock,
        color: 'from-blue-500 to-cyan-500',
    },
    {
        key: 'command',
        label: 'Commands',
        description: 'Slash commands like /help, /menu',
        icon: Zap,
        color: 'from-yellow-500 to-orange-500',
    },
    {
        key: 'keyword',
        label: 'Keywords',
        description: 'Keyword-triggered auto-replies',
        icon: Hash,
        color: 'from-purple-500 to-pink-500',
    },
    {
        key: 'faq',
        label: 'FAQ Answers',
        description: 'Auto-answer from knowledge base',
        icon: HelpCircle,
        color: 'from-indigo-500 to-blue-500',
    },
    {
        key: 'ai_chat',
        label: 'AI Chat',
        description: 'AI-powered conversational responses',
        icon: Sparkles,
        color: 'from-fuchsia-500 to-pink-500',
    },
    {
        key: 'interactive_flows',
        label: 'Interactive Flows',
        description: 'Flow triggers and menu responses',
        icon: GitMerge,
        color: 'from-orange-500 to-red-500',
    },
] as const;

export function ChatAutomationsPanel({
    isOpen,
    onClose,
    conversationId,
    accountId,
    contactName
}: ChatAutomationsPanelProps) {
    const [overrides, setOverrides] = useState<AutomationOverrides>({
        welcome: true,
        away: true,
        command: true,
        keyword: true,
        faq: true,
        ai_chat: true,
        interactive_flows: true,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [saved, setSaved] = useState<string | null>(null);

    // Fetch current overrides
    const fetchOverrides = useCallback(async () => {
        if (!conversationId || !accountId) return;

        setLoading(true);
        try {
            const res = await fetch(
                `${API_BASE_URL}/api/whatsapp/accounts/${accountId}/automation/contact/${conversationId}/overrides`,
                { credentials: 'include' }
            );
            const data = await res.json();

            if (data.success) {
                setOverrides(data.overrides);
            }
        } catch (err) {
            console.error('Failed to fetch overrides:', err);
        } finally {
            setLoading(false);
        }
    }, [conversationId, accountId]);

    useEffect(() => {
        if (isOpen) {
            fetchOverrides();
        }
    }, [isOpen, fetchOverrides]);

    // Toggle automation
    const handleToggle = async (ruleType: string, newValue: boolean) => {
        setSaving(ruleType);
        setSaved(null);

        try {
            const res = await fetch(
                `${API_BASE_URL}/api/whatsapp/accounts/${accountId}/automation/contact/${conversationId}/overrides`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                        rule_type: ruleType,
                        is_enabled: newValue,
                    }),
                }
            );

            const data = await res.json();

            if (data.success) {
                setOverrides(data.overrides);
                setSaved(ruleType);
                setTimeout(() => setSaved(null), 1500);
            }
        } catch (err) {
            console.error('Failed to update override:', err);
        } finally {
            setSaving(null);
        }
    };

    // Close on ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l shadow-2xl z-50 flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/5 to-primary/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                                    <Power className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <h2 className="font-semibold">Automations</h2>
                                    <p className="text-xs text-muted-foreground">
                                        {contactName || 'This contact'}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onClose}
                                className="hover:bg-destructive/10 hover:text-destructive"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {loading ? (
                                <div className="flex items-center justify-center h-40">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                AUTOMATION_TYPES.map((automation) => {
                                    const Icon = automation.icon;
                                    const isEnabled = overrides[automation.key as keyof AutomationOverrides];
                                    const isSaving = saving === automation.key;
                                    const isSaved = saved === automation.key;

                                    return (
                                        <motion.div
                                            key={automation.key}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={cn(
                                                "p-4 rounded-xl border transition-all duration-200",
                                                isEnabled
                                                    ? "bg-card hover:shadow-md border-border"
                                                    : "bg-muted/30 border-dashed border-muted-foreground/20"
                                            )}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex items-start gap-3">
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br",
                                                        automation.color,
                                                        !isEnabled && "opacity-40"
                                                    )}>
                                                        <Icon className="w-5 h-5 text-white" />
                                                    </div>
                                                    <div>
                                                        <h3 className={cn(
                                                            "font-medium",
                                                            !isEnabled && "text-muted-foreground"
                                                        )}>
                                                            {automation.label}
                                                        </h3>
                                                        <p className="text-xs text-muted-foreground mt-0.5">
                                                            {automation.description}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    {isSaving && (
                                                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                                    )}
                                                    {isSaved && (
                                                        <motion.div
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            className="w-4 h-4"
                                                        >
                                                            <Check className="w-4 h-4 text-green-500" />
                                                        </motion.div>
                                                    )}
                                                    <Switch
                                                        checked={isEnabled}
                                                        disabled={isSaving}
                                                        onCheckedChange={(checked) => handleToggle(automation.key, checked)}
                                                    />
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t bg-muted/30">
                            <p className="text-xs text-muted-foreground text-center">
                                Disabled automations will not trigger for this contact.
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
