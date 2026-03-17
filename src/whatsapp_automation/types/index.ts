/**
 * TypeScript types for CTWA Campaign creation and related entities
 * 
 * Example CTWA Ad Creative JSON for Meta API:
 * {
 *   "object_story_spec": {
 *     "page_id": "123456789",
 *     "link_data": {
 *       "call_to_action": {
 *         "type": "WHATSAPP_MESSAGE",
 *         "value": {
 *           "app_destination": "WHATSAPP"
 *         }
 *       },
 *       "page_welcome_message": {
 *         "type": "VISUAL_EDITOR",
 *         "ctwa_config": {
 *           "is_ctwa": true,
 *           "phone_number_id": "987654321",
 *           "ice_breakers": [
 *             { "title": "Learn more", "payload": "LEARN_MORE" },
 *             { "title": "Get pricing", "payload": "PRICING" }
 *           ]
 *           // OR for pre-filled message:
 *           // "prefilled_message": "Hi, I'm interested in your products!"
 *         }
 *       }
 *     }
 *   }
 * }
 */

// ============================================================
// Audience Location Types
// ============================================================

export interface AudienceLocation {
  id: string;
  query: string; // User search query / display name
  type: 'city' | 'region' | 'country' | 'zip' | 'custom';
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  lat?: number;
  lon?: number;
  radius_meters?: number; // 0-50000 (50km max)
  included: boolean; // true = target, false = exclude
}

export interface AudienceConfig {
  locations: AudienceLocation[];
  age_min: number;
  age_max: number;
  gender: 'all' | 'male' | 'female';
  interests: string[];
  custom_audiences?: string[];
  lookalike_audiences?: string[];
}

// ============================================================
// CTWA Specific Types
// ============================================================

export interface IceBreaker {
  id: string;
  title: string; // Max 20 characters
  payload?: string; // Optional payload for webhook
}

export interface CTWAConfig {
  is_ctwa: true;
  phone_number_id: string;
  page_id: string;
  // Mutually exclusive: either ice_breakers OR prefilled_message
  ice_breakers?: IceBreaker[];
  prefilled_message?: string;
}

// ============================================================
// Campaign Types
// ============================================================

export type CampaignObjective = 
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_SALES'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_APP_PROMOTION';

export type OptimizationGoal = 
  | 'CONVERSATIONS'
  | 'LINK_CLICKS'
  | 'REACH'
  | 'IMPRESSIONS'
  | 'LEADS';

export type DestinationType = 
  | 'WEBSITE'
  | 'WHATSAPP'
  | 'MESSENGER'
  | 'INSTAGRAM_DIRECT';

export interface Campaign {
  id?: string;
  name: string;
  objective: CampaignObjective;
  status?: 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'PAUSED';
  special_ad_categories?: string[];
}

export interface AdSet {
  id?: string;
  campaign_id?: string;
  name: string;
  daily_budget: number; // In cents
  lifetime_budget?: number;
  start_time: string; // ISO date string
  end_time?: string;
  optimization_goal: OptimizationGoal;
  destination_type: DestinationType;
  targeting: AudienceConfig;
  billing_event?: 'IMPRESSIONS' | 'LINK_CLICKS';
}

export interface Creative {
  id?: string;
  name: string;
  method: 'generate_ai' | 'upload' | 'generate_from_link';
  media_urls: string[];
  primary_text: string;
  headline?: string;
  description?: string;
  call_to_action: string;
  link_url?: string;
  // CTWA specific
  ctwa_config?: CTWAConfig;
}

// ============================================================
// Linked Account Types
// ============================================================

export interface LinkedPage {
  page_id: string;
  page_name: string;
  waba_id?: string;
  phone_number_id?: string;
  instagram_account_id?: string;
  display_phone_number?: string;
  access_token?: string; // Should not be exposed to frontend
}

export interface LinkMetaResponse {
  success: boolean;
  linked: LinkedPage[];
  error?: string;
}

