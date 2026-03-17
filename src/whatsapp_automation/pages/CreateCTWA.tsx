import React, { useState, useCallback, useMemo, useId } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { 
  ArrowLeft,
  ArrowRight,
  MessageCircle,
  Target,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
  Eye,
  Send,
  Facebook
} from 'lucide-react';
import { useCampaignStore } from '@/store/campaignStore';
import { whatsappApi } from '../api';

// Import custom components from whatsapp_automation
import { 
  MultiLocationPicker,
  IceBreakersEditor,
  MediaPicker,
  SelectPageModal,
  type MessageMode,
  type MediaItem,
  type SelectedAccount,
} from '../components';

// Import types from whatsapp_automation
import type {
  Campaign,
  AdSet,
  Creative,
  CTWAConfig,
  IceBreaker,
  AudienceLocation,
  CampaignObjective,
  OptimizationGoal,
  CreateCampaignRequest,
  CreateCampaignResponse,
} from '../types';

// ============================================================
// Constants
// ============================================================

const WIZARD_STEPS = [
  { id: 'campaign', label: 'Campaign', icon: Target },
  { id: 'adset', label: 'Ad Set', icon: Target },
  { id: 'creative', label: 'Creative', icon: ImageIcon },
  { id: 'review', label: 'Review', icon: CheckCircle2 },
] as const;

type WizardStep = typeof WIZARD_STEPS[number]['id'];

const OBJECTIVES: { value: CampaignObjective; label: string; description: string }[] = [
  { value: 'OUTCOME_ENGAGEMENT', label: 'Engagement', description: 'Recommended for CTWA campaigns' },
  { value: 'OUTCOME_LEADS', label: 'Leads', description: 'Generate leads and sign-ups' },
  { value: 'OUTCOME_TRAFFIC', label: 'Traffic', description: 'Drive traffic to your website' },
  { value: 'OUTCOME_AWARENESS', label: 'Awareness', description: 'Reach more people' },
];

const OPTIMIZATION_GOALS: { value: OptimizationGoal; label: string }[] = [
  { value: 'CONVERSATIONS', label: 'Conversations (Recommended for CTWA)' },
  { value: 'LINK_CLICKS', label: 'Link Clicks' },
  { value: 'REACH', label: 'Reach' },
  { value: 'IMPRESSIONS', label: 'Impressions' },
];

// ============================================================
// Utility Functions
// ============================================================

