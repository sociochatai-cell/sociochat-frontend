/**
 * LivePreview Component
 * =====================
 * Real-time WhatsApp mockup showing exactly what users will see.
 * Updates instantly as user edits the flow.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  RotateCcw, 
  ChevronLeft,
  Wifi,
  Battery,
  Signal
} from 'lucide-react';
import type { Step, Field, PreviewState } from './types';
import { cn } from '@/lib/utils';

interface LivePreviewProps {
  steps: Step[];
  businessName?: string;
  className?: string;
  onClose?: () => void;
  isCollapsible?: boolean;
}

export function LivePreview({ 
  steps, 
  businessName = 'Your Business',
  className,
  onClose,
  isCollapsible = false
}: LivePreviewProps) {
  const [previewState, setPreviewState] = useState<PreviewState>({
    currentStepIndex: 0,
    formData: {}
  });

  const currentStep = steps[previewState.currentStepIndex];
  const canGoBack = previewState.currentStepIndex > 0;
  const totalSteps = steps.length;

  const handleNext = () => {
    if (!currentStep) return;
    
    // Find next step
    let nextIndex = previewState.currentStepIndex + 1;
    
    // If explicit goesToStepId, find that step
    if (currentStep.button.goesToStepId) {
      const targetIdx = steps.findIndex(s => s.id === currentStep.button.goesToStepId);
      if (targetIdx !== -1) nextIndex = targetIdx;
    }

    if (nextIndex < steps.length) {
      setPreviewState(prev => ({
        ...prev,
        currentStepIndex: nextIndex
      }));
    }
  };

  const handleBack = () => {
    if (canGoBack) {
      setPreviewState(prev => ({
        ...prev,
        currentStepIndex: prev.currentStepIndex - 1
      }));
    }
  };

  const handleRestart = () => {
    setPreviewState({
      currentStepIndex: 0,
      formData: {}
    });
  };

  const updateFormData = (fieldId: string, value: string) => {
    setPreviewState(prev => ({
      ...prev,
      formData: { ...prev.formData, [fieldId]: value }
    }));
  };

  if (!currentStep) {
    return (
      <div className={cn("flex items-center justify-center p-4", className)}>
        <p className="text-gray-400 text-sm">Add steps to preview</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col bg-gray-100", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 bg-white border-b">
        <span className="text-xs font-medium text-gray-600">Preview</span>
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-xs"
            onClick={handleRestart}
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Restart
          </Button>
        </div>
      </div>

      {/* Phone Frame */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="w-[280px] h-[500px] bg-white rounded-[32px] shadow-xl border-4 border-gray-800 overflow-hidden flex flex-col">
          
          {/* Phone Status Bar */}
          <div className="h-6 bg-gray-800 flex items-center justify-between px-4">
            <span className="text-white text-[10px]">9:41</span>
            <div className="flex items-center gap-1">
              <Signal className="w-3 h-3 text-white" />
              <Wifi className="w-3 h-3 text-white" />
              <Battery className="w-3 h-3 text-white" />
            </div>
          </div>

          {/* WhatsApp Header */}
          <div className="h-14 bg-[#075E54] flex items-center px-3 gap-3">
            {canGoBack && (
              <button 
                onClick={handleBack}
                className="text-white"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-xs font-bold text-gray-600">
                {businessName.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">{businessName}</p>
              <p className="text-green-200 text-[10px]">Flow</p>
            </div>
          </div>

          {/* Chat Background */}
          <div 
            className="flex-1 overflow-y-auto p-3"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5ddd5' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              backgroundColor: '#ECE5DD'
            }}
          >
            {/* Flow Card */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden max-w-[240px]">
              {/* Step Header */}
              <div className="bg-[#25D366] px-3 py-2">
                <h3 className="text-white font-medium text-sm">
                  {currentStep.title}
                </h3>
              </div>

              {/* Step Content */}
              <div className="p-3 space-y-3">
                {/* Message */}
                {currentStep.message && (
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {currentStep.message}
                  </p>
                )}

                {/* Fields */}
                {currentStep.fields.map(field => (
                  <PreviewField
                    key={field.id}
                    field={field}
                    value={previewState.formData[field.id] || ''}
                    onChange={(val) => updateFormData(field.id, val)}
                  />
                ))}

                {/* Action Button */}
                {!currentStep.isFinal && (
                  <button
                    onClick={handleNext}
                    className="w-full bg-[#25D366] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#128C7E] transition-colors"
                  >
                    {currentStep.button.label}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="h-10 bg-white border-t flex items-center justify-center gap-1">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  idx === previewState.currentStepIndex
                    ? "bg-[#25D366]"
                    : idx < previewState.currentStepIndex
                    ? "bg-[#25D366]/50"
                    : "bg-gray-300"
                )}
              />
            ))}
            <span className="ml-2 text-[10px] text-gray-500">
              Step {previewState.currentStepIndex + 1} of {totalSteps}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Preview Field Component
// =============================================================================

interface PreviewFieldProps {
  field: Field;
  value: string;
  onChange: (value: string) => void;
}

function PreviewField({ field, value, onChange }: PreviewFieldProps) {
  const baseInputClass = "w-full text-sm border-gray-200 focus:border-[#25D366] focus:ring-[#25D366]";

  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-600 flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
      </label>

      {field.type === 'text' && (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
          className={cn(baseInputClass, "h-8")}
        />
      )}

      {field.type === 'email' && (
        <Input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "email@example.com"}
          className={cn(baseInputClass, "h-8")}
        />
      )}

      {field.type === 'phone' && (
        <Input
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "+1 (000) 000-0000"}
          className={cn(baseInputClass, "h-8")}
        />
      )}

      {field.type === 'number' && (
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "0"}
          className={cn(baseInputClass, "h-8")}
        />
      )}

      {field.type === 'textarea' && (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "Type your message..."}
          className={cn(baseInputClass, "min-h-[60px] resize-none")}
        />
      )}

      {field.type === 'dropdown' && (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={cn(baseInputClass, "h-8")}>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt, idx) => (
              <SelectItem key={idx} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.type === 'radio' && (
        <div className="space-y-1">
          {field.options?.map((opt, idx) => (
            <label 
              key={idx}
              className={cn(
                "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                value === opt 
                  ? "border-[#25D366] bg-green-50" 
                  : "border-gray-200 hover:border-gray-300"
              )}
            >
              <input
                type="radio"
                name={field.id}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="text-[#25D366]"
              />
              <span className="text-xs">{opt}</span>
            </label>
          ))}
        </div>
      )}

      {field.type === 'checkbox' && (
        <div className="space-y-1">
          {field.options?.map((opt, idx) => {
            const isChecked = value.split(',').includes(opt);
            return (
              <label 
                key={idx}
                className={cn(
                  "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                  isChecked
                    ? "border-[#25D366] bg-green-50" 
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <input
                  type="checkbox"
                  value={opt}
                  checked={isChecked}
                  onChange={(e) => {
                    const current = value ? value.split(',').filter(Boolean) : [];
                    const updated = e.target.checked
                      ? [...current, opt]
                      : current.filter(v => v !== opt);
                    onChange(updated.join(','));
                  }}
                  className="text-[#25D366]"
                />
                <span className="text-xs">{opt}</span>
              </label>
            );
          })}
        </div>
      )}

      {field.type === 'date' && (
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(baseInputClass, "h-8")}
        />
      )}
    </div>
  );
}

export default LivePreview;
