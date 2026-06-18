// Header Editor Component
// =======================
// Configures template header: None, Text, Media, or Location
// Media supports both file upload and URL input

import { useState, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { TemplateHeader, HeaderType } from '../../utils/templateUtils';
import { Image, Type, X, Upload, Loader2, CheckCircle, AlertCircle, Link, Video, FileText, MapPin } from 'lucide-react';
import { API_BASE_URL } from '@/config';

const TEMPLATE_API = `${API_BASE_URL}/api/whatsapp/templates`;

interface HeaderEditorProps {
    header: TemplateHeader;
    onChange: (header: TemplateHeader) => void;
    error?: string;
    accountId?: number;
}

export function HeaderEditor({ header, onChange, error, accountId }: HeaderEditorProps) {
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [urlInput, setUrlInput] = useState('');
    const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isMediaType = header.type === 'image' || header.type === 'video' || header.type === 'document';

    const getMediaRules = () => {
        if (header.type === 'video') {
            return {
                accept: 'video/mp4,video/quicktime,video/3gpp,video/avi,video/mpeg',
                label: 'MP4/MOV/3GPP/AVI/MPEG',
                maxSizeBytes: 16 * 1024 * 1024,
                maxSizeLabel: '16MB',
            };
        }
        if (header.type === 'document') {
            return {
                accept: 'application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                label: 'PDF/TXT/DOC/DOCX',
                maxSizeBytes: 100 * 1024 * 1024,
                maxSizeLabel: '100MB',
            };
        }
        return {
            accept: 'image/jpeg,image/jpg,image/png',
            label: 'JPEG or PNG',
            maxSizeBytes: 5 * 1024 * 1024,
            maxSizeLabel: '5MB',
        };
    };

    const handleTypeChange = (type: HeaderType) => {
        setUploadError(null);
        setUrlInput('');
        onChange({
            type,
            text: type === 'text' ? header.text || '' : undefined,
            imageUrl: type === 'image' || type === 'video' || type === 'document' ? header.imageUrl : undefined,
            mediaHandle: type === 'image' || type === 'video' || type === 'document' ? header.mediaHandle : undefined,
        });
    };

    const handleMediaUpload = async (file: File) => {
        const rules = getMediaRules();
        const allowedTypes = rules.accept.split(',');
        if (!allowedTypes.includes(file.type)) {
            setUploadError(`Please upload a supported ${header.type} file (${rules.label})`);
            return;
        }

        if (file.size > rules.maxSizeBytes) {
            setUploadError(`${header.type[0].toUpperCase() + header.type.slice(1)} too large. Maximum size is ${rules.maxSizeLabel}.`);
            return;
        }

        setUploading(true);
        setUploadError(null);
        setUploadProgress(10);

        try {
            const previewUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            onChange({
                ...header,
                type: header.type,
                imageUrl: previewUrl,
                mediaHandle: undefined,
            });

            setUploadProgress(30);

            const formData = new FormData();
            formData.append('file', file);
            if (accountId) {
                formData.append('account_id', accountId.toString());
            }

            const response = await fetch(`${TEMPLATE_API}/upload_media`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            setUploadProgress(70);
            const data = await response.json();

            if (data.success && data.handle) {
                setUploadProgress(100);
                onChange({
                    ...header,
                    type: header.type,
                    imageUrl: previewUrl,
                    mediaHandle: data.handle,
                });
                setUploadError(null);
            } else {
                setUploadError(data.error || 'Upload failed. Please try again.');
            }
        } catch (err) {
            console.error('Upload error:', err);
            setUploadError('Upload failed. Please check your connection.');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleUrlUpload = async () => {
        if (!urlInput.trim()) {
            setUploadError('Please enter a media URL');
            return;
        }

        if (!urlInput.startsWith('https://')) {
            setUploadError('Please use an HTTPS URL');
            return;
        }

        setUploading(true);
        setUploadError(null);
        setUploadProgress(20);

        onChange({
            ...header,
            type: header.type,
            imageUrl: urlInput,
            mediaHandle: undefined,
        });

        try {
            const response = await fetch(`${TEMPLATE_API}/upload_media_url`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlInput, account_id: accountId, media_type: header.type }),
            });

            setUploadProgress(70);
            const data = await response.json();

            if (data.success && data.handle) {
                setUploadProgress(100);
                onChange({
                    ...header,
                    type: header.type,
                    imageUrl: urlInput,
                    mediaHandle: data.handle,
                });
                setUploadError(null);
            } else {
                setUploadError(data.error || 'Failed to upload from URL');
            }
        } catch (err) {
            console.error('URL upload error:', err);
            setUploadError('Failed to upload from URL. Check your connection.');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleMediaUpload(file);
        }
    };

    const clearImage = () => {
        onChange({
            ...header,
            imageUrl: undefined,
            mediaHandle: undefined,
        });
        setUrlInput('');
        setUploadError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const mediaRules = getMediaRules();

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Header (Optional)</Label>
                {header.type === 'text' && (
                    <span className="text-xs text-muted-foreground">
                        {header.text?.length || 0}/60 characters
                    </span>
                )}
                {isMediaType && header.mediaHandle && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Ready for submission
                    </span>
                )}
                {isMediaType && header.imageUrl && !header.mediaHandle && !uploading && (
                    <span className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Upload pending
                    </span>
                )}
            </div>

            <RadioGroup
                value={header.type}
                onValueChange={(v) => handleTypeChange(v as HeaderType)}
                className="flex flex-wrap gap-4"
            >
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="text" id="header-text" />
                    <Label htmlFor="header-text" className="flex items-center gap-1.5 cursor-pointer">
                        <Type className="w-4 h-4" />
                        Text
                    </Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="image" id="header-image" />
                    <Label htmlFor="header-image" className="flex items-center gap-1.5 cursor-pointer">
                        <Image className="w-4 h-4" />
                        Image
                    </Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="video" id="header-video" />
                    <Label htmlFor="header-video" className="flex items-center gap-1.5 cursor-pointer">
                        <Video className="w-4 h-4" />
                        Video
                    </Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="document" id="header-document" />
                    <Label htmlFor="header-document" className="flex items-center gap-1.5 cursor-pointer">
                        <FileText className="w-4 h-4" />
                        Document
                    </Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="location" id="header-location" />
                    <Label htmlFor="header-location" className="flex items-center gap-1.5 cursor-pointer">
                        <MapPin className="w-4 h-4" />
                        Location
                    </Label>
                </div>
                <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="header-none" />
                    <Label htmlFor="header-none" className="flex items-center gap-1.5 cursor-pointer">
                        <X className="w-4 h-4" />
                        None
                    </Label>
                </div>
            </RadioGroup>

            {header.type === 'text' && (
                <Input
                    placeholder="Enter header text (max 60 characters)"
                    value={header.text || ''}
                    onChange={(e) => onChange({ ...header, text: e.target.value })}
                    maxLength={60}
                    className={error ? 'border-destructive' : ''}
                />
            )}

            {isMediaType && (
                <div className="space-y-4">
                    {header.imageUrl && header.type === 'image' && (
                        <div className="relative rounded-lg overflow-hidden border bg-muted">
                            <img
                                src={header.imageUrl}
                                alt="Header preview"
                                className="w-full h-40 object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f0f0f0" width="100" height="100"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23999">Preview unavailable</text></svg>';
                                }}
                            />
                            {uploading && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <div className="text-center text-white space-y-2">
                                        <Loader2 className="w-8 h-8 mx-auto animate-spin" />
                                        <p className="text-sm">Uploading to Meta...</p>
                                        <Progress value={uploadProgress} className="w-32 mx-auto" />
                                    </div>
                                </div>
                            )}
                            <div className="absolute top-2 right-2 flex gap-2">
                                <Button type="button" size="sm" variant="secondary" onClick={clearImage} disabled={uploading}>
                                    <X className="w-4 h-4 mr-1" />
                                    Remove
                                </Button>
                            </div>
                            {header.mediaHandle && (
                                <div className="absolute bottom-2 left-2">
                                    <span className="bg-green-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        Uploaded
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {header.imageUrl && header.type === 'video' && (
                        <div className="relative rounded-lg border bg-muted p-6 text-center">
                            <Video className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">Video ready for submission</p>
                            <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={clearImage} disabled={uploading}>
                                <X className="w-4 h-4 mr-1" />
                                Remove
                            </Button>
                        </div>
                    )}

                    {header.imageUrl && header.type === 'document' && (
                        <div className="relative rounded-lg border bg-muted p-6 text-center">
                            <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">Document ready for submission</p>
                            <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={clearImage} disabled={uploading}>
                                <X className="w-4 h-4 mr-1" />
                                Remove
                            </Button>
                        </div>
                    )}

                    {!header.imageUrl && (
                        <Tabs value={uploadMethod} onValueChange={(v) => setUploadMethod(v as 'file' | 'url')}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="file" className="flex items-center gap-2">
                                    <Upload className="w-4 h-4" />
                                    Upload File
                                </TabsTrigger>
                                <TabsTrigger value="url" className="flex items-center gap-2">
                                    <Link className="w-4 h-4" />
                                    Paste URL
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="file" className="mt-4">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept={mediaRules.accept}
                                    className="hidden"
                                />
                                <div
                                    onClick={() => !uploading && fileInputRef.current?.click()}
                                    className={`
                                        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                                        transition-colors hover:bg-muted/50
                                        ${uploading ? 'opacity-50 cursor-wait' : ''}
                                        ${error ? 'border-destructive' : 'border-muted-foreground/25'}
                                    `}
                                >
                                    {uploading ? (
                                        <div className="space-y-3">
                                            <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
                                            <p className="text-sm text-muted-foreground">Uploading...</p>
                                            <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Upload className="w-10 h-10 mx-auto text-muted-foreground" />
                                            <p className="text-sm font-medium">Click to upload {header.type}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {mediaRules.label} • Max {mediaRules.maxSizeLabel}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="url" className="mt-4 space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="https://example.com/your-file"
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        disabled={uploading}
                                    />
                                    <Button type="button" onClick={handleUrlUpload} disabled={uploading || !urlInput.trim()}>
                                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload'}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Enter a public HTTPS URL. The file will be downloaded server-side and uploaded to Meta.
                                </p>
                            </TabsContent>
                        </Tabs>
                    )}

                    {uploadError && (
                        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{uploadError}</span>
                        </div>
                    )}
                </div>
            )}

            {header.type === 'location' && (
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    Location headers do not require media upload. Latitude/longitude is supplied when sending the template.
                </div>
            )}

            {error && !uploadError && (
                <p className="text-xs text-destructive">{error}</p>
            )}
        </div>
    );
}
