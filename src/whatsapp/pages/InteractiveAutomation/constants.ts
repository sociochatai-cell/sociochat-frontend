/**
 * Interactive Automation Flow Builder - Constants
 * ================================================
 * Default values, limits, and configuration for the flow builder.
 */

import type {
    TriggerNode,
    MessageNode,
    TemplateNode,
    EndNode,
    AutomationFlow,
    TriggerConfig
} from './types';

// =============================================================================
// LIMITS (Based on WhatsApp Business API constraints)
// =============================================================================

export const LIMITS = {
    // Button limits
    MAX_BUTTONS_PER_MESSAGE: 3,
    MAX_BUTTON_LABEL_LENGTH: 20,

    // Message limits
    MAX_HEADER_LENGTH: 60,
    MAX_BODY_LENGTH: 1024,
    MAX_FOOTER_LENGTH: 60,

    // Flow limits
    MAX_NODES: 50,
    MAX_DEPTH: 10, // Maximum nesting depth

    // Name limits
    MAX_FLOW_NAME_LENGTH: 100,
    MAX_DESCRIPTION_LENGTH: 500,
} as const;

// =============================================================================
// NODE DIMENSIONS
// =============================================================================

export const NODE_DIMENSIONS = {
    trigger: { width: 280, height: 120 },
    message: { width: 320, height: 200 },
    template: { width: 320, height: 220 },
    end: { width: 240, height: 100 },
} as const;

// =============================================================================
// INITIAL POSITIONS
// =============================================================================

export const INITIAL_POSITIONS = {
    trigger: { x: 250, y: 50 },
    firstMessage: { x: 250, y: 220 },
} as const;

// =============================================================================
// DEFAULT VALUES
// =============================================================================

export const DEFAULT_TRIGGER: TriggerConfig = {
    type: 'any_reply',
    enabled: true,
};

export const createDefaultTriggerNode = (): TriggerNode => ({
    id: 'trigger-1',
    type: 'trigger',
    position: INITIAL_POSITIONS.trigger,
    data: {
        triggerType: 'any_reply',
    },
});

export const createDefaultMessageNode = (
    id: string,
    position: { x: number; y: number }
): MessageNode => ({
    id,
    type: 'message',
    position,
    data: {
        body: 'Does this answer your question?',
        buttons: [
            {
                id: `${id}-btn-1`,
                label: 'Yes, thank you!',
                action: { type: 'quick_reply', targetNodeId: null },
            },
            {
                id: `${id}-btn-2`,
                label: 'Nope, I need help',
                action: { type: 'quick_reply', targetNodeId: null },
            },
        ],
    },
});

export const createDefaultEndNode = (
    id: string,
    position: { x: number; y: number }
): EndNode => ({
    id,
    type: 'end',
    position,
    data: {
        message: 'Thank you for contacting us!',
    },
});

export const createEmptyFlow = (
    accountId: number,
    workspaceId: string
): AutomationFlow => ({
    name: 'New Automation',
    accountId,
    workspaceId,
    nodes: [createDefaultTriggerNode()],
    edges: [],
    trigger: DEFAULT_TRIGGER,
    status: 'draft',
});

// =============================================================================
// COLORS
// =============================================================================

export const NODE_COLORS = {
    trigger: {
        bg: '#EEF2FF', // indigo-100
        border: '#6366F1', // indigo-500
        text: '#4338CA', // indigo-700
    },
    message: {
        bg: '#ECFDF5', // green-50
        border: '#10B981', // green-500
        text: '#065F46', // green-800
    },
    template: {
        bg: '#EFF6FF', // blue-50
        border: '#3B82F6', // blue-500
        text: '#1E40AF', // blue-800
    },
    end: {
        bg: '#FEF3C7', // amber-100
        border: '#F59E0B', // amber-500
        text: '#92400E', // amber-800
    },
} as const;

export const EDGE_COLORS = {
    default: '#94A3B8', // slate-400
    selected: '#10B981', // green-500
    animated: '#6366F1', // indigo-500
} as const;

// =============================================================================
// BUTTON ACTION LABELS
// =============================================================================

export const BUTTON_ACTION_LABELS = {
    quick_reply: 'Navigate to message',
    url: 'Open URL',
    call: 'Call phone number',
    location: 'Request location',
    catalog: 'Show catalog',
    product_list: 'Show products',
    template_button: 'Template quick reply',
} as const;


// =============================================================================
// TRIGGER TYPE LABELS
// =============================================================================

export const TRIGGER_TYPE_LABELS = {
    any_reply: 'When customer sends any message',
    specific_template: 'When customer replies to a template',
    window_open: 'When 24-hour window opens',
    keyword: 'When message contains keywords',
} as const;
