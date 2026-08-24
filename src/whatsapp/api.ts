// WhatsApp Test Console API Client
// =================================
// Uses the shared apiClient but with custom Authorization header for WhatsApp token

import type {
  TextMessagePayload,
  TemplateMessagePayload,
  MediaMessagePayload,
  InteractiveMessagePayload,
  WhatsAppApiResponse,
  Conversation,
  ConversationMessage,
  ConversationFlowStateResponse,
} from './types';
import { STORAGE_KEYS } from './types';
import { WHATSAPP_API_ENDPOINT, WHATSAPP_REST_API_PREFIX } from "@/config";
import { getWorkspaceId } from './utils/workspaceContext';
import { parseWhatsAppJsonResponse } from './utils/parseApiResponse';
import { ownerAuthHeaders } from '@/lib/authToken';

const API_BASE = WHATSAPP_API_ENDPOINT;

const BASE_PATH = '/whatsapp';

/**
 * Make a request to the WhatsApp API with custom auth header
 * If accessToken is empty, uses session-based auth (cookies)
 */
async function waRequest<T>(
  path: string,
  accessToken: string,
  options: { method: string; body?: unknown }
): Promise<{ ok: boolean; status: number; data?: T; error?: unknown }> {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // SSO/shared-identity: carry the owner identity (Bearer sv_token + X-User-Id)
    // like apiClient, so WhatsApp calls authenticate even when the session cookie
    // isn't honored (incognito/mobile/SSO). The backend prefers the cookie when
    // present, so this is additive.
    ...ownerAuthHeaders(),
  };

  // An explicit WhatsApp access token (rare) overrides the owner Bearer.
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  try {
    const res = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      credentials: 'include', // Always include cookies for session auth
    });

    const contentType = res.headers.get('content-type') || '';
    let body: unknown = null;

    if (contentType.includes('application/json')) {
      body = await res.json().catch(() => null);
    } else {
      body = await res.text().catch(() => null);
    }

    if (!res.ok) {
      return { ok: false, status: res.status, error: body };
    }

    return { ok: true, status: res.status, data: body as T };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err,
    };
  }
}

/**
 * Send a text message
 */
export async function sendTextMessage(
  accessToken: string,
  payload: TextMessagePayload
): Promise<WhatsAppApiResponse> {
  const response = await waRequest<WhatsAppApiResponse>(
    `${BASE_PATH}/send/text`,
    accessToken,
    { method: 'POST', body: payload }
  );

  if (!response.ok) {
    const err = response.error as Record<string, unknown> | null;
    return {
      success: false,
      error: (err?.error as string) || (err?.message as string) || 'Failed to send text message',
      error_code: err?.error_code as string | undefined,
    };
  }

  return response.data as WhatsAppApiResponse;
}

/**
 * Send a template message
 */
export async function sendTemplateMessage(
  accessToken: string,
  payload: TemplateMessagePayload
): Promise<WhatsAppApiResponse> {
  const response = await waRequest<WhatsAppApiResponse>(
    `${BASE_PATH}/send/template`,
    accessToken,
    { method: 'POST', body: payload }
  );

  if (!response.ok) {
    const err = response.error as Record<string, unknown> | null;
    return {
      success: false,
      error: (err?.error as string) || (err?.message as string) || 'Failed to send template message',
      error_code: err?.error_code as string | undefined,
    };
  }

  return response.data as WhatsAppApiResponse;
}

/**
 * Send a template message (advanced with builder)
 */
export async function sendTemplateAdvanced(
  accessToken: string,
  payload: {
    to: string;
    template_name: string;
    language: string;
    header_image_url?: string;
    body_params?: string[];
    button_url_suffix?: string;
  }
): Promise<WhatsAppApiResponse> {
  const response = await waRequest<WhatsAppApiResponse>(
    `${BASE_PATH}/send/template/advanced`,
    accessToken,
    { method: 'POST', body: payload }
  );

  if (!response.ok) {
    const err = response.error as Record<string, unknown> | null;
    return {
      success: false,
      error: (err?.error as string) || (err?.message as string) || 'Failed to send template message',
      error_code: err?.error_code as string | undefined,
    };
  }

  return response.data as WhatsAppApiResponse;
}

