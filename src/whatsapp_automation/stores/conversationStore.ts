/**
 * Conversation Store - Production-Grade State Management
 * 
 * This is a singleton store that manages conversation state across the app.
 * Similar to how WhatsApp/Telegram handle messaging:
 * 
 * 1. Load conversations ONCE on app start
 * 2. Real-time updates via SSE only modify individual items
 * 3. NO full reloads - only incremental updates
 * 4. Conversations list is NEVER in loading state after initial load
 */

import { whatsappApi, type Conversation, type ConversationDetail, type ConversationMessage } from '../api';

// Types
interface ConversationStore {
  // Data
  conversations: Map<string, Conversation>;
  conversationOrder: string[]; // Ordered list of conversation IDs
  messages: Map<string, ConversationMessage[]>; // Messages by conversation ID
  
  // State
  isInitialLoadComplete: boolean;
  isLoadingConversations: boolean;
  loadingMessages: Set<string>; // Set of conversation IDs currently loading messages
  
  // Metadata
  workspaceId: string | null;
  lastFetchTime: number;
  
  // Subscribers for reactivity
  subscribers: Set<() => void>;
}

// Singleton store instance
const store: ConversationStore = {
  conversations: new Map(),
  conversationOrder: [],
  messages: new Map(),
  isInitialLoadComplete: false,
  isLoadingConversations: false,
  loadingMessages: new Set(),
  workspaceId: null,
  lastFetchTime: 0,
  subscribers: new Set(),
};

// Minimum time between fetches (prevents spam)
const MIN_FETCH_INTERVAL = 30000; // 30 seconds

// Notify all subscribers of state change
function notifySubscribers() {
  store.subscribers.forEach(callback => callback());
}

// Subscribe to store changes
export function subscribeToStore(callback: () => void): () => void {
  store.subscribers.add(callback);
  return () => store.subscribers.delete(callback);
}

// Get current state (for React components)
export function getStoreState() {
  return {
    conversations: Array.from(store.conversations.values()),
    conversationOrder: store.conversationOrder,
    isInitialLoadComplete: store.isInitialLoadComplete,
    isLoadingConversations: store.isLoadingConversations,
    workspaceId: store.workspaceId,
  };
}

// Get conversations as ordered array
export function getOrderedConversations(): Conversation[] {
  return store.conversationOrder
    .map(id => store.conversations.get(id))
    .filter((c): c is Conversation => c !== undefined);
}

// Get messages for a conversation
export function getMessages(conversationId: string): ConversationMessage[] {
  return store.messages.get(conversationId) || [];
}

// Check if messages are loading for a conversation
export function isLoadingMessages(conversationId: string): boolean {
  return store.loadingMessages.has(conversationId);
}

/**
 * Initialize/Load conversations - Called ONCE on app mount
 */
export async function loadConversations(workspaceId: string, forceRefresh = false): Promise<void> {
  // Skip if already loaded for this workspace and not forcing refresh
  if (
    store.isInitialLoadComplete && 
    store.workspaceId === workspaceId && 
    !forceRefresh
  ) {
    console.log('📦 Using cached conversations');
    return;
  }
  
  // Skip if already fetching
  if (store.isLoadingConversations) {
    console.log('⏳ Already fetching conversations');
    return;
  }
  
  // Throttle refreshes
  if (forceRefresh && Date.now() - store.lastFetchTime < MIN_FETCH_INTERVAL) {
    console.log('⏳ Throttled - too soon since last fetch');
    return;
  }
  
  // Only show loading if this is the very first load (no cached data)
  const isFirstLoad = !store.isInitialLoadComplete || store.workspaceId !== workspaceId;
  if (isFirstLoad && store.conversations.size === 0) {
    store.isLoadingConversations = true;
    notifySubscribers();
  }
  
  console.log('🔄 Fetching conversations...');
  
  try {
    const response = await whatsappApi.getConversations(workspaceId);
    
    if (response.error) {
      console.error('Failed to load conversations:', response.error);
      return;
    }
    
    // Update store
    store.conversations.clear();
    store.conversationOrder = [];
    
    response.conversations.forEach(conv => {
      store.conversations.set(conv.id, conv);
      store.conversationOrder.push(conv.id);
    });
    
    store.workspaceId = workspaceId;
    store.isInitialLoadComplete = true;
    store.lastFetchTime = Date.now();
    
    console.log(`✅ Loaded ${response.conversations.length} conversations`);
    
  } catch (err) {
    console.error('Error loading conversations:', err);
  } finally {
    store.isLoadingConversations = false;
    notifySubscribers();
  }
}

