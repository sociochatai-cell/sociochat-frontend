/**
 * WhatsApp API Client
 * 
 * Centralized API client for all WhatsApp Business API endpoints.
 * Base URL: /api/whatsapp
 * 
 * @see Backend Checklist for endpoint documentation
 */

import apiClient from '@/lib/apiClient';

// ============================================================
// Base Configuration
// ============================================================

const WHATSAPP_API_BASE = '/whatsapp';

// ============================================================
// Types
// ============================================================

export interface WABAInfo {
  id: string;
  waba_id: string; // Alias for id for compatibility
  name: string;
  currency: string;
  timezone_id: string;
  message_template_namespace: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  is_verified: boolean;
  linked_at: string;
}

export interface PhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  status: string;
  code_verification_status: string;
  is_official_business_account: boolean;
}

export interface WABAResponse {
  success: boolean;
  waba: WABAInfo | null;
  phone_numbers: PhoneNumber[];
  error?: string;
}

export interface PhoneNumbersResponse {
  success: boolean;
  phone_numbers: PhoneNumber[];
  error?: string;
}

export interface MessageTemplate {
  id: string;
  meta_template_id?: string;
  name: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  category: string;
  components: Array<{
    type: string;
    text?: string;
    format?: string;
    buttons?: Array<{ type: string; text: string; url?: string }>;
  }>;
  variable_count?: number;
  variable_mapping?: Record<string, string> | null;
  body_text?: string;
}

export interface TemplatesResponse {
  templates: MessageTemplate[];
  total: number;
  error?: string;
}

export interface Conversation {
  id: string;
  customer_phone: string;
  customer_name?: string;
  status: 'active' | 'responded' | 'closed';
  last_message_at: string;
  last_message_preview?: string;
  unread_count: number;
  created_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'template' | 'image' | 'video' | 'document' | 'audio';
  content: string;
  media_url?: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  created_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: ConversationMessage[];
}

export interface ConversationsResponse {
  conversations: Conversation[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
  error?: string;
}

export interface SendMessageRequest {
  workspace_id: string;
  to: string; // Phone number: "919876543210"
  type: 'text' | 'template' | 'image' | 'video' | 'document';
  text?: string;
  template_name?: string;
  template_language?: string;
  template_components?: Record<string, unknown>[];
  media_url?: string;
  caption?: string;
}

export interface SendMessageResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}

export interface CampaignListItem {
  id: string;
  name: string;
  status: 'DRAFT' | 'PENDING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  daily_budget: number;
  total_spend: number;
  impressions: number;
  clicks: number;
  conversations: number;
  start_time: string;
  created_at: string;
}

export interface CampaignsResponse {
  campaigns: CampaignListItem[];
  total: number;
  error?: string;
}

export interface CreateCampaignRequest {
  workspace_id: string;
  name: string;
  ad_account_id: string;
  daily_budget: number;
  start_time: string; // ISO format
  end_time?: string;
  targeting: {
    geo_locations: {
      countries?: string[];
      cities?: Array<{ key: string; radius?: number; distance_unit?: string }>;
      regions?: Array<{ key: string }>;
    };
    age_min: number;
    age_max: number;
    genders?: number[];
    interests?: Array<{ id: string; name: string }>;
  };
  creative: {
    headline: string;
    body: string;
    image_url?: string;
    video_url?: string;
    cta_type: 'WHATSAPP_MESSAGE';
    welcome_message?: string;
    ice_breakers?: Array<{ title: string; payload?: string }>;
  };
}

export interface CreateCampaignResponse {
  success: boolean;
  campaign_id?: string;
  adset_id?: string;
  creative_id?: string;
  error?: string;
}

export interface LinkMetaRequest {
  workspace_id: string;
  waba_id: string;
  access_token: string;
  system_user_id?: string;
}

export interface LinkMetaResponse {
  success: boolean;
  waba?: WABAInfo;
  phone_numbers?: PhoneNumber[];
  error?: string;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  module: string;
  error?: string;
}

// ============================================================
// Connection Path Types (Dual-Path UX)
// ============================================================

export type ConnectionStatus = 'NO_ACCOUNT' | 'CONNECTED' | 'PARTIAL' | 'RELINK_REQUIRED';
export type RecommendedPath = 'EMBEDDED' | 'MANUAL' | null;

export interface AccountSummary {
  id: number;
  waba_id: string;
  phone_number: string | null;
  phone_number_id: string | null;
  verified_name: string | null;
  display_name_status: 'APPROVED' | 'IN_REVIEW' | 'PENDING' | null;
  quality_rating: 'GREEN' | 'YELLOW' | 'RED' | null;
  is_test_number: boolean;
  is_active: boolean;
  token_type: string;
}

