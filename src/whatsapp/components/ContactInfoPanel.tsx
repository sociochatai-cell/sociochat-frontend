// ContactInfoPanel Component
// ===========================
// Right sidebar showing contact details, notes, and quick actions
// Makes the inbox feel like a full CRM

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    User,
    Phone,
    Copy,
    Check,
    MessageSquare,
    Calendar,
    Tag,
    StickyNote,
    ChevronRight,
    Star,
    UserPlus,
    Clock,
    BarChart3,
    Edit2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Conversation } from '../types';
import { API_BASE_URL } from '@/config';
import { format, formatDistanceToNow } from 'date-fns';

interface ContactInfoPanelProps {
    conversation: Conversation | null;
    isOpen: boolean;
    onClose: () => void;
    accountId?: number;
    /** Full-width layout for mobile sheet overlay */
    embedded?: boolean;
}

interface ContactStats {
    totalMessages: number;
    firstContact: string | null;
    lastActive: string | null;
    avgResponseTime: string;
}

export function ContactInfoPanel({
    conversation,
    isOpen,
    onClose,
    accountId,
    embedded = false,
}: ContactInfoPanelProps) {
    const [copied, setCopied] = useState(false);
    const [notes, setNotes] = useState('');
    const [editingNotes, setEditingNotes] = useState(false);
    const [savingNotes, setSavingNotes] = useState(false);
    const [starred, setStarred] = useState(false);
    const [messageCount, setMessageCount] = useState<number>(0);
    const [avgResponseTime, setAvgResponseTime] = useState<string>('-');
    const [loadingStats, setLoadingStats] = useState(false);
    const [sessionTimeLeft, setSessionTimeLeft] = useState<number>(0);

    // Initialize and countdown session time
    useEffect(() => {
        if (conversation?.session_time_left_seconds && conversation.is_session_open) {
            setSessionTimeLeft(conversation.session_time_left_seconds);
        } else {
            setSessionTimeLeft(0);
        }
    }, [conversation?.id, conversation?.session_time_left_seconds, conversation?.is_session_open]);

    // Real-time countdown timer
    useEffect(() => {
        if (!isOpen || !conversation?.is_session_open || sessionTimeLeft <= 0) return;

        const interval = setInterval(() => {
            setSessionTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isOpen, conversation?.is_session_open, sessionTimeLeft > 0]);

    // Format seconds to readable time string
    const formatResponseTime = (seconds: number | null): string => {
        if (seconds === null || seconds === undefined) return '-';
        if (seconds < 60) return `~${Math.round(seconds)}s`;
        if (seconds < 3600) return `~${Math.round(seconds / 60)} min`;
        if (seconds < 86400) return `~${Math.round(seconds / 3600)} hr`;
        return `~${Math.round(seconds / 86400)} day`;
    };

    // Calculate last active from session - if session has 23h left, user was active ~1h ago
    const getLastActiveTime = () => {
        if (!conversation) return null;
        // If session is open, calculate from session time left (24h - time left = time since last activity)
        if (conversation.is_session_open && conversation.session_time_left_seconds) {
            const secondsSinceActive = (24 * 3600) - conversation.session_time_left_seconds;
            const lastActiveDate = new Date(Date.now() - (secondsSinceActive * 1000));
            return lastActiveDate.toISOString();
        }
        // Otherwise use last_inbound_at (when they last messaged)
        return conversation.last_inbound_at || conversation.last_message_at || null;
    };

    const stats: ContactStats = {
        totalMessages: messageCount,
        firstContact: conversation?.created_at || null,
        lastActive: getLastActiveTime(),
        avgResponseTime: avgResponseTime,
    };

    // Fetch actual message count and avg response time from analytics API
    const fetchMessageCount = useCallback(async () => {
        if (!conversation?.id) return;

        setLoadingStats(true);
        try {
            const res = await fetch(
                `${API_BASE_URL}/api/whatsapp/analytics/conversations/${conversation.id}`,
                { credentials: 'include' }
            );
            const data = await res.json();
            if (data.success) {
                if (data.messages) {
                    setMessageCount(data.messages.total || 0);
                }
                // Set average response time from API
                if (data.avg_response_time_seconds !== null && data.avg_response_time_seconds !== undefined) {
                    setAvgResponseTime(formatResponseTime(data.avg_response_time_seconds));
                } else {
                    setAvgResponseTime('-');
                }
            }
        } catch (err) {
            console.error('Failed to fetch message count:', err);
            // Fallback to messages length if API fails
            setMessageCount(conversation?.messages?.length || 0);
            setAvgResponseTime('-');
        } finally {
            setLoadingStats(false);
        }
    }, [conversation?.id, conversation?.messages?.length]);

    useEffect(() => {
        if (isOpen && conversation?.id) {
            fetchMessageCount();
        }
    }, [isOpen, conversation?.id, fetchMessageCount]);

    // Copy phone number
    const handleCopyPhone = () => {
        if (conversation?.user_phone) {
            navigator.clipboard.writeText(conversation.user_phone);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };



    // Format phone for display
    const formatPhone = (phone: string) => {
        if (phone.length > 10) {
            if (phone.startsWith('91')) {
                return `+91 ${phone.slice(2, 7)} ${phone.slice(7)}`;
            }
            return `+${phone.slice(0, 2)} ${phone.slice(2)}`;
        }
        return phone;
    };

    // Session status
    const getSessionStatus = () => {
        if (!conversation) return { label: 'Unknown', color: 'bg-muted' };
        if (conversation.is_session_open && sessionTimeLeft > 0) {
            const hours = Math.floor(sessionTimeLeft / 3600);
            const mins = Math.floor((sessionTimeLeft % 3600) / 60);
            const secs = sessionTimeLeft % 60;
            return {
                label: `Active: ${hours}h ${mins}m ${secs}s left`,
                color: 'bg-green-500',
            };
        }
        if (conversation.closed_by_agent) {
            return { label: 'Closed by agent', color: 'bg-red-500' };
        }
        return { label: 'Session expired', color: 'bg-orange-500' };
    };

    const sessionStatus = getSessionStatus();

    if (!conversation) return null;

    const panelContent = (
        <div className={cn('h-full border-l bg-background flex flex-col overflow-hidden', embedded && 'border-l-0 w-full')}>
                    {/* Header */}
                    <div className="p-4 border-b bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between">
                        <h3 className="font-semibold">Contact Info</h3>
                        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto">
                        {/* Profile Section */}
                        <div className="p-6 text-center border-b">
                            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center mb-4 ring-4 ring-primary/10">
                                <User className="w-10 h-10 text-primary" />
                            </div>
                            <h2 className="text-lg font-semibold">
                                {conversation.user_name || 'Unknown Contact'}
                            </h2>
                            <div className="flex items-center justify-center gap-2 mt-2">
                                <Phone className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">
                                    {formatPhone(conversation.user_phone)}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={handleCopyPhone}
                                >
                                    {copied ? (
                                        <Check className="w-3 h-3 text-green-500" />
                                    ) : (
                                        <Copy className="w-3 h-3" />
                                    )}
                                </Button>
                            </div>

                            {/* Session Status Pill
                            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted">
                                <span className={cn('w-2 h-2 rounded-full', sessionStatus.color)} />
                                <span className="text-xs font-medium">{sessionStatus.label}</span>
                            </div>*/}

                            {/* Quick Actions */}
                            <div className="flex items-center justify-center gap-2 mt-4">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setStarred(!starred)}
                                    className={cn(starred && 'bg-yellow-50 border-yellow-300')}
                                    title="Star contact"
                                >
                                    <Star className={cn('w-4 h-4', starred && 'fill-yellow-400 text-yellow-400')} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCopyPhone}
                                    className="gap-1"
                                >
                                    {copied ? (
                                        <><Check className="w-4 h-4 text-green-500" /> Copied!</>
                                    ) : (
                                        <><Copy className="w-4 h-4" /> Copy Phone</>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Stats Section */}
                        <div className="p-4 border-b">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Conversation Stats
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <div className="text-2xl font-bold text-primary">
                                        {stats.totalMessages}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Messages</div>
                                </div>
                                <div className="p-3 rounded-lg bg-muted/50">
                                    <div className="text-2xl font-bold text-primary">
                                        {stats.avgResponseTime}
                                    </div>
                                    <div className="text-xs text-muted-foreground">Avg Response</div>
                                </div>
                            </div>
                            <div className="mt-3 space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <Calendar className="w-4 h-4" />
                                        First Contact
                                    </span>
                                    <span className="font-medium">
                                        {stats.firstContact
                                            ? format(new Date(stats.firstContact), 'MMM d, yyyy')
                                            : '-'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        Last Active
                                    </span>
                                    <span className="font-medium">
                                        {stats.lastActive
                                            ? formatDistanceToNow(new Date(stats.lastActive), { addSuffix: true })
                                            : '-'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Notes Section */}
                        <div className="p-4 border-b">
                            <h4 className="text-sm font-semibold mb-3 flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <StickyNote className="w-4 h-4" />
                                    Notes
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7"
                                    onClick={() => setEditingNotes(!editingNotes)}
                                >
                                    <Edit2 className="w-3 h-3" />
                                </Button>
                            </h4>
                            {editingNotes ? (
                                <div className="space-y-2">
                                    <Textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Add notes about this contact..."
                                        rows={3}
                                        className="text-sm"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setEditingNotes(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                setEditingNotes(false);
                                                // TODO: Save notes to backend
                                            }}
                                        >
                                            Save
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground italic">
                                    {notes || 'No notes added yet. Click edit to add.'}
                                </p>
                            )}
                        </div>


                    </div>
        </div>
    );

    if (embedded) {
        if (!isOpen) return null;
        return panelContent;
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 320, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="h-full overflow-hidden"
                >
                    {panelContent}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
