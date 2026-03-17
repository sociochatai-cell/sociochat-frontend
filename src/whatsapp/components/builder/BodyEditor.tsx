// Body Editor Component
// =====================
// Template body editor with variable detection, intent validation via scoring, and AI rewrite

import { useMemo, useState, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { parseVariables, validateVariableSequence, TemplateCategory, getInvalidNamedVariables } from '../../utils/templateUtils';
import {
    validateCategoryCompliance,
    getCategoryHelperText,
    getConfidenceBadgeStyle
} from '../../utils/intentDetection';
import { CategoryRewriteButton } from './CategoryRewriteButton';
import { AlertCircle, Plus, Info, AlertTriangle, ArrowRight, CheckCircle2, RotateCcw, RotateCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BodyEditorProps {
    body: string;
    category: TemplateCategory;
    onChange: (body: string) => void;
    onCategoryChange?: (category: TemplateCategory) => void;
    error?: string;
}

// Check for mixed variable types (positional + named)
function hasMixedVariableTypes(variables: string[]): boolean {
    if (variables.length === 0) return false;
    const hasPositional = variables.some(v => /^\d+$/.test(v));
    const hasNamed = variables.some(v => !/^\d+$/.test(v));
    return hasPositional && hasNamed;
}

// Get variable format type
function getVariableFormatType(variables: string[]): 'none' | 'positional' | 'named' | 'mixed' {
    if (variables.length === 0) return 'none';
    const hasPositional = variables.some(v => /^\d+$/.test(v));
    const hasNamed = variables.some(v => !/^\d+$/.test(v));
    if (hasPositional && hasNamed) return 'mixed';
    if (hasPositional) return 'positional';
    return 'named';
}

export function BodyEditor({ body, category, onChange, onCategoryChange, error }: BodyEditorProps) {
    const [previousBodyText, setPreviousBodyText] = useState<string | null>(null);
    const [redoBodyText, setRedoBodyText] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const variables = parseVariables(body);
    const isSequenceValid = validateVariableSequence(variables);
    const charCount = body.length;
    const maxChars = 1024;
    
    // Additional variable validation
    const variableFormatType = getVariableFormatType(variables);
    const isMixedFormat = variableFormatType === 'mixed';
    const invalidNamedVars = getInvalidNamedVariables(variables);
    const hasInvalidNames = invalidNamedVars.length > 0;

    // Real-time intent compliance check with scoring
    const compliance = useMemo(() => {
        if (!body.trim()) return null;
        return validateCategoryCompliance(category, body);
    }, [body, category]);

    const insertVariable = (type: 'positional' | 'named') => {
        const textarea = textareaRef.current;
        let insertion = '';

        if (type === 'positional') {
            const numericVars = variables.filter(v => /^\d+$/.test(v)).map(v => parseInt(v, 10));
            const nextNum = numericVars.length > 0 ? Math.max(...numericVars) + 1 : 1;
            insertion = `{{${nextNum}}}`;
        } else {
            insertion = '{{name}}';
        }

        if (textarea) {
            // Insert at cursor position
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newBody = body.substring(0, start) + insertion + body.substring(end);
            onChange(newBody);

            // Restore focus and move cursor
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(start + insertion.length, start + insertion.length);
            }, 0);
        } else {
            // Fallback if ref is missing
            onChange(body + insertion);
        }
    };

    const handleSwitchCategory = () => {
        if (compliance?.suggestedCategory && onCategoryChange) {
            onCategoryChange(compliance.suggestedCategory);
        }
    };

    const handleAiRewrite = (newBody: string) => {
        setPreviousBodyText(body);
        setRedoBodyText(null);
        onChange(newBody);
    };

    const handleUndo = () => {
        if (previousBodyText !== null) {
            setRedoBodyText(body);
            onChange(previousBodyText);
            setPreviousBodyText(null);
        }
    };

    const handleRedo = () => {
        if (redoBodyText !== null) {
            setPreviousBodyText(body);
            onChange(redoBodyText);
            setRedoBodyText(null);
        }
    };

    const handleManualChange = (value: string) => {
        onChange(value);
        // If user manually types, we clear redo history because the chain is broken
        // We keep previousBodyText so they can still undo the AI change if they want
        setRedoBodyText(null);
    };

    // Get badge style
    const badgeStyle = compliance ? getConfidenceBadgeStyle(compliance.confidenceBadge) : null;

    return (
        <div className="space-y-3">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                    Message Body <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                    {/* Undo Option */}
                    {previousBodyText !== null && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleUndo}
                            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Undo last AI rewrite"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Undo
                        </Button>
                    )}

                    {/* Redo Option */}
                    {redoBodyText !== null && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleRedo}
                            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                            title="Redo AI rewrite"
                        >
                            <RotateCw className="w-3.5 h-3.5" />
                            Redo
                        </Button>
                    )}

                    {/* AI Rewrite Button */}
                    <CategoryRewriteButton
                        body={body}
                        category={category}
                        onRewrite={handleAiRewrite}
                        onCategoryChange={onCategoryChange}
                        disabled={!body.trim()}
                    />
                    <span className={`text-xs ${charCount > maxChars ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {charCount}/{maxChars}
                    </span>
                </div>
            </div>

            {/* Category helper text */}
            <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                {getCategoryHelperText(category)}
            </p>

            <Textarea
                ref={textareaRef}
                placeholder="Enter your message body. Use {{name}}, {{order_id}}, or {{1}} for dynamic variables."
                value={body}
                onChange={(e) => handleManualChange(e.target.value)}
                rows={6}
                className={`font-mono text-sm ${error || (compliance && !compliance.isCompliant && !compliance.allowUserOverride) ? 'border-destructive' : ''}`}
            />

            {/* Confidence Badge with Scores */}
            {compliance && body.trim() && (
                <div className="flex items-center justify-between flex-wrap gap-2">
                    {/* Confidence badge */}
                    {badgeStyle && (
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${badgeStyle.bgColor} ${badgeStyle.color}`}>
                            {badgeStyle.label}
                        </span>
                    )}

                    {/* Score breakdown */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>U: <strong className="text-green-600">{compliance.scores.utility}</strong></span>
                        <span>M: <strong className="text-red-600">{compliance.scores.marketing}</strong></span>
                        <span>A: <strong className="text-blue-600">{compliance.scores.authentication}</strong></span>
                    </div>
                </div>
            )}

            {/* User message from intent detection */}
            {compliance && body.trim() && (
                <>
                    {/* Non-compliant: Error state */}
                    {!compliance.isCompliant && (
                        <Alert variant="destructive" className="py-2">
                            <AlertTriangle className="w-4 h-4" />
                            <AlertDescription className="text-sm">
                                <p className="font-medium">{compliance.message}</p>
                                {compliance.violations.length > 0 && (
                                    <ul className="mt-1 text-xs space-y-0.5">
                                        {compliance.violations.slice(0, 3).map((v, i) => (
                                            <li key={i}>{v.detail}</li>
                                        ))}
                                    </ul>
                                )}
                                {compliance.allowUserOverride && (
                                    <p className="mt-2 text-xs opacity-80">
                                        You can still proceed — Meta will make the final decision.
                                    </p>
                                )}
                                {compliance.suggestSwitch && onCategoryChange && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleSwitchCategory}
                                        className="mt-2 gap-1 text-xs h-7"
                                    >
                                        Switch to {compliance.suggestedCategory}
                                        <ArrowRight className="w-3 h-3" />
                                    </Button>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Compliant but mixed intent: Warning state */}
                    {compliance.isCompliant && compliance.confidenceBadge === 'mixed_review' && (
                        <Alert className="py-2 bg-amber-50 border-amber-200">
                            <AlertCircle className="w-4 h-4 text-amber-600" />
                            <AlertDescription className="text-sm text-amber-800">
                                <p>{compliance.userMessage}</p>
                                <p className="text-xs mt-1 opacity-80">
                                    Meta will classify this during review. Your selection will be considered.
                                </p>
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Compliant but low confidence: Info state */}
                    {compliance.isCompliant && compliance.confidenceBadge === 'low_confidence' && (
                        <Alert className="py-2 bg-gray-50 border-gray-200">
                            <Info className="w-4 h-4 text-gray-600" />
                            <AlertDescription className="text-sm text-gray-700">
                                {compliance.userMessage}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Compliant with suggestion: Info state */}
                    {compliance.isCompliant && compliance.suggestSwitch && compliance.message && (
                        <Alert className="py-2 bg-blue-50 border-blue-200">
                            <Info className="w-4 h-4 text-blue-600" />
                            <AlertDescription className="text-sm text-blue-800">
                                <p>{compliance.message}</p>
                                {onCategoryChange && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleSwitchCategory}
                                        className="mt-2 gap-1 text-xs h-7"
                                    >
                                        Switch to {compliance.suggestedCategory}
                                        <ArrowRight className="w-3 h-3" />
                                    </Button>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Strong match: Success state */}
                    {compliance.isCompliant &&
                        (compliance.confidenceBadge === 'strong_utility' ||
                            compliance.confidenceBadge === 'strong_auth' ||
                            (compliance.confidenceBadge === 'strong_marketing' && category === 'MARKETING')) &&
                        !compliance.suggestSwitch && (
                            <Alert className="py-2 bg-green-50 border-green-200">
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                <AlertDescription className="text-sm text-green-800">
                                    {compliance.userMessage}
                                </AlertDescription>
                            </Alert>
                        )}
                </>
            )}

            {/* Variable helper */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                    {variables.length > 0 ? (
                        <>
                            <span className="text-xs text-muted-foreground">Variables:</span>
                            {variables.map(v => (
                                <Badge key={v} variant="secondary" className="font-mono text-xs">
                                    {`{{${v}}}`}
                                </Badge>
                            ))}
                        </>
                    ) : (
                        <span className="text-xs text-muted-foreground">No variables detected</span>
                    )}
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1"
                        >
                            <Plus className="w-3 h-3" />
                            Add Variable
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => insertVariable('positional')}>
                            <code className="mr-2">{`{{1}}`}</code> Positional
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => insertVariable('named')}>
                            <code className="mr-2">{`{{name}}`}</code> Named
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Variable sequence warning */}
            {variables.length > 0 && !isSequenceValid && (
                <Alert variant="destructive" className="py-2">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                        Invalid variables detected. <br />
                        • Numbered variables must be sequential ({`{{1}}, {{2}}`}).<br />
                        • Named variables must be <strong>lowercase</strong> letters, numbers, and underscores only ({`{{name}}`}, not {`{{Name}}`}).
                    </AlertDescription>
                </Alert>
            )}
            
            {/* Mixed variable format error (CRITICAL - Meta rejects this) */}
            {isMixedFormat && (
                <Alert variant="destructive" className="py-2">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                        <strong>🚫 Cannot mix variable formats!</strong><br />
                        You have both positional ({variables.filter(v => /^\d+$/.test(v)).map(v => `{{${v}}}`).join(', ')}) and named ({variables.filter(v => !/^\d+$/.test(v)).map(v => `{{${v}}}`).join(', ')}) variables.<br />
                        <strong>Fix:</strong> Use ONLY one format:
                        <ul className="list-disc list-inside ml-2 mt-1">
                            <li>Named: <code className="bg-red-200 px-1 rounded">{`{{customer_name}}`}</code>, <code className="bg-red-200 px-1 rounded">{`{{order_id}}`}</code></li>
                            <li>OR Positional: <code className="bg-red-200 px-1 rounded">{`{{1}}`}</code>, <code className="bg-red-200 px-1 rounded">{`{{2}}`}</code>, <code className="bg-red-200 px-1 rounded">{`{{3}}`}</code></li>
                        </ul>
                    </AlertDescription>
                </Alert>
            )}
            
            {/* Invalid named variable format */}
            {hasInvalidNames && !isMixedFormat && (
                <Alert variant="destructive" className="py-2">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription className="text-sm">
                        <strong>Invalid variable names:</strong> {invalidNamedVars.map(v => `{{${v}}}`).join(', ')}<br />
                        <strong>Fix:</strong> Variable names must use only:
                        <ul className="list-disc list-inside ml-2 mt-1">
                            <li>Lowercase letters (a-z)</li>
                            <li>Numbers (0-9)</li>
                            <li>Underscores (_)</li>
                            <li>Cannot start with a number</li>
                        </ul>
                        <strong>Examples:</strong> <code className="bg-red-200 px-1 rounded">{`{{customer_name}}`}</code>, <code className="bg-red-200 px-1 rounded">{`{{order_id}}`}</code>, <code className="bg-red-200 px-1 rounded">{`{{amount1}}`}</code>
                    </AlertDescription>
                </Alert>
            )}
            
            {/* Valid variable format indicator */}
            {variables.length > 0 && isSequenceValid && !isMixedFormat && !hasInvalidNames && (
                <Alert className="py-2 bg-green-50 border-green-200">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <AlertDescription className="text-sm text-green-800">
                        ✅ Variables are valid ({variableFormatType === 'named' ? 'named format' : 'positional format'})
                    </AlertDescription>
                </Alert>
            )}

            {/* Help text */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                    <p>Variables like <code className="bg-muted px-1 rounded">{`{{name}}`}</code> will be replaced with actual values when sending.</p>
                    <p className="mt-1">Example: "Hello {`{{name}}`}, your order {`{{order_id}}`} is confirmed."</p>
                </div>
            </div>

            {error && !variables.length && (
                <p className="text-xs text-destructive">{error}</p>
            )}
        </div>
    );
}
