// Conversation Thread Component
// =============================
// Right panel showing messages for selected conversation
// Uses singleton store for message caching - loads ONCE per conversation

import { useEffect, useRef, useState, useCallback, useSyncExternalStore, useMemo } from 'react';
import { ConversationMessage, Conversation, FlowState } from '../types';
import { format, isToday, isYesterday } from 'date-fns';
import { MessageBubble } from './MessageBubble';
import { EmptyState } from './EmptyState';
import { MessageComposer } from './MessageComposer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { XCircle, RefreshCcw, User, Clock, Loader2, BarChart3, Power, ChevronLeft, Sparkles } from 'lucide-react';
import { ChatAutomationsPanel } from './ChatAutomationsPanel';
import { toast } from 'sonner';
import { WHATSAPP_REST_API_PREFIX } from "@/config";
import { maskPhoneNumber } from '@/lib/phoneMask';
import { getConversationFlowState } from '../api';
import {
  subscribeToMessages,
  getMessagesForConversation,
  isLoadingMessagesFor,
  loadMessagesFor,
  addMessageLocally,
  updateConversationLocally,
  clearHumanEscalationLocally,
  hasMoreMessagesFor,
  loadOlderMessages,
} from '../stores/inboxStore';
import { useSessionCountdown } from '../hooks/useSessionCountdown';
import type { TemplateInfo } from '../utils/messageDisplay';

interface ConversationThreadProps {
  conversation: Conversation | null;
  onConversationUpdate?: () => void;
  phoneNumberId?: string;
  isCoexistence?: boolean;
  onBack?: () => void;
  showBackButton?: boolean;
  onOpenContactInfo?: () => void;
  // REMOVED: refreshTrigger - no longer needed, store handles updates
}

// Module-level template cache (persists across re-renders)
let templateCache: Record<string, TemplateInfo> = {};
let templateCacheLoaded = false;
const EMPTY_MESSAGES: ConversationMessage[] = []; // Stable empty array

// Format date for separator
function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