/**
 * Load messages for a specific conversation
 */
export async function loadMessages(conversationId: string): Promise<ConversationDetail | null> {
  // Return cached messages if available
  if (store.messages.has(conversationId)) {
    console.log('📦 Using cached messages for', conversationId);
    const conv = store.conversations.get(conversationId);
    if (conv) {
      return {
        ...conv,
        messages: store.messages.get(conversationId) || [],
      } as ConversationDetail;
    }
  }
  
  // Skip if already loading
  if (store.loadingMessages.has(conversationId)) {
    console.log('⏳ Already loading messages for', conversationId);
    return null;
  }
  
  store.loadingMessages.add(conversationId);
  notifySubscribers();
  
  try {
    const response = await whatsappApi.getConversation(conversationId);
    
    if (response.error || !response.conversation) {
      console.error('Failed to load messages:', response.error);
      return null;
    }
    
    // Cache messages
    store.messages.set(conversationId, response.conversation.messages);
    
    console.log(`✅ Loaded ${response.conversation.messages.length} messages for conversation`);
    
    return response.conversation;
    
  } catch (err) {
    console.error('Error loading messages:', err);
    return null;
  } finally {
    store.loadingMessages.delete(conversationId);
    notifySubscribers();
  }
}

/**
 * Update a single conversation (from SSE event) - NO API CALL
 */
export function updateConversation(
  conversationId: string, 
  updates: Partial<Conversation>
): void {
  const existing = store.conversations.get(conversationId);
  
  if (existing) {
    // Update existing conversation
    store.conversations.set(conversationId, { ...existing, ...updates });
    
    // Move to top of list if it has new message
    if (updates.last_message_at) {
      store.conversationOrder = [
        conversationId,
        ...store.conversationOrder.filter(id => id !== conversationId)
      ];
    }
  }
  
  notifySubscribers();
}

/**
 * Add a new message to a conversation - NO API CALL
 */
export function addMessage(conversationId: string, message: ConversationMessage): void {
  const messages = store.messages.get(conversationId) || [];
  
  // Avoid duplicates
  if (messages.some(m => m.id === message.id)) {
    return;
  }
  
  store.messages.set(conversationId, [...messages, message]);
  
  // Update conversation preview
  const conv = store.conversations.get(conversationId);
  if (conv) {
    store.conversations.set(conversationId, {
      ...conv,
      last_message_at: message.created_at,
      last_message_preview: message.content,
      unread_count: message.direction === 'inbound' ? (conv.unread_count || 0) + 1 : conv.unread_count,
    });
    
    // Move to top
    store.conversationOrder = [
      conversationId,
      ...store.conversationOrder.filter(id => id !== conversationId)
    ];
  }
  
  notifySubscribers();
}

/**
 * Update message status - NO API CALL
 */
export function updateMessageStatus(
  conversationId: string, 
  messageId: string, 
  status: ConversationMessage['status']
): void {
  const messages = store.messages.get(conversationId);
  if (!messages) return;
  
  const updated = messages.map(msg => 
    msg.id === messageId ? { ...msg, status } : msg
  );
  
  store.messages.set(conversationId, updated);
  notifySubscribers();
}

/**
 * Add a new conversation (from SSE when new contact messages)
 */
export function addConversation(conversation: Conversation): void {
  if (store.conversations.has(conversation.id)) return;
  
  store.conversations.set(conversation.id, conversation);
  store.conversationOrder = [conversation.id, ...store.conversationOrder];
  
  notifySubscribers();
}

/**
 * Mark conversation as closed - NO API CALL for state update
 */
export function closeConversation(conversationId: string): void {
  const conv = store.conversations.get(conversationId);
  if (conv) {
    store.conversations.set(conversationId, { ...conv, status: 'closed' });
    notifySubscribers();
  }
}

/**
 * Clear all data (on logout or workspace switch)
 */
export function clearStore(): void {
  store.conversations.clear();
  store.conversationOrder = [];
  store.messages.clear();
  store.isInitialLoadComplete = false;
  store.workspaceId = null;
  notifySubscribers();
}

// Export store for debugging
export const _debugStore = store;
