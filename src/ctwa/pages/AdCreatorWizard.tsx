// Ad Creator Wizard - Multi-step form for CTWA
// =============================================

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from 'lucide-react';
import { createCampaign, publishCampaign, getCTWAAccounts, CreateCampaignData, IceBreaker, AdAccount, FacebookPage, WhatsAppAccountForAds } from '@/ctwa';

// Step definitions
const STEPS = [
    { id: 'accounts', title: 'Accounts', icon: Target },
    { id: 'budget', title: 'Budget & Schedule', icon: DollarSign },
    { id: 'creative', title: 'Creative', icon: ImageIcon },
    { id: 'message', title: 'Message', icon: MessageSquare },
    { id: 'review', title: 'Review', icon: CheckCircle2 },
] as const;

type StepId = typeof STEPS[number]['id'];

interface FormData {
    // Accounts
    ad_account_id: string;
    page_id: string;
    whatsapp_phone_number_id: string;
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
    // Message
    message_type: 'ice_breakers' | 'prefilled';
    ice_breakers: string[];
    prefilled_message: string;
}

const initialFormData: FormData = {
    ad_account_id: '',
    page_id: '',
    whatsapp_phone_number_id: '',
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
    media_type: '',
    media_url: '',
    message_type: 'prefilled',
    ice_breakers: [''],
    prefilled_message: 'Hi! I saw your ad and would like to know more.',
};

