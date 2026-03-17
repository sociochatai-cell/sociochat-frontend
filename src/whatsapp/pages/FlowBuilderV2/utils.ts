/**
 * FlowBuilderV2 Utilities
 * =======================
 * Helper functions for ID generation, transforms, validation
 */

import type { 
  Step, 
  Field, 
  FlowBuilderState, 
  MetaFlowJSON, 
  MetaScreen, 
  MetaComponent,
  ValidationHint,
  FieldType
} from './types';

// =============================================================================
// ID GENERATION
// =============================================================================

let idCounter = 0;

export const generateId = (): string => {
  idCounter++;
  return `${Date.now().toString(36)}_${idCounter.toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
};

export const generateScreenId = (title: string): string => {
  // Convert title to uppercase snake_case, max 20 chars
  return title
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 20) || `SCREEN_${generateId().slice(0, 8)}`;
};

// =============================================================================
// FIELD HELPERS
// =============================================================================

export const getFieldIcon = (type: FieldType): string => {
  const icons: Record<FieldType, string> = {
    text: '📝',
    email: '✉️',
    phone: '📱',
    number: '🔢',
    textarea: '📄',
    dropdown: '📋',
    radio: '🔘',
    checkbox: '☑️',
    date: '📅'
  };
  return icons[type] || '📝';
};

export const getFieldLabel = (type: FieldType): string => {
  const labels: Record<FieldType, string> = {
    text: 'Text',
    email: 'Email',
    phone: 'Phone',
    number: 'Number',
    textarea: 'Long Text',
    dropdown: 'Dropdown',
    radio: 'Single Choice',
    checkbox: 'Multiple Choice',
    date: 'Date'
  };
  return labels[type] || 'Text';
};

export const createDefaultField = (type: FieldType): Field => {
  const baseField: Field = {
    id: generateId(),
    type,
    label: getFieldLabel(type),
    required: false
  };

  // Add default options for selection types
  if (type === 'dropdown' || type === 'radio' || type === 'checkbox') {
    baseField.options = ['Option 1', 'Option 2', 'Option 3'];
  }

  return baseField;
};

// =============================================================================
// STEP HELPERS
// =============================================================================

export const createDefaultStep = (isFirst: boolean = false, isFinal: boolean = false): Step => {
  return {
    id: generateId(),
    title: isFinal ? 'Thank You' : (isFirst ? 'Welcome' : 'New Step'),
    message: isFinal ? 'Thank you for your submission!' : '',
    fields: [],
    button: {
      label: isFinal ? 'Done' : 'Continue →',
      goesToStepId: null
    },
    isFinal
  };
};

// =============================================================================
// VISUAL → META JSON TRANSFORM
// =============================================================================

export const visualToMetaJSON = (state: FlowBuilderState): MetaFlowJSON => {
  const screens: MetaScreen[] = state.steps.map((step, index) => {
    const children: MetaComponent[] = [];

    // Add title as TextHeading
    children.push({
      type: 'TextHeading',
      text: step.title
    });

    // Add message as TextBody (if exists)
    if (step.message && step.message.trim()) {
      children.push({
        type: 'TextBody',
        text: step.message
      });
    }

    // Convert fields to Meta components
    step.fields.forEach(field => {
      children.push(fieldToMetaComponent(field));
    });

    // Add Footer (button) for non-terminal screens
    if (!step.isFinal) {
      const nextStep = step.button.goesToStepId 
        ? state.steps.find(s => s.id === step.button.goesToStepId)
        : state.steps[index + 1];

      children.push({
        type: 'Footer',
        label: step.button.label || 'Continue',
        'on-click-action': {
          name: 'navigate',
          next: {
            type: 'screen',
            name: nextStep?.id || state.steps[index + 1]?.id || 'COMPLETE'
          }
        }
      });
    }

    return {
      id: step.id,
      title: step.title,
      terminal: step.isFinal,
      ...(step.isFinal && { success: true }),
      layout: {
        type: 'SingleColumnLayout',
        children
      }
    };
  });

  // Auto-generate routing model
  const routing_model: Record<string, string[]> = {};
  state.steps.forEach((step, index) => {
    if (step.isFinal) {
      routing_model[step.id] = [];
    } else {
      const nextId = step.button.goesToStepId || state.steps[index + 1]?.id;
      routing_model[step.id] = nextId ? [nextId] : [];
    }
  });

  return {
    version: '5.0',
    data_api_version: '3.0',
    screens,
    routing_model
  };
};

const fieldToMetaComponent = (field: Field): MetaComponent => {
  const baseProps = {
    name: field.id,
    label: field.label,
    required: field.required
  };

  switch (field.type) {
    case 'text':
      return { type: 'TextInput', ...baseProps, 'input-type': 'text' };
    case 'email':
      return { type: 'TextInput', ...baseProps, 'input-type': 'email' };
    case 'phone':
      return { type: 'TextInput', ...baseProps, 'input-type': 'phone' };
    case 'number':
      return { type: 'TextInput', ...baseProps, 'input-type': 'number' };
    case 'textarea':
      return { type: 'TextArea', ...baseProps };
    case 'dropdown':
      return {
        type: 'Dropdown',
        ...baseProps,
        'data-source': field.options?.map((opt, i) => ({ id: `opt_${i}`, title: opt })) || []
      };
    case 'radio':
      return {
        type: 'RadioButtonsGroup',
        ...baseProps,
        'data-source': field.options?.map((opt, i) => ({ id: `opt_${i}`, title: opt })) || []
      };
    case 'checkbox':
      return {
        type: 'CheckboxGroup',
        ...baseProps,
        'data-source': field.options?.map((opt, i) => ({ id: `opt_${i}`, title: opt })) || []
      };
    case 'date':
      return { type: 'DatePicker', ...baseProps };
    default:
      return { type: 'TextInput', ...baseProps, 'input-type': 'text' };
  }
};

// =============================================================================
// META JSON → VISUAL TRANSFORM
// =============================================================================

export const metaJSONToVisual = (
  json: MetaFlowJSON, 
  flowMeta: { id: number; name: string; category: string; status: string; meta_flow_id?: string; account_id?: number }
): FlowBuilderState => {
  const steps: Step[] = json.screens.map(screen => {
    const fields: Field[] = [];
    let message: string | undefined;
    let buttonLabel = 'Continue';
    let goesToStepId: string | null = null;

    screen.layout.children.forEach(component => {
      if (component.type === 'TextBody') {
        message = component.text;
      } else if (component.type === 'Footer') {
        buttonLabel = component.label || 'Continue';
        goesToStepId = component['on-click-action']?.next?.name || null;
      } else if (isFieldComponent(component.type)) {
        fields.push(metaComponentToField(component));
      }
      // Skip TextHeading (used as title)
    });

    return {
      id: screen.id,
      title: screen.title,
      message,
      fields,
      button: {
        label: buttonLabel,
        goesToStepId
      },
      isFinal: screen.terminal || false
    };
  });

  return {
    id: flowMeta.id,
    name: flowMeta.name,
    category: (flowMeta.category?.toLowerCase() || 'custom') as any,
    steps,
    selectedStepId: null,
    isDirty: false,
    status: flowMeta.status as any,
    metaFlowId: flowMeta.meta_flow_id,
    accountId: flowMeta.account_id
  };
};

const isFieldComponent = (type: string): boolean => {
  return ['TextInput', 'TextArea', 'Dropdown', 'RadioButtonsGroup', 'CheckboxGroup', 'DatePicker'].includes(type);
};

const metaComponentToField = (component: MetaComponent): Field => {
  const baseField: Field = {
    id: component.name || generateId(),
    type: 'text',
    label: component.label || '',
    required: component.required || false
  };

  switch (component.type) {
    case 'TextInput':
      baseField.type = (component['input-type'] as FieldType) || 'text';
      break;
    case 'TextArea':
      baseField.type = 'textarea';
      break;
    case 'Dropdown':
      baseField.type = 'dropdown';
      baseField.options = component['data-source']?.map(ds => ds.title) || [];
      break;
    case 'RadioButtonsGroup':
      baseField.type = 'radio';
      baseField.options = component['data-source']?.map(ds => ds.title) || [];
      break;
    case 'CheckboxGroup':
      baseField.type = 'checkbox';
      baseField.options = component['data-source']?.map(ds => ds.title) || [];
      break;
    case 'DatePicker':
      baseField.type = 'date';
      break;
  }

  return baseField;
};

// =============================================================================
// VALIDATION
// =============================================================================

const BANNED_KEYWORDS = [
  'password', 'login', 'sign in', 'signin', 'credit card', 
  'debit card', 'cvv', 'ssn', 'social security', 'bank account'
];

export const validateFlow = (state: FlowBuilderState): ValidationHint[] => {
  const hints: ValidationHint[] = [];

  // Check: Has at least 2 steps
  if (state.steps.length < 2) {
    hints.push({
      type: 'error',
      message: 'Flow needs at least 2 steps (start and finish)',
      autoFixable: true,
      fixAction: 'add_final_step'
    });
  }

  // Check: Has a final step
  const hasFinalStep = state.steps.some(s => s.isFinal);
  if (!hasFinalStep && state.steps.length > 0) {
    hints.push({
      type: 'error',
      message: 'Flow needs a final step to complete',
      autoFixable: true,
      fixAction: 'mark_last_final'
    });
  }

  // Check: Max 10 steps
  if (state.steps.length > 10) {
    hints.push({
      type: 'error',
      message: 'Maximum 10 steps allowed per flow',
      autoFixable: false
    });
  }

  // Check each step
  state.steps.forEach((step, index) => {
    // Non-final steps need fields or meaningful content
    if (!step.isFinal && step.fields.length === 0 && !step.message) {
      hints.push({
        type: 'warning',
        stepId: step.id,
        message: `Step "${step.title}" has no fields or message`,
        autoFixable: false
      });
    }

    // Check for banned keywords
    const stepText = `${step.title} ${step.message || ''} ${step.fields.map(f => f.label).join(' ')}`.toLowerCase();
    BANNED_KEYWORDS.forEach(keyword => {
      if (stepText.includes(keyword)) {
        hints.push({
          type: 'error',
          stepId: step.id,
          message: `Cannot use "${keyword}" - restricted by WhatsApp`,
          autoFixable: false
        });
      }
    });

    // Check field labels
    step.fields.forEach(field => {
      if (!field.label.trim()) {
        hints.push({
          type: 'error',
          stepId: step.id,
          fieldId: field.id,
          message: 'Field needs a label',
          autoFixable: true,
          fixAction: 'default_label'
        });
      }
    });
  });

  // Check flow name
  if (!state.name.trim()) {
    hints.push({
      type: 'error',
      message: 'Flow needs a name',
      autoFixable: false
    });
  }

  return hints;
};

export const hasErrors = (hints: ValidationHint[]): boolean => {
  return hints.some(h => h.type === 'error');
};

export const autoFixIssues = (state: FlowBuilderState): FlowBuilderState => {
  let newState = { ...state, steps: [...state.steps] };

  // Fix: Add final step if missing
  const hasFinal = newState.steps.some(s => s.isFinal);
  if (!hasFinal && newState.steps.length > 0) {
    newState.steps[newState.steps.length - 1] = {
      ...newState.steps[newState.steps.length - 1],
      isFinal: true
    };
  }

  // Fix: Ensure at least 2 steps
  if (newState.steps.length < 2) {
    newState.steps.push(createDefaultStep(false, true));
  }

  // Fix: Empty labels
  newState.steps = newState.steps.map(step => ({
    ...step,
    fields: step.fields.map(field => ({
      ...field,
      label: field.label.trim() || getFieldLabel(field.type)
    }))
  }));

  return newState;
};
