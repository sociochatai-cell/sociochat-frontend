// WhatsApp Inbox Page
// ====================
// Main inbox UI for viewing conversations and messages
// Production-grade: Conversations load ONCE, SSE updates are LOCAL only

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ConversationList, ConversationThread, TemplatesPanel, InboxLoadingScreen, ContactInfoPanel, FlowResponsesPanel } from '../components';
import { Conversation, WhatsAppRealtimeEvent } from '../types';
import { useWhatsAppRealtime } from '../hooks/useWhatsAppRealtime';
import logo from '@/assets/sociovia_logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { API_BASE_URL, WHATSAPP_REST_API_PREFIX, API_ENDPOINT } from "@/config";
import { isAgentMode } from '@/lib/authToken';
import { getWorkspaceId, setWorkspaceId } from '../utils/workspaceContext';
import crmApi from '@/crm/api';
import {
  Building2,
  ChevronDown,
  Shield,
  Lock,
  Unlock,
  Plus,
  X,
  PanelRight,
  Workflow,
  Inbox,
  LayoutTemplate,
  ExternalLink,
  UserPlus
} from 'lucide-react';
import {
  addMessageLocally,
  updateMessageStatusLocally,
  updateConversationLocally,
  addConversationLocally,
  getConversationList,
  clearInboxStore,
  startPolling,
  stopPolling,
  requestInboxFilterReload,
  loadConversationList,
} from '../stores/inboxStore';
import { useWhatsAppConnection, connectionPathHasLinkedAccount } from '../hooks/useWhatsAppData';

const API_BASE = API_BASE_URL;

type InboxFilterType = 'all' | 'unread' | 'active' | 'expired' | 'needs_reply' | 'human_required' | 'opted_out';

interface WhatsAppAccount {
  id: number;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string;
  is_active: boolean;
  is_coexistence?: boolean;
}

interface CanClaimResponse {
  success: boolean;
  allowed: boolean;
  reason: null | 'assigned_to_other' | 'workspace_not_granted';
  message: string;
}

