/**
 * Interactive Automation Flow Builder - Utilities
 * ================================================
 * Helper functions for the flow builder.
 */

import type {
    FlowNode,
    FlowEdge,
    AutomationFlow,
    ValidationIssue,
    MessageNode,
    TemplateNode,
    TriggerNode,
    EndNode,
    InputNode,
    ApiNode,
    LeadNode,
    SetStatusNode,
    MessageButton
} from './types';
import { LIMITS, NODE_DIMENSIONS } from './constants';

// =============================================================================
// ID GENERATION
// =============================================================================

let idCounter = 0;

/**
 * Generate a unique ID for nodes/buttons
 * Uses a counter + timestamp for uniqueness
 */
export const generateId = (prefix: string = 'node'): string => {
    idCounter++;
    return `${prefix}_${Date.now()}_${idCounter}`;
};

/**
 * Generate a button ID based on node ID
 */
export const generateButtonId = (nodeId: string, index: number): string => {
    return `${nodeId}_btn_${index}`;
};

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Calculate the maximum depth of the flow from a starting node
 */
const calculateMaxDepth = (
    nodeId: string,
    edges: FlowEdge[],
    visited: Set<string>
): number => {
    // Avoid checking cycles
    if (visited.has(nodeId)) return 0;

    // Create new set for current path to allow diamond patterns but stop cycles
    const currentPath = new Set(visited);
    currentPath.add(nodeId);

    const outgoingEdges = edges.filter(e => e.source === nodeId);

    if (outgoingEdges.length === 0) {
        return 1;
    }

    const childDepths = outgoingEdges.map(edge =>
        calculateMaxDepth(edge.target, edges, currentPath)
    );

    return 1 + Math.max(0, ...childDepths);
};

/**
 * Traverse connections from a node to find all connected nodes
 */
const traverseConnections = (
    nodeId: string,
    edges: FlowEdge[],
    visited: Set<string>
): void => {
    const outgoingEdges = edges.filter(e => e.source === nodeId);
    outgoingEdges.forEach(edge => {
        if (!visited.has(edge.target)) {
            visited.add(edge.target);
            traverseConnections(edge.target, edges, visited);
        }
    });
};

/**
 * Validate the entire flow and return issues
 */
