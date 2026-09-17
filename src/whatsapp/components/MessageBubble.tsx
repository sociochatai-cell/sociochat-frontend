// Message Bubble Component
// =======================
// Individual message display (incoming/outgoing)

import { format } from 'date-fns';
import { Check, CheckCheck, AlertCircle, Image, Video, FileText, Mic, Clock, Star, ExternalLink, ShoppingCart, Play, Pause, Download } from 'lucide-react';
import { ConversationMessage } from '../types';
import { cn } from '@/lib/utils';
import {
  extractOrderData,
  extractTemplateButtons,
  formatOrderPrice,
  getOrderProductImageSrc,
  type OrderLineItem,
  type TemplateInfo,
} from '../utils/messageDisplay';
import { Button } from '@/components/ui/button';
import { API_BASE_URL, WHATSAPP_REST_API_PREFIX } from "@/config";
import { getWorkspaceId } from '../utils/workspaceContext';
import { toast } from 'sonner';
import { SafeImage } from '@/components/ui/safe-image';

interface MessageBubbleProps {
  message: ConversationMessage;
  templates?: Record<string, TemplateInfo>;
}

export function MessageBubble({ message, templates = {} }: MessageBubbleProps) {
  // Echo messages (from mobile app) should display as outgoing (right side)
  const isOutgoing = message.direction === 'outgoing' || message.direction === 'echo';
  const isFailed = message.status === 'failed';

  return (
    <div
      className={cn(
        'flex w-full mb-3 animate-in fade-in-50 slide-in-from-bottom-2 duration-300',
        isOutgoing ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[70%] rounded-2xl overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md',
          isOutgoing
            ? 'bg-[#dcf8c6] text-gray-900 rounded-br-sm' // WhatsApp light green
            : 'bg-white text-gray-900 rounded-bl-sm border border-gray-100', // White for incoming
          isFailed && 'border-2 border-destructive bg-destructive/5'
        )}
      >
        {/* Message content */}
        <div>
          {renderMessageContent(message, isOutgoing, templates)}
        </div>

        {/* Timestamp and status */}
        <div className="flex items-center gap-1 text-xs opacity-70 px-4 pb-2">
          <span>
            {message.created_at
              ? (() => {
                try {
                  // Use toLocaleTimeString for proper local timezone conversion
                  return new Date(message.created_at).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                } catch {
                  return '--:--';
                }
              })()
              : '--:--'}
          </span>
          {isOutgoing && (
            <span className="ml-1 flex items-center gap-1">
              {renderStatusWithText(message.status, isFailed)}
            </span>
          )}
        </div>

        {/* Error message */}
        {isFailed && (
          <FailedStatusDetails message={message} />
        )}
      </div>
    </div>
  );
}

function extractFirstUrl(text?: string): string | null {
  if (!text) return null;
  const match = text.match(/https?:\/\/\S+/i);
  return match ? match[0] : null;
}

