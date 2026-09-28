// JOM (Journey Of Miles custom vertical) — owner API client + workspace gate.
// Everything here is scoped to the JOM workspace(s) only; the UI that uses it
// is hidden for every other workspace. Reuses the owner-authenticated apiClient
// (same identity/session as the Agents tab), passing workspace_id explicitly
// because the backend guard reads it from the query/body, not a header.
import apiClient from "@/lib/apiClient";

// The only workspace(s) this custom vertical is enabled for. Keep in sync with
// the backend env JOM_WORKSPACE_IDS (default "211").
export const JOM_WORKSPACE_IDS = ["211"];

export function isJomWorkspace(id: string | number | null | undefined): boolean {
  if (id === null || id === undefined) return false;
  return JOM_WORKSPACE_IDS.includes(String(id));
}

export interface JomDepartment {
  id: number;
  workspace_id: number;
  name: string;
  match_keywords: string[] | null;
  routing_mode: string | null;
  is_active: boolean;
  sort_order: number;
  last_agent_id: number | null;
  agent_ids: number[];
}

export interface JomSummary {
  success: boolean;
  days: number;
  /** { "2026-09-25": { closed: 3, dormant: 5 }, ... } */
  by_day: Record<string, Record<string, number>>;
  totals: Record<string, number>;
  close_reasons: Record<string, number>;
}

export interface JomLead {
  customer_phone: string;
  status: string;
  department_id: number | null;
  department: string | null;
  // memory card
  customer_name: string | null;
  destination: string | null;
  budget: string | null;
  travel_dates: string | null;
  party_size: string | null;
  close_reason: string | null;
  assigned_agent_id: number | null;
  agent: string | null;
  drip_stage: number | null;
  status_since: string | null;
  next_followup_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  reopen_count: number | null;
  meta_lead_id: string | null;
  email: string | null;
  total_inbound: number | null;
  total_outbound: number | null;
  consecutive_no_reply: number | null;
  last_intent: string | null;
  last_confidence: number | null;
  engagement_score: number | null;
}

export interface JomSettings {
  ghosted_days: number[];
  dormant_days: number[];
  qualify_max_turns: number;
  /** { opening: "jom_opening", ghosted_checkin: "...", ... } */
  templates: Record<string, string>;
}

export interface JomSettingsResponse {
  success: boolean;
  settings: JomSettings;
  /** stable step keys the templates map is keyed on */
  template_keys: string[];
  /** the workspace's Meta-approved template names, for the pickers */
  approved_templates: string[];
}

export interface JomSheetConfig {
  enabled: boolean;
  sheet_url: string | null;
  header_map: Record<string, string>;
  last_synced_at: string | null;
  last_status: "ok" | "error" | null;
  last_error: string | null;
  last_row_count: number | null;
  last_imported_count: number | null;
  total_imported: number;
}

export interface JomSheetSyncResult {
  success: boolean;
  rows?: number;
  imported?: number;
  messaged?: number;
  error?: string;
  config: JomSheetConfig;
}

export interface JomSchedule {
  id: number;
  customer_phone: string;
  template_name: string;
  variables: Record<string, string>;
  scheduled_at: string | null;   // ISO UTC
  status: "pending" | "sent" | "cancelled" | "failed";
  assigned_agent_id: number | null;
  created_by_kind: string | null;
  note: string | null;
  sent_at: string | null;
  error: string | null;
  created_at: string | null;
}

const wsq = (workspaceId: string) => `workspace_id=${encodeURIComponent(workspaceId)}`;

