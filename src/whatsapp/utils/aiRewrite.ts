// AI Rewrite Utilities
// ====================
// AI-assisted template rewriting for category compliance

import { API_BASE_URL } from '@/config';

export interface RewriteRequest {
    originalText: string;
    targetCategory: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    header?: string;
    footer?: string;
}

export interface RewriteResponse {
    success: boolean;
    rewrittenText: string | null;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    notes: string;
    cannotRewrite: boolean;
    suggestedCategory?: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
}
const baseurl = API_BASE_URL;
/**
 * Request AI to rewrite template body for target category
 */
export async function rewriteForCategory(request: RewriteRequest): Promise<RewriteResponse> {
    try {
        const response = await fetch(`${baseurl}/api/whatsapp/ai/rewrite-template`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                original_text: request.originalText,
                target_category: request.targetCategory,
                header: request.header,
                footer: request.footer,
                constraints: getConstraintsForCategory(request.targetCategory),
            }),
        });

        const data = await response.json();

        if (data.success) {
            return {
                success: true,
                rewrittenText: data.rewritten_text,
                confidence: data.confidence || 'MEDIUM',
                notes: data.notes || '',
                cannotRewrite: data.cannot_rewrite || false,
                suggestedCategory: data.suggested_category || undefined,
            };
        } else {
            return {
                success: false,
                rewrittenText: null,
                confidence: 'LOW',
                notes: data.error || 'Failed to rewrite template',
                cannotRewrite: true,
            };
        }
    } catch (error) {
        console.error('AI rewrite error:', error);
        return {
            success: false,
            rewrittenText: null,
            confidence: 'LOW',
            notes: 'Network error. Please try again.',
            cannotRewrite: true,
        };
    }
}

/**
 * Get AI constraints based on target category
 */
function getConstraintsForCategory(category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION') {
    switch (category) {
        case 'UTILITY':
            return {
                transactional_only: true,
                no_promotional_intent: true,
                no_urgency_language: true,
                no_promotional_emojis: true,
                task_oriented_cta: true,
            };
        case 'MARKETING':
            return {
                allow_promotional: true,
                allow_urgency: true,
                allow_emojis: true,
                improve_cta: true,
            };
        case 'AUTHENTICATION':
            return {
                otp_only: true,
                no_buttons: true,
                no_emojis: true,
                minimal_text: true,
            };
    }
}

// ============================================================
// AI Prompt Templates (for backend reference)
// ============================================================

export const AI_PROMPTS = {
    UTILITY_REWRITE: `
You are a WhatsApp template compliance expert. Rewrite the following message to be suitable for Meta's UTILITY category.

UTILITY templates MUST be:
- Transactional (tied to a user action)
- Non-promotional (no sales, discounts, offers)
- Task-oriented (informational, not persuasive)

REMOVE:
- Promotional keywords (discount, offer, sale, free, etc.)
- Urgency language (limited time, hurry, don't miss, etc.)
- Promotional emojis (🎉 🔥 💥 🛍️ etc.)
- Persuasive CTAs (shop now, buy now, etc.)

KEEP:
- Core transactional information
- Order/booking/appointment details
- Task-oriented language (view, track, confirm, etc.)

If the message is inherently promotional and cannot be made transactional, respond with:
{ "cannot_rewrite": true, "notes": "This message is promotional by nature..." }

Original message:
{{ORIGINAL_TEXT}}

Respond in JSON format:
{
  "rewritten_text": "...",
  "confidence": "HIGH|MEDIUM|LOW",
  "notes": "...",
  "cannot_rewrite": false
}
`,

    MARKETING_REWRITE: `
You are a marketing copywriter. Improve the following WhatsApp message for the MARKETING category.

You MAY:
- Add soft urgency (limited time, special offer)
- Use engaging emojis
- Improve call-to-action clarity
- Add persuasive elements

Keep within Meta guidelines (no spam, no misleading claims).

Original message:
{{ORIGINAL_TEXT}}

Respond in JSON format:
{
  "rewritten_text": "...",
  "confidence": "HIGH|MEDIUM|LOW",
  "notes": "..."
}
`,
};

// ============================================================
// Sample transformations for preview
// ============================================================

/**
 * Quick local transformation for preview (before AI call)
 */
export function quickUtilityTransform(text: string): string {
    let result = text;

    // Remove common promotional phrases
    const promoPatterns = [
        /\bget\s+\d+%\s+off\b/gi,
        /\bsave\s+\d+%\b/gi,
        /\blimited\s+time\b/gi,
        /\bhurry\b/gi,
        /\bdon't\s+miss\b/gi,
        /\bexclusive\s+offer\b/gi,
        /\bspecial\s+deal\b/gi,
        /\bshop\s+now\b/gi,
        /\bbuy\s+now\b/gi,
        /\bfree\s+shipping\b/gi,
    ];

    for (const pattern of promoPatterns) {
        result = result.replace(pattern, '');
    }

    // Remove promotional emojis
    const promoEmojis = ['🎉', '🔥', '💥', '🛍️', '🚀', '🎁', '💰', '🎊', '⚡', '✨', '🤑', '💸'];
    for (const emoji of promoEmojis) {
        result = result.split(emoji).join('');
    }

    // Clean up extra whitespace
    result = result.replace(/\s+/g, ' ').trim();

    return result;
}
