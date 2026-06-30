/**
 * Session + event helpers for showing the WhatsApp account status popup
 * after app login or WhatsApp connect flows.
 */

export const WHATSAPP_STATUS_POPUP_EVENT = 'sociovia:show-whatsapp-status';
export const WHATSAPP_STATUS_POPUP_SESSION_KEY = 'sv_show_whatsapp_status_popup';

export function requestWhatsAppAccountStatusPopup(workspaceId?: string | number): void {
  try {
    sessionStorage.setItem(
      WHATSAPP_STATUS_POPUP_SESSION_KEY,
      workspaceId != null ? String(workspaceId) : 'auto'
    );
  } catch {
    // ignore storage failures
  }
  window.dispatchEvent(
    new CustomEvent(WHATSAPP_STATUS_POPUP_EVENT, {
      detail: { workspaceId: workspaceId != null ? String(workspaceId) : undefined },
    })
  );
}

export function peekWhatsAppStatusPopupRequest(): string | null {
  try {
    const value = sessionStorage.getItem(WHATSAPP_STATUS_POPUP_SESSION_KEY);
    if (!value) return null;
    return value === 'auto' ? null : value;
  } catch {
    return null;
  }
}

export function consumeWhatsAppStatusPopupRequest(): string | null {
  const value = peekWhatsAppStatusPopupRequest();
  try {
    sessionStorage.removeItem(WHATSAPP_STATUS_POPUP_SESSION_KEY);
  } catch {
    // ignore
  }
  return value;
}

export function hasWhatsAppStatusPopupRequest(): boolean {
  try {
    return sessionStorage.getItem(WHATSAPP_STATUS_POPUP_SESSION_KEY) != null;
  } catch {
    return false;
  }
}
