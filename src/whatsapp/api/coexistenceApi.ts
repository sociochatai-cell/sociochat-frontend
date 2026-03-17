// Coexistence API Client
// ======================
// API functions for WhatsApp Coexistence mode (connecting existing WABA)

import { API_BASE_URL } from '@/config';

const API = `${API_BASE_URL}/api/whatsapp/coexistence`;

async function coexReq<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok && !data.success) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }
  return data;
}

// ── Connect ──
export async function connectCoexistence(params: {
  code: string;
  workspace_id: string;
  phone_number_id?: string;
  waba_id?: string;
}) {
  return coexReq<{
    success: boolean;
    account_id: number;
    phone_number_id: string;
    waba_id: string;
    verified_name: string;
    mps_limit: number;
  }>('/connect', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// ── Dashboard ──
export async function getCoexistenceDashboard(accountId: number) {
  return coexReq<{
    success: boolean;
    dashboard: {
      device_status: DeviceStatus;
      rate_limit: RateLimitStatus;
      stats_7d: {
        incoming: number;
        outgoing: number;
        echo: number;
        failed: number;
      };
      total_contacts: number;
      history_sync: HistorySyncStatus;
    };
  }>(`/dashboard/${accountId}`);
}

// ── Status ──
export async function getCoexistenceStatus(accountId: number) {
  return coexReq<{
    success: boolean;
    account_id: number;
    is_coexistence: boolean;
    device: DeviceStatus;
    rate_limit: RateLimitStatus;
    history_sync: HistorySyncStatus;
    message_counts: {
      total: number;
      incoming: number;
      outgoing: number;
      echo: number;
    };
  }>(`/status/${accountId}`);
}

// ── Device Status ──
export async function getDeviceStatus(accountId: number) {
  return coexReq<{
    success: boolean;
    device_status: DeviceStatus;
  }>(`/device/${accountId}`);
}

export async function checkAllDevices() {
  return coexReq<{
    success: boolean;
    checked: number;
    inactive_alerts: number;
  }>('/device/check-all');
}

// ── Rate Limit ──
export async function getRateLimitStatus(accountId: number) {
  return coexReq<{
    success: boolean;
    rate_limit: RateLimitStatus;
  }>(`/rate-limit/${accountId}`);
}

// ── History Sync ──
export async function getHistorySyncStatus(accountId: number) {
  return coexReq<{
    success: boolean;
    history_sync: HistorySyncStatus;
    logs: HistorySyncLog[];
  }>(`/history/${accountId}`);
}

export async function markHistorySyncComplete(accountId: number) {
  return coexReq<{ success: boolean }>(`/history/${accountId}/complete`, {
    method: 'POST',
  });
}

// ── Contacts ──
export async function getCoexistenceContacts(params: {
  account_id: number;
  label?: string;
  search?: string;
  page?: number;
  per_page?: number;
}) {
  const qs = new URLSearchParams();
  qs.set('account_id', String(params.account_id));
  if (params.label) qs.set('label', params.label);
  if (params.search) qs.set('search', params.search);
  if (params.page) qs.set('page', String(params.page));
  if (params.per_page) qs.set('per_page', String(params.per_page));
  return coexReq<{
    success: boolean;
    contacts: CoexistenceContact[];
    total: number;
    page: number;
    per_page: number;
  }>(`/contacts?${qs}`);
}

export async function addContactLabel(contactId: number, label: string) {
  return coexReq<{ success: boolean }>(`/contacts/${contactId}/label`, {
    method: 'POST',
    body: JSON.stringify({ label, action: 'add' }),
  });
}

export async function removeContactLabel(contactId: number, label: string) {
  return coexReq<{ success: boolean }>(`/contacts/${contactId}/label`, {
    method: 'POST',
    body: JSON.stringify({ label, action: 'remove' }),
  });
}

// ── Echo Messages ──
export async function getEchoMessages(accountId: number, params?: {
  page?: number;
  per_page?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.per_page) qs.set('per_page', String(params.per_page));
  const qstr = qs.toString();
  return coexReq<{
    success: boolean;
    echo_messages: EchoMessage[];
    total: number;
  }>(`/echo-messages/${accountId}${qstr ? '?' + qstr : ''}`);
}

// ── Upgrade ──
export async function upgradeToStandard(accountId: number) {
  return coexReq<{
    success: boolean;
    message: string;
    new_mps_limit: number;
  }>(`/upgrade/${accountId}`, { method: 'POST' });
}

// ── Types ──
export interface DeviceStatus {
  status: 'active' | 'idle' | 'at_risk' | 'inactive';
  health: 'healthy' | 'warning' | 'critical' | 'danger';
  last_mobile_activity_at: string | null;
  hours_since_activity: number | null;
  is_coexistence: boolean;
}

export interface RateLimitStatus {
  tokens_available: number;
  max_tokens: number;
  messages_sent_today: number;
  utilization_percent: number;
  is_coexistence: boolean;
  mps_limit: number;
}

export interface HistorySyncStatus {
  sync_status: string;
  history_sync_completed: boolean;
  history_sync_progress: number;
}

export interface HistorySyncLog {
  id: number;
  batch_id: string;
  status: string;
  messages_received: number;
  messages_stored: number;
  messages_duplicated: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface CoexistenceContact {
  id: number;
  phone: string;
  name: string | null;
  wa_id: string;
  labels: string[];
  notes: string | null;
  last_message_at: string | null;
  total_messages: number;
}

export interface EchoMessage {
  id: number;
  wamid: string;
  direction: 'echo';
  type: string;
  content: Record<string, unknown>;
  status: string;
  created_at: string;
}
