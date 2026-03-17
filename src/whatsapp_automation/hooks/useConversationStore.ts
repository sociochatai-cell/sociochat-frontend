/**
 * useConversationStore - React Hook for Conversation Store
 * 
 * This hook provides reactive access to the conversation store.
 * Components using this hook will re-render when store state changes.
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import {
  subscribeToStore,
  getStoreState,
  getOrderedConversations,
  getMessages,
  isLoadingMessages as checkLoadingMessages,
  loadConversations,
  loadMessages,
  updateConversation,
  addMessage,
  updateMessageStatus as storeUpdateMessageStatus,
  addConversation,
  closeConversation,
  _debugStore,
} from '../stores/conversationStore';
import type { Conversation, ConversationDetail, ConversationMessage } from '../api';

/**
 * Main hook for accessing conversation store
 */
export function useConversationStore(workspaceId: string) {
  // Use useSyncExternalStore for efficient subscription
  const storeState = useSyncExternalStore(
    subscribeToStore,
    getStoreState,
    getStoreState // Server snapshot (same for SSR)
  );
  
  // Load conversations on mount (only if not already loaded)
  useEffect(() => {
    if (workspaceId) {
      loadConversations(workspaceId);
    }
  }, [workspaceId]);
  
  // Get ordered conversations
  const conversations = getOrderedConversations();
  
  // Manual refresh function (throttled in store)
  const refresh = useCallback((force = false) => {
    loadConversations(workspaceId, force);
  }, [workspaceId]);
  
  return {
    conversations,
    isInitialLoading: storeState.isLoadingConversations && conversations.length === 0,
    isInitialLoadComplete: storeState.isInitialLoadComplete,
    refresh,
  };
}

/**
 * Hook for managing selected conversation and its messages
 */
export function useSelectedConversation() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  
  // Subscribe to store for message updates
  useEffect(() => {
    if (!selectedId) return;
    
    return subscribeToStore(() => {
      const storeMessages = getMessages(selectedId);
      if (storeMessages.length > 0) {
        setMessages(storeMessages);
      }
      setIsLoadingMessages(checkLoadingMessages(selectedId));
    });
  }, [selectedId]);
  
  // Select a conversation and load its messages
  const selectConversation = useCallback(async (conversationId: string, workspaceId: string) => {
    setSelectedId(conversationId);
    
    // Check if we have cached messages
    const cachedMessages = getMessages(conversationId);
    if (cachedMessages.length > 0) {
      setMessages(cachedMessages);
      // Get conversation details from store state
      const state = getStoreState();
      const convArray = Array.from(getOrderedConversations());
      const conv = convArray.find(c => c.id === conversationId);
      if (conv) {
        setConversation({
          ...conv,
          messages: cachedMessages,
        } as ConversationDetail);
      }
      setIsLoadingMessages(false);
      return;
    }
    
    // Load messages (will show loading only for first load of this conversation)
    setIsLoadingMessages(true);
    const detail = await loadMessages(conversationId);
    if (detail) {
      setConversation(detail);
      setMessages(detail.messages);
    }
    setIsLoadingMessages(false);
  }, []);
  
  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedId(null);
    setConversation(null);
    setMessages([]);
  }, []);
  
  // Add optimistic message
  const addOptimisticMessage = useCallback((message: ConversationMessage) => {
    if (!selectedId) return;
    
    // Add to store
    addMessage(selectedId, message);
    
    // Update local state immediately
    setMessages(prev => [...prev, message]);
    setConversation(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [...prev.messages, message],
        last_message_at: message.created_at,
        last_message_preview: message.content,
      };
    });
  }, [selectedId]);
  
  // Update message status (for optimistic updates and failures)
  const updateMessageStatus = useCallback((messageId: string, status: ConversationMessage['status'], newId?: string) => {
    if (!selectedId) return;
    
    // Update in store
    storeUpdateMessageStatus(selectedId, messageId, status);
    
    // Update local state
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, id: newId || m.id, status } : m
    ));
    setConversation(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: prev.messages.map(m => 
          m.id === messageId ? { ...m, id: newId || m.id, status } : m
        ),
      };
    });
  }, [selectedId]);
  
  return {
    selectedId,
    conversation,
    messages,
    isLoadingMessages,
    selectConversation,
    clearSelection,
    addOptimisticMessage,
    updateMessageStatus,
  };
}

/**
 * Hook for handling real-time events
 */
export function useConversationRealtime(workspaceId: string) {
  const [isConnected, setIsConnected] = useState(false);
  
  const handleEvent = useCallback((event: any) => {
    console.log('📩 Store handling real-time event:', event.type);
    setIsConnected(true);
    
    const eventType = event.type || '';
    
    // Handle new message
    if (
      eventType === 'whatsapp_message_received' || 
      eventType === 'message_received' || 
      eventType === 'new_message'
    ) {
      const messageData = event.data?.message || event.data;
      const conversationId = event.data?.conversation_id?.toString();
      const phoneNumber = messageData?.from || messageData?.customer_phone;
      
      if (conversationId) {
        // Add message to existing conversation
        const newMessage: ConversationMessage = {
          id: messageData?.id || messageData?.message_id || `temp-${Date.now()}`,
          conversation_id: conversationId,
          direction: 'inbound',
          type: messageData?.type || 'text',
          content: messageData?.text || messageData?.content || messageData?.body || '',
          status: 'delivered',
          created_at: messageData?.timestamp || new Date().toISOString(),
        };
        
        addMessage(conversationId, newMessage);
        
        // Update conversation metadata
        updateConversation(conversationId, {
          last_message_at: newMessage.created_at,
          last_message_preview: newMessage.content,
          status: 'active',
        });
      }
    }
    
    // Handle status update
    if (
      eventType === 'whatsapp_message_status' || 
      eventType === 'message_status' || 
      eventType === 'status_update'
    ) {
      const conversationId = event.data?.conversation_id?.toString();
      const messageId = event.data?.wamid || event.data?.message_id;
      const status = event.data?.status;
      
      if (conversationId && messageId && status) {
        storeUpdateMessageStatus(conversationId, messageId, status);
      }
    }
  }, []);
  
  return { handleEvent, isConnected };
}

// Export store functions for direct use
export const conversationActions = {
  updateConversation,
  addMessage,
  updateMessageStatus: storeUpdateMessageStatus,
  addConversation,
  closeConversation,
  loadMessages,
};