export function WhatsAppInbox() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const focusNeedsReply =
    queryParams.get('focus') === 'needs_reply' ||
    queryParams.get('focus') === 'needs_attention';
  const initialFilter: InboxFilterType =
    focusNeedsReply ||
    queryParams.get('filter') === 'needs_reply' ||
    queryParams.get('filter') === 'needs_attention'
      ? 'needs_reply'
      : queryParams.get('filter') === 'unread'
        ? 'unread'
        : 'all';
  const shouldAutoSelectUnread = queryParams.get('autoselect') === '1';
  const shouldForceServerUnreadLoad = focusNeedsReply;
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatPhone, setNewChatPhone] = useState('');
  const [creatingChat, setCreatingChat] = useState(false);
  const [contactPanelOpen, setContactPanelOpen] = useState(false);
  const [flowPanelOpen, setFlowPanelOpen] = useState(false);
  const [addingToCrm, setAddingToCrm] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [inboxFilter, setInboxFilter] = useState<InboxFilterType>(initialFilter);
  const [viewportWidth, setViewportWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1280);

  // --- Workspace Switcher & Password State ---
  const [workspaces, setWorkspaces] = useState<{ id: string, name: string }[]>([]);
  const [isLocked, setIsLocked] = useState(getWorkspaceId() === '1');
  const [passwordInput, setPasswordInput] = useState('');
  const [isSwitchingWorkspace, setIsSwitchingWorkspace] = useState(false);

  // Get base path from current location (agent or dashboard)
  const basePath = location.pathname.startsWith('/agent') ? '/agent' : '/dashboard';

  // Track if we've shown new message toast recently
  const lastToastRef = useRef<number>(0);

  // Track previous account to detect changes
  const prevAccountRef = useRef<string | null>(null);

  const isMobile = viewportWidth < 768;
  const isDesktop = viewportWidth >= 1025;

  useEffect(() => {
    setInboxFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileView('chat');
      return;
    }

    if (selectedConversation) {
      setMobileView('chat');
    } else {
      setMobileView('list');
    }
  }, [isMobile, selectedConversation]);

  const workspaceId = getWorkspaceId() || '';
  const [secondaryLoadsEnabled, setSecondaryLoadsEnabled] = useState(false);

  // Conversations first — defer connection check, workspaces, and polling
  useEffect(() => {
    const id = window.setTimeout(() => setSecondaryLoadsEnabled(true), 2500);
    return () => window.clearTimeout(id);
  }, []);

  const {
    data: connectionData,
    isLoading: connectionLoading,
  } = useWhatsAppConnection(workspaceId, secondaryLoadsEnabled);

  const account = useMemo((): WhatsAppAccount | null => {
    if (!connectionPathHasLinkedAccount(connectionData)) return null;
    const summary = connectionData!.account_summary!;
    return {
      id: Number(summary.id) || 0,
      phone_number_id: summary.phone_number_id || '',
      display_phone_number: summary.phone_number || '',
      verified_name: summary.verified_name || '',
      is_active: true,
      is_coexistence: Boolean((summary as { is_coexistence?: boolean }).is_coexistence),
    };
  }, [connectionData]);

  // Only clear inbox when the linked phone number actually changes — not when connection-path is slow/fails
  useEffect(() => {
    if (!connectionData) return;

    if (!connectionPathHasLinkedAccount(connectionData)) {
      prevAccountRef.current = null;
      return;
    }

    const summary = connectionData!.account_summary!;
    const newPhoneNumberId = summary.phone_number_id || '';
    if (prevAccountRef.current && prevAccountRef.current !== newPhoneNumberId) {
      clearInboxStore();
    }
    prevAccountRef.current = newPhoneNumberId;
  }, [connectionData, isLocked]);

  // Load contacts immediately — do not wait for connection-path
  useEffect(() => {
    if (!workspaceId || isLocked) return;
    void loadConversationList(workspaceId);
  }, [workspaceId, isLocked]);

  // Fetch workspaces for switcher — low priority, after conversations
  useEffect(() => {
    if (!secondaryLoadsEnabled) return;

    const fetchWorkspaces = async () => {
      try {
        let user: { id?: string | number } | null = null;
        const userStr = localStorage.getItem('sv_user') || sessionStorage.getItem('sv_user');
        if (userStr) {
          try {
            user = JSON.parse(userStr);
          } catch {
            user = null;
          }
        }
        if (!user?.id) {
          try {
            const meRes = await fetch(`${API_BASE}/api/me`, { credentials: 'include' });
            if (meRes.ok) {
              user = await meRes.json();
            }
          } catch {
            /* ignore */
          }
        }
        const qs = user?.id ? `?user_id=${encodeURIComponent(String(user.id))}` : '';
        const res = await fetch(`${API_BASE}/api/workspaces${qs}`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.workspaces) {
          setWorkspaces(data.workspaces);
        }
      } catch (err) {
        console.error('Failed to fetch workspaces:', err);
      }
    };
    fetchWorkspaces();
  }, [secondaryLoadsEnabled]);

  const handleWorkspaceChange = (newWsId: string) => {
    setIsSwitchingWorkspace(true);
    setWorkspaceId(newWsId);

    if (newWsId === '1') {
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }

    window.location.reload();
  };

  const handleUnlock = () => {
    if (passwordInput === 'prabhu@1charan') {
      setIsLocked(false);
      toast.success('Workspace unlocked');
    } else {
      toast.error('Incorrect password');
    }
  };

  const handleRealtimeEvent = useCallback((event: WhatsAppRealtimeEvent) => {
    console.log('📩 [Inbox] SSE event received:', event.type, event.data);

    if (event.type === 'whatsapp_conversation_updated') {
      const conversationId = event.data?.conversation_id;
      const patch = event.data?.conversation;
      const humanRequired =
        patch?.human_required ?? event.data?.human_required ?? false;

      if (conversationId && patch) {
        updateConversationLocally(conversationId, {
          human_required: humanRequired,
          needs_attention: patch.needs_attention ?? event.data?.needs_attention,
          human_required_reason: patch.human_required_reason,
          human_required_at: patch.human_required_at,
          last_message_at: patch.last_message_at,
          last_message_preview: patch.last_message_preview,
        } as Partial<Conversation>);
        if (selectedConversation?.id === conversationId) {
          setSelectedConversation((prev) =>
            prev && prev.id === conversationId ? ({ ...prev, ...patch } as Conversation) : prev
          );
        }
      }

      if (humanRequired) {
        requestInboxFilterReload();
      }
      return;
    }

    if (event.type === 'whatsapp_message_received') {
      const message = event.data?.message;
      const conversationId = event.data?.conversation_id;
      const fullConversation = event.data?.conversation;

      if (conversationId && message) {
        const messageContent = message.content;
        let messageText = '';
        if (typeof messageContent === 'string') {
          messageText = messageContent;
        } else if (messageContent && typeof messageContent === 'object') {
          const contentObj = messageContent as { text?: string; body?: string };
          messageText = contentObj.text || contentObj.body || '[Media]';
        }

        const storeConvs = getConversationList();
        const conversationExists = storeConvs.some(c => c.id === conversationId);

        if (!conversationExists) {
          const newConv: Conversation = {
            id: conversationId,
            account_id: event.data?.account_id || account?.id || 0,
            user_phone: (message as any).from || (message as any).to || '',
            user_name: (message as any).profile_name || undefined,
            status: 'open',
            unread_count: 1,
            last_message_at: message.created_at || new Date().toISOString(),
            last_message_preview: messageText,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          addConversationLocally(newConv);
        } else if (fullConversation) {
          updateConversationLocally(conversationId, {
            status: fullConversation.status,
            unread_count: fullConversation.unread_count,
            last_message_at: fullConversation.last_message_at,
            session_expires_at: fullConversation.session_expires_at,
          } as any);
        }

        const messageId = message.id || (message.wamid ? 'sse-' + message.wamid : Date.now());

        addMessageLocally(conversationId, {
          id: messageId,
          wamid: message.wamid,
          conversation_id: conversationId,
          direction: message.direction || (event.data as any).direction || 'incoming',
          type: message.type || 'text',
          content: messageContent,
          body: messageText,
          status: message.status || (message.direction === 'outgoing' || message.direction === 'echo' ? 'sent' : 'received'),
          timestamp: message.created_at || new Date().toISOString(),
          created_at: message.created_at || new Date().toISOString(),
        });

        if (selectedConversation?.id === conversationId) {
          updateConversationLocally(conversationId, { unread_count: 0 });
        }

        const now = Date.now();
        if (now - lastToastRef.current > 3000 && message.direction === 'incoming') {
          lastToastRef.current = now;
          toast.info('New message from Customer');
        }
      }
    } else if (event.type === 'whatsapp_message_status') {
      const conversationId = event.data?.conversation_id;
      const messageId = event.data?.wamid;
      const status = event.data?.status;
      if (conversationId && messageId && status) {
        updateMessageStatusLocally(conversationId, messageId, status, {
          error_code: event.data?.error_code,
          error_message: event.data?.error_message,
        });
      }
    }
  }, [selectedConversation?.id, account?.id]);

  useWhatsAppRealtime({
    workspaceId: secondaryLoadsEnabled ? workspaceId : '',
    onEvent: handleRealtimeEvent
  });

  useEffect(() => {
    if (!workspaceId || isLocked || !secondaryLoadsEnabled) return;

    // Polling fallback starts quickly, so inbox still updates if SSE is flaky.
    const startDelay = window.setTimeout(() => {
      startPolling(selectedConversation?.id ?? null, 7000);
    }, 2000);

    return () => {
      window.clearTimeout(startDelay);
      stopPolling();
    };
  }, [workspaceId, isLocked, secondaryLoadsEnabled, selectedConversation?.id]);

  const handleSelectConversation = useCallback(async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    if (isMobile) {
      setMobileView('chat');
    }
    if (conversation.unread_count > 0) {
      try {
        await fetch(`${WHATSAPP_REST_API_PREFIX}/conversations/${conversation.id}/read`, {
          method: 'POST',
          credentials: 'include',
        });
        updateConversationLocally(conversation.id, { unread_count: 0 });
      } catch (error) {
        console.error('Failed to mark conversation as read:', error);
      }
    }
  }, [isMobile]);

  const handleBackToList = useCallback(() => {
    setMobileView('list');
  }, []);

  const handleStartNewChat = async () => {
    const phone = newChatPhone.replace(/\D/g, '');
    if (!phone || phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    setCreatingChat(true);
    try {
      const wsId = getWorkspaceId();

      // Agents only: instant conflict feedback before opening the chat. The send
      // path enforces this server-side too, so this is purely a pre-check — if it
      // fails (network/parse), fall through and let the send-time guard handle it.
      if (isAgentMode()) {
        try {
          const token = localStorage.getItem('sociovia_agent_token');
          const claimRes = await fetch(`${API_ENDPOINT}/agent-auth/can-claim`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            credentials: 'omit',
            body: JSON.stringify({ workspace_id: Number(wsId), phone }),
          });
          const claimData: CanClaimResponse = await claimRes.json();
          if (!claimData.allowed) {
            toast.error(
              claimData.message ||
                (claimData.reason === 'assigned_to_other'
                  ? 'This number is already assigned to another agent.'
                  : 'You cannot start a chat with this number.')
            );
            return;
          }
        } catch (claimErr) {
          console.warn('can-claim pre-check failed, falling through to send-time guard:', claimErr);
        }
      }

      const wsParam = wsId ? `&workspace_id=${wsId}` : '';
      const res = await fetch(`${WHATSAPP_REST_API_PREFIX}/conversations?limit=200${wsParam}`, { credentials: 'include' });
      const data = await res.json();
      const existingConversation = data.conversations?.find((c: Conversation) => {
        const cp = c.user_phone || '';
        return cp === phone || cp.endsWith(phone) || (!!cp && phone.endsWith(cp));
      });
      if (existingConversation) {
        setSelectedConversation(existingConversation);
        toast.success('Opened existing conversation');
      } else {
        setSelectedConversation({
          id: 0,
          account_id: account?.id || 0,
          user_phone: phone,
          status: 'open',
          unread_count: 0,
          last_message_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as Conversation);
        toast.success(`Ready to message ${phone}.`);
      }
      setShowNewChat(false);
      setNewChatPhone('');
    } catch (err) {
      toast.error('Failed to start new chat');
    } finally {
      setCreatingChat(false);
    }
  };

  // Promote the selected conversation into the CRM as a lead. Only enabled
  // for real (persisted) conversations — see the button's guard below.
  const handleAddToCrm = async () => {
    if (!selectedConversation?.id) return;
    setAddingToCrm(true);
    try {
      await crmApi.addLeadFromConversation(String(selectedConversation.id));
      toast.success('Added to CRM');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add to CRM');
    } finally {
      setAddingToCrm(false);
    }
  };

  if (!workspaceId) {
    return <InboxLoadingScreen />;
  }

  const showConnectionWarning = !connectionLoading && !account;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-background via-background to-primary/5 pb-[env(safe-area-inset-bottom)]">
      <div className="sticky top-0 z-30 border-b bg-gradient-to-r from-background via-background to-primary/5 px-3 py-3 sm:px-4 sm:py-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 sm:p-2 rounded-xl bg-white border border-primary/20 shadow-lg">
              <img src={logo} alt="Sociovia" className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                {account?.verified_name ? <><span className="text-green-600">{account.verified_name}'s</span> Inbox</> : 'WhatsApp Inbox'}
              </h1>
              <p className="text-sm text-muted-foreground hidden sm:block">View conversations and messages. Real-time updates active.</p>
              {connectionLoading && !account && (
                <p className="text-xs text-muted-foreground">Loading account info…</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="default" className="gap-2 h-11" onClick={() => setShowNewChat(true)}><Plus className="w-4 h-4" /> New Chat</Button>
            <Button
              variant={inboxFilter === 'human_required' ? 'secondary' : 'outline'}
              className="gap-2 h-11"
              onClick={() => setInboxFilter(inboxFilter === 'human_required' ? 'all' : 'human_required')}
            >
              Human Required
            </Button>
            {selectedConversation?.lead_id && (
              // Deep-link to the linked CRM lead. Inbox lives under the agent/dashboard
              // layout, so route relative to basePath. Backend now sets
              // whatsapp_conversations.lead_id; only shown when the field is present.
              <Button
                variant="outline"
                className="gap-2 h-11"
                onClick={() =>
                  navigate(`${basePath}/crm/leads?lead=${encodeURIComponent(String(selectedConversation.lead_id))}`)
                }
                title="View linked CRM lead"
              >
                <ExternalLink className="w-4 h-4" /> View lead
              </Button>
            )}
            {selectedConversation && selectedConversation.id > 0 && (
              <Button
                variant="outline"
                className="gap-2 h-11 hover:bg-primary/10"
                onClick={handleAddToCrm}
                disabled={addingToCrm}
                title="Add this conversation to CRM"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">{addingToCrm ? 'Adding...' : 'Add to CRM'}</span>
              </Button>
            )}
            {selectedConversation && isDesktop && (
              <Button variant={flowPanelOpen ? "secondary" : "outline"} size="icon" onClick={() => setFlowPanelOpen(!flowPanelOpen)} title="Flow responses">
                <Workflow className="w-4 h-4" />
              </Button>
            )}
            {selectedConversation && isDesktop && (
              <Button variant={contactPanelOpen ? "secondary" : "outline"} size="icon" onClick={() => setContactPanelOpen(!contactPanelOpen)}>
                <PanelRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {showConnectionWarning && (
        <div className="px-3 sm:px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-900 flex items-center justify-between gap-3">
          <span>Could not verify WhatsApp connection yet. Your conversations are still loading.</span>
          <Button variant="outline" size="sm" onClick={() => navigate(`${basePath}/whatsapp/setup`)}>Connect</Button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className={[
          'border-r bg-gradient-to-b from-background to-muted/20 overflow-hidden shadow-inner',
          isMobile
            ? (mobileView === 'list' ? 'w-full' : 'hidden')
            : 'w-[38%] min-w-[280px] max-w-[420px] lg:w-[30%]'
        ].join(' ')}>
          <ConversationList
            selectedConversationId={selectedConversation?.id || null}
            onSelectConversation={handleSelectConversation}
            initialFilter={inboxFilter}
            autoSelectUnread={shouldAutoSelectUnread}
            forceServerUnreadLoad={shouldForceServerUnreadLoad}
          />
        </div>
        <div className={[
          'flex-1 bg-gradient-to-br from-background via-background to-muted/10 overflow-hidden',
          isMobile ? (mobileView === 'chat' ? 'w-full' : 'hidden') : ''
        ].join(' ')}>
          <ConversationThread
            conversation={selectedConversation}
            phoneNumberId={account?.phone_number_id}
            isCoexistence={Boolean(account?.is_coexistence)}
            onBack={handleBackToList}
            showBackButton={isMobile && mobileView === 'chat'}
            onOpenContactInfo={() => setContactPanelOpen(true)}
          />
        </div>
        <ContactInfoPanel conversation={selectedConversation} isOpen={contactPanelOpen} onClose={() => setContactPanelOpen(false)} accountId={account?.id} />
        <FlowResponsesPanel conversation={selectedConversation} isOpen={flowPanelOpen} onClose={() => setFlowPanelOpen(false)} />
      </div>

      <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start New Conversation</DialogTitle>
            <DialogDescription>Enter a phone number to start a new WhatsApp conversation.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Input placeholder="Phone number (e.g., 919876543210)" value={newChatPhone} onChange={(e) => setNewChatPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleStartNewChat()} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowNewChat(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleStartNewChat} disabled={creatingChat || !newChatPhone}>{creatingChat ? 'Starting...' : 'Start Chat'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>

      {isLocked && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-background/30 transition-all animate-in fade-in duration-500">
          <div className="max-w-md w-full bg-white shadow-2xl rounded-2xl border border-primary/20 overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-8 text-center relative">
              <div className="absolute top-4 right-4">
                <Shield className="w-5 h-5 text-primary/30" />
              </div>
              <div className="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-4 border border-primary/10">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Workspace Locked</h2>
              <p className="text-sm text-muted-foreground">
                This workspace requires a password to access conversations.
              </p>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Access Password</label>
                <div className="relative">
                  <Input
                    type="password"
                    placeholder="Enter password..."
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                    className="pr-10"
                    autoFocus
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {passwordInput === 'prabhu@1charan' ? (
                      <Unlock className="w-4 h-4 text-green-500" />
                    ) : (
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </div>

              <Button onClick={handleUnlock} className="w-full gap-2 h-11 text-lg font-semibold">
                Unlock Workspace
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
