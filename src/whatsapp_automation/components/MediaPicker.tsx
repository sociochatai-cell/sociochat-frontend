import React, { useState, useCallback, useRef, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Upload, 
  Sparkles, 
  Link as LinkIcon,
  X,
  GripVertical,
  Image as ImageIcon,
  Video,
  Plus,
  Loader2,
  AlertCircle,
  Check,
  ExternalLink
} from 'lucide-react';
import apiClient from '@/lib/apiClient';
import type { GenerateAIResponse } from '../types';

// ============================================================
// Types
// ============================================================

export type MediaMethod = 'generate_ai' | 'upload' | 'generate_from_link';

export interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  name?: string;
  selected?: boolean;
}

interface MediaPickerProps {
  workspaceId: string;
  selectedMedia: MediaItem[];
  onMediaChange: (media: MediaItem[]) => void;
  maxMedia?: number;
  allowVideo?: boolean;
  className?: string;
}

interface AIGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (images: MediaItem[]) => void;
  workspaceId: string;
}

// ============================================================
// Constants
// ============================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

// ============================================================
// Utility Functions
// ============================================================

const generateId = () => `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ============================================================
// AI Generate Modal
// ============================================================

const AIGenerateModal: React.FC<AIGenerateModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  workspaceId,
}) => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('realistic');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<MediaItem[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const promptId = useId();

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await apiClient.post<GenerateAIResponse>('/generate-ai', {
        workspace_id: workspaceId,
        prompt: prompt.trim(),
        style,
        num_images: 4,
      });

      if (!response.ok || !response.data?.success) {
        throw new Error(response.data?.error || 'Failed to generate images');
      }

      const images: MediaItem[] = (response.data.images || []).map((img) => ({
        id: img.id || generateId(),
        url: img.url,
        type: 'image' as const,
        name: `AI Generated - ${prompt.substring(0, 20)}...`,
      }));

      setGeneratedImages(images);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate images. Please try again.';
      setError(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleImageSelection = (id: string) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirmSelection = () => {
    const selected = generatedImages.filter((img) => selectedImages.has(img.id));
    onSelect(selected);
    // Reset state
    setGeneratedImages([]);
    setSelectedImages(new Set());
    setPrompt('');
    onClose();
  };

  const handleClose = () => {
    setGeneratedImages([]);
    setSelectedImages(new Set());
    setPrompt('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Generate with AI
          </DialogTitle>
          <DialogDescription>
            Describe the image you want to create for your ad
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor={promptId}>Prompt</Label>
            <Textarea
              id={promptId}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., A professional product photo of a smartphone on a minimalist white background with soft lighting"
              rows={3}
              disabled={isGenerating}
            />
          </div>

          {/* Style Selection */}
          <div className="space-y-2">
            <Label>Style</Label>
            <RadioGroup
              value={style}
              onValueChange={setStyle}
              className="flex flex-wrap gap-2"
              disabled={isGenerating}
            >
              {['realistic', 'artistic', 'minimalist', 'vibrant'].map((s) => (
                <Label
                  key={s}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                    style === s
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  <RadioGroupItem value={s} className="sr-only" />
                  <span className="capitalize text-sm">{s}</span>
                </Label>
              ))}
            </RadioGroup>
          </div>

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Images
              </>
            )}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Generated Images Grid */}
          {generatedImages.length > 0 && (
            <div className="space-y-3">
              <Label>Select images to use</Label>
              <div className="grid grid-cols-2 gap-3">
                {generatedImages.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => toggleImageSelection(img.id)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                      selectedImages.has(img.id)
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-transparent hover:border-muted-foreground/30'
                    }`}
                    aria-pressed={selectedImages.has(img.id)}
                    aria-label={`Select image ${img.name || img.id}`}
                  >
                    <img
                      src={img.url}
                      alt={img.name || 'AI generated image'}
                      className="w-full h-full object-cover"
                    />
                    {selectedImages.has(img.id) && (
                      <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSelection}
            disabled={selectedImages.size === 0}
          >
            Add {selectedImages.size} Image{selectedImages.size !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// Media Item Component
// ============================================================

const MediaItemCard: React.FC<{
  item: MediaItem;
  onRemove: (id: string) => void;
  isDragging?: boolean;
}> = ({ item, onRemove, isDragging }) => {
  return (
    <Card 
      className={`group relative overflow-hidden ${isDragging ? 'opacity-50' : ''}`}
      role="listitem"
    >
      <div className="aspect-square relative">
        {item.type === 'image' ? (
          <img
            src={item.url}
            alt={item.name || 'Media item'}
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            src={item.url}
            className="w-full h-full object-cover"
            muted
          />
        )}
        
        {/* Overlay Controls */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={() => onRemove(item.id)}
                  className="h-8 w-8"
                  aria-label={`Remove ${item.name || 'media item'}`}
                >
                  <X className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Type Badge */}
        <div className="absolute bottom-2 left-2">
          <div className="bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            {item.type === 'image' ? (
              <ImageIcon className="w-3 h-3" />
            ) : (
              <Video className="w-3 h-3" />
            )}
            {item.type}
          </div>
        </div>

        {/* Drag Handle */}
        <div 
          className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab"
          aria-hidden="true"
        >
          <div className="bg-black/60 text-white p-1 rounded">
            <GripVertical className="w-4 h-4" />
          </div>
        </div>
      </div>
    </Card>
  );
};

