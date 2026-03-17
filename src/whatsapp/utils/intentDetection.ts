// Intent Detection with Multi-Signal Scoring
// ============================================
// Uses weighted scoring (0-100) for each category instead of hard classification
// Shows confidence badges and allows user override when uncertain

export type Intent = 'TRANSACTIONAL' | 'PROMOTIONAL' | 'AUTHENTICATION' | 'AMBIGUOUS';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface CategoryScores {
    utility: number;      // 0-100
    marketing: number;    // 0-100
    authentication: number; // 0-100
}

export interface CategoryViolation {
    type: string;
    detail: string;
    location: 'BODY' | 'HEADER' | 'FOOTER' | 'BUTTON' | 'URL';
    severity: 'ERROR' | 'WARNING' | 'INFO';
}

export interface IntentResult {
    intent: Intent;
    confidence: Confidence;
    scores: CategoryScores;
    violations: CategoryViolation[];
    suggestedCategory?: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    confidenceBadge: 'strong_utility' | 'strong_marketing' | 'strong_auth' | 'mixed_review' | 'low_confidence';
    userMessage: string;
}

// ============================================================
// Signal Weights (configurable)
// ============================================================

const UTILITY_KEYWORDS: Record<string, number> = {
    'order confirmed': 15,
    'order shipped': 15,
    'out for delivery': 15,
    'tracking': 10,
    'appointment scheduled': 12,
    'appointment': 8,
    'payment successful': 12,
    'payment received': 12,
    'invoice': 10,
    'receipt': 10,
    'account update': 8,
    'system alert': 8,
    'booking confirmed': 12,
    'reservation': 10,
    'delivery': 8,
    'shipped': 10,
    'confirmed': 6,
    'status': 5,
    'update': 4,
    'reminder': 6,
    'scheduled': 6,
};

const MARKETING_KEYWORDS: Record<string, number> = {
    'discount': 15,
    'offer': 12,
    'sale': 12,
    'free': 10,
    'cashback': 12,
    'deal': 10,
    'limited time': 15,
    'exclusive': 12,
    'buy now': 15,
    'shop now': 15,
    'upgrade': 8,
    'special': 8,
    'hurry': 12,
    'don\'t miss': 12,
    'act now': 12,
    'save': 8,
    'off': 6,
    'promo': 10,
    'coupon': 10,
    'flash sale': 15,
};

const AUTH_KEYWORDS: Record<string, number> = {
    'otp': 20,
    'verification code': 20,
    'login code': 20,
    'one-time password': 20,
    'one time password': 20,
    'do not share': 10,
    'expires in': 8,
    'security code': 18,
    'verify your': 12,
    'verify account': 15,
    'confirm identity': 12,
    'authentication': 15,
};

// Structural signals
const PROMOTIONAL_EMOJIS = ['🎉', '🔥', '💥', '🛍️', '🚀', '🎁', '💰', '🎊', '⚡', '✨', '🤑', '💸', '🏷️', '💯'];
const UTILITY_EMOJIS = ['✅', '📦', '📋', '📄', '🔔', '📍', '📆', '⏰', '📧'];

// ============================================================
// Scoring Functions
// ============================================================

function calculateKeywordScore(text: string, keywords: Record<string, number>): number {
    const lowerText = text.toLowerCase();
    let score = 0;

    for (const [keyword, weight] of Object.entries(keywords)) {
        if (lowerText.includes(keyword.toLowerCase())) {
            score += weight;
        }
    }

    return Math.min(score, 100); // Cap at 100
}

function calculateStructuralScore(
    body: string,
    buttons: Array<{ text: string; url?: string }> = []
): { utility: number; marketing: number; auth: number } {
    let utilityBonus = 0;
    let marketingBonus = 0;
    let authBonus = 0;

    // Check emojis
    for (const emoji of PROMOTIONAL_EMOJIS) {
        if (body.includes(emoji)) {
            marketingBonus += 5;
        }
    }
    for (const emoji of UTILITY_EMOJIS) {
        if (body.includes(emoji)) {
            utilityBonus += 3;
        }
    }

    // No buttons + no emojis = utility signal
    const hasPromoEmojis = PROMOTIONAL_EMOJIS.some(e => body.includes(e));
    if (buttons.length === 0 && !hasPromoEmojis) {
        utilityBonus += 10;
    }

    // CTA buttons = marketing signal
    const ctaPatterns = /\b(shop|buy|order now|get|claim|explore|discover)\b/i;
    for (const btn of buttons) {
        if (ctaPatterns.test(btn.text)) {
            marketingBonus += 10;
        }
        // URL analysis
        if (btn.url) {
            if (/\/(pricing|shop|offers|promo|sale|store)/i.test(btn.url)) {
                marketingBonus += 8;
            }
            if (/\/(invoice|dashboard|orders|tracking|account)/i.test(btn.url)) {
                utilityBonus += 8;
            }
        }
    }

    // OTP placeholder pattern
    if (/\{\{1\}\}/.test(body) && body.length < 200) {
        const hasOtpContext = /\b(code|otp|verification)\b/i.test(body);
        if (hasOtpContext) {
            authBonus += 15;
        }
    }

    // Delivery OTP context (stays utility)
    const deliveryContext = /\b(delivery|package|order|receive|pickup|collect|parcel)\b/i;
    if (deliveryContext.test(body) && /otp/i.test(body)) {
        utilityBonus += 20;
        authBonus -= 15; // Reduce auth score for delivery OTP
    }

    return {
        utility: Math.max(0, utilityBonus),
        marketing: Math.max(0, marketingBonus),
        auth: Math.max(0, authBonus),
    };
}

