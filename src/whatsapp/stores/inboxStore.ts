/**
 * WhatsApp Inbox Store - Production-Grade Singleton Cache
 * 
 * How WhatsApp, Telegram, Slack handle messaging state:
 * 1. Load conversations ONCE on app start
 * 2. Real-time updates via WebSocket/SSE modify individual items LOCALLY
 * 3. NEVER reload full list - only incremental updates
 * 4. NEVER show loading state after initial load
 * 
 * This store provides:
 * - Singleton pattern (survives component unmounts)
 * - Subscriber pattern for React reactivity
 * - Local-only updates from SSE (no API calls)
 * - Message caching per conversation
 */

import { Conversation, ConversationMessage } from '../types';
import { getConversations, getConversationMessages } from '../api';
import { isSseHealthy } from '../hooks/useWhatsAppRealtime';

// ============================================================
// Types
// ============================================================

interface InboxStore {
  // Conversations
  conversations: Map<number, Conversation>;
  conversationOrder: number[]; // Ordered by last_message_at DESC

  // Messages cache (by conversation ID)
  messages: Map<number, ConversationMessage[]>;
  messagesFullyLoaded: Set<number>; // Track which conversations have been fully loaded from API

  // Loading states
  isInitialLoadDone: boolean;
  isLoadingConversations: boolean;
  loadingMessageIds: Set<number>;

  // Metadata
  workspaceId: string | null;
  lastFetchTime: number;

  // Subscribers
  conversationSubscribers: Set<() => void>;
  messageSubscribers: Map<number, Set<() => void>>; // Per conversation

  // Pagination
  conversationOffset: number;
  hasMoreConversations: boolean;
  hasMoreMessages: Map<number, boolean>; // Per conversation
  oldestMessageId: Map<number, number>; // Per conversation (for before_id)
}

// ============================================================
// Singleton Store Instance
// ============================================================

const store: InboxStore = {
  conversations: new Map(),
  conversationOrder: [],
  messages: new Map(),
  messagesFullyLoaded: new Set(), // Track which conversations have full message history
  isInitialLoadDone: false,
  isLoadingConversations: false,
  loadingMessageIds: new Set(),
  workspaceId: null,
  lastFetchTime: 0,
  conversationSubscribers: new Set(),
  messageSubscribers: new Map(),
  conversationOffset: 0,
  hasMoreConversations: true,
  hasMoreMessages: new Map(),
  oldestMessageId: new Map(),
};

// Throttle interval (minimum time between API fetches)
const FETCH_THROTTLE_MS = 30000; // 30 seconds

// ============================================================
// Subscription Methods
// ============================================================

export function subscribeToConversations(callback: () => void): () => void {
  store.conversationSubscribers.add(callback);
  return () => store.conversationSubscribers.delete(callback);
}

export function subscribeToMessages(conversationId: number, callback: () => void): () => void {
  if (!store.messageSubscribers.has(conversationId)) {
    store.messageSubscribers.set(conversationId, new Set());
  }
  store.messageSubscribers.get(conversationId)!.add(callback);
  return () => store.messageSubscribers.get(conversationId)?.delete(callback);
}

function notifyConversationSubscribers() {
  store.conversationSubscribers.forEach(cb => cb());
}

function notifyMessageSubscribers(conversationId: number) {
  const subscribers = store.messageSubscribers.get(conversationId);
  console.log('🔔 [InboxStore] Notifying message subscribers for conversation:', conversationId, 'count:', subscribers?.size || 0);
  subscribers?.forEach(cb => cb());
}

// ============================================================
// Getters (for React components)
// ============================================================

const EMPTY_ARRAY: any[] = [];
let conversationListCache: Conversation[] | null = null;

// ============================================================
// Getters (for React components)
// ============================================================

export function getConversationList(): Conversation[] {
  if (conversationListCache) return conversationListCache;

  conversationListCache = store.conversationOrder
    .map(id => store.conversations.get(id))
    .filter((c): c is Conversation => c !== undefined);

  return conversationListCache;
}

