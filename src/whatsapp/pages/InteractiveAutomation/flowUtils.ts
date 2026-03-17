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
    TemplateNode as TemplateNodeType,
    TriggerNode,
    EndNode,
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

        // Check buttons
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

            // Check button action
            if (button.action.type === 'quick_reply' && !button.action.targetNodeId) {
                issues.push({
                    severity: 'warning',
                    nodeId: node.id,
                    buttonId: button.id,
                    message: 'Button is not connected to any message',
                    autoFixable: false,
                });
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
    });

    // Check template nodes
    const templateNodes = flow.nodes.filter(n => n.type === 'template') as TemplateNodeType[];
    templateNodes.forEach(node => {
        if (!node.data.templateName?.trim()) {
            issues.push({
                severity: 'error',
                nodeId: node.id,
                message: 'Template must be selected',
                autoFixable: false,
            });
        }

        if (node.data.buttons.length === 0) {
            issues.push({
                severity: 'warning',
                nodeId: node.id,
                message: 'Template has no quick reply buttons',
                autoFixable: false,
            });
        }
    });

    // Check for orphan nodes (nodes not connected to trigger)
    const connectedNodeIds = new Set<string>();
    const triggerNode = triggerNodes[0];
    if (triggerNode) {
        connectedNodeIds.add(triggerNode.id);
        traverseConnections(triggerNode.id, flow.edges, connectedNodeIds);
    }

    flow.nodes.forEach(node => {
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

    // Update Node (Button Target)
    const newNodes = flow.nodes.map(node => {
        if (node.id === source && node.type === 'message') {
            const messageNode = node as MessageNode;
            return {
                ...node,
                data: {
                    ...node.data,
                    buttons: messageNode.data.buttons.map(btn => {
                        if (btn.id === sourceHandle && btn.action.type === 'quick_reply') {
                            return {
                                ...btn,
                                action: { ...btn.action, targetNodeId: target }
                            };
                        }
                        return btn;
                    })
                }
            };
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

    // Update Node (Reset Button Target)
    const newNodes = flow.nodes.map(node => {
        if (node.id === edge.source && node.type === 'message') {
            const messageNode = node as MessageNode;
            return {
                ...node,
                data: {
                    ...node.data,
                    buttons: messageNode.data.buttons.map(btn => {
                        if (btn.id === edge.sourceHandle && btn.action.type === 'quick_reply') {
                            return {
                                ...btn,
                                action: { ...btn.action, targetNodeId: null }
                            };
                        }
                        return btn;
                    })
                }
            };
        }
        return node;
    });

    return {
        ...flow,
        edges: newEdges,
        nodes: newNodes,
    };
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
 * Auto-layout nodes in a tree structure
 */
export const calculateAutoLayout = (flow: AutomationFlow): AutomationFlow => {
    const nodes = [...flow.nodes];
    const triggerNode = nodes.find(n => n.type === 'trigger');

    if (!triggerNode) return flow;

    // Start from trigger node
    const visited = new Set<string>();
    const layoutNode = (
        nodeId: string,
        depth: number,
        horizontalIndex: number
    ): void => {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);

        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        const nodeWidth = NODE_DIMENSIONS[node.type].width;
        const nodeHeight = NODE_DIMENSIONS[node.type].height;

        node.position = {
            x: 250 + (horizontalIndex - 0.5) * (nodeWidth + 60),
            y: 50 + depth * (nodeHeight + 80),
        };

        // Find children (nodes connected from this node)
        const childEdges = flow.edges.filter(e => e.source === nodeId);
        childEdges.forEach((edge, idx) => {
            layoutNode(edge.target, depth + 1, idx - (childEdges.length - 1) / 2);
        });
    };

    layoutNode(triggerNode.id, 0, 0);

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
