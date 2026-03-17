// WhatsApp Test Console Types
// ============================

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  wabaId?: string;
  apiVersion: string;
}

export type MessageType = 'text' | 'template' | 'media' | 'interactive';

export type MediaType = 'image' | 'video' | 'audio' | 'document';

export type InteractiveType = 'button' | 'list';

// API Request Types
export interface TextMessagePayload {
  to: string;
  text: string;
  preview_url?: boolean;
}

export interface TemplateMessagePayload {
  to: string;
  template_name: string;
  language: string;
  components?: TemplateComponent[];
  params?: string[];
  header_image_url?: string;
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters?: TemplateParameter[];
}

export interface TemplateParameter {
  type: 'text' | 'image' | 'video' | 'document';
  text?: string;
  image?: { link: string };
  video?: { link: string };
  document?: { link: string; filename?: string };
}

export interface MediaMessagePayload {
  to: string;
  media_type: MediaType;
  media_url?: string;
  media_id?: string;
  caption?: string;
  filename?: string;
}

export interface InteractiveMessagePayload {
  to: string;
  type?: InteractiveType;
  interactive?: {
    type: InteractiveType;
    body: string;
    header?: string;
    footer?: string;
    buttons?: InteractiveButton[];
    button?: string; // For list type - the button text
    sections?: ListSection[];
  };
}

export interface InteractiveButton {
  id: string;
  title: string;
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

// API Response Types
export interface WhatsAppApiResponse {
  success: boolean;
  wamid?: string;
  message_id?: number;
  conversation_id?: number;
  error?: string;
  error_code?: string;
  payload_sent?: Record<string, unknown>;
}

export interface ConversationMessage {
  id: number | string; // Can be DB integer id or SSE-generated string
  conversation_id: number;
  wamid?: string;
  direction: 'incoming' | 'outgoing';
  type: string; // text, template, image, video, audio, document, interactive
  template_name?: string; // For template messages - used for analytics
  template_category?: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'; // Template category for analytics
  content: Record<string, unknown> | string; // JSON content or string text
  body?: string; // Text body helper
  timestamp?: string; // Standard timestamp alias
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'received';
  error_code?: string;
  error_message?: string;
  created_at: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
}

export interface Conversation {
  id: number;
  account_id: number;
  user_phone: string;
  user_name?: string;
  status: 'open' | 'closed';
  unread_count: number;
  // Session tracking (24h window)
  is_session_open?: boolean;
  session_time_left_seconds?: number; // Countdown in seconds
  close_reason?: 'agent' | 'expired' | 'never_opened' | null; // Why session is closed
  closed_by_agent?: boolean; // If manually closed by agent
  closed_at?: string | null; // When agent closed it
  last_inbound_at?: string | null;
  last_outbound_at?: string | null;
  session_expires_at?: string | null;
  // Timestamps
  last_message_at: string | null;
  last_message_preview?: string; // Text preview for list
  created_at: string;
  updated_at: string;
  messages?: ConversationMessage[];
  // CTWA Attribution fields
  entry_source?: 'organic' | 'ctwa' | 'qr' | 'link';
  ctwa_clid?: string;
  ad_id?: string;
  campaign_id?: string;
  attribution_data?: {
    ad_id: string;
    ctwa_clid: string;
    source_type?: string;
    headline?: string;
    body?: string;
    media_type?: string;
    image_url?: string;
    campaign_id?: string;
    campaign_name?: string;
    adset_id?: string;
    adset_name?: string;
    ad_name?: string;
    attributed_at?: string;
    enriched?: boolean;
  } | null;
}

// Local Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'wa_test_access_token',
  PHONE_NUMBER_ID: 'wa_test_phone_number_id',
  WABA_ID: 'wa_test_waba_id',
  API_VERSION: 'wa_test_api_version',
} as const;

// Real-Time Event Types
export type WhatsAppRealtimeEvent =
  | { type: 'whatsapp_message_received'; data: MessageReceivedEvent }
  | { type: 'whatsapp_message_status'; data: MessageStatusEvent };

export interface MessageReceivedEvent {
  message: ConversationMessage;
  conversation_id: number;
  account_id: number;
  workspace_id: string;
}

export interface MessageStatusEvent {
  wamid: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  conversation_id: number;
  account_id: number;
  workspace_id: string;
}
