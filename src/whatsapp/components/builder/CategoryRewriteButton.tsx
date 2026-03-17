// Category Rewrite Button Component
// ==================================
// AI-powered button to rewrite template body for target category

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { rewriteForCategory, RewriteResponse } from '../../utils/aiRewrite';
import { TemplateCategory } from '../../utils/templateUtils';

interface CategoryRewriteButtonProps {
    body: string;
    category: TemplateCategory;
    onRewrite: (newBody: string) => void;
    onCategoryChange?: (category: TemplateCategory) => void;
    disabled?: boolean;
}

export function CategoryRewriteButton({
    body,
    category,
    onRewrite,
    onCategoryChange,
    disabled
}: CategoryRewriteButtonProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [result, setResult] = useState<RewriteResponse | null>(null);

    const handleRewrite = async () => {
        if (!body.trim()) return;

        setIsLoading(true);
        setResult(null);

        try {
            const response = await rewriteForCategory({
                originalText: body,
                targetCategory: category,
            });

            setResult(response);

            // Always show confirmation dialog for user review
            // User must approve/cancel before changes are applied
            setShowConfirm(true);
        } catch (error) {
            console.error('Rewrite failed:', error);
            setResult({
                success: false,
                rewrittenText: null,
                confidence: 'LOW',
                notes: 'Failed to rewrite. Please try again.',
                cannotRewrite: true,
            });
            setShowConfirm(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmApply = () => {
        if (result?.rewrittenText) {
            onRewrite(result.rewrittenText);
        }
        setShowConfirm(false);
        setResult(null);
    };

    const handleSwitchCategory = () => {
        if (result?.suggestedCategory && onCategoryChange) {
            onCategoryChange(result.suggestedCategory as TemplateCategory);
        }
        setShowConfirm(false);
        setResult(null);
    };

    const handleCancel = () => {
        setShowConfirm(false);
        setResult(null);
    };

    const getButtonLabel = () => {
        switch (category) {
            case 'UTILITY':
                return 'Rewrite Utility';
            case 'MARKETING':
                return 'Rewrite Marketing';
            case 'AUTHENTICATION':
                return 'Rewrite Auth';
            default:
                return 'Rewrite';
        }
    };

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRewrite}
                disabled={disabled || isLoading || !body.trim()}
                className="gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50 hover:border-violet-300"
            >
                {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <Sparkles className="w-4 h-4" />
                )}
                {isLoading ? 'Rewriting...' : getButtonLabel()}
            </Button>

            {/* Confirmation Dialog */}
            <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-violet-600" />
                            AI Rewrite Result
                        </DialogTitle>
                        <DialogDescription>
                            {result?.suggestedCategory
                                ? 'AI suggests using a different category for this content.'
                                : 'Review the suggested changes before applying.'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                        {/* Category suggestion - shown prominently */}
                        {result?.suggestedCategory && (
                            <Alert className="bg-blue-50 border-blue-200">
                                <AlertDescription className="text-blue-800">
                                    <p className="font-medium mb-2">
                                        This content fits better as <strong>{result.suggestedCategory}</strong>
                                    </p>
                                    <p className="text-sm mb-3">{result.notes}</p>
                                    {onCategoryChange && (
                                        <Button
                                            size="sm"
                                            onClick={handleSwitchCategory}
                                            className="gap-1"
                                        >
                                            Switch to {result.suggestedCategory}
                                            <ArrowRight className="w-3 h-3" />
                                        </Button>
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Cannot rewrite warning (no suggestion) */}
                        {result?.cannotRewrite && !result.suggestedCategory && (
                            <Alert variant="destructive">
                                <AlertCircle className="w-4 h-4" />
                                <AlertDescription>
                                    {result.notes || 'This message cannot be safely rewritten for the selected category.'}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Confidence indicator - only for successful rewrites */}
                        {result && result.rewrittenText && !result.cannotRewrite && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Confidence:</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${result.confidence === 'HIGH' ? 'bg-green-100 text-green-700' :
                                    result.confidence === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                    {result.confidence}
                                </span>
                            </div>
                        )}

                        {/* Notes - only for successful rewrites without category suggestion */}
                        {result?.notes && result.rewrittenText && !result.suggestedCategory && (
                            <Alert className="bg-green-50 border-green-200">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                <AlertDescription className="text-sm text-green-800">
                                    {result.notes}
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Original vs Rewritten comparison */}
                        {result?.rewrittenText && (
                            <div className="space-y-3">
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Original:</p>
                                    <div className="bg-muted/50 rounded-md p-3 text-sm line-through opacity-60 whitespace-pre-wrap">
                                        {body}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Rewritten:
                                    </p>
                                    <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm whitespace-pre-wrap">
                                        {result.rewrittenText}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCancel}>
                            {result?.rewrittenText ? 'Cancel' : 'Close'}
                        </Button>
                        {result?.rewrittenText && !result.cannotRewrite && (
                            <Button onClick={handleConfirmApply} className="gap-1">
                                <CheckCircle2 className="w-4 h-4" />
                                Apply Changes
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
