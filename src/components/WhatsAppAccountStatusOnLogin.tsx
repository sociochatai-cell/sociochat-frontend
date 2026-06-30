import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import WhatsAppAccountStatusPopup, {
  WhatsAppAccountStatusPayload,
} from '@/components/WhatsAppAccountStatusPopup';
import config, { WHATSAPP_REST_API_PREFIX } from '@/config';
import { useAuth } from '@/contexts/AuthContext';
import { getAgentToken } from '@/agent_frontend/lib/agentApi';
import { getWorkspaceId, setWorkspaceId } from '@/whatsapp/utils/workspaceContext';
import {
  WHATSAPP_STATUS_POPUP_EVENT,
  consumeWhatsAppStatusPopupRequest,
  hasWhatsAppStatusPopupRequest,
} from '@/whatsapp/utils/accountStatusPopup';
import { resolveWorkspaceId, fetchAccountStatusPayload } from '@/whatsapp/utils/accountStatusFetcher';

const POPUP_DURATION_MS = 20000;

/** Popup only on WhatsApp product routes — not the whole dashboard. */
function isWhatsAppProductRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard/whatsapp') ||
    pathname.startsWith('/agent/whatsapp')
  );
}


export default function WhatsAppAccountStatusOnLogin() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusData, setStatusData] = useState<WhatsAppAccountStatusPayload | null>(null);
  const shownAfterLoginRef = useRef(false);
  const pendingRef = useRef(false);

  const isAuthenticated = !!user || !!getAgentToken();

  const openStatusPopup = useCallback(async (workspaceHint?: string | null) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsOpen(true);
    setLoadingStatus(true);
    setStatusData(null);

    try {
      const workspaceId = await resolveWorkspaceId(workspaceHint);
      if (!workspaceId) {
        setStatusData({
          connectionStatus: 'NOT_CONFIGURED',
          connectionReason: 'No workspace selected yet.',
        });
        return;
      }

      const payload = await fetchAccountStatusPayload(workspaceId);
      setStatusData(payload);
    } catch {
      setStatusData({
        connectionStatus: 'ERROR',
        connectionReason: 'Unable to load WhatsApp account status.',
      });
    } finally {
      setLoadingStatus(false);
      pendingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || loading || !isWhatsAppProductRoute(location.pathname)) return;

    const handleEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ workspaceId?: string }>).detail;
      void openStatusPopup(detail?.workspaceId ?? null);
    };

    window.addEventListener(WHATSAPP_STATUS_POPUP_EVENT, handleEvent);
    return () => window.removeEventListener(WHATSAPP_STATUS_POPUP_EVENT, handleEvent);
  }, [isAuthenticated, loading, location.pathname, openStatusPopup]);

  useEffect(() => {
    if (!isAuthenticated || loading || !isWhatsAppProductRoute(location.pathname)) return;
    if (shownAfterLoginRef.current) return;
    if (!hasWhatsAppStatusPopupRequest()) return;

    const workspaceHint = consumeWhatsAppStatusPopupRequest();
    shownAfterLoginRef.current = true;
    void openStatusPopup(workspaceHint);
  }, [isAuthenticated, loading, location.pathname, openStatusPopup]);

  // Third trigger: ?wa_connected=1 URL param (most reliable — survives full page reloads)
  useEffect(() => {
    if (!isAuthenticated || loading || !isWhatsAppProductRoute(location.pathname)) return;
    const params = new URLSearchParams(location.search);
    if (!params.has('wa_connected')) return;

    const wsHint = params.get('wa_workspace') || null;
    // Clean URL params
    params.delete('wa_connected');
    params.delete('wa_workspace');
    const clean = params.toString();
    navigate(location.pathname + (clean ? `?${clean}` : ''), { replace: true });
    void openStatusPopup(wsHint);
  }, [isAuthenticated, loading, location.pathname, location.search, navigate, openStatusPopup]);

  return (
    <WhatsAppAccountStatusPopup
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      data={statusData}
      loading={loadingStatus}
      durationMs={POPUP_DURATION_MS}
      onOpenSettings={() => {
        setIsOpen(false);
        navigate(
          location.pathname.startsWith('/agent')
            ? '/agent/whatsapp/settings'
            : '/dashboard/whatsapp/settings'
        );
      }}
      onOpenSetup={() => {
        setIsOpen(false);
        const base = location.pathname.startsWith('/agent') ? '/agent' : '/dashboard';
        navigate(`${base}/whatsapp/setup?manual=1`);
      }}
    />
  );
}
