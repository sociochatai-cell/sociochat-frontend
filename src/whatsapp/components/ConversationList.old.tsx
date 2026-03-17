// Conversation List Component
// ===========================
// Left panel showing all conversations with beautiful animations

import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, MessageCircle, Users, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConversationItem } from './ConversationItem';
import { EmptyState } from './EmptyState';
import { getConversations, deleteConversation } from '../api';
import { Conversation } from '../types';
import { toast } from 'sonner';

interface ConversationListProps {
  selectedConversationId: number | null;
  onSelectConversation: (conversation: Conversation) => void;
}

export function ConversationList({
  selectedConversationId,
  onSelectConversation,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchConversations = async () => {
    try {
      setError(null);
      const result = await getConversations(50, 0);
      setConversations(result.conversations);
    } catch (err) {
      setError('Failed to load conversations');
      console.error('Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    fetchConversations();
  }, []); // Initial load only, parent handles real-time refreshes via key prop

  const handleDeleteConversation = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Prevent selecting the conversation

    if (deletingId) return;

    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    setDeletingId(id);
    try {
      const result = await deleteConversation(id);
      if (result.success) {
        toast.success('Conversation deleted');
        // Remove from list locally
        setConversations(prev => prev.filter(c => c.id !== id));
        // If selected was deleted, clear selection (handled by parent logic typically, but we can't change props)
        if (selectedConversationId === id) {
          // Ideally notify parent, but for now user will see empty right pane or last state
        }
      } else {
        toast.error(result.error || 'Failed to delete conversation');
      }
    } catch (err) {
      toast.error('Failed to delete conversation');
    } finally {
      setDeletingId(null);
    }
  };

  // Filter conversations based on search query (real-time filtering)
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;

    const query = searchQuery.toLowerCase().trim();
    return conversations.filter(conv => {
      const phone = conv.user_phone?.toLowerCase() || '';
      const name = conv.user_name?.toLowerCase() || '';
      return phone.includes(query) || name.includes(query);
    });
  }, [conversations, searchQuery]);

  if (loading && conversations.length === 0) {
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

  if (error && conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <MessageCircle className="w-8 h-8 text-destructive" />
        </div>
        <p className="text-sm text-destructive mb-4 text-center">{error}</p>
        <Button
          onClick={fetchConversations}
          variant="outline"
          size="sm"
          className="hover:scale-105 transition-transform"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (conversations.length === 0) {
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
            onClick={fetchConversations}
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-primary/10 hover:scale-110 transition-all duration-200"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
          </Button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center">
            <Search className="w-8 h-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No conversations match "{searchQuery}"</p>
          </div>
        ) : (
          filteredConversations.map((conv, index) => (
            <div
              key={conv.id}
              className="animate-in slide-in-from-left-2 duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <ConversationItem
                conversation={conv}
                isActive={conv.id === selectedConversationId}
                onClick={() => onSelectConversation(conv)}
                onDelete={(e) => handleDeleteConversation(e, conv.id)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

