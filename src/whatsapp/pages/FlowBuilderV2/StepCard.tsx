/**
 * StepCard Component
 * ==================
 * A visual card representing one step in the flow.
 * Inline editing, field management, no modals.
 */

import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  GripVertical, 
  MoreVertical, 
  Plus, 
  Trash2, 
  Copy,
  ChevronDown,
  ChevronUp,
  CheckCircle2
} from 'lucide-react';
import type { Step, Field, FieldType } from './types';
import { getFieldIcon, getFieldLabel, createDefaultField, generateId } from './utils';
import { cn } from '@/lib/utils';

interface StepCardProps {
  step: Step;
  isSelected: boolean;
  isFirst: boolean;
  allSteps: Step[];
  onSelect: () => void;
  onUpdate: (step: Step) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddField: (field: Field) => void;
  showConnector?: boolean;
}

export function StepCard({
  step,
  isSelected,
  isFirst,
  allSteps,
  onSelect,
  onUpdate,
  onDelete,
  onDuplicate,
  onAddField,
  showConnector = true
}: StepCardProps) {
  const [isExpanded, setIsExpanded] = useState(isSelected);
  const cardRef = useRef<HTMLDivElement>(null);

  // Auto-expand when selected
  useEffect(() => {
    if (isSelected) setIsExpanded(true);
  }, [isSelected]);

  const updateField = (fieldId: string, updates: Partial<Field>) => {
    onUpdate({
      ...step,
      fields: step.fields.map(f => 
        f.id === fieldId ? { ...f, ...updates } : f
      )
    });
  };

  const removeField = (fieldId: string) => {
    onUpdate({
      ...step,
      fields: step.fields.filter(f => f.id !== fieldId)
    });
  };

  const addFieldOfType = (type: FieldType) => {
    const newField = createDefaultField(type);
    onAddField(newField);
  };

  const moveField = (fieldId: string, direction: 'up' | 'down') => {
    const idx = step.fields.findIndex(f => f.id === fieldId);
    if (idx === -1) return;
    
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= step.fields.length) return;

    const newFields = [...step.fields];
    [newFields[idx], newFields[newIdx]] = [newFields[newIdx], newFields[idx]];
    onUpdate({ ...step, fields: newFields });
  };

  const updateOption = (fieldId: string, optIdx: number, value: string) => {
    const field = step.fields.find(f => f.id === fieldId);
    if (!field || !field.options) return;

    const newOptions = [...field.options];
    newOptions[optIdx] = value;
    updateField(fieldId, { options: newOptions });
  };

  const addOption = (fieldId: string) => {
    const field = step.fields.find(f => f.id === fieldId);
    if (!field) return;

    const newOptions = [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`];
    updateField(fieldId, { options: newOptions });
  };

  const removeOption = (fieldId: string, optIdx: number) => {
    const field = step.fields.find(f => f.id === fieldId);
    if (!field || !field.options) return;

    const newOptions = field.options.filter((_, i) => i !== optIdx);
    updateField(fieldId, { options: newOptions });
  };

  // Get next step options for "goes to" dropdown
  const nextStepOptions = allSteps
    .filter(s => s.id !== step.id && !s.isFinal)
    .concat(allSteps.filter(s => s.isFinal));

  return (
    <div className="relative" ref={cardRef}>
      {/* Connection line to next step */}
      {showConnector && !step.isFinal && (
        <div className="absolute left-1/2 -bottom-6 w-0.5 h-6 bg-gradient-to-b from-green-400 to-green-500 -translate-x-1/2" />
      )}
      
      {/* Arrow indicator */}
      {showConnector && !step.isFinal && (
        <div className="absolute left-1/2 -bottom-8 -translate-x-1/2">
          <div className="w-2 h-2 border-r-2 border-b-2 border-green-500 rotate-45" />
        </div>
      )}

      <Card 
        className={cn(
          "w-80 cursor-pointer transition-all duration-200",
          isSelected ? "ring-2 ring-green-500 shadow-lg" : "hover:shadow-md",
          step.isFinal && "border-green-500 bg-green-50/50"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between p-3 border-b bg-gray-50/50">
          <div className="flex items-center gap-2">
            {/* Drag handle - visible grab area */}
            <div 
              className="cursor-grab active:cursor-grabbing hover:bg-gray-200 p-1.5 rounded-md transition-colors group"
              title="Drag to reorder"
            >
              <GripVertical className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
            </div>

            {/* Step badge */}
            {isFirst && <Badge variant="secondary" className="text-xs">Start</Badge>}
            {step.isFinal && (
              <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Final
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Expand/collapse */}
            <Button 
              variant="ghost" 
              size="sm"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            {/* Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="w-4 h-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={onDelete}
                  className="text-red-600"
                  disabled={isFirst && allSteps.length === 1}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Title (always visible) */}
        <div className="p-3">
          <Input
            value={step.title}
            onChange={(e) => onUpdate({ ...step, title: e.target.value })}
            className="font-semibold text-base border-0 p-0 h-auto focus-visible:ring-0 bg-transparent"
            placeholder="Step title..."
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="px-3 pb-3 space-y-4">
            {/* Message */}
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Message</label>
              <Textarea
                value={step.message || ''}
                onChange={(e) => onUpdate({ ...step, message: e.target.value })}
                placeholder="Enter your message..."
                className="min-h-[60px] text-sm resize-none"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Fields */}
            {!step.isFinal && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-gray-500">Fields</label>
                  <span className="text-xs text-gray-400">{step.fields.length} field{step.fields.length !== 1 ? 's' : ''}</span>
                </div>

                <div className="space-y-2">
                  {step.fields.map((field, idx) => (
                    <FieldRow
                      key={field.id}
                      field={field}
                      onUpdate={(updates) => updateField(field.id, updates)}
                      onDelete={() => removeField(field.id)}
                      onMoveUp={idx > 0 ? () => moveField(field.id, 'up') : undefined}
                      onMoveDown={idx < step.fields.length - 1 ? () => moveField(field.id, 'down') : undefined}
                      onUpdateOption={(optIdx, value) => updateOption(field.id, optIdx, value)}
                      onAddOption={() => addOption(field.id)}
                      onRemoveOption={(optIdx) => removeOption(field.id, optIdx)}
                    />
                  ))}
                </div>

                {/* Add field dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-2 text-gray-500"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add field
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-48">
                    <DropdownMenuItem onClick={() => addFieldOfType('text')}>
                      📝 Text
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addFieldOfType('email')}>
                      ✉️ Email
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addFieldOfType('phone')}>
                      📱 Phone
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addFieldOfType('number')}>
                      🔢 Number
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => addFieldOfType('textarea')}>
                      📄 Long Text
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addFieldOfType('dropdown')}>
                      📋 Dropdown
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addFieldOfType('radio')}>
                      🔘 Single Choice
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => addFieldOfType('checkbox')}>
                      ☑️ Multiple Choice
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => addFieldOfType('date')}>
                      📅 Date
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Button config (non-final only) */}
            {!step.isFinal && (
              <div className="pt-2 border-t">
                <label className="text-xs text-gray-500 mb-2 block">Button</label>
                <div className="flex gap-2">
                  <Input
                    value={step.button.label}
                    onChange={(e) => onUpdate({ 
                      ...step, 
                      button: { ...step.button, label: e.target.value } 
                    })}
                    placeholder="Button text"
                    className="flex-1 text-sm"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="mt-2">
                  <label className="text-xs text-gray-400 mb-1 block">Goes to</label>
                  <Select
                    value={step.button.goesToStepId || 'auto'}
                    onValueChange={(val) => onUpdate({
                      ...step,
                      button: { ...step.button, goesToStepId: val === 'auto' ? null : val }
                    })}
                  >
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Auto (next step)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        <span className="text-gray-500">Auto (next step)</span>
                      </SelectItem>
                      {nextStepOptions.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title} {s.isFinal && '✓'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Final step toggle */}
            {!isFirst && (
              <div className="flex items-center justify-between pt-2 border-t">
                <label className="text-sm text-gray-600">This is the final step</label>
                <Switch
                  checked={step.isFinal}
                  onCheckedChange={(checked) => onUpdate({ ...step, isFinal: checked })}
                />
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// =============================================================================
// Field Row Component
// =============================================================================

interface FieldRowProps {
  field: Field;
  onUpdate: (updates: Partial<Field>) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onUpdateOption: (optIdx: number, value: string) => void;
  onAddOption: () => void;
  onRemoveOption: (optIdx: number) => void;
}

function FieldRow({ 
  field, 
  onUpdate, 
  onDelete,
  onMoveUp,
  onMoveDown,
  onUpdateOption,
  onAddOption,
  onRemoveOption
}: FieldRowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasOptions = ['dropdown', 'radio', 'checkbox'].includes(field.type);

  return (
    <div 
      className="border rounded-lg p-2 bg-white hover:border-gray-300 transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Field header */}
      <div className="flex items-center gap-2">
        <span className="text-sm">{getFieldIcon(field.type)}</span>
        <Input
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="flex-1 h-8 text-sm border-0 p-0 focus-visible:ring-0"
          placeholder="Field label..."
        />
        <div className="flex items-center gap-1">
          <button
            onClick={() => onUpdate({ required: !field.required })}
            className={cn(
              "text-xs px-1.5 py-0.5 rounded",
              field.required 
                ? "bg-red-100 text-red-700" 
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            )}
          >
            {field.required ? 'Required' : 'Optional'}
          </button>
          {hasOptions && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
            onClick={onDelete}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Options (for dropdown/radio/checkbox) */}
      {hasOptions && isExpanded && (
        <div className="mt-2 pl-6 space-y-1">
          {field.options?.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <span className="text-xs text-gray-400 w-4">{idx + 1}.</span>
              <Input
                value={opt}
                onChange={(e) => onUpdateOption(idx, e.target.value)}
                className="flex-1 h-7 text-xs"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                onClick={() => onRemoveOption(idx)}
                disabled={(field.options?.length || 0) <= 1}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-gray-500 h-7"
            onClick={onAddOption}
          >
            <Plus className="w-3 h-3 mr-1" />
            Add option
          </Button>
        </div>
      )}
    </div>
  );
}

export default StepCard;
