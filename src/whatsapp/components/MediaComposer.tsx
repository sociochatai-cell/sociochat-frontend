// Media Message Composer
// ======================

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Image, Video, FileAudio, FileText } from 'lucide-react';
import type { MediaType } from '../types';

interface MediaComposerProps {
  mediaType: MediaType;
  mediaUrl: string;
  caption: string;
  filename: string;
  onMediaTypeChange: (value: MediaType) => void;
  onMediaUrlChange: (value: string) => void;
  onCaptionChange: (value: string) => void;
  onFilenameChange: (value: string) => void;
}

const MEDIA_TYPE_INFO: Record<MediaType, { icon: React.ElementType; maxSize: string; formats: string }> = {
  image: {
    icon: Image,
    maxSize: '5 MB',
    formats: 'JPEG, PNG',
  },
  video: {
    icon: Video,
    maxSize: '16 MB',
    formats: 'MP4, 3GPP',
  },
  audio: {
    icon: FileAudio,
    maxSize: '16 MB',
    formats: 'AAC, MP3, OGG, AMR',
  },
  document: {
    icon: FileText,
    maxSize: '100 MB',
    formats: 'PDF, DOC, DOCX, PPT, XLS, etc.',
  },
};

export default function MediaComposer({
  mediaType,
  mediaUrl,
  caption,
  filename,
  onMediaTypeChange,
  onMediaUrlChange,
  onCaptionChange,
  onFilenameChange,
}: MediaComposerProps) {
  const typeInfo = MEDIA_TYPE_INFO[mediaType];
  const IconComponent = typeInfo.icon;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">🖼️ Media Message</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Media Type */}
        <div className="space-y-2">
          <Label>Media Type *</Label>
          <Select value={mediaType} onValueChange={(v) => onMediaTypeChange(v as MediaType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="image">
                <div className="flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Image
                </div>
              </SelectItem>
              <SelectItem value="video">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Video
                </div>
              </SelectItem>
              <SelectItem value="audio">
                <div className="flex items-center gap-2">
                  <FileAudio className="h-4 w-4" />
                  Audio
                </div>
              </SelectItem>
              <SelectItem value="document">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Document
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Max: {typeInfo.maxSize} | Formats: {typeInfo.formats}
          </p>
        </div>

        {/* Media URL */}
        <div className="space-y-2">
          <Label htmlFor="mediaUrl">Media URL *</Label>
          <Input
            id="mediaUrl"
            value={mediaUrl}
            onChange={(e) => onMediaUrlChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Must be a publicly accessible HTTPS URL
          </p>
        </div>

        {/* Caption (not for audio) */}
        {mediaType !== 'audio' && (
          <div className="space-y-2">
            <Label htmlFor="caption">
              Caption <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => onCaptionChange(e.target.value)}
              placeholder="Optional caption for the media"
              className="min-h-[80px]"
              maxLength={1024}
            />
            <p className="text-xs text-muted-foreground text-right">
              {caption.length} / 1024 characters
            </p>
          </div>
        )}

        {/* Filename (only for documents) */}
        {mediaType === 'document' && (
          <div className="space-y-2">
            <Label htmlFor="filename">
              Filename <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input
              id="filename"
              value={filename}
              onChange={(e) => onFilenameChange(e.target.value)}
              placeholder="document.pdf"
            />
            <p className="text-xs text-muted-foreground">
              Display name for the document in WhatsApp
            </p>
          </div>
        )}

        {/* Preview placeholder */}
        {mediaUrl && (
          <div className="border rounded-md p-4 bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                <IconComponent className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {filename || mediaUrl.split('/').pop() || 'Media file'}
                </p>
                <p className="text-xs text-muted-foreground capitalize">{mediaType}</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