export function getConversation(id: number): Conversation | undefined {
  return store.conversations.get(id);
}

export function getMessagesForConversation(conversationId: number): ConversationMessage[] {
  return store.messages.get(conversationId) || EMPTY_ARRAY;
}

export function isInitialLoadComplete(): boolean {
  return store.isInitialLoadDone;
}

export function isLoadingConversations(): boolean {
  return store.isLoadingConversations;
}

export function isLoadingMessagesFor(conversationId: number): boolean {
  return store.loadingMessageIds.has(conversationId);
}

export function hasMoreConversations(): boolean {
  return store.hasMoreConversations;
}

export function hasMoreMessagesFor(conversationId: number): boolean {
  return store.hasMoreMessages.get(conversationId) !== false; // Default true until proven false
}

// ============================================================
// Actions - Load Data
// ============================================================

/**
 * Load conversations - Called once on inbox mount
 * NEVER shows loading after initial load
 */
/**
 * Load conversations - Initial load
 */
export async function loadConversationList(workspaceId?: string): Promise<void> {
  // Get workspace_id if not provided
  const wsId = workspaceId || localStorage.getItem('sv_whatsapp_workspace_id') || sessionStorage.getItem('sv_whatsapp_workspace_id') || null;

  // If already loaded for the SAME workspace, skip
  if (store.isInitialLoadDone && store.workspaceId === wsId) {
    return;
  }

  // If workspace changed, clear and reload
  if (store.isInitialLoadDone && store.workspaceId !== wsId) {
    console.log('🔄 [InboxStore] Workspace changed from', store.workspaceId, 'to', wsId, '- clearing and reloading');
    store.conversations.clear();
    store.conversationOrder = [];
    store.messages.clear();
    store.messagesFullyLoaded.clear();
    store.conversationOffset = 0;
    store.hasMoreConversations = true;
    conversationListCache = null;
  }

  // Prevent concurrent loads
  if (store.isLoadingConversations) return;

  // Only show loading on very first load
  if (!store.isInitialLoadDone) {
    store.isLoadingConversations = true;
    notifyConversationSubscribers();
  }

  console.log('🔄 [InboxStore] Loading initial conversations for workspace:', wsId);

  try {
    const limit = 50;
    const result = await getConversations(limit, 0, undefined, undefined, wsId || undefined);

    // Clear and rebuild store
    store.conversations.clear();
    store.conversationOrder = [];
    conversationListCache = null;

    result.conversations.forEach(conv => {
      store.conversations.set(conv.id, conv);
      store.conversationOrder.push(conv.id);
    });

    store.workspaceId = wsId;
    store.isInitialLoadDone = true;
    store.lastFetchTime = Date.now();

    // Pagination updates
    store.conversationOffset = result.conversations.length;
    store.hasMoreConversations = result.conversations.length === limit;

    console.log('✅ [InboxStore] Loaded', result.conversations.length, 'conversations, hasMore:', store.hasMoreConversations);

  } catch (err) {
    console.error('❌ [InboxStore] Failed to load conversations:', err);
  } finally {
    store.isLoadingConversations = false;
    notifyConversationSubscribers();
  }
}

/**
 * Load more conversations (Infinite Scroll)
 */
export async function loadMoreConversations(): Promise<void> {
  if (store.isLoadingConversations || !store.hasMoreConversations || !store.workspaceId) return;

  store.isLoadingConversations = true;
  notifyConversationSubscribers(); // Trigger loading spinner

  try {
    const limit = 50;
    // Use offset from store
    const result = await getConversations(limit, store.conversationOffset, undefined, undefined, store.workspaceId);

    if (result.conversations.length > 0) {
      result.conversations.forEach(conv => {
        if (!store.conversations.has(conv.id)) {
          store.conversations.set(conv.id, conv);
          store.conversationOrder.push(conv.id);
        }
      });
      conversationListCache = null;
      store.conversationOffset += result.conversations.length;
    }

    store.hasMoreConversations = result.conversations.length === limit;
    console.log('📦 [InboxStore] Loaded next page:', result.conversations.length, 'convs, offset:', store.conversationOffset);

  } catch (err) {
    console.error('❌ [InboxStore] Failed to load more conversations:', err);
  } finally {
    store.isLoadingConversations = false;
    notifyConversationSubscribers();
  }
}

