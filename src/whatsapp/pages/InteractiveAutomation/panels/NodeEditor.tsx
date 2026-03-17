/**
 * NodeEditor Component
 * ====================
 * Right-side panel for editing the selected node.
 * Supports TriggerNode, MessageNode, TemplateNode, and EndNode editing.
 */

import React from 'react';
import {
    X,
    Trash2,
    Plus,
    ArrowRight,
    Link,
    Phone,
    MapPin,
    ShoppingBag,
    List,
    Zap,
    MessageCircle,
    FileText,
    CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type {
    FlowNode,
    TriggerNode,
    MessageNode,
    TemplateNode as TemplateNodeType,
    EndNode,
    MessageButton,
    ButtonActionType,
    TriggerType
} from '../types';
import { LIMITS, BUTTON_ACTION_LABELS, TRIGGER_TYPE_LABELS } from '../constants';

interface NodeEditorProps {
    node: FlowNode;
    allNodes: FlowNode[];
    onUpdate: (updates: Partial<FlowNode['data']>) => void;
    onDelete: () => void;
    onClose: () => void;
    onAddButton?: () => void;
    onUpdateButton?: (buttonId: string, updates: Partial<MessageButton>) => void;
    onRemoveButton?: (buttonId: string) => void;
}

const ButtonActionIcons: Record<ButtonActionType, React.ElementType> = {
    quick_reply: ArrowRight,
    url: Link,
    call: Phone,
    location: MapPin,
    catalog: ShoppingBag,
    product_list: List,
};

export function NodeEditor({
    node,
    allNodes,
    onUpdate,
    onDelete,
    onClose,
    onAddButton,
    onUpdateButton,
    onRemoveButton,
}: NodeEditorProps) {
    // Get available target nodes for quick_reply buttons
    const targetNodes = allNodes.filter(n =>
        n.id !== node.id && (n.type === 'message' || n.type === 'template' || n.type === 'end')
    );

    const renderTriggerEditor = () => {
        const data = node.data as TriggerNode['data'];

        return (
            <div className="space-y-4">
                <div>
                    <Label>Trigger Type</Label>
                    <Select
                        value={data.triggerType}
                        onValueChange={(value: TriggerType) =>
                            onUpdate({ triggerType: value })
                        }
                    >
                        <SelectTrigger className="mt-1.5">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(TRIGGER_TYPE_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {data.triggerType === 'keyword' && (
                    <div>
                        <Label>Keywords (comma separated)</Label>
                        <Input
                            className="mt-1.5"
                            placeholder="hello, hi, help"
                            value={data.keywords?.join(', ') || ''}
                            onChange={(e) => {
                                const keywords = e.target.value
                                    .split(',')
                                    .map(k => k.trim())
                                    .filter(Boolean);
                                onUpdate({ keywords });
                            }}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Automation triggers when message contains any of these words
                        </p>
                    </div>
                )}

                {data.triggerType === 'specific_template' && (
                    <div>
                        <Label>Template ID</Label>
                        <Input
                            className="mt-1.5"
                            placeholder="Enter template ID"
                            value={data.templateId || ''}
                            onChange={(e) => onUpdate({ templateId: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Triggers when customer replies to this template
                        </p>
                    </div>
                )}
            </div>
        );
    };

    const renderMessageEditor = () => {
        const data = node.data as MessageNode['data'];

        return (
            <div className="space-y-4">
                {/* Header */}
                <div>
                    <div className="flex items-center justify-between">
                        <Label>Header (optional)</Label>
                        <span className="text-xs text-muted-foreground">
                            {data.header?.length || 0}/{LIMITS.MAX_HEADER_LENGTH}
                        </span>
                    </div>
                    <Input
                        className="mt-1.5"
                        placeholder="Bold header text"
                        value={data.header || ''}
                        maxLength={LIMITS.MAX_HEADER_LENGTH}
                        onChange={(e) => onUpdate({ header: e.target.value })}
                    />
                </div>

                {/* Body */}
                <div>
                    <div className="flex items-center justify-between">
                        <Label>Message Body *</Label>
                        <span className="text-xs text-muted-foreground">
                            {data.body?.length || 0}/{LIMITS.MAX_BODY_LENGTH}
                        </span>
                    </div>
                    <Textarea
                        className="mt-1.5 min-h-[100px]"
                        placeholder="Your message to the customer..."
                        value={data.body || ''}
                        maxLength={LIMITS.MAX_BODY_LENGTH}
                        onChange={(e) => onUpdate({ body: e.target.value })}
                    />
                </div>

                {/* Footer */}
                <div>
                    <div className="flex items-center justify-between">
                        <Label>Footer (optional)</Label>
                        <span className="text-xs text-muted-foreground">
                            {data.footer?.length || 0}/{LIMITS.MAX_FOOTER_LENGTH}
                        </span>
                    </div>
                    <Input
                        className="mt-1.5"
                        placeholder="Small footer text"
                        value={data.footer || ''}
                        maxLength={LIMITS.MAX_FOOTER_LENGTH}
                        onChange={(e) => onUpdate({ footer: e.target.value })}
                    />
                </div>

                <Separator />

                {/* Buttons */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <Label>Buttons</Label>
                        <Badge variant="outline">
                            {data.buttons.length}/{LIMITS.MAX_BUTTONS_PER_MESSAGE}
                        </Badge>
                    </div>

                    <div className="space-y-3">
                        {data.buttons.map((button, index) => (
                            <ButtonEditor
                                key={button.id}
                                button={button}
                                index={index}
                                targetNodes={targetNodes}
                                onUpdate={(updates) => onUpdateButton?.(button.id, updates)}
                                onRemove={() => onRemoveButton?.(button.id)}
                            />
                        ))}
                    </div>

                    {data.buttons.length < LIMITS.MAX_BUTTONS_PER_MESSAGE && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-3"
                            onClick={onAddButton}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Button
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    const renderEndEditor = () => {
        const data = node.data as EndNode['data'];

        return (
            <div className="space-y-4">
                <div>
                    <Label>Final Message (optional)</Label>
                    <Textarea
                        className="mt-1.5"
                        placeholder="Thank you for contacting us!"
                        value={data.message || ''}
                        onChange={(e) => onUpdate({ message: e.target.value })}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <Label>Show Satisfaction Survey</Label>
                        <p className="text-xs text-muted-foreground">
                            Ask customer to rate the experience
                        </p>
                    </div>
                    <Switch
                        checked={data.showSatisfactionSurvey || false}
                        onCheckedChange={(checked) =>
                            onUpdate({ showSatisfactionSurvey: checked })
                        }
                    />
                </div>
            </div>
        );
    };

    const renderTemplateEditor = () => {
        const data = node.data as TemplateNodeType['data'];

        return (
            <div className="space-y-4">
                {/* Template Info (Read-only - approved by Meta) */}
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-semibold text-blue-800">
                            {data.templateName}
                        </span>
                    </div>
                    <div className="flex gap-2 mb-2">
                        <Badge className="text-[10px]" variant="outline">
                            {data.category}
                        </Badge>
                        <Badge className="text-[10px]" variant="outline">
                            {data.languageCode}
                        </Badge>
                    </div>
                    <p className="text-xs text-blue-700">
                        Template messages are pre-approved by Meta and cannot be edited here.
                    </p>
                </div>

                {/* Body Preview */}
                {data.bodyText && (
                    <div>
                        <Label>Body Preview</Label>
                        <div className="mt-1.5 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
                            {data.bodyText}
                        </div>
                    </div>
                )}

                {/* Header Preview */}
                {data.headerText && (
                    <div>
                        <Label>Header</Label>
                        <p className="mt-1 text-sm text-gray-600">{data.headerText}</p>
                    </div>
                )}

                {/* Footer Preview */}
                {data.footerText && (
                    <div>
                        <Label>Footer</Label>
                        <p className="mt-1 text-xs text-gray-400">{data.footerText}</p>
                    </div>
                )}

                <Separator />

                {/* Buttons Preview (Read-only) */}
                <div>
                    <Label>Quick Reply Buttons</Label>
                    <div className="mt-2 space-y-1.5">
                        {data.buttons.map((btn, idx) => (
                            <div
                                key={btn.handleId}
                                className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 border border-gray-200"
                            >
                                <ArrowRight className="w-3 h-3 text-blue-500" />
                                <span className="text-sm text-gray-700">{btn.text}</span>
                                <span className="ml-auto text-[10px] text-gray-400">Button {idx + 1}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2">
                        Connect buttons to other nodes by dragging from the blue handles.
                    </p>
                </div>

                {/* Variable count info */}
                {data.variableCount > 0 && (
                    <>
                        <Separator />
                        <div>
                            <Label>Variables</Label>
                            <p className="text-xs text-gray-500 mt-1">
                                This template has {data.variableCount} variable{data.variableCount > 1 ? 's' : ''}.
                                Variable values will be populated at send time.
                            </p>
                        </div>
                    </>
                )}
            </div>
        );
    };

    const getNodeIcon = () => {
        switch (node.type) {
            case 'trigger': return <Zap className="w-5 h-5 text-indigo-600" />;
            case 'message': return <MessageCircle className="w-5 h-5 text-green-600" />;
            case 'template': return <FileText className="w-5 h-5 text-blue-600" />;
            case 'end': return <CheckCircle className="w-5 h-5 text-amber-600" />;
            default: return null;
        }
    };

    const getNodeTitle = () => {
        switch (node.type) {
            case 'trigger': return 'Trigger Settings';
            case 'message': return 'Message Settings';
            case 'template': return 'Template Settings';
            case 'end': return 'End Settings';
            default: return 'Node Settings';
        }
    };

    return (
        <div className="h-full flex flex-col bg-white border-l border-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                    {getNodeIcon()}
                    <span className="font-semibold text-sm">{getNodeTitle()}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>
                    <X className="w-4 h-4" />
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {node.type === 'trigger' && renderTriggerEditor()}
                {node.type === 'message' && renderMessageEditor()}
                {node.type === 'template' && renderTemplateEditor()}
                {node.type === 'end' && renderEndEditor()}
            </div>

            {/* Footer Actions */}
            {node.type !== 'trigger' && (
                <div className="p-4 border-t border-gray-200">
                    <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={onDelete}
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Node
                    </Button>
                </div>
            )}
        </div>
    );
}

// =============================================================================
// Button Editor Sub-component
// =============================================================================

interface ButtonEditorProps {
    button: MessageButton;
    index: number;
    targetNodes: FlowNode[];
    onUpdate: (updates: Partial<MessageButton>) => void;
    onRemove: () => void;
}

function ButtonEditor({ button, index, targetNodes, onUpdate, onRemove }: ButtonEditorProps) {
    const Icon = ButtonActionIcons[button.action.type] || ArrowRight;

    return (
        <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-medium text-gray-600">
                        Button {index + 1}
                    </span>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                    onClick={onRemove}
                >
                    <Trash2 className="w-3 h-3" />
                </Button>
            </div>

            {/* Button Label */}
            <div>
                <Label className="text-xs">Label</Label>
                <Input
                    className="mt-1 h-8 text-sm"
                    placeholder="Button text"
                    value={button.label}
                    maxLength={LIMITS.MAX_BUTTON_LABEL_LENGTH}
                    onChange={(e) => onUpdate({ label: e.target.value })}
                />
            </div>

            {/* Action Type */}
            <div>
                <Label className="text-xs">Action</Label>
                <Select
                    value={button.action.type}
                    onValueChange={(value: ButtonActionType) => {
                        // Reset action data when type changes
                        let newAction: MessageButton['action'];
                        switch (value) {
                            case 'quick_reply':
                                newAction = { type: 'quick_reply', targetNodeId: null };
                                break;
                            case 'url':
                                newAction = { type: 'url', url: '' };
                                break;
                            case 'call':
                                newAction = { type: 'call', phoneNumber: '' };
                                break;
                            case 'location':
                                newAction = { type: 'location' };
                                break;
                            case 'catalog':
                                newAction = { type: 'catalog' };
                                break;
                            case 'product_list':
                                newAction = { type: 'product_list' };
                                break;
                            default:
                                newAction = { type: 'quick_reply', targetNodeId: null };
                        }
                        onUpdate({ action: newAction });
                    }}
                >
                    <SelectTrigger className="mt-1 h-8 text-sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(BUTTON_ACTION_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Action-specific fields */}
            {button.action.type === 'quick_reply' && (
                <div>
                    <Label className="text-xs">Navigate to</Label>
                    <Select
                        value={button.action.targetNodeId || '_none'}
                        onValueChange={(value) =>
                            onUpdate({
                                action: {
                                    type: 'quick_reply',
                                    targetNodeId: value === '_none' ? null : value
                                }
                            })
                        }
                    >
                        <SelectTrigger className="mt-1 h-8 text-sm">
                            <SelectValue placeholder="Select target..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_none">Not connected</SelectItem>
                            {targetNodes.map((node) => (
                                <SelectItem key={node.id} value={node.id}>
                                    {node.type === 'end'
                                        ? `End: ${(node.data as EndNode['data']).message?.slice(0, 20) || 'End node'}`
                                        : `Message: ${(node.data as MessageNode['data']).body?.slice(0, 20) || 'New message'}...`
                                    }
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {button.action.type === 'url' && (
                <div>
                    <Label className="text-xs">URL</Label>
                    <Input
                        className="mt-1 h-8 text-sm"
                        placeholder="https://example.com"
                        value={button.action.url || ''}
                        onChange={(e) =>
                            onUpdate({
                                action: { type: 'url', url: e.target.value }
                            })
                        }
                    />
                </div>
            )}

            {button.action.type === 'call' && (
                <div>
                    <Label className="text-xs">Phone Number</Label>
                    <Input
                        className="mt-1 h-8 text-sm"
                        placeholder="+1234567890"
                        value={button.action.phoneNumber || ''}
                        onChange={(e) =>
                            onUpdate({
                                action: { type: 'call', phoneNumber: e.target.value }
                            })
                        }
                    />
                </div>
            )}

            {button.action.type === 'catalog' && (
                <div>
                    <Label className="text-xs">Catalog ID (optional)</Label>
                    <Input
                        className="mt-1 h-8 text-sm"
                        placeholder="Leave empty for default catalog"
                        value={(button.action as any).catalogId || ''}
                        onChange={(e) =>
                            onUpdate({
                                action: { type: 'catalog', catalogId: e.target.value }
                            })
                        }
                    />
                </div>
            )}
        </div>
    );
}
