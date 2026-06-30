import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import config, { WHATSAPP_REST_API_PREFIX } from '@/config';
import { getWorkspaceId, setWorkspaceId } from '@/whatsapp/utils/workspaceContext';
import type { WhatsAppAccountStatusPayload } from '@/components/WhatsAppAccountStatusPopup';

const API_BASE = config.API_BASE_URL;

/**
 * Resolves the active workspace ID.
 * Looks in preferred parameter, workspace context, and falls back to API call.
 */
export async function resolveWorkspaceId(preferred?: string | null): Promise<string | null> {
  if (preferred) return preferred;

  const stored = getWorkspaceId();
  if (stored) return stored;

  try {
    const userRaw = localStorage.getItem('sv_user') || sessionStorage.getItem('sv_user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    if (!user?.id) return null;

    const res = await fetchWithTimeout(
      `${API_BASE}/api/workspaces?user_id=${encodeURIComponent(String(user.id))}`,
      { credentials: 'include' },
      20_000,
    );
    if (!res.ok) return null;

    const data = await res.json();
    const rawList = data.workspaces ?? data.workspace ?? [];
    const list = Array.isArray(rawList) ? rawList : rawList ? [rawList] : [];
    const first = list[0];
    const id = first?.id ?? first?.workspace_id;
    if (id != null) {
      setWorkspaceId(String(id));
      return String(id);
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Fetches connection path status, health checks, and post-connection checks.
 * Combines and caches the payload in localStorage for persistent viewing.
 */
export async function fetchAccountStatusPayload(workspaceId: string): Promise<WhatsAppAccountStatusPayload> {
  const connRes = await fetchWithTimeout(
    `${WHATSAPP_REST_API_PREFIX}/connection-path?workspace_id=${encodeURIComponent(workspaceId)}`,
    { credentials: 'include' },
    45_000,
  );

  if (!connRes.ok) {
    return { connectionStatus: 'ERROR', connectionReason: 'Failed to check WhatsApp connection.' };
  }

  const conn = await connRes.json();
  const summary = conn.account_summary || {};
  const payload: WhatsAppAccountStatusPayload = {
    connectionStatus: conn.status || 'NOT_CONFIGURED',
    connectionReason: conn.reason,
    accountName: summary.verified_name || summary.custom_name,
    accountPhone: summary.phone_number || summary.display_phone_number,
    wabaId: summary.waba_id,
  };

  const accountId = summary.id;
  if (!accountId) {
    saveToLocalStorage(payload);
    return payload;
  }

  // Fetch full health checks
  try {
    const healthRes = await fetchWithTimeout(
      `${WHATSAPP_REST_API_PREFIX}/accounts/${accountId}/full-health-check`,
      { credentials: 'include' },
      60_000,
    );
    if (healthRes.ok) {
      const health = await healthRes.json();
      payload.overallHealth = health.overall_status;
      payload.actionRequired = health.action_required;
      payload.checks = (health.checks || []).map(
        (check: {
          name: string;
          status: string;
          message: string;
          details?: Record<string, unknown>;
          fixed?: boolean;
        }) => ({
          name: check.name,
          status: check.status,
          message: check.message,
          details: check.details,
          fixed: check.fixed,
        })
      );
      if (health.verified_name && !payload.accountName) {
        payload.accountName = health.verified_name;
      }
      if (health.display_phone_number && !payload.accountPhone) {
        payload.accountPhone = health.display_phone_number;
      }
    }
  } catch {
    // connection-path alone is still useful
  }

  // Run post-connection provisioning check (auto-fix + capability matrix)
  try {
    const fixRes = await fetchWithTimeout(
      `${WHATSAPP_REST_API_PREFIX}/post-connection-check`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ workspace_id: workspaceId }),
      },
      120_000,
    );
    if (fixRes.ok) {
      const fix = await fixRes.json();
      payload.readinessScore = fix.readiness_score;
      payload.capabilityMatrix = fix.capability_matrix;
      payload.warmupState = fix.warmup_state;
      payload.provisioningState = fix.provisioning_state;
      payload.operationalLifecycle = fix.operational_lifecycle;
      if (fix.action_required) {
        payload.actionRequired = fix.action_required;
      }
      if (fix.operational_profile) {
        const op = fix.operational_profile;
        if (op.hints?.length && payload.checks) {
          const sendIdx = payload.checks.findIndex(
            (c) => c.name === 'messaging_send_permission' || c.name === 'send_permission'
          );
          if (sendIdx >= 0) {
            payload.checks[sendIdx] = {
              ...payload.checks[sendIdx],
              details: { ...(payload.checks[sendIdx].details || {}), hints: op.hints },
            };
          }
        }
      }
      // Merge provisioning checks with health checks
      if (fix.checks && Array.isArray(fix.checks)) {
        const existingNames = new Set((payload.checks || []).map((c: any) => c.name));
        const newChecks = fix.checks
          .filter((c: any) => !existingNames.has(c.name))
          .map((c: any) => ({ name: c.name, status: c.status, message: c.message, fixed: c.fixed }));
        payload.checks = [...(payload.checks || []), ...newChecks];
      }
    }
  } catch {
    // provisioning check is supplementary
  }

  saveToLocalStorage(payload);
  return payload;
}

/**
 * Saves status payload to localStorage.
 */
function saveToLocalStorage(payload: WhatsAppAccountStatusPayload) {
  try {
    localStorage.setItem('sv_whatsapp_status_payload', JSON.stringify(payload));
    localStorage.setItem('sv_whatsapp_status_timestamp', new Date().toISOString());
  } catch (e) {
    console.warn('Failed to save whatsapp status payload to localStorage:', e);
  }
}