export const validateFlow = (flow: AutomationFlow): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    // Check flow name
    if (!flow.name.trim()) {
        issues.push({
            severity: 'error',
            message: 'Flow name is required',
            autoFixable: false,
        });
    }

    if (flow.name.length > LIMITS.MAX_FLOW_NAME_LENGTH) {
        issues.push({
            severity: 'error',
            message: `Flow name must be ${LIMITS.MAX_FLOW_NAME_LENGTH} characters or less`,
            autoFixable: true,
        });
    }

    // Check for trigger node
    const triggerNodes = flow.nodes.filter(n => n.type === 'trigger');
    if (triggerNodes.length === 0) {
        issues.push({
            severity: 'error',
            message: 'Flow must have a trigger node',
            autoFixable: true,
        });
    }
    if (triggerNodes.length > 1) {
        issues.push({
            severity: 'error',
            message: 'Flow can only have one trigger node',
            autoFixable: false,
        });
    }

    // Check message nodes
    const messageNodes = flow.nodes.filter(n => n.type === 'message') as MessageNode[];
    messageNodes.forEach(node => {
        // Check body
        if (!node.data.body.trim()) {
            issues.push({
                severity: 'error',
                nodeId: node.id,
                message: 'Message body is required',
                autoFixable: false,
            });
        }

        if (node.data.body.length > LIMITS.MAX_BODY_LENGTH) {
            issues.push({
                severity: 'error',
                nodeId: node.id,
                message: `Message body must be ${LIMITS.MAX_BODY_LENGTH} characters or less`,
                autoFixable: true,
            });
        }

        // Check header
        if (node.data.header && node.data.header.length > LIMITS.MAX_HEADER_LENGTH) {
            issues.push({
                severity: 'warning',
                nodeId: node.id,
                message: `Header will be truncated to ${LIMITS.MAX_HEADER_LENGTH} characters`,
                autoFixable: true,
            });
        }

        // Check buttons — ONLY for button-type messages. A list message uses rows
        // (validated below) and may carry leftover/"ghost" buttons in node.data.buttons
        // from before it was switched to a list. Those buttons are invisible/uneditable
        // in the list editor, so validating them would raise an unfixable
        // "Button label is required" that blocks publish forever.
        if (node.data.interactiveType !== 'list') {
        if (node.data.buttons.length === 0) {
            issues.push({
                severity: 'warning',
                nodeId: node.id,
                message: 'Message has no buttons - consider adding response options',
                autoFixable: false,
            });
        }

        node.data.buttons.forEach(button => {
            if (!button.label.trim()) {
                issues.push({
                    severity: 'error',
                    nodeId: node.id,
                    buttonId: button.id,
                    message: 'Button label is required',
                    autoFixable: false,
                });
            }

            if (button.label.length > LIMITS.MAX_BUTTON_LABEL_LENGTH) {
                issues.push({
                    severity: 'error',
                    nodeId: node.id,
                    buttonId: button.id,
                    message: `Button label must be ${LIMITS.MAX_BUTTON_LABEL_LENGTH} characters or less`,
                    autoFixable: true,
                });
            }

            if (button.action.type === 'quick_reply' && !button.action.targetNodeId) {
                const hasEdge = flow.edges.some(
                    e => e.source === node.id && e.sourceHandle === button.id
                );
                if (!hasEdge) {
                    issues.push({
                        severity: 'warning',
                        nodeId: node.id,
                        buttonId: button.id,
                        handleId: button.id,
                        message: 'Button is not connected to any message',
                        autoFixable: false,
                    });
                }
            }

            if (button.action.type === 'url' && !button.action.url) {
                issues.push({
                    severity: 'error',
                    nodeId: node.id,
                    buttonId: button.id,
                    message: 'URL is required for URL buttons',
                    autoFixable: false,
                });
            }

            if (button.action.type === 'call' && !button.action.phoneNumber) {
                issues.push({
                    severity: 'error',
                    nodeId: node.id,
                    buttonId: button.id,
                    message: 'Phone number is required for call buttons',
                    autoFixable: false,
                });
            }
        });
        } // end: button validation skipped for list-type messages

        // Check for unconnected list rows if interactive type is list
        if (node.data.interactiveType === 'list') {
            (node.data.sections || []).forEach((section: any) => {
                (section.rows || []).forEach((row: any) => {
                    if (!row.targetNodeId) {
                        issues.push({
                            severity: 'warning',
                            nodeId: node.id,
                            handleId: row.id,
                            message: `List row '${row.title}' is not connected`,
                            autoFixable: false,
                        });
                    }
                });
            });
        }

    });

    // Check input nodes
    const inputNodes = flow.nodes.filter(n => n.type === 'input') as InputNode[];
    inputNodes.forEach(node => {
        if (!node.data.body.trim()) {
            issues.push({
                severity: 'error',
                nodeId: node.id,
                message: 'Question body is required',
                autoFixable: false,
            });
        }
        if (!node.data.field.trim()) {
            issues.push({
                severity: 'error',
                nodeId: node.id,
                message: 'Save field name is required',
                autoFixable: false,
            });
        }
        if (!node.data.targetNodeId) {
            issues.push({
                severity: 'warning',
                nodeId: node.id,
                handleId: 'output',
                message: 'Input node is not connected to a next step',
                autoFixable: false,
            });
        }
    });

    const placeholderRe = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
    const collectPlaceholders = (text: string | undefined): string[] => {
        if (!text) return [];
        const found: string[] = [];
        let m: RegExpExecArray | null;
        const re = new RegExp(placeholderRe.source, 'g');
        while ((m = re.exec(text)) !== null) {
            found.push(m[1]);
        }
        return found;
    };
    const apiNodes = flow.nodes.filter(n => n.type === 'api') as ApiNode[];
    const collectedFields = new Set<string>();
    inputNodes.forEach(node => {
        if (node.data.field?.trim()) {
            collectedFields.add(node.data.field.trim());
        }
    });
    apiNodes.forEach(node => {
        (node.data.buttonCapture || []).forEach(rule => {
            if (rule.field?.trim()) {
                collectedFields.add(rule.field.trim());
            }
        });
    });
    Object.keys(flow.flowConfig?.variableDefaults || {}).forEach(k => collectedFields.add(k));

    const runtimeVars = new Set([
        'phone',
        'contact_name',
        'name',
        'customer_name',
        'last_button_clicked',
        ...collectedFields,
    ]);
    const flowVarKeys = new Set(Object.keys(flow.variables || {}));

    const apiNodeOutgoingOk = (nodeId: string, branches: ApiNode['data']['branches']) => {
        const handles = flow.edges
            .filter(e => e.source === nodeId)
            .map(e => e.sourceHandle || '');
        const okHandles = new Set(['success', 'output', 'default', 'error', 'router']);
        if (handles.some(h => okHandles.has(h))) return true;
        return (branches || []).some(b =>
            handles.includes(`branch-${b.id}`)
        );
    };

    apiNodes.forEach(node => {
        if (!node.data.url?.trim()) {
            issues.push({
                severity: 'error',
                nodeId: node.id,
                message: 'API URL is required',
                autoFixable: false,
            });
        }

        const apiText = [
            node.data.url,
            node.data.body,
            ...(node.data.headers || []).flatMap(h => [h.key, h.value]),
            ...(node.data.queryParams || []).flatMap(q => [q.key, q.value]),
        ].join('\n');
        for (const key of collectPlaceholders(apiText)) {
            if (runtimeVars.has(key)) continue;
            const val = flow.variables?.[key];
            if (!flowVarKeys.has(key) || !val || val === '***') {
                issues.push({
                    severity: 'warning',
                    nodeId: node.id,
                    message: `Set flow variable "${key}" via Flow variables (toolbar) — used in this API node`,
                    autoFixable: false,
                });
                break;
            }
        }
        if (!apiNodeOutgoingOk(node.id, node.data.branches)) {
            issues.push({
                severity: 'warning',
                nodeId: node.id,
                message: 'Connect success, error, or branch output from this API node',
                autoFixable: false,
            });
        }
    });

    // Check if trigger node is connected (at least one outgoing edge)
    triggerNodes.forEach((node) => {
        const hasOutgoingEdge = flow.edges.some(e => e.source === node.id);
        if (!hasOutgoingEdge) {
            issues.push({
                severity: 'error',
                nodeId: node.id,
                message: 'Trigger must be connected to a message or node',
                autoFixable: false,
            });
        }
    });

    // Check template button mappings
    const templateNodes = flow.nodes.filter(n => n.type === 'template') as TemplateNode[];
    templateNodes.forEach((node) => {
        const data = node.data as any;
        (data.buttonMappings || []).forEach((mapping: any, idx: number) => {
            if ((mapping.buttonType === 'quick_reply' || mapping.buttonType === 'flow') && !mapping.targetNodeId) {
                issues.push({
                    severity: 'warning',
                    nodeId: node.id,
                    handleId: `btn-${idx}`,
                    message: `Template button '${mapping.buttonText}' is not connected`,
                    autoFixable: false,
                });
            }
        });
    });

    // Check for orphan nodes (nodes not connected to trigger)
    const connectedNodeIds = new Set<string>();
    const triggerNode = triggerNodes[0];
    if (triggerNode) {
        connectedNodeIds.add(triggerNode.id);
        traverseConnections(triggerNode.id, flow.edges, connectedNodeIds);
    }

    flow.nodes.forEach(node => {
        if ((node.data as { internalRouter?: boolean })?.internalRouter) {
            return;
        }
        // Don't warn about terminal nodes (End / Lead) that aren't wired in — they
        // just never run if nothing reaches them, so the "not connected" warning is
        // noise, not a real error.
        if (node.type === 'end' || node.type === 'lead') {
            return;
        }
        if (!connectedNodeIds.has(node.id) && node.type !== 'trigger') {
            issues.push({
                severity: 'warning',
                nodeId: node.id,
                message: 'This node is not connected to the flow',
                autoFixable: false,
            });
        }
    });

    // Check max depth
    if (triggerNode) {
        const maxDepth = calculateMaxDepth(triggerNode.id, flow.edges, new Set());
        if (maxDepth > LIMITS.MAX_DEPTH) {
            issues.push({
                severity: 'error',
                message: `Flow depth exceeds limit of ${LIMITS.MAX_DEPTH}`,
                autoFixable: false,
            });
        }
    }

    // Check max nodes
    if (flow.nodes.length > LIMITS.MAX_NODES) {
        issues.push({
            severity: 'error',
            message: `Flow cannot have more than ${LIMITS.MAX_NODES} nodes`,
            autoFixable: false,
        });
    }

    return issues;
};

