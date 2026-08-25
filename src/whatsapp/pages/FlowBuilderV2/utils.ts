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

const alphaSuffix = (index: number): string => {
  let suffix = '';
  let n = Math.max(0, Math.floor(index));
  while (true) {
    const remainder = n % 26;
    suffix = String.fromCharCode(65 + remainder) + suffix;
    n = Math.floor(n / 26);
    if (n === 0) break;
    n -= 1;
  }
  return suffix;
};

const toMetaSafeScreenId = (source: string, fallbackLabel: string): string => {
  const candidate = (source || fallbackLabel || '')
    .toUpperCase()
    .replace(/[^A-Z_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const base = candidate || 'SCREEN';
  return base === 'SUCCESS' ? 'SCREEN_SUCCESS' : base;
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
    date: '📅',
    time: '🕐'
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
    date: 'Date',
    time: 'Time Slot'
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

  // Time slots are NOT hardcoded — they are loaded from the workspace's configured
  // Bookings availability (business hours) automatically in the builder (see StepCard
  // auto-load). Left empty so a stale full-day list can never be shipped to customers.
  if (type === 'time') {
    baseField.options = [];
    baseField.label = 'Preferred Time Slot';
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
// FIELD NAME SANITIZATION (Meta requires letters + underscores only)
// =============================================================================

/**
 * Convert a visual-builder field ID into a Meta-safe component `name`.
 * Meta Flow JSON component names must:
 *   - Start with a letter or underscore
 *   - Contain only letters (a-z, A-Z), digits removed, underscores
 *   - Not be empty
 */
const toMetaSafeFieldName = (fieldId: string, fieldLabel: string, index: number): string => {
  // Try deriving from the label first (more readable)
  const fromLabel = (fieldLabel || '')
    .toLowerCase()
    .replace(/[^a-z_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (fromLabel && /^[a-z_]/.test(fromLabel)) {
    return fromLabel;
  }

  // Fallback: sanitize the ID by stripping numbers and special chars
  const fromId = (fieldId || '')
    .toLowerCase()
    .replace(/[^a-z_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (fromId && /^[a-z_]/.test(fromId)) {
    return fromId;
  }

  // Ultimate fallback: positional name
  return `field_${String.fromCharCode(97 + (index % 26))}`;
};

// =============================================================================
// VISUAL → META JSON TRANSFORM
// =============================================================================

/**
 * Map field types to Meta Flow JSON data schema types.
 * Meta-confirmed behavior:
 *   TextInput(text/email/phone) → string
 *   TextInput(number)           → number  (Meta validates this!)
 *   TextArea                    → string
 *   Dropdown / RadioButtonsGroup→ string  (selected option ID)
 *   CheckboxGroup               → array   (selected option IDs)
 *   DatePicker                  → string  (YYYY-MM-DD)
 */
const getMetaDataType = (field: Field): string => {
  if (field.type === 'number') return 'number';
  if (field.type === 'checkbox') return 'array';
  return 'string';
};

const buildDataSchema = (fields: Field[], fieldNameMap: Map<string, string>): MetaScreen['data'] => {
  const schema: MetaScreen['data'] = {};
  fields.forEach(field => {
    if (!field.id) return;
    const metaName = fieldNameMap.get(field.id) || field.id;
    const dataType = getMetaDataType(field);

    if (dataType === 'array') {
      schema[metaName] = {
        type: 'array',
        items: { type: 'string' },
        __example__: [] as any
      };
    } else if (dataType === 'number') {
      schema[metaName] = {
        type: 'number',
        __example__: 0 as any
      };
    } else {
      schema[metaName] = {
        type: 'string',
        __example__: field.label || metaName
      };
    }
  });
  return schema;
};

const buildActionPayload = (
  priorFields: Field[],
  currentFields: Field[],
  fieldNameMap: Map<string, string>
): Record<string, string> => {
  const payload: Record<string, string> = {};

  priorFields.forEach(field => {
    if (!field.id) return;
    const metaName = fieldNameMap.get(field.id) || field.id;
    payload[metaName] = '${data.' + metaName + '}';
  });

  currentFields.forEach(field => {
    if (!field.id) return;
    const metaName = fieldNameMap.get(field.id) || field.id;
    payload[metaName] = '${form.' + metaName + '}';
  });

  return payload;
};

export const visualToMetaJSON = (state: FlowBuilderState): MetaFlowJSON => {
  // Map visual step IDs to Meta-safe screen IDs so Meta validation always passes.
  const stepIdToScreenId: Record<string, string> = {};
  const usedScreenIds = new Set<string>();
  const baseCounts: Record<string, number> = {};

  state.steps.forEach((step, index) => {
    const base = toMetaSafeScreenId(step.id, step.title || `STEP_${index + 1}`);
    let next = base;
    let attempt = baseCounts[base] ?? 0;
    while (usedScreenIds.has(next)) {
      next = `${base}_${alphaSuffix(attempt)}`;
      attempt += 1;
    }
    baseCounts[base] = attempt;
    usedScreenIds.add(next);
    stepIdToScreenId[step.id] = next;
  });

  // Build a global map from visual field ID → Meta-safe field name
  const fieldNameMap = new Map<string, string>();
  const usedFieldNames = new Set<string>();
  let fieldCounter = 0;

  state.steps.forEach(step => {
    step.fields.forEach(field => {
      if (!field.id || fieldNameMap.has(field.id)) return;
      let metaName = toMetaSafeFieldName(field.id, field.label, fieldCounter);
      // Ensure uniqueness
      while (usedFieldNames.has(metaName)) {
        fieldCounter++;
        metaName = toMetaSafeFieldName(field.id, field.label, fieldCounter) + '_' + String.fromCharCode(97 + (fieldCounter % 26));
      }
      usedFieldNames.add(metaName);
      fieldNameMap.set(field.id, metaName);
      fieldCounter++;
    });
  });

  const fieldsBeforeStep: Field[][] = [];
  const seenFields: Field[] = [];

  state.steps.forEach(step => {
    fieldsBeforeStep.push([...seenFields]);
    step.fields.forEach(field => {
      if (field.id && !seenFields.some(existing => existing.id === field.id)) {
        seenFields.push(field);
      }
    });
  });

  const screens: MetaScreen[] = state.steps.map((step, index) => {
    const children: MetaComponent[] = [];
    const priorFields = fieldsBeforeStep[index] || [];

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

    // Convert fields to Meta components (with sanitized names)
    step.fields.forEach(field => {
      children.push(fieldToMetaComponent(field, fieldNameMap));
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
            name: (nextStep?.id && stepIdToScreenId[nextStep.id])
              || (state.steps[index + 1]?.id && stepIdToScreenId[state.steps[index + 1].id])
              || 'COMPLETE'
          },
          payload: buildActionPayload(priorFields, step.fields, fieldNameMap)
        }
      });
    } else {
      children.push({
        type: 'Footer',
        label: step.button.label || 'Done',
        'on-click-action': {
          name: 'complete',
          payload: buildActionPayload(priorFields, step.fields, fieldNameMap)
        }
      });
    }

    const data = buildDataSchema(priorFields, fieldNameMap);

    return {
      id: stepIdToScreenId[step.id] || 'SCREEN',
      title: step.title,
      ...(step.isFinal && { terminal: true }),
      ...(step.isFinal && { success: true }),
      ...(Object.keys(data).length > 0 && { data }),
      layout: {
        type: 'SingleColumnLayout',
        children
      }
    };
  });

  // Auto-generate routing model
  const routing_model: Record<string, string[]> = {};
  state.steps.forEach((step, index) => {
    const currentScreenId = stepIdToScreenId[step.id] || toMetaSafeScreenId(step.id, step.title || `STEP_${index + 1}`);
    if (step.isFinal) {
      routing_model[currentScreenId] = [];
    } else {
      const nextId = step.button.goesToStepId || state.steps[index + 1]?.id;
      routing_model[currentScreenId] = nextId && stepIdToScreenId[nextId] ? [stepIdToScreenId[nextId]] : [];
    }
  });

  // Static flows: do NOT include data_api_version (triggers endpoint requirement)
  return {
    version: '7.3',
    screens,
    routing_model
  };
};

const fieldToMetaComponent = (field: Field, fieldNameMap: Map<string, string>): MetaComponent => {
  const metaName = fieldNameMap.get(field.id) || field.id;
  const baseProps = {
    name: metaName,
    label: field.label,
    required: field.required
  };

  // Helper: generate data-source IDs that are Meta-safe (letters + underscores only)
  const safeDataSource = (options: string[] | undefined) =>
    (options || []).map((opt, i) => ({
      id: `opt_${String.fromCharCode(97 + (i % 26))}${i >= 26 ? String.fromCharCode(97 + Math.floor(i / 26)) : ''}`,
      title: opt
    }));

  // Time fields: WhatsApp Flows has no native time picker, so a time field becomes a
  // Dropdown of clock slots. Crucially the option id is "HH:MM" (24h) — NOT "opt_a" —
  // so the submission returns a real time the backend can turn into a booking + reminder.
  const generateTimeSlots = (
    startHour = 9,
    endHour = 17,
    stepMinutes = 30
  ): Array<{ id: string; title: string }> => {
    const slots: Array<{ id: string; title: string }> = [];
    for (let mins = startHour * 60; mins <= endHour * 60; mins += stepMinutes) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const id = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const period = h < 12 ? 'AM' : 'PM';
      const h12 = h % 12 === 0 ? 12 : h % 12;
      slots.push({ id, title: `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}` });
    }
    return slots;
  };

  // Map user-provided time strings to a data-source, keeping a 24h "HH:MM" id when the
  // option looks like a clock time (AM/PM aware, e.g. "1:00 PM" -> "13:00"); otherwise
  // fall back to an index id.
  const timeOptionsToDataSource = (options: string[]): Array<{ id: string; title: string }> =>
    (options || []).map((opt, i) => {
      const m = String(opt).match(/\b(\d{1,2}):([0-5]\d)\s*([AaPp][Mm])?\b/);
      if (m) {
        let h = parseInt(m[1], 10);
        const ap = (m[3] || '').toLowerCase();
        if (ap === 'pm' && h < 12) h += 12;
        if (ap === 'am' && h === 12) h = 0;
        return { id: `${String(h).padStart(2, '0')}:${m[2]}`, title: opt };
      }
      return { id: `opt_${i}`, title: opt };
    });

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
        'data-source': safeDataSource(field.options)
      };
    case 'radio':
      return {
        type: 'RadioButtonsGroup',
        ...baseProps,
        'data-source': safeDataSource(field.options)
      };
    case 'checkbox':
      return {
        type: 'CheckboxGroup',
        ...baseProps,
        'data-source': safeDataSource(field.options)
      };
    case 'date':
      return { type: 'DatePicker', ...baseProps };
    case 'time':
      // Time slots rendered as Dropdown (Meta has no native TimePicker). Use HH:MM
      // option ids so the submission carries a real time (→ booking + reminder),
      // not a generic "opt_a".
      return {
        type: 'Dropdown',
        ...baseProps,
        'data-source': field.options && field.options.length
          ? timeOptionsToDataSource(field.options)
          : generateTimeSlots()
      };
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
