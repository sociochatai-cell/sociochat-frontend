// Text Message Composer
// =====================

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

interface TextComposerProps {
  text: string;
  previewUrl: boolean;
  onTextChange: (value: string) => void;
  onPreviewUrlChange: (value: boolean) => void;
}

export default function TextComposer({
  text,
  previewUrl,
  onTextChange,
  onPreviewUrlChange,
}: TextComposerProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">📝 Text Message</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="messageText">Message Body *</Label>
          <Textarea
            id="messageText"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Type your message here..."
            className="min-h-[120px]"
            maxLength={4096}
          />
          <p className="text-xs text-muted-foreground text-right">
            {text.length} / 4096 characters
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="previewUrl"
            checked={previewUrl}
            onCheckedChange={(checked) => onPreviewUrlChange(checked === true)}
          />
          <Label htmlFor="previewUrl" className="text-sm font-normal cursor-pointer">
            Enable URL preview (renders link cards for URLs in message)
          </Label>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
          <p className="font-medium mb-1">📌 Note</p>
          <p>
            Text messages can only be sent within 24-hour conversation window.
            If user hasn't messaged first, use a Template message instead.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
