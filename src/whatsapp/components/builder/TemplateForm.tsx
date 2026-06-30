// Template Form Component
// =======================
// Main form component that assembles all template builder sub-components

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { HeaderEditor } from './HeaderEditor';
import { BodyEditor } from './BodyEditor';
import { ButtonEditor } from './ButtonEditor';
import { ValidationBanner } from './ValidationBanner';
import {
    TemplateState,
    TemplateCategory,
    ValidationResult,
    SUPPORTED_LANGUAGES,
    CATEGORIES,
} from '../../utils/templateUtils';
import { Loader2, AlertCircle, ArrowLeft, Send, Sparkles, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

interface TemplateFormProps {
    state: TemplateState;
    onChange: (updates: Partial<TemplateState>) => void;
    validation: ValidationResult;
    onSubmit: () => void;
    onCancel: () => void;
    isSubmitting: boolean;
    accountId?: number; // For fetching published flows
    voiceCallCapability?: {
        success: boolean;
        strict_mode: boolean;
        voice_calling_ready: boolean;
        block_template_submission: boolean;
        receive_in_sociovia_dashboard: boolean;
        receive_path?: string;
        warnings?: string[];
    } | null;
    loadingVoiceCallCapability?: boolean;
}

export function TemplateForm({
    state,
    onChange,
    validation,
    onSubmit,
    onCancel,
    isSubmitting,
    accountId,
    voiceCallCapability,
    loadingVoiceCallCapability,
}: TemplateFormProps) {
    const handleNameChange = (value: string) => {
        // Auto-format to lowercase with underscores
        const formatted = value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        onChange({ name: formatted });
    };

    const handlePresetSelect = (presetKey: string) => {
        let presetState: Partial<TemplateState> = {};
        if (presetKey === 'otp_auth') {
            presetState = {
                name: 'otp_verification_code',
                category: 'AUTHENTICATION',
                header: { type: 'none' },
                body: 'Your verification code is {{1}}. Valid for 10 minutes. Please do not share this code with anyone.',
                footer: 'Sociovia Secure Auth',
                buttons: [{ type: 'copy_code', text: 'Copy Code', copy_code: '123456' }],
            };
        } else if (presetKey === 'welcome_marketing') {
            presetState = {
                name: 'welcome_new_user',
                category: 'MARKETING',
                header: { type: 'text', text: 'Welcome to Sociovia!' },
                body: 'Hi {{customer_name}}, welcome to our community! We are thrilled to have you here. As a welcome gift, use code {{promo_code}} to get {{discount}}% off on your first order.',
                footer: 'Enjoy your shopping!',
                buttons: [{ type: 'url', text: 'Shop Now', url: 'https://www.sociovia.com/shop' }],
            };
        } else if (presetKey === 'order_receipt') {
            presetState = {
                name: 'order_confirmation_receipt',
                category: 'UTILITY',
                header: { type: 'text', text: 'Order Confirmed' },
                body: 'Hello {{customer_name}}, thank you for your order! We have confirmed your order #{{order_id}} for a total of {{amount}}. We will notify you when it ships.',
                footer: 'Thank you for shopping with us!',
                buttons: [{ type: 'url', text: 'View Order Details', url: 'https://www.sociovia.com/orders/{{order_id}}' }],
            };
        } else if (presetKey === 'shipping_update') {
            presetState = {
                name: 'order_shipped_tracking',
                category: 'UTILITY',
                header: { type: 'text', text: 'Order Shipped' },
                body: 'Hi {{customer_name}}, your order #{{order_id}} has been shipped! Tracking Code: {{tracking_code}}. Click below to track.',
                footer: 'Thank you for choosing us!',
                buttons: [{ type: 'url', text: 'Track Shipment', url: 'https://www.sociovia.com/track?code={{tracking_code}}' }],
            };
        } else if (presetKey === 'appointment_reminder') {
            presetState = {
                name: 'appointment_reminder_schedule',
                category: 'UTILITY',
                header: { type: 'text', text: 'Appointment Reminder' },
                body: 'Hi {{customer_name}}, this is a reminder for your upcoming appointment on {{date}} at {{time}}. If you need to reschedule, please let us know.',
                footer: 'We look forward to seeing you!',
                buttons: [{ type: 'url', text: 'Manage Booking', url: 'https://www.sociovia.com/appointments' }],
            };
        } else if (presetKey === 'catalog_showcase') {
            presetState = {
                name: 'product_catalog_showcase',
                category: 'MARKETING',
                header: { type: 'text', text: 'Our Latest Products' },
                body: 'Hi {{customer_name}}, we have updated our product catalog with new arrivals. Browse our latest products and place your order directly on WhatsApp!',
                footer: 'Tap below to explore our catalog',
                buttons: [{ type: 'catalog', text: 'View catalog' }],
            };
        }
        onChange(presetState);
        toast.success('Preset loaded successfully! You can now customize or submit it.');
    };

    return (
        <div className="h-full flex flex-col">
            {/* Form header */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                <div>
                    <h2 className="text-lg font-semibold">
                        {state.id ? 'Edit Template' : 'Create Template'}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Design your WhatsApp template message
                    </p>
                </div>
                <div
                    className={`px-3 py-1 rounded-full text-xs font-medium ${state.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' :
                        state.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                            state.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                'bg-red-100 text-red-700'
                        }`}
                >
                    {state.status}
                </div>
            </div>

            {/* Rejection reason alert */}
            {state.status === 'REJECTED' && state.rejectionReason && (
                <div className="p-4 border-b">
                    <Alert variant="destructive">
                        <AlertCircle className="w-4 h-4" />
                        <AlertDescription>
                            <strong>Rejection reason:</strong> {state.rejectionReason}
                        </AlertDescription>
                    </Alert>
                </div>
            )}

            {/* Scrollable form content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Template Metadata */}
                <div className="space-y-4">
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-cyan-500" />
                        Template Details & Presets
                    </h3>

                    {/* Presets Dropdown */}
                    <div className="space-y-2 p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl">
                        <Label className="text-xs font-semibold text-cyan-800 dark:text-cyan-400 flex items-center gap-1">
                            ⚡ Quick-Approval Presets
                        </Label>
                        <Select onValueChange={handlePresetSelect}>
                            <SelectTrigger className="bg-white dark:bg-slate-950 border-cyan-500/20 text-slate-700 dark:text-slate-200 text-xs">
                                <SelectValue placeholder="Select a preset to load..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                <SelectItem value="otp_auth">🔑 One-Time Password (OTP) - Authentication</SelectItem>
                                <SelectItem value="welcome_marketing">👋 Welcome Greeting - Marketing</SelectItem>
                                <SelectItem value="catalog_showcase">🛒 Product Catalog Showcase - Marketing</SelectItem>
                                <SelectItem value="order_receipt">🧾 Order Confirmation Receipt - Utility</SelectItem>
                                <SelectItem value="shipping_update">🚚 Shipment Tracking Update - Utility</SelectItem>
                                <SelectItem value="appointment_reminder">📅 Appointment Booking Reminder - Utility</SelectItem>
                            </SelectContent>
                        </Select>
                        <p className="text-[10px] text-cyan-700/80 leading-normal">
                            Pre-configured layout with placeholders and fallback example parameters for immediate automated Meta approval (&lt; 1 min).
                        </p>
                    </div>

                    {/* Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">
                            Template Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="name"
                            placeholder="e.g., order_confirmation_v1"
                            value={state.name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            className={`font-mono ${validation.errors.name ? 'border-destructive' : ''}`}
                        />
                        <p className="text-xs text-muted-foreground">
                            Lowercase letters, numbers, and underscores only (spaces auto-formatted to underscores)
                        </p>
                        {validation.errors.name && (
                            <p className="text-xs text-destructive">{validation.errors.name}</p>
                        )}
                    </div>

                    {/* Category and Language */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Category</Label>
                            <Select
                                value={state.category}
                                onValueChange={(v) => onChange({ category: v as TemplateCategory })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    {CATEGORIES.map(cat => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            {cat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Language</Label>
                            <Select
                                value={state.language}
                                onValueChange={(v) => onChange({ language: v })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white">
                                    {SUPPORTED_LANGUAGES.map(lang => (
                                        <SelectItem key={lang.code} value={lang.code}>
                                            {lang.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Header */}
                <HeaderEditor
                    header={state.header}
                    onChange={(header) => onChange({ header })}
                    error={validation.errors.header}
                    accountId={accountId}
                />

                <Separator />

                {/* Body */}
                <BodyEditor
                    body={state.body}
                    category={state.category}
                    onChange={(body) => onChange({ body })}
                    onCategoryChange={(category) => onChange({ category })}
                    error={validation.errors.body}
                />

                <Separator />

                {/* Footer */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="footer">Footer (Optional)</Label>
                        <span className="text-xs text-muted-foreground">
                            {state.footer.length}/60 characters
                        </span>
                    </div>
                    <Input
                        id="footer"
                        placeholder="e.g., Thank you for your business"
                        value={state.footer}
                        onChange={(e) => onChange({ footer: e.target.value })}
                        maxLength={60}
                        className={validation.errors.footer ? 'border-destructive' : ''}
                    />
                    {validation.errors.footer && (
                        <p className="text-xs text-destructive">{validation.errors.footer}</p>
                    )}
                </div>

                <Separator />

                {/* Buttons */}
                <ButtonEditor
                    buttons={state.buttons}
                    category={state.category}
                    onChange={(buttons) => onChange({ buttons })}
                    error={validation.errors.buttons}
                    accountId={accountId}
                    voiceCallCapability={voiceCallCapability}
                    loadingVoiceCallCapability={loadingVoiceCallCapability}
                />

                <Separator />

                {/* Validation Banner */}
                <ValidationBanner
                    errors={validation.errors}
                    isValid={validation.isValid}
                    warnings={validation.warnings}
                    tips={validation.tips}
                />
            </div>

            {/* Form actions */}
            <div className="p-4 border-t bg-muted/30 flex items-center justify-between">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Cancel
                </Button>

                <Button
                    type="button"
                    onClick={onSubmit}
                    disabled={isSubmitting || !accountId}
                    className="gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Submitting...
                        </>
                    ) : (
                        <>
                            <Send className="w-4 h-4" />
                            Submit for Approval
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