/**
 * Check if flow has any blocking errors
 */
export const hasErrors = (issues: ValidationIssue[]): boolean => {
    return issues.some(issue => issue.severity === 'error');
};

// =============================================================================
// FLOW OPERATIONS
// =============================================================================

/**
 * Add a new message node to the flow
 */
export const addMessageNode = (
    flow: AutomationFlow,
    position?: { x: number; y: number }
): AutomationFlow => {
    const nodeId = generateId('msg');
    const newPosition = position || calculateNextPosition(flow.nodes);

    const newNode: MessageNode = {
        id: nodeId,
        type: 'message',
        position: newPosition,
        data: {
            body: 'Does this answer your question?',
            buttons: [
                {
                    id: generateButtonId(nodeId, 0),
                    label: 'Yes, thank you!',
                    action: { type: 'quick_reply', targetNodeId: null },
                },
                {
                    id: generateButtonId(nodeId, 1),
                    label: 'Nope, I need help',
                    action: { type: 'quick_reply', targetNodeId: null },
                },
            ],
        },
    };

    return {
        ...flow,
        nodes: [...flow.nodes, newNode],
    };
};

/**
 * Add a new end node to the flow
 */
export const addEndNode = (
    flow: AutomationFlow,
    position?: { x: number; y: number }
): AutomationFlow => {
    const nodeId = generateId('end');
    const newPosition = position || calculateNextPosition(flow.nodes);

    const newNode: EndNode = {
        id: nodeId,
        type: 'end',
        position: newPosition,
        data: {
            message: 'Thank you for contacting us!',
        },
    };

    return {
        ...flow,
        nodes: [...flow.nodes, newNode],
    };
};

