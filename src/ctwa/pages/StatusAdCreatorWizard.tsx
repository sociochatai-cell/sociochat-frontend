// Status Ad Creator Wizard - Multi-step form for WhatsApp Status Ads
// ==================================================================
// This is a sibling of AdCreatorWizard (Click-to-WhatsApp). It reuses the same
// campaign engine (@/ctwa api + backend /api/ctwa) but PINS the ad placement to
// WhatsApp -> Status, so the ad renders only inside the WhatsApp Updates tab.
//
// The ONLY functional differences vs the CTWA wizard are:
//   1. buildCampaignData() sets ad_type: 'status' + placement { whatsapp/status }
//   2. Creative step enforces the Status format hint (9:16, 1080x1920, <=30s)
//   3. Copy/labels say "Status Ad" instead of "Click-to-WhatsApp Ad"

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import {
    ArrowLeft,
    ArrowRight,
    CheckCircle2,
    Loader2,
    Target,
    Image as ImageIcon,
    MessageSquare,
    Banknote as DollarSign,
    Play,
    Save,
    Megaphone,
    Upload,
    X,
    ExternalLink,
    Sparkles,
    Info,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { createCampaign, publishCampaign, getCTWAAccounts, uploadAdMedia, getAdSettings, CreateCampaignData, AdAccount, FacebookPage, WhatsAppAccountForAds, PlacementSpec } from '@/ctwa';
import { getWorkspaceId } from '@/whatsapp/utils/workspaceContext';
import { AiGenerateDialog } from '@/ctwa/components/AiGenerateDialog';
import { CarouselBuilder } from '@/ctwa/components/CarouselBuilder';
import { TargetingPicker } from '@/ctwa/components/TargetingPicker';

// Placement that makes this a WhatsApp STATUS ad (vs a CTWA ad on FB/IG).
const STATUS_PLACEMENT: PlacementSpec = {
    publisher_platforms: ['whatsapp'],
    whatsapp_positions: ['status'],
};

// CTWA placement options — 'auto' lets Meta optimise (undefined placement).
function ctwaPlacementSpec(mode: 'auto' | 'stories' | 'feeds'): PlacementSpec | undefined {
    if (mode === 'stories') {
        return {
            publisher_platforms: ['facebook', 'instagram'],
            facebook_positions: ['story', 'facebook_reels'],
            instagram_positions: ['story', 'reels'],
        };
    }
    if (mode === 'feeds') {
        return {
            publisher_platforms: ['facebook', 'instagram'],
            facebook_positions: ['feed'],
            instagram_positions: ['stream'],
        };
    }
    return undefined; // auto / Advantage+
}

// Official Meta CTA button types usable with WhatsApp ads.
const CTA_OPTIONS: { value: string; label: string }[] = [
    { value: 'WHATSAPP_MESSAGE', label: 'Send message' },
    { value: 'GET_QUOTE', label: 'Get quote' },
    { value: 'BOOK_TRAVEL', label: 'Book now' },
    { value: 'SHOP_NOW', label: 'Shop now' },
    { value: 'LEARN_MORE', label: 'Learn more' },
    { value: 'CONTACT_US', label: 'Contact us' },
    { value: 'SIGN_UP', label: 'Sign up' },
    { value: 'SUBSCRIBE', label: 'Subscribe' },
];

// Step definitions — the Ad Account / Page / Number are chosen ONCE in Settings,
// so there's no per-ad "Accounts" step anymore.
const STEPS = [
    { id: 'type', title: 'Ad Type', icon: Megaphone },
    { id: 'budget', title: 'Budget & Schedule', icon: DollarSign },
    { id: 'creative', title: 'Creative', icon: ImageIcon },
    { id: 'message', title: 'Options', icon: MessageSquare },
    { id: 'review', title: 'Review', icon: CheckCircle2 },
] as const;

type StepId = typeof STEPS[number]['id'];

interface FormData {
    // Ad type — drives the placement (Status = inside WhatsApp, CTWA = FB/IG)
    ad_type: 'status' | 'ctwa';
    // Accounts
    ad_account_id: string;
    page_id: string;
    whatsapp_phone_number_id: string;
    /** Display number of the selected WhatsApp account (for the wa.me test link). */
    whatsapp_display_number: string;
    // Campaign
    name: string;
    daily_budget: string;
    budget_currency: string;
    start_date: string;
    end_date: string;
    // Targeting
    countries: string[];
    age_min: string;
    age_max: string;
    gender: string;
    // Creative
    primary_text: string;
    headline: string;
    description: string;
    media_type: 'image' | 'video' | '';
    media_url: string;
    // Lead capture
    create_leads: boolean;
    // Official ad options
    cta_type: string;
    budget_type: 'daily' | 'lifetime';
    lifetime_budget: string;
    ctwa_placement: 'auto' | 'stories' | 'feeds';
    // Advanced targeting
    interests: { id: string; name: string }[];
    custom_audiences: { id: string; name: string }[];
    // Carousel cards (2+ makes it a carousel ad)
    cards: { image_url: string; headline?: string; description?: string }[];
}

const initialFormData: FormData = {
    ad_type: 'status',
    ad_account_id: '',
    page_id: '',
    whatsapp_phone_number_id: '',
    whatsapp_display_number: '',
    name: '',
    daily_budget: '500',
    budget_currency: 'INR',
    start_date: '',
    end_date: '',
    countries: ['IN'],
    age_min: '18',
    age_max: '65',
    gender: 'all',
    primary_text: '',
    headline: '',
    description: '',
    // Status ads are visual-first: default to an image creative.
    media_type: 'image',
    media_url: '',
    create_leads: true,
    cta_type: 'WHATSAPP_MESSAGE',
    budget_type: 'daily',
    lifetime_budget: '',
    ctwa_placement: 'auto',
    interests: [],
    custom_audiences: [],
    cards: [],
};

export function StatusAdCreatorWizard() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // Resolve the ACTIVE workspace the way the rest of the app does. Falling back
    // to a hardcoded id (the old '4') caused /api/ctwa/accounts to be called for a
    // workspace the user doesn't own -> 403 blocked_cross_workspace -> "No accounts
    // found". Prefer an explicit ?workspace_id=, then the app-wide stored id.
    const workspaceId = searchParams.get('workspace_id') || getWorkspaceId() || '';

    const [currentStep, setCurrentStep] = useState<StepId>('type');
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [settingsMissing, setSettingsMissing] = useState(false);

    // Load the workspace's saved ad-account setup (chosen once in Settings), so the
    // wizard reuses Ad Account / Page / Number instead of asking every time.
    useEffect(() => {
        if (!workspaceId) return;
        let alive = true;
        getAdSettings(workspaceId)
            .then(s => {
                if (!alive) return;
                if (s && s.ad_account_id && s.page_id && s.whatsapp_phone_number_id) {
                    setFormData(prev => ({
                        ...prev,
                        ad_account_id: s.ad_account_id || '',
                        page_id: s.page_id || '',
                        whatsapp_phone_number_id: s.whatsapp_phone_number_id || '',
                        whatsapp_display_number: s.whatsapp_display_number || '',
                    }));
                    setSettingsMissing(false);
                } else {
                    setSettingsMissing(true);
                }
            })
            .catch(() => setSettingsMissing(true));
        return () => { alive = false; };
    }, [workspaceId]);

    const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
    const isStatus = formData.ad_type === 'status';

    const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setErrors(prev => ({ ...prev, [field]: '' }));
    };

    const validateStep = (): boolean => {
        const newErrors: Record<string, string> = {};

        switch (currentStep) {
            case 'budget':
                if (!formData.name) newErrors.name = 'Campaign name is required';
                if (!formData.daily_budget || parseFloat(formData.daily_budget) < 100) {
                    newErrors.daily_budget = 'Minimum budget is ₹100';
                }
                break;
            case 'creative':
                if (!formData.primary_text) newErrors.primary_text = 'Primary text is required';
                // Status ads are a full-screen placement — media is required.
                if (!formData.media_type || !formData.media_url) {
                    newErrors.media_url = 'Status ads need a full-screen image or video (9:16)';
                }
                break;
            case 'message':
                // Nothing required here now — greeting is number-level, and the
                // lead toggle has a sensible default.
                break;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const nextStep = () => {
        if (validateStep() && currentStepIndex < STEPS.length - 1) {
            setCurrentStep(STEPS[currentStepIndex + 1].id);
        }
    };

    const prevStep = () => {
        if (currentStepIndex > 0) {
            setCurrentStep(STEPS[currentStepIndex - 1].id);
        }
    };

    const buildCampaignData = (): CreateCampaignData => {
        return {
            workspace_id: workspaceId,
            ad_account_id: formData.ad_account_id,
            name: formData.name,
            // >>> The two lines that make this a WhatsApp Status ad <<<
            ad_type: formData.ad_type,
            // Status ads pin placement to WhatsApp Status; Click-to-WhatsApp picks
            // the placement from the CTWA selector (auto / stories / feeds).
            placement: formData.ad_type === 'status'
                ? { ...STATUS_PLACEMENT }
                : ctwaPlacementSpec(formData.ctwa_placement),
            create_leads: formData.create_leads,
            cta_type: formData.cta_type,
            budget_type: formData.budget_type,
            daily_budget: formData.budget_type === 'daily' ? parseFloat(formData.daily_budget) : undefined,
            lifetime_budget: formData.budget_type === 'lifetime' ? parseFloat(formData.lifetime_budget || '0') : undefined,
            budget_currency: formData.budget_currency,
            start_time: formData.start_date ? new Date(formData.start_date).toISOString() : undefined,
            end_time: formData.end_date ? new Date(formData.end_date).toISOString() : undefined,
            page_id: formData.page_id,
            whatsapp_phone_number_id: formData.whatsapp_phone_number_id,
            targeting: {
                geo_locations: { countries: formData.countries },
                age_min: parseInt(formData.age_min),
                age_max: parseInt(formData.age_max),
                genders: formData.gender === 'all' ? [0] : formData.gender === 'male' ? [1] : [2],
                interests: formData.interests.length ? formData.interests : undefined,
                custom_audiences: formData.custom_audiences.length ? formData.custom_audiences : undefined,
            },
            creative: {
                primary_text: formData.primary_text,
                headline: formData.headline || undefined,
                description: formData.description || undefined,
                media_type: formData.media_type || undefined,
                media_url: formData.media_url || undefined,
                // 2+ cards → carousel ad; otherwise the single uploaded creative.
                cards: formData.cards.length >= 2 ? formData.cards : undefined,
                // Opening message + ice breakers live on the WhatsApp NUMBER, not the ad.
            },
        };
    };

    const handleSaveDraft = async () => {
        setSaving(true);
        try {
            const data = buildCampaignData();
            const campaign = await createCampaign(data);
            toast({
                title: 'Draft Saved',
                description: `Status ad "${campaign.name}" saved as draft.`,
            });
            navigate(`/ctwa/campaigns?workspace_id=${workspaceId}`);
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to save',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    };

    const handlePublish = async () => {
        setPublishing(true);
        try {
            const data = buildCampaignData();
            const campaign = await createCampaign(data);
            const published = await publishCampaign(campaign.id, false);
            toast({
                title: 'Published!',
                description: `Status ad "${campaign.name}" published to Meta.`,
            });
            if (published.warning) {
                toast({ title: 'Heads up', description: published.warning });
            }

            // Trigger Meta/CAPI Tracking Event
            if ((window as any).SocioviaTracker) {
                (window as any).SocioviaTracker.track('CampaignPublished', {
                    content_name: campaign.name,
                    content_category: 'whatsapp_status_ad',
                    value: campaign.daily_budget,
                    currency: campaign.budget_currency || 'INR'
                });
            }

            navigate(`/ctwa/campaigns?workspace_id=${workspaceId}`);
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to publish',
                variant: 'destructive',
            });
        } finally {
            setPublishing(false);
        }
    };

    return (
        <div className="container max-w-4xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="mb-8">
                <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                </Button>
                <div className="flex items-center gap-2">
                    <Megaphone className={`w-7 h-7 ${isStatus ? 'text-fuchsia-500' : 'text-blue-500'}`} />
                    <h1 className="text-3xl font-bold">
                        {isStatus ? 'Create WhatsApp Status Ad' : 'Create Click-to-WhatsApp Ad'}
                    </h1>
                </div>
                <p className="text-muted-foreground mt-1">
                    {isStatus
                        ? 'Run a full-screen ad inside the WhatsApp Status feed (Updates tab). Taps open a chat with your WhatsApp number.'
                        : 'Run an ad on Facebook & Instagram with a "Send message" button that opens a WhatsApp chat with you.'}
                </p>
            </div>

            {/* One-time setup required — Ad Account / Page / Number are chosen in Settings */}
            {settingsMissing && (
                <Alert className="mb-6 border-amber-300 bg-amber-50">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-amber-900">
                        Finish your one-time <b>ad account setup</b> first — pick your Ad Account, Page and
                        WhatsApp number in <b>Settings → WhatsApp Ads</b>. Then every ad uses it automatically.
                        <Button
                            variant="link"
                            className="h-auto px-1 text-amber-900 underline"
                            onClick={() => navigate('/dashboard/settings')}
                        >
                            Open Settings
                        </Button>
                    </AlertDescription>
                </Alert>
            )}

            {/* Step Progress */}
            <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
                {STEPS.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = step.id === currentStep;
                    const isCompleted = index < currentStepIndex;

                    return (
                        <div
                            key={step.id}
                            className={`flex items-center ${index > 0 ? 'flex-1' : ''}`}
                        >
                            {index > 0 && (
                                <div
                                    className={`h-1 flex-1 mx-2 rounded ${isCompleted ? 'bg-primary' : 'bg-muted'
                                        }`}
                                />
                            )}
                            <button
                                onClick={() => index <= currentStepIndex && setCurrentStep(step.id)}
                                disabled={index > currentStepIndex}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isActive
                                    ? 'bg-primary text-primary-foreground'
                                    : isCompleted
                                        ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                        : 'bg-muted text-muted-foreground'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="hidden sm:inline text-sm font-medium">{step.title}</span>
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Step Content */}
            <Card>
                <CardHeader>
                    <CardTitle>{STEPS[currentStepIndex].title}</CardTitle>
                    <CardDescription>
                        Step {currentStepIndex + 1} of {STEPS.length}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {currentStep === 'type' && (
                        <TypeStep formData={formData} updateField={updateField} errors={errors} />
                    )}
                    {currentStep === 'budget' && (
                        <BudgetStep formData={formData} updateField={updateField} errors={errors} workspaceId={workspaceId} />
                    )}
                    {currentStep === 'creative' && (
                        <CreativeStep formData={formData} updateField={updateField} errors={errors} workspaceId={workspaceId} />
                    )}
                    {currentStep === 'message' && (
                        <MessageStep formData={formData} updateField={updateField} errors={errors} />
                    )}
                    {currentStep === 'review' && (
                        <ReviewStep formData={formData} />
                    )}
                </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between mt-6">
                <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStepIndex === 0}
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Previous
                </Button>

                <div className="flex gap-3">
                    {currentStep !== 'review' ? (
                        <Button onClick={nextStep}>
                            Next
                            <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={handleSaveDraft} disabled={saving || publishing || settingsMissing}>
                                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Save Draft
                            </Button>
                            <Button onClick={handlePublish} disabled={saving || publishing || settingsMissing}>
                                {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                                Publish Status Ad
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Step Components
// ============================================================

interface StepProps {
    formData: FormData;
    updateField: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
    errors: Record<string, string>;
    workspaceId?: string;
}

// Step 1 — pick what kind of ad this is. This is the ONLY thing that differs
// between the two: it decides the placement (WhatsApp Status vs Facebook/Instagram).
function TypeStep({ formData, updateField }: StepProps) {
    const options = [
        {
            value: 'status' as const,
            title: 'WhatsApp Status Ad',
            desc: 'Full-screen ad shown inside WhatsApp Status (Updates tab). Tapping opens a chat.',
            note: 'Meta also runs it on Instagram Stories (required).',
            ring: 'border-fuchsia-500 ring-fuchsia-500/20 bg-fuchsia-50/50',
            dot: 'text-fuchsia-600',
            tooltip: 'Appears full-screen between people\'s Status updates in the WhatsApp Updates tab. Meta bundles it with Instagram Stories, so it also runs there. Best for reaching people who actively use WhatsApp. Tapping the ad opens a chat with your WhatsApp number.',
        },
        {
            value: 'ctwa' as const,
            title: 'Click-to-WhatsApp Ad',
            desc: 'Ad shown on Facebook & Instagram (feed, stories, reels) with a "Send message" button.',
            note: 'Meta auto-places it across Facebook & Instagram.',
            ring: 'border-blue-500 ring-blue-500/20 bg-blue-50/50',
            dot: 'text-blue-600',
            tooltip: 'Runs across Facebook & Instagram — feed, stories, reels, marketplace and more. Has a "Send message" button that opens a WhatsApp chat with you. This is the widest-reach option; Meta automatically optimises where it shows for the best results.',
        },
    ];

    return (
        <div className="space-y-4">
            <Alert>
                <Megaphone className="h-4 w-4" />
                <AlertDescription>
                    Both types send people into a WhatsApp chat with you. The only difference is
                    <b> where the ad is shown</b>.
                </AlertDescription>
            </Alert>

            {options.map(opt => {
                const selected = formData.ad_type === opt.value;
                return (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => updateField('ad_type', opt.value)}
                        className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                            selected ? `${opt.ring} ring-2` : 'border-muted hover:border-muted-foreground/40'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <Megaphone className={`mt-0.5 h-5 w-5 ${selected ? opt.dot : 'text-muted-foreground'}`} />
                            <div className="flex-1">
                                <div className="flex items-center gap-1.5">
                                    <p className="font-semibold">{opt.title}</p>
                                    <TooltipProvider delayDuration={150}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="inline-flex text-muted-foreground hover:text-foreground"
                                                    aria-label={`About ${opt.title}`}
                                                >
                                                    <Info className="h-4 w-4" />
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                                                {opt.tooltip}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <p className="mt-0.5 text-sm text-muted-foreground">{opt.desc}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{opt.note}</p>
                            </div>
                            {selected && <CheckCircle2 className={`h-5 w-5 ${opt.dot}`} />}
                        </div>
                    </button>
                );
            })}

            {/* Placement control — only for Click-to-WhatsApp (Status is locked). */}
            {formData.ad_type === 'ctwa' && (
                <div className="space-y-2 rounded-lg border p-3">
                    <Label>Where should it show?</Label>
                    <Select
                        value={formData.ctwa_placement}
                        onValueChange={v => updateField('ctwa_placement', v as 'auto' | 'stories' | 'feeds')}
                    >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="auto">Automatic (recommended — Meta optimises)</SelectItem>
                            <SelectItem value="stories">Stories &amp; Reels only</SelectItem>
                            <SelectItem value="feeds">Feeds only</SelectItem>
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        Automatic spreads your budget across all Facebook &amp; Instagram placements for best results.
                    </p>
                </div>
            )}
        </div>
    );
}

function AccountsStep({ formData, updateField, errors, workspaceId }: StepProps) {
    const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
    const [pages, setPages] = useState<FacebookPage[]>([]);
    const [whatsappNumbers, setWhatsappNumbers] = useState<WhatsAppAccountForAds[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!workspaceId) return;
        setLoading(true);
        getCTWAAccounts(workspaceId)
            .then(data => {
                setAdAccounts(data.ad_accounts);
                setPages(data.pages);
                setWhatsappNumbers(data.whatsapp_numbers);
            })
            .catch(() => {
                toast({
                    title: 'Error',
                    description: 'Failed to load accounts. Please refresh.',
                    variant: 'destructive',
                });
            })
            .finally(() => setLoading(false));
    }, [workspaceId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span className="text-muted-foreground">Loading accounts...</span>
            </div>
        );
    }

    if (!adAccounts.length && !pages.length && !whatsappNumbers.length) {
        return (
            <Alert>
                <AlertDescription>
                    No accounts found for this workspace. Please connect a Facebook page, ad account,
                    and WhatsApp number in your workspace settings first.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <div className="space-y-6">
            <Alert>
                <Megaphone className="h-4 w-4" />
                <AlertDescription>
                    Status ads need the same three assets as any WhatsApp ad: an <b>Ad Account</b>,
                    a <b>Facebook Page</b>, and the <b>WhatsApp number</b> people will chat with.
                </AlertDescription>
            </Alert>

            <div className="space-y-2">
                <Label htmlFor="ad_account">Ad Account</Label>
                <Select
                    value={formData.ad_account_id}
                    onValueChange={v => updateField('ad_account_id', v)}
                >
                    <SelectTrigger id="ad_account" className={errors.ad_account_id ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select ad account" />
                    </SelectTrigger>
                    <SelectContent>
                        {adAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>
                                {acc.name} ({acc.id})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {errors.ad_account_id && <p className="text-sm text-destructive">{errors.ad_account_id}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="page">Facebook Page</Label>
                <Select
                    value={formData.page_id}
                    onValueChange={v => updateField('page_id', v)}
                >
                    <SelectTrigger id="page" className={errors.page_id ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select Facebook page" />
                    </SelectTrigger>
                    <SelectContent>
                        {pages.map(page => (
                            <SelectItem key={page.id} value={page.id}>
                                {page.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {errors.page_id && <p className="text-sm text-destructive">{errors.page_id}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp Number</Label>
                <Select
                    value={formData.whatsapp_phone_number_id}
                    onValueChange={v => {
                        updateField('whatsapp_phone_number_id', v);
                        // Remember the display number so the Review step can build a
                        // wa.me test link you can click to verify the redirect.
                        const picked = whatsappNumbers.find(n => n.phone_number_id === v);
                        updateField('whatsapp_display_number', picked?.display_phone_number || '');
                    }}
                >
                    <SelectTrigger id="whatsapp" className={errors.whatsapp_phone_number_id ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select WhatsApp number" />
                    </SelectTrigger>
                    <SelectContent>
                        {whatsappNumbers.map(num => (
                            <SelectItem key={num.phone_number_id} value={num.phone_number_id}>
                                {num.display_phone_number}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {errors.whatsapp_phone_number_id && (
                    <p className="text-sm text-destructive">{errors.whatsapp_phone_number_id}</p>
                )}
            </div>
        </div>
    );
}

function BudgetStep({ formData, updateField, errors, workspaceId }: StepProps) {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                    id="name"
                    value={formData.name}
                    onChange={e => updateField('name', e.target.value)}
                    placeholder="e.g., Diwali Status Ad 2026"
                    className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="space-y-2">
                <Label>Budget type</Label>
                <Select value={formData.budget_type} onValueChange={v => updateField('budget_type', v as 'daily' | 'lifetime')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="daily">Daily budget</SelectItem>
                        <SelectItem value="lifetime">Lifetime budget</SelectItem>
                    </SelectContent>
                </Select>
                {formData.budget_type === 'lifetime' && (
                    <p className="text-xs text-muted-foreground">Lifetime budget requires an <b>end date</b> (set below).</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="budget">{formData.budget_type === 'lifetime' ? 'Lifetime Budget' : 'Daily Budget'}</Label>
                    <div className="flex">
                        <span className="inline-flex items-center px-3 border border-r-0 rounded-l-md bg-muted text-muted-foreground text-sm">
                            ₹
                        </span>
                        <Input
                            id="budget"
                            type="number"
                            value={formData.budget_type === 'lifetime' ? formData.lifetime_budget : formData.daily_budget}
                            onChange={e => updateField(formData.budget_type === 'lifetime' ? 'lifetime_budget' : 'daily_budget', e.target.value)}
                            className={`rounded-l-none ${errors.daily_budget ? 'border-destructive' : ''}`}
                            min="100"
                        />
                    </div>
                    {errors.daily_budget && <p className="text-sm text-destructive">{errors.daily_budget}</p>}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                        value={formData.budget_currency}
                        onValueChange={v => updateField('budget_currency', v)}
                    >
                        <SelectTrigger id="currency">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="INR">INR (₹)</SelectItem>
                            <SelectItem value="USD">USD ($)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date (Optional)</Label>
                    <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={e => updateField('start_date', e.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="end_date">End Date (Optional)</Label>
                    <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={e => updateField('end_date', e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium">Targeting</h4>

                <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label>Age Min</Label>
                        <Select
                            value={formData.age_min}
                            onValueChange={v => updateField('age_min', v)}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {[13, 18, 21, 25, 30, 35, 40, 45, 50, 55, 60].map(age => (
                                    <SelectItem key={age} value={String(age)}>{age}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Age Max</Label>
                        <Select
                            value={formData.age_max}
                            onValueChange={v => updateField('age_max', v)}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {[25, 30, 35, 40, 45, 50, 55, 60, 65].map(age => (
                                    <SelectItem key={age} value={String(age)}>{age}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Gender</Label>
                        <Select
                            value={formData.gender}
                            onValueChange={v => updateField('gender', v)}
                        >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Advanced targeting — interests + saved audiences (optional) */}
            <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                    Advanced targeting — interests &amp; audiences (optional)
                </summary>
                <div className="mt-3">
                    <TargetingPicker
                        workspaceId={workspaceId || ''}
                        value={{ interests: formData.interests, custom_audiences: formData.custom_audiences }}
                        onChange={(next) => {
                            updateField('interests', next.interests);
                            updateField('custom_audiences', next.custom_audiences);
                        }}
                    />
                </div>
            </details>
        </div>
    );
}

function CreativeStep({ formData, updateField, errors, workspaceId }: StepProps) {
    const [uploading, setUploading] = useState(false);
    const [aiImageOpen, setAiImageOpen] = useState(false);
    const [aiCopyOpen, setAiCopyOpen] = useState(false);
    return (
        <div className="space-y-6">
            <Alert>
                <ImageIcon className="h-4 w-4" />
                <AlertDescription>
                    <b>Status ad format:</b> full-screen vertical <b>9:16</b>, recommended
                    <b> 1080 × 1920 px</b>. Video up to <b>30 seconds</b>. This is the same spec as
                    Instagram Story ads.
                </AlertDescription>
            </Alert>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="primary_text">Primary Text</Label>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAiCopyOpen(true)}
                        className="h-7 text-xs"
                    >
                        <Sparkles className="mr-1 h-3.5 w-3.5" /> Generate with AI
                    </Button>
                </div>
                <Textarea
                    id="primary_text"
                    value={formData.primary_text}
                    onChange={e => updateField('primary_text', e.target.value)}
                    placeholder="Write the main message for your Status ad..."
                    rows={3}
                    className={errors.primary_text ? 'border-destructive' : ''}
                    maxLength={125}
                />
                <div className="flex justify-between">
                    {errors.primary_text && <p className="text-sm text-destructive">{errors.primary_text}</p>}
                    <p className="text-xs text-muted-foreground ml-auto">{formData.primary_text.length}/125</p>
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="headline">Headline (Optional)</Label>
                <Input
                    id="headline"
                    value={formData.headline}
                    onChange={e => updateField('headline', e.target.value)}
                    placeholder="Catchy headline for your ad"
                    maxLength={40}
                />
                <p className="text-xs text-muted-foreground">{formData.headline.length}/40</p>
            </div>

            <div className="space-y-2">
                <Label>Button (call to action)</Label>
                <Select value={formData.cta_type} onValueChange={v => updateField('cta_type', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {CTA_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">All options still open a WhatsApp chat — only the button text changes.</p>
            </div>

            <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                    <Label>Creative Media <span className="text-destructive">*</span></Label>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAiImageOpen(true)}
                        className="h-7 text-xs"
                    >
                        <Sparkles className="mr-1 h-3.5 w-3.5" /> Generate with AI
                    </Button>
                </div>

                {formData.media_url ? (
                    /* Preview of the uploaded / linked creative */
                    <div className="relative w-40 rounded-lg overflow-hidden border bg-slate-50">
                        <div className="aspect-[9/16] w-full">
                            {formData.media_type === 'video' ? (
                                <video src={formData.media_url} className="w-full h-full object-cover" muted controls />
                            ) : (
                                <img src={formData.media_url} alt="Ad creative" className="w-full h-full object-cover" />
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => { updateField('media_url', ''); }}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                            aria-label="Remove media"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ) : (
                    /* Upload dropzone */
                    <label
                        className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                            errors.media_url ? 'border-destructive' : 'border-muted-foreground/30 hover:border-primary hover:bg-primary/5'
                        } ${uploading ? 'pointer-events-none opacity-70' : ''}`}
                    >
                        <input
                            type="file"
                            accept="image/*,video/mp4,video/quicktime,video/webm"
                            className="hidden"
                            disabled={uploading}
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setUploading(true);
                                try {
                                    const { url, media_type } = await uploadAdMedia(workspaceId || '', file);
                                    updateField('media_url', url);
                                    updateField('media_type', media_type);
                                    toast({ title: 'Uploaded', description: 'Creative uploaded successfully.' });
                                } catch (err: any) {
                                    toast({
                                        title: 'Upload failed',
                                        description: err?.message === 'storage_not_configured'
                                            ? 'File storage is not configured on the server.'
                                            : (err?.message || 'Could not upload the file.'),
                                        variant: 'destructive',
                                    });
                                } finally {
                                    setUploading(false);
                                    e.target.value = '';
                                }
                            }}
                        />
                        {uploading ? (
                            <><Loader2 className="w-8 h-8 text-primary animate-spin" /><span className="text-sm font-medium">Uploading…</span></>
                        ) : (
                            <>
                                <Upload className="w-8 h-8 text-muted-foreground" />
                                <span className="text-sm font-medium">Click to upload image or video</span>
                                <span className="text-xs text-muted-foreground">Full-screen 9:16 (1080 × 1920), video ≤ 30s. Image ≤ 10MB, video ≤ 60MB.</span>
                            </>
                        )}
                    </label>
                )}

                {errors.media_url && <p className="text-sm text-destructive">{errors.media_url}</p>}

                {/* Fallback: paste a public URL instead of uploading */}
                <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground">Or paste a media URL instead</summary>
                    <Input
                        className="mt-2"
                        type="url"
                        value={formData.media_url}
                        onChange={e => updateField('media_url', e.target.value)}
                        placeholder={`https://example.com/status.${formData.media_type === 'video' ? 'mp4' : 'jpg'}`}
                    />
                </details>
            </div>

            {/* Optional carousel — 2+ cards turns the ad into a swipeable carousel */}
            <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                    Make it a carousel (multiple cards) — optional
                </summary>
                <div className="mt-3">
                    <CarouselBuilder
                        workspaceId={workspaceId || ''}
                        cards={formData.cards}
                        onChange={c => updateField('cards', c)}
                    />
                </div>
            </details>

            {/* AI generators — prompt optional (empty = auto from business details) */}
            <AiGenerateDialog
                open={aiImageOpen}
                onOpenChange={setAiImageOpen}
                mode="image"
                workspaceId={workspaceId || ''}
                adType={formData.ad_type}
                onSelectImage={(url) => {
                    updateField('media_url', url);
                    updateField('media_type', 'image');
                }}
            />
            <AiGenerateDialog
                open={aiCopyOpen}
                onOpenChange={setAiCopyOpen}
                mode="copy"
                workspaceId={workspaceId || ''}
                adType={formData.ad_type}
                onSelectCopy={(v) => {
                    updateField('primary_text', v.primary_text || '');
                    if (v.headline) updateField('headline', v.headline);
                }}
            />
        </div>
    );
}

function MessageStep({ formData, updateField }: StepProps) {
    return (
        <div className="space-y-6">
            <Alert>
                <MessageSquare className="h-4 w-4" />
                <AlertDescription>
                    The ad's only job is to open a WhatsApp chat with your number. The greeting the
                    customer sees is set on your <b>WhatsApp number</b>, not on the ad.
                </AlertDescription>
            </Alert>

            {/* Greeting + ice breakers are NUMBER-level (official WhatsApp API),
                not part of the ads API. */}
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-sm">
                <p className="font-medium text-blue-900">Opening message &amp; ice breakers</p>
                <p className="mt-0.5 text-xs text-blue-800">
                    These are set once on your WhatsApp number and then apply to every first chat —
                    including chats from this ad. Manage them in <b>WhatsApp Automation</b>. They're a
                    WhatsApp-number feature, not an ad setting, so they live there (not here).
                </p>
            </div>

            {/* Lead capture toggle */}
            <div className="flex items-start gap-3 rounded-lg border bg-emerald-50/50 p-3">
                <Checkbox
                    id="create_leads"
                    checked={formData.create_leads}
                    onCheckedChange={(v) => updateField('create_leads', v === true)}
                    className="mt-0.5"
                />
                <div className="grid gap-0.5">
                    <Label htmlFor="create_leads" className="cursor-pointer font-medium">
                        Add people who message from this ad as CRM leads
                    </Label>
                    <p className="text-xs text-muted-foreground">
                        When someone opens a chat from this ad, they're auto-created as a lead in your CRM,
                        tagged with this campaign. Turn off if you don't want ad chats counted as leads.
                    </p>
                </div>
            </div>
        </div>
    );
}

// Custom mockup of how the ad renders inside WhatsApp Status (9:16), so the user
// sees the final look on the last step — no Meta API call needed.
function StatusAdPreview({ formData }: { formData: FormData }) {
    return (
        <div className="mx-auto w-full max-w-[300px]">
            <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl bg-black shadow-xl ring-1 ring-black/10">
                {/* Status progress bar */}
                <div className="absolute top-2 left-3 right-3 z-20 h-[3px] rounded-full bg-white/30">
                    <div className="h-full w-1/3 rounded-full bg-white/90" />
                </div>

                {/* Header: avatar + business name + Ad label */}
                <div className="absolute top-5 left-0 right-0 z-20 flex items-center gap-2 px-3">
                    <ArrowLeft className="w-4 h-4 text-white/90" />
                    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-white/20">
                        <Megaphone className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="leading-tight">
                        <p className="text-xs font-semibold text-white">Your Business</p>
                        <p className="text-[10px] text-white/70">Ad</p>
                    </div>
                    <span className="ml-auto text-lg leading-none text-white/80">⋯</span>
                </div>

                {/* Creative */}
                {formData.media_url ? (
                    formData.media_type === 'video' ? (
                        <video
                            src={formData.media_url}
                            className="absolute inset-0 h-full w-full object-contain"
                            muted autoPlay loop playsInline
                        />
                    ) : (
                        <img
                            src={formData.media_url}
                            alt="Status ad preview"
                            className="absolute inset-0 h-full w-full object-contain"
                        />
                    )
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-white/40">
                        Upload a creative in the Creative step to preview it here
                    </div>
                )}

                {/* Bottom: caption + Send message CTA */}
                <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-12">
                    {formData.primary_text && (
                        <p className="mb-3 text-center text-xs text-white/90 line-clamp-2">
                            {formData.primary_text}
                        </p>
                    )}
                    <div className="w-full rounded-full bg-white py-2.5 text-center text-sm font-semibold text-slate-900 shadow">
                        Send message
                    </div>
                </div>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
                {formData.ad_type === 'status'
                    ? 'Preview — how your ad appears in WhatsApp Status'
                    : 'Preview — how your ad appears in Facebook / Instagram Stories'}
            </p>

            {/* The ad button is always "Send message" → opens a WhatsApp chat with
                your number. The greeting shown there comes from your WhatsApp number. */}
            <div className="mt-3 rounded-lg border bg-white p-3">
                <p className="text-[11px] text-muted-foreground">
                    Tapping <b>“Send message”</b> opens a WhatsApp chat with your business number. The
                    greeting/ice breakers come from your WhatsApp number (WhatsApp Automation).
                </p>
            </div>
        </div>
    );
}

function ReviewStep({ formData }: { formData: FormData }) {
    // Official WhatsApp click-to-chat link (wa.me). Pure deep link — no API call.
    const digits = (formData.whatsapp_display_number || '').replace(/\D/g, '');
    const testLink = digits ? `https://wa.me/${digits}` : '';

    const SectionHeader = ({ children }: { children: React.ReactNode }) => (
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{children}</h4>
    );

    const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
        <div className="flex items-start justify-between gap-4 py-2 border-b last:border-0">
            <span className="shrink-0 text-muted-foreground">{label}</span>
            <span className="min-w-0 flex-1 break-words text-right font-medium">{value || '—'}</span>
        </div>
    );

    return (
        <div className="space-y-6">
            <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                    Review your Status ad before publishing. Placement is locked to
                    <b> WhatsApp → Status</b>. You can save as draft and edit later.
                </AlertDescription>
            </Alert>

            {/* Live preview of how the ad looks in WhatsApp Status */}
            <div className="rounded-xl border bg-slate-50/60 p-6">
                <StatusAdPreview formData={formData} />
            </div>

            <div className="space-y-4">
                <SectionHeader>Placement</SectionHeader>
                <div className="bg-muted/50 rounded-lg p-4">
                    <InfoRow label="Ad type" value={
                        <Badge variant="secondary">
                            {formData.ad_type === 'status' ? 'WhatsApp Status Ad' : 'Click-to-WhatsApp Ad'}
                        </Badge>
                    } />
                    <InfoRow label="Shows on" value={
                        formData.ad_type === 'status'
                            ? 'WhatsApp Status + Instagram Stories'
                            : 'Facebook & Instagram'
                    } />
                    <InfoRow label="Leads" value={formData.create_leads ? 'Auto-add to CRM' : 'Not counted'} />
                </div>
            </div>

            {/* Free click-to-chat test link — same destination the ad button opens */}
            {testLink && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                    <p className="text-sm font-medium">Test the WhatsApp redirect</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        This is the exact link the ad's “Send message” button opens. Clicking it is free —
                        it just opens WhatsApp (no API call, no ad spend, nothing is sent until you press send).
                    </p>
                    <a href={testLink} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block">
                        <Button type="button" variant="outline" size="sm">
                            <ExternalLink className="mr-2 h-4 w-4" /> Open test chat
                        </Button>
                    </a>
                    <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{testLink}</p>
                </div>
            )}

            <div className="space-y-4">
                <SectionHeader>Campaign</SectionHeader>
                <div className="bg-muted/50 rounded-lg p-4">
                    <InfoRow label="Name" value={formData.name} />
                    <InfoRow label="Daily Budget" value={`${formData.budget_currency} ${formData.daily_budget}`} />
                    <InfoRow label="Schedule" value={
                        formData.start_date && formData.end_date
                            ? `${formData.start_date} to ${formData.end_date}`
                            : 'Continuous'
                    } />
                </div>
            </div>

            <div className="space-y-4">
                <SectionHeader>Targeting</SectionHeader>
                <div className="bg-muted/50 rounded-lg p-4">
                    <InfoRow label="Location" value={formData.countries.join(', ')} />
                    <InfoRow label="Age" value={`${formData.age_min} - ${formData.age_max}`} />
                    <InfoRow label="Gender" value={formData.gender === 'all' ? 'All' : formData.gender} />
                </div>
            </div>

            <div className="space-y-4">
                <SectionHeader>Creative</SectionHeader>
                <div className="bg-muted/50 rounded-lg p-4">
                    <InfoRow label="Primary Text" value={
                        <span className="line-clamp-3">{formData.primary_text}</span>
                    } />
                    <InfoRow label="Headline" value={formData.headline} />
                    <InfoRow label="Media" value={formData.media_type ? (
                        <Badge variant="secondary">{formData.media_type}</Badge>
                    ) : 'None'} />
                </div>
            </div>

            <div className="space-y-4">
                <SectionHeader>Options</SectionHeader>
                <div className="bg-muted/50 rounded-lg p-4">
                    <InfoRow label="Leads from this ad" value={formData.create_leads ? 'Auto-add to CRM' : 'Not counted'} />
                    <InfoRow label="Opening message" value="Handled by your WhatsApp number" />
                </div>
            </div>
        </div>
    );
}

export default StatusAdCreatorWizard;
