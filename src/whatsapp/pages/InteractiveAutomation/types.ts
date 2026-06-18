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
    | 'product_list'
    | 'send_document'; // Send PDF/document when button is clicked

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

// Send document action - sends a file when button is clicked
export interface SendDocumentAction {
    type: 'send_document';
    documentUrl: string; // URL of the document in DigitalOcean Spaces
    documentFilename?: string; // Display filename
    documentCaption?: string; // Optional caption text
}

export type ButtonAction =
    | QuickReplyAction
    | UrlAction
    | CallAction
    | LocationAction
    | CatalogAction
    | ProductListAction
    | SendDocumentAction;


export interface MessageButton {
    id: string;
    label: string; // Max 20 characters for WhatsApp
    action: ButtonAction;
}

// =============================================================================
// NODE TYPES
// =============================================================================

export type NodeType = 'trigger' | 'message' | 'template' | 'end' | 'input' | 'api';

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
        firstMessageOnly?: boolean; // If true, only trigger on first message from customer
        oneTimeOnly?: boolean; // If true, trigger only once per customer per automation
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

// =============================================================================
// INPUT NODE
// =============================================================================

// Input node - captures free-text user response
export type ValidationType = 'text' | 'number' | 'email' | 'phone' | 'regex' | 'enum' | 'pincode';

export interface InputNode extends BaseNode {
    type: 'input';
    data: {
        body: string; // The question to ask the user
        field: string; // The key to store the answer (e.g., 'name', 'age')
        validationType: ValidationType;

        // Validation constraints
        minLength?: number;
        maxLength?: number;
        minValue?: number;
        maxValue?: number;
        regexPattern?: string;
        enumValues?: string[]; // List of allowed options

        errorMessage?: string; // Custom error message

        targetNodeId: string | null; // Next node after successful input
    };
}

// =============================================================================
// API NODE
// =============================================================================

export interface ApiKeyValue {
    key: string;
    value: string;
    enabled?: boolean;
}

export interface FlowConfig {
    variableDefaults?: Record<string, string>;
    buttonCaptureRules?: unknown[];
}

export interface ApiButtonCaptureRule {
    matchType?: 'uuid' | 'exact' | 'regex' | 'any';
    field?: string;
    value?: string;
    setValue?: string;
    pattern?: string;
    valueFrom?: 'button_id';
}

export interface ApiBranchRule {
    id: string;
    path?: string;
    operator?: 'equals' | 'not_equals' | 'contains' | 'exists' | 'not_exists' | 'gt' | 'lt';
    value?: string;
}

export interface ApiNode extends BaseNode {
    type: 'api';
    data: {
        label?: string;
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
        url: string;
        headers?: ApiKeyValue[];
        queryParams?: ApiKeyValue[];
        bodyType?: 'none' | 'json' | 'form';
        body?: string;
        timeoutSec?: number;
        responseFormat?: 'auto' | 'json' | 'text' | 'xml';
        storeAs?: string;
        branches?: ApiBranchRule[];
        output?: {
            onSuccess?: {
                mode?: 'auto' | 'text' | 'image' | 'document' | 'buttons' | 'raw';
                textPath?: string;
                imagePath?: string;
                documentPath?: string;
                captionPath?: string;
                documentFilenamePath?: string;
                buttonsPath?: string;
                fallbackText?: string;
                text?: string;
            };
            onError?: { text?: string };
        };
        buttonCapture?: ApiButtonCaptureRule[];
    };
}

export type FlowNode = TriggerNode | MessageNode | TemplateNode | EndNode | InputNode | ApiNode;

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
    variables?: Record<string, string>;
    flowConfig?: FlowConfig;

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
    handleId?: string;
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
    variables?: Record<string, string>;
    flow_config?: FlowConfig;
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