/**
 * Load messages for a conversation
 * Caches results, only shows loading on first load
 */
/**
 * Load messages for a conversation (Initial)
 */
export async function loadMessagesFor(conversationId: number): Promise<ConversationMessage[]> {
  // Return cached if FULLY loaded from API (not just SSE messages)
  if (store.messagesFullyLoaded.has(conversationId)) {
    return store.messages.get(conversationId) || [];
  }

  // Skip for new conversations (id: 0)
  if (!conversationId || conversationId === 0) return [];

  // Prevent concurrent loads for same conversation
  if (store.loadingMessageIds.has(conversationId)) {
    return store.messages.get(conversationId) || [];
  }

  store.loadingMessageIds.add(conversationId);
  notifyMessageSubscribers(conversationId);

  console.log('🔄 [InboxStore] Loading messages for conversation:', conversationId);

  try {
    const limit = 50;
    const messages = await getConversationMessages(conversationId, limit); // Default is latest

    // Get any SSE messages that arrived before/during API load
    const existingMessages = store.messages.get(conversationId) || [];

    // Merge: API messages + any new SSE messages not in API response
    const apiMessageIds = new Set(messages.map(m => m.id));
    const apiMessageWamids = new Set(messages.filter(m => m.wamid).map(m => m.wamid));
    const newSseMessages = existingMessages.filter(m =>
      !apiMessageIds.has(m.id) &&
      !(m.wamid && apiMessageWamids.has(m.wamid))
    );

    // Combine and sort by timestamp
    const allMessages = [...messages, ...newSseMessages].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    store.messages.set(conversationId, allMessages);
    store.messagesFullyLoaded.add(conversationId); // Initial load done

    // Pagination tracking
    if (messages.length > 0) {
      // Assuming messages are returned oldest to newest by default API, OR newest first?
      // Actually typical chat API returns newest first (desc). 
      // If our API returns DESC, then the LAST item is the OLDEST.
      // If ASC, FIRST is OLDEST.
      // Assuming backend returns newest first for page 1, but let's check sorting.
      // The API sorts messages usually by created_at DESC for limit.
      // So the LAST message in the array is the oldest one fetched.
      // Or if sorted ASC locally, the FIRST message in `messages` array is the oldest.

      // Use the oldest *numeric* ID for pagination
      // (String IDs might be temporary/SSE and not valid for backend cursors)
      const oldest = allMessages.find(m => typeof m.id === 'number');
      if (oldest) {
        store.oldestMessageId.set(conversationId, oldest.id as number);
      }

      // If we got fewer than limit, we reached the end
      store.hasMoreMessages.set(conversationId, messages.length === limit);
    } else {
      store.hasMoreMessages.set(conversationId, false);
    }

    console.log('✅ [InboxStore] Loaded', messages.length, 'messages. hasMore:', store.hasMoreMessages.get(conversationId));
    return allMessages;

  } catch (err) {
    console.error('❌ [InboxStore] Failed to load messages:', err);
    return store.messages.get(conversationId) || [];
  } finally {
    store.loadingMessageIds.delete(conversationId);
    notifyMessageSubscribers(conversationId);
  }
}

/**
 * Load older messages (Infinite Scroll upwards)
 */
