/**
 * NodeEditor Component
 * ====================
 * Right-side panel for editing the selected node.
 * Supports TriggerNode, MessageNode, TemplateNode, and EndNode editing.
 */

import React, { useState, useRef } from 'react';
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
    CheckCircle,
    FileText,
    FileDown,
    Upload,
    Image,
    Loader2,
    Video,
    File,
    Keyboard,
    Plug,
} from 'lucide-react';
import { API_BASE_URL, WHATSAPP_REST_API_PREFIX } from "@/config";
import { cachedFetch } from '../../../utils/waPersistentCache';
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
    TemplateNode,
    EndNode,
    InputNode,
    MessageButton,
    ButtonActionType,
    TriggerType,
    TemplateButtonMapping,
    ValidationType,
    ApiNode,
    LeadNode,
} from '../types';
import { LIMITS, BUTTON_ACTION_LABELS, TRIGGER_TYPE_LABELS, VALIDATION_TYPE_LABELS } from '../constants';
import { ApiNodeEditor } from './ApiNodeEditor';
import {
    LeadConfigSection,
    useLeadOptions,
    OPERATOR_OPTIONS,
    VALUELESS_OPERATORS,
} from './LeadConfigSection';
import type { LeadAction, LeadActionCondition, LeadActionOperator } from '../types';
import { UserPlus } from 'lucide-react';

interface NodeEditorProps {
    node: FlowNode;
    allNodes: FlowNode[];
    onUpdate: (updates: Partial<FlowNode['data']>) => void;
    onDelete: () => void;
    onClose: () => void;
    onAddButton?: () => void;
    onUpdateButton?: (buttonId: string, updates: Partial<MessageButton>) => void;
    onRemoveButton?: (buttonId: string) => void;
    // Template-specific props
    templates?: Array<{
        id: number;
        name: string;
        language: string;
        category: string;
        status: string;
        components: any[];
    }>;
    onSelectTemplate?: (templateId: number) => void;
    onUpdateButtonMapping?: (index: number, targetNodeId: string | null) => void;
    // For file uploads
    workspaceId?: string;
    flowVariables?: Record<string, string>;
    automationId?: number;
    onOpenFlowVariables?: () => void;
}

const ButtonActionIcons: Record<ButtonActionType, React.ElementType> = {
    quick_reply: ArrowRight,
    url: Link,
    call: Phone,
    location: MapPin,
    catalog: ShoppingBag,
    product_list: List,
    send_document: FileDown,
};