// ============================================================
// Main Component
// ============================================================

export const MediaPicker: React.FC<MediaPickerProps> = ({
  workspaceId,
  selectedMedia,
  onMediaChange,
  maxMedia = 10,
  allowVideo = true,
  className = '',
}) => {
  const [method, setMethod] = useState<MediaMethod>('upload');
  const [showAIModal, setShowAIModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [isLoadingFromLink, setIsLoadingFromLink] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const componentId = useId();

  const canAddMore = selectedMedia.length < maxMedia;
  const acceptedTypes = allowVideo 
    ? [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES].join(',')
    : ACCEPTED_IMAGE_TYPES.join(',');

  // ============================================================
  // File Upload Handlers
  // ============================================================

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setError(null);
    const newMedia: MediaItem[] = [];
    const errors: string[] = [];

    Array.from(files).forEach((file) => {
      // Check file type
      const isImage = ACCEPTED_IMAGE_TYPES.includes(file.type);
      const isVideo = allowVideo && ACCEPTED_VIDEO_TYPES.includes(file.type);
      
      if (!isImage && !isVideo) {
        errors.push(`${file.name}: Unsupported file type`);
        return;
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`);
        return;
      }

      // Check max media limit
      if (selectedMedia.length + newMedia.length >= maxMedia) {
        errors.push(`Maximum of ${maxMedia} media items allowed`);
        return;
      }

      // Create media item
      const url = URL.createObjectURL(file);
      newMedia.push({
        id: generateId(),
        url,
        type: isImage ? 'image' : 'video',
        name: file.name,
      });
    });

    if (errors.length > 0) {
      setError(errors.join('. '));
    }

    if (newMedia.length > 0) {
      onMediaChange([...selectedMedia, ...newMedia]);
    }
  }, [selectedMedia, onMediaChange, maxMedia, allowVideo]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  // ============================================================
  // Link Import Handler
  // ============================================================

  const handleImportFromLink = useCallback(async () => {
    if (!linkUrl.trim()) {
      setError('Please enter a URL');
      return;
    }

    setIsLoadingFromLink(true);
    setError(null);

    try {
      // Validate URL
      const url = new URL(linkUrl);
      
      // For now, we'll assume the link is a direct image URL
      // In production, you might want to fetch and validate the image
      const newMedia: MediaItem = {
        id: generateId(),
        url: url.href,
        type: 'image',
        name: `Imported from ${url.hostname}`,
      };

      onMediaChange([...selectedMedia, newMedia]);
      setLinkUrl('');
    } catch (err) {
      setError('Invalid URL. Please enter a valid image URL.');
    } finally {
      setIsLoadingFromLink(false);
    }
  }, [linkUrl, selectedMedia, onMediaChange]);

  // ============================================================
  // Remove Handler
  // ============================================================

  const handleRemove = useCallback((id: string) => {
    const item = selectedMedia.find((m) => m.id === id);
    if (item?.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    }
    onMediaChange(selectedMedia.filter((m) => m.id !== id));
  }, [selectedMedia, onMediaChange]);

  // ============================================================
  // AI Generation Handler
  // ============================================================

  const handleAIGenerated = useCallback((images: MediaItem[]) => {
    const availableSlots = maxMedia - selectedMedia.length;
    const imagesToAdd = images.slice(0, availableSlots);
    onMediaChange([...selectedMedia, ...imagesToAdd]);
  }, [selectedMedia, onMediaChange, maxMedia]);

  return (
    <div className={`space-y-6 ${className}`} role="region" aria-labelledby={`${componentId}-title`}>
      <div>
        <h3 id={`${componentId}-title`} className="text-lg font-medium">
          Ad Creative
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Add images or videos for your ad. You can add up to {maxMedia} items.
        </p>
      </div>

      {/* Method Selection */}
      <RadioGroup
        value={method}
        onValueChange={(v) => setMethod(v as MediaMethod)}
        className="grid gap-3 sm:grid-cols-3"
        aria-label="Choose media upload method"
      >
        <Label
          className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
            method === 'generate_ai'
              ? 'border-primary bg-primary/5'
              : 'border-muted hover:border-muted-foreground/30'
          }`}
        >
          <RadioGroupItem value="generate_ai" className="sr-only" />
          <Sparkles className="w-5 h-5 text-primary" />
          <div>
            <span className="font-medium">Generate with AI</span>
            <p className="text-xs text-muted-foreground">Create unique images</p>
          </div>
        </Label>

        <Label
          className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
            method === 'upload'
              ? 'border-primary bg-primary/5'
              : 'border-muted hover:border-muted-foreground/30'
          }`}
        >
          <RadioGroupItem value="upload" className="sr-only" />
          <Upload className="w-5 h-5 text-primary" />
          <div>
            <span className="font-medium">Upload Files</span>
            <p className="text-xs text-muted-foreground">From your device</p>
          </div>
        </Label>

        <Label
          className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
            method === 'generate_from_link'
              ? 'border-primary bg-primary/5'
              : 'border-muted hover:border-muted-foreground/30'
          }`}
        >
          <RadioGroupItem value="generate_from_link" className="sr-only" />
          <LinkIcon className="w-5 h-5 text-primary" />
          <div>
            <span className="font-medium">Import from URL</span>
            <p className="text-xs text-muted-foreground">Paste image link</p>
          </div>
        </Label>
      </RadioGroup>

      {/* Method-specific UI */}
      {method === 'generate_ai' && (
        <Button
          onClick={() => setShowAIModal(true)}
          disabled={!canAddMore}
          className="w-full"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Open AI Image Generator
        </Button>
      )}

      {method === 'upload' && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/30 hover:border-muted-foreground/50'
          } ${!canAddMore ? 'opacity-50 pointer-events-none' : ''}`}
          role="button"
          tabIndex={canAddMore ? 0 : -1}
          onClick={() => canAddMore && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (canAddMore && (e.key === 'Enter' || e.key === ' ')) {
              fileInputRef.current?.click();
            }
          }}
          aria-label="Drop files here or click to browse"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes}
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            aria-hidden="true"
          />
          
          <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-sm font-medium">
            Drag and drop files here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {allowVideo ? 'Images and videos' : 'Images only'} up to {formatFileSize(MAX_FILE_SIZE)}
          </p>
        </div>
      )}

      {method === 'generate_from_link' && (
        <div className="flex gap-2">
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            disabled={!canAddMore || isLoadingFromLink}
            className="flex-1"
          />
          <Button
            onClick={handleImportFromLink}
            disabled={!canAddMore || isLoadingFromLink || !linkUrl.trim()}
          >
            {isLoadingFromLink ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ExternalLink className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Selected Media Grid */}
      {selectedMedia.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Selected Media</Label>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {selectedMedia.length} / {maxMedia}
            </span>
          </div>
          
          <div 
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
            role="list"
            aria-label="Selected media items"
          >
            {selectedMedia.map((item) => (
              <MediaItemCard
                key={item.id}
                item={item}
                onRemove={handleRemove}
              />
            ))}
            
            {/* Add More Button */}
            {canAddMore && (
              <button
                type="button"
                onClick={() => {
                  if (method === 'generate_ai') {
                    setShowAIModal(true);
                  } else if (method === 'upload') {
                    fileInputRef.current?.click();
                  }
                }}
                className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary"
                aria-label="Add more media"
              >
                <Plus className="w-8 h-8" />
                <span className="text-xs">Add more</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* AI Generate Modal */}
      <AIGenerateModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        onSelect={handleAIGenerated}
        workspaceId={workspaceId}
      />
    </div>
  );
};

export default MediaPicker;