export interface ConnectionPathResponse {
  success: boolean;
  status: ConnectionStatus;
  recommended_path: RecommendedPath;
  reason: string;
  account_summary: AccountSummary | null;
  can_use_embedded_signup: boolean;
  can_use_manual_link: boolean;
  error?: string;
}

export interface ManualConnectRequest {
  workspace_id: string;
  waba_id: string;
  phone_number_id: string;
  access_token: string;
  user_id?: string;
}

export interface ManualConnectResponse {
  success: boolean;
  message?: string;
  account?: Record<string, unknown>;
  was_updated?: boolean;
  is_new?: boolean;
  error?: string;
  error_code?: string;
  help?: Record<string, string>;
}

export interface ValidateTokenResponse {
  valid: boolean;
  user_id?: string;
  name?: string;
  error?: string;
}

// ============================================================
// API Functions
// ============================================================

/**
 * Health check for WhatsApp module
 */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>(`${WHATSAPP_API_BASE}/health`);
  if (!response.ok) {
    return { status: 'error', module: 'whatsapp', error: 'Health check failed' };
  }
  return response.data || { status: 'error', module: 'whatsapp' };
}

/**
 * Link WhatsApp Business Account to workspace
 */
export async function linkWABA(request: LinkMetaRequest): Promise<LinkMetaResponse> {
  const response = await apiClient.post<LinkMetaResponse>(
    `${WHATSAPP_API_BASE}/link-meta`,
    request
  );
  if (!response.ok) {
    return {
      success: false,
      error: response.error?.message || 'Failed to link WABA'
    };
  }
  return response.data || { success: false, error: 'Unknown error' };
}

/**
 * Get linked WABA info for workspace
 */
export async function getWABA(workspaceId: string): Promise<WABAResponse> {
  const response = await apiClient.get<WABAResponse>(
    `${WHATSAPP_API_BASE}/waba`,
    { workspace_id: workspaceId }
  );
  if (!response.ok) {
    return {
      success: false,
      waba: null,
      phone_numbers: [],
      error: response.error?.message || 'Failed to get WABA'
    };
  }
  return {
    success: true,
    ...response.data,
    waba: response.data?.waba || null,
    phone_numbers: response.data?.phone_numbers || []
  };
}

/**
 * Get phone numbers for workspace
 */
export async function getPhoneNumbers(workspaceId: string): Promise<PhoneNumbersResponse> {
  const response = await apiClient.get<PhoneNumbersResponse>(
    `${WHATSAPP_API_BASE}/phone-numbers`,
    { workspace_id: workspaceId }
  );
  if (!response.ok) {
    return {
      success: false,
      phone_numbers: [],
      error: response.error?.message || 'Failed to get phone numbers'
    };
  }
  return { success: true, phone_numbers: response.data?.phone_numbers || [] };
}

/**
 * Sync message templates from Meta
 */
export async function syncTemplates(workspaceId: string): Promise<{ success: boolean; count?: number; error?: string }> {
  const response = await apiClient.post<{ success: boolean; count?: number; error?: string }>(
    `${WHATSAPP_API_BASE}/templates/sync`,
    { workspace_id: workspaceId }
  );
  if (!response.ok) {
    return { success: false, error: response.error?.message || 'Failed to sync templates' };
  }
  return response.data || { success: false };
}

/**
 * Delete a message template from Meta and local database
 */
export async function deleteTemplate(
  templateId: string,
  workspaceId: string
): Promise<{ success: boolean; deleted_count?: number; error?: string }> {
  const response = await apiClient.del<{ success: boolean; deleted_count?: number; error?: string }>(
    `${WHATSAPP_API_BASE}/templates/${templateId}?workspace_id=${encodeURIComponent(workspaceId)}`
  );
  if (!response.ok) {
    return { success: false, error: response.error?.message || 'Failed to delete template' };
  }
  return response.data || { success: false };
}

/**
 * Get message templates for workspace
 */
export async function getTemplates(
  workspaceId: string,
  status?: 'APPROVED' | 'PENDING' | 'REJECTED'
): Promise<TemplatesResponse> {
  const params: Record<string, string> = { workspace_id: workspaceId };
  if (status) params.status = status;

  const response = await apiClient.get<TemplatesResponse>(
    `${WHATSAPP_API_BASE}/templates`,
    params
  );
  if (!response.ok) {
    return {
      templates: [],
      total: 0,
      error: response.error?.message || 'Failed to get templates'
    };
  }
  return response.data || { templates: [], total: 0 };
}