export async function loadOlderMessages(conversationId: number): Promise<void> {
  // Checks
  if (!conversationId || conversationId === 0) return;
  if (store.loadingMessageIds.has(conversationId)) return;
  const hasMore = store.hasMoreMessages.get(conversationId);
  if (hasMore === false) return; // Explicitly false means done. Undefined means maybe.

  const oldestId = store.oldestMessageId.get(conversationId);
  if (!oldestId) return; // Need a reference point

  store.loadingMessageIds.add(conversationId);
  // Optional: notify subscribers if you want to show a spinner at the top
  notifyMessageSubscribers(conversationId);

  console.log('📜 [InboxStore] Loading older messages before ID:', oldestId);

  try {
    const limit = 50;
    const olderMessages = await getConversationMessages(conversationId, limit, oldestId);

    if (olderMessages.length > 0) {
      const currentMessages = store.messages.get(conversationId) || [];

      // Deduplicate (just in case)
      const currentIds = new Set(currentMessages.map(m => m.id));
      const newUnique = olderMessages.filter(m => !currentIds.has(m.id));

      // Merge: Older + Current. Sort by time ASC
      const merged = [...newUnique, ...currentMessages].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      store.messages.set(conversationId, merged);

      // Update oldest ID
      const newOldest = merged.find(m => typeof m.id === 'number');
      if (newOldest) {
        store.oldestMessageId.set(conversationId, newOldest.id as number);
      }
    }

    // Update hasMore status
    store.hasMoreMessages.set(conversationId, olderMessages.length === limit);
    console.log('✅ [InboxStore] Loaded', olderMessages.length, 'older messages.');

  } catch (err) {
    console.error('❌ [InboxStore] Failed to load older messages:', err);
  } finally {
    store.loadingMessageIds.delete(conversationId);
    notifyMessageSubscribers(conversationId);
  }
}

/**
 * Force refresh conversations (with throttling)
 */
export async function refreshConversations(): Promise<void> {
  const now = Date.now();
  if (now - store.lastFetchTime < FETCH_THROTTLE_MS) {
    console.log('⏳ [InboxStore] Throttled - too soon since last fetch');
    return;
  }

  // Force reload by temporarily clearing the flag
  store.isInitialLoadDone = false;
  await loadConversationList(store.workspaceId || undefined);
}

// ============================================================
// Actions - Local Updates (NO API CALLS - for SSE events)
// ============================================================

/**
 * Update a conversation locally (from SSE event)
 */
export function updateConversationLocally(conversationId: number, updates: Partial<Conversation>): void {
  console.log('🔄 [InboxStore] updateConversationLocally:', { conversationId, updates });

  const existing = store.conversations.get(conversationId);
  if (!existing) {
    console.warn('⚠️ [InboxStore] Conversation not found for update:', conversationId);
    return;
  }

  const updated = { ...existing, ...updates };
  store.conversations.set(conversationId, updated);

  // Move to top if there's a new message
  if (updates.last_message_at) {
    store.conversationOrder = [
      conversationId,
      ...store.conversationOrder.filter(id => id !== conversationId)
    ];
    console.log('📍 [InboxStore] Conversation moved to top:', conversationId);
  }

  conversationListCache = null;
  console.log('🔔 [InboxStore] Notifying', store.conversationSubscribers.size, 'subscribers');
  notifyConversationSubscribers();
}

/**
 * Add a new incoming message locally (from SSE event)
 */
export function addMessageLocally(conversationId: number, message: ConversationMessage): void {
  console.log('📥 [InboxStore] addMessageLocally called:', { conversationId, messageId: message.id });

  const messages = store.messages.get(conversationId) || [];

  // Avoid duplicates - check both id and wamid
  const isDuplicate = messages.some(m =>
    m.id === message.id ||
    (message.wamid && m.wamid && m.wamid === message.wamid)
  );

  if (isDuplicate) {
    console.log('⚠️ [InboxStore] Duplicate message, skipping:', message.id, message.wamid);
    return;
  }

  store.messages.set(conversationId, [...messages, message]);
  console.log('✅ [InboxStore] Message added to store, total messages:', store.messages.get(conversationId)?.length);

  // Update conversation preview
  const conv = store.conversations.get(conversationId);
  if (conv) {
    // Extract text content for preview
    const messageContent = typeof message.content === 'string'
      ? message.content
      : (message.content as any)?.text || (message.content as any)?.body || '[Media]';

    console.log('📝 [InboxStore] Updating conversation preview:', { conversationId, preview: messageContent });

    updateConversationLocally(conversationId, {
      last_message_at: message.created_at,
      last_message_preview: messageContent, // ADD THE PREVIEW TEXT!
      unread_count: message.direction === 'incoming' ? (conv.unread_count || 0) + 1 : conv.unread_count,
    });
  } else {
    console.warn('⚠️ [InboxStore] Conversation not found in store:', conversationId);
  }

  notifyMessageSubscribers(conversationId);
}