/**
 * Add a new template node to the flow
 */
export const addTemplateNode = (
    flow: AutomationFlow,
    position?: { x: number; y: number }
): AutomationFlow => {
    const nodeId = generateId('tpl');
    const newPosition = position || calculateNextPosition(flow.nodes);

    const newNode: TemplateNode = {
        id: nodeId,
        type: 'template',
        position: newPosition,
        data: {
            buttonMappings: [],
        },
    };

    return {
        ...flow,
        nodes: [...flow.nodes, newNode],
    };
};

/**
 * Add a new input node to the flow
 */
export const addInputNode = (
    flow: AutomationFlow,
    position?: { x: number; y: number }
): AutomationFlow => {
    const nodeId = generateId('input');
    const newPosition = position || calculateNextPosition(flow.nodes);

    const newNode: InputNode = {
        id: nodeId,
        type: 'input',
        position: newPosition,
        data: {
            body: 'Please enter your detail:',
            field: 'detail',
            validationType: 'text',
            targetNodeId: null,
        },
    };

    return {
        ...flow,
        nodes: [...flow.nodes, newNode],
    };
};

/**
 * Add a new API integration node to the flow
 */
export const addApiNode = (
    flow: AutomationFlow,
    position?: { x: number; y: number }
): AutomationFlow => {
    const nodeId = generateId('api');
    const newPosition = position || calculateNextPosition(flow.nodes);

    const newNode: ApiNode = {
        id: nodeId,
        type: 'api',
        position: newPosition,
        data: {
            label: 'External API',
            method: 'POST',
            url: 'https://api.example.com/lookup',
            bodyType: 'json',
            body: '{\n  "phone": "{{phone}}"\n}',
            timeoutSec: 15,
            responseFormat: 'auto',
            headers: [
                { key: 'Authorization', value: 'Bearer {{flow_api_token}}', enabled: true },
                { key: 'Content-Type', value: 'application/json', enabled: true },
            ],
            queryParams: [],
            branches: [],
            output: {
                onSuccess: {
                    mode: 'auto',
                    textPath: 'message',
                    buttonsPath: 'quickReplies',
                    fallbackText: 'Request completed.',
                },
                onError: {
                    text: 'We could not reach the service. Please try again later.',
                },
            },
        },
    };

    return {
        ...flow,
        nodes: [...flow.nodes, newNode],
    };
};

/**
 * Add a new lead ("Mark as Lead") node to the flow
 */
export const addLeadNode = (
    flow: AutomationFlow,
    position?: { x: number; y: number }
): AutomationFlow => {
    const nodeId = generateId('lead');
    const newPosition = position || calculateNextPosition(flow.nodes);

    const newNode: LeadNode = {
        id: nodeId,
        type: 'lead',
        position: newPosition,
        data: {
            label: 'Mark as Lead',
            condition: { source: 'response', operator: 'any' },
        },
    };

    return {
        ...flow,
        nodes: [...flow.nodes, newNode],
    };
};

