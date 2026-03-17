// Message Composer Component
// ==========================
// Premium composer with emoji, attachments, templates, and AI rewrite

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Loader2,
  Lock,
  Paperclip,
  Smile,
  Zap,
  Sparkles,
  Image,
  FileText,
  Video,
  X,
  Wand2,
  Undo2,
  Redo2,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { sendTextMessageFromInbox, uploadChatMedia, sendMediaMessageFromInbox } from '../api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { API_BASE_URL } from '@/config';
import { ConversationMessage } from '../types';
import { TemplatesPanel } from './TemplatesPanel';

interface MessageComposerProps {
  to: string;
  onMessageSent: (message?: ConversationMessage, newConversationId?: number) => void;
  disabled?: boolean;
  closedByAgent?: boolean;
  phoneNumberId?: string;
  recipientName?: string;
  accountId?: number;
}

// Accepted file types for each media type
const ACCEPTED_FILES = {
  image: '.jpg,.jpeg,.png,.webp,.gif',
  video: '.mp4,.mov,.3gp,.avi,.mpeg',
  document: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar',
};

// Max file sizes (in bytes)
const MAX_FILE_SIZES = {
  image: 5 * 1024 * 1024,     // 5MB
  video: 16 * 1024 * 1024,    // 16MB
  document: 100 * 1024 * 1024, // 100MB
};

// Common emoji set
const QUICK_EMOJIS = ['👋', '👍', '❤️', '😊', '🙏', '✅', '🎉', '💯', '🔥', '⭐', '💪', '🤝'];

