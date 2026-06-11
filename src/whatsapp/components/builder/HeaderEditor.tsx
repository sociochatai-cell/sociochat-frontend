// Header Editor Component
// =======================
// Configures template header: None, Text, or Image
// Image supports both file upload and URL input

import { useState, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { TemplateHeader, HeaderType } from '../../utils/templateUtils';
import { Image, Type, X, Upload, Loader2, CheckCircle, AlertCircle, Link } from 'lucide-react';
import { API_BASE_URL } from '@/config';

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

    const handleTypeChange = (type: HeaderType) => {
        setUploadError(null);
        setUrlInput('');
        onChange({
            type,
            text: type === 'text' ? header.text || '' : undefined,
            imageUrl: type === 'image' ? header.imageUrl : undefined,
            mediaHandle: type === 'image' ? header.mediaHandle : undefined,
        });
    };

    // Upload file to Meta
    const handleImageUpload = async (file: File) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            setUploadError('Please upload a JPEG or PNG image');
            return;
        }

        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            setUploadError('Image too large. Maximum size is 5MB.');
            return;
        }

        setUploading(true);
        setUploadError(null);
        setUploadProgress(10);

        try {
            // Convert file to base64 data URL for preview (more reliable than blob URL)
            const previewUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            // Update preview immediately
            onChange({
                ...header,
                type: 'image',
                imageUrl: previewUrl,
                mediaHandle: undefined, // Will be set after upload
            });

            setUploadProgress(30);

            const formData = new FormData();
            formData.append('file', file);
            if (accountId) {
                formData.append('account_id', accountId.toString());
            }

            const response = await fetch(`${API_BASE_URL}/api/whatsapp/media/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            setUploadProgress(70);
            const data = await response.json();
            console.log('Upload response:', data);

            const mediaHandle = data.media_handle || data.handle;
            const publicUrl = data.public_url || data.url;

            if (data.success && (mediaHandle || publicUrl)) {
                setUploadProgress(100);
                onChange({
                    ...header,
                    type: 'image',
                    imageUrl: publicUrl || previewUrl,
                    mediaHandle: mediaHandle || header.mediaHandle,
                });
                setUploadError(
                    mediaHandle
                        ? null
                        : accountId
                          ? 'Image uploaded to storage, but Meta media handle is missing. Reconnect WhatsApp and retry.'
                          : null
                );
            } else {
                setUploadError(data.error || data.message || 'Upload failed. Please try again.');
            }
        } catch (err) {
            console.error('Upload error:', err);
            setUploadError('Upload failed. Please check your connection.');
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    // Upload from URL
    const handleUrlUpload = async () => {
        if (!urlInput.trim()) {
            setUploadError('Please enter an image URL');
            return;
        }

        if (!urlInput.startsWith('https://')) {
            setUploadError('Please use an HTTPS URL');
            return;
        }

        setUploading(true);
        setUploadError(null);
        setUploadProgress(20);

        // Set preview immediately
        onChange({
            ...header,
            type: 'image',
            imageUrl: urlInput,
            mediaHandle: undefined,
        });

        try {
            const response = await fetch(`${API_BASE_URL}/api/whatsapp/media/upload/url`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlInput, account_id: accountId }),
            });

            setUploadProgress(70);
            const data = await response.json();
            console.log('URL upload response:', data);

            const mediaHandle = data.media_handle || data.handle;
            const publicUrl = data.public_url || data.url || urlInput;

            if (data.success && (mediaHandle || publicUrl)) {
                setUploadProgress(100);
                onChange({
                    ...header,
                    type: 'image',
                    imageUrl: publicUrl,
                    mediaHandle: mediaHandle || header.mediaHandle,
                });
                setUploadError(
                    mediaHandle
                        ? null
                        : accountId
                          ? 'Image stored, but Meta media handle is missing. Reconnect WhatsApp and retry.'
                          : null
                );
            } else {
                setUploadError(data.error || data.message || 'Failed to upload from URL');
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
            handleImageUpload(file);
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

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Header (Optional)</Label>
                {header.type === 'text' && (
                    <span className="text-xs text-muted-foreground">
                        {header.text?.length || 0}/60 characters
                    </span>
                )}
                {header.type === 'image' && header.mediaHandle && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Ready for submission
                    </span>
                )}
                {header.type === 'image' && header.imageUrl && !header.mediaHandle && !uploading && (
                    <span className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Upload pending
                    </span>
                )}
            </div>

            <RadioGroup
                value={header.type}
                onValueChange={(v) => handleTypeChange(v as HeaderType)}
                className="flex gap-4"
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

            {header.type === 'image' && (
                <div className="space-y-4">
                    {/* Show preview if we have an image URL */}
                    {header.imageUrl && (
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
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={clearImage}
                                    disabled={uploading}
                                >
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

                    {/* Upload options - only show if no image yet */}
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
                                    accept="image/jpeg,image/jpg,image/png"
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
                                            <p className="text-sm font-medium">Click to upload image</p>
                                            <p className="text-xs text-muted-foreground">
                                                JPEG or PNG • Max 5MB • Recommended: 1080×566px
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="url" className="mt-4 space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="https://example.com/your-image.jpg"
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        disabled={uploading}
                                    />
                                    <Button
                                        type="button"
                                        onClick={handleUrlUpload}
                                        disabled={uploading || !urlInput.trim()}
                                    >
                                        {uploading ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            'Upload'
                                        )}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Enter a public HTTPS image URL. The image will be downloaded and uploaded to Meta.
                                </p>
                            </TabsContent>
                        </Tabs>
                    )}

                    {/* Error message */}
                    {uploadError && (
                        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span>{uploadError}</span>
                        </div>
                    )}
                </div>
            )}

            {error && !uploadError && (
                <p className="text-xs text-destructive">{error}</p>
            )}
        </div>
    );
}
