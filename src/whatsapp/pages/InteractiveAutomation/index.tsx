/**
 * Interactive Automation Flow Builder
 * ====================================
 * Visual flow builder for creating WhatsApp interactive message automations.
 * 
 * Features:
 * - Drag and drop nodes (Trigger, Message, End)
 * - Visual connections between buttons and messages
 * - Real-time validation
 * - Save/Publish workflow
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import ReactFlow, {
    Node,
    Edge,
    Controls,
    Background,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    NodeTypes,
    BackgroundVariant,
    Panel,
    useReactFlow,
    ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { toast } from '@/hooks/use-toast';
import { API_BASE_URL, WHATSAPP_REST_API_PREFIX } from "@/config";
import { getWorkspaceId } from '../../utils/workspaceContext';
import { cachedFetch } from '../../utils/waPersistentCache';

// Local imports
import { TriggerNode, MessageNode, TemplateNode, InputNode, ApiNode, EndNode, LeadNode } from './nodes';
import { NodeEditor } from './panels';
import { FlowToolbar } from './FlowToolbar';
import {
    generateId,
    generateButtonId,
    validateFlow,
    hasErrors,
    addMessageNode,
    addEndNode,
    addTemplateNode,
    addInputNode,
    addApiNode,
    addLeadNode,
    updateNode,
    deleteNode,
    addButton,
    updateButton,
    removeButton,
    calculateAutoLayout,
    syncEdgesFromNodes,
    addEdge as addFlowEdge,
    removeEdge as removeFlowEdge,
} from './flowUtils';
import {
    createEmptyFlow,
    createDefaultTriggerNode,
    createDefaultTemplateNode,
    EDGE_COLORS,
} from './constants';
import type {
    AutomationFlow,
    FlowNode,
    FlowEdge,
    ValidationIssue,
    MessageButton,
    TemplateNode as TemplateNodeType,
    TemplateButtonMapping,
} from './types';
import './interactive-automation.css';
import {
    AiFlowGeneratorDialog,
    draftToAutomationFlow,
    type GeneratedFlowDraft,
} from './components/AiFlowGeneratorDialog';
import {
    FlowVariablesDialog,
    type FlowVariablesState,
} from './components/FlowVariablesDialog';

// =============================================================================
// Node Types Registration
// =============================================================================

const nodeTypes: NodeTypes = {
    trigger: TriggerNode,
    message: MessageNode,
    template: TemplateNode,
    input: InputNode,
    api: ApiNode,
    end: EndNode,
    lead: LeadNode,
};

// =============================================================================
// Helper Functions
// =============================================================================

// Convert our FlowNode[] to ReactFlow Node[]
const toReactFlowNodes = (nodes: FlowNode[], validationIssues: ValidationIssue[] = []): Node[] => {
    return nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
            ...node.data,
            validationIssues: (validationIssues || []).filter(issue => issue.nodeId === node.id)
        },
    }));
};

// Convert our FlowEdge[] to ReactFlow Edge[]
const toReactFlowEdges = (edges: FlowEdge[]): Edge[] => {
    return edges
        // Self-loops draw a grey “frame” around the node (output → input on same id)
        .filter((edge) => edge.source !== edge.target)
        .map((edge) => ({
            id: edge.id,
            source: edge.source,
            sourceHandle: edge.sourceHandle,
            target: edge.target,
            targetHandle: edge.targetHandle,
            animated: edge.animated,
            style: {
                stroke: EDGE_COLORS.default,
                strokeWidth: 2,
                ...edge.style,
            },
        }));
};

// Convert ReactFlow nodes back to our FlowNode[]
const fromReactFlowNodes = (nodes: Node[], originalNodes: FlowNode[]): FlowNode[] => {
    return nodes.map((rfNode) => {
        const original = originalNodes.find((n) => n.id === rfNode.id);
        if (original) {
            return {
                ...original,
                position: rfNode.position,
            };
        }
        // Fallback (shouldn't happen normally)
        return {
            id: rfNode.id,
            type: rfNode.type as FlowNode['type'],
            position: rfNode.position,
            data: rfNode.data,
        } as FlowNode;
    });
};

// =============================================================================
// Main Component
// =============================================================================

export function InteractiveAutomation() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const isEditing = Boolean(id);

    // Get base path from current location (agent or dashboard)
    const basePath = location.pathname.startsWith('/agent') ? '/agent' : '/dashboard';

    // Account/Workspace state
    const [accountId, setAccountId] = useState<number | null>(null);
    const workspaceId = getWorkspaceId() || '';

    // Flow state
    const [flow, setFlow] = useState<AutomationFlow>(() =>
        createEmptyFlow(0, workspaceId)
    );

    // ReactFlow state
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // UI state
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[]>([]);
    const [isLoading, setIsLoading] = useState(isEditing);
    const [aiDialogOpen, setAiDialogOpen] = useState(false);
    const [variablesDialogOpen, setVariablesDialogOpen] = useState(false);

    // Template state for template node selection
    const [templates, setTemplates] = useState<Array<{
        id: number;
        name: string;
        language: string;
        category: string;
        status: string;
        components: any[];
    }>>([]);

    // ReactFlow instance ref for viewport access
    const reactFlowInstance = React.useRef<any>(null);

    // ==========================================================================
    // INITIALIZATION
    // ==========================================================================

    // Fetch WhatsApp account
    useEffect(() => {
        const fetchAccount = async () => {
            if (!workspaceId) return;
            try {
                const res = await cachedFetch(
                    `${WHATSAPP_REST_API_PREFIX}/accounts?workspace_id=${workspaceId}`
                );
                const data = await res.json();
                if (data.success && data.accounts?.length > 0) {
                    setAccountId(data.accounts[0].id);
                    setFlow((prev) => ({ ...prev, accountId: data.accounts[0].id }));
                }
            } catch (err) {
                console.error('Failed to fetch account:', err);
            }
        };
        fetchAccount();
    }, [workspaceId]);

    // Fetch templates for template node selection
    useEffect(() => {
        const fetchTemplates = async () => {
            if (!accountId) return;
            try {
                const res = await cachedFetch(
                    `${WHATSAPP_REST_API_PREFIX}/templates?account_id=${accountId}&workspace_id=${workspaceId}`
                );
                const data = await res.json();
                if (data.success && data.templates) {
                    setTemplates(data.templates);
                }
            } catch (err) {
                console.error('Failed to fetch templates:', err);
            }
        };
        fetchTemplates();
    }, [accountId, workspaceId]);

    // Load existing flow if editing
    useEffect(() => {
        if (id) {
            loadFlow(parseInt(id));
        } else {
            // Initialize with trigger node for new flows
            const initialFlow = createEmptyFlow(accountId || 0, workspaceId);
            setFlow(initialFlow);
            setNodes(toReactFlowNodes(initialFlow.nodes));
            setEdges(toReactFlowEdges(initialFlow.edges));
        }
    }, [id, accountId]);

    const loadFlow = async (flowId: number) => {
        try {
            setIsLoading(true);
            const res = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/interactive-automations/${flowId}`);
            const data = await res.json();

            if (data.success && data.automation) {
                const rawEdges = (data.automation.edges || []) as FlowEdge[];
                const loadedFlow: AutomationFlow = {
                    id: data.automation.id,
                    name: data.automation.name,
                    description: data.automation.description,
                    accountId: data.automation.account_id,
                    workspaceId: data.automation.workspace_id,
                    nodes: data.automation.nodes || [],
                    edges: rawEdges.filter((e) => e.source !== e.target),
                    trigger: data.automation.trigger || { type: 'any_reply', enabled: true },
                    variables: data.automation.variables || {},
                    flowConfig: data.automation.flowConfig || data.automation.flow_config || {},
                    status: data.automation.status || 'draft',
                    createdAt: data.automation.created_at,
                    updatedAt: data.automation.updated_at,
                };

                setFlow(loadedFlow);
                setNodes(toReactFlowNodes(loadedFlow.nodes));
                setEdges(toReactFlowEdges(loadedFlow.edges));
            } else {
                toast({
                    title: 'Error',
                    description: 'Failed to load automation',
                    variant: 'destructive',
                });
                navigate('/dashboard/whatsapp/automation');
            }
        } catch (err) {
            console.error('Failed to load flow:', err);
            toast({
                title: 'Error',
                description: 'Failed to load automation',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // ==========================================================================
    // VALIDATION
    // ==========================================================================

    useEffect(() => {
        const timeout = setTimeout(() => {
            const issues = validateFlow(flow);
            setValidationIssues(issues);
            // Also update the nodes directly with issues so they can render the glowing handles
            setNodes(toReactFlowNodes(flow.nodes, issues));
        }, 300);
        return () => clearTimeout(timeout);
    }, [flow, setNodes]);

    // ==========================================================================
    // SYNC FLOW STATE WITH REACTFLOW
    // ==========================================================================

    useEffect(() => {
        // Sync position changes from ReactFlow back to our flow state
        const updatedNodes = fromReactFlowNodes(nodes, flow.nodes);
        if (JSON.stringify(updatedNodes) !== JSON.stringify(flow.nodes)) {
            setFlow((prev) => ({ ...prev, nodes: updatedNodes }));
        }
    }, [nodes]);

    // ==========================================================================
    // HANDLERS
    // ==========================================================================

    const onConnect = useCallback(
        (connection: Connection) => {
            if (!connection.source || !connection.target) return;
            if (connection.source === connection.target) return;

            const updatedFlow = addFlowEdge(
                flow,
                connection.source,
                connection.sourceHandle || 'output',
                connection.target
            );

            setFlow(updatedFlow);
            setNodes(toReactFlowNodes(updatedFlow.nodes));
            setEdges(toReactFlowEdges(updatedFlow.edges));
            setIsDirty(true);
        },
        [flow, setNodes, setEdges]
    );

    const onEdgesDelete = useCallback(
        (edgesToDelete: Edge[]) => {
            let updatedFlow = flow;
            edgesToDelete.forEach((edge) => {
                updatedFlow = removeFlowEdge(updatedFlow, edge.id);
            });

            setFlow(updatedFlow);
            setNodes(toReactFlowNodes(updatedFlow.nodes));
            setEdges(toReactFlowEdges(updatedFlow.edges));
            setIsDirty(true);
        },
        [flow, setNodes, setEdges]
    );

    const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNodeId(node.id);
    }, []);

    const onPaneClick = useCallback(() => {
        setSelectedNodeId(null);
    }, []);

    const handleNameChange = useCallback((name: string) => {
        setFlow((prev) => ({ ...prev, name }));
        setIsDirty(true);
    }, []);


    const handleAddEndNode = useCallback(() => {
        // Get current viewport center for positioning
        let position: { x: number; y: number } | undefined;
        if (reactFlowInstance.current) {
            const viewport = reactFlowInstance.current.getViewport();
            const zoom = viewport.zoom || 1;
            const containerWidth = 800;
            const containerHeight = 600;
            position = {
                x: (-viewport.x + containerWidth / 2) / zoom,
                y: (-viewport.y + containerHeight / 2) / zoom,
            };
        }

        const updatedFlow = addEndNode(flow, position);
        setFlow(updatedFlow);
        setNodes(toReactFlowNodes(updatedFlow.nodes));
        setIsDirty(true);

        const newNode = updatedFlow.nodes[updatedFlow.nodes.length - 1];
        setSelectedNodeId(newNode.id);

        // Pan to the new node after a short delay
        setTimeout(() => {
            if (reactFlowInstance.current && newNode) {
                reactFlowInstance.current.setCenter(
                    newNode.position.x + 100,
                    newNode.position.y + 50,
                    { zoom: 1, duration: 500 }
                );
            }
        }, 50);
    }, [flow]);

    const handleAddTemplateNode = useCallback(() => {
        // Get current viewport center for positioning
        let position: { x: number; y: number } | undefined;
        if (reactFlowInstance.current) {
            const viewport = reactFlowInstance.current.getViewport();
            const zoom = viewport.zoom || 1;
            const containerWidth = 800;
            const containerHeight = 600;
            position = {
                x: (-viewport.x + containerWidth / 2) / zoom,
                y: (-viewport.y + containerHeight / 2) / zoom,
            };
        }

        const updatedFlow = addTemplateNode(flow, position);
        setFlow(updatedFlow);
        setNodes(toReactFlowNodes(updatedFlow.nodes));
        setIsDirty(true);

        const newNode = updatedFlow.nodes[updatedFlow.nodes.length - 1];
        setSelectedNodeId(newNode.id);

        // Pan to the new node after a short delay
        setTimeout(() => {
            if (reactFlowInstance.current && newNode) {
                reactFlowInstance.current.setCenter(
                    newNode.position.x + 150,
                    newNode.position.y + 100,
                    { zoom: 1, duration: 500 }
                );
            }
        }, 50);
    }, [flow]);

    const handleAddMessageNode = useCallback(() => {
        // Get current viewport center for positioning
        let position: { x: number; y: number } | undefined;
        if (reactFlowInstance.current) {
            const viewport = reactFlowInstance.current.getViewport();
            const zoom = viewport.zoom || 1;
            const containerWidth = 800;
            const containerHeight = 600;
            position = {
                x: (-viewport.x + containerWidth / 2) / zoom,
                y: (-viewport.y + containerHeight / 2) / zoom,
            };
        }

        const updatedFlow = addMessageNode(flow, position);
        setFlow(updatedFlow);
        setNodes(toReactFlowNodes(updatedFlow.nodes));
        setIsDirty(true);

        const newNode = updatedFlow.nodes[updatedFlow.nodes.length - 1];
        setSelectedNodeId(newNode.id);

        // Pan to the new node after a short delay
        setTimeout(() => {
            if (reactFlowInstance.current && newNode) {
                reactFlowInstance.current.setCenter(
                    newNode.position.x + 150,
                    newNode.position.y + 100,
                    { zoom: 1, duration: 500 }
                );
            }
        }, 50);
    }, [flow]);

    const handleAddInputNode = useCallback(() => {
        // Get current viewport center for positioning
        let position: { x: number; y: number } | undefined;
        if (reactFlowInstance.current) {
            const viewport = reactFlowInstance.current.getViewport();
            const zoom = viewport.zoom || 1;
            const containerWidth = 800;
            const containerHeight = 600;
            position = {
                x: (-viewport.x + containerWidth / 2) / zoom,
                y: (-viewport.y + containerHeight / 2) / zoom,
            };
        }

        const updatedFlow = addInputNode(flow, position);
        setFlow(updatedFlow);
        setNodes(toReactFlowNodes(updatedFlow.nodes));
        setIsDirty(true);

        const newNode = updatedFlow.nodes[updatedFlow.nodes.length - 1];
        setSelectedNodeId(newNode.id);

        // Pan to the new node after a short delay
        setTimeout(() => {
            if (reactFlowInstance.current && newNode) {
                reactFlowInstance.current.setCenter(
                    newNode.position.x + 150,
                    newNode.position.y + 100,
                    { zoom: 1, duration: 500 }
                );
            }
        }, 50);
    }, [flow]);

    const handleAddApiNode = useCallback(() => {
        let position: { x: number; y: number } | undefined;
        if (reactFlowInstance.current) {
            const viewport = reactFlowInstance.current.getViewport();
            const zoom = viewport.zoom || 1;
            position = {
                x: (-viewport.x + 400) / zoom,
                y: (-viewport.y + 300) / zoom,
            };
        }

        const updatedFlow = addApiNode(flow, position);
        setFlow(updatedFlow);
        setNodes(toReactFlowNodes(updatedFlow.nodes));
        setIsDirty(true);

        const newNode = updatedFlow.nodes[updatedFlow.nodes.length - 1];
        setSelectedNodeId(newNode.id);

        setTimeout(() => {
            if (reactFlowInstance.current && newNode) {
                reactFlowInstance.current.setCenter(
                    newNode.position.x + 150,
                    newNode.position.y + 100,
                    { zoom: 1, duration: 500 }
                );
            }
        }, 50);
    }, [flow]);

    const handleAddLeadNode = useCallback(() => {
        // Get current viewport center for positioning
        let position: { x: number; y: number } | undefined;
        if (reactFlowInstance.current) {
            const viewport = reactFlowInstance.current.getViewport();
            const zoom = viewport.zoom || 1;
            const containerWidth = 800;
            const containerHeight = 600;
            position = {
                x: (-viewport.x + containerWidth / 2) / zoom,
                y: (-viewport.y + containerHeight / 2) / zoom,
            };
        }

        const updatedFlow = addLeadNode(flow, position);
        setFlow(updatedFlow);
        setNodes(toReactFlowNodes(updatedFlow.nodes));
        setIsDirty(true);

        const newNode = updatedFlow.nodes[updatedFlow.nodes.length - 1];
        setSelectedNodeId(newNode.id);

        // Pan to the new node after a short delay
        setTimeout(() => {
            if (reactFlowInstance.current && newNode) {
                reactFlowInstance.current.setCenter(
                    newNode.position.x + 100,
                    newNode.position.y + 50,
                    { zoom: 1, duration: 500 }
                );
            }
        }, 50);
    }, [flow]);

    const handleAutoLayout = useCallback(() => {
        const layoutedFlow = calculateAutoLayout(flow);
        setFlow(layoutedFlow);
        setNodes(toReactFlowNodes(layoutedFlow.nodes));
        setIsDirty(true);
        toast({ title: 'Layout applied', description: 'Nodes have been rearranged' });
    }, [flow]);

    const handleOpenAiGenerator = useCallback(() => {
        const hasContent = flow.nodes.some((n) => n.type !== 'trigger');
        if (hasContent) {
            const ok = window.confirm(
                'Generate with AI will replace your current nodes with a new draft. Continue?'
            );
            if (!ok) return;
        }
        setAiDialogOpen(true);
    }, [flow.nodes]);

    const handleFlowVariablesSave = useCallback((next: FlowVariablesState) => {
        setFlow((prev) => ({
            ...prev,
            variables: next.variables,
            flowConfig: {
                ...(prev.flowConfig || {}),
                variableDefaults: next.variableDefaults,
            },
        }));
        setIsDirty(true);
        toast({
            title: 'Flow variables updated',
            description: 'Save the flow to persist tokens and defaults.',
        });
    }, []);

    const flowVariablesState = useMemo(
        (): FlowVariablesState => ({
            variables: flow.variables || {},
            variableDefaults: flow.flowConfig?.variableDefaults || {},
        }),
        [flow.variables, flow.flowConfig]
    );

    const hasFlowToken = Boolean(
        flow.variables?.flow_api_token && flow.variables.flow_api_token !== '***'
    );

    const handleAiDraftApplied = useCallback(
        (draft: GeneratedFlowDraft) => {
            const acct = accountId || flow.accountId || 0;
            const nextFlow = draftToAutomationFlow(draft, acct, workspaceId, flow.id);
            const layouted = calculateAutoLayout(syncEdgesFromNodes(nextFlow));
            setFlow(layouted);
            setNodes(toReactFlowNodes(layouted.nodes, validateFlow(layouted)));
            setEdges(toReactFlowEdges(layouted.edges));
            setSelectedNodeId(null);
            setIsDirty(true);
            if (!nextFlow.variables?.flow_api_token) {
                setVariablesDialogOpen(true);
            }
            toast({
                title: 'AI flow applied',
                description: 'Set flow variables (API token), review nodes, then save.',
            });
        },
        [accountId, flow.accountId, flow.id, workspaceId]
    );

    const handleUpdateNode = useCallback(
        (updates: Partial<FlowNode['data']>) => {
            if (!selectedNodeId) return;
            const updatedFlow = updateNode(flow, selectedNodeId, updates);
            
            // Sync edges in case a targetNodeId was changed in the data (e.g., list rows)
            const syncedFlow = syncEdgesFromNodes(updatedFlow);
            
            setFlow(syncedFlow);
            setNodes(toReactFlowNodes(syncedFlow.nodes));
            setEdges(toReactFlowEdges(syncedFlow.edges));
            setIsDirty(true);
        },
        [flow, selectedNodeId]
    );

    const handleDeleteNode = useCallback(() => {
        if (!selectedNodeId) return;
        const updatedFlow = deleteNode(flow, selectedNodeId);
        setFlow(updatedFlow);
        setNodes(toReactFlowNodes(updatedFlow.nodes));
        setEdges(toReactFlowEdges(updatedFlow.edges));
        setSelectedNodeId(null);
        setIsDirty(true);
    }, [flow, selectedNodeId]);

    const handleAddButton = useCallback(() => {
        if (!selectedNodeId) return;
        const updatedFlow = addButton(flow, selectedNodeId);
        setFlow(updatedFlow);
        setNodes(toReactFlowNodes(updatedFlow.nodes));
        setIsDirty(true);
    }, [flow, selectedNodeId]);

    const handleUpdateButton = useCallback(
        (buttonId: string, updates: Partial<MessageButton>) => {
            if (!selectedNodeId) return;
            const updatedFlow = updateButton(flow, selectedNodeId, buttonId, updates);
            setFlow(updatedFlow);
            setNodes(toReactFlowNodes(updatedFlow.nodes));
            setEdges(toReactFlowEdges(updatedFlow.edges));
            setIsDirty(true);
        },
        [flow, selectedNodeId]
    );

    const handleRemoveButton = useCallback(
        (buttonId: string) => {
            if (!selectedNodeId) return;
            const updatedFlow = removeButton(flow, selectedNodeId, buttonId);
            setFlow(updatedFlow);
            setNodes(toReactFlowNodes(updatedFlow.nodes));
            setEdges(toReactFlowEdges(updatedFlow.edges));
            setIsDirty(true);
        },
        [flow, selectedNodeId]
    );

    // Template node handlers
    const handleSelectTemplate = useCallback(
        (templateId: number) => {
            if (!selectedNodeId) return;
            
            const template = templates.find(t => t.id === templateId);
            if (!template) return;

            // Extract button mappings from template components
            const buttonMappings: TemplateButtonMapping[] = [];
            if (template.components) {
                for (const comp of template.components) {
                    if (comp.type === 'BUTTONS') {
                        (comp.buttons || []).forEach((btn: any, idx: number) => {
                            buttonMappings.push({
                                buttonIndex: idx,
                                buttonText: btn.text || `Button ${idx + 1}`,
                                buttonType: btn.type === 'QUICK_REPLY' ? 'quick_reply'
                                          : btn.type === 'FLOW' ? 'flow'
                                          : btn.type === 'URL' ? 'url'
                                          : 'phone',
                                targetNodeId: null,
                            });
                        });
                    }
                }
            }

            const updates = {
                templateId: template.id,
                templateName: template.name,
                templateLanguage: template.language,
                templateCategory: template.category,
                templateStatus: template.status,
                buttonMappings,
            };

            handleUpdateNode(updates);
        },
        [selectedNodeId, templates, handleUpdateNode]
    );

    const handleUpdateButtonMapping = useCallback(
        (buttonIndex: number, targetNodeId: string | null) => {
            if (!selectedNodeId) return;
            
            const node = flow.nodes.find(n => n.id === selectedNodeId);
            if (!node || node.type !== 'template') return;

            const tplNode = node as TemplateNodeType;
            const updatedMappings = [...(tplNode.data.buttonMappings || [])];
            
            if (updatedMappings[buttonIndex]) {
                updatedMappings[buttonIndex] = {
                    ...updatedMappings[buttonIndex],
                    targetNodeId,
                };
            }

            // Update the node data and sync edges
            const intermediateFlow = {
                ...flow,
                nodes: flow.nodes.map(n =>
                    n.id === selectedNodeId
                        ? { ...n, data: { ...n.data, buttonMappings: updatedMappings } } as FlowNode
                        : n
                )
            };
            
            const syncedFlow = syncEdgesFromNodes(intermediateFlow);

            setFlow(syncedFlow);
            setNodes(toReactFlowNodes(syncedFlow.nodes));
            setEdges(toReactFlowEdges(syncedFlow.edges));
            setIsDirty(true);
        },
        [flow, selectedNodeId, setFlow, setNodes, setEdges]
    );

    // ==========================================================================
    // SAVE & PUBLISH
    // ==========================================================================

    const handleSave = useCallback(async (): Promise<boolean> => {
        if (!flow.name.trim()) {
            toast({
                title: 'Name required',
                description: 'Please enter an automation name',
                variant: 'destructive',
            });
            return false;
        }

        try {
            setIsSaving(true);

            // Extract trigger settings from the trigger node
            const triggerNode = flow.nodes.find(n => n.type === 'trigger');
            const triggerData = (triggerNode?.data || {}) as {
                triggerType?: string;
                keywords?: string[];
                templateId?: string;
                firstMessageOnly?: boolean;
                oneTimeOnly?: boolean;
            };

            // Build trigger object from trigger node data
            const trigger = {
                type: triggerData.triggerType || 'any_reply',
                keywords: triggerData.keywords || [],
                templateId: triggerData.templateId,
                firstMessageOnly: Boolean(triggerData.firstMessageOnly),
                oneTimeOnly: Boolean(triggerData.oneTimeOnly),
                enabled: true,
            };

            console.log('[Save] Trigger extracted from node:', trigger);

            const payload = {
                account_id: accountId,
                workspace_id: workspaceId,
                name: flow.name,
                description: flow.description,
                nodes: flow.nodes,
                edges: flow.edges,
                trigger: trigger,
                variables: flow.variables || {},
                flow_config: {
                    ...(flow.flowConfig || {}),
                },
            };

            const url = flow.id
                ? `${WHATSAPP_REST_API_PREFIX}/interactive-automations/${flow.id}`
                : `${WHATSAPP_REST_API_PREFIX}/interactive-automations`;
            const method = flow.id ? 'PUT' : 'POST';

            const res = await cachedFetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (data.success) {
                setFlow((prev) => ({
                    ...prev,
                    id: data.automation.id,
                    status: data.automation.status || prev.status,
                    variables: data.automation.variables ?? prev.variables,
                    flowConfig: data.automation.flowConfig ?? data.automation.flow_config ?? prev.flowConfig,
                }));
                setIsDirty(false);
                toast({ title: 'Saved!', description: 'Automation saved as draft' });

                // Update URL if new automation
                if (!flow.id && data.automation.id) {
                    navigate(`${basePath}/whatsapp/interactive-automation/${data.automation.id}`, {
                        replace: true,
                    });
                }
                return true;
            } else {
                throw new Error(data.error || 'Failed to save');
            }
        } catch (err: any) {
            toast({
                title: 'Save failed',
                description: err.message || 'Something went wrong',
                variant: 'destructive',
            });
            return false;
        } finally {
            setIsSaving(false);
        }
    }, [flow, accountId, workspaceId, navigate]);

    const handlePublish = useCallback(async () => {
        const issues = validateFlow(flow);
        if (hasErrors(issues)) {
            toast({
                title: 'Cannot publish',
                description: 'Please fix all errors first',
                variant: 'destructive',
            });
            return;
        }

        // Save first if dirty
        if (isDirty || !flow.id) {
            const saveOk = await handleSave();
            if (!saveOk) {
                return;
            }
        }

        if (!flow.id) {
            toast({
                title: 'Save required',
                description: 'Please save the automation first',
                variant: 'destructive',
            });
            return;
        }

        try {
            setIsPublishing(true);

            const res = await cachedFetch(
                `${WHATSAPP_REST_API_PREFIX}/interactive-automations/${flow.id}/publish`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                }
            );

            const data = await res.json();

            if (data.success) {
                setFlow((prev) => ({
                    ...prev,
                    status: data.automation?.status || prev.status,
                }));
                toast({
                    title: 'Published! 🎉',
                    description: 'Your automation is now live',
                });
            } else {
                throw new Error(data.error || 'Publish failed');
            }
        } catch (err: any) {
            toast({
                title: 'Publish failed',
                description: err.message || 'Something went wrong',
                variant: 'destructive',
            });
        } finally {
            setIsPublishing(false);
        }
    }, [flow, isDirty, handleSave]);

    // ==========================================================================
    // RENDER
    // ==========================================================================

    const selectedNode = useMemo(
        () => flow.nodes.find((n) => n.id === selectedNodeId) || null,
        [flow.nodes, selectedNodeId]
    );

    const hasBlockingErrors = useMemo(
        () => validationIssues.some(issue => issue.severity === 'error'),
        [validationIssues]
    );

    const backPath = useMemo(() => {
        const currentParams = new URLSearchParams(location.search);
        const params = new URLSearchParams();

        const workspaceIdForBack = workspaceId || currentParams.get('workspace_id');
        if (workspaceIdForBack) {
            params.set('workspace_id', workspaceIdForBack);
        }

        const accountIdForBack = accountId ? String(accountId) : currentParams.get('account_id');
        if (accountIdForBack) {
            params.set('account_id', accountIdForBack);
        }

        const query = params.toString();
        return `${basePath}/whatsapp/interactive-automation${query ? `?${query}` : ''}`;
    }, [basePath, workspaceId, accountId, location.search]);

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Loading automation...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-gray-50 overflow-x-hidden">
            {/* Toolbar */}
            <FlowToolbar
                flowName={flow.name}
                flowStatus={flow.status}
                isDirty={isDirty}
                isSaving={isSaving}
                isPublishing={isPublishing}
                validationIssues={validationIssues}
                onNameChange={handleNameChange}
                onSave={handleSave}
                onPublish={handlePublish}
                onAddMessageNode={handleAddMessageNode}
                onAddTemplateNode={handleAddTemplateNode}
                onAddInputNode={handleAddInputNode}
                onAddApiNode={handleAddApiNode}
                onAddLeadNode={handleAddLeadNode}
                onAddEndNode={handleAddEndNode}
                onAutoLayout={handleAutoLayout}
                onGenerateWithAi={handleOpenAiGenerator}
                onOpenFlowSettings={() => setVariablesDialogOpen(true)}
                hasFlowVariables={hasFlowToken}
            />

            <FlowVariablesDialog
                open={variablesDialogOpen}
                onOpenChange={setVariablesDialogOpen}
                value={flowVariablesState}
                onSave={handleFlowVariablesSave}
            />

            <AiFlowGeneratorDialog
                open={aiDialogOpen}
                onOpenChange={setAiDialogOpen}
                workspaceId={workspaceId}
                onGenerated={handleAiDraftApplied}
            />

            {/* Main Content */}
            <div className="flex-1 flex min-w-0 overflow-hidden">
                {/* Canvas */}
                <div className="flex-1 min-w-0 relative">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onInit={(instance) => { reactFlowInstance.current = instance; }}
                        onConnect={onConnect}
                        onEdgesDelete={onEdgesDelete}
                        onNodeClick={onNodeClick}
                        onPaneClick={onPaneClick}
                        nodeTypes={nodeTypes}
                        fitView
                        fitViewOptions={{ padding: 0.2 }}
                        className="flow-canvas"
                        deleteKeyCode={['Backspace', 'Delete']}
                        snapToGrid
                        snapGrid={[20, 20]}
                    >
                        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
                        <Controls />
                        <MiniMap
                            nodeStrokeWidth={3}
                            zoomable
                            pannable
                            style={{
                                backgroundColor: '#fff',
                                border: '1px solid #E5E7EB',
                                borderRadius: '8px',
                            }}
                        />

                        {/* Empty state hint */}
                        {flow.nodes.length <= 1 && (
                            <Panel position="top-center" className="mt-20">
                                <div className="bg-white rounded-lg shadow-lg p-4 text-center max-w-sm">
                                    <p className="text-gray-600 text-sm mb-2">
                                        Click <strong>"Add Node"</strong> to add your first message
                                    </p>
                                    <p className="text-gray-400 text-xs">
                                        Then connect the trigger to your message
                                    </p>
                                </div>
                            </Panel>
                        )}

                        {/* Validation Issues Panel */}
                        {validationIssues.length > 0 && (
                            <Panel position="bottom-center" className="mb-4 px-2">
                                <div className={`rounded-lg shadow-lg p-4 w-[calc(100vw-1rem)] sm:w-auto max-w-2xl ${hasBlockingErrors ? 'bg-red-50 border-2 border-red-300' : 'bg-amber-50 border-2 border-amber-300'}`}>
                                    <div className={`flex items-start gap-3`}>
                                        <div className="flex-shrink-0">
                                            {hasBlockingErrors ? (
                                                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-red-200">
                                                    <svg className="h-4 w-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-200">
                                                    <svg className="h-4 w-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className={`text-sm font-semibold ${hasBlockingErrors ? 'text-red-900' : 'text-amber-900'}`}>
                                                {hasBlockingErrors ? 'Cannot Publish: Fix These Errors' : 'Warnings'}
                                            </h3>
                                            <div className={`mt-2 text-sm ${hasBlockingErrors ? 'text-red-800' : 'text-amber-800'} space-y-1`}>
                                                {validationIssues.slice(0, 5).map((issue, idx) => (
                                                    <div key={idx} className="flex gap-2">
                                                        <span>•</span>
                                                        <span>{issue.message}</span>
                                                    </div>
                                                ))}
                                                {validationIssues.length > 5 && (
                                                    <div className="text-xs opacity-75">...and {validationIssues.length - 5} more issues</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Panel>
                        )}
                    </ReactFlow>
                </div>

                {/* Node Editor Panel */}
                {selectedNode && (
                    <>
                    <button
                        type="button"
                        className="fixed inset-0 top-14 bg-black/30 z-20 sm:hidden"
                        onClick={() => setSelectedNodeId(null)}
                        aria-label="Close node editor"
                    />
                    <div className="fixed top-14 bottom-0 right-0 z-30 w-[92vw] max-w-sm sm:static sm:inset-auto sm:z-auto sm:w-80 max-w-full node-editor-panel">
                        <NodeEditor
                            node={selectedNode}
                            allNodes={flow.nodes}
                            onUpdate={handleUpdateNode}
                            onDelete={handleDeleteNode}
                            onClose={() => setSelectedNodeId(null)}
                            onAddButton={
                                selectedNode.type === 'message' ? handleAddButton : undefined
                            }
                            onUpdateButton={
                                selectedNode.type === 'message' ? handleUpdateButton : undefined
                            }
                            onRemoveButton={
                                selectedNode.type === 'message' ? handleRemoveButton : undefined
                            }
                            templates={templates}
                            onSelectTemplate={
                                selectedNode.type === 'template' ? handleSelectTemplate : undefined
                            }
                            onUpdateButtonMapping={
                                selectedNode.type === 'template' ? handleUpdateButtonMapping : undefined
                            }
                            workspaceId={workspaceId}
                            flowVariables={flow.variables}
                            automationId={flow.id}
                            onOpenFlowVariables={() => setVariablesDialogOpen(true)}
                        />
                    </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default InteractiveAutomation;