export function AdCreatorWizard() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspace_id') || '4';

    const [currentStep, setCurrentStep] = useState<StepId>('accounts');
    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);

    const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setErrors(prev => ({ ...prev, [field]: '' }));
    };

    const validateStep = (): boolean => {
        const newErrors: Record<string, string> = {};

        switch (currentStep) {
            case 'accounts':
                if (!formData.ad_account_id) newErrors.ad_account_id = 'Select an ad account';
                if (!formData.page_id) newErrors.page_id = 'Select a Facebook page';
                if (!formData.whatsapp_phone_number_id) newErrors.whatsapp_phone_number_id = 'Select a WhatsApp number';
                break;
            case 'budget':
                if (!formData.name) newErrors.name = 'Campaign name is required';
                if (!formData.daily_budget || parseFloat(formData.daily_budget) < 100) {
                    newErrors.daily_budget = 'Minimum budget is ₹100';
                }
                break;
            case 'creative':
                if (!formData.primary_text) newErrors.primary_text = 'Primary text is required';
                break;
            case 'message':
                if (formData.message_type === 'ice_breakers') {
                    const validBreakers = formData.ice_breakers.filter(b => b.trim());
                    if (validBreakers.length === 0) newErrors.ice_breakers = 'Add at least one ice breaker';
                } else {
                    if (!formData.prefilled_message) newErrors.prefilled_message = 'Pre-filled message is required';
                }
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
        const iceBreakers: IceBreaker[] = formData.ice_breakers
            .filter(b => b.trim())
            .map(text => ({ text }));

        return {
            workspace_id: workspaceId,
            ad_account_id: formData.ad_account_id,
            name: formData.name,
            daily_budget: parseFloat(formData.daily_budget),
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
            },
            creative: {
                primary_text: formData.primary_text,
                headline: formData.headline || undefined,
                description: formData.description || undefined,
                media_type: formData.media_type || undefined,
                media_url: formData.media_url || undefined,
                ice_breakers: formData.message_type === 'ice_breakers' ? iceBreakers : undefined,
                prefilled_message: formData.message_type === 'prefilled' ? formData.prefilled_message : undefined,
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
                description: `Campaign "${campaign.name}" saved as draft.`,
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
            await publishCampaign(campaign.id, false);
            toast({
                title: 'Published!',
                description: `Campaign "${campaign.name}" published to Meta.`,
            });

            // Trigger Meta/CAPI Tracking Event
            if ((window as any).SocioviaTracker) {
                (window as any).SocioviaTracker.track('CampaignPublished', {
                    content_name: campaign.name,
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
                <h1 className="text-3xl font-bold">Create WhatsApp Ad</h1>
                <p className="text-muted-foreground mt-1">
                    Launch a Click-to-WhatsApp campaign on Facebook and Instagram
                </p>
            </div>

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
                    {currentStep === 'accounts' && (
                        <AccountsStep formData={formData} updateField={updateField} errors={errors} workspaceId={workspaceId} />
                    )}
                    {currentStep === 'budget' && (
                        <BudgetStep formData={formData} updateField={updateField} errors={errors} />
                    )}
                    {currentStep === 'creative' && (
                        <CreativeStep formData={formData} updateField={updateField} errors={errors} />
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
                            <Button variant="outline" onClick={handleSaveDraft} disabled={saving || publishing}>
                                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                Save Draft
                            </Button>
                            <Button onClick={handlePublish} disabled={saving || publishing}>
                                {publishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                                Publish Campaign
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
                    onValueChange={v => updateField('whatsapp_phone_number_id', v)}
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

function BudgetStep({ formData, updateField, errors }: StepProps) {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                    id="name"
                    value={formData.name}
                    onChange={e => updateField('name', e.target.value)}
                    placeholder="e.g., Summer Sale 2025"
                    className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="budget">Daily Budget</Label>
                    <div className="flex">
                        <span className="inline-flex items-center px-3 border border-r-0 rounded-l-md bg-muted text-muted-foreground text-sm">
                            ₹
                        </span>
                        <Input
                            id="budget"
                            type="number"
                            value={formData.daily_budget}
                            onChange={e => updateField('daily_budget', e.target.value)}
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
        </div>
    );
}

function CreativeStep({ formData, updateField, errors }: StepProps) {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="primary_text">Primary Text</Label>
                <Textarea
                    id="primary_text"
                    value={formData.primary_text}
                    onChange={e => updateField('primary_text', e.target.value)}
                    placeholder="Write the main message for your ad..."
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
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                    id="description"
                    value={formData.description}
                    onChange={e => updateField('description', e.target.value)}
                    placeholder="Additional details about your offer..."
                    rows={2}
                />
            </div>

            <div className="space-y-4 pt-4 border-t">
                <Label>Media (Optional)</Label>
                <Tabs
                    value={formData.media_type || 'none'}
                    onValueChange={v => updateField('media_type', v === 'none' ? '' : v as 'image' | 'video')}
                >
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="none">No Media</TabsTrigger>
                        <TabsTrigger value="image">Image</TabsTrigger>
                        <TabsTrigger value="video">Video</TabsTrigger>
                    </TabsList>
                </Tabs>

                {formData.media_type && (
                    <div className="space-y-2">
                        <Label htmlFor="media_url">{formData.media_type === 'image' ? 'Image' : 'Video'} URL</Label>
                        <Input
                            id="media_url"
                            type="url"
                            value={formData.media_url}
                            onChange={e => updateField('media_url', e.target.value)}
                            placeholder={`https://example.com/${formData.media_type}.${formData.media_type === 'image' ? 'jpg' : 'mp4'}`}
                        />
                        <p className="text-xs text-muted-foreground">
                            Must be a publicly accessible HTTPS URL
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function MessageStep({ formData, updateField, errors }: StepProps) {
    const updateIceBreaker = (index: number, value: string) => {
        const newBreakers = [...formData.ice_breakers];
        newBreakers[index] = value;
        updateField('ice_breakers', newBreakers);
    };

    const addIceBreaker = () => {
        if (formData.ice_breakers.length < 3) {
            updateField('ice_breakers', [...formData.ice_breakers, '']);
        }
    };

    const removeIceBreaker = (index: number) => {
        const newBreakers = formData.ice_breakers.filter((_, i) => i !== index);
        updateField('ice_breakers', newBreakers.length ? newBreakers : ['']);
    };

    return (
        <div className="space-y-6">
            <Alert>
                <MessageSquare className="h-4 w-4" />
                <AlertDescription>
                    Choose how customers start the conversation. You can either provide quick reply buttons (ice breakers) or a pre-filled message.
                </AlertDescription>
            </Alert>

            <Tabs
                value={formData.message_type}
                onValueChange={v => updateField('message_type', v as 'ice_breakers' | 'prefilled')}
            >
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="prefilled">Pre-filled Message</TabsTrigger>
                    <TabsTrigger value="ice_breakers">Ice Breakers</TabsTrigger>
                </TabsList>
            </Tabs>

            {formData.message_type === 'prefilled' ? (
                <div className="space-y-2">
                    <Label htmlFor="prefilled">Message customers will send</Label>
                    <Textarea
                        id="prefilled"
                        value={formData.prefilled_message}
                        onChange={e => updateField('prefilled_message', e.target.value)}
                        placeholder="Hi! I saw your ad and would like to know more."
                        rows={3}
                        maxLength={256}
                        className={errors.prefilled_message ? 'border-destructive' : ''}
                    />
                    <div className="flex justify-between">
                        {errors.prefilled_message && <p className="text-sm text-destructive">{errors.prefilled_message}</p>}
                        <p className="text-xs text-muted-foreground ml-auto">{formData.prefilled_message.length}/256</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <Label>Quick Reply Buttons (max 3)</Label>
                        {formData.ice_breakers.length < 3 && (
                            <Button type="button" variant="outline" size="sm" onClick={addIceBreaker}>
                                + Add Button
                            </Button>
                        )}
                    </div>

                    {errors.ice_breakers && <p className="text-sm text-destructive">{errors.ice_breakers}</p>}

                    {formData.ice_breakers.map((breaker, index) => (
                        <div key={index} className="flex gap-2">
                            <Input
                                value={breaker}
                                onChange={e => updateIceBreaker(index, e.target.value)}
                                placeholder={`Option ${index + 1} (e.g., "Tell me about offers")`}
                                maxLength={25}
                            />
                            {formData.ice_breakers.length > 1 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeIceBreaker(index)}
                                    className="text-destructive"
                                >
                                    ×
                                </Button>
                            )}
                        </div>
                    ))}
                    <p className="text-xs text-muted-foreground">Max 25 characters per button</p>
                </div>
            )}
        </div>
    );
}

function ReviewStep({ formData }: { formData: FormData }) {
    const SectionHeader = ({ children }: { children: React.ReactNode }) => (
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">{children}</h4>
    );

    const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
        <div className="flex justify-between py-2 border-b last:border-0">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium text-right">{value || '—'}</span>
        </div>
    );

    return (
        <div className="space-y-6">
            <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                    Review your campaign details before publishing. You can save as draft and edit later.
                </AlertDescription>
            </Alert>

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
                        <span className="max-w-xs truncate">{formData.primary_text}</span>
                    } />
                    <InfoRow label="Headline" value={formData.headline} />
                    <InfoRow label="Media" value={formData.media_type ? (
                        <Badge variant="secondary">{formData.media_type}</Badge>
                    ) : 'None'} />
                </div>
            </div>

            <div className="space-y-4">
                <SectionHeader>Message</SectionHeader>
                <div className="bg-muted/50 rounded-lg p-4">
                    <InfoRow label="Type" value={
                        formData.message_type === 'prefilled' ? 'Pre-filled message' : 'Ice breakers'
                    } />
                    {formData.message_type === 'prefilled' ? (
                        <InfoRow label="Message" value={formData.prefilled_message} />
                    ) : (
                        <InfoRow label="Options" value={
                            <div className="flex flex-wrap gap-1 justify-end">
                                {formData.ice_breakers.filter(b => b).map((b, i) => (
                                    <Badge key={i} variant="outline">{b}</Badge>
                                ))}
                            </div>
                        } />
                    )}
                </div>
            </div>
        </div>
    );
}

export default AdCreatorWizard;