/**
 * Update message status locally (from SSE event)
 */
export function updateMessageStatusLocally(
  conversationId: number,
  messageId: string | number,
  status: ConversationMessage['status']
): void {
  const messages = store.messages.get(conversationId);
  if (!messages) return;

  const updated = messages.map(msg =>
    (msg.id === messageId || msg.wamid === messageId) ? { ...msg, status } : msg
  );

  store.messages.set(conversationId, updated);
  notifyMessageSubscribers(conversationId);
}

/**
 * Mark conversation as read
 */
export function markConversationAsRead(conversationId: number): void {
  updateConversationLocally(conversationId, { unread_count: 0 });
}

/**
 * Add a new conversation (when message from new contact)
 */
export function addConversationLocally(conversation: Conversation): void {
  if (store.conversations.has(conversation.id)) return;

  store.conversations.set(conversation.id, conversation);
  store.conversationOrder = [conversation.id, ...store.conversationOrder];
  conversationListCache = null;
  notifyConversationSubscribers();
}

/**
 * Remove a conversation
 */
export function removeConversation(conversationId: number): void {
  store.conversations.delete(conversationId);
  store.conversationOrder = store.conversationOrder.filter(id => id !== conversationId);
  store.messages.delete(conversationId);
  conversationListCache = null;
  notifyConversationSubscribers();
}

// ============================================================
// Clear Store (for workspace/account switching)
// ============================================================

/**
 * Clear all cached data - call this when switching workspaces or accounts
 */
export function clearInboxStore(): void {
  console.log('🧹 [InboxStore] Clearing all cached data');

  store.conversations.clear();
  store.conversationOrder = [];
  store.messages.clear();
  store.messagesFullyLoaded.clear();
  store.isInitialLoadDone = false;
  store.isLoadingConversations = false;
  store.loadingMessageIds.clear();
  store.workspaceId = null;
  store.lastFetchTime = 0;
  conversationListCache = null;

  // Notify all subscribers
  notifyConversationSubscribers();
  store.conversationOffset = 0;
  store.hasMoreConversations = true;
  store.hasMoreMessages.clear();
  store.oldestMessageId.clear();
  store.messageSubscribers.forEach((subscribers, convId) => {
    subscribers.forEach(cb => cb());
  });
}

// ============================================================
// Polling Fallback (for when SSE is unavailable / buffered)
// ============================================================

let _pollingTimer: ReturnType<typeof setInterval> | null = null;
let _pollingActiveConvId: number | null = null;

/**
 * Start background polling for new conversations & messages.
 * Runs every `intervalMs` (default 5 s).
 * Safe to call multiple times — subsequent calls update the active conv ID.
 */
