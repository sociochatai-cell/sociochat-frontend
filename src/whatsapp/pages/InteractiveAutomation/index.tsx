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
import { API_BASE_URL } from '@/config';

// Local imports
import { TriggerNode, MessageNode, TemplateNode, InputNode, ApiNode, EndNode } from './nodes';
import { NodeEditor } from './panels';
import { TemplateSelectPanel } from './panels/TemplateSelectPanel';
import { FlowToolbar } from './FlowToolbar';
import {
    AiFlowGeneratorDialog,
    draftToAutomationFlow,
    type GeneratedFlowDraft,
} from './components/AiFlowGeneratorDialog';
import {
    FlowVariablesDialog,
    type FlowVariablesState,
} from './components/FlowVariablesDialog';
import {
    generateId,
    generateButtonId,
    validateFlow,
    hasErrors,
    addMessageNode,
    addEndNode,
    updateNode,
    deleteNode,
    addButton,
    updateButton,
    removeButton,
    calculateAutoLayout,
    addEdge as addFlowEdge,
    removeEdge as removeFlowEdge,
} from './flowUtils';
import {
    createEmptyFlow,
    createDefaultTriggerNode,
    createDefaultInputNode,
    createDefaultApiNode,
    EDGE_COLORS,
} from './constants';
import type {
    AutomationFlow,
    FlowNode,
    FlowEdge,
    ValidationIssue,
    MessageButton,
} from './types';
import './interactive-automation.css';

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
};

// =============================================================================
// Helper Functions
// =============================================================================

// Convert our FlowNode[] to ReactFlow Node[]
const toReactFlowNodes = (nodes: FlowNode[]): Node[] => {
    return nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
    }));
};

