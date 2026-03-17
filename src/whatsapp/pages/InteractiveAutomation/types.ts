/**
 * Interactive Automation Flow Builder - Types
 * ============================================
 * TypeScript interfaces for the visual flow builder.
 * Supports WhatsApp interactive messages with branching logic.
 */

// =============================================================================
// BUTTON TYPES
// =============================================================================

export type ButtonActionType =
    | 'quick_reply'
    | 'url'
    | 'call'
    | 'location'
    | 'catalog'
    | 'product_list';

export interface QuickReplyAction {
    type: 'quick_reply';
    targetNodeId: string | null; // The node this button leads to
}

export interface UrlAction {
    type: 'url';
    url: string;
}

export interface CallAction {
    type: 'call';
    phoneNumber: string;
}

export interface LocationAction {
    type: 'location';
    // Location is sent by user, no additional config needed
}

export interface CatalogAction {
    type: 'catalog';
    catalogId?: string;
}

export interface ProductListAction {
    type: 'product_list';
    productIds?: string[];
}

export type ButtonAction =
    | QuickReplyAction
    | UrlAction
    | CallAction
    | LocationAction
    | CatalogAction
    | ProductListAction;


export interface MessageButton {
    id: string;
    label: string; // Max 20 characters for WhatsApp
    action: ButtonAction;
}

// =============================================================================
// NODE TYPES
// =============================================================================

export type NodeType = 'trigger' | 'message' | 'template' | 'end';

export interface Position {
    x: number;
    y: number;
}

// Base node interface
export interface BaseNode {
    id: string;
    type: NodeType;
    position: Position;
}

// Trigger node - entry point of the automation
export interface TriggerNode extends BaseNode {
    type: 'trigger';
    data: {
        triggerType: TriggerType;
        templateId?: string; // If trigger is "specific_template"
        keywords?: string[]; // Optional keyword triggers
    };
}

// Message node - interactive message with buttons
export interface MessageNode extends BaseNode {
    type: 'message';
    data: {
        header?: string; // Optional header text
        body: string; // Main message body (required)
        footer?: string; // Optional footer text
        buttons: MessageButton[]; // Max 3 buttons
    };
}

// End node - terminal point of a conversation branch
export interface EndNode extends BaseNode {
    type: 'end';
    data: {
        message?: string; // Optional final message
        showSatisfactionSurvey?: boolean;
    };
}

export type FlowNode = TriggerNode | MessageNode | TemplateNode | EndNode;

// Template button definition (from Meta-approved template)
export interface TemplateButton {
    index: number;
    text: string;               // Button label from the template
    handleId: string;           // Handle ID for edge mapping
    payload?: string;           // Payload sent to Meta
}

// Template node - sends an approved WhatsApp template
export interface TemplateNode extends BaseNode {
    type: 'template';
    data: {
        templateId: number;         // Local DB template ID
        templateName: string;       // e.g., "order_confirmation"
        languageCode: string;       // e.g., "en_US"
        category: string;           // UTILITY, MARKETING
        headerText?: string;        // For preview
        bodyText?: string;          // Template body for preview
        footerText?: string;        // For preview
        buttons: TemplateButton[];  // Quick reply buttons from the template
        variableCount: number;      // Number of body variables
        bodyParams?: string[];      // Variable values (optional)
        headerTextVar?: string;     // Header variable (optional)
        headerImageUrl?: string;    // Header image URL (optional)
    };
}

// =============================================================================
// EDGE (CONNECTION) TYPES
// =============================================================================

export interface FlowEdge {
    id: string;
    source: string; // Source node ID
    sourceHandle: string; // Button ID or 'output' for trigger/end
    target: string; // Target node ID
    targetHandle: string; // Usually 'input'
    animated?: boolean;
    style?: Record<string, any>;
}

// =============================================================================
// TRIGGER CONFIGURATION
// =============================================================================

export type TriggerType =
    | 'any_reply' // Trigger when customer sends any message
    | 'specific_template' // Trigger when customer replies to specific template
    | 'window_open' // Trigger when 24-hour window opens
    | 'keyword'; // Trigger on specific keywords

export interface TriggerConfig {
    type: TriggerType;
    templateId?: string;
    keywords?: string[];
    enabled: boolean;
}

// =============================================================================
// AUTOMATION FLOW
// =============================================================================

export type FlowStatus = 'draft' | 'published' | 'paused' | 'archived';

export interface AutomationFlow {
    id?: number;
    name: string;
    description?: string;
    accountId: number;
    workspaceId: string;

    // Flow configuration
    nodes: FlowNode[];
    edges: FlowEdge[];
    trigger: TriggerConfig;

    // Metadata
    status: FlowStatus;
    createdAt?: string;
    updatedAt?: string;
    publishedAt?: string;

    // Stats
    triggerCount?: number;
    lastTriggeredAt?: string;
}

// =============================================================================
// VALIDATION
// =============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
    severity: ValidationSeverity;
    nodeId?: string;
    buttonId?: string;
    message: string;
    autoFixable: boolean;
}

// =============================================================================
// UI STATE
// =============================================================================

export interface FlowBuilderState {
    flow: AutomationFlow;
    selectedNodeId: string | null;
    isDirty: boolean;
    isSaving: boolean;
    isPublishing: boolean;
    validationIssues: ValidationIssue[];
    showTriggerConfig: boolean;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface SaveFlowRequest {
    name: string;
    description?: string;
    account_id: number;
    workspace_id: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    trigger: TriggerConfig;
}

export interface SaveFlowResponse {
    success: boolean;
    flow?: {
        id: number;
        name: string;
        status: FlowStatus;
        created_at: string;
        updated_at?: string;
    };
    error?: string;
    issues?: ValidationIssue[];
}

export interface PublishFlowResponse {
    success: boolean;
    flow?: {
        id: number;
        status: FlowStatus;
        published_at: string;
    };
    error?: string;
}