/**
 * Add a new "Set Status" node (explicit CRM lead status: new/contacted/qualified/...)
 */
export const addSetStatusNode = (
    flow: AutomationFlow,
    position?: { x: number; y: number }
): AutomationFlow => {
    const nodeId = generateId('set_status');
    const newPosition = position || calculateNextPosition(flow.nodes);

    const newNode: SetStatusNode = {
        id: nodeId,
        type: 'set_status',
        position: newPosition,
        data: {
            status: 'qualified',
            mode: 'advance',
            targetNodeId: null,
        },
    };

    return {
        ...flow,
        nodes: [...flow.nodes, newNode],
    };
};

/**
 * Update a node in the flow
 */
export const updateNode = <T extends FlowNode>(
    flow: AutomationFlow,
    nodeId: string,
    updates: Partial<T['data']>
): AutomationFlow => {
    return {
        ...flow,
        nodes: flow.nodes.map(node => {
            if (node.id === nodeId) {
                return { ...node, data: { ...node.data, ...updates } } as FlowNode;
            }
            return node;
        }),
    };
};


/**
 * Delete a node from the flow
 */
export const deleteNode = (
    flow: AutomationFlow,
    nodeId: string
): AutomationFlow => {
    // Don't allow deleting trigger node
    const node = flow.nodes.find(n => n.id === nodeId);
    if (node?.type === 'trigger') {
        console.warn('Cannot delete trigger node');
        return flow;
    }

    return {
        ...flow,
        nodes: flow.nodes.filter(n => n.id !== nodeId),
        edges: flow.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    };
};

/**
 * Add an edge between nodes
 */
export const addEdge = (
    flow: AutomationFlow,
    source: string,
    sourceHandle: string,
    target: string
): AutomationFlow => {
    if (source === target) {
        return flow;
    }

    const edgeId = generateId('edge');
    const newEdge: FlowEdge = {
        id: edgeId,
        source,
        sourceHandle,
        target,
        targetHandle: 'input',
    };

    // Remove existing edge from same source handle
    const filteredEdges = flow.edges.filter(
        e => !(e.source === source && e.sourceHandle === sourceHandle)
    );
    const newEdges = [...filteredEdges, newEdge];

    // 3. Update Node Data (Buttons, List Rows, Template Mappings)
    const newNodes = flow.nodes.map(node => {
        if (node.id === source) {
            // Message Node
            if (node.type === 'message') {
                const messageNode = node as MessageNode;
                return {
                    ...messageNode,
                    data: {
                        ...messageNode.data,
                        buttons: (messageNode.data.buttons || []).map((btn: MessageButton) => {
                            if (btn.id === sourceHandle && btn.action.type === 'quick_reply') {
                                return { ...btn, action: { ...btn.action, targetNodeId: target } };
                            }
                            return btn;
                        }),
                        sections: (messageNode.data.sections || []).map((section: any) => ({
                            ...section,
                            rows: (section.rows || []).map((row: any) => {
                                if (row.id === sourceHandle) {
                                    return { ...row, targetNodeId: target };
                                }
                                return row;
                            })
                        }))
                    }
                } as FlowNode;
            }
            // Template Node
            if ((node.type as string) === 'template') {
                const templateNode = node as unknown as TemplateNode;
                return {
                    ...templateNode,
                    data: {
                        ...templateNode.data,
                        buttonMappings: (templateNode.data.buttonMappings || []).map((m: any, idx: number) => {
                            if (
                                `btn-${idx}` === sourceHandle &&
                                (m.buttonType === 'quick_reply' || m.buttonType === 'flow')
                            ) {
                                return { ...m, targetNodeId: target };
                            }
                            return m;
                        })
                    }
                } as unknown as FlowNode;
            }
            // Input Node
            if ((node.type as string) === 'input') {
                const inputNode = node as unknown as InputNode;
                return {
                    ...inputNode,
                    data: {
                        ...inputNode.data,
                        targetNodeId: sourceHandle === 'output' ? target : inputNode.data.targetNodeId,
                    }
                } as unknown as FlowNode;
            }
        }
        return node;
    });

    return {
        ...flow,
        edges: newEdges,
        nodes: newNodes,
    };
};