export const jomApi = {
  listDepartments: (workspaceId: string) =>
    apiClient.get<{ success: boolean; departments: JomDepartment[] }>(
      "/jom/departments",
      { workspace_id: workspaceId }
    ),

  createDepartment: (
    workspaceId: string,
    body: { name: string; match_keywords?: string[]; routing_mode?: string; sort_order?: number }
  ) =>
    apiClient.post<{ success: boolean; department: JomDepartment }>("/jom/departments", {
      workspace_id: Number(workspaceId),
      ...body,
    }),

  updateDepartment: (
    workspaceId: string,
    departmentId: number,
    body: Partial<{ name: string; match_keywords: string[]; routing_mode: string; is_active: boolean; sort_order: number }>
  ) =>
    apiClient.patch<{ success: boolean; department: JomDepartment }>(
      `/jom/departments/${departmentId}`,
      { workspace_id: Number(workspaceId), ...body }
    ),

  deleteDepartment: (workspaceId: string, departmentId: number) =>
    apiClient.delete<{ success: boolean }>(
      `/jom/departments/${departmentId}?${wsq(workspaceId)}`
    ),

  addAgent: (workspaceId: string, departmentId: number, agentId: number) =>
    apiClient.post<{ success: boolean; agent_ids: number[] }>(
      `/jom/departments/${departmentId}/agents`,
      { workspace_id: Number(workspaceId), agent_id: agentId }
    ),

  removeAgent: (workspaceId: string, departmentId: number, agentId: number) =>
    apiClient.delete<{ success: boolean; agent_ids: number[] }>(
      `/jom/departments/${departmentId}/agents/${agentId}?${wsq(workspaceId)}`
    ),

  /** Manual override: a human sets a lead's status. */
  setLeadStatus: (workspaceId: string, customerPhone: string, status: string, reason?: string) =>
    apiClient.patch<{ success: boolean; old_status: string; status: string }>(
      `/jom/leads/${encodeURIComponent(customerPhone)}/status`,
      { workspace_id: Number(workspaceId), status, ...(reason ? { reason } : {}) }
    ),

  /** Demo data for showing the client a populated dashboard. */
  seedDemo: (workspaceId: string) =>
    apiClient.post<{ success: boolean; seeded: number }>("/jom/leads/demo-seed", { workspace_id: Number(workspaceId) }),
  clearDemo: (workspaceId: string) =>
    apiClient.post<{ success: boolean; cleared: number }>("/jom/leads/demo-clear", { workspace_id: Number(workspaceId) }),

  /** Per-day outcome report for the CRM date filter. */
  getSummary: (workspaceId: string, days = 30) =>
    apiClient.get<JomSummary>("/jom/leads/summary", {
      workspace_id: workspaceId,
      days: String(days),
    }),

  /** Google Sheet lead intake — config + health. */
  getSheet: (workspaceId: string) =>
    apiClient.get<{ success: boolean; config: JomSheetConfig }>("/jom/sheet", {
      workspace_id: workspaceId,
    }),

  saveSheet: (
    workspaceId: string,
    body: Partial<{ sheet_url: string; enabled: boolean; header_map: Record<string, string> }>
  ) =>
    apiClient.post<{ success: boolean; config: JomSheetConfig; error?: string }>("/jom/sheet", {
      workspace_id: Number(workspaceId),
      ...body,
    }),

  syncSheet: (workspaceId: string, sendOpening = true) =>
    apiClient.post<JomSheetSyncResult>("/jom/sheet/sync", {
      workspace_id: Number(workspaceId),
      send_opening: sendOpening,
    }),

  /** Owner-editable cadence / qualify threshold / template mapping. */
  getSettings: (workspaceId: string) =>
    apiClient.get<JomSettingsResponse>("/jom/settings", { workspace_id: workspaceId }),

  saveSettings: (
    workspaceId: string,
    body: Partial<{
      ghosted_days: number[];
      dormant_days: number[];
      qualify_max_turns: number;
      templates: Record<string, string>;
    }>
  ) =>
    apiClient.patch<{ success: boolean; settings: JomSettings }>("/jom/settings", {
      workspace_id: Number(workspaceId),
      ...body,
    }),

  /** Agent/owner scheduled one-off follow-ups. */
  listSchedules: (workspaceId: string, customerPhone: string) =>
    apiClient.get<{ success: boolean; schedules: JomSchedule[] }>(
      `/jom/leads/${encodeURIComponent(customerPhone)}/schedules`,
      { workspace_id: workspaceId }
    ),

  createSchedule: (
    workspaceId: string,
    customerPhone: string,
    body: { template_name: string; scheduled_at: string; variables?: Record<string, string>; note?: string }
  ) =>
    apiClient.post<{ success: boolean; schedule: JomSchedule; error?: string }>(
      `/jom/leads/${encodeURIComponent(customerPhone)}/schedule`,
      { workspace_id: Number(workspaceId), ...body }
    ),

  cancelSchedule: (workspaceId: string, scheduleId: number) =>
    apiClient.post<{ success: boolean; schedule: JomSchedule; error?: string }>(
      `/jom/schedules/${scheduleId}/cancel`,
      { workspace_id: Number(workspaceId) }
    ),

  listLeads: (workspaceId: string, status?: string) =>
    apiClient.get<{ success: boolean; leads: JomLead[]; counts: Record<string, number>; total: number }>(
      "/jom/leads",
      status ? { workspace_id: workspaceId, status } : { workspace_id: workspaceId }
    ),
};
