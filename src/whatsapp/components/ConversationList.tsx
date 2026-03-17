// Conversation List Component
// ===========================
// Left panel showing all conversations with filters and sorting
// Uses singleton store - loads ONCE, never shows loading after initial load

import { useState, useEffect, useMemo, useCallback, useSyncExternalStore } from 'react';
import { RefreshCw, MessageCircle, Users, Search, Filter, Flame, Clock, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConversationItem } from './ConversationItem';
import { deleteConversation } from '../api';
import { Conversation } from '../types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  subscribeToConversations,
  getConversationList,
  isInitialLoadComplete,
  isLoadingConversations,
  loadConversationList,
  refreshConversations,
  removeConversation,
  loadMoreConversations,
  hasMoreConversations,
} from '../stores/inboxStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ConversationListProps {
  selectedConversationId: number | null;
  onSelectConversation: (conversation: Conversation) => void;
}

type FilterType = 'all' | 'unread' | 'active' | 'expired' | 'needs_reply';

const FILTERS: { key: FilterType; label: string; icon?: React.ReactNode }[] = [
  { key: 'all', label: 'All', icon: <Filter className="w-4 h-4" /> },
  { key: 'unread', label: 'Unread', icon: <MessageCircle className="w-4 h-4 text-primary" /> },
  { key: 'active', label: 'Active', icon: <CheckCircle className="w-4 h-4 text-green-500" /> },
  { key: 'needs_reply', label: 'Needs Reply', icon: <Flame className="w-4 h-4 text-orange-500" /> },
  { key: 'expired', label: 'Expired', icon: <Clock className="w-4 h-4 text-muted-foreground" /> },
];