function FailedStatusDetails({ message }: { message: ConversationMessage }) {
  const raw = (message.error_message || '').trim();
  const link = extractFirstUrl(raw);
  const compactMessage = raw.replace(/https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim();

  return (
    <div className="px-4 pb-2 text-xs opacity-95 space-y-1">
      <div className="flex items-start gap-1 text-destructive">
        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
        <span>{compactMessage || 'Message delivery failed.'}</span>
      </div>

      {message.error_code && (
        <div className="text-[11px] text-muted-foreground">
          Error code: {message.error_code}
        </div>
      )}

      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 underline"
        >
          Open fix link
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

// Extended type for message content fields
interface MessageContent {
  type?: string;
  text?: string;
  body?: string;
  template_name?: string;
  name?: string;
  error_message?: string;
  caption?: string;
  image_url?: string;
  url?: string;
  link?: string;
  media_url?: string;
  filename?: string;
  header?: string;
  footer?: string;
  header_image?: string;
  header_image_url?: string;
  header_type?: string;
  // Template body parameters - can be array or dict object
  body_params?: string[] | Record<string, string>;
  // Interactive message fields
  interactive_type?: string;
  button_id?: string;
  button_title?: string;
  list_id?: string;
  list_title?: string;
  list_description?: string;
  buttons?: Array<{ id: string; title: string }>;
  sections?: Array<{
    title?: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
  action?: {
    buttons?: Array<{ reply?: { id: string; title: string } }>;
    sections?: Array<{
      title?: string;
      rows?: Array<{ id: string; title: string; description?: string }>;
    }>;
    button?: string;
  };
  components?: Array<{
    type: string;
    parameters?: Array<{
      type: string;
      image?: { link: string };
      text?: string;
    }>;
  }>;
}

function renderMessageContent(message: ConversationMessage, isOutgoing: boolean, templates: Record<string, { name: string; body: string | null; header: string | null; footer: string | null }> = {}) {
  const { type } = message;

  // Handle string content (plain text messages)
  if (typeof message.content === 'string') {
    return (
      <p className="whitespace-pre-wrap break-words px-4 py-2">
        {message.content || message.body || 'Empty message'}
      </p>
    );
  }

  const content = message.content as MessageContent;

  // Handle missing or invalid content - try body field as fallback
  if (!content || typeof content !== 'object') {
    if (message.body) {
      return (
        <p className="whitespace-pre-wrap break-words px-4 py-2">
          {message.body}
        </p>
      );
    }
    return <p className="text-xs opacity-70 px-4 py-2">Message content unavailable</p>;
  }

  switch (type) {
    case 'text': {
      const textContent = String(content?.text || content?.body || message.body || '');
      return (
        <p className="whitespace-pre-wrap break-words px-4 py-2">
          {textContent || 'Empty message'}
        </p>
      );
    }

    case 'template':
      return renderTemplateMessage(content, isOutgoing, templates);

    case 'image':
      console.log('🖼️ Image content:', content);
      return renderImageMessage(content, isOutgoing);

    case 'video':
      return renderVideoMessage(content, isOutgoing);

    case 'audio':
      return renderAudioMessage(content, isOutgoing);

    case 'document':
      return renderDocumentMessage(content, isOutgoing);

    case 'sticker':
      return renderStickerMessage(content, isOutgoing);

    case 'interactive':
      return renderInteractiveMessage(content, isOutgoing);

    case 'button':
      return renderButtonMessage(content, isOutgoing);

    case 'order':
      return renderOrderMessage(content, isOutgoing);

    case 'location':
      return renderLocationMessage(content);

    case 'contacts':
      return renderContactsMessage(content);

    case 'reaction':
      return renderReactionMessage(content);

    default: {
      // Fallback to content.type when DB type and content payload are inconsistent.
      const fallbackType = String(content?.type || '').toLowerCase();
      if (fallbackType === 'image') return renderImageMessage(content, isOutgoing);
      if (fallbackType === 'video') return renderVideoMessage(content, isOutgoing);
      if (fallbackType === 'audio') return renderAudioMessage(content, isOutgoing);
      if (fallbackType === 'document') return renderDocumentMessage(content, isOutgoing);
      if (fallbackType === 'sticker') return renderStickerMessage(content, isOutgoing);
      if (fallbackType === 'interactive') return renderInteractiveMessage(content, isOutgoing);
      if (fallbackType === 'button') return renderButtonMessage(content, isOutgoing);
      if (fallbackType === 'order') return renderOrderMessage(content, isOutgoing);
      if (fallbackType === 'location') return renderLocationMessage(content);
      if (fallbackType === 'contacts') return renderContactsMessage(content);
      if (fallbackType === 'reaction') return renderReactionMessage(content);
      return <p className="text-xs opacity-70 px-4 py-2">Unsupported message type: {type}</p>;
    }
  }
}

function renderTemplateMessage(content: MessageContent, isOutgoing: boolean, templates: Record<string, { name: string; body: string | null; header: string | null; footer: string | null }> = {}) {
  // Debug log to see template content structure
  console.log('📝 Template content:', JSON.stringify(content, null, 2));

  // Extract header image from components if available
  const headerImage = extractHeaderImage(content);

  // Look up template content from cache
  const templateName = content?.template_name || content?.name || '';
  const cachedTemplate = templates[templateName];

  // Use cached body/header/footer if available, otherwise use content fields
  let bodyText = cachedTemplate?.body || content?.body || content?.text || null;
  const headerText = cachedTemplate?.header || content?.header || null;
  const footerText = cachedTemplate?.footer || content?.footer || null;

  // Extract body parameters from content.body_params or from components
  let bodyParams: string[] | Record<string, string> = [];

  // Check for body_params directly
  if (content?.body_params) {
    bodyParams = content.body_params;
  }

  // Also check payload_sent.template.components for parameters
  const payloadSent = (content as any)?.payload_sent;
  if (payloadSent?.template?.components) {
    for (const comp of payloadSent.template.components) {
      if (comp.type === 'body' && comp.parameters) {
        // Check if we have named params structure from backend service wrapper
        if (comp.named_params) {
          bodyParams = comp.named_params;
        } else {
          // Fallback to list extraction, but handle parameter_name if present
          const params: any[] = [];
          const namedParams: Record<string, string> = {};
          let hasNamed = false;

          comp.parameters.forEach((p: any) => {
            const val = p.text || p.payload || '';
            if (p.parameter_name) {
              namedParams[p.parameter_name] = val;
              hasNamed = true;
            }
            params.push(val);
          });

          // Prefer named params if detected
          bodyParams = hasNamed ? namedParams : params;
        }
      }
    }
  }

  // Replace placeholders with actual values
  if (bodyText) {
    let substitutedBody = bodyText;

    if (Array.isArray(bodyParams) && bodyParams.length > 0) {
      // Positional substitution: {{1}} -> params[0]
      bodyParams.forEach((value, index) => {
        const placeholder = `{{${index + 1}}}`;
        // Global replace for this positional placeholder
        substitutedBody = substitutedBody.split(placeholder).join(value);
      });
    } else if (typeof bodyParams === 'object' && bodyParams !== null) {
      // Named substitution: {{name}} -> params['name']
      Object.entries(bodyParams).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        // Global replace - case insensitive for robustness? regular string split is case sensitive
        // Using RegExp for case insensitive replace if needed, but usually keys match exactly
        substitutedBody = substitutedBody.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
      });
    }

    bodyText = substitutedBody;
  }

  return (
    <div>
      {/* Header image */}
      {headerImage && (
        <div className="relative">
          <img
            src={headerImage}
            alt="Template header"
            className="w-full h-auto max-h-48 object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="px-4 py-2">
        {/* Template name */}
        <p className="text-xs opacity-70 mb-1 font-medium">
          📝 Template: {templateName || 'Unknown'}
        </p>

        {/* Body text - show from cache or content */}
        {bodyText ? (
          <p className="break-words whitespace-pre-wrap">{String(bodyText)}</p>
        ) : (
          <p className="text-sm opacity-80 italic">
            Template message sent.
          </p>
        )}

        {/* Footer */}
        {footerText && (
          <p className="text-xs mt-2 opacity-70">{footerText}</p>
        )}

        {/* Error message */}
        {content?.error_message && (
          <p className="text-xs mt-1 text-destructive">
            Error: {String(content.error_message)}
          </p>
        )}
      </div>

      {/* Template buttons (quick reply, URL, catalog, etc.) */}
      {(() => {
        const templateButtons = extractTemplateButtons(content as Record<string, unknown>, templates);
        if (templateButtons.length === 0) return null;
        return (
          <div className="border-t border-black/10">
            {templateButtons.map((btn, idx) => (
              <div
                key={`${btn.title}-${idx}`}
                className={cn(
                  'text-center py-2.5 border-b border-black/10 last:border-b-0 font-medium text-sm',
                  isOutgoing ? 'text-blue-700' : 'text-blue-600',
                )}
              >
                {btn.url ? (
                  <a
                    href={btn.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1 hover:underline"
                  >
                    {btn.title}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  btn.title
                )}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

function extractHeaderImage(content: MessageContent): string | null {
  // Check header_image_url field (from template with builder)
  if (content?.header_image_url) return content.header_image_url;

  // Check header_image field
  if (content?.header_image) return content.header_image;

  // Check image_url field
  if (content?.image_url) return content.image_url;

  // Check url field (used for direct image sends)
  if (content?.url) return content.url;

  // Check components for header image
  if (content?.components) {
    for (const comp of content.components) {
      if (comp.type === 'header' && comp.parameters) {
        for (const param of comp.parameters) {
          if (param.type === 'image' && param.image?.link) {
            return param.image.link;
          }
        }
      }
    }
  }

  return null;
}

function renderImageMessage(content: any, isOutgoing: boolean) {
  const workspaceId = getWorkspaceId();
  const mediaId = content?.id || content?.image?.id;

  // Try to use backend proxy for WhatsApp media IDs
  let displayUrl = (mediaId && typeof mediaId === 'string' && mediaId.length > 5)
    ? `${WHATSAPP_REST_API_PREFIX}/media/${mediaId}?workspace_id=${workspaceId}`
    : (content?.image?.link || content?.image_url || content?.url || content?.link || content?.media_url);

  // Debug log to help troubleshoot image issues
  console.log('🖼️ renderImageMessage - content:', content, 'displayUrl:', displayUrl);

  // Check if it's a Google Drive URL (fallback for non-WhatsApp media)
  const isGoogleDrive = typeof displayUrl === 'string' && displayUrl.includes('drive.google.com');

  // Extract Google Drive file ID and create direct preview URL
  const getGoogleDrivePreviewUrl = (url: string): string => {
    const fileIdMatch = url.match(/[?&]id=([^&]+)/);
    if (fileIdMatch) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }
    return url;
  };

  if (isGoogleDrive && displayUrl) {
    displayUrl = getGoogleDrivePreviewUrl(displayUrl);
  }

  return (
    <div>
      {displayUrl ? (
        <div className="relative">
          <img
            src={displayUrl}
            alt="Image message"
            className="w-full h-auto max-h-64 object-cover cursor-pointer"
            onClick={() => window.open(displayUrl, '_blank')}
            referrerPolicy="no-referrer"
            onError={(e) => {
              console.error('🖼️ Image load error for URL:', displayUrl);
              const target = e.target as HTMLImageElement;
              if (isGoogleDrive && displayUrl) {
                const container = target.parentElement;
                if (container) {
                  target.style.display = 'none';
                  const fallback = document.createElement('div');
                  fallback.innerHTML = `
                    <div 
                      class="flex flex-col items-center justify-center gap-2 bg-black/20 p-4 cursor-pointer hover:bg-black/30"
                      onclick="window.open('${displayUrl}', '_blank')"
                    >
                      <span class="text-3xl">🖼️</span>
                      <span class="text-sm">Click to view image</span>
                    </div>
                  `;
                  container.appendChild(fallback);
                }
              } else {
                target.style.display = 'none';
              }
            }}
          />
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 bg-black/20 p-8">
          <Image className="w-6 h-6" />
          <span>Image</span>
        </div>
      )}

      {content?.caption && (
        <p className="px-4 py-2 break-words">{String(content.caption)}</p>
      )}
    </div>
  );
}

function renderAudioMessage(content: any, isOutgoing: boolean) {
  const workspaceId = getWorkspaceId();
  const mediaId = content?.id || content?.audio?.id;

  const audioUrl = (mediaId && typeof mediaId === 'string' && mediaId.length > 5)
    ? `${WHATSAPP_REST_API_PREFIX}/media/${mediaId}?workspace_id=${workspaceId}`
    : (content?.audio?.link || content?.url || content?.link || content?.media_url);

  if (!audioUrl) {
    return (
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 bg-black/10 rounded-lg p-3">
          <Mic className="w-5 h-5 opacity-60" />
          <span className="text-sm opacity-70">Voice message unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <div className={cn(
        "flex items-center gap-3 rounded-lg p-3 min-w-[240px]",
        isOutgoing ? "bg-white/15" : "bg-black/5"
      )}>
        <div className={cn(
          "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
          isOutgoing ? "bg-white/20" : "bg-emerald-100"
        )}>
          <Mic className={cn("w-5 h-5", isOutgoing ? "text-white" : "text-emerald-600")} />
        </div>
        <audio
          controls
          preload="none"
          className="flex-1 min-w-0 h-8"
          style={{ maxWidth: '100%' }}
        >
          <source src={audioUrl} />
          Your browser does not support audio playback.
        </audio>
      </div>
    </div>
  );
}

function renderStickerMessage(content: any, isOutgoing: boolean) {
  const workspaceId = getWorkspaceId();
  const mediaId = content?.id;

  const stickerUrl = (mediaId && typeof mediaId === 'string' && mediaId.length > 5)
    ? `${WHATSAPP_REST_API_PREFIX}/media/${mediaId}?workspace_id=${workspaceId}`
    : (content?.url || content?.link || content?.media_url);

  const handleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!mediaId || !workspaceId) {
      toast.error('Missing media ID or workspace ID');
      return;
    }

    try {
      const resp = await fetch(`${WHATSAPP_REST_API_PREFIX}/stickers/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_id: mediaId,
          workspace_id: workspaceId,
          mime_type: content?.mime_type,
          sha256: content?.sha256
        })
      });

      if (resp.ok) {
        toast.success('Sticker added to favorites!');
      } else {
        const errData = await resp.json().catch(() => ({}));
        console.error('Failed to favorite sticker:', resp.status, errData);
        toast.error(`Failed to save: ${resp.status} ${errData.error || 'Server error'}. Check if frontend points to correct backend.`);
      }
    } catch (err) {
      console.error('Failed to favorite sticker:', err);
      toast.error('Network error while saving sticker. Check backend connection.');
    }
  };

  return (
    <div className="relative group">
      <div className="p-1">
        {stickerUrl ? (
          <img
            src={stickerUrl}
            alt="Sticker"
            className="w-[120px] h-[120px] object-contain cursor-pointer"
            onClick={() => window.open(stickerUrl, '_blank')}
          />
        ) : (
          <div className="w-[120px] h-[120px] bg-black/5 flex flex-col items-center justify-center rounded border border-dashed border-black/10">
            <AlertCircle className="w-6 h-6 opacity-20 mb-1" />
            <span className="text-[10px] opacity-40">Media Error</span>
            <span className="text-[8px] opacity-30 mt-1">Check Backend Proxy</span>
          </div>
        )}
      </div>

      {!isOutgoing && mediaId && (
        <button
          onClick={handleFavorite}
          className="absolute top-1 right-1 p-1.5 bg-white/95 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-yellow-50 border border-yellow-100"
          title="Add to favorites"
        >
          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
        </button>
      )}
    </div>
  );
}

function renderVideoMessage(content: any, isOutgoing: boolean) {
  const workspaceId = getWorkspaceId();
  const mediaId = content?.id || content?.video?.id;

  const videoUrl = (mediaId && typeof mediaId === 'string' && mediaId.length > 5)
    ? `${WHATSAPP_REST_API_PREFIX}/media/${mediaId}?workspace_id=${workspaceId}`
    : (content?.video?.link || content?.url || content?.link || content?.media_url);

  return (
    <div>
      <div className="flex items-center justify-center gap-2 bg-black/20 p-8">
        <Video className="w-6 h-6" />
        <span>Video</span>
        {videoUrl && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline ml-2"
          >
            View
          </a>
        )}
      </div>
      {content?.caption && (
        <p className="px-4 py-2 break-words">{String(content.caption)}</p>
      )}
    </div>
  );
}


function renderDocumentMessage(content: any, isOutgoing: boolean) {
  const workspaceId = getWorkspaceId();
  const mediaId = content?.id || content?.document?.id;

  const docUrl = (mediaId && typeof mediaId === 'string' && mediaId.length > 5)
    ? `${WHATSAPP_REST_API_PREFIX}/media/${mediaId}?workspace_id=${workspaceId}`
    : (content?.document?.link || content?.url || content?.link || content?.media_url);

  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-2 bg-black/10 rounded p-3">
        <FileText className="w-5 h-5" />
        <div className="flex-1 min-w-0">
          {(content?.filename || content?.document?.filename) && (
            <p className="text-sm font-medium truncate">{String(content?.filename || content?.document?.filename)}</p>
          )}
          {docUrl && (
            <a
              href={docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline"
            >
              Download
            </a>
          )}
        </div>
      </div>
      {content?.caption && (
        <p className="mt-2 break-words">{String(content.caption)}</p>
      )}
    </div>
  );
}

function renderInteractiveMessage(content: MessageContent, isOutgoing: boolean) {
  // Handle incoming button/list replies from users
  if (content?.interactive_type === 'button_reply') {
    return (
      <div className="px-4 py-2">
        <div className={cn(
          "inline-block px-4 py-2 rounded-lg",
          isOutgoing ? "bg-white/10" : "bg-primary/10"
        )}>
          <p className="text-xs opacity-70 mb-1">🔘 Button Reply</p>
          <p className="font-medium">{content?.button_title || 'Button clicked'}</p>
        </div>
      </div>
    );
  }

  if (content?.interactive_type === 'list_reply') {
    return (
      <div className="px-4 py-2">
        <div className={cn(
          "inline-block px-4 py-2 rounded-lg",
          isOutgoing ? "bg-white/10" : "bg-primary/10"
        )}>
          <p className="text-xs opacity-70 mb-1">📋 List Selection</p>
          <p className="font-medium">{content?.list_title || 'Item selected'}</p>
          {content?.list_description && (
            <p className="text-xs opacity-70">{content.list_description}</p>
          )}
        </div>
      </div>
    );
  }

  // Handle outgoing interactive messages (buttons/list sent by business)
  const buttons = content?.action?.buttons || content?.buttons || [];
  const sections = content?.action?.sections || content?.sections || [];
  const listButton = content?.action?.button;

  return (
    <div>
      {/* Header */}
      {content?.header && (
        <p className="px-4 pt-2 font-semibold">{String(content.header)}</p>
      )}

      {/* Body */}
      <div className="px-4 py-2">
        {content?.body && <p className="break-words">{String(content.body)}</p>}
        {content?.text && !content?.body && <p className="break-words">{String(content.text)}</p>}
      </div>

      {/* Footer */}
      {content?.footer && (
        <p className="px-4 pb-2 text-xs opacity-70">{String(content.footer)}</p>
      )}

      {/* Reply Buttons */}
      {buttons.length > 0 && (
        <div className="border-t border-white/10">
          {buttons.map((btn: any, idx: number) => {
            const buttonTitle = btn?.reply?.title || btn?.title || `Button ${idx + 1}`;
            return (
              <div
                key={idx}
                className={cn(
                  "text-center py-2.5 border-b border-white/10 last:border-b-0 font-medium text-sm",
                  isOutgoing ? "text-blue-200" : "text-blue-600"
                )}
              >
                {buttonTitle}
              </div>
            );
          })}
        </div>
      )}

      {/* List sections */}
      {sections.length > 0 && (
        <div className="border-t border-white/10">
          {listButton && (
            <div className={cn(
              "text-center py-2.5 font-medium text-sm",
              isOutgoing ? "text-blue-200" : "text-blue-600"
            )}>
              📋 {listButton}
            </div>
          )}
          {sections.map((section: any, sIdx: number) => (
            <div key={sIdx} className="border-t border-white/5">
              {section.title && (
                <p className="px-4 py-1.5 text-xs font-semibold opacity-70">
                  {section.title}
                </p>
              )}
              {section.rows?.map((row: any, rIdx: number) => (
                <div
                  key={rIdx}
                  className={cn(
                    "px-4 py-2 border-t border-white/5",
                    isOutgoing ? "text-blue-200" : "text-blue-600"
                  )}
                >
                  <p className="font-medium text-sm">{row.title}</p>
                  {row.description && (
                    <p className="text-xs opacity-70">{row.description}</p>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderStatusWithText(status: string, isFailed: boolean) {
  if (isFailed) {
    return (
      <>
        <AlertCircle className="w-3 h-3 text-red-500" />
        <span className="text-red-500">Failed</span>
      </>
    );
  }

  switch (status) {
    case 'pending':
      return (
        <>
          <Clock className="w-3 h-3 animate-pulse" />
          <span>Sending...</span>
        </>
      );
    case 'sent':
      return (
        <>
          <Check className="w-3 h-3" />
          <span>Sent</span>
        </>
      );
    case 'delivered':
      return (
        <>
          <CheckCheck className="w-3 h-3" />
          <span>Delivered</span>
        </>
      );
    case 'read':
      return (
        <>
          <CheckCheck className="w-3 h-3 text-blue-400" />
          <span className="text-blue-400">Read</span>
        </>
      );
    default:
      return null;
  }
}

function renderButtonMessage(content: any, isOutgoing: boolean) {
  return (
    <div className="px-4 py-2">
      <div className={cn(
        "inline-block px-4 py-2 rounded-lg",
        isOutgoing ? "bg-white/10" : "bg-primary/10"
      )}>
        <p className="text-xs opacity-70 mb-1">🔘 Quick Reply</p>
        <p className="font-medium">{content?.button_text || content?.button_payload || 'Button clicked'}</p>
      </div>
    </div>
  );
}

function OrderProductThumb({ item, label }: { item: OrderLineItem; label: string }) {
  const workspaceId = getWorkspaceId();
  const imageSrc = getOrderProductImageSrc(item, WHATSAPP_REST_API_PREFIX, workspaceId);

  if (!imageSrc) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-black/10 text-lg">
        🛍️
      </div>
    );
  }

  return (
    <SafeImage
      src={imageSrc}
      alt={label}
      className="h-12 w-12 shrink-0 rounded-md object-cover"
      fallbackClassName="h-12 w-12 shrink-0 rounded-md"
      fallbackText=""
      hideOnError={false}
    />
  );
}

function renderOrderMessage(content: any, isOutgoing: boolean) {
  const { catalog_id, text, items } = extractOrderData(content);
  const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return (
    <div className="px-4 py-2">
      <div className="flex flex-col gap-2 rounded-lg bg-black/5 p-3">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 shrink-0 opacity-70" />
          <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
            Catalog cart submitted
          </p>
        </div>

        {catalog_id && (
          <p className="text-[11px] opacity-60">Catalog ID: {catalog_id}</p>
        )}

        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item, idx) => {
              const price = formatOrderPrice(item);
              const label = item.name || item.product_retailer_id || `Item ${idx + 1}`;
              return (
                <div
                  key={`${item.product_retailer_id || idx}-${idx}`}
                  className="flex gap-3 border-t border-black/5 pt-2 first:border-t-0 first:pt-0"
                >
                  <OrderProductThumb item={item} label={label} />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium break-words">{label}</p>
                    {item.product_retailer_id && item.name && (
                      <p className="text-[11px] opacity-60">SKU: {item.product_retailer_id}</p>
                    )}
                    <p className="text-xs opacity-75">Qty: {item.quantity ?? 1}</p>
                  </div>
                  {price && <span className="shrink-0 text-sm font-semibold">{price}</span>}
                </div>
              );
            })}
            <p className="border-t border-black/5 pt-2 text-xs font-medium opacity-80">
              {items.length} product{items.length === 1 ? '' : 's'} · {totalQty} item{totalQty === 1 ? '' : 's'} total
            </p>
          </div>
        ) : (
          <p className="text-sm opacity-75">
            Cart was submitted, but line items were not included in the webhook payload.
          </p>
        )}

        {text && (
          <p className="border-t border-black/5 pt-2 text-sm italic break-words">
            &ldquo;{text}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

function renderLocationMessage(content: any) {
  const lat = content?.latitude;
  const lng = content?.longitude;
  const address = content?.address || '';
  const name = content?.name || '';
  const mapUrl = (lat && lng) ? `https://www.google.com/maps?q=${lat},${lng}` : null;

  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-2 bg-black/10 rounded p-3">
        <span className="text-xl">📍</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{name || 'Location Shared'}</p>
          {address && <p className="text-xs opacity-70 truncate">{address}</p>}
          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline mt-1 block"
            >
              View on Google Maps
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function renderContactsMessage(content: any) {
  const contactsList = content?.contacts || [];
  return (
    <div className="px-4 py-2">
      <div className="flex flex-col gap-2 bg-black/10 rounded p-3">
        <p className="text-xs opacity-70">👤 Contact Card(s)</p>
        {contactsList.map((contact: any, index: number) => {
          const name = contact?.name?.formatted_name || contact?.name?.first_name || 'Contact';
          const phones = (contact?.phones || []).map((p: any) => p.phone).join(', ');
          return (
            <div key={index} className="border-t border-black/5 pt-2 first:border-t-0 first:pt-0">
              <p className="text-sm font-semibold">{name}</p>
              {phones && <p className="text-xs opacity-70">{phones}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderReactionMessage(content: any) {
  return (
    <div className="px-4 py-2">
      <p className="text-xs opacity-70 italic">
        Reacted: {content?.emoji || '❤️'}
      </p>
    </div>
  );
}
