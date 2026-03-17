import React, { useState, useCallback, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  Info,
  MessageSquare,
  Zap,
  AlertCircle,
  Clock,
  IndianRupee as DollarSign
} from 'lucide-react';
import type { IceBreaker } from '../types';

// ============================================================
// Constants
// ============================================================

const MAX_ICE_BREAKERS = 4;
const MAX_TITLE_LENGTH = 20;
const MAX_PREFILLED_LENGTH = 256;

// ============================================================
// Types
// ============================================================

export type MessageMode = 'ice_breakers' | 'prefilled';

interface IceBreakersEditorProps {
  mode: MessageMode;
  iceBreakers: IceBreaker[];
  prefilledMessage: string;
  onModeChange: (mode: MessageMode) => void;
  onIceBreakersChange: (iceBreakers: IceBreaker[]) => void;
  onPrefilledMessageChange: (message: string) => void;
  className?: string;
}

// ============================================================
// Utility Functions
// ============================================================

const generateId = () => `ib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ============================================================
// Message Type Info Component
// ============================================================

const MessageTypeInfo: React.FC = () => {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-sm">Session Messages</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Free-form messages within the <strong>24-hour customer service window</strong>. 
            No additional cost when the customer initiates the conversation.
          </p>
          <Badge variant="outline" className="mt-2 text-xs">
            <DollarSign className="w-3 h-3 mr-1" />
            Free for 24 hours
          </Badge>
        </CardContent>
      </Card>
      
      <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-purple-600" />
            <CardTitle className="text-sm">Template Messages</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Pre-approved message templates that can be sent <strong>outside the 24-hour window</strong>. 
            Subject to Meta's template approval process.
          </p>
          <Badge variant="outline" className="mt-2 text-xs">
            <DollarSign className="w-3 h-3 mr-1" />
            Per-message cost
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================================
// Ice Breaker Item Component
// ============================================================

const IceBreakerItem: React.FC<{
  iceBreaker: IceBreaker;
  index: number;
  onUpdate: (id: string, updates: Partial<IceBreaker>) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}> = ({ iceBreaker, index, onUpdate, onRemove, disabled }) => {
  const inputId = useId();
  const titleLength = iceBreaker.title.length;
  const isOverLimit = titleLength > MAX_TITLE_LENGTH;
  
  return (
    <Card className={disabled ? 'opacity-50' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex-shrink-0">
            {index + 1}
          </div>
          
          <div className="flex-1 space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`${inputId}-title`}>Button Label</Label>
                <span 
                  className={`text-xs ${isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground'}`}
                  aria-live="polite"
                >
                  {titleLength}/{MAX_TITLE_LENGTH}
                </span>
              </div>
              <Input
                id={`${inputId}-title`}
                value={iceBreaker.title}
                onChange={(e) => onUpdate(iceBreaker.id, { title: e.target.value })}
                placeholder="e.g., Learn more"
                maxLength={MAX_TITLE_LENGTH + 5} // Allow a few extra for visibility
                disabled={disabled}
                className={isOverLimit ? 'border-destructive focus:ring-destructive' : ''}
                aria-invalid={isOverLimit}
                aria-describedby={isOverLimit ? `${inputId}-error` : undefined}
              />
              {isOverLimit && (
                <p id={`${inputId}-error`} className="text-xs text-destructive">
                  Label exceeds {MAX_TITLE_LENGTH} character limit
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={`${inputId}-payload`}>
                  Payload
                  <span className="text-muted-foreground font-normal ml-1">(optional)</span>
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        A developer payload that will be sent to your webhook when 
                        this button is clicked. Useful for tracking and automation.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id={`${inputId}-payload`}
                value={iceBreaker.payload || ''}
                onChange={(e) => onUpdate(iceBreaker.id, { payload: e.target.value })}
                placeholder="e.g., LEARN_MORE_CLICKED"
                disabled={disabled}
              />
            </div>
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(iceBreaker.id)}
                  disabled={disabled}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  aria-label={`Remove ice breaker ${index + 1}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Remove ice breaker</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================================
// Main Component
// ============================================================

export const IceBreakersEditor: React.FC<IceBreakersEditorProps> = ({
  mode,
  iceBreakers,
  prefilledMessage,
  onModeChange,
  onIceBreakersChange,
  onPrefilledMessageChange,
  className = '',
}) => {
  const componentId = useId();
  const canAddMore = iceBreakers.length < MAX_ICE_BREAKERS;
  const prefilledLength = prefilledMessage.length;

  const handleAddIceBreaker = useCallback(() => {
    if (!canAddMore) return;
    
    const newIceBreaker: IceBreaker = {
      id: generateId(),
      title: '',
      payload: '',
    };
    
    onIceBreakersChange([...iceBreakers, newIceBreaker]);
  }, [iceBreakers, onIceBreakersChange, canAddMore]);

  const handleUpdateIceBreaker = useCallback((id: string, updates: Partial<IceBreaker>) => {
    onIceBreakersChange(
      iceBreakers.map((ib) => 
        ib.id === id ? { ...ib, ...updates } : ib
      )
    );
  }, [iceBreakers, onIceBreakersChange]);

  const handleRemoveIceBreaker = useCallback((id: string) => {
    onIceBreakersChange(iceBreakers.filter((ib) => ib.id !== id));
  }, [iceBreakers, onIceBreakersChange]);

  return (
    <div className={`space-y-6 ${className}`} role="region" aria-labelledby={`${componentId}-title`}>
      <div>
        <h3 id={`${componentId}-title`} className="text-lg font-medium">
          Conversation Starter
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Configure how customers can start a conversation from your ad
        </p>
      </div>
      
      {/* Message Type Information */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              type="button"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
              aria-label="Learn about message types"
            >
              <Info className="w-4 h-4" />
              Understanding message types and costs
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-md p-0 bg-transparent border-0">
            <MessageTypeInfo />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {/* Mode Selection */}
      <RadioGroup
        value={mode}
        onValueChange={(value) => onModeChange(value as MessageMode)}
        className="grid gap-4 sm:grid-cols-2"
        aria-label="Choose conversation starter type"
      >
        <Label
          htmlFor={`${componentId}-ice-breakers`}
          className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
            mode === 'ice_breakers' 
              ? 'border-primary bg-primary/5' 
              : 'border-muted hover:border-muted-foreground/30'
          }`}
        >
          <RadioGroupItem 
            value="ice_breakers" 
            id={`${componentId}-ice-breakers`}
            className="mt-1"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="font-medium">Ice Breakers</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Quick reply buttons that customers can tap to start a conversation. 
              Up to 4 buttons with customizable labels.
            </p>
          </div>
        </Label>
        
        <Label
          htmlFor={`${componentId}-prefilled`}
          className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
            mode === 'prefilled' 
              ? 'border-primary bg-primary/5' 
              : 'border-muted hover:border-muted-foreground/30'
          }`}
        >
          <RadioGroupItem 
            value="prefilled" 
            id={`${componentId}-prefilled`}
            className="mt-1"
          />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="font-medium">Pre-filled Message</span>
            </div>
            <p className="text-xs text-muted-foreground">
              A message that appears pre-filled in the chat input. 
              Customers can edit or send as-is.
            </p>
          </div>
        </Label>
      </RadioGroup>
      
      {/* Mutual Exclusivity Notice */}
      {mode === 'prefilled' && iceBreakers.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Note</AlertTitle>
          <AlertDescription>
            Ice Breakers will be disabled when using a Pre-filled Message. 
            You can only use one type at a time.
          </AlertDescription>
        </Alert>
      )}
      
      {mode === 'ice_breakers' && prefilledMessage.trim() && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Note</AlertTitle>
          <AlertDescription>
            Pre-filled Message will be disabled when using Ice Breakers. 
            You can only use one type at a time.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Ice Breakers Editor */}
      {mode === 'ice_breakers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base">Ice Breaker Buttons</Label>
            <span className="text-sm text-muted-foreground" aria-live="polite">
              {iceBreakers.length} / {MAX_ICE_BREAKERS}
            </span>
          </div>
          
          {iceBreakers.length === 0 && (
            <Alert variant="default">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Add at least one ice breaker button to help customers start a conversation.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-3" role="list" aria-label="Ice breaker buttons">
            {iceBreakers.map((iceBreaker, index) => (
              <div key={iceBreaker.id} role="listitem">
                <IceBreakerItem
                  iceBreaker={iceBreaker}
                  index={index}
                  onUpdate={handleUpdateIceBreaker}
                  onRemove={handleRemoveIceBreaker}
                />
              </div>
            ))}
          </div>
          
          <Button
            variant="outline"
            onClick={handleAddIceBreaker}
            disabled={!canAddMore}
            className="w-full"
            aria-describedby={!canAddMore ? `${componentId}-max-reached` : undefined}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Ice Breaker
          </Button>
          
          {!canAddMore && (
            <p 
              id={`${componentId}-max-reached`} 
              className="text-sm text-muted-foreground text-center"
            >
              Maximum of {MAX_ICE_BREAKERS} ice breakers reached
            </p>
          )}
        </div>
      )}
      
      {/* Pre-filled Message Editor */}
      {mode === 'prefilled' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`${componentId}-prefilled-message`} className="text-base">
                Pre-filled Message
              </Label>
              <span 
                className={`text-xs ${
                  prefilledLength > MAX_PREFILLED_LENGTH 
                    ? 'text-destructive font-medium' 
                    : 'text-muted-foreground'
                }`}
                aria-live="polite"
              >
                {prefilledLength}/{MAX_PREFILLED_LENGTH}
              </span>
            </div>
            
            <Textarea
              id={`${componentId}-prefilled-message`}
              value={prefilledMessage}
              onChange={(e) => onPrefilledMessageChange(e.target.value)}
              placeholder="e.g., Hi! I'm interested in learning more about your products."
              rows={4}
              maxLength={MAX_PREFILLED_LENGTH + 10}
              className={prefilledLength > MAX_PREFILLED_LENGTH ? 'border-destructive' : ''}
              aria-invalid={prefilledLength > MAX_PREFILLED_LENGTH}
              aria-describedby={`${componentId}-prefilled-help`}
            />
            
            <p id={`${componentId}-prefilled-help`} className="text-xs text-muted-foreground">
              This message will appear in the customer's WhatsApp chat input when they 
              click on your ad. They can edit it before sending.
            </p>
          </div>
          
          {/* Preview */}
          {prefilledMessage.trim() && (
            <Card className="bg-muted/50">
              <CardHeader className="pb-2">
                <CardDescription>Preview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-background rounded-lg p-3 border">
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm bg-green-100 dark:bg-green-900/30 rounded-lg p-2">
                        {prefilledMessage}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default IceBreakersEditor;