export function ConversationThread({
  conversation,
  onConversationUpdate,
  phoneNumberId,
  isCoexistence = false,
  onBack,
  showBackButton = false,
  onOpenContactInfo,
}: ConversationThreadProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, TemplateInfo>>(templateCache);
  const [closing, setClosing] = useState(false);
  const [automationsPanelOpen, setAutomationsPanelOpen] = useState(false);
  const [aiChatEnabled, setAiChatEnabled] = useState(true);
  const [aiPausedByAgent, setAiPausedByAgent] = useState(
    () => Boolean(conversation?.ai_paused_by_agent),
  );
  // Live interactive-flow state for the open conversation. Drives the
  // MessageComposer "typed keyboard" affordances (ITEM #2) when the flow is
  // paused at an input step. Fetched fresh (no persistent cache) since it
  // reflects in-flight progress.
  const [flowState, setFlowState] = useState<FlowState | null>(null);
  const agentPauseLockUntilRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const isInitialLoadRef = useRef(true);

  const conversationId = conversation?.id ?? null;
  const userPhone = conversation?.user_phone ?? '';
  const maskedUserPhone = useMemo(() => maskPhoneNumber(userPhone), [userPhone]);

  // Real-time session countdown
  const { formatted: sessionCountdown } = useSessionCountdown(
    conversation?.session_time_left_seconds,
    conversation?.is_session_open ?? false
  );

  const fetchAutomationOverrides = useCallback(async () => {
    if (!conversationId || !conversation?.account_id || conversationId <= 0) return;
    try {
      const res = await fetch(
        `${WHATSAPP_REST_API_PREFIX}/accounts/${conversation.account_id}/automation/contact/${conversationId}/overrides`,
        { credentials: 'include' },
      );
      const data = await res.json();
      if (data.success) {
        const aiOff = data.overrides?.ai_chat === false;
        const pausedByAgent = Boolean(
          data.ai_paused_by_agent ?? conversation?.ai_paused_by_agent ?? aiOff,
        );
        const lockActive = Date.now() < agentPauseLockUntilRef.current;
        if (lockActive) {
          setAiChatEnabled(false);
          setAiPausedByAgent(true);
        } else {
          setAiChatEnabled(!aiOff);
          setAiPausedByAgent(pausedByAgent);
        }
      }
    } catch {
      // Non-blocking
    }
  }, [conversationId, conversation?.account_id, conversation?.ai_paused_by_agent]);

  useEffect(() => {
    if (!conversationId || !conversation?.account_id || conversationId <= 0) return;
    const timer = window.setTimeout(() => {
      void fetchAutomationOverrides();
    }, 800);
    return () => window.clearTimeout(timer);
  }, [conversationId, conversation?.account_id, fetchAutomationOverrides]);

  useEffect(() => {
    if (conversation?.ai_paused_by_agent) {
      setAiPausedByAgent(true);
      setAiChatEnabled(false);
    }
  }, [conversation?.id, conversation?.ai_paused_by_agent]);

  // Fetch the live interactive-flow state for the open conversation so the
  // composer can show typed-input affordances (enum chips / numeric pad / email
  // hint) when the flow is paused waiting for input.
  const fetchFlowState = useCallback(async () => {
    if (!conversationId || conversationId <= 0) {
      setFlowState(null);
      return;
    }
    try {
      const data = await getConversationFlowState(conversationId);
      // Backend returns the state under `flowState`; the older typed wrapper
      // calls it `flow_state`. Accept either so we're resilient to both.
      const raw = (data as any) || {};
      setFlowState(raw.flowState ?? raw.flow_state ?? null);
    } catch {
      setFlowState(null);
    }
  }, [conversationId]);

  // Refetch flow-state on conversation change. We also refetch after the agent
  // sends a message (see handleMessageSent) since that can advance the flow.
  useEffect(() => {
    if (conversationId && conversationId > 0) {
      void fetchFlowState();
    } else {
      setFlowState(null);
    }
  }, [conversationId, fetchFlowState]);

  // Scroll position restoration for infinite scroll
  const prevScrollHeightRef = useRef<number>(0);
  const isFetchingOlderRef = useRef(false);

  // Get messages from store using useSyncExternalStore
  const getMessagesSnapshot = useCallback(() => {
    return (conversationId && conversationId > 0)
      ? getMessagesForConversation(conversationId)
      : EMPTY_MESSAGES;
  }, [conversationId]);

  const messages = useSyncExternalStore(
    useCallback(
      (callback) => (conversationId && conversationId > 0) ? subscribeToMessages(conversationId, callback) : () => { },
      [conversationId]
    ),
    getMessagesSnapshot,
    getMessagesSnapshot
  );

  // Store selectors for loading/more state
  const hasMoreMessages = useSyncExternalStore(
    useCallback((cb) => (conversationId ? subscribeToMessages(conversationId, cb) : () => { }), [conversationId]),
    () => (conversationId ? hasMoreMessagesFor(conversationId) : false),
    () => false
  );

  const isLoadingMessages = useSyncExternalStore(
    useCallback((cb) => (conversationId ? subscribeToMessages(conversationId, cb) : () => { }), [conversationId]),
    () => (conversationId ? isLoadingMessagesFor(conversationId) : false),
    () => false
  );

  // Load templates after messages (large payload — must not block chat open)
  useEffect(() => {
    if (!conversationId || conversationId <= 0) return;

    if (templateCacheLoaded) {
      setTemplates(templateCache);
      return;
    }

    const timer = window.setTimeout(() => {
      fetch(`${WHATSAPP_REST_API_PREFIX}/templates`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.templates) {
            const cache: Record<string, TemplateInfo> = {};
            data.templates.forEach((t: any) => {
              cache[t.name] = {
                name: t.name,
                body: t.body_text ?? t.body ?? null,
                header: t.header_text ?? t.header ?? null,
                footer: t.footer_text ?? t.footer ?? null,
                components: t.components ?? undefined,
              };
            });
            templateCache = cache;
            templateCacheLoaded = true;
            setTemplates(cache);
          }
        })
        .catch(err => console.error('Failed to fetch templates:', err));
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [conversationId]);

  const checkIfAtBottom = () => {
    if (!messagesContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  };

  const scrollToBottom = (force = false) => {
    if (!force && !shouldAutoScrollRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = useCallback(async (isPolling = false) => {
    if (!conversationId || conversationId === 0) {
      return;
    }

    // Use store to load messages (handles caching internally)
    if (!isPolling) {
      setLoading(true);
    }

    try {
      setError(null);
      await loadMessagesFor(conversationId);

      // Auto-scroll on initial load
      if (isInitialLoadRef.current) {
        setTimeout(() => scrollToBottom(true), 100);
        isInitialLoadRef.current = false;
      }
    } catch (err) {
      setError('Failed to load messages');
      console.error('Error fetching messages:', err);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight } = e.currentTarget;
    shouldAutoScrollRef.current = checkIfAtBottom();

    // Infinite Scroll Up logic
    if (scrollTop < 50 && hasMoreMessages && !isLoadingMessages && !isFetchingOlderRef.current) {
      console.log('📜 [ConversationThread] Scrolled to top, loading older messages...');
      isFetchingOlderRef.current = true;
      prevScrollHeightRef.current = scrollHeight;

      loadOlderMessages(conversationId!) // Pass ID directly
        .finally(() => {
          isFetchingOlderRef.current = false;
        });
    }
  };

  useEffect(() => {
    isInitialLoadRef.current = true;
    shouldAutoScrollRef.current = true;
    // Load messages when conversation changes (will use cache if available)
    if (conversationId && conversationId > 0) {
      fetchMessages(false);
    }
  }, [conversationId, fetchMessages]);

  // Restore scroll position after loading older messages
  useEffect(() => {
    if (prevScrollHeightRef.current > 0 && messagesContainerRef.current) {
      const newScrollHeight = messagesContainerRef.current.scrollHeight;
      const diff = newScrollHeight - prevScrollHeightRef.current;

      if (diff > 0) {
        console.log('📍 [ConversationThread] Restoring scroll position, diff:', diff);
        messagesContainerRef.current.scrollTop = diff;
        prevScrollHeightRef.current = 0;
      }
    }

    // Auto-scroll when new specific messages arrive (only if sticking to bottom)
    if (messages.length > 0 && shouldAutoScrollRef.current && prevScrollHeightRef.current === 0) {
      scrollToBottom(false);
    }
  }, [messages.length]);

  /* REMOVED: refreshTrigger effect - store handles real-time updates now */

  const handleMessageSent = useCallback((sentMessage?: ConversationMessage) => {
    if (!conversationId) return;

    clearHumanEscalationLocally(conversationId);
    agentPauseLockUntilRef.current = Date.now() + 30_000;
    setAiChatEnabled(false);
    setAiPausedByAgent(true);
    updateConversationLocally(conversationId, { ai_paused_by_agent: true });
    void fetchAutomationOverrides();
    // The send may advance the interactive flow; refresh affordance state.
    void fetchFlowState();

    if (sentMessage) {
      addMessageLocally(conversationId, sentMessage);

      let preview = '';
      if (typeof sentMessage.content === 'string') {
        preview = sentMessage.content;
      } else if (sentMessage.body) {
        preview = sentMessage.body;
      } else if (sentMessage.type === 'image') {
        preview = '📷 Image';
      } else if (sentMessage.type === 'video') {
        preview = '🎬 Video';
      } else if (sentMessage.type === 'document') {
        preview = '📄 Document';
      } else if (sentMessage.type === 'audio') {
        preview = '🎵 Audio';
      } else {
        preview = '[Media]';
      }

      const contentObj = sentMessage.content as any;
      if (contentObj?.caption) {
        preview += `: ${contentObj.caption}`;
      }

      updateConversationLocally(conversationId, {
        last_message_at: sentMessage.timestamp || sentMessage.created_at || new Date().toISOString(),
        last_message_preview: preview,
      });
      setTimeout(() => scrollToBottom(true), 100);
    }
  }, [conversationId, fetchAutomationOverrides, fetchFlowState]);

  const handleAutomationOverridesChange = useCallback(
    (overrides: { ai_chat?: boolean }, pausedByAgent: boolean) => {
      if (!conversationId) return;
      setAiChatEnabled(overrides.ai_chat !== false);
      setAiPausedByAgent(pausedByAgent);
      updateConversationLocally(conversationId, { ai_paused_by_agent: pausedByAgent });
    },
    [conversationId],
  );

  const showAiPausedBanner =
    !aiChatEnabled &&
    (aiPausedByAgent || Boolean(conversation?.ai_paused_by_agent));

  // Close/Reopen handlers
  const handleClose = async () => {
    if (!conversationId) return;
    setClosing(true);
    try {
      const res = await fetch(`${WHATSAPP_REST_API_PREFIX}/conversations/${conversationId}/close`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Chat closed');
        onConversationUpdate?.();
      } else {
        toast.error(data.error || 'Failed to close chat');
      }
    } catch (err) {
      toast.error('Failed to close chat');
    } finally {
      setClosing(false);
    }
  };

  const handleReopen = async () => {
    if (!conversationId) return;
    setClosing(true);
    try {
      const res = await fetch(`${WHATSAPP_REST_API_PREFIX}/conversations/${conversationId}/reopen`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Chat reopened');
        onConversationUpdate?.();
      } else {
        toast.error(data.error || 'Failed to reopen chat');
      }
    } catch (err) {
      toast.error('Failed to reopen chat');
    } finally {
      setClosing(false);
    }
  };

  // Check if no conversation is selected (null means nothing selected, 0 means new chat)
  if (!conversation) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center animate-pulse">
            <svg className="w-12 h-12 text-primary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div className="absolute -inset-4 border-2 border-primary/10 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Select a conversation</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Choose a conversation from the left to start messaging
        </p>
      </div>
    );
  }

  if (loading && messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading messages...</div>
      </div>
    );
  }

  if (error && messages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4">
        <p className="text-sm text-destructive mb-4">{error}</p>
        <button
          onClick={() => fetchMessages(false)}
          className="px-4 py-2 text-sm border rounded hover:bg-accent"
        >
          Retry
        </button>
      </div>
    );
  }

  // Meta Cloud API free-form sends are blocked outside the 24h customer service window.
  const isSessionExpired = !conversation?.is_session_open && !conversation?.closed_by_agent;
  const isClosed = conversation?.closed_by_agent || isSessionExpired;

  // ----- Typed-keyboard affordance inputs for MessageComposer (ITEM #2) -----
  // Only relevant while the flow is paused waiting on an input step.
  const flowWaitingForInput = Boolean(flowState?.waitingForInput);
  // The backend returns the awaited field's metadata in `currentInput`
  // (validationType + enum options). Fall back to currentField / the collected
  // response's validationType for resilience against older backends.
  const flowCurrentField = flowState?.currentInput?.field ?? flowState?.currentField ?? null;
  const flowCurrentValidationType =
    flowState?.currentInput?.validationType ??
    (flowState?.responses ?? []).find((r) => r.field === flowCurrentField)?.validationType ??
    null;
  const flowCurrentEnumValues: string[] | null = flowState?.currentInput?.enumValues ?? null;

  return (
    <div className="h-full flex flex-col">
      {/* Chat Header */}
      <div className="sticky top-0 z-20 border-b p-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={onBack}
              aria-label="Back to conversation list"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <button
            type="button"
            onClick={onOpenContactInfo}
            className={`text-left rounded-md ${onOpenContactInfo ? 'cursor-pointer hover:bg-muted/40 px-1 py-1 -mx-1 -my-1 transition-colors' : 'cursor-default'}`}
          >
            <h3 className="font-semibold">{conversation?.user_name || maskedUserPhone}</h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {conversation?.is_session_open ? (
                <span className="text-green-600 font-medium">
                  {sessionCountdown}
                </span>
              ) : conversation?.closed_by_agent ? (
                <span className="text-red-600 font-medium">Closed by agent</span>
              ) : isCoexistence ? (
                <span className="text-amber-600 font-medium">24h window closed (send template)</span>
              ) : (
                <span className="text-amber-600 font-medium">24h window closed (send template)</span>
              )}
            </div>
          </button>

          {/* Session Status Pill */}
          {conversation?.is_session_open && (
            <span className="ml-2 px-2.5 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Active
            </span>
          )}

          {isCoexistence && (
            <span className="ml-2 px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
              Coexistence
            </span>
          )}
        </div>

        {/* Close/Reopen Button */}
        <div className="flex items-center gap-2">
          {/* Automations Button - Per-chat toggles */}
          {conversation?.id && conversation.id > 0 && (
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'gap-2',
                showAiPausedBanner && 'border-amber-300/80 bg-amber-50/80 text-amber-900 hover:bg-amber-100/80',
              )}
              onClick={() => setAutomationsPanelOpen(true)}
            >
              {showAiPausedBanner ? (
                <Sparkles className="w-4 h-4 text-amber-600" />
              ) : (
                <Power className="w-4 h-4" />
              )}
              Automations
            </Button>
          )}

          {/* Analytics Button - Chat specific */}
          {conversation?.id && conversation.id > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.location.href = `/dashboard/whatsapp/analytics?conversation=${conversation.id}`}
            >
              <BarChart3 className="w-4 h-4" />
              Stats
            </Button>
          )}

          {conversation?.closed_by_agent ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReopen}
              disabled={closing}
              className="gap-2"
            >
              {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              Reopen
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={closing || !conversation?.is_session_open}
              className="gap-2 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
            >
              {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Close Chat
            </Button>
          )}
        </div>
      </div>

      {showAiPausedBanner && (
        <div
          className="shrink-0 flex items-start gap-2.5 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-sm text-amber-950"
          role="status"
          aria-live="polite"
        >
          <Sparkles className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" aria-hidden />
          <p className="flex-1 leading-snug">
            <span className="font-semibold">AI replies are paused</span>
            {' — you took over this chat manually. '}
            <button
              type="button"
              className="font-semibold underline underline-offset-2 hover:text-amber-800"
              onClick={() => setAutomationsPanelOpen(true)}
            >
              Turn on AI Chat
            </button>
            {' in Automations to let the bot handle this contact again.'}
          </p>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4"
        onScroll={handleScroll}
      >
        {messages.length === 0 ? (
          <EmptyState
            title="No messages"
            description="Start the conversation by sending a message"
          />
        ) : (
          <>
            {messages.map((message, index) => {
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const currentDate = message.created_at ? new Date(message.created_at).toDateString() : '';
              const prevDate = prevMessage?.created_at ? new Date(prevMessage.created_at).toDateString() : '';
              const showDateSeparator = currentDate !== prevDate;

              return (
                <div key={message.id}>
                  {showDateSeparator && message.created_at && (
                    <div className="flex items-center justify-center my-4">
                      <div className="px-3 py-1 text-xs font-medium text-muted-foreground bg-muted rounded-full">
                        {formatDateSeparator(message.created_at)}
                      </div>
                    </div>
                  )}
                  <MessageBubble message={message} templates={templates} />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message composer - disabled when closed */}
      <MessageComposer
        to={userPhone}
        onMessageSent={handleMessageSent}
        disabled={isSessionExpired}
        closedByAgent={conversation?.closed_by_agent}
        phoneNumberId={phoneNumberId}
        accountId={conversation?.account_id}
        recipientName={conversation?.user_name || maskedUserPhone}
        waitingForInput={flowWaitingForInput}
        validationType={flowCurrentValidationType}
        enumValues={flowCurrentEnumValues}
        currentField={flowCurrentField}
      />

      {/* Automations Panel */}
      {conversation?.id && conversation.id > 0 && (
        <ChatAutomationsPanel
          isOpen={automationsPanelOpen}
          onClose={() => setAutomationsPanelOpen(false)}
          conversationId={conversation.id}
          accountId={conversation.account_id}
          contactName={conversation.user_name || maskedUserPhone}
          aiPausedByAgent={aiPausedByAgent}
          onOverridesChange={handleAutomationOverridesChange}
        />
      )}
    </div>
  );
}

