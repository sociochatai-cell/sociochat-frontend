// Template Builder Page
// =====================
// Main page for creating/editing WhatsApp templates
// Route: /dashboard/templates/new
// Route: /dashboard/templates/:id/edit

import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { TemplateForm, TemplateLivePreview } from '../components/builder';
import {
    TemplateState,
    ValidationResult,
    defaultTemplateState,
    validateTemplate,
    buildTemplateApiPayload,
    suggestionToState,
    TemplateSuggestion,
} from '../utils/templateUtils';
import { setStoredAccountId } from '../utils/accountContext';
import { toast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import logo from '@/assets/sociovia_logo.png';
import { Button } from '@/components/ui/button';
import { API_BASE_URL } from "@/config";

const API_BASE = API_BASE_URL;

export function TemplateBuilderPage() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const suggestionId = searchParams.get('suggestion');

    const [state, setState] = useState<TemplateState>(defaultTemplateState);
    const [accountId, setAccountId] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch the active account on mount
    // Always fetch fresh from API to ensure we use the correct account
    // Filter by workspace_id to ensure multi-tenant isolation
    useEffect(() => {
        const fetchAccount = async () => {
            try {
                // Get workspace_id from storage to filter by current user's workspace
                const workspaceId = localStorage.getItem('sv_whatsapp_workspace_id') || sessionStorage.getItem('sv_whatsapp_workspace_id') || '';
                const wsParam = workspaceId ? `?workspace_id=${workspaceId}` : '';

                const res = await fetch(`${API_BASE}/api/whatsapp/accounts${wsParam}`, {
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
                    const res = await fetch(`${API_BASE}/api/whatsapp/templates/${id}`, {
                        credentials: 'include',
                    });
                    const data = await res.json();

                    if (data.success && data.template) {
                        const tpl = data.template;
                        setState({
                            id: tpl.id,
                            name: tpl.name || '',
                            category: tpl.category || 'UTILITY',
                            language: tpl.language || 'en_US',
                            status: tpl.status || 'DRAFT',
                            rejectionReason: tpl.rejection_reason,
                            header: { type: 'text', text: '' }, // Default to text header
                            body: tpl.body_text || '',
                            footer: tpl.footer_text || '',
                            buttons: [], // TODO: Parse from components
                        });
                    }
                }
                // Pre-fill from suggestion
                else if (suggestionId) {
                    const res = await fetch(`${API_BASE}/api/whatsapp/template-suggestions`, {
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

    // Update state handler
    const handleChange = (updates: Partial<TemplateState>) => {
        setState(prev => ({ ...prev, ...updates }));
    };

    // Submit handler
    const handleSubmit = async () => {
        if (!validation.isValid || !accountId) {
            toast({
                title: 'Validation Error',
                description: accountId ? 'Please fix the errors before submitting' : 'No WhatsApp account connected',
                variant: 'destructive',
            });
            return;
        }

        setIsSubmitting(true);

        try {
            const payload = buildTemplateApiPayload(state, accountId);

            const res = await fetch(`${API_BASE}/api/whatsapp/templates`, {
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

                // Navigate back to templates list
                navigate('/dashboard/templates');
            } else {
                // Parse Meta error for user-friendly message
                let errorMessage = data.error || 'Failed to create template';

                // Common Meta error translations
                if (errorMessage.includes('duplicate')) {
                    errorMessage = 'A template with this name already exists. Please choose a different name.';
                } else if (errorMessage.includes('Invalid parameter')) {
                    errorMessage = `Meta rejected the template: ${errorMessage}`;
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
                    />
                </div>

                {/* Right Panel - Preview */}
                <div className="w-1/2 bg-muted/30 overflow-hidden">
                    <TemplateLivePreview state={state} />
                </div>
            </div>
        </div>
    );
}

export default TemplateBuilderPage;