// Convert our FlowEdge[] to ReactFlow Edge[]
const toReactFlowEdges = (edges: FlowEdge[]): Edge[] => {
    return edges.map((edge) => ({
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
    const workspaceId = localStorage.getItem('sv_whatsapp_workspace_id') ||
        sessionStorage.getItem('sv_whatsapp_workspace_id') || '';

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

    // Template selector modal state
    const [isTemplateSelectOpen, setIsTemplateSelectOpen] = useState(false);

    // AI generator & flow variables dialog state
    const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
    const [isVariablesDialogOpen, setIsVariablesDialogOpen] = useState(false);

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
                const res = await fetch(
                    `${API_BASE_URL}/api/whatsapp/accounts?workspace_id=${workspaceId}`
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
            const res = await fetch(`${API_BASE_URL}/api/whatsapp/interactive-automations/${flowId}`);
            const data = await res.json();

            if (data.success && data.automation) {
                const loadedFlow: AutomationFlow = {
                    id: data.automation.id,
                    name: data.automation.name,
                    description: data.automation.description,
                    accountId: data.automation.account_id,
                    workspaceId: data.automation.workspace_id,
                    nodes: data.automation.nodes || [],
                    edges: data.automation.edges || [],
                    trigger: data.automation.trigger || { type: 'any_reply', enabled: true },
                    variables: data.automation.variables || {},
                    flowConfig: data.automation.flow_config || data.automation.flowConfig || {},
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
                navigate('/dashboard/automation');
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
        }, 300);
        return () => clearTimeout(timeout);
    }, [flow]);

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

    const handleAddMessageNode = useCallback(() => {
        // Get current viewport center for positioning
        let position: { x: number; y: number } | undefined;
        if (reactFlowInstance.current) {
            const viewport = reactFlowInstance.current.getViewport();
            // Calculate position relative to viewport center
            // Account for zoom level and current pan position
            const zoom = viewport.zoom || 1;
            const containerWidth = 800; // Approximate visible width
            const containerHeight = 600; // Approximate visible height
            position = {
                x: (-viewport.x + containerWidth / 2) / zoom,
                y: (-viewport.y + containerHeight / 2) / zoom,
            };
        }

        const updatedFlow = addMessageNode(flow, position);
        setFlow(updatedFlow);
        setNodes(toReactFlowNodes(updatedFlow.nodes));
        setIsDirty(true);

        // Select the new node
        const newNode = updatedFlow.nodes[updatedFlow.nodes.length - 1];
        setSelectedNodeId(newNode.id);

        // Pan to the new node after a short delay
        setTimeout(() => {
            if (reactFlowInstance.current && newNode) {
                reactFlowInstance.current.setCenter(
                    newNode.position.x + 150, // Center on the node (node width/2)
                    newNode.position.y + 100, // Center on the node (node height/2)
                    { zoom: 1, duration: 500 }
                );
            }
        }, 50);
    }, [flow]);

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

    // Compute a position near the current viewport center (mirrors existing add-node UX)
    const getViewportCenterPosition = useCallback((): { x: number; y: number } => {
        if (reactFlowInstance.current) {
            const viewport = reactFlowInstance.current.getViewport();
            const zoom = viewport.zoom || 1;
            const containerWidth = 800;
            const containerHeight = 600;
            return {
                x: (-viewport.x + containerWidth / 2) / zoom,
                y: (-viewport.y + containerHeight / 2) / zoom,
            };
        }
        return { x: 300, y: 300 };
    }, []);

    const handleAddInputNode = useCallback(() => {
        const position = getViewportCenterPosition();
        const newNode = createDefaultInputNode(generateId('input'), position);
        const updatedFlow = { ...flow, nodes: [...flow.nodes, newNode] };
        setFlow(updatedFlow);
        setNodes(toReactFlowNodes(updatedFlow.nodes));
        setIsDirty(true);
        setSelectedNodeId(newNode.id);

        setTimeout(() => {
            if (reactFlowInstance.current) {
                reactFlowInstance.current.setCenter(
                    newNode.position.x + 160,
                    newNode.position.y + 110,
                    { zoom: 1, duration: 500 }
                );
            }
        }, 50);
    }, [flow, getViewportCenterPosition, setNodes]);

    const handleAddApiNode = useCallback(() => {
        const position = getViewportCenterPosition();
        const newNode = createDefaultApiNode(generateId('api'), position);
        const updatedFlow = { ...flow, nodes: [...flow.nodes, newNode] };
        setFlow(updatedFlow);
        setNodes(toReactFlowNodes(updatedFlow.nodes));
        setIsDirty(true);
        setSelectedNodeId(newNode.id);

        setTimeout(() => {
            if (reactFlowInstance.current) {
                reactFlowInstance.current.setCenter(
                    newNode.position.x + 160,
                    newNode.position.y + 120,
                    { zoom: 1, duration: 500 }
                );
            }
        }, 50);
    }, [flow, getViewportCenterPosition, setNodes]);

    const handleAddTemplateNode = useCallback(() => {
        if (!accountId) {
            toast({
                title: 'No account',
                description: 'Please connect a WhatsApp account first',
                variant: 'destructive',
            });
            return;
        }
        setIsTemplateSelectOpen(true);
    }, [accountId]);

    const handleTemplateSelected = useCallback(
        (template: any) => {
            setIsTemplateSelectOpen(false);

            // Calculate position
            let position: { x: number; y: number } = { x: 300, y: 300 };
            if (reactFlowInstance.current) {
                const viewport = reactFlowInstance.current.getViewport();
                const zoom = viewport.zoom || 1;
                position = {
                    x: (-viewport.x + 400) / zoom,
                    y: (-viewport.y + 300) / zoom,
                };
            }

            // Create template node with buttons as handles
            const nodeId = generateId();
            const buttons = (template.buttons || []).map((btn: any, idx: number) => ({
                index: btn.index,
                text: btn.text,
                handleId: `${nodeId}-btn-${idx}`,
                payload: `${nodeId}-btn-${idx}`,
            }));

            const templateNode = {
                id: nodeId,
                type: 'template' as const,
                position,
                data: {
                    templateId: template.id,
                    templateName: template.name,
                    languageCode: template.language,
                    category: template.category,
                    headerText: template.headerText,
                    bodyText: template.bodyText,
                    footerText: template.footerText,
                    buttons,
                    variableCount: template.variableCount || 0,
                },
            };

            const updatedFlow = {
                ...flow,
                nodes: [...flow.nodes, templateNode as any],
            };

            setFlow(updatedFlow);
            setNodes(toReactFlowNodes(updatedFlow.nodes));
            setIsDirty(true);
            setSelectedNodeId(nodeId);

            setTimeout(() => {
                if (reactFlowInstance.current) {
                    reactFlowInstance.current.setCenter(
                        position.x + 160,
                        position.y + 110,
                        { zoom: 1, duration: 500 }
                    );
                }
            }, 50);
        },
        [flow]
    );

    const handleAutoLayout = useCallback(() => {
        const layoutedFlow = calculateAutoLayout(flow);
        setFlow(layoutedFlow);
        setNodes(toReactFlowNodes(layoutedFlow.nodes));
        setIsDirty(true);
        toast({ title: 'Layout applied', description: 'Nodes have been rearranged' });
    }, [flow]);

    // Apply an AI-generated flow draft to the current canvas
    const handleAiDraftApplied = useCallback(
        (draft: GeneratedFlowDraft) => {
            const acct = accountId || flow.accountId || 0;
            const nextFlow = draftToAutomationFlow(draft, acct, workspaceId, flow.id);
            const layouted = calculateAutoLayout(nextFlow);

            setFlow(layouted);
            setNodes(toReactFlowNodes(layouted.nodes));
            setEdges(toReactFlowEdges(layouted.edges));
            setSelectedNodeId(null);
            setIsDirty(true);

            // Prompt for the API token if the draft needs one but none is set
            if (!layouted.variables?.flow_api_token) {
                const usesApiToken = JSON.stringify(layouted.nodes).includes('{{flow_api_token}}');
                if (usesApiToken) setIsVariablesDialogOpen(true);
            }

            toast({
                title: 'AI flow applied',
                description: 'Review the generated nodes, set any flow variables, then save.',
            });
        },
        [accountId, flow.accountId, flow.id, workspaceId, setNodes, setEdges]
    );

    // Persist flow variables / default values from the Flow Variables dialog
    const handleFlowVariablesSave = useCallback(
        (next: FlowVariablesState) => {
            setFlow((prev) => ({
                ...prev,
                variables: next.variables,
                flowConfig: {
                    ...prev.flowConfig,
                    variableDefaults: next.variableDefaults,
                },
            }));
            setIsDirty(true);
            toast({
                title: 'Flow variables updated',
                description: 'Save the flow to persist tokens and defaults.',
            });
        },
        []
    );

    const flowVariablesState = useMemo(
        (): FlowVariablesState => ({
            variables: flow.variables || {},
            variableDefaults: flow.flowConfig?.variableDefaults || {},
        }),
        [flow.variables, flow.flowConfig]
    );

    const handleUpdateNode = useCallback(
        (updates: Partial<FlowNode['data']>) => {
            if (!selectedNodeId) return;
            const updatedFlow = updateNode(flow, selectedNodeId, updates);
            setFlow(updatedFlow);
            setNodes(toReactFlowNodes(updatedFlow.nodes));
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

    // ==========================================================================
    // SAVE & PUBLISH
    // ==========================================================================

    const handleSave = useCallback(async () => {
        if (!flow.name.trim()) {
            toast({
                title: 'Name required',
                description: 'Please enter an automation name',
                variant: 'destructive',
            });
            return;
        }

        try {
            setIsSaving(true);

            // Extract trigger settings from the trigger node
            const triggerNode = flow.nodes.find(n => n.type === 'trigger');
            const triggerData = (triggerNode?.data || {}) as { triggerType?: string; keywords?: string[] };

            // Build trigger object from trigger node data
            const trigger = {
                type: triggerData.triggerType || 'any_reply',
                keywords: triggerData.keywords || [],
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
                trigger: trigger,  // Use extracted trigger, not flow.trigger
                variables: flow.variables || {},
                flow_config: flow.flowConfig || {},
            };

            const url = flow.id
                ? `${API_BASE_URL}/api/whatsapp/interactive-automations/${flow.id}`
                : `${API_BASE_URL}/api/whatsapp/interactive-automations`;
            const method = flow.id ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (data.success) {
                setFlow((prev) => ({ ...prev, id: data.automation.id }));
                setIsDirty(false);
                toast({ title: 'Saved!', description: 'Automation saved as draft' });

                // Update URL if new automation
                if (!flow.id && data.automation.id) {
                    navigate(`${basePath}/interactive-automation/${data.automation.id}`, {
                        replace: true,
                    });
                }
            } else {
                throw new Error(data.error || 'Failed to save');
            }
        } catch (err: any) {
            toast({
                title: 'Save failed',
                description: err.message || 'Something went wrong',
                variant: 'destructive',
            });
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
            await handleSave();
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

            const res = await fetch(
                `${API_BASE_URL}/api/whatsapp/interactive-automations/${flow.id}/publish`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                }
            );

            const data = await res.json();

            if (data.success) {
                setFlow((prev) => ({ ...prev, status: 'published' }));
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
        <div className="h-screen flex flex-col bg-gray-50">
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
                onAddEndNode={handleAddEndNode}
                onAddInputNode={handleAddInputNode}
                onAddApiNode={handleAddApiNode}
                onAutoLayout={handleAutoLayout}
                onOpenAiGenerator={() => setIsAiDialogOpen(true)}
                onOpenFlowVariables={() => setIsVariablesDialogOpen(true)}
            />

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Canvas */}
                <div className="flex-1 relative">
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
                    </ReactFlow>
                </div>

                {/* Node Editor Panel */}
                {selectedNode && (
                    <div className="w-80 node-editor-panel">
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
                            flowVariables={flow.variables}
                            automationId={flow.id}
                            onOpenFlowVariables={() => setIsVariablesDialogOpen(true)}
                        />
                    </div>
                )}
            </div>

            {/* Template Selector Modal */}
            {accountId && (
                <TemplateSelectPanel
                    isOpen={isTemplateSelectOpen}
                    onClose={() => setIsTemplateSelectOpen(false)}
                    onSelect={handleTemplateSelected}
                    accountId={accountId}
                    workspaceId={workspaceId}
                />
            )}

            {/* AI Flow Generator Dialog */}
            <AiFlowGeneratorDialog
                open={isAiDialogOpen}
                onOpenChange={setIsAiDialogOpen}
                workspaceId={workspaceId}
                onGenerated={handleAiDraftApplied}
            />

            {/* Flow Variables Dialog */}
            <FlowVariablesDialog
                open={isVariablesDialogOpen}
                onOpenChange={setIsVariablesDialogOpen}
                value={flowVariablesState}
                onSave={handleFlowVariablesSave}
            />
        </div>
    );
}

export default InteractiveAutomation;
