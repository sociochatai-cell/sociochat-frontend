/**
 * Meta Embedded Signup session logging (Tech Provider onboarding).
 * Captures WABA / phone / business IDs from WA_EMBEDDED_SIGNUP postMessage events.
 */

import { WHATSAPP_REST_API_PREFIX } from '@/config';
import { ownerAuthHeaders } from '@/lib/authToken';

export interface EmbeddedSignupAssets {
  business_id?: string;
  waba_id?: string;
  phone_number_id?: string;
  event?: string;
}

export interface TechProviderNextStep {
  id: string;
  title: string;
  description: string;
  url?: string;
  help_url?: string;
}

export interface ConnectExchangeResponse {
  success: boolean;
  error?: string;
  error_code?: string;
  requires_user_choice?: boolean;
  account?: {
    id?: number;
    display_phone_number?: string;
    verified_name?: string;
  };
  next_steps?: TechProviderNextStep[];
  provisioning?: Record<string, unknown>;
}

export function isFacebookOrigin(origin: string): boolean {
  return typeof origin === 'string' && origin.endsWith('facebook.com');
}

export function isCoexistenceFinishEvent(eventName?: string): boolean {
  return eventName === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING';
}

export interface FBLoginAuthResponse {
  code?: string;
  accessToken?: string;
  signedRequest?: string;
}

/**
 * Embedded Signup authorization code from FB.login.
 * Meta often puts the code only inside signedRequest when the user is already logged in.
 */
export function hasEmbeddedSignupAssets(assets: EmbeddedSignupAssets): boolean {
  return Boolean((assets.waba_id || '').trim() && (assets.phone_number_id || '').trim());
}

/** Wait for WA_EMBEDDED_SIGNUP postMessage assets after FB.login (Meta may send them slightly later). */
export function waitForEmbeddedSignupAssets(
  getAssets: () => EmbeddedSignupAssets,
  timeoutMs = 30000,
  intervalMs = 400,
): Promise<EmbeddedSignupAssets> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const current = getAssets();
      if (hasEmbeddedSignupAssets(current) || Date.now() - start >= timeoutMs) {
        resolve(current);
        return;
      }
      window.setTimeout(tick, intervalMs);
    };
    tick();
  });
}

export function extractEmbeddedSignupCode(
  authResponse?: FBLoginAuthResponse | null
): string | null {
  if (!authResponse) return null;
  const direct = (authResponse.code || '').trim();
  if (direct) return direct;

  const signed = (authResponse.signedRequest || '').trim();
  if (!signed) return null;

  try {
    const payloadPart = signed.split('.')[1];
    if (!payloadPart) return null;
    const b64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = JSON.parse(atob(b64 + pad)) as { code?: string };
    const embedded = (json.code || '').trim();
    return embedded || null;
  } catch {
    return null;
  }
}

export function parseEmbeddedSignupMessage(event: MessageEvent): EmbeddedSignupAssets | null {
  if (!isFacebookOrigin(event.origin)) return null;
  try {
    const raw = event.data;
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || data.type !== 'WA_EMBEDDED_SIGNUP') return null;

    const eventName = String(data.event || '');
    if (eventName === 'CANCEL') return null;

    const payload = data.data || {};
    const assets: EmbeddedSignupAssets = { event: eventName };

    const businessId = payload.business_id || payload.business_manager_id;
    if (businessId) assets.business_id = String(businessId);
    if (payload.waba_id) assets.waba_id = String(payload.waba_id);
    if (payload.phone_number_id) assets.phone_number_id = String(payload.phone_number_id);

    if (!assets.business_id && !assets.waba_id && !assets.phone_number_id && !eventName) {
      return null;
    }
    return assets;
  } catch {
    return null;
  }
}

export function mergeEmbeddedSignupAssets(
  current: EmbeddedSignupAssets,
  incoming: EmbeddedSignupAssets
): EmbeddedSignupAssets {
  return {
    business_id: incoming.business_id || current.business_id,
    waba_id: incoming.waba_id || current.waba_id,
    phone_number_id: incoming.phone_number_id || current.phone_number_id,
    event: incoming.event || current.event,
  };
}

export function formatConnectExchangeError(data: ConnectExchangeResponse): string {
  if (data.requires_user_choice) {
    return 'Multiple WhatsApp accounts found. Choose the correct business in Meta and try again.';
  }
  if (data.error) return data.error;
  return 'Failed to connect WhatsApp account';
}

export function formatPaymentReminder(steps?: TechProviderNextStep[]): string | null {
  const payment = steps?.find((s) => s.id === 'add_payment_method');
  if (!payment) return null;
  return payment.description;
}

export interface OnboardingSessionResponse {
  success: boolean;
  session?: { id: string };
  resume_token?: string;
  error?: string;
}

export async function createOnboardingSession(
  workspaceId: string,
  userId: string | number,
  opts?: { isCoexistence?: boolean; configId?: string },
): Promise<{ sessionId?: string; resumeToken?: string }> {
  try {
    const res = await fetch(`${WHATSAPP_REST_API_PREFIX}/onboarding/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...ownerAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify({
        workspace_id: workspaceId,
        user_id: String(userId),
        onboarding_path: opts?.isCoexistence ? 'coexistence' : 'embedded',
        is_coexistence: !!opts?.isCoexistence,
        embedded_signup_version: '4',
        config_id: opts?.configId,
      }),
    });
    const data = (await res.json()) as OnboardingSessionResponse;
    if (!data.success) return {};
    return {
      sessionId: data.session?.id,
      resumeToken: data.resume_token,
    };
  } catch {
    return {};
  }
}

export async function postEmbeddedSignupEvent(
  sessionId: string,
  eventType: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    await fetch(`${WHATSAPP_REST_API_PREFIX}/onboarding/sessions/${sessionId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...ownerAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify({ event_type: eventType, payload }),
    });
  } catch {
    // non-blocking
  }
}
