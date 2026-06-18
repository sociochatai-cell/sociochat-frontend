// Template Builder Utilities
// ==========================
// Types, validation, and Meta API payload generation

// ============================================================
// Types
// ============================================================

export type TemplateCategory = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
export type TemplateStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type HeaderType = 'none' | 'text' | 'image' | 'video' | 'document' | 'location';
export type ButtonType = 'quick_reply' | 'url' | 'phone' | 'flow' | 'copy_code' | 'voice_call' | 'catalog';

export interface TemplateButton {
    type: ButtonType;
    text: string;
    url?: string;
    phone?: string;
    flow_id?: string;      // Meta Flow ID for flow buttons
    flow_token?: string;   // Initial data token (optional)
    copy_code?: string;    // Example code for COPY_CODE buttons
}

export interface TemplateHeader {
    type: HeaderType;
    text?: string;
    imageUrl?: string;    // Preview URL for uploaded media (image/video/document)
    mediaHandle?: string; // Meta media_handle from Resumable Upload API (required for media formats)
}

export interface TemplateState {
    id?: number;
    name: string;
    category: TemplateCategory;
    language: string;
    status: TemplateStatus;
    rejectionReason?: string;
    header: TemplateHeader;
    body: string;
    footer: string;
    buttons: TemplateButton[];
}

export interface ValidationErrors {
    name?: string;
    header?: string;
    body?: string;
    footer?: string;
    buttons?: string;
    variables?: string;
    category?: string;
    general?: string;
    [key: string]: string | undefined;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationErrors;
    warnings: string[];
    tips: string[];
}

// Meta API component types
export interface MetaComponent {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS' | 'body';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';
    text?: string;
    example?: {
        body_text?: string[][];
        header_handle?: string[];
        header_text?: string[];
        header_text_named_params?: Array<{ param_name: string; example: string }>;
    };
    buttons?: Array<{
        type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'FLOW' | 'COPY_CODE' | 'VOICE_CALL' | 'CATALOG';
        text?: string;
        url?: string;
        phone_number?: string;
        flow_id?: string;
        flow_token?: string;
        example?: string;
    }>;
}

// ============================================================
// Default State
// ============================================================

export const defaultTemplateState: TemplateState = {
    name: '',
    category: 'UTILITY',
    language: 'en_US',
    status: 'DRAFT',
    header: { type: 'text' },
    body: '',
    footer: '',
    buttons: [],
};

// ============================================================
// Languages
// ============================================================

export const SUPPORTED_LANGUAGES = [
    { code: 'en_US', label: 'English (US)' },
    { code: 'en_GB', label: 'English (UK)' },
    { code: 'hi', label: 'Hindi' },
    { code: 'es', label: 'Spanish' },
    { code: 'pt_BR', label: 'Portuguese (BR)' },
    { code: 'ar', label: 'Arabic' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'it', label: 'Italian' },
    { code: 'id', label: 'Indonesian' },
];

export const CATEGORIES: { value: TemplateCategory; label: string }[] = [
    { value: 'UTILITY', label: 'Utility' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'AUTHENTICATION', label: 'Authentication' },
];

// ============================================================
// Variable Parsing
// ============================================================

/**
 * Extract variables from body text ({{1}}, {{name}}, etc.)
 * Returns array of variable names (as strings)
 */