export function ConversationList({
  selectedConversationId,
  onSelectConversation,
}: ConversationListProps) {
  // Subscribe to store using separate selectors to ensure referential stability
  const conversations = useSyncExternalStore(subscribeToConversations, getConversationList, getConversationList);
  const isLoading = useSyncExternalStore(subscribeToConversations, isLoadingConversations, isLoadingConversations);
  const isInitialDone = useSyncExternalStore(subscribeToConversations, isInitialLoadComplete, isInitialLoadComplete);
  const hasMore = useSyncExternalStore(subscribeToConversations, hasMoreConversations, hasMoreConversations);

  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Load conversations ONCE on mount
  useEffect(() => {
    console.log('📋 [ConversationList] Mounted, loading conversations...');
    loadConversationList();
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await refreshConversations();
    setIsRefreshing(false);
  }, []);

  const handleDeleteConversation = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (deletingId) return;

    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    setDeletingId(id);
    try {
      const result = await deleteConversation(id);
      if (result.success) {
        toast.success('Conversation deleted');
        removeConversation(id);
      } else {
        toast.error(result.error || 'Failed to delete conversation');
      }
    } catch (err) {
      toast.error('Failed to delete conversation');
    } finally {
      setDeletingId(null);
    }
  };

  // Infinite Scroll Handler
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Trigger when within 50px of bottom
    if (scrollHeight - scrollTop - clientHeight < 50) {
      if (!isLoading && hasMore && !searchQuery) { // Disable infinite scroll during search for now
        loadMoreConversations();
      }
    }
  };

  // Check if conversation needs reply (unread + last was inbound)
  const needsReply = (conv: Conversation) => {
    return conv.unread_count > 0 && conv.last_inbound_at &&
      (!conv.last_outbound_at || new Date(conv.last_inbound_at) > new Date(conv.last_outbound_at));
  };

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    // ── Phone-level dedup (safety net for legacy duplicate rows) ──
    // Key by last 10 digits to merge "9999320932" and "919999320932".
    // Two-pass: first pick the winner per phone, then filter.
    const phoneWinners = new Map<string, typeof conversations[0]>();
    for (const conv of conversations) {
      const digits = conv.user_phone?.replace(/\D/g, '') || '';
      const key = digits.length >= 10 ? digits.slice(-10) : digits;
      if (!key) { phoneWinners.set(`__no_phone_${conv.id}`, conv); continue; }
      const existing = phoneWinners.get(key);
      if (!existing) {
        phoneWinners.set(key, conv);
      } else {
        const eTime = existing.last_message_at ? new Date(existing.last_message_at).getTime() : 0;
        const cTime = conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0;
        if (cTime > eTime) phoneWinners.set(key, conv);
      }
    }
    let result = Array.from(phoneWinners.values());

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(conv => {
        const phone = conv.user_phone?.toLowerCase() || '';
        const name = conv.user_name?.toLowerCase() || '';
        return phone.includes(query) || name.includes(query);
      });
    }

    // Apply category filter
    switch (activeFilter) {
      case 'unread':
        result = result.filter(conv => conv.unread_count > 0);
        break;
      case 'active':
        result = result.filter(conv => conv.is_session_open);
        break;
      case 'expired':
        result = result.filter(conv => !conv.is_session_open && !conv.closed_by_agent);
        break;
      case 'needs_reply':
        result = result.filter(needsReply);
        break;
    }

    // Sort: unread first, then by last message time, expired last
    result.sort((a, b) => {
      // Unread always first
      if (a.unread_count > 0 && b.unread_count === 0) return -1;
      if (b.unread_count > 0 && a.unread_count === 0) return 1;

      // Active sessions before expired
      if (a.is_session_open && !b.is_session_open) return -1;
      if (b.is_session_open && !a.is_session_open) return 1;

      // Then by most recent message
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });

    return result;
  }, [conversations, searchQuery, activeFilter]);

  // Count for each filter
  const filterCounts = useMemo(() => ({
    all: conversations.length,
    unread: conversations.filter(c => c.unread_count > 0).length,
    active: conversations.filter(c => c.is_session_open).length,
    expired: conversations.filter(c => !c.is_session_open && !c.closed_by_agent).length,
    needs_reply: conversations.filter(needsReply).length,
  }), [conversations]);

  // CRITICAL: Only show loading on very first load when we have NO data
  if (isLoading && conversations.length === 0 && !isInitialDone) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <MessageCircle className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading conversations...</p>
      </div>
    );
  }

  if (conversations.length === 0 && isInitialDone) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4 animate-pulse">
          <Users className="w-10 h-10 text-primary/50" />
        </div>
        <h3 className="font-semibold text-lg mb-2">No conversations</h3>
        <p className="text-sm text-muted-foreground text-center">
          Start a conversation to see it here
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-transparent to-primary/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Conversations</h2>
            {conversations.length > 0 && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                {filteredConversations.length}/{conversations.length}
              </span>
            )}
          </div>
          <Button
            onClick={handleRefresh}
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-primary/10 hover:scale-110 transition-all duration-200"
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
          </Button>
        </div>

        {/* Search & Filter Bar */}
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-10 h-9 text-sm"
          />

          {/* Filter Dropdown */}
          <div className="absolute right-0 top-0 h-full flex items-center pr-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7 hover:bg-transparent",
                    activeFilter !== 'all' ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {activeFilter === 'all' ? (
                    <Filter className="w-4 h-4" />
                  ) : (
                    FILTERS.find(f => f.key === activeFilter)?.icon || <Filter className="w-4 h-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Filter Conversations</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {FILTERS.map((filter) => {
                  const count = filterCounts[filter.key];
                  const isActive = activeFilter === filter.key;

                  return (
                    <DropdownMenuItem
                      key={filter.key}
                      onClick={() => setActiveFilter(filter.key)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {filter.icon || <Filter className="w-4 h-4" />}
                        <span>{filter.label}</span>
                      </div>
                      {count > 0 && filter.key !== 'all' && (
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded-full font-medium",
                          filter.key === 'needs_reply' ? "bg-orange-100 text-orange-600" : "bg-muted text-muted-foreground"
                        )}>
                          {count}
                        </span>
                      )}
                      {isActive && <CheckCircle className="w-3 h-3 text-primary ml-2" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Conversation List */}
      <div
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            {activeFilter !== 'all' ? (
              <>
                <Filter className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No {activeFilter.replace('_', ' ')} conversations</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setActiveFilter('all')}
                  className="mt-2"
                >
                  Show all conversations
                </Button>
              </>
            ) : (
              <>
                <Search className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No conversations match "{searchQuery}"</p>
              </>
            )}
          </div>
        ) : (
          filteredConversations.map((conv, index) => (
            <div
              key={conv.id}
              className="animate-in slide-in-from-left-2 duration-300"
              style={{ animationDelay: `${Math.min(index, 5) * 30}ms` }}
            >
              <ConversationItem
                conversation={conv}
                isActive={conv.id === selectedConversationId}
                onClick={() => onSelectConversation(conv)}
                onDelete={(e) => handleDeleteConversation(e, conv.id)}
                needsReply={needsReply(conv)}
              />
            </div>
          ))
        )}

        {/* Infinite Scroll Loading Spinner */}
        {isLoading && isInitialDone && hasMore && !searchQuery && (
          <div className="p-4 flex justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
