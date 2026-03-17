/**
 * FlowBuilderV2 Types
 * ==================
 * User-friendly types that hide Meta complexity.
 * Visual model → Meta JSON transformation is internal.
 */

// =============================================================================
// VISUAL MODEL (What users see and edit)
// =============================================================================

export type FlowCategory = 'leads' | 'booking' | 'feedback' | 'support' | 'custom';

export type FieldType = 
  | 'text' 
  | 'email' 
  | 'phone' 
  | 'number' 
  | 'textarea' 
  | 'dropdown' 
  | 'radio' 
  | 'checkbox' 
  | 'date';

export interface Field {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // For dropdown/radio/checkbox
}

export interface StepButton {
  label: string;
  goesToStepId: string | null; // null = auto-link to next OR final step
}

export interface Step {
  id: string;
  title: string;
  message?: string;
  fields: Field[];
  button: StepButton;
  isFinal: boolean;
}

export interface FlowBuilderState {
  id?: number;
  name: string;
  category: FlowCategory;
  steps: Step[];
  selectedStepId: string | null;
  isDirty: boolean;
  status: 'draft' | 'published' | 'deprecated';
  metaFlowId?: string;
  accountId?: number;
}

export interface ValidationHint {
  type: 'error' | 'warning' | 'info';
  stepId?: string;
  fieldId?: string;
  message: string;
  autoFixable: boolean;
  fixAction?: string;
}

// =============================================================================
// TEMPLATES
// =============================================================================

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: FlowCategory;
  steps: Omit<Step, 'id'>[];
}

// =============================================================================
// META FLOW JSON (Internal - never shown to users)
// =============================================================================

export interface MetaFlowJSON {
  version: string;
  data_api_version?: string;
  screens: MetaScreen[];
  routing_model: Record<string, string[]>;
}

export interface MetaScreen {
  id: string;
  title: string;
  terminal?: boolean;
  success?: boolean;
  data?: Record<string, { type: string; __example__?: string }>;
  layout: {
    type: string;
    children: MetaComponent[];
  };
}

export interface MetaComponent {
  type: string;
  text?: string;
  name?: string;
  label?: string;
  required?: boolean;
  'input-type'?: string;
  'data-source'?: Array<{ id: string; title: string }>;
  'on-click-action'?: {
    name: string;
    next?: { type: string; name: string };
    payload?: Record<string, string>;
  };
  children?: MetaComponent[];
}

// =============================================================================
// API TYPES
// =============================================================================

export interface FlowApiRequest {
  workspace_id?: string;
  account_id?: number;
  name: string;
  category: FlowCategory;
  steps: Step[];
}

export interface FlowApiResponse {
  success: boolean;
  flow?: {
    id: number;
    name: string;
    status: string;
    meta_flow_id?: string;
    created_at: string;
    updated_at?: string;
    published_at?: string;
  };
  error?: string;
  issues?: ValidationHint[];
}

// =============================================================================
// DRAG & DROP
// =============================================================================

export type DragItemType = 'block' | 'field' | 'step';

export interface DragItem {
  type: DragItemType;
  data: {
    fieldType?: FieldType;
    fieldId?: string;
    stepId?: string;
  };
}

export interface DropResult {
  targetStepId?: string;
  targetIndex?: number;
  targetType: 'step' | 'field-list' | 'canvas';
}

// =============================================================================
// UI STATE
// =============================================================================

export interface PreviewState {
  currentStepIndex: number;
  formData: Record<string, string>;
}

export type BuilderView = 'canvas' | 'preview' | 'settings';
