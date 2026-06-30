// Template Builder Page
// =====================
// Main page for creating/editing WhatsApp templates
// Route: /dashboard/whatsapp/templates/new
// Route: /dashboard/whatsapp/templates/:id/edit

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TemplateForm, TemplateLivePreview } from '../components/builder';
import {
    TemplateState,
    ValidationResult,
    defaultTemplateState,
    validateTemplate,
    buildTemplateApiPayload,
    templateApiToState,
    suggestionToState,
    TemplateSuggestion,
} from '../utils/templateUtils';
import { setStoredAccountId } from '../utils/accountContext';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import logo from '@/assets/sociovia_logo.png';
import { Button } from '@/components/ui/button';
import { API_BASE_URL, WHATSAPP_REST_API_PREFIX } from "@/config";
import { getWorkspaceId } from '../utils/workspaceContext';
import { cachedFetch } from '../utils/waPersistentCache';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_BASE = API_BASE_URL;

interface VoiceCallCapability {
    success: boolean;
    strict_mode: boolean;
    voice_calling_ready: boolean;
    block_template_submission: boolean;
    receive_in_sociovia_dashboard: boolean;
    receive_path?: string;
    warnings?: string[];
}

export function TemplateBuilderPage() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const suggestionId = searchParams.get('suggestion');

    const [state, setState] = useState<TemplateState>(defaultTemplateState);
    const [accountId, setAccountId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [voiceCallCapability, setVoiceCallCapability] = useState<VoiceCallCapability | null>(null);
    const [loadingVoiceCallCapability, setLoadingVoiceCallCapability] = useState(false);
    const [showRiskModal, setShowRiskModal] = useState(false);

    // Fetch the active account on mount
    // Always fetch fresh from API to ensure we use the correct account
    // Filter by workspace_id to ensure multi-tenant isolation
    useEffect(() => {
        const fetchAccount = async () => {
            try {
                // Get workspace_id from storage to filter by current user's workspace
                const workspaceId = getWorkspaceId() || '';
                const wsParam = workspaceId ? `?workspace_id=${workspaceId}` : '';

                const res = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/accounts${wsParam}`, {
                    credentials: 'include',
                });
                const data = await res.json();
                if (data.success && data.accounts?.length > 0) {
                    // Use the first active account for this workspace
                    const activeAccount = data.accounts.find((a: any) => a.is_active) || data.accounts[0];
                    setAccountId(activeAccount.id);
                    setStoredAccountId(activeAccount.id); // Store for other components
                    console.log('[TemplateBuilder] Using account:', activeAccount.id, activeAccount.verified_name || activeAccount.display_phone_number);
                } else {
                    console.warn('[TemplateBuilder] No WhatsApp accounts found for this workspace');
                }
            } catch (err) {
                console.error('[TemplateBuilder] Failed to fetch account:', err);
            }
        };

        fetchAccount();
    }, []);


    // Load template for editing or suggestion for pre-fill
    useEffect(() => {
        const loadInitialData = async () => {
            setIsLoading(true);

            try {
                // Edit mode - load existing template
                if (id) {
                    const res = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/templates/${id}`, {
                        credentials: 'include',
                    });
                    const data = await res.json();

                    if (data.success && data.template) {
                        setState(templateApiToState(data.template));
                    }
                }
                // Pre-fill from suggestion
                else if (suggestionId) {
                    const res = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/template-suggestions`, {
                        credentials: 'include',
                    });
                    const data = await res.json();

                    if (data.success && data.suggestions) {
                        const suggestion = data.suggestions.find(
                            (s: TemplateSuggestion) => s.id === suggestionId
                        );
                        if (suggestion) {
                            setState(suggestionToState(suggestion));
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to load template data:', err);
            } finally {
                setIsLoading(false);
            }
        };

        loadInitialData();
    }, [id, suggestionId]);

    // Validation computed from state
    const validation: ValidationResult = useMemo(() => {
        return validateTemplate(state);
    }, [state]);

    const hasVoiceCallButton = useMemo(
        () => (state.buttons || []).some(btn => btn.type === 'voice_call'),
        [state.buttons]
    );

    const fetchVoiceCallCapability = async (targetAccountId: number) => {
        setLoadingVoiceCallCapability(true);
        try {
            const res = await cachedFetch(
                `${WHATSAPP_REST_API_PREFIX}/accounts/${targetAccountId}/voice-call-capability`,
                { credentials: 'include' }
            );
            const data = await res.json();
            if (data?.success) {
                setVoiceCallCapability(data);
                return data as VoiceCallCapability;
            }
            setVoiceCallCapability(null);
            return null;
        } catch (err) {
            console.error('Failed to fetch voice call capability:', err);
            setVoiceCallCapability(null);
            return null;
        } finally {
            setLoadingVoiceCallCapability(false);
        }
    };

    useEffect(() => {
        if (!accountId || !hasVoiceCallButton) {
            setVoiceCallCapability(null);
            return;
        }
        fetchVoiceCallCapability(accountId);
    }, [accountId, hasVoiceCallButton]);

    // Update state handler
    const handleChange = (updates: Partial<TemplateState>) => {
        setState(prev => ({ ...prev, ...updates }));
    };

    // Submit handler
    const handleSubmit = async () => {
        if (!accountId) {
            toast({
                title: 'No WhatsApp Account',
                description: 'Please connect a WhatsApp account to this workspace before submitting.',
                variant: 'destructive',
            });
            return;
        }

        if (!validation.isValid) {
            setShowRiskModal(true);
            return;
        }

        await executeSubmit();
    };

    const executeSubmit = async () => {
        setIsSubmitting(true);

        try {
            if (hasVoiceCallButton && accountId) {
                const capability = voiceCallCapability || await fetchVoiceCallCapability(accountId);
                if (capability?.block_template_submission && !capability?.voice_calling_ready) {
                    toast({
                        title: 'Call Readiness Required',
                        description: capability.warnings?.[0]
                            || 'VOICE_CALL template is blocked until call readiness checks pass for this account.',
                        variant: 'destructive',
                    });
                    return;
                }
            }

            const payload = buildTemplateApiPayload(state, accountId);

            const res = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (data.success) {
                toast({
                    title: 'Template Submitted!',
                    description: 'Your template has been submitted to Meta for approval. This usually takes 1-24 hours.',
                });

                // Navigate to template manager after submit
                navigate('/dashboard/whatsapp/templates');
            } else {
                // Parse Meta error for user-friendly message
                let errorMessage = data.error || 'Failed to create template';

                // Common Meta error translations
                if (errorMessage.includes('duplicate')) {
                    errorMessage = 'A template with this name already exists. Please choose a different name.';
                } else if (errorMessage.includes('Invalid parameter')) {
                    errorMessage = `Meta rejected the template: ${errorMessage}`;
                }

                // Catalog not connected — show a deeplink to catalog management
                if (data.catalog_required) {
                    toast({
                        title: 'No Catalog Connected',
                        description: 'A product catalog must be connected to your WhatsApp Business Account before using a CATALOG button. Opening Catalog Management…',
                        variant: 'destructive',
                    });
                    setTimeout(() => navigate('/dashboard/whatsapp/catalog'), 1500);
                    return;
                }

                toast({
                    title: 'Submission Failed',
                    description: errorMessage,
                    variant: 'destructive',
                });
            }
        } catch (err) {
            console.error('Template submission error:', err);
            toast({
                title: 'Network Error',
                description: 'Failed to connect to server. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Cancel handler
    const handleCancel = () => {
        navigate(-1);
    };

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading template builder...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-background">
            {/* Page Header */}
            <header className="border-b bg-card px-6 py-3 flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(-1)}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                </Button>
                <div className="h-6 w-px bg-border" />
                <h1 className="text-lg font-semibold flex items-center gap-2">
                    <img src={logo} alt="Sociovia" className="w-5 h-5" />
                    {id ? 'Edit Template' : suggestionId ? 'Create from Suggestion' : 'Create Template'}
                </h1>
            </header>

            {/* Two-panel layout */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Form */}
                <div className="w-1/2 border-r overflow-hidden">
                    <TemplateForm
                        state={state}
                        onChange={handleChange}
                        validation={validation}
                        onSubmit={handleSubmit}
                        onCancel={handleCancel}
                        isSubmitting={isSubmitting}
                        accountId={accountId || undefined}
                        voiceCallCapability={voiceCallCapability}
                        loadingVoiceCallCapability={loadingVoiceCallCapability}
                    />
                </div>

                {/* Right Panel - Preview */}
                <div className="w-1/2 bg-muted/30 overflow-hidden">
                    <TemplateLivePreview state={state} />
                </div>
            </div>

            {/* Warning Dialog Modal */}
            <Dialog open={showRiskModal} onOpenChange={setShowRiskModal}>
                <DialogContent className="sm:max-w-[480px] bg-white border-slate-200 shadow-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-600">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            Meta Guidelines Warning
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 mt-1">
                            Your template does not comply with Meta's official guidelines. Submitting this carries high risk.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Alert className="bg-red-50 text-red-800 border-red-200">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-xs">
                                <strong>Rejection Risk:</strong> Meta's automated screening system will likely reject this template. If Meta rejects too many templates, your account's quality score will be reduced, which may lower your messaging limits.
                            </AlertDescription>
                        </Alert>
                        <div>
                            <p className="text-xs font-semibold text-slate-700">Guidelines violations detected:</p>
                            <ul className="list-disc pl-5 text-xs text-red-600 dark:text-red-400 space-y-1 mt-2">
                                {Object.entries(validation.errors).map(([key, err]) => err && (
                                    <li key={key}><strong>{key.toUpperCase()}:</strong> {err}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <DialogFooter className="flex sm:justify-between gap-2 mt-4">
                        <Button variant="outline" onClick={() => setShowRiskModal(false)} className="text-xs">
                            Cancel & Fix Errors
                        </Button>
                        <Button variant="destructive" onClick={() => { setShowRiskModal(false); executeSubmit(); }} className="text-xs bg-red-600 hover:bg-red-700 text-white">
                            Proceed Anyway at Own Risk
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default TemplateBuilderPage;
