/**
 * TemplateSelector Component
 * ==========================
 * First screen users see - pick a template to start.
 * Beautiful cards, instant flow creation.
 */

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { FLOW_TEMPLATES } from './templates';
import type { FlowTemplate } from './types';
import { cn } from '@/lib/utils';

interface TemplateSelectorProps {
  onSelectTemplate: (templateId: string) => void;
  onBack: () => void;
}

export function TemplateSelector({ onSelectTemplate, onBack }: TemplateSelectorProps) {
  // Separate custom from preset templates
  const presetTemplates = FLOW_TEMPLATES.filter(t => t.id !== 'custom');
  const customTemplate = FLOW_TEMPLATES.find(t => t.id === 'custom');

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <div className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-semibold">Create New Flow</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Heading */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            What would you like to collect?
          </h2>
          <p className="text-gray-500">
            Choose a template to get started in seconds
          </p>
        </div>

        {/* Template Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {presetTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onSelect={() => onSelectTemplate(template.id)}
            />
          ))}
        </div>

        {/* Custom Option */}
        {customTemplate && (
          <div className="border-t pt-6">
            <button
              onClick={() => onSelectTemplate('custom')}
              className={cn(
                "w-full p-4 rounded-xl border-2 border-dashed",
                "flex items-center justify-center gap-3",
                "text-gray-500 hover:text-gray-700",
                "hover:border-gray-300 hover:bg-gray-50",
                "transition-all duration-200"
              )}
            >
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">Start from scratch</span>
            </button>
          </div>
        )}

        {/* Tips */}
        <div className="mt-8 p-4 bg-blue-50 rounded-xl">
          <h4 className="font-medium text-blue-900 mb-2">💡 Pro tips</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Templates are fully customizable - change anything!</li>
            <li>• Keep flows short (3-5 steps) for best completion rates</li>
            <li>• You can always add or remove steps later</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Template Card
// =============================================================================

interface TemplateCardProps {
  template: FlowTemplate;
  onSelect: () => void;
}

function TemplateCard({ template, onSelect }: TemplateCardProps) {
  const stepCount = template.steps.length;
  const fieldCount = template.steps.reduce((acc, s) => acc + s.fields.length, 0);

  return (
    <Card
      className={cn(
        "p-4 cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-1 hover:border-green-300",
        "active:translate-y-0 active:shadow-md"
      )}
      onClick={onSelect}
    >
      {/* Icon */}
      <div className="text-3xl mb-3">{template.icon}</div>

      {/* Name */}
      <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>

      {/* Description */}
      <p className="text-xs text-gray-500 mb-3 line-clamp-2">
        {template.description}
      </p>

      {/* Stats */}
      <div className="flex items-center gap-2 text-[10px] text-gray-400">
        <span>{stepCount} steps</span>
        <span>•</span>
        <span>{fieldCount} fields</span>
      </div>
    </Card>
  );
}

export default TemplateSelector;