export function startPolling(activeConversationId: number | null, intervalMs = 5000): void {
  _pollingActiveConvId = activeConversationId;

  // Already running — just update active conv
  if (_pollingTimer) return;

  const tick = async () => {
    if (!store.isInitialLoadDone || !store.workspaceId) return;

    // NOTE: We intentionally do NOT skip polling even when SSE appears healthy.
    // Dev tunnels and reverse proxies often buffer SSE streams, causing status
    // updates (delivered/read) to never reach the client. Polling is cheap and
    // ensures the UI stays in sync.

    try {
      // ── 1. Poll conversations ──
      const { conversations: fresh } = await getConversations(50, 0, undefined, undefined, store.workspaceId);

      let conversationsChanged = false;

      for (const conv of fresh) {
        const existing = store.conversations.get(conv.id);

        if (!existing) {
          // Brand-new conversation
          store.conversations.set(conv.id, conv);
          if (!store.conversationOrder.includes(conv.id)) {
            store.conversationOrder.unshift(conv.id);
          }
          conversationsChanged = true;
        } else {
          // Compare last_message_at to detect updates
          const existingTime = existing.last_message_at ? new Date(existing.last_message_at).getTime() : 0;
          const freshTime = conv.last_message_at ? new Date(conv.last_message_at).getTime() : 0;
          if (freshTime > existingTime || conv.unread_count !== existing.unread_count) {
            store.conversations.set(conv.id, { ...existing, ...conv });
            conversationsChanged = true;
          }
        }
      }

      if (conversationsChanged) {
        // Re-sort order by last_message_at DESC
        store.conversationOrder.sort((a, b) => {
          const aConv = store.conversations.get(a);
          const bConv = store.conversations.get(b);
          const aTime = aConv?.last_message_at ? new Date(aConv.last_message_at).getTime() : 0;
          const bTime = bConv?.last_message_at ? new Date(bConv.last_message_at).getTime() : 0;
          return bTime - aTime;
        });
        conversationListCache = null;
        notifyConversationSubscribers();
      }

      // ── 2. Poll messages for active conversation ──
      const activeId = _pollingActiveConvId;
      if (activeId && activeId > 0) {
        const freshMsgs = await getConversationMessages(activeId, 50);
        const currentMsgs = store.messages.get(activeId) || [];

        // Build a set of known ids + wamids for fast lookup
        const knownIds = new Set(currentMsgs.map(m => m.id));
        const knownWamids = new Set(currentMsgs.filter(m => m.wamid).map(m => m.wamid));

        const newMsgs = freshMsgs.filter(
          m => !knownIds.has(m.id) && !(m.wamid && knownWamids.has(m.wamid))
        );

        if (newMsgs.length > 0) {
          const merged = [...currentMsgs, ...newMsgs].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          store.messages.set(activeId, merged);
          store.messagesFullyLoaded.add(activeId);
          notifyMessageSubscribers(activeId);
        }

        // Also update statuses for existing messages
        for (const fm of freshMsgs) {
          if (fm.wamid && knownWamids.has(fm.wamid)) {
            const existing = currentMsgs.find(m => m.wamid === fm.wamid);
            if (existing && existing.status !== fm.status) {
              updateMessageStatusLocally(activeId, fm.wamid, fm.status);
            }
          }
        }
      }
    } catch (err) {
      // Swallow polling errors — don't break the app
      console.warn('[InboxStore] Polling error:', err);
    }
  };

  _pollingTimer = setInterval(tick, intervalMs);
  // Run first tick after a short delay
  setTimeout(tick, 1500);
  console.log('🔄 [InboxStore] Polling started (interval:', intervalMs, 'ms)');
}

/**
 * Update which conversation is actively being viewed (for message polling).
 */
export function setPollingActiveConversation(conversationId: number | null): void {
  _pollingActiveConvId = conversationId;
}

/**
 * Stop polling.
 */
export function stopPolling(): void {
  if (_pollingTimer) {
    clearInterval(_pollingTimer);
    _pollingTimer = null;
    console.log('⏹️ [InboxStore] Polling stopped');
  }
}

// ============================================================
// Debug
// ============================================================

export function _getDebugState() {
  return {
    conversationCount: store.conversations.size,
    messagesCached: store.messages.size,
    isInitialLoadDone: store.isInitialLoadDone,
    workspaceId: store.workspaceId,
    lastFetchTime: new Date(store.lastFetchTime).toISOString(),
  };
}