/**
 * Remove an edge from the flow
 */
export const removeEdge = (
    flow: AutomationFlow,
    edgeId: string
): AutomationFlow => {
    const edge = flow.edges.find(e => e.id === edgeId);
    if (!edge) return flow;

    const newEdges = flow.edges.filter(e => e.id !== edgeId);

    // Update Node Data
    const newNodes = flow.nodes.map(node => {
        if (node.id === edge.source) {
            // Message Node
            if (node.type === 'message') {
                const messageNode = node as MessageNode;
                return {
                    ...messageNode,
                    data: {
                        ...messageNode.data,
                        buttons: (messageNode.data.buttons || []).map((btn: MessageButton) => {
                            if (btn.id === edge.sourceHandle && btn.action.type === 'quick_reply') {
                                return { ...btn, action: { ...btn.action, targetNodeId: null } };
                            }
                            return btn;
                        }),
                        sections: (messageNode.data.sections || []).map((section: any) => ({
                            ...section,
                            rows: (section.rows || []).map((row: any) => {
                                if (row.id === edge.sourceHandle) {
                                    return { ...row, targetNodeId: null };
                                }
                                return row;
                            })
                        }))
                    }
                } as FlowNode;
            }
            // Template Node
            if ((node.type as string) === 'template') {
                const templateNode = node as unknown as TemplateNode;
                return {
                    ...templateNode,
                    data: {
                        ...templateNode.data,
                        buttonMappings: (templateNode.data.buttonMappings || []).map((m: any, idx: number) => {
                            if (
                                `btn-${idx}` === edge.sourceHandle &&
                                (m.buttonType === 'quick_reply' || m.buttonType === 'flow')
                            ) {
                                return { ...m, targetNodeId: null };
                            }
                            return m;
                        })
                    }
                } as unknown as FlowNode;
            }
            // Input Node
            if ((node.type as string) === 'input') {
                const inputNode = node as unknown as InputNode;
                return {
                    ...inputNode,
                    data: {
                        ...inputNode.data,
                        targetNodeId: edge.sourceHandle === 'output' ? null : inputNode.data.targetNodeId,
                    }
                } as unknown as FlowNode;
            }
        }
        return node;
    });

    return {
        ...flow,
        nodes: newNodes,
        edges: newEdges,
    };
};

/**
 * Synchronize edges list based on targetNodeId in node data
 */
export const syncEdgesFromNodes = (flow: AutomationFlow): AutomationFlow => {
    const newEdges: FlowEdge[] = [];

    flow.nodes.forEach(node => {
        // 1. Message Buttons & Rows
        if (node.type === 'message') {
            (node.data.buttons || []).forEach((btn: MessageButton) => {
                if (btn.action.type === 'quick_reply' && btn.action.targetNodeId) {
                    newEdges.push({
                        id: generateId('edge'),
                        source: node.id,
                        sourceHandle: btn.id,
                        target: btn.action.targetNodeId,
                        targetHandle: 'input'
                    });
                }
            });
            // List Rows
            (node.data.sections || []).forEach((section: any) => {
                (section.rows || []).forEach((row: any) => {
                    if (row.targetNodeId) {
                        newEdges.push({
                            id: generateId('edge'),
                            source: node.id,
                            sourceHandle: row.id,
                            target: row.targetNodeId,
                            targetHandle: 'input'
                        });
                    }
                });
            });
            // Preserve the message node's DEFAULT-OUTPUT edge (the "Default next
            // step", sourceHandle 'output'). It lives only in flow.edges (no
            // node-data field), so without this it's dropped on every re-sync —
            // which orphans whatever it points to (typically an End node) and
            // raises a false "This node is not connected to the flow" warning.
            flow.edges
                .filter(e => e.source === node.id && (e.sourceHandle === 'output' || e.sourceHandle === 'default' || !e.sourceHandle))
                .forEach(e => newEdges.push(e));
        }

        // 2. Template Buttons
        if ((node.type as string) === 'template') {
            const tplNode = node as unknown as TemplateNode;
            (tplNode.data.buttonMappings || []).forEach((mapping: any, idx: number) => {
                if ((mapping.buttonType === 'quick_reply' || mapping.buttonType === 'flow') && mapping.targetNodeId) {
                    newEdges.push({
                        id: generateId('edge'),
                        source: node.id,
                        sourceHandle: `btn-${idx}`,
                        target: mapping.targetNodeId,
                        targetHandle: 'input'
                    });
                }
            });
        }
        
        // 3. Trigger Node (preserve existing visual edge)
        if ((node.type as string) === 'trigger') {
            const existingTriggerEdge = flow.edges.find(e => e.source === node.id && e.sourceHandle === 'output');
            if (existingTriggerEdge) {
                newEdges.push(existingTriggerEdge);
            }
        }
        
        // 4. Input Node
        if ((node.type as string) === 'input') {
            const inputNode = node as unknown as InputNode;
            const nextId = inputNode.data.targetNodeId;
            if (nextId && nextId !== node.id) {
                newEdges.push({
                    id: generateId('edge'),
                    source: node.id,
                    sourceHandle: 'output',
                    target: nextId,
                    targetHandle: 'input'
                });
            }
        }

        // 5. API Node — preserve React Flow edges (success / error / branch-*)
        if ((node.type as string) === 'api') {
            flow.edges
                .filter(e => e.source === node.id)
                .forEach(edge => newEdges.push(edge));
        }

        // 6. Set-Status Node — preserve its output edge (there is no node-data
        // write-back for set_status, so rebuild from the existing React Flow edge,
        // else the connection is silently dropped on the next sync).
        if ((node.type as string) === 'set_status') {
            flow.edges
                .filter(e => e.source === node.id)
                .forEach(edge => newEdges.push(edge));
        }
    });
    
    return { ...flow, edges: newEdges };
};

