import React, { useState, useEffect, useCallback, useRef, useId, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SafeImage } from '@/components/ui/safe-image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  MessageCircle,
  Send,
  Search,
  RefreshCw,
  MoreVertical,
  CheckCheck,
  Check,
  Clock,
  AlertCircle,
  Phone,
  User,
  X,
  Image as ImageIcon,
  FileText,
  Video,
  Mic,
  Loader2,
  Inbox,
  Archive,
  Wifi,
  WifiOff
} from 'lucide-react';
import { whatsappApi, type Conversation, type ConversationDetail, type ConversationMessage } from '../api';
import { useWhatsAppRealtime } from '@/whatsapp/hooks/useWhatsAppRealtime';

// ============================================================
// Types
// ============================================================

interface ConversationsInboxProps {
  workspaceId?: string;
}

// ============================================================
// Helper Components
// ============================================================

const ConversationSkeleton: React.FC = () => (
  <div className="p-4 border-b">
    <div className="flex items-start gap-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-3 w-12" />
    </div>
  </div>
);

const MessageSkeleton: React.FC = () => (
  <div className="space-y-4 p-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
        <Skeleton className={`h-16 ${i % 2 === 0 ? 'w-48' : 'w-64'} rounded-lg`} />
      </div>
    ))}
  </div>
);

const MessageStatusIcon: React.FC<{ status: ConversationMessage['status'] }> = ({ status }) => {
  switch (status) {
    case 'sent':
      return <Check className="w-3 h-3 text-muted-foreground" />;
    case 'delivered':
      return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
    case 'read':
      return <CheckCheck className="w-3 h-3 text-blue-500" />;
    case 'failed':
      return <AlertCircle className="w-3 h-3 text-destructive" />;
    default:
      return <Clock className="w-3 h-3 text-muted-foreground" />;
  }
};

const MessageTypeIcon: React.FC<{ type: ConversationMessage['type'] }> = ({ type }) => {
  switch (type) {
    case 'image':
      return <ImageIcon className="w-4 h-4" />;
    case 'video':
      return <Video className="w-4 h-4" />;
    case 'document':
      return <FileText className="w-4 h-4" />;
    case 'audio':
      return <Mic className="w-4 h-4" />;
    default:
      return null;
  }
};

// ============================================================
// Conversation List Item
// ============================================================

interface ConversationListItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

