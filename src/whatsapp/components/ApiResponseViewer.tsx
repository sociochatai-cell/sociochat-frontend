// API Response Viewer
// ====================
// Displays API response with formatting

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Check, X, Copy, Clock } from 'lucide-react';
import { useState } from 'react';
import type { WhatsAppApiResponse } from '../types';

interface ApiResponseViewerProps {
  response: WhatsAppApiResponse | null;
  httpStatus?: number;
  isLoading?: boolean;
  timestamp?: string;
}

export default function ApiResponseViewer({
  response,
  httpStatus,
  isLoading,
  timestamp,
}: ApiResponseViewerProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">📡 API Response</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Sending message...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!response) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">📡 API Response</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>No response yet. Send a message to see the API response here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">📡 API Response</CardTitle>
          <div className="flex items-center gap-2">
            {timestamp && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timestamp}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={copyToClipboard}>
              <Copy className="h-4 w-4 mr-1" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status row */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge
            variant={response.success ? 'default' : 'destructive'}
            className={response.success ? 'bg-green-500' : ''}
          >
            {response.success ? (
              <>
                <Check className="h-3 w-3 mr-1" />
                Success
              </>
            ) : (
              <>
                <X className="h-3 w-3 mr-1" />
                Error
              </>
            )}
          </Badge>

          {httpStatus && (
            <Badge variant="outline">
              HTTP {httpStatus}
            </Badge>
          )}

          {response.wamid && (
            <Badge variant="secondary" className="font-mono text-xs">
              wamid: {response.wamid.substring(0, 20)}...
            </Badge>
          )}
        </div>

        {/* Error message */}
        {!response.success && response.error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-md p-3">
            <p className="text-sm text-red-700 dark:text-red-300 font-medium">
              {response.error}
            </p>
            {response.error_code && (
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                Error Code: {response.error_code}
              </p>
            )}
          </div>
        )}

        {/* Success info */}
        {response.success && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {response.message_id && (
              <div>
                <span className="text-muted-foreground">Message ID:</span>
                <span className="ml-2 font-mono">{response.message_id}</span>
              </div>
            )}
            {response.conversation_id && (
              <div>
                <span className="text-muted-foreground">Conversation ID:</span>
                <span className="ml-2 font-mono">{response.conversation_id}</span>
              </div>
            )}
          </div>
        )}

        {/* Raw JSON */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Raw Response</p>
          <ScrollArea className="h-[200px] w-full rounded-md border bg-muted/30">
            <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
              {JSON.stringify(response, null, 2)}
            </pre>
          </ScrollArea>
        </div>

        {/* Payload sent (if available) */}
        {response.payload_sent && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Payload Sent to Meta API</p>
            <ScrollArea className="h-[150px] w-full rounded-md border bg-blue-50/50 dark:bg-blue-950/20">
              <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(response.payload_sent, null, 2)}
              </pre>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