const generateId = () => `ctwa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// ============================================================
// Step Components
// ============================================================

interface CampaignStepProps {
  campaignName: string;
  setCampaignName: (name: string) => void;
  objective: CampaignObjective;
  setObjective: (objective: CampaignObjective) => void;
  selectedAccount: SelectedAccount | null;
  setShowPageModal: (show: boolean) => void;
}

const CampaignStep: React.FC<CampaignStepProps> = ({
  campaignName,
  setCampaignName,
  objective,
  setObjective,
  selectedAccount,
  setShowPageModal,
}) => {
  const componentId = useId();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Campaign Settings</h2>
        <p className="text-muted-foreground">Configure your Click-to-WhatsApp campaign</p>
      </div>

      {/* Account Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Connected Account</CardTitle>
          <CardDescription>
            Select the Facebook Page linked to your WhatsApp Business Account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedAccount ? (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Facebook className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">{selectedAccount.page_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">
                      <MessageCircle className="w-3 h-3 mr-1" />
                      WhatsApp Linked
                    </Badge>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowPageModal(true)}>
                Change
              </Button>
            </div>
          ) : (
            <Button onClick={() => setShowPageModal(true)} className="w-full">
              <Facebook className="w-4 h-4 mr-2" />
              Select Facebook Page
            </Button>
          )}
          
          {!selectedAccount && (
            <p className="text-sm text-destructive mt-2 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              A Facebook Page with linked WhatsApp is required for CTWA ads
            </p>
          )}
        </CardContent>
      </Card>

      {/* Campaign Name */}
      <div className="space-y-2">
        <Label htmlFor={`${componentId}-name`}>Campaign Name</Label>
        <Input
          id={`${componentId}-name`}
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          placeholder="e.g., Summer Sale CTWA Campaign"
        />
      </div>

      {/* Objective Selection */}
      <div className="space-y-3">
        <Label>Campaign Objective</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {OBJECTIVES.map((obj) => (
            <button
              key={obj.value}
              type="button"
              onClick={() => setObjective(obj.value)}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                objective === obj.value
                  ? 'border-primary bg-primary/5'
                  : 'border-muted hover:border-muted-foreground/30'
              }`}
            >
              <div className="font-medium">{obj.label}</div>
              <div className="text-xs text-muted-foreground mt-1">{obj.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Ad Set Step
// ============================================================

interface AdSetStepProps {
  locations: AudienceLocation[];
  setLocations: (locations: AudienceLocation[]) => void;
  dailyBudget: number;
  setDailyBudget: (budget: number) => void;
  optimizationGoal: OptimizationGoal;
  setOptimizationGoal: (goal: OptimizationGoal) => void;
}

const AdSetStep: React.FC<AdSetStepProps> = ({
  locations,
  setLocations,
  dailyBudget,
  setDailyBudget,
  optimizationGoal,
  setOptimizationGoal,
}) => {
  const componentId = useId();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Ad Set Configuration</h2>
        <p className="text-muted-foreground">Define your audience and budget</p>
      </div>

      {/* Audience Targeting */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Audience Targeting</CardTitle>
          <CardDescription>
            Select locations to target with your ads
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MultiLocationPicker
            locations={locations}
            onChange={setLocations}
          />
        </CardContent>
      </Card>

      {/* Budget */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${componentId}-budget`}>Daily Budget (INR)</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">
                  This is the average amount you're willing to spend per day. 
                  Actual spend may vary.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Input
          id={`${componentId}-budget`}
          type="number"
          value={dailyBudget}
          onChange={(e) => setDailyBudget(Number(e.target.value))}
          min={100}
          step={100}
        />
        <p className="text-xs text-muted-foreground">Minimum ₹100 per day</p>
      </div>

      {/* Optimization Goal */}
      <div className="space-y-2">
        <Label htmlFor={`${componentId}-optimization`}>Optimization Goal</Label>
        <Select value={optimizationGoal} onValueChange={(v) => setOptimizationGoal(v as OptimizationGoal)}>
          <SelectTrigger id={`${componentId}-optimization`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPTIMIZATION_GOALS.map((goal) => (
              <SelectItem key={goal.value} value={goal.value}>
                {goal.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Destination Type Notice */}
      <Alert>
        <MessageCircle className="h-4 w-4" />
        <AlertTitle>Destination: WhatsApp</AlertTitle>
        <AlertDescription>
          Users who click your ad will be directed to start a WhatsApp conversation 
          with your business.
        </AlertDescription>
      </Alert>
    </div>
  );
};

// ============================================================
// Creative Step
// ============================================================

interface CreativeStepProps {
  workspaceId: string;
  media: MediaItem[];
  setMedia: (media: MediaItem[]) => void;
  primaryText: string;
  setPrimaryText: (text: string) => void;
  headline: string;
  setHeadline: (headline: string) => void;
  messageMode: MessageMode;
  setMessageMode: (mode: MessageMode) => void;
  iceBreakers: IceBreaker[];
  setIceBreakers: (iceBreakers: IceBreaker[]) => void;
  prefilledMessage: string;
  setPrefilledMessage: (message: string) => void;
}

const CreativeStep: React.FC<CreativeStepProps> = ({
  workspaceId,
  media,
  setMedia,
  primaryText,
  setPrimaryText,
  headline,
  setHeadline,
  messageMode,
  setMessageMode,
  iceBreakers,
  setIceBreakers,
  prefilledMessage,
  setPrefilledMessage,
}) => {
  const componentId = useId();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Ad Creative</h2>
        <p className="text-muted-foreground">Design your ad content and WhatsApp message options</p>
      </div>

      {/* Media Picker */}
      <Card>
        <CardContent className="pt-6">
          <MediaPicker
            workspaceId={workspaceId}
            selectedMedia={media}
            onMediaChange={setMedia}
            maxMedia={5}
          />
        </CardContent>
      </Card>

      {/* Ad Copy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ad Copy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${componentId}-primary`}>Primary Text</Label>
            <textarea
              id={`${componentId}-primary`}
              value={primaryText}
              onChange={(e) => setPrimaryText(e.target.value)}
              placeholder="Write your main ad message..."
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              maxLength={125}
            />
            <p className="text-xs text-muted-foreground text-right">{primaryText.length}/125</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor={`${componentId}-headline`}>Headline (Optional)</Label>
            <Input
              id={`${componentId}-headline`}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Add a catchy headline"
              maxLength={40}
            />
          </div>
        </CardContent>
      </Card>

      {/* CTWA Message Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-500" />
            WhatsApp Message Configuration
          </CardTitle>
          <CardDescription>
            Configure how customers can start a conversation from your ad
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IceBreakersEditor
            mode={messageMode}
            iceBreakers={iceBreakers}
            prefilledMessage={prefilledMessage}
            onModeChange={setMessageMode}
            onIceBreakersChange={setIceBreakers}
            onPrefilledMessageChange={setPrefilledMessage}
          />
        </CardContent>
      </Card>
    </div>
  );
};

// ============================================================
// Review Step
// ============================================================

interface ReviewStepProps {
  campaignName: string;
  objective: CampaignObjective;
  selectedAccount: SelectedAccount | null;
  locations: AudienceLocation[];
  dailyBudget: number;
  optimizationGoal: OptimizationGoal;
  media: MediaItem[];
  primaryText: string;
  headline: string;
  messageMode: MessageMode;
  iceBreakers: IceBreaker[];
  prefilledMessage: string;
  errors: string[];
  payload: CreateCampaignRequest;
}

const ReviewStep: React.FC<ReviewStepProps> = ({
  campaignName,
  objective,
  selectedAccount,
  locations,
  dailyBudget,
  optimizationGoal,
  media,
  primaryText,
  headline,
  messageMode,
  iceBreakers,
  prefilledMessage,
  errors,
  payload,
}) => {
  const [showPayload, setShowPayload] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Review Your Campaign</h2>
        <p className="text-muted-foreground">Verify all settings before publishing</p>
      </div>

      {/* Validation Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Please fix the following errors</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Campaign Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Campaign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{campaignName || 'Not set'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Objective</span>
            <span className="font-medium">{objective}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Account</span>
            <span className="font-medium">{selectedAccount?.page_name || 'Not selected'}</span>
          </div>
        </CardContent>
      </Card>

      {/* Ad Set Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ad Set</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Locations</span>
            <span className="font-medium">{locations.length} location(s)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Daily Budget</span>
            <span className="font-medium">₹{dailyBudget}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Optimization</span>
            <span className="font-medium">{optimizationGoal}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Destination</span>
            <Badge variant="secondary">
              <MessageCircle className="w-3 h-3 mr-1" />
              WhatsApp
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Creative Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Creative</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Media</span>
            <span className="font-medium">{media.length} item(s)</span>
          </div>
          {primaryText && (
            <div>
              <span className="text-muted-foreground text-sm">Primary Text</span>
              <p className="text-sm mt-1 p-2 bg-muted rounded">{primaryText}</p>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Message Type</span>
            <Badge variant="outline">
              {messageMode === 'ice_breakers' ? `${iceBreakers.length} Ice Breakers` : 'Pre-filled Message'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Preview Payload */}
      <div className="space-y-2">
        <Button
          variant="outline"
          onClick={() => setShowPayload(!showPayload)}
          className="w-full"
        >
          <Eye className="w-4 h-4 mr-2" />
          {showPayload ? 'Hide' : 'Preview'} API Payload
        </Button>
        
        {showPayload && (
          <Card>
            <CardContent className="p-4">
              <ScrollArea className="h-64">
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(payload, null, 2)}
                </pre>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

export const CreateCTWA: React.FC<{ workspaceId?: string }> = ({ 
  workspaceId: propWorkspaceId 
}) => {
  const navigate = useNavigate();
  const { id: paramWorkspaceId } = useParams<{ id: string }>();
  const workspaceId = propWorkspaceId || paramWorkspaceId || 'default';
  const { reset: resetStore } = useCampaignStore();

  // Wizard State
  const [currentStep, setCurrentStep] = useState<WizardStep>('campaign');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPageModal, setShowPageModal] = useState(false);

  // Campaign State
  const [campaignName, setCampaignName] = useState('');
  const [objective, setObjective] = useState<CampaignObjective>('OUTCOME_ENGAGEMENT');
  const [selectedAccount, setSelectedAccount] = useState<SelectedAccount | null>(null);

  // Ad Set State
  const [locations, setLocations] = useState<AudienceLocation[]>([]);
  const [dailyBudget, setDailyBudget] = useState(500);
  const [optimizationGoal, setOptimizationGoal] = useState<OptimizationGoal>('CONVERSATIONS');

  // Creative State
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [primaryText, setPrimaryText] = useState('');
  const [headline, setHeadline] = useState('');
  const [messageMode, setMessageMode] = useState<MessageMode>('ice_breakers');
  const [iceBreakers, setIceBreakers] = useState<IceBreaker[]>([]);
  const [prefilledMessage, setPrefilledMessage] = useState('');

  // ============================================================
  // Validation
  // ============================================================

  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    // Campaign validation
    if (!campaignName.trim()) {
      errors.push('Campaign name is required');
    }
    if (!selectedAccount) {
      errors.push('Please select a Facebook Page with linked WhatsApp');
    } else if (!selectedAccount.phone_number_id) {
      errors.push('Selected page must have WhatsApp Business linked');
    }

    // Ad Set validation
    if (locations.length === 0) {
      errors.push('At least one target location is required');
    }
    if (locations.length > 10) {
      errors.push('Maximum 10 locations allowed');
    }
    if (dailyBudget < 100) {
      errors.push('Minimum daily budget is ₹100');
    }

    // Creative validation
    if (media.length === 0) {
      errors.push('At least one image or video is required');
    }
    if (!primaryText.trim()) {
      errors.push('Primary text is required');
    }

    // CTWA message validation
    if (messageMode === 'ice_breakers') {
      if (iceBreakers.length === 0) {
        errors.push('Add at least one ice breaker button');
      }
      if (iceBreakers.some((ib) => !ib.title.trim())) {
        errors.push('All ice breaker buttons must have a label');
      }
      if (iceBreakers.some((ib) => ib.title.length > 20)) {
        errors.push('Ice breaker labels must be 20 characters or less');
      }
    } else {
      if (!prefilledMessage.trim()) {
        errors.push('Pre-filled message is required');
      }
    }

    return errors;
  }, [
    campaignName,
    selectedAccount,
    locations,
    dailyBudget,
    media,
    primaryText,
    messageMode,
    iceBreakers,
    prefilledMessage,
  ]);

  // ============================================================
  // Build Payload
  // ============================================================

  const buildPayload = useCallback((): CreateCampaignRequest => {
    const ctwaConfig: CTWAConfig = {
      is_ctwa: true,
      page_id: selectedAccount?.page_id || '',
      phone_number_id: selectedAccount?.phone_number_id || '',
    };

    if (messageMode === 'ice_breakers') {
      ctwaConfig.ice_breakers = iceBreakers.map((ib) => ({
        id: ib.id,
        title: ib.title.trim(),
        payload: ib.payload?.trim(),
      }));
    } else {
      ctwaConfig.prefilled_message = prefilledMessage.trim();
    }

    return {
      workspace_id: workspaceId,
      campaign: {
        name: campaignName.trim(),
        objective,
        status: 'DRAFT',
      },
      adset: {
        name: `${campaignName.trim()} - Ad Set`,
        daily_budget: dailyBudget * 100, // Convert to cents
        start_time: new Date().toISOString(),
        optimization_goal: optimizationGoal,
        destination_type: 'WHATSAPP',
        targeting: {
          locations: locations,
          age_min: 18,
          age_max: 65,
          gender: 'all',
          interests: [],
        },
      },
      creative: {
        name: `${campaignName.trim()} - Creative`,
        method: 'upload',
        media_urls: media.map((m) => m.url),
        primary_text: primaryText.trim(),
        headline: headline.trim() || undefined,
        call_to_action: 'WHATSAPP_MESSAGE',
        ctwa_config: ctwaConfig,
      },
    };
  }, [
    workspaceId,
    campaignName,
    objective,
    selectedAccount,
    locations,
    dailyBudget,
    optimizationGoal,
    media,
    primaryText,
    headline,
    messageMode,
    iceBreakers,
    prefilledMessage,
  ]);

  // ============================================================
  // Navigation
  // ============================================================

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep);
  const progress = ((stepIndex + 1) / WIZARD_STEPS.length) * 100;

  const canGoNext = useMemo(() => {
    switch (currentStep) {
      case 'campaign':
        return !!campaignName.trim() && !!selectedAccount;
      case 'adset':
        return locations.length > 0 && dailyBudget >= 100;
      case 'creative':
        return media.length > 0 && !!primaryText.trim();
      case 'review':
        return validationErrors.length === 0;
      default:
        return false;
    }
  }, [currentStep, campaignName, selectedAccount, locations, dailyBudget, media, primaryText, validationErrors]);

  const handleNext = useCallback(() => {
    const idx = WIZARD_STEPS.findIndex((s) => s.id === currentStep);
    if (idx < WIZARD_STEPS.length - 1) {
      setCurrentStep(WIZARD_STEPS[idx + 1].id);
    }
  }, [currentStep]);

  const handleBack = useCallback(() => {
    const idx = WIZARD_STEPS.findIndex((s) => s.id === currentStep);
    if (idx > 0) {
      setCurrentStep(WIZARD_STEPS[idx - 1].id);
    }
  }, [currentStep]);

  // ============================================================
  // Submit
  // ============================================================

  const handleSubmit = useCallback(async () => {
    if (validationErrors.length > 0) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = buildPayload();
      
      // Use whatsappApi to create campaign
      const response = await whatsappApi.createCampaign(payload);

      if (!response.success) {
        throw new Error(response.error || 'Failed to create campaign');
      }

      // Success - reset store and navigate
      resetStore();
      navigate(`/campaign/${response.campaign_id}/success`);
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string };
      if (apiErr?.status === 401) {
        setSubmitError('Session expired. Please log in again.');
      } else if (apiErr?.status === 429) {
        setSubmitError('Too many requests. Please wait and try again.');
      } else {
        const errorMsg = apiErr?.message || (err instanceof Error ? err.message : 'Failed to create campaign. Please try again.');
        setSubmitError(errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [validationErrors, buildPayload, resetStore, navigate]);

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold">Create CTWA Campaign</h1>
                <p className="text-sm text-muted-foreground">Click-to-WhatsApp Ads</p>
              </div>
            </div>
            <Badge variant="secondary">
              <MessageCircle className="w-3 h-3 mr-1" />
              CTWA
            </Badge>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="border-b bg-muted/30">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            {WIZARD_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = step.id === currentStep;
              const isCompleted = idx < stepIndex;
              
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => idx <= stepIndex && setCurrentStep(step.id)}
                  disabled={idx > stepIndex}
                  className={`flex items-center gap-2 text-sm transition-colors ${
                    isActive
                      ? 'text-primary font-medium'
                      : isCompleted
                        ? 'text-primary/70 cursor-pointer hover:text-primary'
                        : 'text-muted-foreground'
                  } ${idx > stepIndex ? 'cursor-not-allowed' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isCompleted
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                  </div>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              );
            })}
          </div>
          <Progress value={progress} className="h-1" />
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {currentStep === 'campaign' && (
          <CampaignStep
            campaignName={campaignName}
            setCampaignName={setCampaignName}
            objective={objective}
            setObjective={setObjective}
            selectedAccount={selectedAccount}
            setShowPageModal={setShowPageModal}
          />
        )}

        {currentStep === 'adset' && (
          <AdSetStep
            locations={locations}
            setLocations={setLocations}
            dailyBudget={dailyBudget}
            setDailyBudget={setDailyBudget}
            optimizationGoal={optimizationGoal}
            setOptimizationGoal={setOptimizationGoal}
          />
        )}

        {currentStep === 'creative' && (
          <CreativeStep
            workspaceId={workspaceId}
            media={media}
            setMedia={setMedia}
            primaryText={primaryText}
            setPrimaryText={setPrimaryText}
            headline={headline}
            setHeadline={setHeadline}
            messageMode={messageMode}
            setMessageMode={setMessageMode}
            iceBreakers={iceBreakers}
            setIceBreakers={setIceBreakers}
            prefilledMessage={prefilledMessage}
            setPrefilledMessage={setPrefilledMessage}
          />
        )}

        {currentStep === 'review' && (
          <ReviewStep
            campaignName={campaignName}
            objective={objective}
            selectedAccount={selectedAccount}
            locations={locations}
            dailyBudget={dailyBudget}
            optimizationGoal={optimizationGoal}
            media={media}
            primaryText={primaryText}
            headline={headline}
            messageMode={messageMode}
            iceBreakers={iceBreakers}
            prefilledMessage={prefilledMessage}
            errors={validationErrors}
            payload={buildPayload()}
          />
        )}

        {/* Submit Error */}
        {submitError && (
          <Alert variant="destructive" className="mt-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={stepIndex === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {currentStep === 'review' ? (
            <Button
              onClick={handleSubmit}
              disabled={validationErrors.length > 0 || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Create Campaign
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!canGoNext}>
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Select Page Modal */}
      <SelectPageModal
        isOpen={showPageModal}
        onClose={() => setShowPageModal(false)}
        onSelect={setSelectedAccount}
        requireWhatsApp={true}
        workspaceId={workspaceId}
      />
    </div>
  );
};

export default CreateCTWA;