// ============================================================
// Main Detection Function
// ============================================================

export function detectIntent(
    body: string,
    header?: string,
    footer?: string,
    buttons: Array<{ text: string; url?: string }> = []
): IntentResult {
    const fullText = [header, body, footer].filter(Boolean).join(' ');
    const violations: CategoryViolation[] = [];

    // Calculate keyword scores
    const utilityKeywordScore = calculateKeywordScore(fullText, UTILITY_KEYWORDS);
    const marketingKeywordScore = calculateKeywordScore(fullText, MARKETING_KEYWORDS);
    const authKeywordScore = calculateKeywordScore(fullText, AUTH_KEYWORDS);

    // Calculate structural scores
    const structural = calculateStructuralScore(body, buttons);

    // Combine scores (keyword + structural)
    const scores: CategoryScores = {
        utility: Math.min(utilityKeywordScore + structural.utility, 100),
        marketing: Math.min(marketingKeywordScore + structural.marketing, 100),
        authentication: Math.min(authKeywordScore + structural.auth, 100),
    };

    // Collect violations for warnings (not blocking)
    if (marketingKeywordScore > 20) {
        const foundKeywords = Object.keys(MARKETING_KEYWORDS).filter(k =>
            fullText.toLowerCase().includes(k.toLowerCase())
        );
        if (foundKeywords.length > 0) {
            violations.push({
                type: 'PROMOTIONAL_KEYWORD',
                detail: `Found promotional signals: ${foundKeywords.slice(0, 3).join(', ')}`,
                location: 'BODY',
                severity: 'INFO',
            });
        }
    }

    // Determine confidence and intent
    let intent: Intent;
    let confidence: Confidence;
    let suggestedCategory: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION' | undefined;
    let confidenceBadge: IntentResult['confidenceBadge'];
    let userMessage: string;

    const maxScore = Math.max(scores.utility, scores.marketing, scores.authentication);
    const secondMax = [scores.utility, scores.marketing, scores.authentication]
        .sort((a, b) => b - a)[1];
    const thirdMax = [scores.utility, scores.marketing, scores.authentication]
        .sort((a, b) => b - a)[2];
    const scoreDiff = maxScore - secondMax;

    // Check if one category is dominant (high score, others are low)
    const isDominant = maxScore >= 25 && secondMax <= 10 && thirdMax <= 10;

    // Check if clearly better than alternatives
    const isClearWinner = maxScore >= 35 && scoreDiff >= 20;

    // CASE 1: Dominant winner (one score high, others near zero)
    if (isDominant || isClearWinner) {
        confidence = 'HIGH';

        if (scores.authentication === maxScore) {
            intent = 'AUTHENTICATION';
            suggestedCategory = 'AUTHENTICATION';
            confidenceBadge = 'strong_auth';
            userMessage = '🟢 Strong Authentication - This is clearly a verification/OTP message.';
        } else if (scores.utility === maxScore) {
            intent = 'TRANSACTIONAL';
            suggestedCategory = 'UTILITY';
            confidenceBadge = 'strong_utility';
            userMessage = '🟢 Strong Utility - This is a clear transactional message.';
        } else {
            intent = 'PROMOTIONAL';
            suggestedCategory = 'MARKETING';
            confidenceBadge = 'strong_marketing';
            userMessage = '🔴 Looks Marketing - This message contains promotional content.';
        }
    }
    // CASE 2: Mixed intent (competing scores)
    else if (maxScore >= 15 && scoreDiff < 20 && secondMax >= 8) {
        intent = 'AMBIGUOUS';
        confidence = 'MEDIUM';
        confidenceBadge = 'mixed_review';
        userMessage = '🟡 Mixed Intent - This message contains both informational and promotional signals. Meta will decide the final category.';

        // Suggest the highest scoring category
        if (scores.utility >= scores.marketing && scores.utility >= scores.authentication) {
            suggestedCategory = 'UTILITY';
        } else if (scores.marketing >= scores.authentication) {
            suggestedCategory = 'MARKETING';
        } else {
            suggestedCategory = 'AUTHENTICATION';
        }
    }
    // CASE 3: Moderate single-category signal (not dominant but clear direction)
    else if (maxScore >= 15 && secondMax < 8) {
        confidence = 'MEDIUM';

        if (scores.authentication === maxScore) {
            intent = 'AUTHENTICATION';
            suggestedCategory = 'AUTHENTICATION';
            confidenceBadge = 'strong_auth';
            userMessage = '🟢 Likely Authentication - This appears to be a verification message.';
        } else if (scores.utility === maxScore) {
            intent = 'TRANSACTIONAL';
            suggestedCategory = 'UTILITY';
            confidenceBadge = 'strong_utility';
            userMessage = '🟢 Likely Utility - This appears to be a transactional message.';
        } else {
            intent = 'PROMOTIONAL';
            suggestedCategory = 'MARKETING';
            confidenceBadge = 'strong_marketing';
            userMessage = '🟡 Likely Marketing - This appears to contain promotional content.';
        }
    }
    // CASE 4: Low confidence overall
    else {
        intent = 'AMBIGUOUS';
        confidence = 'LOW';
        confidenceBadge = 'low_confidence';
        userMessage = '⚪ Low Confidence - Not enough signals to classify. Meta will determine the category.';

        // Still suggest based on highest
        if (maxScore > 0) {
            if (scores.utility >= scores.marketing && scores.utility >= scores.authentication) {
                suggestedCategory = 'UTILITY';
            } else if (scores.marketing >= scores.authentication) {
                suggestedCategory = 'MARKETING';
            } else {
                suggestedCategory = 'AUTHENTICATION';
            }
        }
    }

    return {
        intent,
        confidence,
        scores,
        violations,
        suggestedCategory,
        confidenceBadge,
        userMessage,
    };
}

