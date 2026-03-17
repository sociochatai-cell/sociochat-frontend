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
import { Loader2, AlertCircle, ArrowLeft, Send } from 'lucide-react';

interface TemplateFormProps {
    state: TemplateState;
    onChange: (updates: Partial<TemplateState>) => void;
    validation: ValidationResult;
    onSubmit: () => void;
    onCancel: () => void;
    isSubmitting: boolean;
    accountId?: number; // For fetching published flows
}

export function TemplateForm({
    state,
    onChange,
    validation,
    onSubmit,
    onCancel,
    isSubmitting,
    accountId,
}: TemplateFormProps) {
    const handleNameChange = (value: string) => {
        // Auto-format to lowercase with underscores
        const formatted = value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        onChange({ name: formatted });
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
                    <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                        Template Details
                    </h3>

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
                            Lowercase letters, numbers, and underscores only
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
                                <SelectContent>
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
                                <SelectContent>
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
                    disabled={!validation.isValid || isSubmitting}
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
