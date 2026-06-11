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
} from './types';
import { STORAGE_KEYS } from './types';
import { API_ENDPOINT } from "@/config";

const API_BASE = API_ENDPOINT;

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
  };

  // Add Authorization header only if token is provided
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
    return { ok: false, status: 0, error: err };
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
  workspaceId?: string
): Promise<{ conversations: Conversation[]; count: number }> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (status) params.append('status', status);

  // Add workspace_id if provided, or try to get from storage
  const wsId = workspaceId || localStorage.getItem('sv_whatsapp_workspace_id') || sessionStorage.getItem('sv_whatsapp_workspace_id') || '';
  if (wsId) params.append('workspace_id', wsId);

  // Try to get token from localStorage if not provided
  const token = accessToken || localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '';

  const response = await waRequest<{ success: boolean; conversations: Conversation[]; count: number }>(
    `${BASE_PATH}/conversations?${params.toString()}`,
    token,
    { method: 'GET' }
  );

  if (!response.ok) {
    return { conversations: [], count: 0 };
  }

  const data = response.data;
  if (data?.success) {
    return { conversations: data.conversations || [], count: data.count || 0 };
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
  // Try to get token from localStorage if not provided
  const token = accessToken || localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '';

  const params = new URLSearchParams({ limit: String(limit) });
  if (beforeId) params.append('before_id', String(beforeId));

  const response = await waRequest<{ success: boolean; messages: ConversationMessage[]; count: number }>(
    `${BASE_PATH}/conversations/${conversationId}/messages?${params.toString()}`,
    token,
    { method: 'GET' }
  );

  if (!response.ok) {
    return [];
  }

  const data = response.data;
  if (data?.success) {
    return data.messages || [];
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
    const res = await fetch(`${API_BASE}${BASE_PATH}/media/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    const data = await res.json();
    if (data.success && !data.public_url && data.url) {
      data.public_url = data.url;
    }
    if (!res.ok && !data.error) {
      data.success = false;
      data.error = data.message || `Upload failed (${res.status})`;
    }
    return data;
  } catch (error) {
    console.error('Error uploading media:', error);
    return {
      success: false,
      error: 'Failed to upload media',
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
// Trust, verification, and operational health
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

export async function getOperationalMetrics(accountId: number, workspaceId?: string) {
  const params = workspaceId ? `?workspace_id=${workspaceId}` : '';
  const response = await waRequest<any>(
    `${BASE_PATH}/accounts/${accountId}/operational-metrics${params}`,
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
    const res = await fetch(`${API_ENDPOINT}/whatsapp/accounts/${accountId}/webhook/retry`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({ workspace_id: workspaceId, operator_secret: operatorSecret }),
    });
    return await res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}