const getTargetNodeLabel = (targetNode: FlowNode): string => {
    if (targetNode.type === 'end') {
        const message = (targetNode.data as EndNode['data']).message?.trim();
        return message ? `End node: ${message.slice(0, 35)}` : 'End node';
    }

    if (targetNode.type === 'template') {
        const templateName = (targetNode.data as TemplateNode['data']).templateName?.trim();
        return templateName ? `Template node: ${templateName.slice(0, 35)}` : 'Template node';
    }

    if (targetNode.type === 'input') {
        const body = (targetNode.data as InputNode['data']).body?.trim();
        return body ? `Input node: ${body.slice(0, 35)}` : 'Input node';
    }

    if (targetNode.type === 'api') {
        const label = (targetNode.data as ApiNode['data']).label?.trim();
        return label ? `API node: ${label.slice(0, 35)}` : 'API node';
    }

    if (targetNode.type === 'lead') {
        const stage = (targetNode.data as LeadNode['data']).stage?.trim();
        return stage ? `Lead node → ${stage.slice(0, 30)}` : 'Lead node';
    }

    const body = (targetNode.data as MessageNode['data']).body?.trim();
    return body ? `Message node: ${body.slice(0, 35)}` : 'Message node';
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
    templates,
    onSelectTemplate,
    onUpdateButtonMapping,
    workspaceId,
    flowVariables,
    automationId,
    onOpenFlowVariables,
}: NodeEditorProps) {
    // File upload state
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [uploadingDocument, setUploadingDocument] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const documentInputRef = useRef<HTMLInputElement>(null);

    // Lead taxonomy (lead types + pipeline stages). Must be called unconditionally here
    // to satisfy the Rules of Hooks — it previously lived inside renderLeadEditor(), which
    // is only invoked when node.type === 'lead'. Switching between a lead node and another
    // node type then changed NodeEditor's hook count between renders → React error #310
    // ("Rendered more hooks than during the previous render"). The `active` flag still gates
    // the network fetch, so non-lead nodes pay no request cost.
    const leadOptions = useLeadOptions(node.type === 'lead');

    // Get available target nodes for quick_reply buttons
    const targetNodes = allNodes.filter(n =>
        n.id !== node.id && (n.type === 'message' || n.type === 'template' || n.type === 'end' || n.type === 'lead')
    );

    // Upload file to DigitalOcean Spaces
    const handleFileUpload = async (
        file: File,
        mediaType: 'image' | 'video' | 'document',
        setUploading: (v: boolean) => void
    ) => {
        if (!workspaceId) {
            console.error('No workspace ID for upload');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('workspace_id', workspaceId);
        formData.append('is_public', 'true');

        try {
            const res = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/media/upload/public`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            const json = await res.json();
            const url = json.url || json.public_url;

            if (json.success && url) {
                if (mediaType === 'image') {
                    onUpdate({ headerImageUrl: url });
                } else if (mediaType === 'video') {
                    onUpdate({ headerVideoUrl: url });
                } else if (mediaType === 'document') {
                    onUpdate({ 
                        headerDocumentUrl: url,
                        headerDocumentFilename: file.name
                    });
                }
            } else {
                console.error('Upload failed:', json.error);
            }
        } catch (err) {
            console.error('Upload error:', err);
        } finally {
            setUploading(false);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileUpload(file, 'image', setUploadingImage);
        }
        e.target.value = '';
    };

    const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileUpload(file, 'video', setUploadingVideo);
        }
        e.target.value = '';
    };

    const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileUpload(file, 'document', setUploadingDocument);
        }
        e.target.value = '';
    };

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

                <Separator className="my-2" />

                {/* First Message Only Toggle */}
                <div
                    className={`
                        flex items-center justify-between p-3 rounded-xl border transition-all duration-200
                        ${data.firstMessageOnly
                            ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 shadow-[0_8px_22px_-14px_rgba(37,99,235,0.7)]'
                            : 'bg-gradient-to-br from-slate-50 to-blue-50/70 border-blue-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_12px_-10px_rgba(37,99,235,0.45)]'
                        }
                    `}
                >
                    <div className="flex-1">
                        <Label className="text-sm font-medium text-blue-900">First Message Only</Label>
                        <p className="text-xs text-blue-700 mt-1">
                            When enabled, automation only triggers for the first message from a customer
                        </p>
                    </div>
                    <Switch
                        checked={data.firstMessageOnly || false}
                        onCheckedChange={(checked) => {
                            if (checked) {
                                onUpdate({ firstMessageOnly: true, oneTimeOnly: false });
                                return;
                            }
                            onUpdate({ firstMessageOnly: false });
                        }}
                        className="
                            ml-3
                            border border-blue-200/80
                            shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_10px_-7px_rgba(30,64,175,0.6)]
                            data-[state=checked]:bg-blue-600 data-[state=checked]:shadow-[0_6px_14px_-8px_rgba(37,99,235,0.85)]
                            data-[state=unchecked]:bg-white/90
                            [&>span]:bg-white [&>span]:border [&>span]:border-blue-200 [&>span]:shadow-sm
                            data-[state=unchecked]:[&>span]:bg-blue-100 data-[state=checked]:[&>span]:bg-white
                        "
                    />
                </div>

                {/* One Time Only Toggle */}
                <div
                    className={`
                        flex items-center justify-between p-3 rounded-xl border transition-all duration-200
                        ${data.oneTimeOnly
                            ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 shadow-[0_8px_22px_-14px_rgba(5,150,105,0.7)]'
                            : 'bg-gradient-to-br from-slate-50 to-emerald-50/70 border-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_12px_-10px_rgba(5,150,105,0.45)]'
                        }
                    `}
                >
                    <div className="flex-1">
                        <Label className="text-sm font-medium text-emerald-900">One Time Only</Label>
                        <p className="text-xs text-emerald-700 mt-1">
                            When enabled, automation triggers once per customer for this automation, even if they messaged before
                        </p>
                    </div>
                    <Switch
                        checked={data.oneTimeOnly || false}
                        onCheckedChange={(checked) => {
                            if (checked) {
                                onUpdate({ oneTimeOnly: true, firstMessageOnly: false });
                                return;
                            }
                            onUpdate({ oneTimeOnly: false });
                        }}
                        className="
                            ml-3
                            border border-emerald-200/80
                            shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_10px_-7px_rgba(6,95,70,0.6)]
                            data-[state=checked]:bg-emerald-600 data-[state=checked]:shadow-[0_6px_14px_-8px_rgba(5,150,105,0.85)]
                            data-[state=unchecked]:bg-white/90
                            [&>span]:bg-white [&>span]:border [&>span]:border-emerald-200 [&>span]:shadow-sm
                            data-[state=unchecked]:[&>span]:bg-emerald-100 data-[state=checked]:[&>span]:bg-white
                        "
                    />
                </div>

                <LeadConfigSection
                    value={(node.data as TriggerNode['data'] & { leadAction?: LeadAction }).leadAction}
                    onChange={(leadAction: LeadAction) => onUpdate({ leadAction } as Partial<FlowNode['data']>)}
                />
            </div>
        );
    };

    const renderMessageEditor = () => {
        const data = node.data as MessageNode['data'];

        return (
            <div className="space-y-4">
                {/* Header Type Selection */}
                <div>
                    <Label>Header Type</Label>
                    <Select
                        value={data.headerType || 'text'}
                        onValueChange={(value: 'text' | 'image' | 'video' | 'document') =>
                            onUpdate({ headerType: value })
                        }
                    >
                        <SelectTrigger className="mt-1.5">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="text">Text</SelectItem>
                            <SelectItem value="image">Image</SelectItem>
                            <SelectItem value="video">Video</SelectItem>
                            <SelectItem value="document">Document</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                
                {/* Interactive Message Type */}
                <div>
                    <Label>Interactive Type</Label>
                    <Select
                        value={data.interactiveType || 'button'}
                        onValueChange={(value: 'button' | 'list') =>
                            onUpdate({ interactiveType: value })
                        }
                    >
                        <SelectTrigger className="mt-1.5">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="button">Reply Buttons</SelectItem>
                            <SelectItem value="list">List Menu (sections/rows)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Text Header */}
                {(!data.headerType || data.headerType === 'text') && (
                    <div>
                        <div className="flex items-center justify-between">
                            <Label>Header Text (optional)</Label>
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
                )}

                {/* Image Header */}
                {data.headerType === 'image' && (
                    <div className="space-y-3">
                        <Label>Header Image</Label>
                        <input
                            ref={imageInputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png"
                            className="hidden"
                            onChange={handleImageChange}
                        />
                        {data.headerImageUrl ? (
                            <div className="relative">
                                <img 
                                    src={data.headerImageUrl} 
                                    alt="Header preview" 
                                    className="w-full h-32 object-cover rounded-lg border"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-2 right-2 h-7 w-7 p-0"
                                    onClick={() => onUpdate({ headerImageUrl: undefined })}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                className="w-full h-24 flex flex-col gap-2"
                                onClick={() => imageInputRef.current?.click()}
                                disabled={uploadingImage}
                            >
                                {uploadingImage ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span className="text-xs">Uploading...</span>
                                    </>
                                ) : (
                                    <>
                                        <Image className="w-6 h-6 text-gray-400" />
                                        <span className="text-xs text-gray-500">Click to upload image</span>
                                    </>
                                )}
                            </Button>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Supported: JPG, PNG. Max 5MB.
                        </p>
                    </div>
                )}

                {/* Video Header */}
                {data.headerType === 'video' && (
                    <div className="space-y-3">
                        <Label>Header Video</Label>
                        <input
                            ref={videoInputRef}
                            type="file"
                            accept="video/mp4"
                            className="hidden"
                            onChange={handleVideoChange}
                        />
                        {data.headerVideoUrl ? (
                            <div className="relative">
                                <video 
                                    src={data.headerVideoUrl}
                                    className="w-full h-32 object-cover rounded-lg border"
                                    controls
                                />
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-2 right-2 h-7 w-7 p-0"
                                    onClick={() => onUpdate({ headerVideoUrl: undefined })}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                className="w-full h-24 flex flex-col gap-2"
                                onClick={() => videoInputRef.current?.click()}
                                disabled={uploadingVideo}
                            >
                                {uploadingVideo ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span className="text-xs">Uploading...</span>
                                    </>
                                ) : (
                                    <>
                                        <Video className="w-6 h-6 text-gray-400" />
                                        <span className="text-xs text-gray-500">Click to upload video</span>
                                    </>
                                )}
                            </Button>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Supported: MP4. Max 16MB.
                        </p>
                    </div>
                )}

                {/* Document Header */}
                {data.headerType === 'document' && (
                    <div className="space-y-3">
                        <Label>Header Document</Label>
                        <input
                            ref={documentInputRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                            className="hidden"
                            onChange={handleDocumentChange}
                        />
                        {data.headerDocumentUrl ? (
                            <div className="relative p-3 border rounded-lg bg-gray-50">
                                <div className="flex items-center gap-2">
                                    <File className="w-8 h-8 text-blue-500" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {data.headerDocumentFilename || 'document'}
                                        </p>
                                        <p className="text-xs text-gray-500 truncate">
                                            {data.headerDocumentUrl}
                                        </p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                        onClick={() => onUpdate({ 
                                            headerDocumentUrl: undefined,
                                            headerDocumentFilename: undefined 
                                        })}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button
                                variant="outline"
                                className="w-full h-24 flex flex-col gap-2"
                                onClick={() => documentInputRef.current?.click()}
                                disabled={uploadingDocument}
                            >
                                {uploadingDocument ? (
                                    <>
                                        <Loader2 className="w-6 h-6 animate-spin" />
                                        <span className="text-xs">Uploading...</span>
                                    </>
                                ) : (
                                    <>
                                        <FileText className="w-6 h-6 text-gray-400" />
                                        <span className="text-xs text-gray-500">Click to upload document</span>
                                    </>
                                )}
                            </Button>
                        )}
                        <p className="text-xs text-muted-foreground">
                            Supported: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX. Max 100MB.
                        </p>
                    </div>
                )}

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

                {/* Buttons (Interactive Type === 'button') */}
                {(data.interactiveType === 'button' || !data.interactiveType) && (
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
                                    workspaceId={workspaceId}
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
                )}

                {/* List Menu (Interactive Type === 'list') */}
                {data.interactiveType === 'list' && (
                    <div className="space-y-4">
                        {/* List CTA Button Text */}
                        <div>
                            <div className="flex items-center justify-between">
                                <Label className="font-semibold text-sm">Select Button Label *</Label>
                                <span className={`text-xs ${data.buttonText?.length >= 20 ? 'text-amber-600 font-bold' : 'text-gray-400'}`}>
                                    {data.buttonText?.length || 0}/20
                                </span>
                            </div>
                            <Input
                                className="mt-1.5"
                                placeholder="E.g. 'View Options'"
                                value={data.buttonText || ''}
                                maxLength={20}
                                onChange={(e) => onUpdate({ buttonText: e.target.value })}
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <Label>Sections</Label>
                            <Badge variant="outline">
                                {(data.sections || []).length}/{LIMITS.MAX_LIST_SECTIONS}
                            </Badge>
                        </div>

                        <div className="space-y-4">
                            {(data.sections || []).map((section, index) => (
                                <ListSectionEditor
                                    key={index}
                                    section={section}
                                    sectionIndex={index}
                                    targetNodes={targetNodes}
                                    onUpdate={(updates) => {
                                        const sections = [...(data.sections || [])];
                                        sections[index] = { ...sections[index], ...updates };
                                        onUpdate({ sections });
                                    }}
                                    onRemove={() => {
                                        const sections = (data.sections || []).filter((_, i) => i !== index);
                                        onUpdate({ sections });
                                    }}
                                />
                            ))}
                        </div>

                        {(data.sections || []).length < LIMITS.MAX_LIST_SECTIONS && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                    const sections = [...(data.sections || [])];
                                    sections.push({ title: '', rows: [] });
                                    onUpdate({ sections });
                                }}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Section
                            </Button>
                        )}
                    </div>
                )}

                <LeadConfigSection
                    value={data.leadAction}
                    onChange={(leadAction: LeadAction) => onUpdate({ leadAction })}
                />
            </div>
        );
    };

    const renderSetStatusEditor = () => {
        const data = node.data as { status?: string; mode?: string };
        const statuses = ['new', 'contacted', 'qualified', 'proposal', 'closed'];
        return (
            <div className="space-y-4">
                <div>
                    <Label>Lead Status</Label>
                    <Select value={data.status || 'qualified'} onValueChange={(v) => onUpdate({ status: v as any })}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {statuses.map((s) => (
                                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Mode</Label>
                    <Select value={data.mode || 'advance'} onValueChange={(v) => onUpdate({ mode: v as any })}>
                        <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="advance">Advance (only move forward)</SelectItem>
                            <SelectItem value="set">Set (force this exact status)</SelectItem>
                        </SelectContent>
                    </Select>
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

                <LeadConfigSection
                    value={(data as EndNode['data'] & { leadAction?: LeadAction }).leadAction}
                    onChange={(leadAction: LeadAction) => onUpdate({ leadAction } as Partial<FlowNode['data']>)}
                />
            </div>
        );
    };

    const renderTemplateEditor = () => {
        const data = node.data as TemplateNode['data'];

        return (
            <div className="space-y-4">
                {/* Template Selection */}
                <div>
                    <Label>Select Template</Label>
                    <Select
                        value={data.templateId?.toString() || '_none'}
                        onValueChange={(value) => {
                            if (value === '_none') return;
                            const templateId = parseInt(value);
                            onSelectTemplate?.(templateId);
                        }}
                    >
                        <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Choose a template..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="_none" disabled>Choose a template...</SelectItem>
                            {templates?.filter(t => t.status === 'APPROVED').map((template) => (
                                <SelectItem key={template.id} value={template.id.toString()}>
                                    <div className="flex items-center gap-2">
                                        <span>{template.name}</span>
                                        <Badge variant="outline" className="text-[10px]">
                                            {template.category}
                                        </Badge>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Selected Template Info */}
                {data.templateName && (
                    <>
                        <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm text-purple-800">
                                    {data.templateName}
                                </span>
                                <Badge 
                                    variant="outline"
                                    className={`text-[10px] ${
                                        data.templateStatus === 'APPROVED' 
                                            ? 'border-green-500 text-green-700' 
                                            : 'border-amber-500 text-amber-700'
                                    }`}
                                >
                                    {data.templateStatus}
                                </Badge>
                            </div>
                            <div className="text-xs text-purple-600">
                                Language: {data.templateLanguage} • Category: {data.templateCategory}
                            </div>
                        </div>

                        <Separator />

                        {/* Button Mappings */}
                        <div className="space-y-3">
                            <Label>Button Routing</Label>
                            <p className="text-xs text-muted-foreground">
                                Map quick reply or form buttons to continue the automation
                            </p>

                            {data.buttonMappings?.length > 0 ? (
                                data.buttonMappings.map((mapping, index) => (
                                    <div 
                                        key={index}
                                        className={`p-3 rounded-lg border ${
                                            (mapping.buttonType === 'quick_reply' || mapping.buttonType === 'flow')
                                                ? 'bg-gray-50 border-gray-200' 
                                                : 'bg-gray-100 border-gray-300 opacity-60'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            {mapping.buttonType === 'quick_reply' ? (
                                                <ArrowRight className="w-4 h-4 text-purple-500" />
                                            ) : mapping.buttonType === 'flow' ? (
                                                <FileText className="w-4 h-4 text-violet-500" />
                                            ) : mapping.buttonType === 'url' ? (
                                                <Link className="w-4 h-4 text-blue-500" />
                                            ) : (
                                                <Phone className="w-4 h-4 text-green-500" />
                                            )}
                                            <span className="text-sm font-medium">
                                                {mapping.buttonText}
                                            </span>
                                        </div>

                                        {(mapping.buttonType === 'quick_reply' || mapping.buttonType === 'flow') ? (
                                            <Select
                                                value={mapping.targetNodeId || '_none'}
                                                onValueChange={(value) =>
                                                    onUpdateButtonMapping?.(
                                                        index,
                                                        value === '_none' ? null : value
                                                    )
                                                }
                                            >
                                                <SelectTrigger className="h-8 text-sm">
                                                    <SelectValue placeholder="Select target..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="_none">Not connected</SelectItem>
                                                    {targetNodes.map((targetNode) => (
                                                        <SelectItem key={targetNode.id} value={targetNode.id}>
                                                            {getTargetNodeLabel(targetNode)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <p className="text-xs text-gray-500">
                                                {mapping.buttonType === 'url' 
                                                    ? 'Opens URL (exits automation)' 
                                                    : 'Calls phone (exits automation)'}
                                            </p>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-gray-400 italic">
                                    No buttons in this template
                                </p>
                            )}
                        </div>
                    </>
                )}

                <LeadConfigSection
                    value={(data as TemplateNode['data'] & { leadAction?: LeadAction }).leadAction}
                    onChange={(leadAction: LeadAction) => onUpdate({ leadAction } as Partial<FlowNode['data']>)}
                />
            </div>
        );
    };

    const renderInputEditor = () => {
        const data = node.data as InputNode['data'];

        return (
            <div className="space-y-4">
                {/* Save Field */}
                <div>
                    <Label className="font-semibold">Save answer to field *</Label>
                    <p className="text-xs text-muted-foreground mb-1">
                        Data will be saved as exactly this key (e.g. "name", "email", "city")
                    </p>
                    <Input
                        placeholder="e.g. name"
                        value={data.field || ''}
                        onChange={(e) => onUpdate({ field: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    />
                </div>

                {/* Question Body */}
                <div>
                    <div className="flex items-center justify-between">
                        <Label>Question Body *</Label>
                        <span className="text-xs text-muted-foreground">
                            {data.body?.length || 0}/{LIMITS.MAX_BODY_LENGTH}
                        </span>
                    </div>
                    <Textarea
                        className="mt-1.5 min-h-[80px]"
                        placeholder="What is your full name?"
                        value={data.body || ''}
                        maxLength={LIMITS.MAX_BODY_LENGTH}
                        onChange={(e) => onUpdate({ body: e.target.value })}
                    />
                </div>

                <Separator />

                {/* Validation Type */}
                <div>
                    <Label>Validation Type</Label>
                    <Select
                        value={data.validationType || 'text'}
                        onValueChange={(value: ValidationType) =>
                            onUpdate({ validationType: value })
                        }
                    >
                        <SelectTrigger className="mt-1.5">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(VALIDATION_TYPE_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Validation Parameters (conditional based on type) */}
                <div className="space-y-3 p-3 bg-slate-50 border rounded-lg">
                    {data.validationType === 'text' && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs">Min Length</Label>
                                    <Input
                                        type="number"
                                        className="h-8 mt-1"
                                        value={data.minLength || ''}
                                        onChange={(e) => onUpdate({ minLength: e.target.value ? parseInt(e.target.value) : undefined })}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Max Length</Label>
                                    <Input
                                        type="number"
                                        className="h-8 mt-1"
                                        value={data.maxLength || ''}
                                        onChange={(e) => onUpdate({ maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {data.validationType === 'number' && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label className="text-xs">Min Value</Label>
                                    <Input
                                        type="number"
                                        className="h-8 mt-1"
                                        value={data.minValue || ''}
                                        onChange={(e) => onUpdate({ minValue: e.target.value ? parseInt(e.target.value) : undefined })}
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs">Max Value</Label>
                                    <Input
                                        type="number"
                                        className="h-8 mt-1"
                                        value={data.maxValue || ''}
                                        onChange={(e) => onUpdate({ maxValue: e.target.value ? parseInt(e.target.value) : undefined })}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {data.validationType === 'enum' && (
                        <div>
                            <Label className="text-xs">Allowed Options (comma separated)</Label>
                            <Input
                                className="h-8 mt-1"
                                placeholder="red, green, blue"
                                value={data.enumValues?.join(', ') || ''}
                                onChange={(e) => {
                                    const vals = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                    onUpdate({ enumValues: vals });
                                }}
                            />
                        </div>
                    )}

                    {data.validationType === 'regex' && (
                        <div>
                            <Label className="text-xs">Regex Pattern</Label>
                            <Input
                                className="h-8 mt-1"
                                placeholder="^[A-Z]{3}$"
                                value={data.regexPattern || ''}
                                onChange={(e) => onUpdate({ regexPattern: e.target.value })}
                            />
                        </div>
                    )}
                    
                    {['email', 'phone', 'pincode'].includes(data.validationType) && (
                        <p className="text-xs text-muted-foreground italic">
                            Standard {data.validationType} validation will be applied automatically.
                        </p>
                    )}
                </div>

                <Separator />

                {/* Custom Error Message */}
                <div>
                    <Label>Custom Error Message (optional)</Label>
                    <p className="text-xs text-muted-foreground mb-1">
                        Shown to the customer if their response is invalid.
                    </p>
                    <Textarea
                        className="min-h-[60px]"
                        placeholder="Please enter a valid response."
                        value={data.errorMessage || ''}
                        onChange={(e) => onUpdate({ errorMessage: e.target.value })}
                    />
                </div>

                <LeadConfigSection
                    value={data.leadAction}
                    onChange={(leadAction: LeadAction) => onUpdate({ leadAction })}
                />
            </div>
        );
    };

    const renderLeadEditor = () => {
        const data = node.data as LeadNode['data'];
        const condition: LeadActionCondition = data.condition || { source: 'response', operator: 'any' };
        const operator = condition.operator || 'any';
        const showValueInput = !VALUELESS_OPERATORS.includes(operator);
        const mapFields = data.mapFields || {};

        // Lead taxonomy comes from the hoisted useLeadOptions() hook at the top of
        // NodeEditor. Do NOT call hooks here — renderLeadEditor() runs conditionally
        // (node.type === 'lead'), so a hook here would violate the Rules of Hooks (#310).
        const { leadTypes, stages, useLeadTypeFreeText, useStageFreeText } = leadOptions;

        const emitCondition = (patch: Partial<LeadActionCondition>) =>
            onUpdate({ condition: { ...condition, ...patch } } as Partial<FlowNode['data']>);

        const emitMapField = (key: 'name' | 'email' | 'phone', fieldValue: string) =>
            onUpdate({
                mapFields: { ...mapFields, [key]: fieldValue || undefined },
            } as Partial<FlowNode['data']>);

        return (
            <div className="space-y-4">
                {/* Intro */}
                <div className="flex items-start gap-2 p-3 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50">
                    <UserPlus className="w-4 h-4 text-emerald-600 mt-0.5" />
                    <div>
                        <Label className="text-sm font-medium text-emerald-900">Mark as lead</Label>
                        <p className="text-xs text-emerald-700 mt-1">
                            When the conversation reaches this node, create or update a CRM lead.
                        </p>
                    </div>
                </div>

                {/* Lead type */}
                <div>
                    <Label className="text-xs font-semibold">Lead type</Label>
                    {useLeadTypeFreeText ? (
                        <Input
                            className="h-8 text-sm mt-1"
                            placeholder="e.g. whatsapp"
                            value={data.leadType || ''}
                            onChange={(e) => onUpdate({ leadType: e.target.value || undefined } as Partial<FlowNode['data']>)}
                        />
                    ) : (
                        <Select
                            value={data.leadType || '_none'}
                            onValueChange={(v) => onUpdate({ leadType: v === '_none' ? undefined : v } as Partial<FlowNode['data']>)}
                        >
                            <SelectTrigger className="h-8 text-sm mt-1">
                                <SelectValue placeholder="Select lead type..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="_none">None</SelectItem>
                                {leadTypes.map((lt) => (
                                    <SelectItem key={lt.id} value={lt.key}>
                                        {lt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Stage */}
                <div>
                    <Label className="text-xs font-semibold">Stage</Label>
                    {useStageFreeText ? (
                        <Input
                            className="h-8 text-sm mt-1"
                            placeholder="e.g. new"
                            value={data.stage || ''}
                            onChange={(e) => onUpdate({ stage: e.target.value || undefined } as Partial<FlowNode['data']>)}
                        />
                    ) : (
                        <Select
                            value={data.stage || '_none'}
                            onValueChange={(v) => onUpdate({ stage: v === '_none' ? undefined : v } as Partial<FlowNode['data']>)}
                        >
                            <SelectTrigger className="h-8 text-sm mt-1">
                                <SelectValue placeholder="Select stage..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="_none">None</SelectItem>
                                {stages.map((st) => (
                                    <SelectItem key={st.id} value={st.key}>
                                        {st.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Field mapping */}
                <div>
                    <Label className="text-xs font-semibold">Map fields (optional)</Label>
                    <p className="text-[11px] text-muted-foreground mb-1.5">
                        Source values / paths to copy onto the lead
                    </p>
                    <div className="space-y-2">
                        <div className="grid grid-cols-[64px_1fr] items-center gap-2">
                            <Label className="text-[11px] text-gray-500">Name</Label>
                            <Input
                                className="h-8 text-sm"
                                placeholder="e.g. name"
                                value={mapFields.name || ''}
                                onChange={(e) => emitMapField('name', e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-[64px_1fr] items-center gap-2">
                            <Label className="text-[11px] text-gray-500">Phone</Label>
                            <Input
                                className="h-8 text-sm"
                                placeholder="e.g. phone"
                                value={mapFields.phone || ''}
                                onChange={(e) => emitMapField('phone', e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-[64px_1fr] items-center gap-2">
                            <Label className="text-[11px] text-gray-500">Email</Label>
                            <Input
                                className="h-8 text-sm"
                                placeholder="e.g. email"
                                value={mapFields.email || ''}
                                onChange={(e) => emitMapField('email', e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Optional condition */}
                <div>
                    <Label className="text-xs font-semibold">Condition (optional)</Label>
                    <p className="text-[11px] text-muted-foreground mb-1.5">
                        Only mark as lead when this is true. Defaults to always.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <Select
                            value={operator}
                            onValueChange={(v: LeadActionOperator) => emitCondition({ operator: v })}
                        >
                            <SelectTrigger className="h-8 text-sm">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {OPERATOR_OPTIONS.map((op) => (
                                    <SelectItem key={op.value} value={op.value}>
                                        {op.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {showValueInput && (
                            <Input
                                className="h-8 text-sm"
                                placeholder="Value"
                                value={condition.value || ''}
                                onChange={(e) => emitCondition({ value: e.target.value })}
                            />
                        )}
                    </div>
                    {operator !== 'any' && (
                        <Input
                            className="h-8 text-sm mt-2"
                            placeholder="Path (optional, e.g. response or data.status)"
                            value={condition.path || ''}
                            onChange={(e) => emitCondition({ path: e.target.value })}
                        />
                    )}
                </div>
            </div>
        );
    };

    const getNodeIcon = () => {
        switch (node.type) {
            case 'trigger': return <Zap className="w-5 h-5 text-indigo-600" />;
            case 'message': return <MessageCircle className="w-5 h-5 text-green-600" />;
            case 'template': return <FileText className="w-5 h-5 text-purple-600" />;
            case 'input': return <Keyboard className="w-5 h-5 text-sky-600" />;
            case 'api': return <Plug className="w-5 h-5 text-violet-600" />;
            case 'lead': return <UserPlus className="w-5 h-5 text-emerald-600" />;
            case 'end': return <CheckCircle className="w-5 h-5 text-amber-600" />;
            default: return null;
        }
    };

    const getNodeTitle = () => {
        switch (node.type) {
            case 'trigger': return 'Trigger Settings';
            case 'message': return 'Message Settings';
            case 'template': return 'Template Settings';
            case 'input': return 'Input Node Settings';
            case 'api': return 'API Integration';
            case 'lead': return 'Mark as Lead';
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
                {node.type === 'input' && renderInputEditor()}
                {node.type === 'api' && (
                    <>
                        <ApiNodeEditor
                            node={node as ApiNode}
                            onUpdate={onUpdate}
                            flowVariables={flowVariables}
                            automationId={automationId}
                            onOpenFlowVariables={onOpenFlowVariables}
                        />
                        <LeadConfigSection
                            value={(node.data as ApiNode['data']).leadAction}
                            onChange={(leadAction: LeadAction) => onUpdate({ leadAction })}
                        />
                    </>
                )}
                {node.type === 'lead' && renderLeadEditor()}
                {node.type === 'set_status' && renderSetStatusEditor()}
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
    workspaceId?: string;
}

function ButtonEditor({ button, index, targetNodes, onUpdate, onRemove, workspaceId }: ButtonEditorProps) {
    const Icon = ButtonActionIcons[button.action.type] || ArrowRight;
    const [uploadingButtonDoc, setUploadingButtonDoc] = useState(false);
    const buttonDocInputRef = useRef<HTMLInputElement>(null);

    // Upload document for send_document button action
    const handleButtonDocUpload = async (file: File) => {
        if (!workspaceId) return;

        setUploadingButtonDoc(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('workspace_id', workspaceId);
        formData.append('is_public', 'true');

        try {
            const res = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/media/upload/public`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            const json = await res.json();
            const url = json.url || json.public_url;

            if (json.success && url) {
                onUpdate({
                    action: {
                        type: 'send_document',
                        documentUrl: url,
                        documentFilename: file.name,
                        documentCaption: (button.action as any).documentCaption || ''
                    }
                });
            }
        } catch (err) {
            console.error('Upload error:', err);
        } finally {
            setUploadingButtonDoc(false);
        }
    };

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
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Label *</Label>
                    <span className={`text-[10px] ${button.label?.length >= 20 ? 'text-amber-600 font-bold' : 'text-gray-400'}`}>
                        {button.label?.length || 0}/20
                    </span>
                </div>
                <Input
                    className="mt-1 h-8 text-sm"
                    placeholder="Button text"
                    value={button.label}
                    maxLength={20}
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
                            case 'send_document':
                                newAction = { type: 'send_document', documentUrl: '', documentFilename: '', documentCaption: '' };
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
                                    {getTargetNodeLabel(node)}
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

            {button.action.type === 'send_document' && (
                <div className="space-y-3">
                    <input
                        ref={buttonDocInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleButtonDocUpload(file);
                            e.target.value = '';
                        }}
                    />
                    {(button.action as any).documentUrl ? (
                        <div className="relative p-2 border rounded-lg bg-gray-50">
                            <div className="flex items-center gap-2">
                                <File className="w-6 h-6 text-blue-500 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">
                                        {(button.action as any).documentFilename || 'document'}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 flex-shrink-0"
                                    onClick={() => onUpdate({
                                        action: {
                                            type: 'send_document',
                                            documentUrl: '',
                                            documentFilename: '',
                                            documentCaption: (button.action as any).documentCaption || ''
                                        }
                                    })}
                                >
                                    <X className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            className="w-full h-16 flex flex-col gap-1"
                            onClick={() => buttonDocInputRef.current?.click()}
                            disabled={uploadingButtonDoc}
                        >
                            {uploadingButtonDoc ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span className="text-[10px]">Uploading...</span>
                                </>
                            ) : (
                                <>
                                    <FileText className="w-5 h-5 text-gray-400" />
                                    <span className="text-[10px] text-gray-500">Upload document</span>
                                </>
                            )}
                        </Button>
                    )}
                    <div>
                        <Label className="text-xs">Caption (optional)</Label>
                        <Input
                            className="mt-1 h-8 text-sm"
                            placeholder="Here's our pricing guide"
                            value={(button.action as any).documentCaption || ''}
                            onChange={(e) =>
                                onUpdate({
                                    action: {
                                        type: 'send_document',
                                        documentUrl: (button.action as any).documentUrl || '',
                                        documentFilename: (button.action as any).documentFilename || '',
                                        documentCaption: e.target.value
                                    }
                                })
                            }
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// ListRowEditor component for editing individual rows in a section
interface ListRowEditorProps {
    row: any;
    sectionIndex: number;
    rowIndex: number;
    targetNodes: FlowNode[];
    onUpdate: (updates: Partial<any>) => void;
    onRemove: () => void;
}

function ListRowEditor({
    row,
    sectionIndex,
    rowIndex,
    targetNodes,
    onUpdate,
    onRemove,
}: ListRowEditorProps) {
    return (
        <div className="p-2 border rounded bg-white space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
                    Row {rowIndex + 1}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0 text-gray-400 hover:text-red-500"
                    onClick={onRemove}
                >
                    <Trash2 className="w-3 h-3" />
                </Button>
            </div>
            
            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Title *</Label>
                    <span className={`text-[9px] ${row.title?.length >= 24 ? 'text-amber-600 font-bold' : 'text-gray-400'}`}>
                        {row.title?.length || 0}/24
                    </span>
                </div>
                <Input
                    className="h-7 text-xs"
                    placeholder="Enter row title..."
                    value={row.title}
                    maxLength={24}
                    onChange={(e) => onUpdate({ title: e.target.value })}
                />
            </div>

            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Description (optional)</Label>
                    <span className={`text-[9px] ${row.description?.length >= 72 ? 'text-amber-600 font-bold' : 'text-gray-400'}`}>
                        {row.description?.length || 0}/72
                    </span>
                </div>
                <Input
                    className="h-7 text-xs"
                    placeholder="Enter description..."
                    value={row.description || ''}
                    maxLength={72}
                    onChange={(e) => onUpdate({ description: e.target.value })}
                />
            </div>

            <div className="space-y-1.5">
                <Label className="text-xs">Navigate to</Label>
                <Select
                    value={row.id && row.targetNodeId ? row.targetNodeId : '_none'}
                    onValueChange={(value) => onUpdate({ targetNodeId: value === '_none' ? null : value })}
                >
                    <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="Select target..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="_none">Not connected</SelectItem>
                        {targetNodes.map((node) => (
                            <SelectItem key={node.id} value={node.id}>
                                {getTargetNodeLabel(node)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}

// ListSectionEditor component for editing sections in a list message
interface ListSectionEditorProps {
    section: any;
    sectionIndex: number;
    targetNodes: FlowNode[];
    onUpdate: (updates: Partial<any>) => void;
    onRemove: () => void;
}

function ListSectionEditor({
    section,
    sectionIndex,
    targetNodes,
    onUpdate,
    onRemove,
}: ListSectionEditorProps) {
    const addRow = () => {
        const rows = section.rows || [];
        if (rows.length >= LIMITS.MAX_ROWS_PER_SECTION) return;
        
        onUpdate({
            rows: [
                ...rows,
                { id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, title: '', targetNodeId: null }
            ]
        });
    };

    const updateRow = (rowIndex: number, updates: any) => {
        const rows = [...(section.rows || [])];
        rows[rowIndex] = { ...rows[rowIndex], ...updates };
        onUpdate({ rows });
    };

    const removeRow = (rowIndex: number) => {
        const rows = (section.rows || []).filter((_: any, i: number) => i !== rowIndex);
        onUpdate({ rows });
    };

    return (
        <div className="p-3 border rounded-lg bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <List className="w-4 h-4 text-gray-500" />
                    <span className="text-xs font-semibold text-gray-700">
                        Section {sectionIndex + 1}
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

            <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Section Title (optional)</Label>
                    <span className={`text-[9px] ${section.title?.length >= 24 ? 'text-amber-600 font-bold' : 'text-gray-400'}`}>
                        {section.title?.length || 0}/24
                    </span>
                </div>
                <Input
                    className="h-8 text-sm"
                    placeholder="Enter section title..."
                    value={section.title || ''}
                    maxLength={24}
                    onChange={(e) => onUpdate({ title: e.target.value })}
                />
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase text-gray-500 font-bold">Rows</Label>
                    <span className="text-[10px] text-gray-400">
                        {(section.rows || []).length}/{LIMITS.MAX_ROWS_PER_SECTION}
                    </span>
                </div>
                
                <div className="space-y-2">
                    {(section.rows || []).map((row: any, i: number) => (
                        <ListRowEditor
                            key={row.id || i}
                            row={row}
                            sectionIndex={sectionIndex}
                            rowIndex={i}
                            targetNodes={targetNodes}
                            onUpdate={(updates) => updateRow(i, updates)}
                            onRemove={() => removeRow(i)}
                        />
                    ))}
                </div>

                {(section.rows || []).length < LIMITS.MAX_ROWS_PER_SECTION && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-8 text-xs border-dashed"
                        onClick={addRow}
                    >
                        <Plus className="w-3 h-3 mr-1" /> Add Row
                    </Button>
                )}
            </div>
        </div>
    );
}