/**
 * Send a WhatsApp message
 */
export async function sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
  const response = await apiClient.post<SendMessageResponse>(
    `${WHATSAPP_API_BASE}/send-message`,
    request
  );
  if (!response.ok) {
    return {
      success: false,
      error: response.error?.message || 'Failed to send message'
    };
  }
  return response.data || { success: false };
}

/**
 * Get conversations for workspace
 */
export async function getConversations(
  workspaceId: string,
  options: {
    page?: number;
    per_page?: number;
    status?: 'active' | 'responded' | 'closed';
  } = {}
): Promise<ConversationsResponse> {
  const params: Record<string, string> = { workspace_id: workspaceId };
  if (options.page) params.page = String(options.page);
  if (options.per_page) params.per_page = String(options.per_page);
  if (options.status) params.status = options.status;

  const response = await apiClient.get<ConversationsResponse>(
    `${WHATSAPP_API_BASE}/conversations`,
    params
  );
  if (!response.ok) {
    return {
      conversations: [],
      total: 0,
      page: 1,
      per_page: 20,
      pages: 0,
      error: response.error?.message || 'Failed to get conversations'
    };
  }
  return response.data || { conversations: [], total: 0, page: 1, per_page: 20, pages: 0 };
}

/**
 * Get conversation details with messages
 */
export async function getConversation(
  conversationId: string
): Promise<{ conversation: ConversationDetail | null; error?: string }> {
  const response = await apiClient.get<ConversationDetail>(
    `${WHATSAPP_API_BASE}/conversations/${conversationId}`
  );
  if (!response.ok) {
    return { conversation: null, error: response.error?.message || 'Failed to get conversation' };
  }
  return { conversation: response.data || null };
}

/**
 * Close a conversation
 */
export async function closeConversation(conversationId: string): Promise<{ success: boolean; error?: string }> {
  const response = await apiClient.post<{ success: boolean; error?: string }>(
    `${WHATSAPP_API_BASE}/conversations/${conversationId}/close`,
    {}
  );
  if (!response.ok) {
    return { success: false, error: response.error?.message || 'Failed to close conversation' };
  }
  return response.data || { success: false };
}

/**
 * Send CAPI lead event
 */