// =============================================================================
// POSITION CALCULATIONS
// =============================================================================

/**
 * Calculate the next position for a new node
 */
export const calculateNextPosition = (nodes: FlowNode[]): { x: number; y: number } => {
    if (nodes.length === 0) {
        return { x: 250, y: 50 };
    }

    // Find the bottom-most node
    const maxY = Math.max(...nodes.map(n => n.position.y));
    const bottomNode = nodes.find(n => n.position.y === maxY);
    const nodeHeight = bottomNode ? NODE_DIMENSIONS[bottomNode.type].height : 150;

    return {
        x: 250,
        y: maxY + nodeHeight + 80,
    };
};

/**
 * Auto-layout nodes into clean top-down layers.
 *
 * Robust version:
 *  - Works even with NO trigger node (uses every node with no incoming edge as a
 *    root; falls back to the first node).
 *  - Lays out EVERY node, including branches not reachable from the trigger
 *    (disconnected nodes are placed on an extra row instead of being skipped).
 *  - Packs each level left-to-right with real node widths, and advances rows by
 *    the tallest node in the level, so nodes never overlap.
 */
export const calculateAutoLayout = (flow: AutomationFlow): AutomationFlow => {
    const nodes = flow.nodes.map(n => ({ ...n })); // clone so we never mutate input
    if (nodes.length === 0) return flow;

    const byId = new Map(nodes.map(n => [n.id, n]));
    const dim = (t: string) => NODE_DIMENSIONS[t as keyof typeof NODE_DIMENSIONS] || { width: 220, height: 160 };

    // Adjacency + incoming counts
    const children = new Map<string, string[]>();
    const incoming = new Map<string, number>();
    nodes.forEach(n => incoming.set(n.id, 0));
    flow.edges.forEach(e => {
        if (!byId.has(e.source) || !byId.has(e.target)) return;
        if (!children.has(e.source)) children.set(e.source, []);
        children.get(e.source)!.push(e.target);
        incoming.set(e.target, (incoming.get(e.target) || 0) + 1);
    });

    // Roots: the trigger if present, else every node with no incoming edge, else the first node.
    const trigger = nodes.find(n => n.type === 'trigger');
    let roots = trigger ? [trigger.id] : nodes.filter(n => (incoming.get(n.id) || 0) === 0).map(n => n.id);
    if (roots.length === 0) roots = [nodes[0].id];

    // BFS to assign a depth (row) to every reachable node.
    const depth = new Map<string, number>();
    const queue: string[] = [];
    roots.forEach(id => { if (!depth.has(id)) { depth.set(id, 0); queue.push(id); } });
    let qi = 0;
    while (qi < queue.length) {
        const id = queue[qi++];
        const d = depth.get(id)!;
        for (const t of children.get(id) || []) {
            if (!depth.has(t)) { depth.set(t, d + 1); queue.push(t); }
        }
    }

    // Any node never reached (disconnected) goes on an extra row below everything.
    let maxDepth = 0;
    depth.forEach(d => { if (d > maxDepth) maxDepth = d; });
    nodes.forEach(n => { if (!depth.has(n.id)) depth.set(n.id, maxDepth + 1); });

    // Group node ids by depth (preserving flow order for stable columns).
    const levels = new Map<number, string[]>();
    nodes.forEach(n => {
        const d = depth.get(n.id)!;
        if (!levels.has(d)) levels.set(d, []);
        levels.get(d)!.push(n.id);
    });

    const H_GAP = 80;
    const V_GAP = 90;
    const startX = 80;
    let y = 60;

    Array.from(levels.keys()).sort((a, b) => a - b).forEach(d => {
        const ids = levels.get(d)!;
        let x = startX;
        let rowMaxH = 0;
        ids.forEach(id => {
            const node = byId.get(id)!;
            const { width, height } = dim(node.type);
            node.position = { x, y };
            x += width + H_GAP;
            if (height > rowMaxH) rowMaxH = height;
        });
        y += rowMaxH + V_GAP;
    });

    return { ...flow, nodes };
};

