// Validation Banner Component
// ===========================
// Displays validation errors, warnings, and tips for Meta template approval

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ValidationErrors } from '../../utils/templateUtils';
import { AlertCircle, CheckCircle2, AlertTriangle, Lightbulb, Info } from 'lucide-react';

interface ValidationBannerProps {
    errors: ValidationErrors;
    isValid: boolean;
    warnings?: string[];
    tips?: string[];
}

export function ValidationBanner({ errors, isValid, warnings = [], tips = [] }: ValidationBannerProps) {
    const errorList = Object.entries(errors).filter(([_, msg]) => msg);

    return (
        <div className="space-y-3">
            {/* ERRORS - Block submission */}
            {errorList.length > 0 && (
                <Alert variant="destructive" className="border-red-300 bg-red-50">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <AlertTitle className="text-red-800 text-sm font-semibold flex items-center gap-2">
                        <span>🚫 Template Cannot Be Submitted</span>
                        <span className="text-xs font-normal bg-red-200 px-2 py-0.5 rounded">
                            {errorList.length} {errorList.length === 1 ? 'issue' : 'issues'} found
                        </span>
                    </AlertTitle>
                    <AlertDescription className="mt-2">
                        <ul className="space-y-2">
                            {errorList.map(([field, message]) => (
                                <li key={field} className="text-sm bg-white border border-red-200 rounded p-2">
                                    <div className="flex items-start gap-2">
                                        <span className="text-red-600 font-medium capitalize min-w-[80px]">
                                            {field === 'variables' ? '🔤 Variables' :
                                             field === 'body' ? '📝 Body' :
                                             field === 'header' ? '📋 Header' :
                                             field === 'footer' ? '📎 Footer' :
                                             field === 'buttons' ? '🔘 Buttons' :
                                             field === 'name' ? '📛 Name' :
                                             `${field}`}:
                                        </span>
                                        <span className="text-red-700">{message}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {/* WARNINGS - Allow submission but warn */}
            {warnings.length > 0 && (
                <Alert className="border-amber-300 bg-amber-50">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <AlertTitle className="text-amber-800 text-sm font-semibold flex items-center gap-2">
                        <span>⚠️ Warnings</span>
                        <span className="text-xs font-normal text-amber-600">
                            (submission allowed, but review recommended)
                        </span>
                    </AlertTitle>
                    <AlertDescription className="mt-2">
                        <ul className="space-y-1">
                            {warnings.map((warning, index) => (
                                <li key={index} className="text-sm text-amber-700 flex items-start gap-2">
                                    <span className="text-amber-500">•</span>
                                    <span>{warning}</span>
                                </li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {/* SUCCESS - Ready to submit */}
            {isValid && (
                <Alert className="bg-green-50 border-green-300">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <AlertTitle className="text-green-800 text-sm font-semibold">
                        ✅ Template Ready for Submission
                    </AlertTitle>
                    <AlertDescription className="text-green-700 text-sm mt-1">
                        Your template passes all validation checks. Click <strong>"Submit for Approval"</strong> to send to Meta for review.
                    </AlertDescription>
                </Alert>
            )}

            {/* TIPS - Best practices */}
            {tips.length > 0 && (
                <Alert className="border-blue-200 bg-blue-50">
                    <Lightbulb className="w-4 h-4 text-blue-600" />
                    <AlertTitle className="text-blue-800 text-sm font-semibold flex items-center gap-2">
                        <span>💡 Tips for Better Approval</span>
                    </AlertTitle>
                    <AlertDescription className="mt-2">
                        <ul className="space-y-1">
                            {tips.map((tip, index) => (
                                <li key={index} className="text-sm text-blue-700 flex items-start gap-2">
                                    <Info className="w-3 h-3 mt-1 text-blue-500 flex-shrink-0" />
                                    <span>{tip}</span>
                                </li>
                            ))}
                        </ul>
                    </AlertDescription>
                </Alert>
            )}

            {/* Quick Reference Card - shown when there are errors */}
            {!isValid && (
                <div className="text-xs bg-gray-50 border border-gray-200 rounded p-3 mt-2">
                    <div className="font-semibold text-gray-700 mb-2">📖 Meta Template Quick Reference:</div>
                    <div className="grid grid-cols-2 gap-2 text-gray-600">
                        <div>
                            <strong>Variables:</strong>
                            <ul className="ml-2">
                                <li>• Named: <code className="bg-gray-200 px-1 rounded">{'{{customer_name}}'}</code></li>
                                <li>• Positional: <code className="bg-gray-200 px-1 rounded">{'{{1}}'}</code>, <code className="bg-gray-200 px-1 rounded">{'{{2}}'}</code></li>
                                <li>• Don't mix both types</li>
                            </ul>
                        </div>
                        <div>
                            <strong>Character Limits:</strong>
                            <ul className="ml-2">
                                <li>• Body: 1024 chars</li>
                                <li>• Header/Footer: 60 chars</li>
                                <li>• Button text: 25 chars</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
