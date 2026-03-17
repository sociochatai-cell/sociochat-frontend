// Message Bubble Component
// =======================
// Individual message display (incoming/outgoing)

import { format } from 'date-fns';
import { Check, CheckCheck, AlertCircle, Image, Video, FileText, Mic, Clock } from 'lucide-react';
import { ConversationMessage } from '../types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

// Template info from API
interface TemplateInfo {
  name: string;
  body: string | null;
  header: string | null;
  footer: string | null;
}

interface MessageBubbleProps {
  message: ConversationMessage;
  templates?: Record<string, TemplateInfo>;
}

export function MessageBubble({ message, templates = {} }: MessageBubbleProps) {
  const isOutgoing = message.direction === 'outgoing';
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
        {isFailed && message.error_message && (
          <div className="px-4 pb-2 text-xs opacity-90 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>{message.error_message}</span>
          </div>
        )}
      </div>
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
      return (
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 bg-black/10 rounded p-3">
            <Mic className="w-5 h-5" />
            <span>Audio message</span>
          </div>
        </div>
      );

    case 'document':
      return renderDocumentMessage(content, isOutgoing);

    case 'interactive':
      return renderInteractiveMessage(content, isOutgoing);

    default:
      return <p className="text-xs opacity-70 px-4 py-2">Unsupported message type: {type}</p>;
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
        {content?.footer && (
          <p className="text-xs mt-2 opacity-70">{String(content.footer)}</p>
        )}

        {/* Error message */}
        {content?.error_message && (
          <p className="text-xs mt-1 text-destructive">
            Error: {String(content.error_message)}
          </p>
        )}
      </div>

      {/* Buttons */}
      {content?.buttons && content.buttons.length > 0 && (
        <div className="border-t border-white/10">
          {content.buttons.map((btn, idx) => (
            <div
              key={idx}
              className="text-center py-2 border-b border-white/10 last:border-b-0 text-blue-400 font-medium text-sm"
            >
              {btn.title}
            </div>
          ))}
        </div>
      )}
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

function renderImageMessage(content: MessageContent, isOutgoing: boolean) {
  const imageUrl = content?.image_url || content?.url || content?.link || content?.media_url;

  // Debug log to help troubleshoot image issues
  console.log('🖼️ renderImageMessage - content:', content, 'imageUrl:', imageUrl);

  // Check if it's a Google Drive URL
  const isGoogleDrive = imageUrl?.includes('drive.google.com');

  // Extract Google Drive file ID and create direct preview URL
  const getGoogleDrivePreviewUrl = (url: string): string => {
    const fileIdMatch = url.match(/[?&]id=([^&]+)/);
    if (fileIdMatch) {
      // Use lh3.googleusercontent.com for direct image access
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }
    return url;
  };

  const displayUrl = isGoogleDrive && imageUrl ? getGoogleDrivePreviewUrl(imageUrl) : imageUrl;

  return (
    <div>
      {displayUrl ? (
        <div className="relative">
          <img
            src={displayUrl}
            alt="Image message"
            className="w-full h-auto max-h-64 object-cover cursor-pointer"
            onClick={() => window.open(imageUrl || displayUrl, '_blank')}
            referrerPolicy="no-referrer"
            onError={(e) => {
              console.error('🖼️ Image load error for URL:', displayUrl);
              // Try iframe fallback for Google Drive
              const target = e.target as HTMLImageElement;
              if (isGoogleDrive && imageUrl) {
                const container = target.parentElement;
                if (container) {
                  target.style.display = 'none';
                  const fallback = document.createElement('div');
                  fallback.innerHTML = `
                    <div 
                      class="flex flex-col items-center justify-center gap-2 bg-black/20 p-4 cursor-pointer hover:bg-black/30"
                      onclick="window.open('${imageUrl}', '_blank')"
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

function renderVideoMessage(content: MessageContent, isOutgoing: boolean) {
  const videoUrl = content?.url || content?.link || content?.media_url;

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

function renderDocumentMessage(content: MessageContent, isOutgoing: boolean) {
  const docUrl = content?.url || content?.link || content?.media_url;

  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-2 bg-black/10 rounded p-3">
        <FileText className="w-5 h-5" />
        <div className="flex-1 min-w-0">
          {content?.filename && (
            <p className="text-sm font-medium truncate">{String(content.filename)}</p>
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