/**
 * Send a media message
 */
export async function sendMediaMessage(
  accessToken: string,
  payload: MediaMessagePayload
): Promise<WhatsAppApiResponse> {
  const response = await waRequest<WhatsAppApiResponse>(
    `${BASE_PATH}/send/media`,
    accessToken,
    { method: 'POST', body: payload }
  );

  if (!response.ok) {
    const err = response.error as Record<string, unknown> | null;
    return {
      success: false,
      error: (err?.error as string) || (err?.message as string) || 'Failed to send media message',
      error_code: err?.error_code as string | undefined,
    };
  }

  return response.data as WhatsAppApiResponse;
}

/**
 * Send an interactive message
 */
export async function sendInteractiveMessage(
  accessToken: string,
  payload: InteractiveMessagePayload
): Promise<WhatsAppApiResponse> {
  const response = await waRequest<WhatsAppApiResponse>(
    `${BASE_PATH}/send/interactive`,
    accessToken,
    { method: 'POST', body: payload }
  );

  if (!response.ok) {
    const err = response.error as Record<string, unknown> | null;
    return {
      success: false,
      error: (err?.error as string) || (err?.message as string) || 'Failed to send interactive message',
      error_code: err?.error_code as string | undefined,
    };
  }

  return response.data as WhatsAppApiResponse;
}

/**
 * Get list of conversations
 * Tries to use token from localStorage, falls back to session auth
 */
export async function getConversations(
  limit = 50,
  offset = 0,
  status?: 'open' | 'closed',
  accessToken?: string,
  workspaceId?: string,
  unreadOnly = false,
  category?: string,
  search?: string,
  includeTotals = false,
): Promise<{
  conversations: Conversation[];
  count: number;
  total_count?: number;
  totals?: Record<string, number>;
}> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (status) params.append('status', status);
  if (unreadOnly) params.append('unread_only', 'true');
  if (category && category !== 'all') params.append('category', category);
  if (search?.trim()) params.append('search', search.trim());
  if (includeTotals) params.append('include_totals', 'true');

  const wsId = workspaceId || getWorkspaceId() || '';
  if (wsId) params.append('workspace_id', wsId);

  try {
    const res = await fetch(`${WHATSAPP_REST_API_PREFIX}/conversations?${params.toString()}`, {
      credentials: 'include',
    });

    if (!res.ok) {
      console.error('[getConversations] HTTP', res.status);
      return { conversations: [], count: 0 };
    }

    const data = await res.json() as {
      success: boolean;
      conversations: Conversation[];
      count: number;
      total_count?: number;
      totals?: Record<string, number>;
    };

    if (data?.success) {
      return {
        conversations: data.conversations || [],
        count: data.count || 0,
        total_count: data.total_count,
        totals: data.totals,
      };
    }
  } catch (err) {
    console.error('[getConversations] fetch failed:', err);
  }

  return { conversations: [], count: 0 };
}

/**
 * Get messages for a conversation
 * Tries to use token from localStorage, falls back to session auth
 */
export async function getConversationMessages(
  conversationId: number,
  limit = 100,
  beforeId?: number,
  accessToken?: string
): Promise<ConversationMessage[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (beforeId) params.append('before_id', String(beforeId));

  try {
    const res = await fetch(
      `${WHATSAPP_REST_API_PREFIX}/conversations/${conversationId}/messages?${params.toString()}`,
      { credentials: 'include' },
    );

    if (!res.ok) {
      console.error('[getConversationMessages] HTTP', res.status, conversationId);
      return [];
    }

    const data = await res.json() as {
      success: boolean;
      messages: ConversationMessage[];
      count: number;
    };

    if (data?.success) {
      return data.messages || [];
    }
  } catch (err) {
    console.error('[getConversationMessages] fetch failed:', err);
  }

  return [];
}

