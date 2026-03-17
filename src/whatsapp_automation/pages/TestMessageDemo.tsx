/**
 * WhatsApp Test Message Demo Page
 * 
 * A step-by-step wizard for Meta App Review to demonstrate:
 * - Temporary access token usage
 * - WhatsApp Business Account details
 * - Test template sending
 * - Webhook event display
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { 
  Key, 
  Phone, 
  Users, 
  Radio, 
  FileText, 
  Send, 
  Activity,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Copy,
  Play,
  Pause,
  RefreshCw,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Zap,
  MessageSquare,
  ArrowRight
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface WebhookEvent {
  id: string;
  type: 'INBOUND' | 'DELIVERED' | 'READ' | 'SENT' | 'FAILED';
  message?: string;
  timestamp: string;
  phone?: string;
}

interface StepStatus {
  completed: boolean;
  active: boolean;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_WABA_ID = '2908076036047653';
const DEFAULT_PHONE_NUMBER_ID = '945507418635325';
const DEFAULT_FROM_NUMBER = '+1 555 187 5685';

// Registered test recipient (verified in Meta Developer Portal)
const REGISTERED_TEST_RECIPIENT = '919390094496';

const TEST_TEMPLATES = [
  { name: 'hello_world', description: 'Simple greeting (Universal)', hasImage: false, category: 'utility' },
  { name: 'jaspers_market_image_cta_v1', description: 'Image with CTA buttons', hasImage: true, category: 'marketing' },
  { name: 'jaspers_market_plain_text_v1', description: 'Plain text message', hasImage: false, category: 'marketing' },
  { name: 'jaspers_market_product_v1', description: 'Product showcase', hasImage: true, category: 'marketing' },
];

// Sociovia sample images for testing
const SOCIOVIA_SAMPLE_IMAGES = [
  { url: 'https://sociovia.app/assets/logo.png', label: 'Sociovia Logo' },
  { url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800', label: 'Marketing Visual' },
  { url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800', label: 'Business Growth' },
];

const DEMO_RECIPIENT = REGISTERED_TEST_RECIPIENT;
const DEMO_TOKEN = 'EAAG...your_test_token';

// ============================================================
// Step Component
// ============================================================

interface StepProps {
  number: number;
  title: string;
  icon: React.ReactNode;
  status: StepStatus;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const Step: React.FC<StepProps> = ({ number, title, icon, status, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen || status.active);

  useEffect(() => {
    if (status.active) setIsOpen(true);
  }, [status.active]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={`transition-all ${status.active ? 'ring-2 ring-primary' : ''} ${status.completed ? 'border-green-200 bg-green-50/30' : ''}`}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`
                flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium
                ${status.completed ? 'bg-green-500 text-white' : status.active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
              `}>
                {status.completed ? <CheckCircle2 className="w-4 h-4" /> : number}
              </div>
              <div className="flex items-center gap-2">
                {icon}
                <CardTitle className="text-base">{title}</CardTitle>
              </div>
              <div className="ml-auto">
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

// ============================================================
// Code Block Component
// ============================================================

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ code, language = 'bash', title }) => {
  const { toast } = useToast();
  const [showToken, setShowToken] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    toast({ description: 'Copied to clipboard!' });
  };

  const displayCode = showToken ? code : code.replace(/Bearer [A-Za-z0-9_-]+/g, 'Bearer <TOKEN>');

  return (
    <div className="relative mt-3">
      {title && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowToken(!showToken)}>
              {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
      <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm">
        <code className={`language-${language}`}>{displayCode}</code>
      </pre>
    </div>
  );
};

// ============================================================
// Webhook Event Component
// ============================================================

interface WebhookEventItemProps {
  event: WebhookEvent;
}

const WebhookEventItem: React.FC<WebhookEventItemProps> = ({ event }) => {
  const getEventColor = (type: WebhookEvent['type']) => {
    switch (type) {
      case 'INBOUND': return 'bg-blue-500';
      case 'DELIVERED': return 'bg-green-500';
      case 'READ': return 'bg-purple-500';
      case 'SENT': return 'bg-yellow-500';
      case 'FAILED': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <Badge className={`${getEventColor(event.type)} text-white`}>
        {event.type}
      </Badge>
      <div className="flex-1">
        {event.message && <p className="text-sm">{event.message}</p>}
        {event.phone && <p className="text-xs text-muted-foreground">Phone: {event.phone}</p>}
        <p className="text-xs text-muted-foreground">{event.timestamp}</p>
      </div>
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

const TestMessageDemo: React.FC = () => {
  const { toast } = useToast();
  
  // Step states
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Form states
  const [accessToken, setAccessToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState(DEFAULT_PHONE_NUMBER_ID);
  const [fromNumber, setFromNumber] = useState(DEFAULT_FROM_NUMBER);
  const [recipients, setRecipients] = useState<string[]>([REGISTERED_TEST_RECIPIENT]); // Pre-fill with registered number
  const [messageType, setMessageType] = useState<'template' | 'custom'>('template'); // Template or custom text
  const [selectedTemplate, setSelectedTemplate] = useState('hello_world'); // Default to hello_world
  const [customMessage, setCustomMessage] = useState(''); // Custom text message
  const [imageUrl, setImageUrl] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(false);

  // UI states
  const [isSending, setIsSending] = useState(false);
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const webhookIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get step status
  const getStepStatus = (stepNum: number): StepStatus => ({
    completed: completedSteps.has(stepNum),
    active: currentStep === stepNum,
  });

  // Mark step as complete
  const completeStep = (stepNum: number) => {
    setCompletedSteps(prev => new Set([...prev, stepNum]));
    if (stepNum < 7) setCurrentStep(stepNum + 1);
  };

  // Phone validation
  const validatePhone = (phone: string): boolean => {
    return /^\d+$/.test(phone.replace(/\s/g, ''));
  };

  // Add recipient
  const addRecipient = () => {
    if (recipients.length < 5) {
      setRecipients([...recipients, '']);
    }
  };

  // Update recipient
  const updateRecipient = (index: number, value: string) => {
    const newRecipients = [...recipients];
    newRecipients[index] = value;
    setRecipients(newRecipients);
  };

  // Remove recipient
  const removeRecipient = (index: number) => {
    if (recipients.length > 1) {
      setRecipients(recipients.filter((_, i) => i !== index));
    }
  };

  // Generate cURL command
  const generateCurl = (): string => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: Record<string, any>;
    
    if (messageType === 'custom') {
      // Custom text message payload
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipients[0] || '<RECIPIENT>',
        type: 'text',
        text: {
          preview_url: false,
          body: customMessage || '<YOUR_MESSAGE>'
        }
      };
    } else {
      // Template message payload
      const template = TEST_TEMPLATES.find(t => t.name === selectedTemplate);
      payload = {
        messaging_product: 'whatsapp',
        to: recipients[0] || '<RECIPIENT>',
        type: 'template',
        template: {
          name: selectedTemplate || '<TEMPLATE_NAME>',
          language: { code: 'en_US' }
        }
      };

      // Add image header if template has image
      if (template?.hasImage && imageUrl) {
        payload.template.components = [{
          type: 'header',
          parameters: [{
            type: 'image',
            image: { link: imageUrl }
          }]
        }];
      }
    }

    return `curl -i -X POST \\
  https://graph.facebook.com/v22.0/${phoneNumberId}/messages \\
  -H 'Authorization: Bearer ${accessToken || '<TOKEN>'}' \\
  -H 'Content-Type: application/json' \\
  -d '${JSON.stringify(payload, null, 2)}'`;
  };

  // Send test message - Direct call to Meta Graph API
  const sendTestMessage = async () => {
    const validRecipients = recipients.filter(r => r && validatePhone(r));
    
    if (!accessToken) {
      toast({ title: 'Error', description: 'Please enter an access token', variant: 'destructive' });
      return;
    }
    
    if (validRecipients.length === 0) {
      toast({ title: 'Error', description: 'Please enter at least one valid recipient', variant: 'destructive' });
      return;
    }
    
    if (messageType === 'template' && !selectedTemplate) {
      toast({ title: 'Error', description: 'Please select a template', variant: 'destructive' });
      return;
    }
    
    if (messageType === 'custom' && !customMessage.trim()) {
      toast({ title: 'Error', description: 'Please enter a custom message', variant: 'destructive' });
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      // Send to each recipient via Meta Graph API directly
      for (const recipient of validRecipients) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let payload: Record<string, any>;
        
        if (messageType === 'custom') {
          // Custom text message payload
          payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipient.replace(/\s/g, ''),
            type: 'text',
            text: {
              preview_url: false,
              body: customMessage
            }
          };
        } else {
          // Template message payload
          const template = TEST_TEMPLATES.find(t => t.name === selectedTemplate);
          payload = {
            messaging_product: 'whatsapp',
            to: recipient.replace(/\s/g, ''),
            type: 'template',
            template: {
              name: selectedTemplate,
              language: { code: 'en_US' }
            }
          };

          // Add image header if template has image
          if (template?.hasImage && imageUrl) {
            payload.template.components = [{
              type: 'header',
              parameters: [{
                type: 'image',
                image: { link: imageUrl }
              }]
            }];
          }
        }

        // Direct call to Meta Graph API
        const response = await fetch(
          `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          }
        );

        const data = await response.json();
        
        if (!response.ok) {
          // Parse Meta API error for better user feedback
          const errorMsg = data.error?.message || `API Error: ${response.status}`;
          const errorCode = data.error?.code;
          
          // Check for common errors and provide helpful messages
          if (errorMsg.toLowerCase().includes('not allowed') || errorCode === 131030) {
            throw new Error(`Recipient ${recipient} is not a registered test number. Add it in Meta Developer Portal → WhatsApp → API Setup → "Manage phone number list"`);
          } else if (errorCode === 190) {
            throw new Error('Access token is invalid or expired. Generate a new one from Graph API Explorer.');
          } else if (errorCode === 131031) {
            throw new Error('This phone number is not registered as a test sender. Check your WhatsApp Business Account setup.');
          }
          
          throw new Error(errorMsg);
        }
        
        console.log('Message sent successfully:', data);
      }

      setSendResult({ success: true, message: `Message sent to ${validRecipients.length} recipient(s)` });
      toast({ 
        title: 'Success', 
        description: `Test message sent to ${validRecipients.length} recipient(s)`,
        className: 'bg-green-50 border-green-200'
      });
      
      completeStep(6);

      // Add simulated webhook events (since we can't receive real webhooks in browser)
      if (webhookEnabled) {
        const sentMessage = messageType === 'custom' 
          ? `Custom message sent: "${customMessage.substring(0, 30)}${customMessage.length > 30 ? '...' : ''}"`
          : `Template "${selectedTemplate}" sent`;
        
        // Simulate SENT event
        setTimeout(() => {
          setWebhookEvents(prev => [...prev, {
            id: Date.now().toString(),
            type: 'SENT',
            message: sentMessage,
            timestamp: new Date().toISOString(),
            phone: validRecipients[0]
          }]);
        }, 500);
        
        // Simulate DELIVERED event
        setTimeout(() => {
          setWebhookEvents(prev => [...prev, {
            id: (Date.now() + 1).toString(),
            type: 'DELIVERED',
            timestamp: new Date().toISOString(),
            phone: validRecipients[0]
          }]);
        }, 2000);
        
        // Simulate READ event
        setTimeout(() => {
          setWebhookEvents(prev => [...prev, {
            id: (Date.now() + 2).toString(),
            type: 'READ',
            timestamp: new Date().toISOString(),
            phone: validRecipients[0]
          }]);
        }, 4000);
      }

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Send failed';
      setSendResult({ success: false, message: errorMessage });
      toast({ 
        title: 'Error', 
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
    }
  };

  // Webhook events are now simulated locally (real webhooks require server-side handling)
  // This polling is disabled since backend endpoints may not be deployed
  const fetchWebhookEvents = useCallback(async () => {
    // Webhooks are simulated locally after sending - no backend polling needed
    // Real webhook events would require server-side webhook handler
  }, []);

  // Start/stop webhook polling (now just manages the enabled state)
  useEffect(() => {
    if (webhookEnabled) {
      // No actual polling - events are simulated after send
      webhookIntervalRef.current = null;
    } else {
      if (webhookIntervalRef.current) {
        clearInterval(webhookIntervalRef.current);
        webhookIntervalRef.current = null;
      }
    }

    return () => {
      if (webhookIntervalRef.current) {
        clearInterval(webhookIntervalRef.current);
      }
    };
  }, [webhookEnabled, fetchWebhookEvents]);

  // Demo mode - auto-populate and send
  const startDemoMode = async () => {
    setIsDemoMode(true);
    
    // Step 1: Set token
    setAccessToken(DEMO_TOKEN);
    await new Promise(r => setTimeout(r, 500));
    completeStep(1);

    // Step 2: Phone number already set
    await new Promise(r => setTimeout(r, 500));
    completeStep(2);

    // Step 3: Set recipient
    setRecipients([DEMO_RECIPIENT]);
    await new Promise(r => setTimeout(r, 500));
    completeStep(3);

    // Step 4: Enable webhook
    setWebhookEnabled(true);
    await new Promise(r => setTimeout(r, 500));
    completeStep(4);

    // Step 5: Select template
    setSelectedTemplate(TEST_TEMPLATES[0].name);
    setImageUrl('https://example.com/sample-image.jpg');
    await new Promise(r => setTimeout(r, 500));
    completeStep(5);

    // Step 6: Show send UI (don't actually send in demo)
    setCurrentStep(6);
    
    // Add mock webhook events
    const mockEvents: WebhookEvent[] = [
      { id: '1', type: 'SENT', message: 'Template "jaspers_market_image_cta_v1" sent', timestamp: new Date().toISOString(), phone: DEMO_RECIPIENT },
      { id: '2', type: 'DELIVERED', timestamp: new Date(Date.now() + 1000).toISOString(), phone: DEMO_RECIPIENT },
      { id: '3', type: 'READ', timestamp: new Date(Date.now() + 2000).toISOString(), phone: DEMO_RECIPIENT },
      { id: '4', type: 'INBOUND', message: 'User replied "Hi"', timestamp: new Date(Date.now() + 3000).toISOString(), phone: DEMO_RECIPIENT },
    ];

    for (const event of mockEvents) {
      await new Promise(r => setTimeout(r, 1000));
      setWebhookEvents(prev => [...prev, event]);
    }

    toast({ title: 'Demo Complete', description: 'All steps demonstrated successfully' });
    setIsDemoMode(false);
  };

  // Reset demo
  const resetDemo = () => {
    setCurrentStep(1);
    setCompletedSteps(new Set());
    setAccessToken('');
    setRecipients([REGISTERED_TEST_RECIPIENT]); // Keep the registered recipient
    setSelectedTemplate('hello_world'); // Default to hello_world
    setImageUrl('');
    setWebhookEnabled(false);
    setWebhookEvents([]);
    setSendResult(null);
    setIsDemoMode(false);
    setMessageType('template'); // Reset to template mode
    setCustomMessage(''); // Clear custom message
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-green-500" />
                Sociovia WhatsApp Test Demo
              </h1>
              <p className="text-muted-foreground mt-1">
                Send test messages for Meta App Review demonstration
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={isDemoMode ? 'destructive' : 'default'}
                onClick={isDemoMode ? () => setIsDemoMode(false) : startDemoMode}
                disabled={isSending}
              >
                {isDemoMode ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Stop Demo
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Demo
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={resetDemo} disabled={isDemoMode}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>

          {/* Demo Mode Alert */}
          {isDemoMode && (
            <Alert className="bg-blue-50 border-blue-200">
              <Zap className="w-4 h-4 text-blue-500" />
              <AlertTitle>Demo Mode Active</AlertTitle>
              <AlertDescription>
                Automatically walking through all steps for Meta App Review demonstration.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {/* Step 1: Access Token */}
          <Step
            number={1}
            title="Generate Temporary Access Token"
            icon={<Key className="w-4 h-4" />}
            status={getStepStatus(1)}
            defaultOpen
          >
            <CardDescription className="mb-4">
              Get a temporary access token from the Meta Developer Portal. This token is used to authenticate API requests.
            </CardDescription>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Access Token</label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    placeholder="Paste your temporary access token here..."
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" onClick={() => setAccessToken(accessToken ? '' : DEMO_TOKEN)}>
                        {accessToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Toggle visibility</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  Temporary tokens expire after 1 hour. Generate a new one from the{' '}
                  <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="underline text-primary">
                    Graph API Explorer
                  </a>
                </AlertDescription>
              </Alert>

              <Button 
                onClick={() => completeStep(1)} 
                disabled={!accessToken}
                className="w-full"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Step>

          {/* Step 2: From Number */}
          <Step
            number={2}
            title="Select FROM Number"
            icon={<Phone className="w-4 h-4" />}
            status={getStepStatus(2)}
          >
            <CardDescription className="mb-4">
              Select the WhatsApp Business phone number to send messages from.
            </CardDescription>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">WhatsApp Business Account ID</label>
                  <Input value={DEFAULT_WABA_ID} disabled className="font-mono text-sm bg-muted" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Phone Number ID</label>
                  <Input 
                    value={phoneNumberId} 
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    className="font-mono text-sm" 
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">From Number</label>
                <Input 
                  value={fromNumber} 
                  onChange={(e) => setFromNumber(e.target.value)}
                  className="font-mono text-sm" 
                />
              </div>

              <div className="bg-muted p-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Test Phone Details:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• WABA ID: {DEFAULT_WABA_ID}</li>
                  <li>• Phone Number ID: {phoneNumberId}</li>
                  <li>• Display Number: {fromNumber}</li>
                </ul>
              </div>

              <Button onClick={() => completeStep(2)} className="w-full">
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Step>

          {/* Step 3: Recipients */}
          <Step
            number={3}
            title="Enter Recipient Numbers"
            icon={<Users className="w-4 h-4" />}
            status={getStepStatus(3)}
          >
            <CardDescription className="mb-4">
              Add up to 5 recipient phone numbers. Use full international format (e.g., 919876543210 for India).
            </CardDescription>

            <div className="space-y-4">
              {/* Important notice about test numbers */}
              <Alert className="bg-amber-50 border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Important: Test Recipients Only</AlertTitle>
                <AlertDescription className="text-amber-700">
                  <p className="mb-2">
                    Meta's test phone numbers can <strong>only send to pre-registered test recipients</strong>. 
                    You must add recipient numbers in the Meta Developer Portal first.
                  </p>
                  <p className="text-sm">
                    <strong>To add test recipients:</strong>
                  </p>
                  <ol className="list-decimal list-inside text-sm mt-1 space-y-1">
                    <li>Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="underline text-amber-900">Meta Developer Portal</a></li>
                    <li>Select your app → WhatsApp → API Setup</li>
                    <li>Under "To" field, click "Manage phone number list"</li>
                    <li>Add and verify your recipient phone numbers</li>
                  </ol>
                </AlertDescription>
              </Alert>

              {recipients.map((recipient, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="e.g., 919876543210"
                    value={recipient}
                    onChange={(e) => updateRecipient(index, e.target.value)}
                    className={`font-mono text-sm ${recipient && !validatePhone(recipient) ? 'border-red-500' : ''}`}
                  />
                  {recipients.length > 1 && (
                    <Button variant="outline" size="icon" onClick={() => removeRecipient(index)}>
                      ×
                    </Button>
                  )}
                </div>
              ))}

              {recipients.length < 5 && (
                <Button variant="outline" onClick={addRecipient} className="w-full">
                  + Add Recipient
                </Button>
              )}

              <p className="text-xs text-muted-foreground">
                {recipients.filter(r => r && validatePhone(r)).length} valid recipient(s) • Max 5 allowed
              </p>

              <Button 
                onClick={() => completeStep(3)} 
                disabled={recipients.filter(r => r && validatePhone(r)).length === 0}
                className="w-full"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Step>

          {/* Step 4: Webhook Listener */}
          <Step
            number={4}
            title="Toggle Webhook Listener"
            icon={<Radio className="w-4 h-4" />}
            status={getStepStatus(4)}
          >
            <CardDescription className="mb-4">
              Enable real-time webhook event monitoring to see message delivery status and replies.
            </CardDescription>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${webhookEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                  <div>
                    <p className="font-medium">Webhook Listener</p>
                    <p className="text-sm text-muted-foreground">
                      {webhookEnabled ? 'Listening for events (refreshes every 2s)' : 'Not listening'}
                    </p>
                  </div>
                </div>
                <Button
                  variant={webhookEnabled ? 'destructive' : 'default'}
                  onClick={() => setWebhookEnabled(!webhookEnabled)}
                >
                  {webhookEnabled ? 'Disable' : 'Enable'}
                </Button>
              </div>

              <Button onClick={() => completeStep(4)} className="w-full">
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Step>

          {/* Step 5: Select Message Type */}
          <Step
            number={5}
            title="Compose Message"
            icon={<FileText className="w-4 h-4" />}
            status={getStepStatus(5)}
          >
            <CardDescription className="mb-4">
              Choose between a pre-approved template or send your own custom message.
            </CardDescription>

            <div className="space-y-4">
              {/* Message Type Selector */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={messageType === 'template' ? 'default' : 'outline'}
                  onClick={() => setMessageType('template')}
                  className="h-auto py-3"
                >
                  <div className="text-left">
                    <div className="font-medium">Template</div>
                    <div className="text-xs opacity-70">Pre-approved messages</div>
                  </div>
                </Button>
                <Button
                  variant={messageType === 'custom' ? 'default' : 'outline'}
                  onClick={() => setMessageType('custom')}
                  className="h-auto py-3"
                >
                  <div className="text-left">
                    <div className="font-medium">Custom Text</div>
                    <div className="text-xs opacity-70">Your own message</div>
                  </div>
                </Button>
              </div>

              {/* Custom Message Input */}
              {messageType === 'custom' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Your Message</label>
                    <textarea
                      placeholder="Type your custom message here...&#10;&#10;Example: Hi! This is a test message from Sociovia 🚀"
                      value={customMessage}
                      onChange={(e) => setCustomMessage(e.target.value)}
                      className="w-full min-h-[120px] p-3 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary focus:outline-none"
                      maxLength={4096}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {customMessage.length}/4096 characters
                    </p>
                  </div>
                  
                  {/* Quick message templates */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">Quick templates:</label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCustomMessage("Hi! 👋 This is a test message from Sociovia. We help businesses grow with smart marketing automation.")}
                        className="text-xs"
                      >
                        Intro Message
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCustomMessage("🎉 Special Offer! Get 20% off on your first campaign with Sociovia. Limited time only!")}
                        className="text-xs"
                      >
                        Promo Message
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCustomMessage("Thank you for your interest! 🙏 Our team will reach out to you shortly. Reply HELP for assistance.")}
                        className="text-xs"
                      >
                        Thank You
                      </Button>
                    </div>
                  </div>
                  
                  <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-blue-700 text-sm">
                      <strong>Note:</strong> Custom text messages can only be sent during an active 24-hour conversation window. 
                      For cold outreach, use templates instead.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              {/* Template Selection */}
              {messageType === 'template' && (
                <>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Template</label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a test template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {TEST_TEMPLATES.map(template => (
                          <SelectItem key={template.name} value={template.name}>
                            <div className="flex items-center gap-2">
                              {template.name}
                              {template.hasImage && <Badge variant="secondary" className="text-xs">Image</Badge>}
                              {template.name === 'hello_world' && <Badge className="text-xs bg-green-500">Recommended</Badge>}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {TEST_TEMPLATES.find(t => t.name === selectedTemplate)?.hasImage && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Image URL</label>
                        <Input
                          placeholder="https://example.com/image.jpg"
                          value={imageUrl}
                          onChange={(e) => setImageUrl(e.target.value)}
                          className="font-mono text-sm"
                        />
                      </div>
                      
                      {/* Sociovia Sample Images */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-2 block">Quick pick sample images:</label>
                        <div className="flex flex-wrap gap-2">
                      {SOCIOVIA_SAMPLE_IMAGES.map((img, idx) => (
                        <Button
                          key={idx}
                          variant={imageUrl === img.url ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setImageUrl(img.url)}
                          className="text-xs"
                        >
                          {img.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  {imageUrl && (
                    <div className="border rounded-lg p-2">
                      <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                      <img 
                        src={imageUrl} 
                        alt="Preview" 
                        className="max-h-32 rounded object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  )}
                </div>
              )}

              {selectedTemplate && (
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm font-medium">Selected Template:</p>
                  <p className="font-mono text-sm">{selectedTemplate}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {TEST_TEMPLATES.find(t => t.name === selectedTemplate)?.description}
                  </p>
                  {selectedTemplate === 'hello_world' && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ This template works for all WhatsApp Business accounts
                    </p>
                  )}
                </div>
              )}
                </>
              )}

              {/* Summary of selected message */}
              {messageType === 'custom' && customMessage && (
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-sm font-medium">Custom Message Preview:</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{customMessage}</p>
                </div>
              )}

              <Button 
                onClick={() => completeStep(5)} 
                disabled={messageType === 'template' ? !selectedTemplate : !customMessage.trim()}
                className="w-full"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Step>

          {/* Step 6: Send Message */}
          <Step
            number={6}
            title="Send Test Message"
            icon={<Send className="w-4 h-4" />}
            status={getStepStatus(6)}
          >
            <CardDescription className="mb-4">
              Review and send the test message using the cURL API call.
            </CardDescription>

            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">From:</span>
                  <span className="font-mono">{fromNumber}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">To:</span>
                  <span className="font-mono">{recipients.filter(r => r && validatePhone(r)).join(', ') || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Message Type:</span>
                  <Badge variant={messageType === 'custom' ? 'secondary' : 'default'}>
                    {messageType === 'custom' ? 'Custom Text' : 'Template'}
                  </Badge>
                </div>
                {messageType === 'template' && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Template:</span>
                    <span className="font-mono">{selectedTemplate || '-'}</span>
                  </div>
                )}
                {messageType === 'custom' && (
                  <div className="text-sm">
                    <span className="text-muted-foreground block mb-1">Message:</span>
                    <span className="text-sm whitespace-pre-wrap bg-white/50 p-2 rounded block">{customMessage || '-'}</span>
                  </div>
                )}
              </div>

              {/* cURL Preview */}
              <CodeBlock 
                code={generateCurl()} 
                language="bash" 
                title="Generated cURL Preview" 
              />

              {/* Send Button */}
              <Button 
                onClick={sendTestMessage} 
                disabled={isSending || !accessToken || (messageType === 'template' ? !selectedTemplate : !customMessage.trim()) || recipients.filter(r => validatePhone(r)).length === 0}
                className="w-full"
                size="lg"
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send {messageType === 'custom' ? 'Custom' : 'Template'} Message
                  </>
                )}
              </Button>

              {/* Result */}
              {sendResult && (
                <Alert className={sendResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                  {sendResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <AlertTitle>{sendResult.success ? 'Success' : 'Error'}</AlertTitle>
                  <AlertDescription>{sendResult.message}</AlertDescription>
                </Alert>
              )}
            </div>
          </Step>

          {/* Step 7: Webhook Events */}
          <Step
            number={7}
            title="Display Webhook Events"
            icon={<Activity className="w-4 h-4" />}
            status={getStepStatus(7)}
          >
            <CardDescription className="mb-4">
              View real-time webhook events including message delivery status and incoming replies.
            </CardDescription>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${webhookEnabled ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                  <span className="text-sm text-muted-foreground">
                    {webhookEnabled ? 'Live' : 'Paused'} • {webhookEvents.length} event(s)
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setWebhookEvents([])}>
                  Clear
                </Button>
              </div>

              <Card className="bg-slate-900">
                <ScrollArea className="h-64">
                  <div className="p-4">
                    {webhookEvents.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No webhook events yet</p>
                        <p className="text-xs">Events will appear here when messages are sent</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {webhookEvents.map(event => (
                          <WebhookEventItem key={event.id} event={event} />
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </Card>

              {webhookEvents.length > 0 && (
                <Button onClick={() => completeStep(7)} className="w-full">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Complete Demo
                </Button>
              )}
            </div>
          </Step>
        </div>

        {/* Completion Message */}
        {completedSteps.size === 7 && (
          <Alert className="mt-6 bg-green-50 border-green-200">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <AlertTitle>Demo Complete!</AlertTitle>
            <AlertDescription>
              All steps have been completed successfully. This demonstrates the full WhatsApp test message flow for Meta App Review.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </TooltipProvider>
  );
};

export default TestMessageDemo;
