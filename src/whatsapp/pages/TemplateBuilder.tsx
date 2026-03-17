// TemplateBuilder.tsx
// ======================
// WhatsApp Template Builder with Live Validation & AI Rewrite
// Features: Confidence scoring, Fast Path Badge, Intent Detection, Optimistic Submission

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
    Zap, AlertTriangle, CheckCircle, XCircle, Loader2,
    Sparkles, RefreshCw, Send, ArrowLeft, Info, Clock,
    MessageCircle, Shield, Target
} from 'lucide-react';
import { API_BASE_URL } from "@/config";

const API_BASE = API_BASE_URL;

// Types
interface ValidationResult {
    confidence_score: number;
    risk_flags: string[];
    approval_path: string;
    detected_intent: string;
    suggestions: string[];
    show_fast_path_badge: boolean;
    intent_mismatch: boolean;
    intent_mismatch_message: string | null;
}

interface RewriteResult {
    rewritten_body: string;
    changes_made: string[];
    preserved_variables: string[];
    intent_warning: string | null;
    success: boolean;
    error: string | null;
}

interface SubmissionProgress {
    stage: 'idle' | 'submitting' | 'validating' | 'checking' | 'finalizing' | 'complete' | 'error';
    message: string;
    progress: number;
}

// Confidence Score Component
function ConfidenceScore({ score, showBadge, approvalPath }: {
    score: number;
    showBadge: boolean;
    approvalPath: string;
}) {
    const getColor = () => {
        if (score >= 90) return 'text-green-500';
        if (score >= 75) return 'text-yellow-500';
        if (score >= 60) return 'text-orange-500';
        return 'text-red-500';
    };

    const getBgColor = () => {
        if (score >= 90) return 'bg-green-500';
        if (score >= 75) return 'bg-yellow-500';
        if (score >= 60) return 'bg-orange-500';
        return 'bg-red-500';
    };

    const getLabel = () => {
        if (score >= 90) return 'Very likely instant';
        if (score >= 75) return 'Likely fast';
        if (score >= 60) return 'May take longer';
        return 'Needs improvement';
    };

    const getApprovalPathLabel = () => {
        switch (approvalPath) {
            case 'AUTOMATED_FAST': return 'Usually approves in seconds';
            case 'AUTOMATED_SLOW': return 'Usually approves in 1-2 minutes';
            case 'AUTOMATED_EXTENDED': return 'Extended automated checks (normal for new accounts)';
            case 'LIKELY_MANUAL_REVIEW': return 'May require additional review';
            default: return '';
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Approval Confidence</span>
                <span className={`text-2xl font-bold ${getColor()}`}>{score}</span>
            </div>

            <Progress value={score} className={`h-2 ${getBgColor()}`} />

            <div className="flex items-center justify-between">
                <span className={`text-sm ${getColor()}`}>{getLabel()}</span>
                {showBadge && (
                    <Badge className="bg-gradient-to-r from-amber-400 to-amber-600 text-white gap-1">
                        <Zap className="w-3 h-3" />
                        Optimized for instant
                    </Badge>
                )}
            </div>

            <p className="text-xs text-muted-foreground">{getApprovalPathLabel()}</p>
        </div>
    );
}

// Submission Progress Component
function SubmissionProgressUI({ progress }: { progress: SubmissionProgress }) {
    const getIcon = () => {
        switch (progress.stage) {
            case 'submitting': return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
            case 'validating': return <Shield className="w-5 h-5 text-blue-500 animate-pulse" />;
            case 'checking': return <Target className="w-5 h-5 text-blue-500 animate-pulse" />;
            case 'finalizing': return <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />;
            case 'complete': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'error': return <XCircle className="w-5 h-5 text-red-500" />;
            default: return null;
        }
    };

    if (progress.stage === 'idle') return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
                <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                        {getIcon()}
                        <p className="font-medium">{progress.message}</p>
                        {progress.stage !== 'complete' && progress.stage !== 'error' && (
                            <Progress value={progress.progress} className="w-full" />
                        )}
                        {progress.stage === 'complete' && (
                            <Badge className="bg-green-500">🎉 Approved! Ready to send.</Badge>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Main Template Builder Component
export default function TemplateBuilder() {
    const navigate = useNavigate();
    const [accountId, setAccountId] = useState<number | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [category, setCategory] = useState<'UTILITY' | 'MARKETING' | 'AUTHENTICATION'>('UTILITY');
    const [language, setLanguage] = useState('en_US');
    const [body, setBody] = useState('');
    const [header, setHeader] = useState('');
    const [footer, setFooter] = useState('');

    // Validation state
    const [validation, setValidation] = useState<ValidationResult | null>(null);
    const [validating, setValidating] = useState(false);

    // Rewrite state
    const [rewriteOpen, setRewriteOpen] = useState(false);
    const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(null);
    const [rewriting, setRewriting] = useState(false);
    const [showChanges, setShowChanges] = useState(false);

    // Submission state
    const [submissionProgress, setSubmissionProgress] = useState<SubmissionProgress>({
        stage: 'idle',
        message: '',
        progress: 0,
    });

    // Get account ID from storage
    useEffect(() => {
        const wsId = localStorage.getItem('sv_whatsapp_workspace_id') ||
            sessionStorage.getItem('sv_whatsapp_workspace_id');
        // In a real app, you'd fetch the account for this workspace
        // For now, we'll use a placeholder
        if (wsId) {
            // Fetch account for workspace
            fetch(`${API_BASE}/api/whatsapp/accounts?workspace_id=${wsId}`, { credentials: 'include' })
                .then(res => res.json())
                .then(data => {
                    if (data.accounts && data.accounts.length > 0) {
                        setAccountId(data.accounts[0].id);
                    }
                })
                .catch(console.error);
        }
    }, []);

    // Debounced validation
    const validateTemplate = useCallback(async () => {
        if (!body.trim()) {
            setValidation(null);
            return;
        }

        setValidating(true);
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/templates/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    body,
                    category,
                    header: header || undefined,
                    footer: footer || undefined,
                    language,
                    account_id: accountId,
                }),
            });
            const data = await res.json();
            setValidation(data);
        } catch (err) {
            console.error('Validation error:', err);
        } finally {
            setValidating(false);
        }
    }, [body, category, header, footer, language, accountId]);

    // Auto-validate on change (debounced)
    useEffect(() => {
        const timer = setTimeout(validateTemplate, 500);
        return () => clearTimeout(timer);
    }, [validateTemplate]);

    // AI Rewrite
    const handleRewrite = async () => {
        setRewriting(true);
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/templates/rewrite`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    body,
                    target_category: category,
                    mode: category === 'UTILITY' ? 'neutral_utility' :
                        category === 'AUTHENTICATION' ? 'strict_authentication' : 'clear_marketing',
                    current_category: validation?.detected_intent,
                }),
            });
            const data = await res.json();
            setRewriteResult(data);
            setRewriteOpen(true);
        } catch (err) {
            console.error('Rewrite error:', err);
        } finally {
            setRewriting(false);
        }
    };

    // Apply rewrite
    const applyRewrite = () => {
        if (rewriteResult?.rewritten_body) {
            setBody(rewriteResult.rewritten_body);
            setRewriteOpen(false);
            setRewriteResult(null);
        }
    };

    // Submit template
    const handleSubmit = async () => {
        if (!accountId) {
            alert('No WhatsApp account linked');
            return;
        }

        if (!name.trim() || !body.trim()) {
            alert('Name and body are required');
            return;
        }

        if (validation && validation.confidence_score < 60) {
            alert('Please address the issues before submitting');
            return;
        }

        // Start optimistic flow
        const stages: Array<{ stage: SubmissionProgress['stage']; message: string; progress: number }> = [
            { stage: 'submitting', message: '✅ Template Submitted', progress: 25 },
            { stage: 'validating', message: '⚡ Validating content...', progress: 50 },
            { stage: 'checking', message: '🔍 Checking compliance...', progress: 75 },
            { stage: 'finalizing', message: '✨ Finalizing approval...', progress: 90 },
        ];

        let currentStage = 0;

        const advanceStage = () => {
            if (currentStage < stages.length) {
                setSubmissionProgress(stages[currentStage]);
                currentStage++;
            }
        };

        advanceStage();
        const stageInterval = setInterval(advanceStage, 2000);

        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/templates/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    account_id: accountId,
                    name,
                    category,
                    language,
                    components: [
                        header ? { type: 'HEADER', format: 'TEXT', text: header } : null,
                        { type: 'BODY', text: body },
                        footer ? { type: 'FOOTER', text: footer } : null,
                    ].filter(Boolean),
                }),
            });

            clearInterval(stageInterval);
            const data = await res.json();

            if (data.success) {
                setSubmissionProgress({
                    stage: 'complete',
                    message: '🎉 Approved! Ready to send.',
                    progress: 100,
                });

                setTimeout(() => {
                    setSubmissionProgress({ stage: 'idle', message: '', progress: 0 });
                    navigate('/dashboard/settings');
                }, 3000);
            } else {
                setSubmissionProgress({
                    stage: 'error',
                    message: data.message || 'Submission failed',
                    progress: 0,
                });

                setTimeout(() => {
                    setSubmissionProgress({ stage: 'idle', message: '', progress: 0 });
                }, 3000);
            }
        } catch (err) {
            clearInterval(stageInterval);
            setSubmissionProgress({
                stage: 'error',
                message: 'Network error. Please try again.',
                progress: 0,
            });

            setTimeout(() => {
                setSubmissionProgress({ stage: 'idle', message: '', progress: 0 });
            }, 3000);
        }
    };

    // Insert variable helper
    const insertVariable = () => {
        const varCount = (body.match(/\{\{\d+\}\}/g) || []).length;
        const nextVar = `{{${varCount + 1}}}`;
        setBody(body + nextVar);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
            <SubmissionProgressUI progress={submissionProgress} />

            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate(-1)}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold">Create Template</h1>
                            <p className="text-muted-foreground">Optimized for fast Meta approval</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Form */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MessageCircle className="w-5 h-5 text-green-500" />
                                    Template Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Name */}
                                <div>
                                    <Label htmlFor="name">Template Name</Label>
                                    <Input
                                        id="name"
                                        value={name}
                                        onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                                        placeholder="order_confirmation"
                                        className="font-mono"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Lowercase letters, numbers, and underscores only
                                    </p>
                                </div>

                                {/* Category */}
                                <div>
                                    <Label>Category</Label>
                                    <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="UTILITY">Utility (Transactional)</SelectItem>
                                            <SelectItem value="MARKETING">Marketing (Promotional)</SelectItem>
                                            <SelectItem value="AUTHENTICATION">Authentication (OTP)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Header */}
                                <div>
                                    <Label htmlFor="header">Header (Optional)</Label>
                                    <Input
                                        id="header"
                                        value={header}
                                        onChange={(e) => setHeader(e.target.value)}
                                        placeholder="Order Update"
                                    />
                                </div>

                                {/* Body */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <Label htmlFor="body">Body</Label>
                                        <Button variant="outline" size="sm" onClick={insertVariable}>
                                            Add Variable {`{{${(body.match(/\{\{\d+\}\}/g) || []).length + 1}}}`}
                                        </Button>
                                    </div>
                                    <Textarea
                                        id="body"
                                        value={body}
                                        onChange={(e) => setBody(e.target.value)}
                                        placeholder="Your order {{1}} has been shipped! Track it here: {{2}}"
                                        className="min-h-[150px] font-mono"
                                    />
                                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                        <span>{body.length} characters</span>
                                        <span>{body.length <= 300 ? '✓ Good length' : '⚠ Consider shortening'}</span>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div>
                                    <Label htmlFor="footer">Footer (Optional)</Label>
                                    <Input
                                        id="footer"
                                        value={footer}
                                        onChange={(e) => setFooter(e.target.value)}
                                        placeholder="Thank you for shopping with us!"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Validation Panel */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-blue-500" />
                                    Approval Check
                                    {validating && <Loader2 className="w-4 h-4 animate-spin" />}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {validation ? (
                                    <>
                                        <ConfidenceScore
                                            score={validation.confidence_score}
                                            showBadge={validation.show_fast_path_badge}
                                            approvalPath={validation.approval_path}
                                        />

                                        {/* Intent Mismatch Warning */}
                                        {validation.intent_mismatch && (
                                            <Alert variant="destructive">
                                                <AlertTriangle className="w-4 h-4" />
                                                <AlertDescription className="text-sm">
                                                    {validation.intent_mismatch_message}
                                                </AlertDescription>
                                            </Alert>
                                        )}

                                        {/* Risk Flags */}
                                        {validation.risk_flags.length > 0 && (
                                            <div className="space-y-2">
                                                <Label className="text-orange-500">Issues Found</Label>
                                                <div className="flex flex-wrap gap-1">
                                                    {validation.risk_flags.map((flag, i) => (
                                                        <Badge key={i} variant="outline" className="text-xs">
                                                            {flag.replace(/_/g, ' ')}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Suggestions */}
                                        {validation.suggestions.length > 0 && (
                                            <div className="space-y-2">
                                                <Label className="text-blue-500">Suggestions</Label>
                                                <ul className="text-sm text-muted-foreground space-y-1">
                                                    {validation.suggestions.map((s, i) => (
                                                        <li key={i} className="flex items-start gap-2">
                                                            <Info className="w-3 h-3 mt-1 flex-shrink-0" />
                                                            {s}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        Start typing to see approval confidence
                                    </p>
                                )}

                                {/* AI Rewrite Button - Context-aware */}
                                {(!validation || validation.confidence_score < 90) && (
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={handleRewrite}
                                        disabled={!body.trim() || rewriting}
                                    >
                                        {rewriting ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-4 h-4 mr-2 text-amber-500" />
                                        )}
                                        {!validation ? 'AI Optimize' :
                                            validation.confidence_score < 60 ? 'Fix issues with AI' :
                                                validation.confidence_score < 85 ? 'Improve approval speed' :
                                                    'Boost to instant'}
                                    </Button>
                                )}

                                {/* Submit Button */}
                                <Button
                                    className="w-full"
                                    onClick={handleSubmit}
                                    disabled={
                                        !name.trim() ||
                                        !body.trim() ||
                                        !validation ||
                                        validation.confidence_score < 60 ||
                                        validation.intent_mismatch
                                    }
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    Submit for Approval
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            {/* AI Rewrite Dialog */}
            <Dialog open={rewriteOpen} onOpenChange={setRewriteOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-amber-500" />
                            AI Optimization
                        </DialogTitle>
                        <DialogDescription>
                            Review the suggested changes before applying
                        </DialogDescription>
                    </DialogHeader>

                    {rewriteResult && (
                        <div className="space-y-4">
                            {rewriteResult.intent_warning && (
                                <Alert variant="destructive">
                                    <AlertTriangle className="w-4 h-4" />
                                    <AlertDescription>{rewriteResult.intent_warning}</AlertDescription>
                                </Alert>
                            )}

                            {rewriteResult.success && (
                                <>
                                    <div>
                                        <Label>Optimized Template</Label>
                                        <div className="mt-2 p-3 bg-muted rounded-md font-mono text-sm">
                                            {rewriteResult.rewritten_body}
                                        </div>
                                    </div>

                                    {rewriteResult.changes_made.length > 0 && (
                                        <div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setShowChanges(!showChanges)}
                                                className="text-muted-foreground"
                                            >
                                                {showChanges ? 'Hide' : 'Show'} Changes Made
                                            </Button>
                                            {showChanges && (
                                                <ul className="mt-2 text-sm space-y-1">
                                                    {rewriteResult.changes_made.map((change, i) => (
                                                        <li key={i} className="flex items-start gap-2">
                                                            <CheckCircle className="w-3 h-3 mt-1 text-green-500" />
                                                            {change}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </>
                            )}

                            {rewriteResult.error && (
                                <Alert variant="destructive">
                                    <XCircle className="w-4 h-4" />
                                    <AlertDescription>{rewriteResult.error}</AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRewriteOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={applyRewrite} disabled={!rewriteResult?.success}>
                            Apply Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
