// Conversation Item Component
// ============================
// Single conversation row with beautiful hover effects and animations

import { formatDistanceToNow } from 'date-fns';
import { Conversation } from '../types';
import { cn } from '@/lib/utils';
import { AttributionBadge } from '@/ctwa/components/AttributionBadge';
import { User, MessageCircle, CheckCheck, Flame } from 'lucide-react';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
  needsReply?: boolean;
}

export function ConversationItem({ conversation, isActive, onClick, onDelete, needsReply = false }: ConversationItemProps) {
  let lastMessagePreview = 'No messages yet';

  if (conversation.messages && conversation.messages.length > 0) {
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    lastMessagePreview = getMessagePreview(lastMessage);
  } else if (conversation.last_message_at) {
    lastMessagePreview = 'Tap to view messages';
  }

  const hasUnread = conversation.unread_count > 0;

  // Normalize phone number (strip leading 91 or 1 if > 10 chars)
  let displayPhone = conversation.user_phone;
  if (displayPhone.length > 10) {
    if (displayPhone.startsWith('91')) displayPhone = displayPhone.substring(2);
    else if (displayPhone.startsWith('1')) displayPhone = displayPhone.substring(1);
  }

  return (
    <div className="relative group/item">
      <button
        onClick={onClick}
        className={cn(
          'w-full p-4 text-left border-b transition-all duration-200 group relative overflow-hidden pr-10', // Added pr-10 for delete button space
          'hover:bg-gradient-to-r hover:from-primary/5 hover:to-primary/10',
          'hover:shadow-sm hover:border-l-4 hover:border-l-primary/50',
          'active:scale-[0.99] active:bg-primary/10',
          isActive && 'bg-gradient-to-r from-primary/10 to-primary/5 border-l-4 border-l-primary shadow-sm'
        )}
      >
        {/* Hover effect shimmer */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-[shimmer_1s_ease-in-out] pointer-events-none" />

        <div className="flex items-start gap-3 relative z-10">
          {/* Avatar */}
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300',
            'bg-gradient-to-br from-primary/20 to-primary/10',
            'group-hover:scale-110 group-hover:shadow-md group-hover:shadow-primary/20',
            isActive && 'scale-110 shadow-md shadow-primary/20'
          )}>
            <User className={cn(
              'w-5 h-5 transition-colors',
              hasUnread ? 'text-primary' : 'text-primary/70'
            )} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="min-w-0 flex-1">
                <h4 className={cn(
                  'font-semibold truncate transition-colors',
                  hasUnread && 'text-primary',
                  'group-hover:text-primary'
                )}>
                  {conversation.user_name || displayPhone}
                </h4>
                {conversation.user_name && (
                  <p className="text-xs text-muted-foreground truncate">
                    {displayPhone}
                  </p>
                )}
              </div>

              {/* Attribution Badge */}
              <AttributionBadge
                entrySource={conversation.entry_source}
                attribution={conversation.attribution_data}
                compact
              />

              {/* Unread badge with animation */}
              {hasUnread && (
                <span className="flex-shrink-0 px-2 py-0.5 text-xs font-bold text-white bg-gradient-to-r from-primary to-primary/80 rounded-full shadow-sm shadow-primary/30 animate-pulse">
                  {conversation.unread_count}
                </span>
              )}

              {/* Needs Reply badge - urgent */}
              {needsReply && (
                <span className="flex-shrink-0 px-2 py-0.5 text-xs font-bold text-orange-700 bg-orange-100 rounded-full flex items-center gap-1 animate-pulse">
                  <Flame className="w-3 h-3" />
                  Reply
                </span>
              )}

              {/* Session status badge - Simple badge to save space */}
              {conversation.is_session_open ? (
                <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-full flex items-center gap-1" title="24h session active">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  Active
                </span>
              ) : conversation.closed_by_agent ? (
                <span className="flex-shrink-0 px-2 py-0.5 text-xs font-medium text-red-700 bg-red-100 rounded-full">
                  Closed
                </span>
              ) : conversation.close_reason === 'expired' ? (
                <span className="flex-shrink-0 px-2 py-0.5 text-xs text-muted-foreground bg-muted rounded">
                  Expired
                </span>
              ) : conversation.last_inbound_at && (
                <span className="flex-shrink-0 px-2 py-0.5 text-xs text-muted-foreground bg-muted rounded">
                  Waiting
                </span>
              )}

              {conversation.status === 'closed' && !conversation.closed_by_agent && (
                <span className="flex-shrink-0 px-2 py-0.5 text-xs text-muted-foreground bg-muted rounded flex items-center gap-1">
                  <CheckCheck className="w-3 h-3" />
                  Resolved
                </span>
              )}
            </div>

            {/* Message preview */}
            <p className={cn(
              'text-sm truncate transition-colors',
              hasUnread ? 'text-foreground/80 font-medium' : 'text-muted-foreground'
            )}>
              {lastMessagePreview}
            </p>
          </div>
        </div>

        <style>{`
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </button>

      {/* Delete Button - Only visible on hover */}
      <button
        onClick={onDelete}
        className="absolute top-1/2 right-2 -translate-y-1/2 p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full opacity-0 group-hover/item:opacity-100 transition-all duration-200 z-20"
        title="Delete conversation"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18"></path>
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
        </svg>
      </button>
    </div>
  );
}

function getMessagePreview(message: any): string {
  if (!message.content) return 'Empty message';

  switch (message.type) {
    case 'text':
      return (message.content.text || message.content.body || '').substring(0, 50);
    case 'template':
      return `📝 Template: ${message.content.template_name || 'Unknown'}`;
    case 'image':
      return '📷 Image';
    case 'video':
      return '🎥 Video';
    case 'audio':
      return '🎵 Audio';
    case 'document':
      return '📄 Document';
    case 'interactive':
      return '🔘 Interactive';
    default:
      return 'Message';
  }
}
