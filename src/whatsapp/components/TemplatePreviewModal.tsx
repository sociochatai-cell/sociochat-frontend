// Template Preview Modal Component
// =================================
// Modal for previewing and sending an approved template
// Handles templates with IMAGE, VIDEO, or DOCUMENT headers.

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
import { Send, Loader2, AlertCircle, MessageSquare, Image as ImageIcon, Link, Upload, X, CheckCircle, ImageOff, FileText, Video, Sparkles } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { API_BASE_URL, WHATSAPP_REST_API_PREFIX } from "@/config";
import {
  isMetaSendPermissionError,
  parseWhatsAppJsonResponse,
} from '../utils/parseApiResponse';

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
    onMessageSent?: () => void;
}

export function TemplatePreviewModal({
    open,
    onOpenChange,
    template,
    recipientPhone,
    recipientName,
    phoneNumberId,
    onMessageSent,
}: TemplatePreviewModalProps) {
    const [variables, setVariables] = useState<Record<string, string>>({});
    const [headerImageUrl, setHeaderImageUrl] = useState('');
    const [imagePreviewSrc, setImagePreviewSrc] = useState('');
    const [uploadedFilename, setUploadedFilename] = useState('');
    const [previewError, setPreviewError] = useState(false);
    const [sending, setSending] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusError, setStatusError] = useState<string | null>(null);
    const [sendPermissionHints, setSendPermissionHints] = useState<string[]>([]);
    const [uploadMethod, setUploadMethod] = useState<'url' | 'upload'>('url');
    const [variableMapping, setVariableMapping] = useState<Record<string, string> | null>(null);
    const [copyCodeValue, setCopyCodeValue] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);


    // Detect template header format
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

    // Extract example media URL from template components (header_handle stored at template creation time)
    const getTemplateExampleMediaUrl = (): string | null => {
        if (!template?.components) return null;
        const headerComp = template.components.find(c => c.type?.toUpperCase() === 'HEADER');
        if (!headerComp) return null;
        const handles = (headerComp as any)?.example?.header_handle;
        if (Array.isArray(handles) && handles.length > 0) {
            const first = handles[0];
            if (typeof first === 'string' && (first.startsWith('http://') || first.startsWith('https://'))) {
                return first;
            }
        }
        return null;
    };
    const templateExampleUrl = getTemplateExampleMediaUrl();

    // Detect COPY_CODE button in template components
    const getCopyCodeButtonExample = (): string => {
        if (!template?.components) return '';
        const buttonsComp = template.components.find(c => c.type?.toUpperCase() === 'BUTTONS');
        if (!buttonsComp) return '';
        const buttons: any[] = (buttonsComp as any).buttons || [];
        const ccBtn = buttons.find((b: any) => b.type?.toUpperCase() === 'COPY_CODE');
        if (!ccBtn) return '';

        const example = ccBtn.example;
        if (typeof example === 'string') return example;
        if (Array.isArray(example)) {
            const firstString = example.find((value) => typeof value === 'string');
            return typeof firstString === 'string' ? firstString : '';
        }
        if (example && typeof example === 'object') {
            const values = Object.values(example);
            const firstString = values.find((value) => typeof value === 'string');
            return typeof firstString === 'string' ? firstString : '';
        }
        return '';
    };
    const copyCodeExample = getCopyCodeButtonExample();
    const sanitizedCopyCodeExample = copyCodeExample.replace(/[^A-Za-z0-9]/g, '');
    const hasCopyCodeButton = copyCodeExample !== '' || !!template?.components?.some(
        c => ((c as any).buttons || []).some((b: any) => b.type?.toUpperCase() === 'COPY_CODE')
    );

    // Reset state when modal opens/closes or template changes
    useEffect(() => {
        if (open && template) {
            setHeaderImageUrl('');
            setImagePreviewSrc('');
            setPreviewError(false);
            setUploadedFilename('');
            setVariables({});
            setCopyCodeValue('');
            setStatusMessage(null);
            setStatusError(null);
            setSendPermissionHints([]);
            setUploadMethod(headerFormat === 'DOCUMENT' ? 'upload' : 'url');
            // Initialize variable mapping from template
            // This maps position (1, 2, 3) to actual variable names (Name, Amount, Date)
            setVariableMapping((template as any).variable_mapping || null);
        }
    }, [open, template, headerFormat]);

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
        // Show preview for valid URLs.
        // Keep image proxy for image headers; use direct URL for video headers.
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
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            ]
            : hasVideoHeader
                ? ['video/mp4', 'video/quicktime', 'video/3gpp', 'video/avi', 'video/mpeg']
                : ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            toast({
                title: 'Invalid File',
                description: hasDocumentHeader
                    ? 'Please upload a valid document file (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT)'
                    : hasVideoHeader
                        ? 'Please upload a valid video file (MP4, MOV, 3GPP, AVI, MPEG)'
                        : 'Please upload a JPEG or PNG image',
                variant: 'destructive'
            });
            return;
        }

        const maxBytes = hasDocumentHeader ? (100 * 1024 * 1024) : hasVideoHeader ? (16 * 1024 * 1024) : (5 * 1024 * 1024);
        if (file.size > maxBytes) {
            toast({
                title: 'File Too Large',
                description: hasDocumentHeader ? 'Document must be under 100MB' : hasVideoHeader ? 'Video must be under 16MB' : 'Image must be under 5MB',
                variant: 'destructive'
            });
            return;
        }

        setUploading(true);
        setPreviewError(false);
        setStatusError(null);
        setStatusMessage(`Uploading ${file.name}…`);

        try {
            // For images/videos, create local preview immediately.
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

            const response = await fetch(`${WHATSAPP_REST_API_PREFIX}/media/upload/public`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            const parsed = await parseWhatsAppJsonResponse(response, 'Upload failed');
            const data = parsed.data;

            if (parsed.ok && data?.public_url) {
                const publicUrl = String(data.public_url);
                setHeaderImageUrl(publicUrl);
                setUploadedFilename(file.name || String(data.filename || 'uploaded_file'));
                setStatusMessage('Header media uploaded — you can send the template now.');
                setStatusError(null);
                toast({
                    title: hasDocumentHeader ? 'Document uploaded' : hasVideoHeader ? 'Video uploaded' : 'Image uploaded',
                    description: 'Ready to send.',
                });
            } else {
                const errText = parsed.errorMessage;
                setStatusError(errText);
                setStatusMessage(null);
                toast({
                    title: 'Upload failed',
                    description: errText,
                    variant: 'destructive',
                });
            }
        } catch (err) {
            console.error('Upload error:', err);
            const errText = 'Network error while uploading. Check your connection or paste a public HTTPS URL.';
            setStatusError(errText);
            setStatusMessage(null);
            toast({ title: 'Upload failed', description: errText, variant: 'destructive' });
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
        setUploadedFilename('');
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
                title: hasDocumentHeader ? 'Header Document Required' : hasVideoHeader ? 'Header Video Required' : 'Header Image Required',
                description: hasDocumentHeader ? 'Please upload a document' : hasVideoHeader ? 'Please upload or provide a video URL' : 'Please provide an image',
                variant: 'destructive'
            });
            return;
        }

        try {
            setSending(true);
            setStatusError(null);
            setStatusMessage(`Sending “${template.name}” to ${recipientPhone}…`);

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
            if (hasCopyCodeButton) {
                payload.copy_code_value = copyCodeValue.trim() || copyCodeExample;
            }
            if (hasImageHeader && headerImageUrl.trim()) {
                payload.header_image_url = headerImageUrl.trim();
            } else if (hasVideoHeader && headerImageUrl.trim()) {
                payload.header_video_url = headerImageUrl.trim();
            } else if (hasDocumentHeader && headerImageUrl.trim()) {
                payload.header_document_url = headerImageUrl.trim();
                if (uploadedFilename.trim()) {
                    payload.header_document_filename = uploadedFilename.trim();
                }
            }

            const res = await fetch(`${WHATSAPP_REST_API_PREFIX}/send/template`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            const parsed = await parseWhatsAppJsonResponse(res, 'Failed to send template');
            const data = parsed.data;

            if (parsed.ok) {
                setStatusMessage('Template sent successfully.');
                setStatusError(null);
                toast({ title: 'Template sent', description: `Delivered to ${recipientPhone}` });
                onMessageSent?.();
                onOpenChange(false);
                setVariables({});
                clearImage();
            } else {
                const errText = parsed.errorMessage;
                setStatusError(errText);
                setStatusMessage(null);
                if (parsed.data && isMetaSendPermissionError(parsed.data)) {
                    const hints = parsed.data.hints;
                    setSendPermissionHints(
                        Array.isArray(hints)
                            ? hints.filter((h): h is string => typeof h === 'string')
                            : [
                                  'Image upload succeeded — Meta rejected the outbound send (error #200).',
                                  'Use a System User token from Sociovia Business Manager, not Facebook Login.',
                                  'Open WhatsApp → Settings in Sociovia to reconnect with Manual Link.',
                              ]
                    );
                } else {
                    setSendPermissionHints([]);
                }
                toast({
                    title: isMetaSendPermissionError(parsed.data)
                        ? 'Send blocked by Meta (permissions)'
                        : 'Send failed',
                    description: errText,
                    variant: 'destructive',
                });
            }
        } catch (err) {
            console.error('Send error:', err);
            const errText = 'Network error while sending. Check your connection and try again.';
            setStatusError(errText);
            setStatusMessage(null);
            toast({ title: 'Send failed', description: errText, variant: 'destructive' });
        } finally {
            setSending(false);
        }
    };

    // Check if we have a valid preview (not errored)
    const hasValidPreview = imagePreviewSrc && !previewError;

    const sendBlockedReason = (() => {
        if (!hasRecipient) return 'Select a conversation in the inbox first.';
        if (uploading) return 'Uploading header media — please wait…';
        if (sending) return `Sending template to ${recipientPhone}…`;
        if (hasMediaHeader && !headerImageUrl.trim()) {
            return hasDocumentHeader
                ? 'Upload or paste a document URL for the template header before sending.'
                : hasVideoHeader
                    ? 'Upload or paste a video URL for the template header before sending.'
                    : 'Upload or paste an image URL for the template header before sending.';
        }

        const missingVarsList = Array.from({ length: variableCount }, (_, i) => String(i + 1))
            .filter(key => !variables[key] || !variables[key].trim());
        if (missingVarsList.length > 0) {
            const names = missingVarsList.map(num => variableMapping?.[num] || `Variable ${num}`);
            return `Please fill in all template variables: ${names.join(', ')}`;
        }

        return null;
    })();

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

                    {/* Header media section */}
                    {hasMediaHeader && (
                        <div className="space-y-3 p-3 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-100 rounded-lg">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                    {hasDocumentHeader ? (
                                        <FileText className="w-4 h-4 text-blue-600" />
                                    ) : hasVideoHeader ? (
                                        <Video className="w-4 h-4 text-blue-600" />
                                    ) : (
                                        <ImageIcon className="w-4 h-4 text-blue-600" />
                                    )}
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

                            {/* Image/video preview */}
                            {(hasImageHeader || hasVideoHeader) && hasValidPreview && (
                                <div className="relative rounded-md overflow-hidden border bg-white">
                                    {hasVideoHeader ? (
                                        <video
                                            src={imagePreviewSrc}
                                            className="w-full h-40 object-contain bg-gray-50"
                                            controls
                                            onError={() => setPreviewError(true)}
                                        />
                                    ) : (
                                        <img
                                            src={imagePreviewSrc}
                                            alt="Header preview"
                                            className="w-full h-32 object-contain bg-gray-50"
                                            onError={() => setPreviewError(true)}
                                        />
                                    )}
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

                            {/* Preview error message (image/video headers) */}
                            {(hasImageHeader || hasVideoHeader) && previewError && headerImageUrl && (
                                <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
                                    <ImageOff className="w-4 h-4" />
                                    <span>Preview unavailable, but URL is set - will work when sent!</span>
                                    <Button size="sm" variant="ghost" className="h-5 px-1 ml-auto" onClick={clearImage}>
                                        <X className="w-3 h-3" />
                                    </Button>
                                </div>
                            )}

                            {/* Document uploaded state */}
                            {hasDocumentHeader && headerImageUrl && (
                                <div className="flex items-center gap-2 p-2 bg-white border rounded text-xs text-slate-700">
                                    <FileText className="w-4 h-4 text-orange-600" />
                                    <span className="truncate">{uploadedFilename || 'Document uploaded'}</span>
                                    <Button size="sm" variant="ghost" className="h-5 px-1 ml-auto" onClick={clearImage}>
                                        <X className="w-3 h-3" />
                                    </Button>
                                </div>
                            )}

                            {/* TABBED OPTIONS (image/video) */}
                            {(hasImageHeader || hasVideoHeader) && !hasValidPreview && !previewError && (
                                <>
                                {templateExampleUrl && !headerImageUrl && (
                                    <button
                                        type="button"
                                        onClick={() => handleUrlChange(templateExampleUrl)}
                                        className="w-full text-xs text-blue-700 hover:text-blue-900 border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 rounded-md py-2 px-3 flex items-center gap-2 transition-colors"
                                    >
                                        <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                                        Use template example {hasVideoHeader ? 'video' : 'image'}
                                    </button>
                                )}
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
                                            placeholder={hasVideoHeader ? 'https://example.com/video.mp4' : 'https://example.com/image.jpg'}
                                            value={headerImageUrl}
                                            onChange={(e) => handleUrlChange(e.target.value)}
                                            className="text-sm"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            {hasVideoHeader
                                                ? 'Enter a publicly accessible HTTPS video URL'
                                                : 'Enter a publicly accessible HTTPS image URL'}
                                        </p>
                                    </TabsContent>

                                    <TabsContent value="upload" className="mt-3 space-y-2">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept={hasVideoHeader ? 'video/mp4,video/quicktime,video/3gpp,video/avi,video/mpeg' : 'image/jpeg,image/jpg,image/png'}
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
                                                    <span className="text-xs">{hasVideoHeader ? 'Click to select video' : 'Click to select image'}</span>
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {hasVideoHeader ? 'MP4, MOV, 3GPP, AVI, MPEG (max 16MB)' : 'JPEG or PNG, max 5MB'}
                                                    </span>
                                                </>
                                            )}
                                        </Button>
                                    </TabsContent>
                                </Tabs>
                                </>
                            )}

                            {/* Upload-only options (document only) */}
                            {hasDocumentHeader && !headerImageUrl && (
                                <div className="mt-3 space-y-2">
                                    {templateExampleUrl && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setHeaderImageUrl(templateExampleUrl);
                                                setUploadedFilename('example_document');
                                            }}
                                            className="w-full text-xs text-blue-700 hover:text-blue-900 border border-blue-200 hover:border-blue-400 bg-blue-50 hover:bg-blue-100 rounded-md py-2 px-3 flex items-center gap-2 transition-colors"
                                        >
                                            <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                                            Use template example document
                                        </button>
                                    )}
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept="application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
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
                                                <span className="text-xs">Click to upload document</span>
                                                <span className="text-[10px] text-muted-foreground">PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT (max 100MB)</span>
                                            </>
                                        )}
                                    </Button>
                                </div>
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

                    {/* Coupon code input for COPY_CODE button templates */}
                    {hasCopyCodeButton && (
                        <div className="space-y-1.5">
                            <Label className="text-sm font-medium flex items-center gap-1.5">
                                Coupon Code
                                <span className="text-xs text-muted-foreground font-normal">(COPY_CODE button)</span>
                            </Label>
                            <Input
                                placeholder={sanitizedCopyCodeExample || 'e.g. SUMMER25'}
                                value={copyCodeValue}
                                onChange={(e) => {
                                    // Meta only accepts alphanumeric characters — strip everything else
                                    const sanitized = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                                    setCopyCodeValue(sanitized);
                                }}
                                className="font-mono uppercase"
                                maxLength={15}
                            />
                            <p className="text-xs text-muted-foreground">
                                Letters and numbers only (A–Z, 0–9). Hyphens and spaces are not allowed by WhatsApp.
                            </p>
                            {copyCodeExample && !copyCodeValue && (
                                <p className="text-xs text-muted-foreground">
                                    Leave blank to use the template's example code: <strong>{sanitizedCopyCodeExample}</strong>
                                </p>
                            )}
                        </div>
                    )}

                    {/* Preview */}
                    <div className="bg-muted rounded-lg p-4">
                        <Label className="text-xs text-muted-foreground mb-2 block">Preview:</Label>
                        <p className="text-sm whitespace-pre-wrap">{getPreview()}</p>
                    </div>

                    {/* Status banner */}
                    {(statusMessage || statusError || uploading || sending) && (
                        <Alert
                            variant={statusError ? 'destructive' : 'default'}
                            className={statusError ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}
                        >
                            {(uploading || sending) && !statusError ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <AlertCircle className="h-4 w-4" />
                            )}
                            <AlertDescription className="text-sm space-y-2">
                                <p>{statusError || statusMessage || (uploading ? 'Uploading header media…' : 'Sending template…')}</p>
                                {sendPermissionHints.length > 0 && (
                                    <ul className="list-disc pl-4 text-xs space-y-1">
                                        {sendPermissionHints.map((hint) => (
                                            <li key={hint}>{hint}</li>
                                        ))}
                                    </ul>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

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

                <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
                    {sendBlockedReason && !sending && !uploading && (
                        <p className="w-full text-xs text-muted-foreground text-center px-1">
                            {sendBlockedReason}
                        </p>
                    )}
                    <div className="flex w-full gap-2 justify-end">
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending || uploading}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSend}
                            disabled={sending || uploading || sendBlockedReason !== null}
                            className="bg-[#25D366] hover:bg-[#128C7E] text-white disabled:opacity-50"
                        >
                            {uploading ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</>
                            ) : sending ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>
                            ) : (
                                <><Send className="w-4 h-4 mr-2" /> Send Template</>
                            )}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