// ============================================================
// Category Compliance Validation
// ============================================================

export interface ComplianceResult {
    isCompliant: boolean;
    violations: CategoryViolation[];
    detectedIntent: Intent;
    scores: CategoryScores;
    confidenceBadge: IntentResult['confidenceBadge'];
    message?: string;
    userMessage: string;
    suggestSwitch?: boolean;
    suggestedCategory?: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    allowUserOverride: boolean;
}

export function validateCategoryCompliance(
    category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION',
    body: string,
    header?: string,
    footer?: string,
    buttons: Array<{ text: string; url?: string }> = []
): ComplianceResult {
    const intentResult = detectIntent(body, header, footer, buttons);
    const { scores, confidence, confidenceBadge, userMessage, suggestedCategory } = intentResult;

    // AUTHENTICATION validation
    if (category === 'AUTHENTICATION') {
        // Check if content is NOT authentication-like
        if (scores.authentication < 30) {
            const hasOtp = /\b(otp|code|verification|verify)\b/i.test(body);
            if (!hasOtp) {
                return {
                    isCompliant: false,
                    violations: [{
                        type: 'MISSING_AUTH_CONTENT',
                        detail: 'Authentication templates must contain OTP/verification content',
                        location: 'BODY',
                        severity: 'ERROR',
                    }],
                    detectedIntent: intentResult.intent,
                    scores,
                    confidenceBadge,
                    message: 'This doesn\'t look like an authentication message.',
                    userMessage,
                    suggestSwitch: true,
                    suggestedCategory: scores.utility > scores.marketing ? 'UTILITY' : 'MARKETING',
                    allowUserOverride: true,
                };
            }
        }

        // Check for buttons (not allowed)
        if (buttons && buttons.length > 0) {
            return {
                isCompliant: false,
                violations: [{
                    type: 'BUTTONS_NOT_ALLOWED',
                    detail: 'Authentication templates cannot have buttons',
                    location: 'BUTTON',
                    severity: 'ERROR',
                }],
                detectedIntent: intentResult.intent,
                scores,
                confidenceBadge,
                message: 'Remove buttons for Authentication templates.',
                userMessage,
                suggestSwitch: false,
                allowUserOverride: false,
            };
        }

        return {
            isCompliant: true,
            violations: [],
            detectedIntent: intentResult.intent,
            scores,
            confidenceBadge,
            userMessage,
            allowUserOverride: true,
        };
    }

    // UTILITY validation
    if (category === 'UTILITY') {
        // HIGH confidence marketing = warn but allow override
        if (confidenceBadge === 'strong_marketing' && scores.marketing >= 50) {
            return {
                isCompliant: false,
                violations: intentResult.violations,
                detectedIntent: intentResult.intent,
                scores,
                confidenceBadge,
                message: 'This looks like marketing content. Meta may reject or pause it.',
                userMessage: '🔴 High Marketing Score - Consider using Marketing category.',
                suggestSwitch: true,
                suggestedCategory: 'MARKETING',
                allowUserOverride: true, // User can still proceed
            };
        }

        // Strong auth content in utility = suggest switch
        if (confidenceBadge === 'strong_auth') {
            return {
                isCompliant: false,
                violations: [{
                    type: 'AUTH_IN_UTILITY',
                    detail: 'Login/verification OTP should use Authentication category',
                    location: 'BODY',
                    severity: 'WARNING',
                }],
                detectedIntent: intentResult.intent,
                scores,
                confidenceBadge,
                message: 'This looks like a login/verification OTP.',
                userMessage: '🟡 Consider Authentication - This looks like a verification message.',
                suggestSwitch: true,
                suggestedCategory: 'AUTHENTICATION',
                allowUserOverride: true,
            };
        }

        // Mixed intent = warn but allow
        if (confidenceBadge === 'mixed_review') {
            return {
                isCompliant: true, // Allow but warn
                violations: intentResult.violations,
                detectedIntent: intentResult.intent,
                scores,
                confidenceBadge,
                message: 'Mixed signals detected. Meta will make the final decision.',
                userMessage,
                suggestSwitch: false,
                allowUserOverride: true,
            };
        }

        // Strong utility or low confidence = compliant
        return {
            isCompliant: true,
            violations: [],
            detectedIntent: intentResult.intent,
            scores,
            confidenceBadge,
            userMessage,
            allowUserOverride: true,
        };
    }

    // MARKETING validation (lenient)
    if (category === 'MARKETING') {
        // Auth content in marketing = suggest switch
        if (confidenceBadge === 'strong_auth') {
            return {
                isCompliant: true,
                violations: [],
                detectedIntent: intentResult.intent,
                scores,
                confidenceBadge,
                message: 'This looks like authentication content. Consider using Authentication category.',
                userMessage: '🟡 Consider Authentication - OTP messages have special requirements.',
                suggestSwitch: true,
                suggestedCategory: 'AUTHENTICATION',
                allowUserOverride: true,
            };
        }

        return {
            isCompliant: true,
            violations: [],
            detectedIntent: intentResult.intent,
            scores,
            confidenceBadge,
            userMessage,
            allowUserOverride: true,
        };
    }

    return {
        isCompliant: true,
        violations: [],
        detectedIntent: intentResult.intent,
        scores,
        confidenceBadge,
        userMessage,
        allowUserOverride: true,
    };
}