const ConversationListItem: React.FC<ConversationListItemProps> = ({
  conversation,
  isSelected,
  onClick,
}) => {
  const getStatusColor = (status: Conversation['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'responded':
        return 'bg-blue-500';
      case 'closed':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getInitials = (name?: string, phone?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return phone?.slice(-2) || '??';
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 border-b transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary ${isSelected ? 'bg-muted/70' : ''
        }`}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar className="w-10 h-10">
            <AvatarFallback className="bg-green-100 text-green-700 text-sm font-medium">
              {getInitials(conversation.customer_name, conversation.customer_phone)}
            </AvatarFallback>
          </Avatar>
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(conversation.status)}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-medium text-sm truncate">
              {conversation.customer_name || conversation.customer_phone}
            </h4>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatTime(conversation.last_message_at)}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate mt-1">
            {conversation.last_message_preview || 'No messages yet'}
          </p>
        </div>
        {conversation.unread_count > 0 && (
          <Badge variant="default" className="bg-green-500 text-white text-xs px-1.5 py-0.5 min-w-[20px] flex items-center justify-center">
            {conversation.unread_count}
          </Badge>
        )}
      </div>
    </button>
  );
};

// ============================================================
// Message Bubble
// ============================================================

interface MessageBubbleProps {
  message: ConversationMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isOutbound = message.direction === 'outbound';

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[70%] rounded-lg px-4 py-2 ${isOutbound
            ? 'bg-green-500 text-white rounded-br-sm'
            : 'bg-muted rounded-bl-sm'
          }`}
      >
        {message.type !== 'text' && (
          <div className={`flex items-center gap-2 mb-1 ${isOutbound ? 'text-green-100' : 'text-muted-foreground'}`}>
            <MessageTypeIcon type={message.type} />
            <span className="text-xs capitalize">{message.type}</span>
          </div>
        )}

        {message.media_url && (
          <div className="mb-2">
            {message.type === 'image' ? (
              <SafeImage
                src={message.media_url}
                alt="Shared image"
                className="rounded max-w-full max-h-48 object-cover"
                fallbackText="Image expired"
                fallbackClassName="rounded w-full h-32"
              />
            ) : message.type === 'video' ? (
              <video
                src={message.media_url}
                controls
                className="rounded max-w-full max-h-48"
              />
            ) : (
              <a
                href={message.media_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-2 p-2 rounded ${isOutbound ? 'bg-green-600' : 'bg-background'}`}
              >
                <FileText className="w-6 h-6" />
                <span className="text-sm underline">Download file</span>
              </a>
            )}
          </div>
        )}

        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

        <div className={`flex items-center justify-end gap-1 mt-1 ${isOutbound ? 'text-green-100' : 'text-muted-foreground'}`}>
          <span className="text-xs">{formatTime(message.created_at)}</span>
          {isOutbound && <MessageStatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

// Module-level cache to persist across re-mounts (like WhatsApp/Telegram do)
// This survives even if React unmounts and remounts the component
const conversationsCache: {
  data: Conversation[];
  loaded: boolean;
  workspaceId: string | null;
} = {
  data: [],
  loaded: false,
  workspaceId: null
};

const ConversationsInbox: React.FC<ConversationsInboxProps> = ({ workspaceId: propWorkspaceId }) => {
  const { id: routeWorkspaceId } = useParams<{ id: string }>();
  const workspaceId = propWorkspaceId || routeWorkspaceId || 'default';

  // State - Always initialize from cache first
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    // Initialize from cache if available for this workspace
    if (conversationsCache.loaded && conversationsCache.workspaceId === workspaceId) {
      return conversationsCache.data;
    }
    return [];
  });
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetail | null>(null);
  // NEVER start with loading=true if we have cached data
  const [isLoadingList, setIsLoadingList] = useState(() => {
    const hasCached = conversationsCache.loaded && conversationsCache.workspaceId === workspaceId;
    return !hasCached && conversationsCache.data.length === 0;
  });
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'responded' | 'closed'>('all');
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Refs for tracking state without causing re-renders
  const isFetchingRef = useRef(false);
  const hasInitialMessagesLoadRef = useRef<Record<string, boolean>>({});

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const componentId = useId();

  // Debug: Log mount and loading state
  useEffect(() => {
    console.log('🔄 ConversationsInbox MOUNTED', {
      isLoadingList,
      conversationsCount: conversations.length,
      cacheCount: conversationsCache.data.length,
      cacheLoaded: conversationsCache.loaded
    });
    return () => console.log('🔄 ConversationsInbox UNMOUNTED');
  }, []);

  // ============================================================
  // Real-time Updates via SSE
  // ============================================================

  useWhatsAppRealtime({
    workspaceId,
    onEvent: useCallback((event: any) => {
      console.log('📩 Inbox received real-time event:', event);
      setIsRealtimeConnected(true);

      // Handle different event types (support both old and new format)
      const eventType = event.type || '';
      const isMessageReceived = eventType === 'whatsapp_message_received' ||
        eventType === 'message_received' ||
        eventType === 'new_message';
      const isStatusUpdate = eventType === 'whatsapp_message_status' ||
        eventType === 'message_status' ||
        eventType === 'status_update';

      if (isMessageReceived) {
        // New inbound message - ONLY update local state, NO API CALLS
        const messageData = event.data?.message || event.data;
        const phoneNumber = messageData?.from || messageData?.customer_phone || event.data?.from;
        const messageContent = messageData?.text || messageData?.content || messageData?.body || '';
        const messageTime = messageData?.timestamp || new Date().toISOString();

        // Update ONLY the specific conversation locally - NO API CALL
        setConversations(prevConversations => {
          const existingIndex = prevConversations.findIndex(c => c.customer_phone === phoneNumber);

          if (existingIndex >= 0) {
            // Update existing conversation and move to top
            const updated = [...prevConversations];
            const conversation = { ...updated[existingIndex] };
            conversation.last_message_at = messageTime;
            conversation.last_message_preview = messageContent;
            conversation.unread_count = (conversation.unread_count || 0) + 1;
            conversation.status = 'active';

            // Remove from current position and add to top
            updated.splice(existingIndex, 1);
            return [conversation, ...updated];
          }

          // New conversation from unknown number - add as new
          const newConv: Conversation = {
            id: `new-${Date.now()}`,
            customer_phone: phoneNumber,
            customer_name: undefined,
            status: 'active',
            last_message_at: messageTime,
            last_message_preview: messageContent,
            unread_count: 1,
            created_at: messageTime,
          };
          return [newConv, ...prevConversations];
        });

        // If this conversation is currently selected, add the message
        if (selectedConversation && phoneNumber === selectedConversation.customer_phone) {
          const newMsg: ConversationMessage = {
            id: messageData?.id || messageData?.message_id || `temp-${Date.now()}`,
            conversation_id: selectedConversation.id,
            direction: 'inbound',
            type: messageData?.type || 'text',
            content: messageContent,
            status: 'delivered',
            created_at: messageTime,
          };

          setSelectedConversation(prev => {
            if (!prev) return prev;
            // Avoid duplicates
            const exists = prev.messages.some(m => m.id === newMsg.id);
            if (exists) return prev;
            return {
              ...prev,
              messages: [...prev.messages, newMsg],
              last_message_at: newMsg.created_at,
              last_message_preview: newMsg.content,
            };
          });
        }
        // NO background sync - only local state updates

      } else if (isStatusUpdate) {
        // Message status update (sent, delivered, read) - NO API CALLS
        const messageId = event.data?.wamid || event.data?.message_id;
        const newStatus = event.data?.status;

        if (selectedConversation && messageId && newStatus) {
          setSelectedConversation(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: prev.messages.map(msg =>
                msg.id === messageId ? { ...msg, status: newStatus } : msg
              ),
            };
          });
        }
      }
    }, [selectedConversation]),
  });

  // ============================================================
  // Data Fetching - Like WhatsApp: Load once, then only local updates
  // ============================================================

  // Fetch conversations - NEVER shows loading if we have ANY data
  const fetchConversations = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;

    // CRITICAL: Only show loading if we have ZERO conversations
    // Once we have data, NEVER show loading again
    const hasAnyData = conversations.length > 0 || conversationsCache.data.length > 0;

    if (!hasAnyData) {
      setIsLoadingList(true);
    }
    // If we have data, DO NOT set loading to true

    isFetchingRef.current = true;
    setError(null);

    try {
      const response = await whatsappApi.getConversations(workspaceId);
      if (response.error) {
        throw new Error(response.error);
      }

      // Update both state and cache
      setConversations(response.conversations);
      conversationsCache.data = response.conversations;
      conversationsCache.loaded = true;
      conversationsCache.workspaceId = workspaceId;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoadingList(false);
      isFetchingRef.current = false;
    }
  }, [workspaceId]);

  // Update cache whenever conversations state changes
  useEffect(() => {
    if (conversations.length > 0) {
      conversationsCache.data = conversations;
      conversationsCache.loaded = true;
      conversationsCache.workspaceId = workspaceId;
    }
  }, [conversations, workspaceId]);

  const fetchConversationDetail = useCallback(async (conversationId: string, showLoading = true) => {
    // Only show loading on first load of this conversation
    const isFirstLoad = !hasInitialMessagesLoadRef.current[conversationId];
    if (showLoading && isFirstLoad) {
      setIsLoadingMessages(true);
    }

    try {
      const response = await whatsappApi.getConversation(conversationId);
      if (response.error) {
        throw new Error(response.error);
      }
      setSelectedConversation(response.conversation);
      hasInitialMessagesLoadRef.current[conversationId] = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Load conversations on mount - ONLY ONCE per workspace
  useEffect(() => {
    // Only fetch if cache doesn't have data for this workspace
    const needsFetch = !conversationsCache.loaded || conversationsCache.workspaceId !== workspaceId;
    if (needsFetch) {
      fetchConversations();
    }
  }, [workspaceId, fetchConversations]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConversation?.messages]);

  // ============================================================
  // Handlers
  // ============================================================

  const handleSelectConversation = useCallback((conversation: Conversation) => {
    fetchConversationDetail(conversation.id);
  }, [fetchConversationDetail]);

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !selectedConversation || isSending) return;

    const messageText = newMessage.trim();
    const tempId = `temp-${Date.now()}`;

    // Optimistic update: Add message immediately to UI
    const optimisticMessage: ConversationMessage = {
      id: tempId,
      conversation_id: selectedConversation.id,
      direction: 'outbound',
      type: 'text',
      content: messageText,
      status: 'sent', // Will be updated when we get real status
      created_at: new Date().toISOString(),
    };

    // Add optimistic message to UI immediately
    setSelectedConversation(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...prev.messages, optimisticMessage],
        last_message_at: optimisticMessage.created_at,
        last_message_preview: messageText,
      };
    });

    // Also update the conversation in the list (local only, no API call)
    setConversations(prevConversations => {
      return prevConversations.map(conv =>
        conv.id === selectedConversation.id
          ? {
            ...conv,
            last_message_at: optimisticMessage.created_at,
            last_message_preview: messageText,
            status: 'responded' as const
          }
          : conv
      );
    });

    // Clear input immediately for better UX
    setNewMessage('');
    setIsSending(true);

    try {
      const response = await whatsappApi.sendMessage({
        workspace_id: workspaceId,
        to: selectedConversation.customer_phone,
        type: 'text',
        text: messageText,
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to send message');
      }

      // Update the optimistic message with real ID and status
      setSelectedConversation(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map(msg =>
            msg.id === tempId
              ? { ...msg, id: response.message_id || tempId, status: 'sent' }
              : msg
          ),
        };
      });

      // NO background fetch - we already updated locally

    } catch (err) {
      // Mark the optimistic message as failed
      setSelectedConversation(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map(msg =>
            msg.id === tempId
              ? { ...msg, status: 'failed' }
              : msg
          ),
        };
      });
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  }, [newMessage, selectedConversation, workspaceId, isSending]);

  const handleCloseConversation = useCallback(async () => {
    if (!selectedConversation) return;

    try {
      const response = await whatsappApi.closeConversation(selectedConversation.id);
      if (!response.success) {
        throw new Error(response.error || 'Failed to close conversation');
      }

      // Update local state immediately - NO API refresh
      setSelectedConversation(prev => prev ? { ...prev, status: 'closed' } : null);
      setConversations(prev =>
        prev.map(conv =>
          conv.id === selectedConversation.id
            ? { ...conv, status: 'closed' as const }
            : conv
        )
      );

      // NO background refresh - local state is already updated
      setSelectedConversation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close conversation');
    }
  }, [selectedConversation]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  // ============================================================
  // Filtered Conversations
  // ============================================================

  // Use conversations from state, or fall back to cache if state is empty
  const conversationsToUse = conversations.length > 0 ? conversations : conversationsCache.data;

  // Memoized filtered conversations to prevent unnecessary re-renders
  const filteredConversations = useMemo(() => {
    return conversationsToUse.filter((conv) => {
      const matchesSearch = searchQuery === '' ||
        conv.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.customer_phone.includes(searchQuery) ||
        conv.last_message_preview?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || conv.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [conversationsToUse, searchQuery, statusFilter]);

  // Count of conversations
  const conversationCount = useMemo(() => ({
    total: conversationsToUse.length,
    filtered: filteredConversations.length,
  }), [conversationsToUse.length, filteredConversations.length]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Conversations List */}
      <div className="w-80 border-r flex flex-col bg-background">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-500" />
              Conversations
              <Badge variant="secondary" className="text-xs font-normal">
                {conversationCount.filtered}/{conversationCount.total}
              </Badge>
            </h2>
            <div className="flex items-center gap-1">
              {/* Real-time connection indicator */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className={`p-1.5 rounded-full ${isRealtimeConnected ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {isRealtimeConnected ? (
                        <Wifi className="w-4 h-4" />
                      ) : (
                        <WifiOff className="w-4 h-4" />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isRealtimeConnected ? 'Real-time updates active' : 'Connecting...'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => fetchConversations()}
                      disabled={isFetchingRef.current}
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingList ? 'animate-spin' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-1 mt-3">
            {(['all', 'active', 'responded', 'closed'] as const).map((status) => (
              <Button
                key={status}
                variant={statusFilter === status ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter(status)}
                className="text-xs capitalize"
              >
                {status}
              </Button>
            ))}
          </div>
        </div>

        {/* Conversations List */}
        <ScrollArea className="flex-1">
          {/* Only show loading skeleton when we have absolutely NO data anywhere */}
          {isLoadingList && conversations.length === 0 && conversationsCache.data.length === 0 ? (
            <>
              <ConversationSkeleton />
              <ConversationSkeleton />
              <ConversationSkeleton />
            </>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <ConversationListItem
                key={conversation.id}
                conversation={conversation}
                isSelected={selectedConversation?.id === conversation.id}
                onClick={() => handleSelectConversation(conversation)}
              />
            ))
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-background flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-green-100 text-green-700">
                    {selectedConversation.customer_name?.[0] || selectedConversation.customer_phone.slice(-2)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-medium">
                    {selectedConversation.customer_name || selectedConversation.customer_phone}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-3 h-3" />
                    <span>{selectedConversation.customer_phone}</span>
                    <Badge variant="outline" className="capitalize text-xs">
                      {selectedConversation.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => fetchConversationDetail(selectedConversation.id, false)}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Refresh
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleCloseConversation}
                    disabled={selectedConversation.status === 'closed'}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    Close Conversation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 bg-muted/30">
              {isLoadingMessages ? (
                <MessageSkeleton />
              ) : (
                <div className="p-4 min-h-full">
                  {selectedConversation.messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    selectedConversation.messages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            {selectedConversation.status !== 'closed' && (
              <div className="p-4 border-t bg-background">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    disabled={isSending}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || isSending}
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {selectedConversation.status === 'closed' && (
              <div className="p-4 border-t bg-muted/50 text-center text-sm text-muted-foreground">
                This conversation has been closed
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center bg-muted/30">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="font-medium text-lg mb-1">Select a conversation</h3>
              <p className="text-muted-foreground text-sm">
                Choose a conversation from the list to view messages
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="fixed bottom-4 right-4 max-w-sm">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="ml-2"
              >
                <X className="w-3 h-3" />
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
};

export default ConversationsInbox;