// Tone options with icons and colors
const TONE_OPTIONS = [
  { id: 'professional', label: 'Professional', emoji: '💼', color: 'text-blue-600' },
  { id: 'friendly', label: 'Friendly', emoji: '😊', color: 'text-yellow-600' },
  { id: 'casual', label: 'Casual', emoji: '👋', color: 'text-green-600' },
  { id: 'formal', label: 'Formal', emoji: '🎩', color: 'text-purple-600' },
  { id: 'empathetic', label: 'Empathetic', emoji: '💝', color: 'text-pink-600' },
  { id: 'concise', label: 'Concise', emoji: '⚡', color: 'text-orange-600' },
];

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageComposer({
  to,
  onMessageSent,
  disabled = false,
  closedByAgent = false,
  phoneNumberId,
  recipientName,
  accountId,
}: MessageComposerProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showToneMenu, setShowToneMenu] = useState(false);
  const [aiRewriting, setAiRewriting] = useState(false);
  // Undo/Redo history for AI rewrites
  const [messageHistory, setMessageHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Media upload state
  const [showMediaDialog, setShowMediaDialog] = useState(false);
  const [mediaType, setMediaType] = useState<'image' | 'video' | 'document'>('image');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaCaption, setMediaCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Memoize preview URL to prevent flickering
  const previewUrl = useMemo(() => {
    if (selectedFile) {
      return URL.createObjectURL(selectedFile);
    }
    return '';
  }, [selectedFile]);

  const isDisabled = disabled || closedByAgent;
  const hasText = message.trim().length > 0;

  const handleSend = async () => {
    const text = message.trim();
    if (!text || sending || isDisabled) return;

    setSending(true);
    try {
      const result = await sendTextMessageFromInbox(to, text, false, undefined, phoneNumberId);

      if (result.success) {
        setMessage('');
        // Backend returns 'message' object with full ConversationMessage data
        onMessageSent((result as any).message, (result as any).conversation_id);
        toast.success('Message sent');
      } else {
        toast.error(result.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Handle keyboard shortcuts


  // Insert emoji at cursor
  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = message.slice(0, start) + emoji + message.slice(end);
      setMessage(newText);
      // Reset cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setMessage((prev) => prev + emoji);
    }
    setShowEmojiPicker(false);
  };

  // AI Rewrite with tone
  const handleAiRewrite = async (tone: string) => {
    if (!message.trim() || !accountId) {
      toast.error('Please enter a message first');
      return;
    }

    setAiRewriting(true);
    setShowToneMenu(false);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/whatsapp/accounts/${accountId}/ai/rewrite-message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            message: message.trim(),
            tone: tone,
          }),
        }
      );

      const data = await response.json();

      if (data.success && data.rewritten) {
        // Save current message to history before replacing
        setMessageHistory(prev => {
          const newHistory = [...prev.slice(0, historyIndex + 1), message.trim()];
          return newHistory;
        });
        setHistoryIndex(prev => prev + 1);

        setMessage(data.rewritten);
        toast.success(`Rewritten in ${tone} tone`);
        // Focus textarea after rewrite
        setTimeout(() => textareaRef.current?.focus(), 100);
      } else {
        toast.error(data.error || 'Failed to rewrite message');
      }
    } catch (error) {
      console.error('AI rewrite error:', error);
      toast.error('Failed to rewrite message');
    } finally {
      setAiRewriting(false);
    }
  };

  // Undo - go back to previous message in history
  const handleUndo = () => {
    if (historyIndex >= 0) {
      // If at end of history, save current (rewritten) message first
      if (historyIndex === messageHistory.length - 1) {
        setMessageHistory(prev => [...prev, message]);
      }
      setMessage(messageHistory[historyIndex]);
      setHistoryIndex(prev => prev - 1);
    }
  };

  // Redo - go forward in history
  const handleRedo = () => {
    if (historyIndex < messageHistory.length - 1) {
      const nextIndex = historyIndex + 2;
      if (nextIndex < messageHistory.length) {
        setMessage(messageHistory[nextIndex]);
        setHistoryIndex(prev => prev + 1);
      }
    }
  };

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex < messageHistory.length - 1;

  // Handle opening media dialog for specific type
  const handleOpenMediaDialog = (type: 'image' | 'video' | 'document') => {
    setMediaType(type);
    setSelectedFile(null);
    setMediaCaption('');
    setUploadProgress(0);
    setShowAttachMenu(false);
    setShowMediaDialog(true);
    // Trigger file input after dialog opens
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    const maxSize = MAX_FILE_SIZES[mediaType];
    if (file.size > maxSize) {
      toast.error(`File too large. Maximum size for ${mediaType} is ${formatFileSize(maxSize)}`);
      return;
    }

    setSelectedFile(file);
  };

  // Handle media upload and send
  const handleSendMedia = async () => {
    if (!selectedFile || uploading) return;

    setUploading(true);
    setUploadProgress(10);

    try {
      // Step 1: Upload to storage
      setUploadProgress(30);
      const uploadResult = await uploadChatMedia(selectedFile);

      if (!uploadResult.success || !uploadResult.public_url) {
        toast.error(uploadResult.error || 'Failed to upload file');
        setUploading(false);
        return;
      }

      setUploadProgress(70);

      // Step 2: Send media message via WhatsApp
      const sendResult = await sendMediaMessageFromInbox(
        to,
        mediaType,
        uploadResult.public_url,
        mediaCaption || undefined,
        selectedFile.name,
        phoneNumberId
      );

      setUploadProgress(100);

      if (sendResult.success) {
        toast.success(`${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} sent successfully!`);

        // Create a proper message object if backend didn't return one
        const messageFromBackend = (sendResult as any).message;
        const newConversationId = (sendResult as any).conversation_id;
        const sentMessage: ConversationMessage = messageFromBackend || {
          id: (sendResult as any).message_id || Date.now(),
          conversation_id: newConversationId || 0,
          direction: 'outgoing' as const,
          type: mediaType,
          content: {
            media_type: mediaType,
            url: uploadResult.public_url,
            caption: mediaCaption || undefined,
            filename: selectedFile.name,
          },
          body: mediaCaption || `[${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}]`,
          status: 'sent',
          timestamp: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        // Notify parent about the sent message
        onMessageSent(sentMessage, newConversationId);

        // Close dialog and reset
        setShowMediaDialog(false);
        setSelectedFile(null);
        setMediaCaption('');
      } else {
        toast.error(sendResult.error || 'Failed to send media message');
      }
    } catch (error) {
      console.error('Media send error:', error);
      toast.error('Failed to send media');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Clear selected file
  const handleClearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Session expired state - don't block, just track for visual styling
  const isSessionExpired = disabled || closedByAgent;
  const sessionExpiredTooltip = closedByAgent ? 'Chat closed by agent' : 'Session expired';

  return (
    <TooltipProvider>
      <div className="border-t bg-gradient-to-r from-background to-muted/20">
        {/* Action Toolbar */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-border/50">
          {/* Attachment - grey out when session expired */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Popover open={!isSessionExpired && showAttachMenu} onOpenChange={setShowAttachMenu}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        isSessionExpired
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-primary/10 hover:text-primary"
                      )}
                      disabled={isSessionExpired}
                    >
                      <Paperclip className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-40 p-2" align="start">
                    <div className="space-y-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => handleOpenMediaDialog('image')}
                      >
                        <Image className="w-4 h-4 text-blue-500" />
                        Image
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => handleOpenMediaDialog('video')}
                      >
                        <Video className="w-4 h-4 text-purple-500" />
                        Video
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2"
                        onClick={() => handleOpenMediaDialog('document')}
                      >
                        <FileText className="w-4 h-4 text-orange-500" />
                        Document
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </TooltipTrigger>
            {isSessionExpired ? (
              <TooltipContent>
                <p>{sessionExpiredTooltip}</p>
              </TooltipContent>
            ) : null}
          </Tooltip>

          {/* Emoji Picker - grey out when session expired */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Popover open={!isSessionExpired && showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        isSessionExpired
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-primary/10 hover:text-primary"
                      )}
                      disabled={isSessionExpired}
                    >
                      <Smile className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="start">
                    <div className="grid grid-cols-6 gap-1">
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => insertEmoji(emoji)}
                          className="w-8 h-8 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </TooltipTrigger>
            {isSessionExpired ? (
              <TooltipContent>
                <p>{sessionExpiredTooltip}</p>
              </TooltipContent>
            ) : null}
          </Tooltip>

          {/* Divider */}
          <div className="w-px h-5 bg-border mx-1" />

          {/* Templates */}
          {/* Templates */}
          <TemplatesPanel
            accountId={accountId || null}
            recipientPhone={to}
            recipientName={recipientName || ''}
            phoneNumberId={phoneNumberId || ''}
            onTemplateSent={(msg, cid) => onMessageSent(msg, cid)}
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 hover:bg-primary/10 hover:text-primary"
              >
                <Zap className="w-4 h-4" />
                <span className="text-xs">Templates</span>
              </Button>
            }
          />

          {/* AI Rewrite - grey out when session expired */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Popover open={!isSessionExpired && showToneMenu} onOpenChange={setShowToneMenu}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!hasText || aiRewriting || isSessionExpired}
                      className={cn(
                        'h-8 gap-1.5 transition-all',
                        isSessionExpired
                          ? 'opacity-40 cursor-not-allowed'
                          : hasText
                            ? 'hover:bg-purple-100 hover:text-purple-600'
                            : 'opacity-50 cursor-not-allowed',
                        aiRewriting && 'bg-purple-50'
                      )}
                    >
                      {aiRewriting ? (
                        <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                      ) : (
                        <Wand2 className="w-4 h-4" />
                      )}
                      <span className="text-xs">AI Rewrite</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="start">
                    <p className="text-xs text-muted-foreground mb-2 px-2">Choose a tone:</p>
                    <div className="space-y-1">
                      {TONE_OPTIONS.map((tone) => (
                        <Button
                          key={tone.id}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start gap-2"
                          onClick={() => handleAiRewrite(tone.id)}
                        >
                          <span className="text-base">{tone.emoji}</span>
                          <span className={tone.color}>{tone.label}</span>
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </TooltipTrigger>
            {isSessionExpired ? (
              <TooltipContent>
                <p>{sessionExpiredTooltip}</p>
              </TooltipContent>
            ) : null}
          </Tooltip>

          {/* Undo/Redo buttons - Show only when there's history */}
          <AnimatePresence>
            {(canUndo || canRedo) && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex items-center gap-1"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-7 w-7',
                    canUndo ? 'hover:bg-orange-100 hover:text-orange-600' : 'opacity-40 cursor-not-allowed'
                  )}
                  onClick={handleUndo}
                  disabled={!canUndo}
                  title="Undo (restore original)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-7 w-7',
                    canRedo ? 'hover:bg-green-100 hover:text-green-600' : 'opacity-40 cursor-not-allowed'
                  )}
                  onClick={handleRedo}
                  disabled={!canRedo}
                  title="Redo (restore AI rewrite)"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Keyboard hint */}
          <span className="text-xs text-muted-foreground hidden sm:block">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Enter</kbd>
            {' '}new line
          </span>
        </div>

        {/* Input Area */}
        <div className="p-4 pt-2">
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={isSessionExpired ? sessionExpiredTooltip : "Type a message..."}
                    rows={2}
                    disabled={sending || aiRewriting || isSessionExpired}
                    className={cn(
                      "resize-none min-h-[60px] focus-visible:ring-primary/50",
                      aiRewriting && "bg-purple-50/50",
                      isSessionExpired && "opacity-50 cursor-not-allowed bg-muted/30"
                    )}
                  />
                </div>
              </TooltipTrigger>
              {isSessionExpired && (
                <TooltipContent>
                  <p>{sessionExpiredTooltip}</p>
                </TooltipContent>
              )}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div
                  initial={false}
                  animate={{
                    scale: message.trim() && !isSessionExpired ? 1 : 0.9,
                    opacity: message.trim() && !isSessionExpired ? 1 : 0.5
                  }}
                >
                  <Button
                    onClick={handleSend}
                    disabled={!message.trim() || sending || aiRewriting || isSessionExpired}
                    size="icon"
                    className={cn(
                      "self-end h-[60px] w-12 shadow-lg",
                      isSessionExpired
                        ? "opacity-40 cursor-not-allowed bg-gray-400"
                        : "bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-primary/20"
                    )}
                  >
                    {sending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isSessionExpired ? (
                      <Lock className="w-5 h-5" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </Button>
                </motion.div>
              </TooltipTrigger>
              {isSessionExpired && (
                <TooltipContent>
                  <p>{sessionExpiredTooltip}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILES[mediaType]}
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Media Upload Dialog */}
        <Dialog open={showMediaDialog} onOpenChange={setShowMediaDialog}>
          <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="flex items-center gap-2">
                {mediaType === 'image' && <Image className="w-5 h-5 text-blue-500" />}
                {mediaType === 'video' && <Video className="w-5 h-5 text-purple-500" />}
                {mediaType === 'document' && <FileText className="w-5 h-5 text-orange-500" />}
                Send {mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}
              </DialogTitle>
              <DialogDescription>
                Select a {mediaType} to send. Max size: {formatFileSize(MAX_FILE_SIZES[mediaType])}
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 pt-2">
              {!selectedFile ? (
                <>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  >
                    <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
                    <p className="text-base font-medium text-foreground">
                      Click to select a {mediaType}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {ACCEPTED_FILES[mediaType].replace(/,/g, ', ')}
                    </p>
                  </div>
                  <div className="flex justify-end mt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowMediaDialog(false)}
                      disabled={uploading}
                    >
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="border rounded-xl overflow-hidden shadow-sm">
                  {/* 1. Media Preview Area - The "Tile" Content */}
                  <div className="bg-muted/30 flex justify-center items-center min-h-[200px] border-b">
                    {mediaType === 'image' ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-h-[400px] w-auto max-w-full object-contain"
                      />
                    ) : mediaType === 'video' ? (
                      <video
                        src={previewUrl}
                        className="max-h-[450px] w-auto max-w-full object-contain"
                        controls={false}
                        muted
                        autoPlay
                        loop
                        playsInline
                      />
                    ) : (
                      <div className="py-12 flex flex-col items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center">
                          <FileText className="w-10 h-10 text-orange-600" />
                        </div>
                        <p className="text-lg font-medium text-orange-700">Document Preview</p>
                      </div>
                    )}
                  </div>

                  {/* 2. Details & Actions Area */}
                  <div className="p-4 bg-card space-y-4">
                    {/* File Info */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate leading-none mb-1.5 hover:whitespace-normal hover:text-clip hover:overflow-visible">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(selectedFile.size)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 -mt-1 text-muted-foreground hover:text-destructive"
                        onClick={handleClearFile}
                        disabled={uploading}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Caption Input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground ml-1">
                        Caption (optional)
                      </label>
                      <Input
                        value={mediaCaption}
                        onChange={(e) => setMediaCaption(e.target.value)}
                        placeholder={`Add a caption...`}
                        disabled={uploading}
                        className="bg-muted/50"
                      />
                    </div>

                    {/* Upload Progress */}
                    {uploading && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Uploading...</span>
                          <span className="text-primary font-medium">{uploadProgress}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-primary"
                            initial={{ width: 0 }}
                            animate={{ width: `${uploadProgress}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Buttons - Inside the tile! */}
                    <div className="flex gap-3 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setShowMediaDialog(false)}
                        disabled={uploading}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1 gap-2"
                        onClick={handleSendMedia}
                        disabled={!selectedFile || uploading}
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            Send {mediaType === 'document' ? 'Doc' : mediaType.charAt(0).toUpperCase() + mediaType.slice(1)}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