// ============================================================
// API Request/Response Types
// ============================================================

export interface CreateCampaignRequest {
  workspace_id: string;
  campaign: Campaign;
  adset: AdSet;
  creative: Creative;
}

export interface CreateCampaignResponse {
  success: boolean;
  campaign_id?: string;
  adset_id?: string;
  creative_id?: string;
  error?: string;
}

export interface GenerateAIRequest {
  workspace_id: string;
  prompt: string;
  style?: string;
  num_images?: number;
}

export interface GenerateAIResponse {
  success: boolean;
  images?: Array<{ id: string; url: string }>;
  error?: string;
}

// ============================================================
// Validation Helpers
// ============================================================

export function validateCTWAConfig(config: CTWAConfig): string[] {
  const errors: string[] = [];
  
  if (!config.page_id) {
    errors.push('Page ID is required for CTWA');
  }
  
  if (!config.phone_number_id) {
    errors.push('WhatsApp phone number ID is required for CTWA');
  }
  
  // Mutual exclusivity check
  const hasIceBreakers = config.ice_breakers && config.ice_breakers.length > 0;
  const hasPrefilledMessage = config.prefilled_message && config.prefilled_message.trim().length > 0;
  
  if (hasIceBreakers && hasPrefilledMessage) {
    errors.push('Cannot use both Ice Breakers and Pre-filled Message. Choose one.');
  }
  
  if (!hasIceBreakers && !hasPrefilledMessage) {
    errors.push('Either Ice Breakers or Pre-filled Message is required.');
  }
  
  if (hasIceBreakers && config.ice_breakers) {
    if (config.ice_breakers.length > 4) {
      errors.push('Maximum 4 Ice Breakers allowed.');
    }
    
    config.ice_breakers.forEach((ib, index) => {
      if (ib.title.length > 20) {
        errors.push(`Ice Breaker ${index + 1}: Title must be 20 characters or less.`);
      }
      if (!ib.title.trim()) {
        errors.push(`Ice Breaker ${index + 1}: Title is required.`);
      }
    });
  }
  
  return errors;
}

export function validateAudienceLocations(locations: AudienceLocation[]): string[] {
  const errors: string[] = [];
  
  if (locations.length === 0) {
    errors.push('At least one location is required.');
  }
  
  if (locations.length > 10) {
    errors.push('Maximum 10 locations allowed.');
  }
  
  locations.forEach((loc, index) => {
    if (!loc.query.trim()) {
      errors.push(`Location ${index + 1}: Name/query is required.`);
    }
    if (loc.radius_meters !== undefined && (loc.radius_meters < 0 || loc.radius_meters > 50000)) {
      errors.push(`Location ${index + 1}: Radius must be between 0 and 50km.`);
    }
  });
  
  return errors;
}

// ============================================================
// Message Type Indicators
// ============================================================

export type MessageType = 'template' | 'session';

export interface MessageTypeInfo {
  type: MessageType;
  label: string;
  description: string;
  cost_info: string;
}

export const MESSAGE_TYPE_INFO: Record<MessageType, MessageTypeInfo> = {
  template: {
    type: 'template',
    label: 'Template Message',
    description: 'Pre-approved message templates that can be sent outside the 24-hour window.',
    cost_info: 'Template messages incur per-message costs based on conversation type and country.',
  },
  session: {
    type: 'session',
    label: 'Session Message',
    description: 'Free-form messages within the 24-hour customer service window.',
    cost_info: 'Free within 24 hours of customer-initiated conversation.',
  },
};

// ============================================================
// Error Types
// ============================================================

export interface ApiError {
  status?: number;
  message?: string;
  error?: string;
}

export function isApiError(err: unknown): err is ApiError {
  return typeof err === 'object' && err !== null && ('status' in err || 'message' in err);
}

export function getErrorMessage(err: unknown): string {
  if (isApiError(err)) {
    return err.message || err.error || 'An unknown error occurred';
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'An unknown error occurred';
}
