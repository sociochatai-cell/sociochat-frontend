// Template Preview Modal Component
// =================================
// Modal for previewing and sending an approved template
// Handles templates with IMAGE headers - tabbed interface for URL/Upload

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Template } from './TemplateCard';
import { TemplateStatusBadge } from './TemplateStatusBadge';
import { Send, Loader2, AlertCircle, MessageSquare, Image as ImageIcon, Link, Upload, X, CheckCircle, ImageOff, FileText, Video } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { API_BASE_URL } from "@/config";

const API_BASE = API_BASE_URL;

// Proxy external images through backend to bypass CORS
const getProxiedUrl = (url: string): string => {
    if (!url) return '';
    // Don't proxy data URLs or local URLs
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    if (url.includes(window.location.hostname)) return url;
    // Proxy external URLs
    return `${API_BASE}/api/proxy/image?url=${encodeURIComponent(url)}`;
};

interface TemplatePreviewModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    template: Template | null;
    recipientPhone: string;
    recipientName?: string;  // Customer name for tracking
    phoneNumberId: string;
    onTemplateSent?: (message: any, conversationId: number) => void;
}

export function TemplatePreviewModal({
    open,
    onOpenChange,
    template,
    recipientPhone,
    recipientName,
    phoneNumberId,
    onTemplateSent,
}: TemplatePreviewModalProps) {
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [headerImageUrl, setHeaderImageUrl] = useState('');
    const [imagePreviewSrc, setImagePreviewSrc] = useState('');
    const [previewError, setPreviewError] = useState(false);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadMethod, setUploadMethod] = useState<'url' | 'upload'>('url');
    const [variableMapping, setVariableMapping] = useState<Record<string, string> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);


    // Detect if template has IMAGE header
    const getHeaderFormat = (): string | null => {
        if (!template) return null;
        if (template.header_format) return template.header_format;
        if (template.components) {
            const headerComp = template.components.find(c => c.type?.toUpperCase() === 'HEADER');
            if (headerComp?.format) return headerComp.format.toUpperCase();
        }
        return null;
    };

    const headerFormat = getHeaderFormat();
    const hasImageHeader = headerFormat === 'IMAGE';
    const hasVideoHeader = headerFormat === 'VIDEO';
    const hasDocumentHeader = headerFormat === 'DOCUMENT';
    const hasMediaHeader = hasImageHeader || hasVideoHeader || hasDocumentHeader;

    // Reset state when modal opens/closes or template changes
    useEffect(() => {
        if (open && template) {
            setHeaderImageUrl('');
            setImagePreviewSrc('');
            setPreviewError(false);
            setVariables({});
            setUploadMethod(headerFormat === 'DOCUMENT' ? 'upload' : 'url');
            // Initialize variable mapping from template
            // This maps position (1, 2, 3) to actual variable names (Name, Amount, Date)
            setVariableMapping((template as any).variable_mapping || null);
        }
    }, [open, template]);

    if (!template) return null;

    const variableCount = template.variable_count || 0;
    const bodyText = template.body_text || '';
    const hasRecipient = recipientPhone && recipientPhone.trim().length > 0;

    // Get list of variable names from the template body (supports {{Name}}, {{Amount}}, etc.)
    const variableNames = (template as any).variable_names || [];

    const getPreview = () => {
        let text = bodyText;

        // Replace using variable_mapping (position -> name)
        // This handles templates with {{Name}}, {{Amount}}, {{Date}} style variables
        if (variableMapping && Object.keys(variableMapping).length > 0) {
            Object.entries(variableMapping).forEach(([pos, name]) => {
                const value = variables[pos] || `{{${name}}}`;
                // Replace both {{name}} and {{pos}} patterns
                text = text.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'gi'), value);
                text = text.replace(`{{${pos}}}`, value);
            });
        } else {
            // Fallback: numbered variables only
            for (let i = 1; i <= variableCount; i++) {
                const value = variables[`${i}`] || `{{${i}}}`;
                text = text.replace(`{{${i}}}`, value);
            }
        }
        return text;
    };

    // Handle URL input
    const handleUrlChange = (url: string) => {
        setHeaderImageUrl(url);
        setPreviewError(false);
        // Show preview for valid URLs - proxy through backend
        if (url.startsWith('http://') || url.startsWith('https://')) {
            if (hasVideoHeader) {
                setImagePreviewSrc(url);
                return;
            }
            setImagePreviewSrc(getProxiedUrl(url));
        } else {
            setImagePreviewSrc('');
        }
    };

    // Handle file upload
    const handleFileUpload = async (file: File) => {
        const allowedTypes = hasDocumentHeader
            ? [
                'application/pdf',
                'text/plain',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ]
            : hasVideoHeader
                ? ['video/mp4', 'video/quicktime', 'video/3gpp', 'video/avi', 'video/mpeg']
                : ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            toast({
                title: 'Invalid File',
                description: hasDocumentHeader
                    ? 'Please upload a valid document file (PDF, DOC, DOCX, TXT)'
                    : hasVideoHeader
                        ? 'Please upload a valid video file (MP4, MOV, 3GPP, AVI, MPEG)'
                        : 'Please upload a JPEG or PNG image',
                variant: 'destructive',
            });
            return;
        }

        const maxBytes = hasDocumentHeader ? (100 * 1024 * 1024) : hasVideoHeader ? (16 * 1024 * 1024) : (5 * 1024 * 1024);
        if (file.size > maxBytes) {
            toast({
                title: 'File Too Large',
                description: hasDocumentHeader ? 'Document must be under 100MB' : hasVideoHeader ? 'Video must be under 16MB' : 'Image must be under 5MB',
                variant: 'destructive',
            });
            return;
        }

        setUploading(true);
        setPreviewError(false);

        try {
            if (!hasDocumentHeader) {
                const base64Preview = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                setImagePreviewSrc(base64Preview);
            }

            // Upload to backend to get a public URL
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_BASE}/api/whatsapp/media/upload/public`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            const data = await response.json();

            if (data.success && data.public_url) {
                setHeaderImageUrl(data.public_url);
                toast({
                    title: hasDocumentHeader ? 'Document uploaded' : hasVideoHeader ? 'Video uploaded' : 'Image uploaded',
                    description: 'Ready to send!',
                });
            } else {
                toast({
                    title: 'Upload Issue',
                    description: data.error || 'Could not get public URL',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            console.error('Upload error:', err);
            toast({ title: 'Upload Failed', description: 'Network error', variant: 'destructive' });
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileUpload(file);
    };

    const clearImage = () => {
        setHeaderImageUrl('');
        setImagePreviewSrc('');
        setPreviewError(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSend = async () => {
        if (!hasRecipient) {
            toast({ title: 'No Conversation Selected', description: 'Please select a conversation first', variant: 'destructive' });
            return;
        }

        if (hasMediaHeader && !headerImageUrl.trim()) {
            toast({
                title: 'Header Media Required',
                description: hasDocumentHeader ? 'Please provide a document' : hasVideoHeader ? 'Please provide a video' : 'Please provide an image',
                variant: 'destructive',
            });
            return;
        }

        try {
            setSending(true);

            setSending(true);

            // Fix: Support Named Parameters
            // If variableMapping exists, we send a key-value object (dict) instead of a list
            let bodyParams: any = [];

            if (variableMapping && Object.keys(variableMapping).length > 0) {
                // Named parameters mode
                const paramsDict: Record<string, string> = {};
                Object.entries(variableMapping).forEach(([pos, name]) => {
                    // Start with the position-based value from inputs (e.g. key "1")
                    // Map it to the actual name (e.g. key "name")
                    const value = variables[pos] || '';
                    if (name) {
                        paramsDict[name] = value;
                    }
                });
                bodyParams = paramsDict;
            } else {
                // Positional (legacy) mode
                for (let i = 1; i <= variableCount; i++) {
                    bodyParams.push(variables[`${i}`] || '');
                }
            }

            const payload: Record<string, unknown> = {
                to: recipientPhone,
                phone_number_id: phoneNumberId,
                template_name: template.name,
                language: template.language,
                name: recipientName || '',  // Customer name for tracking
            };

            // Check if bodyParams is non-empty (array length > 0 OR dict with keys)
            const hasParams = Array.isArray(bodyParams)
                ? bodyParams.length > 0
                : Object.keys(bodyParams).length > 0;

            if (hasParams) payload.body_params = bodyParams;
            if (hasImageHeader && headerImageUrl.trim()) {
                payload.header_image_url = headerImageUrl.trim();
            } else if (hasVideoHeader && headerImageUrl.trim()) {
                payload.header_video_url = headerImageUrl.trim();
            } else if (hasDocumentHeader && headerImageUrl.trim()) {
                payload.header_document_url = headerImageUrl.trim();
            }

            const res = await fetch(`${API_BASE}/api/whatsapp/send/template`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (res.ok && data.success !== false) {
                toast({ title: 'Template Sent!', description: `Message sent to ${recipientPhone}` });
                onOpenChange(false);
                setVariables({});
                clearImage();
                if (onTemplateSent && data.message && data.conversation_id) {
                    onTemplateSent(data.message, data.conversation_id);
                }
            } else {
                toast({ title: 'Send Failed', description: data.error?.message || data.error || 'Failed to send', variant: 'destructive' });
            }
        } catch (err) {
            console.error('Send error:', err);
            toast({ title: 'Send Failed', description: 'Network error', variant: 'destructive' });
        } finally {
            setSending(false);
        }
    };

    // Check if we have a valid preview (not errored)
    const hasValidPreview = imagePreviewSrc && !previewError;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        Send Template
                        {template.status && <TemplateStatusBadge status={template.status} />}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Template info */}
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">{template.name}</Badge>
                        <span className="text-sm text-muted-foreground">{template.language}</span>
                    </div>

                    {/* Header image section - TABBED INTERFACE */}
                    {hasMediaHeader && (
                        <div className="space-y-3 p-3 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-100 rounded-lg">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                    {hasDocumentHeader ? <FileText className="w-4 h-4 text-blue-600" /> :
                                     hasVideoHeader ? <Video className="w-4 h-4 text-blue-600" /> :
                                     <ImageIcon className="w-4 h-4 text-blue-600" />}
                                    {hasDocumentHeader ? 'Header Document' : hasVideoHeader ? 'Header Video' : 'Header Image'}
                                    <Badge variant="secondary" className="text-xs">Required</Badge>
                                </Label>
                                {headerImageUrl && (
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        Ready
                                    </span>
                                )}
                            </div>

                            {/* Image Preview - shows when we have a valid preview */}
                            {hasValidPreview && (
                                <div className="relative rounded-md overflow-hidden border bg-white">
                                    <img
                                        src={imagePreviewSrc}
                                        alt="Header preview"
                                        className="w-full h-32 object-contain bg-gray-50"
                                        onError={() => setPreviewError(true)}
                                    />
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="destructive"
                                        className="absolute top-1 right-1 h-6 w-6 p-0"
                                        onClick={clearImage}
                                    >
                                        <X className="w-3 h-3" />
                                    </Button>
                                </div>
                            )}

                            {/* Preview error message */}
                            {previewError && headerImageUrl && (
                                <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                                    <ImageOff className="w-4 h-4" />
                                    <span>Preview unavailable, but URL is set - will work when sent!</span>
                                    <Button size="sm" variant="ghost" className="h-5 px-1 ml-auto" onClick={clearImage}>
                                        <X className="w-3 h-3" />
                                    </Button>
                                </div>
                            )}

                            {/* TABBED OPTIONS - show when no valid preview */}
                            {!hasValidPreview && !previewError && (
                                <Tabs value={uploadMethod} onValueChange={(v) => setUploadMethod(v as 'url' | 'upload')}>
                                    <TabsList className="grid w-full grid-cols-2 h-9">
                                        <TabsTrigger value="url" className="text-xs gap-1.5">
                                            <Link className="w-3.5 h-3.5" />
                                            Paste URL
                                        </TabsTrigger>
                                        <TabsTrigger value="upload" className="text-xs gap-1.5">
                                            <Upload className="w-3.5 h-3.5" />
                                            Upload File
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="url" className="mt-3 space-y-2">
                                        <Input
                                            placeholder="https://example.com/image.jpg"
                                            value={headerImageUrl}
                                            onChange={(e) => handleUrlChange(e.target.value)}
                                            className="text-sm"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Enter a publicly accessible HTTPS image URL
                                        </p>
                                    </TabsContent>

                                    <TabsContent value="upload" className="mt-3 space-y-2">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept={hasDocumentHeader
                                                ? 'application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                                                : hasVideoHeader
                                                    ? 'video/mp4,video/quicktime,video/3gpp,video/avi,video/mpeg'
                                                    : 'image/jpeg,image/jpg,image/png'}
                                            className="hidden"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full h-20 border-dashed flex flex-col gap-1"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading}
                                        >
                                            {uploading ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span className="text-xs">Uploading...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload className="w-5 h-5" />
                                                    <span className="text-xs">Click to select {hasDocumentHeader ? 'document' : hasVideoHeader ? 'video' : 'image'}</span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {hasDocumentHeader ? 'PDF/DOC/DOCX/TXT, max 100MB' : hasVideoHeader ? 'MP4/MOV, max 16MB' : 'JPEG or PNG, max 5MB'}
                                                    </span>
                                                </>
                                            )}
                                        </Button>
                                    </TabsContent>
                                </Tabs>
                            )}
                        </div>
                    )}

                    {/* Variable inputs */}
                    {variableCount > 0 && (
                        <div className="space-y-3">
                            <Label className="text-sm font-medium">Fill in variables:</Label>
                            {Array.from({ length: variableCount }, (_, i) => i + 1).map((num) => {
                                const friendlyName = variableMapping?.[String(num)];
                                return (
                                    <div key={num} className="flex items-center gap-2">
                                        <Label className="w-24 text-sm text-muted-foreground truncate" title={friendlyName || `{{${num}}}`}>
                                            {friendlyName ? friendlyName : `{{${num}}}`}
                                        </Label>
                                        <Input
                                            placeholder={friendlyName ? `Enter ${friendlyName}` : `Value for variable ${num}`}
                                            value={variables[`${num}`] || ''}
                                            onChange={(e) => setVariables(prev => ({ ...prev, [`${num}`]: e.target.value }))}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Preview */}
                    <div className="bg-muted rounded-lg p-4">
                        <Label className="text-xs text-muted-foreground mb-2 block">Preview:</Label>
                        <p className="text-sm whitespace-pre-wrap">{getPreview()}</p>
                    </div>

                    {/* Recipient */}
                    {hasRecipient ? (
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            Sending to: <strong>{recipientPhone}</strong>
                        </div>
                    ) : (
                        <Alert variant="destructive" className="bg-red-50 border-red-200">
                            <AlertCircle className="w-4 h-4" />
                            <AlertDescription>
                                <strong>No conversation selected!</strong><br />
                                Please select a conversation from the left panel.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        onClick={handleSend}
                        disabled={sending || !hasRecipient || (hasMediaHeader && !headerImageUrl.trim())}
                        className="bg-[#25D366] hover:bg-[#128C7E] text-white disabled:opacity-50"
                    >
                        {sending ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                        ) : (
                            <><Send className="w-4 h-4 mr-2" /> Send Template</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