/**
 * Delete a conversation
 */
export async function deleteConversation(
  conversationId: number,
  accessToken?: string
): Promise<{ success: boolean; error?: string }> {
  const token = accessToken || localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '';

  const response = await waRequest<{ success: boolean; message?: string }>(
    `${BASE_PATH}/conversations/${conversationId}`,
    token,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    const err = response.error as Record<string, unknown> | null;
    return {
      success: false,
      error: (err?.error as string) || (err?.message as string) || 'Failed to delete conversation',
    };
  }

  return { success: true };
}



/**
 * Upload media file for chat (images, videos, documents)
 * Returns public URL that can be used with sendMediaMessageFromInbox
 */
export async function uploadChatMedia(
  file: File
): Promise<{
  success: boolean;
  public_url?: string;
  media_type?: 'image' | 'video' | 'document';
  filename?: string;
  size?: number;
  mime_type?: string;
  error?: string;
}> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch(`${WHATSAPP_REST_API_PREFIX}/media/upload/public`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const parsed = await parseWhatsAppJsonResponse(res, 'Failed to upload media');
    if (parsed.ok && parsed.data) {
      return parsed.data as {
        success: boolean;
        public_url?: string;
        media_type?: 'image' | 'video' | 'document';
        filename?: string;
        size?: number;
        mime_type?: string;
        error?: string;
        message?: string;
      };
    }
    return {
      success: false,
      error: parsed.errorMessage,
    };
  } catch (error) {
    console.error('Error uploading media:', error);
    return {
      success: false,
      error: 'Network error while uploading. Check your connection and try again.',
    };
  }
}

/**
 * Send media message from inbox (image, video, document)
 * Requires media to be uploaded first via uploadChatMedia
 */
export async function sendMediaMessageFromInbox(
  to: string,
  mediaType: 'image' | 'video' | 'document',
  mediaUrl: string,
  caption?: string,
  filename?: string,
  phoneNumberId?: string
): Promise<WhatsAppApiResponse> {
  // Try to get token from localStorage if not provided
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '';

  const response = await waRequest<WhatsAppApiResponse>(
    `${BASE_PATH}/send/media`,
    token,
    {
      method: 'POST',
      body: {
        to,
        media_type: mediaType,
        media_url: mediaUrl,
        caption,
        filename,
        phone_number_id: phoneNumberId
      }
    }
  );

  if (!response.ok) {
    const err = response.error as Record<string, unknown> | null;
    return {
      success: false,
      error: (err?.error as string) || (err?.message as string) || 'Failed to send media message',
      error_code: err?.error_code as string | undefined,
    };
  }

  return response.data as WhatsAppApiResponse;
}


/**
 * Send text message from inbox
 * Tries to use token from localStorage, falls back to session auth
 */
export async function sendTextMessageFromInbox(
  to: string,
  text: string,
  previewUrl = false,
  accessToken?: string,
  phoneNumberId?: string
): Promise<WhatsAppApiResponse> {
  // Try to get token from localStorage if not provided
  const token = accessToken || localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '';

  const response = await waRequest<WhatsAppApiResponse>(
    `${BASE_PATH}/send/text`,
    token,
    {
      method: 'POST',
      body: {
        to,
        text,
        preview_url: previewUrl,
        phone_number_id: phoneNumberId
      }
    }
  );

  if (!response.ok) {
    const err = response.error as Record<string, unknown> | null;
    return {
      success: false,
      error: (err?.error as string) || (err?.message as string) || 'Failed to send text message',
      error_code: err?.error_code as string | undefined,
    };
  }

  return response.data as WhatsAppApiResponse;
}

/**
 * Send sticker message from inbox
 * Uses media_id of a previously received/favorited sticker
 */
