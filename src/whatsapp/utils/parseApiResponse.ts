/**
 * Parse WhatsApp API responses safely (handles HTML 500 pages from proxies).
 */

export const META_SEND_PERMISSION_REMEDIATION =
  'Meta blocked this send: your access token does not have permission to send messages for this WhatsApp Business Account. This is not caused by the template image — the upload worked. Reconnect Trusthomes using a System User token (WhatsApp → Settings → Manual Link / System User), and ensure Trusthomes Business Manager grants Sociovia partner permission to send on behalf of the WABA.';

export function isMetaSendPermissionError(data: Record<string, unknown> | null): boolean {
  if (!data) return false;
  const code = data.error_code;
  if (code === 200 || code === '200') return true;
  const category = data.error_category;
  if (category === 'messaging_permission_denied') return true;
  const err = String(data.error ?? '');
  return (
    err.includes('#200') ||
    err.toLowerCase().includes('necessary permissions') ||
    err.toLowerCase().includes('oauthexception')
  );
}

const UPLOAD_ERROR_MESSAGES: Record<string, string> = {
  storage_not_configured:
    'Media storage is not configured on the server. Paste a public HTTPS URL for the header instead of uploading.',
  upload_failed: 'Failed to upload the file to storage. Try again or paste a public HTTPS URL.',
  no_file_provided: 'No file was selected.',
  empty_file: 'The selected file is empty.',
  invalid_file_type: 'This file type is not supported for WhatsApp.',
  file_too_large: 'File exceeds WhatsApp size limits for this media type.',
  internal_server_error: 'Server error while uploading. Try again or use a public URL.',
};

export function humanizeWhatsAppApiError(
  data: Record<string, unknown> | null,
  status: number,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (!data) {
    if (status >= 500) {
      return 'Server error — the upload service may be restarting. Try pasting a public HTTPS URL, or retry in a moment.';
    }
    if (status === 401 || status === 403) {
      return 'You are not authorized. Refresh the page and sign in again.';
    }
    return fallback;
  }

  if (isMetaSendPermissionError(data)) {
    const remediation = data.remediation;
    if (typeof remediation === 'string' && remediation.trim()) {
      return remediation;
    }
    return META_SEND_PERMISSION_REMEDIATION;
  }

  const remediation = data.remediation;
  if (typeof remediation === 'string' && remediation.trim()) {
    return remediation;
  }

  const message = data.message;
  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  const err = data.error;
  if (typeof err === 'string' && UPLOAD_ERROR_MESSAGES[err]) {
    return UPLOAD_ERROR_MESSAGES[err];
  }

  const details = data.details;
  if (typeof details === 'string' && details.trim()) {
    return details;
  }

  if (typeof err === 'string' && err.trim()) {
    return err;
  }

  const nested = data.error as Record<string, unknown> | undefined;
  if (nested && typeof nested.message === 'string') {
    return nested.message;
  }

  if (status >= 500) {
    return 'Server error. Please try again or use a public HTTPS URL.';
  }

  return fallback;
}

export async function parseWhatsAppJsonResponse(
  response: Response,
  fallbackError = 'Request failed'
): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown> | null;
  errorMessage: string;
}> {
  const status = response.status;
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const text = await response.text().catch(() => '');
    const snippet = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    const errorMessage = humanizeWhatsAppApiError(
      null,
      status,
      status >= 500
        ? 'Server error — media upload is unavailable. Paste a public HTTPS URL instead.'
        : snippet || `${fallbackError} (${status})`
    );
    return { ok: false, status, data: null, errorMessage };
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      status,
      data: null,
      errorMessage: 'Invalid response from server. Please try again.',
    };
  }

  const ok = response.ok && data.success !== false;
  const errorMessage = humanizeWhatsAppApiError(data, status, fallbackError);

  return { ok, status, data, errorMessage };
}