// =============================================================================
// BUTTON OPERATIONS
// =============================================================================

/**
 * Add a button to a message node
 */
export const addButton = (
    flow: AutomationFlow,
    nodeId: string
): AutomationFlow => {
    const node = flow.nodes.find(n => n.id === nodeId) as MessageNode | undefined;
    if (!node || node.type !== 'message') return flow;

    if (node.data.buttons.length >= LIMITS.MAX_BUTTONS_PER_MESSAGE) {
        console.warn('Maximum buttons reached');
        return flow;
    }

    const newButton: MessageButton = {
        id: generateButtonId(nodeId, node.data.buttons.length),
        label: 'New button',
        action: { type: 'quick_reply', targetNodeId: null },
    };

    return {
        ...flow,
        nodes: flow.nodes.map(n =>
            n.id === nodeId && n.type === 'message'
                ? { ...n, data: { ...n.data, buttons: [...n.data.buttons, newButton] } }
                : n
        ),
    };
};

/**
 * Update a button in a message node
 */
export const updateButton = (
    flow: AutomationFlow,
    nodeId: string,
    buttonId: string,
    updates: Partial<MessageButton>
): AutomationFlow => {
    // 1. Update Node
    const newNodes = flow.nodes.map(node => {
        if (node.id === nodeId && node.type === 'message') {
            return {
                ...node,
                data: {
                    ...node.data,
                    buttons: node.data.buttons.map(btn =>
                        btn.id === buttonId ? { ...btn, ...updates } : btn
                    ),
                },
            };
        }
        return node;
    });

    // 2. Sync Edges
    let newEdges = flow.edges;

    const updatedNode = newNodes.find(n => n.id === nodeId) as MessageNode;
    const updatedButton = updatedNode?.data.buttons.find(b => b.id === buttonId);

    if (updatedButton) {
        // Remove existing edge for this button
        newEdges = newEdges.filter(e => !(e.source === nodeId && e.sourceHandle === buttonId));

        // Add new edge if it's a quick_reply with a target
        if (updatedButton.action.type === 'quick_reply' && updatedButton.action.targetNodeId) {
            const newEdge: FlowEdge = {
                id: generateId('edge'),
                source: nodeId,
                sourceHandle: buttonId,
                target: updatedButton.action.targetNodeId,
                targetHandle: 'input'
            };
            newEdges = [...newEdges, newEdge];
        }
    }

    return {
        ...flow,
        nodes: newNodes,
        edges: newEdges,
    };
};

/**
 * Remove a button from a message node
 */
export const removeButton = (
    flow: AutomationFlow,
    nodeId: string,
    buttonId: string
): AutomationFlow => {
    // Also remove any edge from this button
    const filteredEdges = flow.edges.filter(e => e.sourceHandle !== buttonId);

    return {
        ...flow,
        nodes: flow.nodes.map(node => {
            if (node.id === nodeId && node.type === 'message') {
                return {
                    ...node,
                    data: {
                        ...node.data,
                        buttons: node.data.buttons.filter(btn => btn.id !== buttonId),
                    },
                };
            }
            return node;
        }),
        edges: filteredEdges,
    };
};
