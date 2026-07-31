/**
 * Interactive Automation — Connection Rules
 * =========================================
 * Single source of truth for which node/handle connections are VALID, and the
 * user-facing explanation + valid alternative for every invalid one.
 *
 * Used by:
 *  - <ReactFlow isValidConnection={...}>  → live "no-drop" cursor while dragging
 *  - onConnect                            → toast the reason + fix on an invalid drop
 *  - MessageNode                          → grey-out non-routing button handles
 *
 * Keeping every rule here (pure functions, no React) makes the behaviour easy to
 * reason about and to replicate to other codebases.
 */

import type { FlowNode, ButtonActionType } from './types';

export interface ConnectionRuleResult {
    valid: boolean;
    /** Short title of what went wrong (shown as the toast title). */
    reason?: string;
    /** The valid alternative / how to do it correctly (shown as the toast body). */
    fix?: string;
}

/** Message-node button actions that PERFORM a device action and cannot route the flow. */
export const NON_ROUTING_MESSAGE_ACTIONS: ButtonActionType[] = [
    'url',
    'call',
    'location',
    'catalog',
    'product_list',
];

/** Human labels for button actions (used in messages). */
const ACTION_LABEL: Record<string, string> = {
    quick_reply: 'Quick Reply',
    url: 'URL',
    call: 'Call',
    location: 'Location',
    catalog: 'Catalog',
    product_list: 'Product list',
    send_document: 'Send document',
};

/** Human labels for node types (used in messages). */
const NODE_LABEL: Record<string, string> = {
    trigger: 'Trigger',
    message: 'Message',
    template: 'Template',
    input: 'Question',
    api: 'API',
    set_status: 'Set-Status',
    lead: 'Lead',
    end: 'End',
};

/** Node types the Trigger is allowed to start the flow with. */
const TRIGGER_STARTABLE = new Set(['message', 'template', 'input', 'api', 'lead']);

/** True when a Message-node button of this action type can lead to another node. */
export function canMessageButtonRoute(actionType?: string): boolean {
    if (!actionType) return true; // default output
    return !NON_ROUTING_MESSAGE_ACTIONS.includes(actionType as ButtonActionType);
}

/** Minimal edge shape needed for cycle detection. */
interface EdgeLike {
    source: string;
    target: string;
}

/**
 * Would adding `source -> target` create a loop? True when `target` can already
 * reach `source` by following existing edges (so the new edge closes the cycle).
 */
export function wouldCreateCycle(
    source: string,
    target: string,
    edges: EdgeLike[],
): boolean {
    const adj = new Map<string, string[]>();
    for (const e of edges) {
        if (!e || !e.source || !e.target) continue;
        if (!adj.has(e.source)) adj.set(e.source, []);
        adj.get(e.source)!.push(e.target);
    }
    const stack = [target];
    const seen = new Set<string>();
    while (stack.length) {
        const cur = stack.pop()!;
        if (cur === source) return true; // target already routes back to source
        if (seen.has(cur)) continue;
        seen.add(cur);
        for (const next of adj.get(cur) || []) stack.push(next);
    }
    return false;
}

/**
 * Evaluate a proposed connection. Returns { valid:true } when allowed, or
 * { valid:false, reason, fix } with a message pair when not.
 *
 * Cardinality (one edge per source handle, no duplicates) is enforced separately
 * in addFlowEdge — this function covers node-role and button-type rules.
 */
export function getConnectionRule(
    source: string | null | undefined,
    sourceHandle: string | null | undefined,
    target: string | null | undefined,
    _targetHandle: string | null | undefined,
    nodes: FlowNode[],
    edges: EdgeLike[] = [],
): ConnectionRuleResult {
    if (!source || !target) return { valid: false };

    // G2 — no self-connection
    if (source === target) {
        return {
            valid: false,
            reason: "A node can't connect to itself",
            fix: 'Connect this output to a different node.',
        };
    }

    const src = nodes.find((n) => n.id === source);
    const tgt = nodes.find((n) => n.id === target);
    // If we can't resolve the nodes, don't block (let React Flow proceed).
    if (!src || !tgt) return { valid: true };

    // A1 — nothing can connect INTO a Trigger
    if (tgt.type === 'trigger') {
        return {
            valid: false,
            reason: "The Trigger can't receive connections",
            fix: "It's the entry point of the flow — draw the connection FROM the Trigger's output instead.",
        };
    }

    // A2 / A3 — End and Lead are terminal (belt-and-suspenders; they have no source handle)
    if (src.type === 'end' || src.type === 'lead') {
        const label = NODE_LABEL[src.type];
        return {
            valid: false,
            reason: `${label} nodes end the branch`,
            fix:
                src.type === 'end'
                    ? 'To continue the flow, replace End with a Message or Question node.'
                    : 'Mark-as-Lead is a final step. Put the next step before it, or use a Set-Status node to keep going.',
        };
    }

    // B1–B3 — a special (non-routing) Message button cannot lead anywhere
    if (src.type === 'message' && sourceHandle && sourceHandle !== 'output') {
        const btn = ((src.data as any)?.buttons || []).find((b: any) => b.id === sourceHandle);
        const actionType: string | undefined = btn?.action?.type;
        if (actionType && !canMessageButtonRoute(actionType)) {
            const label = ACTION_LABEL[actionType] || 'This';
            return {
                valid: false,
                reason: `${label} buttons can't lead to another step`,
                fix: `${label} buttons perform an action on the customer's phone and end that branch. To continue the flow after a tap, use a Quick Reply button instead.`,
            };
        }
    }

    // D5 — the Trigger must lead to a startable node type first
    if (src.type === 'trigger' && !TRIGGER_STARTABLE.has(tgt.type)) {
        return {
            valid: false,
            reason: `The Trigger can't connect directly to ${NODE_LABEL[tgt.type] || 'this'} node`,
            fix: 'The Trigger must lead to a Message, Template, Question, API, or Lead node first.',
        };
    }

    // D4 — block loops back to an earlier step
    if (wouldCreateCycle(source, target, edges)) {
        return {
            valid: false,
            reason: 'This creates a loop back to an earlier step',
            fix: 'Route this forward to a later step or an End node. To offer a menu again, add a new Message node instead of looping back.',
        };
    }

    return { valid: true };
}