export async function sendCAPILead(
  workspaceId: string,
  leadData: {
    phone: string;
    email?: string;
    name?: string;
    event_source_url?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const response = await apiClient.post<{ success: boolean; error?: string }>(
    `${WHATSAPP_API_BASE}/capi/send-lead`,
    { workspace_id: workspaceId, ...leadData }
  );
  if (!response.ok) {
    return { success: false, error: response.error?.message || 'Failed to send CAPI lead' };
  }
  return response.data || { success: false };
}

/**
 * Get campaigns for workspace
 */
export async function getCampaigns(workspaceId: string): Promise<CampaignsResponse> {
  const response = await apiClient.get<CampaignsResponse>(
    `${WHATSAPP_API_BASE}/campaigns`,
    { workspace_id: workspaceId }
  );
  if (!response.ok) {
    return {
      campaigns: [],
      total: 0,
      error: response.error?.message || 'Failed to get campaigns'
    };
  }
  return response.data || { campaigns: [], total: 0 };
}

/**
 * Create a new CTWA campaign
 * 
 * Accepts either the full CreateCampaignRequest format or
 * any object that represents a campaign payload.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createCampaign(request: any): Promise<CreateCampaignResponse> {
  const response = await apiClient.post<CreateCampaignResponse>(
    `${WHATSAPP_API_BASE}/campaigns`,
    request
  );
  if (!response.ok) {
    return {
      success: false,
      error: response.error?.message || 'Failed to create campaign'
    };
  }
  return response.data || { success: false };
}

/**
 * Publish a campaign
 */
export async function publishCampaign(campaignId: string): Promise<{ success: boolean; error?: string }> {
  const response = await apiClient.post<{ success: boolean; error?: string }>(
    `${WHATSAPP_API_BASE}/campaigns/${campaignId}/publish`,
    {}
  );
  if (!response.ok) {
    return { success: false, error: response.error?.message || 'Failed to publish campaign' };
  }
  return response.data || { success: false };
}

// ============================================================
// Connection Path API Functions (Dual-Path UX)
// ============================================================

/**
 * Get connection path recommendation for a workspace.
 * 
 * Determines whether to show Embedded Signup (new number) or
 * Manual Linking (existing account) based on workspace state.
 */
export async function getConnectionPath(workspaceId: string): Promise<ConnectionPathResponse> {
  const response = await apiClient.get<ConnectionPathResponse>(
    `${WHATSAPP_API_BASE}/connection-path`,
    { workspace_id: workspaceId }
  );
  if (!response.ok) {
    return {
      success: false,
      status: 'NO_ACCOUNT',
      recommended_path: 'EMBEDDED',
      reason: response.error?.message || 'Failed to get connection path',
      account_summary: null,
      can_use_embedded_signup: true,
      can_use_manual_link: true,
      error: response.error?.message
    };
  }
  return response.data || {
    success: false,
    status: 'NO_ACCOUNT',
    recommended_path: 'EMBEDDED',
    reason: 'Unknown error',
    account_summary: null,
    can_use_embedded_signup: true,
    can_use_manual_link: true
  };
}

/**
 * Connect an existing WhatsApp account via manual credentials.
 * 
 * Use this when user already has WABA ID + Phone Number ID + Token
 * from an existing WhatsApp Cloud API setup.
 */
export async function connectManual(request: ManualConnectRequest): Promise<ManualConnectResponse> {
  const response = await apiClient.post<ManualConnectResponse>(
    `${WHATSAPP_API_BASE}/connect/manual`,
    request
  );
  if (!response.ok) {
    return {
      success: false,
      error: response.error?.message || 'Failed to connect account',
      error_code: 'API_ERROR'
    };
  }
  return response.data || { success: false, error: 'Unknown error' };
}

/**
 * Validate an access token with Meta API before saving.
 * 
 * Call this to check if a token is valid before attempting
 * to save it. Helps users debug token issues.
 */
export async function validateToken(accessToken: string): Promise<ValidateTokenResponse> {
  const response = await apiClient.post<ValidateTokenResponse>(
    `${WHATSAPP_API_BASE}/connection-path/validate-token`,
    { access_token: accessToken }
  );
  if (!response.ok) {
    return {
      valid: false,
      error: response.error?.message || 'Token validation failed'
    };
  }
  return response.data || { valid: false, error: 'Unknown error' };
}

// ============================================================
// Notification Settings
// ============================================================

export interface NotificationSettingsResponse {
  success: boolean;
  notification_phone_number: string | null;
  error?: string;
}

export interface UpdateNotificationSettingsResponse {
  success: boolean;
  message?: string;
  notification_phone_number: string | null;
  error?: string;
}

/**
 * Get notification settings for the workspace's WhatsApp account.
 * 
 * Returns the configured notification phone number for receiving
 * alerts like waitlist signups.
 */
export async function getNotificationSettings(params: {
  workspace_id?: string;
  account_id?: string | number;
}): Promise<NotificationSettingsResponse> {
  const queryParams = new URLSearchParams();
  if (params.workspace_id) queryParams.append('workspace_id', params.workspace_id);
  if (params.account_id) queryParams.append('account_id', String(params.account_id));
  
  const response = await apiClient.get<NotificationSettingsResponse>(
    `${WHATSAPP_API_BASE}/notification-settings?${queryParams.toString()}`
  );
  if (!response.ok) {
    return {
      success: false,
      notification_phone_number: null,
      error: response.error?.message || 'Failed to get notification settings'
    };
  }
  return response.data || { success: false, notification_phone_number: null, error: 'Unknown error' };
}

/**
 * Update notification settings for the workspace's WhatsApp account.
 * 
 * @param params.notification_phone_number - Phone number with country code (no +)
 */
export async function updateNotificationSettings(params: {
  workspace_id?: string;
  account_id?: string | number;
  notification_phone_number: string;
}): Promise<UpdateNotificationSettingsResponse> {
  const response = await apiClient.post<UpdateNotificationSettingsResponse>(
    `${WHATSAPP_API_BASE}/notification-settings`,
    {
      workspace_id: params.workspace_id,
      account_id: params.account_id,
      notification_phone_number: params.notification_phone_number
    }
  );
  if (!response.ok) {
    return {
      success: false,
      notification_phone_number: null,
      error: response.error?.message || 'Failed to update notification settings'
    };
  }
  return response.data || { success: false, notification_phone_number: null, error: 'Unknown error' };
}

// ============================================================
// Export all
// ============================================================

const whatsappApi = {
  checkHealth,
  linkWABA,
  getWABA,
  getPhoneNumbers,
  syncTemplates,
  deleteTemplate,
  getTemplates,
  sendMessage,
  getConversations,
  getConversation,
  closeConversation,
  sendCAPILead,
  getCampaigns,
  createCampaign,
  publishCampaign,
  // Connection Path (Dual-Path UX)
  getConnectionPath,
  connectManual,
  validateToken,
  // Notification Settings
  getNotificationSettings,
  updateNotificationSettings,
};

export default whatsappApi;