export function parseVariables(text: string): string[] {
    // Match {{...}} but exclude {{1}} number-only if we want to allow mixing? 
    // Actually standard regex is enough, we just parse content inside braces.
    const regex = /\{\{([^}]+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
        const varName = match[1].trim();
        if (varName && !variables.includes(varName)) {
            variables.push(varName);
        }
    }

    return variables;
}

/**
 * Check if variables are sequential numeric (legacy) OR valid named params
 */
export function validateVariableSequence(variables: string[]): boolean {
    if (variables.length === 0) return true;

    // Check if ALL variables are numeric
    const allNumeric = variables.every(v => /^\d+$/.test(v));

    if (allNumeric) {
        // Legacy strict sequence check
        const nums = variables.map(v => parseInt(v, 10)).sort((a, b) => a - b);
        for (let i = 0; i < nums.length; i++) {
            if (nums[i] !== i + 1) {
                return false; // Gaps found in numeric sequence
            }
        }
        return true;
    }

    // If using named parameters, they MUST be lowercase alphanumeric + underscores
    // Meta rejection reason: "Parameters using the named format must be ... composed of lowercase characters and underscores"
    const isValidName = (name: string) => /^[a-z0-9_]+$/.test(name);
    return variables.every(isValidName);
}

// Helper to check if a variable list contains invalid named parameters
export function getInvalidNamedVariables(variables: string[]): string[] {
    // If mixed numeric/named, we treat as invalid sequence or invalid naming depending on context
    // If mostly numeric, it filters non-numeric. If mostly named, it filters uppercase.
    // For now, simple check:
    return variables.filter(v => !/^\d+$/.test(v) && !/^[a-z0-9_]+$/.test(v));
}

// ============================================================
// Validation
// ============================================================

/**
 * Validate template name (lowercase, numbers, underscores only)
 */
export function validateTemplateName(name: string): string | undefined {
    if (!name) {
        return 'Template name is required';
    }

    if (!/^[a-z0-9_]+$/.test(name)) {
        return 'Use lowercase letters, numbers, and underscores only';
    }

    if (name.length < 2) {
        return 'Template name must be at least 2 characters';
    }

    if (name.length > 512) {
        return 'Template name is too long (max 512 characters)';
    }

    return undefined;
}

// ============================================================
// Meta API Strict Validation Rules
// ============================================================

/**
 * Check for mixed variable formats (not allowed by Meta)
 */
function hasMixedVariableFormats(variables: string[]): boolean {
    if (variables.length === 0) return false;
    const hasPositional = variables.some(v => /^\d+$/.test(v));
    const hasNamed = variables.some(v => !/^\d+$/.test(v));
    return hasPositional && hasNamed;
}

/**
 * Check for duplicate variable names
 */
function getDuplicateVariables(text: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const seen = new Map<string, number>();
    let match;

    while ((match = regex.exec(text)) !== null) {
        const varName = match[1].trim();
        seen.set(varName, (seen.get(varName) || 0) + 1);
    }

    return Array.from(seen.entries())
        .filter(([_, count]) => count > 1)
        .map(([name]) => name);
}

/**
 * Check for promotional/marketing language in utility templates
 */
function hasMarketingLanguage(text: string): string[] {
    const marketingPatterns = [
        { pattern: /\b(sale|discount|offer|promo|deal|limited time|hurry|buy now|shop now|exclusive)\b/i, term: 'promotional terms' },
        { pattern: /\b(\d+%\s*(off|discount))/i, term: 'discount percentages' },
        { pattern: /!{2,}/g, term: 'excessive exclamation marks' },
        { pattern: /\b(free|bonus|gift|win|winner)\b/i, term: 'promotional incentives' },
        { pattern: /\b(don't miss|act now|last chance|ending soon)\b/i, term: 'urgency language' },
    ];

    const issues: string[] = [];
    for (const { pattern, term } of marketingPatterns) {
        if (pattern.test(text)) {
            issues.push(term);
        }
    }
    return issues;
}

/**
 * Validate full template state with strict Meta API rules
 */
export function validateTemplate(state: TemplateState): ValidationResult {
    const errors: ValidationErrors = {};
    const warnings: string[] = [];
    const tips: string[] = [];

    // ====== NAME VALIDATION ======
    const nameError = validateTemplateName(state.name);
    if (nameError) {
        errors.name = nameError;
    }

    // ====== HEADER VALIDATION ======
    if (state.header.type === 'text') {
        if (state.header.text) {
            if (state.header.text.length > 60) {
                errors.header = 'Header text exceeds 60 characters (Meta limit). Current: ' + state.header.text.length;
            }
            // Check for variables in header
            const headerVars = parseVariables(state.header.text);
            if (headerVars.length > 1) {
                errors.header = 'Header supports only 1 variable. Found: ' + headerVars.length;
            }
        }
    } else if (state.header.type === 'image' || state.header.type === 'video' || state.header.type === 'document') {
        if (!state.header.mediaHandle) {
            errors.header = `${state.header.type[0].toUpperCase() + state.header.type.slice(1)} header requires media upload. Use upload to generate a Meta media handle.`;
        }
    }

    // ====== BODY VALIDATION (CRITICAL) ======
    if (!state.body || state.body.trim().length === 0) {
        errors.body = 'Body text is required. This is the main content of your template.';
    } else if (state.body.length > 1024) {
        errors.body = `Body exceeds 1024 characters (Meta limit). Current: ${state.body.length}. Remove ${state.body.length - 1024} characters.`;
    } else {
        // Variable validation
        const variables = parseVariables(state.body);

        // Check for mixed formats (CRITICAL - Meta rejects this)
        if (hasMixedVariableFormats(variables)) {
            errors.variables = 'INVALID: Cannot mix positional ({{1}}) and named ({{name}}) variables. Use ONE format only.';
        }

        // Check for invalid named variables
        const invalidVars = getInvalidNamedVariables(variables);
        if (invalidVars.length > 0) {
            errors.variables = `Invalid variable names: ${invalidVars.map(v => '{{' + v + '}}').join(', ')}. Variables must use ONLY lowercase letters, numbers, and underscores. Examples: {{customer_name}}, {{order_id}}, {{amount1}}`;
        }

        // Check for duplicate variables
        const duplicates = getDuplicateVariables(state.body);
        if (duplicates.length > 0) {
            warnings.push(`Duplicate variables found: ${duplicates.map(v => '{{' + v + '}}').join(', ')}. Each variable should appear only once for clarity.`);
        }

        // Check positional variable sequence
        const positionalVars = variables.filter(v => /^\d+$/.test(v));
        if (positionalVars.length > 0) {
            const nums = positionalVars.map(v => parseInt(v, 10)).sort((a, b) => a - b);
            for (let i = 0; i < nums.length; i++) {
                if (nums[i] !== i + 1) {
                    errors.variables = `Positional variables must be sequential starting from {{1}}. Found gap at {{${i + 1}}}. Current: ${positionalVars.map(v => '{{' + v + '}}').join(', ')}`;
                    break;
                }
            }
        }

        // Validate named variable format strictly
        const namedVars = variables.filter(v => !/^\d+$/.test(v));
        for (const v of namedVars) {
            if (v.includes(' ')) {
                errors.variables = `Variable "{{${v}}}" contains spaces. Use underscores instead: {{${v.replace(/\s+/g, '_')}}}`;
                break;
            }
            if (/[A-Z]/.test(v)) {
                errors.variables = `Variable "{{${v}}}" contains uppercase letters. Use lowercase only: {{${v.toLowerCase()}}}`;
                break;
            }
            if (/^[0-9]/.test(v) && !/^\d+$/.test(v)) {
                errors.variables = `Variable "{{${v}}}" starts with a number but isn't purely numeric. Named variables should not start with numbers.`;
                break;
            }
        }
    }

    // ====== CATEGORY-SPECIFIC VALIDATION ======
    if (state.category === 'UTILITY') {
        const marketingTerms = hasMarketingLanguage(state.body + ' ' + (state.header.text || '') + ' ' + state.footer);
        if (marketingTerms.length > 0) {
            warnings.push(`Utility templates should not contain marketing language. Found: ${marketingTerms.join(', ')}. Consider using MARKETING category instead or Meta may re-categorize your template.`);
        }
        tips.push('Utility templates are for transactional messages: order updates, appointment reminders, shipping notifications, account alerts.');
    }

    if (state.category === 'MARKETING') {
        tips.push('Marketing templates may be subject to per-user limits. Users can only receive a limited number of marketing messages per day.');
    }

    if (state.category === 'AUTHENTICATION') {
        const bodyVars = parseVariables(state.body);
        if (bodyVars.length === 0) {
            errors.body = 'Authentication templates typically require a {{1}} variable for the OTP code.';
        }
        if (state.buttons.length > 0) {
            errors.buttons = 'Authentication templates should not have custom buttons. Meta provides automatic copy-code functionality.';
        }
    }

    // ====== FOOTER VALIDATION ======
    if (state.footer) {
        if (state.footer.length > 60) {
            errors.footer = `Footer exceeds 60 characters (Meta limit). Current: ${state.footer.length}. Remove ${state.footer.length - 60} characters.`;
        }
        // No variables allowed in footer
        const footerVars = parseVariables(state.footer);
        if (footerVars.length > 0) {
            errors.footer = 'Footer cannot contain variables. Move variables to the body section.';
        }
    }

    // ====== BUTTON VALIDATION ======
    if (state.buttons.length > 0) {
        if (state.buttons.length > 10) {
            errors.buttons = 'Maximum 10 buttons allowed. Current: ' + state.buttons.length;
        } else if (state.buttons.length > 3) {
            warnings.push('Templates with more than 3 buttons will show a "See all options" button on WhatsApp.');
        }

        // Count button types
        const urlButtons = state.buttons.filter(b => b.type === 'url');
        const phoneButtons = state.buttons.filter(b => b.type === 'phone');
        const flowButtons = state.buttons.filter(b => b.type === 'flow');
        const copyCodeButtons = state.buttons.filter(b => b.type === 'copy_code');
        const catalogButtons = state.buttons.filter(b => b.type === 'catalog');
        const voiceCallButtons = state.buttons.filter(b => b.type === 'voice_call');

        if (catalogButtons.length > 0 && state.category !== 'MARKETING') {
            errors.buttons = 'Catalog button requires MARKETING category as per Meta template rules.';
        }

        if (urlButtons.length > 2) {
            errors.buttons = 'Maximum 2 URL buttons allowed. Current: ' + urlButtons.length;
        }
        if (phoneButtons.length > 1) {
            errors.buttons = 'Maximum 1 phone number button allowed. Current: ' + phoneButtons.length;
        }
        if (flowButtons.length > 1) {
            errors.buttons = 'Maximum 1 flow button allowed. Current: ' + flowButtons.length;
        }
        if (copyCodeButtons.length > 1) {
            errors.buttons = 'Maximum 1 copy code button allowed. Current: ' + copyCodeButtons.length;
        }
        if (catalogButtons.length > 1) {
            errors.buttons = 'Maximum 1 catalog button allowed. Current: ' + catalogButtons.length;
        }
        if (voiceCallButtons.length > 1) {
            errors.buttons = 'Maximum 1 call on WhatsApp button allowed. Current: ' + voiceCallButtons.length;
        }

        // Validate individual buttons
        for (let i = 0; i < state.buttons.length; i++) {
            const btn = state.buttons[i];

            if (btn.type !== 'copy_code') {
                if (!btn.text || btn.text.trim().length === 0) {
                    errors.buttons = `Button ${i + 1}: Text is required.`;
                    break;
                }
                if (btn.text.length > 25) {
                    errors.buttons = `Button ${i + 1}: Text exceeds 25 characters. Current: ${btn.text.length}`;
                    break;
                }
            }

            if (btn.type === 'url') {
                if (!btn.url) {
                    errors.buttons = `Button ${i + 1}: URL is required for URL buttons.`;
                    break;
                }
                try {
                    new URL(btn.url.replace(/\{\{.*?\}\}/g, 'placeholder')); // Replace variables for URL validation
                } catch {
                    errors.buttons = `Button ${i + 1}: Invalid URL format. Must be a valid https:// URL.`;
                    break;
                }
                if (!btn.url.startsWith('https://')) {
                    errors.buttons = `Button ${i + 1}: URL must start with https:// (not http://)`;
                    break;
                }
            }

            if (btn.type === 'phone') {
                if (!btn.phone) {
                    errors.buttons = `Button ${i + 1}: Phone number is required.`;
                    break;
                }
                if (!/^\+?[0-9]{10,15}$/.test(btn.phone.replace(/[\s-]/g, ''))) {
                    errors.buttons = `Button ${i + 1}: Invalid phone number format. Use international format: +1234567890`;
                    break;
                }
            }

            if (btn.type === 'flow' && !btn.flow_id) {
                errors.buttons = `Button ${i + 1}: Please select a published flow.`;
                break;
            }

            if (btn.type === 'copy_code') {
                if (!btn.copy_code || !btn.copy_code.trim()) {
                    errors.buttons = `Button ${i + 1}: Copy code value is required.`;
                    break;
                }
                if (!/^[a-zA-Z0-9]+$/.test(btn.copy_code)) {
                    errors.buttons = `Button ${i + 1}: Copy code must be alphanumeric only.`;
                    break;
                }
                if (btn.copy_code.length > 15) {
                    errors.buttons = `Button ${i + 1}: Copy code exceeds 15 characters.`;
                    break;
                }
            }
        }
    }

    // ====== GENERAL TIPS ======
    if (Object.keys(errors).length === 0) {
        tips.push('Template looks good! After submission, Meta typically reviews templates within 24 hours.');
        tips.push('Avoid re-submitting similar content if rejected. Change the wording significantly.');
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors,
        warnings,
        tips,
    };
}

// ============================================================
// Meta API Payload Generation
// ============================================================

/**
 * Build Meta API components from template state
 */
export function buildMetaTemplateComponents(state: TemplateState): MetaComponent[] {
    const components: MetaComponent[] = [];

    // Header component
    if (state.header.type === 'text' && state.header.text) {
        components.push({
            type: 'HEADER',
            format: 'TEXT',
            text: state.header.text,
        });
    } else if ((state.header.type === 'image' || state.header.type === 'video' || state.header.type === 'document') && state.header.mediaHandle) {
        const formatMap: Record<'image' | 'video' | 'document', 'IMAGE' | 'VIDEO' | 'DOCUMENT'> = {
            image: 'IMAGE',
            video: 'VIDEO',
            document: 'DOCUMENT',
        };
        components.push({
            type: 'HEADER',
            format: formatMap[state.header.type],
            example: {
                header_handle: [state.header.mediaHandle],
            },
        });
    } else if (state.header.type === 'location') {
        components.push({
            type: 'HEADER',
            format: 'LOCATION',
        });
    }

    // Body component (with examples for variables)
    const variables = parseVariables(state.body);
    const isNumeric = variables.every(v => /^\d+$/.test(v));

    // Use lowercase 'body' for named params as per Meta documentation examples
    const bodyComponent: MetaComponent = {
        type: isNumeric || variables.length === 0 ? 'BODY' : 'body',
        text: state.body,
    };

    if (variables.length > 0) {
        if (isNumeric) {
            // Legacy positional examples
            bodyComponent.example = {
                body_text: [variables.map((_, i) => `example${i + 1}`)],
            };
        } else {
            // Named parameters structure - use lowercase 'body' type as per Meta docs
            // Example: "body_text_named_params": [{"param_name": "name", "example": "John"}]
            // Meta requires realistic example values for approval

            // Generate realistic example values based on param name
            const getExampleValue = (paramName: string): string => {
                const lowerName = paramName.toLowerCase();
                if (lowerName.includes('name')) return 'John';
                if (lowerName.includes('email')) return 'john@example.com';
                if (lowerName.includes('phone')) return '+1234567890';
                if (lowerName.includes('date')) return '2024-01-15';
                if (lowerName.includes('time')) return '10:30 AM';
                if (lowerName.includes('amount') || lowerName.includes('price') || lowerName.includes('money')) return '$99.99';
                if (lowerName.includes('order') || lowerName.includes('id')) return 'ORD-12345';
                if (lowerName.includes('code')) return 'ABC123';
                if (lowerName.includes('address')) return '123 Main St';
                if (lowerName.includes('number')) return '12345';
                return `sample_${paramName}`;
            };

            (bodyComponent as any).example = {
                body_text_named_params: variables.map(v => ({
                    param_name: v,
                    example: getExampleValue(v)
                }))
            };
        }
    }

    components.push(bodyComponent);

    // Footer component
    if (state.footer) {
        components.push({
            type: 'FOOTER',
            text: state.footer,
        });
    }

    // Buttons component (only if NOT AUTHENTICATION and has buttons)
    if (state.category !== 'AUTHENTICATION' && state.buttons.length > 0) {
        components.push({
            type: 'BUTTONS',
            buttons: state.buttons.map(btn => {
                // Map button type to Meta API format
                const getMetaButtonType = () => {
                    switch (btn.type) {
                        case 'quick_reply': return 'QUICK_REPLY';
                        case 'url': return 'URL';
                        case 'phone': return 'PHONE_NUMBER';
                        case 'flow': return 'FLOW';
                        case 'copy_code': return 'COPY_CODE';
                        case 'voice_call': return 'VOICE_CALL';
                        case 'catalog': return 'CATALOG';
                    }
                };
                return {
                    type: getMetaButtonType(),
                    ...(btn.type !== 'copy_code' ? { text: btn.text || (btn.type === 'catalog' ? 'View catalog' : '') } : {}),
                    ...(btn.type === 'url' && btn.url ? { url: btn.url } : {}),
                    ...(btn.type === 'phone' && btn.phone ? { phone_number: btn.phone } : {}),
                    ...(btn.type === 'flow' && btn.flow_id ? { flow_id: btn.flow_id, flow_token: btn.flow_token || '' } : {}),
                    ...(btn.type === 'copy_code' ? { example: btn.copy_code || '' } : {}),
                    ...(btn.type === 'voice_call' && !btn.text ? { text: 'Call' } : {}),
                };
            }),
        });
    }

    return components;
}

/**
 * Build full API request payload
 */
export function buildTemplateApiPayload(
    state: TemplateState,
    accountId: number
): {
    account_id: number;
    name: string;
    category: TemplateCategory;
    language: string;
    components: MetaComponent[];
    parameter_format?: 'named' | 'positional';
} {
    const variables = parseVariables(state.body);
    const hasNamedParams = variables.some(v => !/^\d+$/.test(v));

    return {
        account_id: accountId,
        name: state.name,
        category: state.category,
        language: state.language,
        components: buildMetaTemplateComponents(state),
        // Explicitly set parameter_format if using named parameters (must be lowercase 'named')
        ...(hasNamedParams ? { parameter_format: 'named' } : {})
    };
}

// ============================================================
// Suggestion to State Conversion
// ============================================================

export interface TemplateSuggestion {
    id: string;
    title: string;
    category: string;
    language: string;
    preview: string;
    variables: number;
    description: string;
}

interface TemplateApiData {
    id?: number;
    name?: string;
    category?: string;
    language?: string;
    status?: string;
    rejection_reason?: string;
    body_text?: string;
    footer_text?: string;
    components?: any[];
}

/**
 * Convert template data returned by backend API into editable builder state.
 */
export function templateApiToState(template: TemplateApiData): TemplateState {
    const components = Array.isArray(template.components) ? template.components : [];

    const headerComp = components.find((c: any) => String(c?.type || '').toUpperCase() === 'HEADER');
    const bodyComp = components.find((c: any) => {
        const t = String(c?.type || '');
        return t.toUpperCase() === 'BODY' || t === 'body';
    });
    const footerComp = components.find((c: any) => String(c?.type || '').toUpperCase() === 'FOOTER');
    const buttonsComp = components.find((c: any) => String(c?.type || '').toUpperCase() === 'BUTTONS');

    let header: TemplateHeader = { type: 'none' };
    if (headerComp) {
        const format = String(headerComp.format || '').toUpperCase();
        if (format === 'TEXT') {
            header = { type: 'text', text: String(headerComp.text || '') };
        } else if (format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT') {
            const headerHandle = Array.isArray(headerComp.example?.header_handle)
                ? String(headerComp.example.header_handle[0] || '')
                : '';
            header = {
                type: format.toLowerCase() as 'image' | 'video' | 'document',
                mediaHandle: headerHandle || undefined,
            };
        } else if (format === 'LOCATION') {
            header = { type: 'location' };
        }
    }

    const rawButtons = Array.isArray(buttonsComp?.buttons) ? buttonsComp.buttons : [];
    const buttons: TemplateButton[] = rawButtons
        .map((btn: any): TemplateButton | null => {
            const metaType = String(btn?.type || '').toUpperCase();
            const text = String(btn?.text || '');

            switch (metaType) {
                case 'QUICK_REPLY':
                    return { type: 'quick_reply', text };
                case 'URL':
                    return { type: 'url', text, url: String(btn?.url || '') };
                case 'PHONE_NUMBER':
                    return { type: 'phone', text, phone: String(btn?.phone_number || '') };
                case 'FLOW':
                    return {
                        type: 'flow',
                        text,
                        flow_id: String(btn?.flow_id || ''),
                        flow_token: String(btn?.flow_token || ''),
                    };
                case 'COPY_CODE':
                    return { type: 'copy_code', text: text || 'Copy Code', copy_code: String(btn?.example || '') };
                case 'VOICE_CALL':
                    return { type: 'voice_call', text: text || 'Call on WhatsApp' };
                case 'CATALOG':
                    return { type: 'catalog', text: text || 'View Catalog' };
                default:
                    return null;
            }
        })
        .filter(Boolean) as TemplateButton[];

    const status = String(template.status || 'DRAFT').toUpperCase();
    const normalizedStatus: TemplateStatus =
        status === 'PENDING' || status === 'APPROVED' || status === 'REJECTED'
            ? (status as TemplateStatus)
            : 'DRAFT';

    return {
        ...defaultTemplateState,
        id: template.id,
        name: String(template.name || ''),
        category: (String(template.category || 'UTILITY').toUpperCase() as TemplateCategory),
        language: String(template.language || 'en_US'),
        status: normalizedStatus,
        rejectionReason: template.rejection_reason,
        header,
        body: String(bodyComp?.text || template.body_text || ''),
        footer: String(footerComp?.text || template.footer_text || ''),
        buttons,
    };
}

/**
 * Convert a template suggestion to editable state
 */
export function suggestionToState(suggestion: TemplateSuggestion): TemplateState {
    // Generate a name from the suggestion ID
    const name = suggestion.id.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    return {
        ...defaultTemplateState,
        name,
        category: (suggestion.category?.toUpperCase() || 'UTILITY') as TemplateCategory,
        language: suggestion.language || 'en_US',
        body: suggestion.preview || '',
        status: 'DRAFT',
    };
}
