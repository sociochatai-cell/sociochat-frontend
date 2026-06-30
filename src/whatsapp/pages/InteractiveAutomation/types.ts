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
// LEAD ACTION (per-node "Mark as lead" config)
// =============================================================================

export type LeadActionOperator =
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'exists'
    | 'not_exists'
    | 'gt'
    | 'lt'
    | 'regex'
    | 'any';

export interface LeadActionCondition {
    source?: 'response' | 'field' | 'apiPath';
    path?: string;
    operator: LeadActionOperator;
    value?: string;
}

export interface LeadActionFieldMap {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
}

export interface LeadAction {
    enabled: boolean;
    condition?: LeadActionCondition;
    leadType?: string;
    stage?: string;
    mapFields?: LeadActionFieldMap;
}

// =============================================================================
// NODE TYPES
// =============================================================================

export type NodeType = 'trigger' | 'message' | 'template' | 'end' | 'input' | 'api' | 'lead';

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

// List section and row types for interactive messages
export interface ListRow {
    id: string;
    title: string;
    description?: string;
}

export interface ListSection {
    title: string;
    rows: ListRow[];
}

// Message node - interactive message with buttons or list
export interface MessageNode extends BaseNode {
    type: 'message';
    data: {
        interactiveType?: 'button' | 'list'; // Default to 'button'
        header?: string; // Optional header text
        headerType?: 'text' | 'image' | 'video' | 'document'; // Type of header content
        headerImageUrl?: string; // Image URL for header
        headerVideoUrl?: string; // Video URL for header
        headerDocumentUrl?: string; // Document URL for header
        headerDocumentFilename?: string; // Filename for document header
        body: string; // Main message body (required)
        footer?: string; // Optional footer text
        
        // For 'button' type
        buttons: MessageButton[]; // Max 3 buttons
        
        // For 'list' type
        buttonText?: string; // The text on the List CTA button
        sections?: ListSection[]; // Max 10 sections

        // Optional "Mark as lead" action evaluated when this node runs
        leadAction?: LeadAction;
    };
}

// Template button mapping for flow routing
export interface TemplateButtonMapping {
    buttonIndex: number; // Index of the button in template (0, 1, 2)
    buttonText: string; // Text of the button for display
    buttonType: 'quick_reply' | 'flow' | 'url' | 'phone'; // Type of template button
    targetNodeId: string | null; // Target node for quick_reply buttons
}

// Template node - uses existing WhatsApp template
export interface TemplateNode extends BaseNode {
    type: 'template';
    data: {
        templateId?: number; // ID of the selected template
        templateName?: string; // Name of the template for display
        templateLanguage?: string; // e.g., 'en_US'
        templateCategory?: string; // MARKETING, UTILITY, etc.
        templateStatus?: string; // APPROVED, PENDING, etc.
        // Quick reply button mappings (only quick_reply buttons can route)
        buttonMappings: TemplateButtonMapping[];
        // Variable values for template placeholders
        variables?: Record<string, string>;
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

        // Optional "Mark as lead" action evaluated when this node captures input
        leadAction?: LeadAction;
    };
}

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

        // Optional "Mark as lead" action evaluated against the API response
        leadAction?: LeadAction;
    };
}

// Lead node - a dedicated step whose sole purpose is to create/update a CRM
// lead. Unlike the inline LeadAction toggle on other nodes, this node IS the
// action, so it has no `enabled` flag. An optional condition can still gate it.
export interface LeadNode extends BaseNode {
    type: 'lead';
    data: {
        label?: string; // Optional display label
        stage?: string; // Pipeline stage key
        leadType?: string; // CRM lead type key
        mapFields?: LeadActionFieldMap; // Source values / paths to copy onto the lead
        condition?: LeadActionCondition; // Optional gate; default = always
    };
}

export type FlowNode = TriggerNode | MessageNode | TemplateNode | EndNode | InputNode | ApiNode | LeadNode;

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

export type FlowStatus = 'draft' | 'published' | 'active' | 'paused' | 'archived';

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