// ============================================================
// Helper text for UI
// ============================================================

export const UTILITY_HELPER_TEXT =
    'Utility templates must be transactional and tied to an existing user action. ' +
    'Promotional content will be rejected or later paused by Meta.';

export const MARKETING_HELPER_TEXT =
    'Marketing templates can include promotional content, offers, and calls to action.';

export const AUTHENTICATION_HELPER_TEXT =
    'Authentication templates are for OTP and verification codes only. No buttons or promotional content.';

export function getCategoryHelperText(category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'): string {
    switch (category) {
        case 'UTILITY': return UTILITY_HELPER_TEXT;
        case 'MARKETING': return MARKETING_HELPER_TEXT;
        case 'AUTHENTICATION': return AUTHENTICATION_HELPER_TEXT;
    }
}

// ============================================================
// Confidence Badge UI Helper
// ============================================================

export function getConfidenceBadgeStyle(badge: IntentResult['confidenceBadge']): {
    color: string;
    bgColor: string;
    label: string;
} {
    switch (badge) {
        case 'strong_utility':
            return { color: 'text-green-700', bgColor: 'bg-green-100', label: 'Strong Utility' };
        case 'strong_marketing':
            return { color: 'text-red-700', bgColor: 'bg-red-100', label: 'Looks Marketing' };
        case 'strong_auth':
            return { color: 'text-blue-700', bgColor: 'bg-blue-100', label: 'Strong Auth' };
        case 'mixed_review':
            return { color: 'text-amber-700', bgColor: 'bg-amber-100', label: 'Mixed - Review' };
        case 'low_confidence':
            return { color: 'text-gray-700', bgColor: 'bg-gray-100', label: 'Low Confidence' };
    }
}