export async function sendStickerFromInbox(
  to: string,
  mediaId: string,
  accessToken?: string,
  phoneNumberId?: string
): Promise<WhatsAppApiResponse> {
  // Try to get token from localStorage if not provided
  const token = accessToken || localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '';

  const response = await waRequest<WhatsAppApiResponse>(
    `${BASE_PATH}/send/sticker`,
    token,
    {
      method: 'POST',
      body: {
        to,
        media_id: mediaId,
        phone_number_id: phoneNumberId
      }
    }
  );

  if (!response.ok) {
    const err = response.error as Record<string, unknown> | null;
    return {
      success: false,
      error: (err?.error as string) || (err?.message as string) || 'Failed to send sticker',
      error_code: err?.error_code as string | undefined,
    };
  }

  return response.data as WhatsAppApiResponse;
}

/**
 * Get favorite stickers for a workspace
 */
export async function getFavoriteStickers(
  workspaceId: string
): Promise<{ success: boolean; stickers: FavoriteSticker[] }> {
  const response = await fetch(
    `${WHATSAPP_REST_API_PREFIX}/stickers/favorite?workspace_id=${workspaceId}`,
    {
      method: 'GET',
      credentials: 'include'
    }
  );

  if (!response.ok) {
    return { success: false, stickers: [] };
  }

  const data = await response.json();
  return { success: true, stickers: Array.isArray(data) ? data : [] };
}

/**
 * Delete a favorite sticker
 */
export async function deleteFavoriteSticker(
  stickerId: number,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(
    `${WHATSAPP_REST_API_PREFIX}/stickers/favorite/${stickerId}?workspace_id=${workspaceId}`,
    {
      method: 'DELETE',
      credentials: 'include'
    }
  );

  if (!response.ok) {
    return { success: false, error: 'Failed to delete sticker' };
  }

  return { success: true };
}

// Type for favorite sticker
export interface FavoriteSticker {
  id: number;
  workspace_id: string;
  media_id: string;
  mime_type?: string;
  sha256?: string;
  created_at: string;
}

/**
 * Health check for WhatsApp API
 */
export async function healthCheck(accessToken: string): Promise<{ status: string; phone_number_id?: string }> {
  const response = await waRequest<{ status: string; phone_number_id?: string }>(
    `${BASE_PATH}/health`,
    accessToken,
    { method: 'GET' }
  );

  if (!response.ok) {
    return { status: 'error' };
  }

  return response.data || { status: 'unknown' };
}

// ============================================================
// Phase-2 Part-1: WhatsApp Business Account Integration
// ============================================================

/**
 * Start Meta OAuth flow for WhatsApp Business Account
 */
export async function startWhatsAppConnection(
  workspaceId: string
): Promise<{ success: boolean; auth_url?: string; state?: string; error?: string }> {
  const response = await waRequest<{ success: boolean; auth_url?: string; state?: string; error?: string }>(
    `${BASE_PATH}/connect/start?workspace_id=${workspaceId}`,
    '', // Session-based auth
    { method: 'GET' }
  );

  if (!response.ok) {
    const err = response.error as Record<string, unknown> | null;
    return {
      success: false,
      error: (err?.error as string) || (err?.message as string) || 'Failed to start connection',
    };
  }

  return response.data || { success: false, error: 'Unknown error' };
}

/**
 * Get connected WhatsApp accounts for workspace
 */
export async function getWhatsAppAccounts(
  workspaceId?: string
): Promise<{ success: boolean; accounts: any[]; count: number }> {
  const params = workspaceId ? `?workspace_id=${workspaceId}` : '';

  const response = await waRequest<{ success: boolean; accounts: any[]; count: number }>(
    `${BASE_PATH}/accounts${params}`,
    '', // Session-based auth
    { method: 'GET' }
  );

  if (!response.ok) {
    return { success: false, accounts: [], count: 0 };
  }

  return response.data || { success: false, accounts: [], count: 0 };
}

// ============================================================
// Phase-7: Trust, Verification, and Operational Health
// ============================================================

