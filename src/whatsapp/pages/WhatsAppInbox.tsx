// WhatsApp Inbox Page
// ====================
// Main inbox UI for viewing conversations and messages
// Production-grade: Conversations load ONCE, SSE updates are LOCAL only

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ConversationList, ConversationThread, TemplatesPanel, InboxLoadingScreen, ContactInfoPanel } from '../components';
import { Conversation, WhatsAppRealtimeEvent } from '../types';
import { useWhatsAppRealtime } from '../hooks/useWhatsAppRealtime';
import { Inbox, LayoutTemplate, Plus, X, PanelRight } from 'lucide-react';
import logo from '@/assets/sociovia_logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { API_BASE_URL } from "@/config";
import {
  addMessageLocally,
  updateMessageStatusLocally,
  updateConversationLocally,
  addConversationLocally,
  getConversationList,
  clearInboxStore,
  _getDebugState,
  startPolling,
  stopPolling,
  setPollingActiveConversation,
} from '../stores/inboxStore';

const API_BASE = API_BASE_URL;

interface WhatsAppAccount {
  id: number;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string;
  is_active: boolean;
}

export function WhatsAppInbox() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  // REMOVED: refreshKey - NO MORE full refreshes!
  const [account, setAccount] = useState<WhatsAppAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);
  const [contactPanelOpen, setContactPanelOpen] = useState(false);

  // Get base path from current location (agent or dashboard)
  const basePath = location.pathname.startsWith('/agent') ? '/agent' : '/dashboard';

  // Track if we've shown new message toast recently
  const lastToastRef = useRef<number>(0);

  // Track previous account to detect changes
  const prevAccountRef = useRef<string | null>(null);

  // Check connection status (validates token, not just database records)
  useEffect(() => {
    const checkConnection = async () => {
      setAccountLoading(true);
      try {
        // Get workspace_id from storage - try multiple keys for compatibility
        const workspaceId = localStorage.getItem('sv_whatsapp_workspace_id')
          || sessionStorage.getItem('sv_whatsapp_workspace_id')
          || localStorage.getItem('sv_selected_workspace_id')
          || sessionStorage.getItem('sv_selected_workspace_id');

        // If no workspace_id available, can't check connection
        if (!workspaceId) {
          console.warn('[WhatsAppInbox] No workspace_id available, skipping connection check');
          setAccount(null);
          setAccountLoading(false);
          return;
        }

        // Use /connection-path API which validates token with Meta
        const res = await fetch(`${API_BASE}/api/whatsapp/connection-path?workspace_id=${workspaceId}`, { credentials: 'include' });
        const data = await res.json();

        console.log('[WhatsAppInbox] Connection check result:', data);
        console.log('[WhatsAppInbox] Current inbox store state:', _getDebugState());

        // Only set account if status is CONNECTED (token is valid)
        if (data.status === 'CONNECTED' && data.account_summary) {
          const newPhoneNumberId = data.account_summary.phone_number_id || '';

          // Check if account has changed - if so, clear the inbox cache
          if (prevAccountRef.current && prevAccountRef.current !== newPhoneNumberId) {
            console.log('[WhatsAppInbox] Account changed from', prevAccountRef.current, 'to', newPhoneNumberId, '- clearing cache');
            clearInboxStore();
          }

          prevAccountRef.current = newPhoneNumberId;

          setAccount({
            id: data.account_summary.id || 0,
            phone_number_id: newPhoneNumberId,
            display_phone_number: data.account_summary.phone_number || '',
            verified_name: data.account_summary.verified_name || '',
            is_active: true,
          });
        } else {
          // Not connected - clear account and cache
          if (prevAccountRef.current) {
            clearInboxStore();
          }
          prevAccountRef.current = null;
          setAccount(null);
        }
      } catch (err) {
        console.error('Failed to check connection:', err);
        setAccount(null);
      } finally {
        setAccountLoading(false);
      }
    };
    checkConnection();
  }, []);

  // Real-Time Inbox Updates - LOCAL ONLY, NO API CALLS
  const workspaceId = localStorage.getItem('sv_whatsapp_workspace_id')
    || sessionStorage.getItem('sv_whatsapp_workspace_id')
    || localStorage.getItem('sv_selected_workspace_id')
    || sessionStorage.getItem('sv_selected_workspace_id');

  const handleRealtimeEvent = useCallback((event: WhatsAppRealtimeEvent) => {
    console.log('📩 [Inbox] SSE event received:', event.type, event.data);

    if (event.type === 'whatsapp_message_received') {
      // New message received - UPDATE LOCALLY, no API call!
      const message = event.data?.message;
      const conversationId = event.data?.conversation_id;

      if (conversationId && message) {
        // Extract text from content object (backend sends {type: 'text', text: 'hi'})
        const messageContent = message.content;
        let messageText = '';
        if (typeof messageContent === 'string') {
          messageText = messageContent;
        } else if (messageContent && typeof messageContent === 'object') {
          const contentObj = messageContent as { text?: string; body?: string };
          messageText = contentObj.text || contentObj.body || '[Media]';
        }

        // Check if conversation exists in store - if not, we need to add it
        const existingConv = _getDebugState().conversationCount > 0;
        const storeConvs = getConversationList();
        const conversationExists = storeConvs.some(c => c.id === conversationId);

        if (!conversationExists) {
          // New conversation from SSE - create a stub conversation first
          const newConv: Conversation = {
            id: conversationId,
            account_id: event.data?.account_id || account?.id || 0,
            user_phone: (event.data as any)?.user_phone || (message as any).from || '',
            user_name: (event.data as any)?.user_name || (message as any).profile_name || undefined,
            status: 'open',
            unread_count: 1,
            last_message_at: message.created_at || new Date().toISOString(),
            last_message_preview: messageText,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          console.log('📥 [Inbox] Adding new conversation from SSE:', conversationId);
          addConversationLocally(newConv);
        }

        // Add message to store locally
        // Use actual message.id from backend, or wamid hash for real WhatsApp messages
        const messageId = message.id ||
          (message.wamid ? 'sse-' + message.wamid : Date.now());

        console.log('📩 [Inbox] Adding SSE message:', { id: messageId, wamid: message.wamid, text: messageText });

        addMessageLocally(conversationId, {
          id: messageId,
          wamid: message.wamid,
          conversation_id: conversationId,
          direction: message.direction || 'incoming',
          type: message.type || 'text',
          content: messageContent,
          body: messageText,
          status: 'delivered',
          timestamp: message.created_at || new Date().toISOString(),
          created_at: message.created_at || new Date().toISOString(),
        });

        // NOTE: addMessageLocally ALREADY updates conversation preview and unread_count
        // Only override unread_count if this is the CURRENTLY SELECTED conversation
        if (selectedConversation?.id === conversationId) {
          updateConversationLocally(conversationId, { unread_count: 0 });
        }

        // Toast notification (throttled to prevent spam)
        const now = Date.now();
        if (now - lastToastRef.current > 3000 && message.direction === 'incoming') {
          lastToastRef.current = now;
          toast.info('New message from Customer');
        }
      }
    } else if (event.type === 'whatsapp_message_status') {
      // Message status update - UPDATE LOCALLY, no API call!
      const conversationId = event.data?.conversation_id;
      const messageId = event.data?.wamid;
      const status = event.data?.status;

      if (conversationId && messageId && status) {
        updateMessageStatusLocally(conversationId, messageId, status);
      }
    }
    // NO setRefreshKey - everything is updated locally!
  }, [selectedConversation?.id]);

  useWhatsAppRealtime({
    workspaceId: workspaceId || '',
    onEvent: handleRealtimeEvent
  });

  // Polling fallback — SSE may be buffered by proxies / dev tunnels
  useEffect(() => {
    if (!account) return;
    startPolling(selectedConversation?.id ?? null, 5000);
    return () => stopPolling();
  }, [account]);

  // Keep polling aware of which conversation is active
  useEffect(() => {
    setPollingActiveConversation(selectedConversation?.id ?? null);
  }, [selectedConversation?.id]);

  const handleSelectConversation = useCallback(async (conversation: Conversation) => {
    setSelectedConversation(conversation);

    if (conversation.unread_count > 0) {
      try {
        await fetch(`${API_BASE}/api/whatsapp/conversations/${conversation.id}/read`, {
          method: 'POST',
          credentials: 'include',
        });
        // Update locally instead of refreshing
        updateConversationLocally(conversation.id, { unread_count: 0 });
      } catch (error) {
        console.error('Failed to mark conversation as read:', error);
      }
    }
  }, []);

  const handleStartNewChat = async () => {
    const phone = newChatPhone.replace(/\D/g, ''); // Remove non-digits
    if (!phone || phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setCreatingChat(true);
    try {
      // Get workspace_id from storage
      const workspaceId = localStorage.getItem('sv_whatsapp_workspace_id') || sessionStorage.getItem('sv_whatsapp_workspace_id');
      const wsParam = workspaceId ? `&workspace_id=${workspaceId}` : '';

      // Get all conversations to check if one exists for this phone
      const res = await fetch(`${API_BASE}/api/whatsapp/conversations?limit=200${wsParam}`, { credentials: 'include' });
      const data = await res.json();

      // Find existing conversation with matching phone
      const existingConversation = data.conversations?.find((c: Conversation) => {
        if (!c.user_phone) return false;
        return c.user_phone === phone || c.user_phone.endsWith(phone) || phone.endsWith(c.user_phone);
      });

      if (existingConversation) {
        // Conversation exists, select it
        setSelectedConversation(existingConversation);
        toast.success('Opened existing conversation');
      } else {
        // Create a "virtual" conversation for display (it will be created when first message is sent)
        setSelectedConversation({
          id: 0, // Temporary ID
          account_id: account?.id || 0,
          user_phone: phone,
          status: 'open',
          unread_count: 0,
          is_session_open: true, // Allow typing text messages initially (Meta enforces 24h rule)
          last_message_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Conversation);
        toast.success(`Ready to message ${phone}. Send a template to start the conversation.`);
      }

      setShowNewChat(false);
      setNewChatPhone('');
    } catch (err) {
      toast.error('Failed to start new chat');
    } finally {
      setCreatingChat(false);
    }
  };

  // Show loading state
  if (accountLoading) {
    return <InboxLoadingScreen />;
  }

  // Show no account linked state
  if (!account) {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
        <div className="border-b bg-gradient-to-r from-background via-background to-primary/5 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white border border-primary/20 shadow-lg">
              <img src={logo} alt="Sociovia" className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">WhatsApp Inbox</h1>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md text-center p-8">
            <Inbox className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No WhatsApp Account Linked</h2>
            <p className="text-muted-foreground mb-6">
              To use the inbox, please connect your WhatsApp Business account for this workspace.
            </p>
            <Button onClick={() => navigate(`${basePath}/whatsapp/setup`)} className="gap-2">
              <Inbox className="w-4 h-4" />
              Connect WhatsApp Account
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header with animation */}
      <div className="border-b bg-gradient-to-r from-background via-background to-primary/5 p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white border border-primary/20 shadow-lg">
              <img src={logo} alt="Sociovia" className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {account?.verified_name ? <><span className="text-green-600">{account.verified_name}'s</span> Inbox</> : 'WhatsApp Inbox'}
              </h1>
              <p className="text-sm text-muted-foreground">
                View conversations and messages. Real-time updates active.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {/* New Chat Button */}
            <Button
              variant="default"
              className="gap-2"
              onClick={() => setShowNewChat(true)}
            >
              <Plus className="w-4 h-4" />
              New Chat
            </Button>

            {/* Contact Panel Toggle */}
            {selectedConversation && (
              <Button
                variant={contactPanelOpen ? "secondary" : "outline"}
                size="icon"
                onClick={() => setContactPanelOpen(!contactPanelOpen)}
                className="hover:bg-primary/10"
                title="Toggle Contact Info"
              >
                <PanelRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main content - 3-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left panel - Conversations list */}
        <div className="w-1/3 min-w-[280px] max-w-[400px] border-r bg-gradient-to-b from-background to-muted/20 overflow-hidden shadow-inner">
          <ConversationList
            selectedConversationId={selectedConversation?.id || null}
            onSelectConversation={handleSelectConversation}
          />
        </div>

        {/* Middle panel - Message thread */}
        <div className="flex-1 bg-gradient-to-br from-background via-background to-muted/10 overflow-hidden">
          <ConversationThread
            conversation={selectedConversation}
            phoneNumberId={account?.phone_number_id}
            onNewConversationCreated={(newId) => {
              if (selectedConversation) {
                setSelectedConversation({ ...selectedConversation, id: newId });
              }
            }}
          />
        </div>

        {/* Right panel - Contact Info (collapsible) */}
        <ContactInfoPanel
          conversation={selectedConversation}
          isOpen={contactPanelOpen}
          onClose={() => setContactPanelOpen(false)}
          accountId={account?.id}
        />
      </div>

      {/* New Chat Dialog */}
      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start New Conversation</DialogTitle>
            <DialogDescription>
              Enter a phone number to start a new WhatsApp conversation.
              Include country code (e.g., 919876543210 for India).
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Input
              placeholder="Phone number (e.g., 919876543210)"
              value={newChatPhone}
              onChange={(e) => setNewChatPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartNewChat()}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowNewChat(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleStartNewChat}
                disabled={creatingChat || !newChatPhone}
              >
                {creatingChat ? 'Starting...' : 'Start Chat'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSS for animations */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