export async function getVerificationStatus(accountId: number, workspaceId?: string) {
  const params = workspaceId ? `?workspace_id=${workspaceId}` : '';
  const response = await waRequest<any>(
    `${BASE_PATH}/accounts/${accountId}/verification-status${params}`,
    '',
    { method: 'GET' }
  );
  return response.ok ? response.data : null;
}

export async function getOperationalTimeline(accountId: number, workspaceId?: string) {
  const params = workspaceId ? `?workspace_id=${workspaceId}` : '';
  const response = await waRequest<any>(
    `${BASE_PATH}/accounts/${accountId}/operational-timeline${params}`,
    '',
    { method: 'GET' }
  );
  return response.ok ? response.data : null;
}

export async function retryWebhook(accountId: number, workspaceId?: string, operatorSecret?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (operatorSecret) {
    headers['Authorization'] = `Bearer ${operatorSecret}`;
    headers['X-Operator-Secret'] = operatorSecret;
  }

  try {
    const res = await fetch(`${WHATSAPP_REST_API_PREFIX}/accounts/${accountId}/webhook/retry`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        workspace_id: workspaceId,
        operator_secret: operatorSecret || undefined,
      }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}

export async function refreshWebhook(accountId: number, workspaceId?: string) {
  const response = await waRequest<any>(
    `${BASE_PATH}/accounts/${accountId}/webhook/refresh`,
    '',
    { method: 'POST', body: { workspace_id: workspaceId } }
  );
  return response.ok ? response.data : null;
}

export async function exportDiagnostics(accountId: number, workspaceId?: string) {
  const params = workspaceId ? `?workspace_id=${workspaceId}` : '';
  const response = await waRequest<any>(
    `${BASE_PATH}/accounts/${accountId}/diagnostics/export${params}`,
    '',
    { method: 'GET' }
  );
  return response.ok ? response.data : null;
}

export async function toggleSafeModeOverride(accountId: number, advisoryOnly: boolean, operatorSecret: string, workspaceId?: string, ttlHours?: number) {
  const wsId = workspaceId || '';

  try {
    const res = await fetch(`${WHATSAPP_REST_API_PREFIX}/accounts/${accountId}/safe-mode-override`, {
      method: 'POST',
      headers: {
        'Authorization': operatorSecret ? `Bearer ${operatorSecret}` : '',
        'X-Operator-Secret': operatorSecret || '',
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        workspace_id: wsId,
        advisory_only: advisoryOnly,
        ttl_hours: ttlHours,
        operator_secret: operatorSecret || undefined,
      }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}

export async function getOperationalMetrics(accountId: number, workspaceId?: string) {
  const params = workspaceId ? `?workspace_id=${workspaceId}` : '';
  const response = await waRequest<any>(
    `${BASE_PATH}/accounts/${accountId}/operational-metrics${params}`,
    '',
    { method: 'GET' }
  );
  return response.ok ? response.data : null;
}

// ============================================================
// Interactive Automations: in-flight conversation flow state
// ============================================================

/**
 * Fetch the live interactive-automation flow state for a conversation.
 * Reflects in-flight progress (current node, waiting-for-input, captured
 * responses), so this is deliberately NOT persistent-cached — it uses raw
 * fetch so every call hits the server.
 */
export async function getConversationFlowState(
  conversationId: number,
): Promise<ConversationFlowStateResponse | null> {
  try {
    const res = await fetch(
      `${WHATSAPP_REST_API_PREFIX}/interactive-automations/conversation-state?conversation_id=${conversationId}&workspace_id=${getWorkspaceId()}&include_completed=1`,
      { credentials: 'include' },
    );

    if (!res.ok) {
      console.error('[getConversationFlowState] HTTP', res.status, conversationId);
      return null;
    }

    return await res.json() as ConversationFlowStateResponse;
  } catch (err) {
    console.error('[getConversationFlowState] fetch failed:', err);
    return null;
  }
}
