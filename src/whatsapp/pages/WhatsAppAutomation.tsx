// WhatsApp Automation Management Page
// ====================================
// Multi-tenant SaaS UI for managing automation rules
// Features: Welcome message, Away message, Commands, Keywords, Ice Breakers
// Enhanced with premium UI/UX for non-technical users

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
    MessageCircle,
    Clock,
    Zap,
    Hash,
    Snowflake,
    Plus,
    Trash2,
    Edit,
    Save,
    RefreshCw,
    ArrowLeft,
    AlertCircle,
    CheckCircle,
    Settings,
    ChevronRight,
    HelpCircle,
    BookOpen,
    Sparkles,
    Eye,
    ChevronDown,
    Info
} from 'lucide-react';
import { API_BASE_URL } from "@/config";
import { getWhatsAppAccounts } from '../api';
import { TriggeredMessagesSectionEnhanced as TriggeredMessagesSection } from './TriggeredMessagesSectionEnhanced';
import { DripCampaignsSection } from './DripCampaignsSection';
import { AutomationOverview } from './AutomationOverview';
import { LayoutDashboard, Lock, Crown } from 'lucide-react';
import { useFeatureGate } from '@/hooks/useFeatureGate';
import KnowledgeBaseSection from '../components/KnowledgeBaseSection';
import { AutomationLoadingScreen } from '../components/AutomationLoadingScreen';
import logo from '@/assets/sociovia_logo.png';

const API_BASE = API_BASE_URL;

// ============================================================
// Types
// ============================================================

interface AutomationRule {
    id: number;
    name: string;
    description?: string;
    rule_type: 'welcome' | 'away' | 'command' | 'keyword' | 'default';
    status: string;
    is_active: boolean;
    trigger_config: Record<string, any>;
    response_type: 'text' | 'template' | 'interactive';
    response_config: Record<string, any>;
    cooldown_seconds?: number;
    max_triggers_per_day?: number;
    priority: number;
    trigger_count: number;
    last_triggered_at?: string;
    created_at: string;
    updated_at: string;
}

interface BusinessHours {
    id: number;
    timezone: string;
    is_enabled: boolean;
    schedule: Record<string, { enabled: boolean; start: string; end: string }>;
}

interface IceBreaker {
    content: string;
}

interface WhatsAppAccount {
    id: number;
    workspace_id: string;
    display_phone_number: string;
    verified_name: string;
    is_active: boolean;
}

// ============================================================
// API Functions
// ============================================================

async function fetchAutomationRules(accountId: number): Promise<AutomationRule[]> {
    const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/automation/rules`, {
        credentials: 'include'
    });
    const data = await res.json();
    return data.success ? data.rules : [];
}

async function fetchBusinessHours(accountId: number): Promise<BusinessHours | null> {
    const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/automation/business-hours`, {
        credentials: 'include'
    });
    const data = await res.json();
    return data.success ? data.business_hours : null;
}

async function fetchIceBreakers(accountId: number): Promise<IceBreaker[]> {
    const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/ice-breakers`, {
        credentials: 'include'
    });
    const data = await res.json();
    return data.success ? data.ice_breakers || [] : [];
}

async function createRule(accountId: number, rule: Partial<AutomationRule>): Promise<{ success: boolean; rule?: AutomationRule; error?: string }> {
    const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/automation/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(rule)
    });
    return res.json();
}

async function updateRule(accountId: number, ruleId: number, updates: Partial<AutomationRule>): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/automation/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
    });
    return res.json();
}

async function deleteRule(accountId: number, ruleId: number): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/automation/rules/${ruleId}`, {
        method: 'DELETE',
        credentials: 'include'
    });
    return res.json();
}

async function updateBusinessHours(accountId: number, hours: Partial<BusinessHours>): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/automation/business-hours`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(hours)
    });
    return res.json();
}

async function updateIceBreakers(accountId: number, iceBreakers: IceBreaker[]): Promise<{ success: boolean; error?: string }> {
    const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/ice-breakers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ice_breakers: iceBreakers, enable_welcome_message: false })
    });
    return res.json();
}

// ============================================================
// Helper Components
// ============================================================

function RuleTypeIcon({ type }: { type: string }) {
    switch (type) {
        case 'welcome': return <MessageCircle className="w-4 h-4" />;
        case 'away': return <Clock className="w-4 h-4" />;
        case 'command': return <Zap className="w-4 h-4" />;
        case 'keyword': return <Hash className="w-4 h-4" />;
        default: return <Settings className="w-4 h-4" />;
    }
}

function RuleTypeBadge({ type }: { type: string }) {
    const colors: Record<string, string> = {
        welcome: 'bg-green-100 text-green-800',
        away: 'bg-blue-100 text-blue-800',
        command: 'bg-purple-100 text-purple-800',
        keyword: 'bg-orange-100 text-orange-800',
        default: 'bg-gray-100 text-gray-800'
    };
    return (
        <Badge className={colors[type] || colors.default}>
            <RuleTypeIcon type={type} />
            <span className="ml-1 capitalize">{type}</span>
        </Badge>
    );
}

// ============================================================
// Documentation Section - "How Automations Work"
// ============================================================

function HowAutomationWorks() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <Card className="border shadow-sm bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            <CardHeader
                className="cursor-pointer hover:bg-gray-50/50 transition-colors py-4"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md">
                            <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                How Automations Work
                                <Badge variant="outline" className="text-xs font-normal">Guide</Badge>
                            </CardTitle>
                            <CardDescription className="text-sm">Learn how to set up auto-replies and save time</CardDescription>
                        </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </CardHeader>

            {isOpen && (
                <CardContent className="border-t pt-4 pb-6">
                    <Accordion type="single" collapsible className="space-y-2">
                        <AccordionItem value="welcome" className="border rounded-lg px-4 bg-white shadow-sm">
                            <AccordionTrigger className="hover:no-underline py-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-md bg-green-100">
                                        <MessageCircle className="w-4 h-4 text-green-600" />
                                    </div>
                                    <span className="font-medium text-sm">Welcome Message</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-muted-foreground pb-4">
                                <p className="mb-2">Automatically greets <strong>new customers</strong> when they message you for the first time.</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Sent only once per contact (24-hour cooldown)</li>
                                    <li>Perfect for introducing your business</li>
                                    <li>Include your name, services, and how to get help</li>
                                </ul>
                                <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-100">
                                    <p className="text-xs font-medium text-green-800 mb-1">💡 Pro Tip:</p>
                                    <p className="text-xs text-green-700">Keep it short and friendly! Let customers know you'll respond soon.</p>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="business-hours" className="border rounded-lg px-4 bg-white shadow-sm">
                            <AccordionTrigger className="hover:no-underline py-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-md bg-blue-100">
                                        <Clock className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <span className="font-medium text-sm">Business Hours & Away Message</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-muted-foreground pb-4">
                                <p className="mb-2">Let customers know when you're <strong>available</strong> and auto-reply when you're away.</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Set different hours for each day of the week</li>
                                    <li>Away message sent outside business hours</li>
                                    <li>Helps manage customer expectations</li>
                                </ul>
                                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                    <p className="text-xs font-medium text-blue-800 mb-1">💡 Pro Tip:</p>
                                    <p className="text-xs text-blue-700">Include when you'll be back and alternative contact methods!</p>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="commands" className="border rounded-lg px-4 bg-white shadow-sm">
                            <AccordionTrigger className="hover:no-underline py-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-md bg-purple-100">
                                        <Zap className="w-4 h-4 text-purple-600" />
                                    </div>
                                    <span className="font-medium text-sm">Commands (Slash Commands)</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-muted-foreground pb-4">
                                <p className="mb-2">Let customers type <strong>/commands</strong> to get instant answers.</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Example: <code className="bg-gray-100 px-1 rounded">/help</code> shows available options</li>
                                    <li>Example: <code className="bg-gray-100 px-1 rounded">/menu</code> shows your products</li>
                                    <li>Add aliases so <code className="bg-gray-100 px-1 rounded">/h</code> also triggers help</li>
                                </ul>
                                <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                                    <p className="text-xs font-medium text-purple-800 mb-1">💡 Pro Tip:</p>
                                    <p className="text-xs text-purple-700">Create a /menu command to showcase your products or services!</p>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="keywords" className="border rounded-lg px-4 bg-white shadow-sm">
                            <AccordionTrigger className="hover:no-underline py-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-md bg-orange-100">
                                        <Hash className="w-4 h-4 text-orange-600" />
                                    </div>
                                    <span className="font-medium text-sm">Keyword Triggers</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-muted-foreground pb-4">
                                <p className="mb-2">Auto-reply when messages <strong>contain specific words</strong>.</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Example: "price" triggers your pricing info</li>
                                    <li>Example: "hours" triggers your business hours</li>
                                    <li>Choose match type: Contains, Exact, or Starts With</li>
                                </ul>
                                <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-100">
                                    <p className="text-xs font-medium text-orange-800 mb-1">💡 Pro Tip:</p>
                                    <p className="text-xs text-orange-700">Add multiple keywords like "price, cost, rate, how much" for the same response!</p>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="ice-breakers" className="border rounded-lg px-4 bg-white shadow-sm">
                            <AccordionTrigger className="hover:no-underline py-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-md bg-cyan-100">
                                        <Snowflake className="w-4 h-4 text-cyan-600" />
                                    </div>
                                    <span className="font-medium text-sm">Ice Breakers</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-muted-foreground pb-4">
                                <p className="mb-2">Clickable buttons shown to <strong>new customers</strong> when they open your chat.</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Appears as tappable buttons in WhatsApp</li>
                                    <li>Maximum 4 ice breakers, 80 characters each</li>
                                    <li>Only visible to users who haven't messaged before</li>
                                </ul>
                                <div className="mt-3 p-3 bg-cyan-50 rounded-lg border border-cyan-100">
                                    <p className="text-xs font-medium text-cyan-800 mb-1">💡 Pro Tip:</p>
                                    <p className="text-xs text-cyan-700">Use questions like "What services do you offer?" or "How can I contact you?"</p>
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="ai-chatbot" className="border rounded-lg px-4 bg-white shadow-sm">
                            <AccordionTrigger className="hover:no-underline py-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-md bg-pink-100">
                                        <Sparkles className="w-4 h-4 text-pink-600" />
                                    </div>
                                    <span className="font-medium text-sm">AI Chatbot</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-muted-foreground pb-4">
                                <p className="mb-2">Intelligent AI assistant that handles complex customer queries.</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Understands context and intent</li>
                                    <li>Falls back to human agent if needed</li>
                                    <li>Trained on your business profile</li>
                                </ul>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="faq" className="border rounded-lg px-4 bg-white shadow-sm">
                            <AccordionTrigger className="hover:no-underline py-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-md bg-blue-100">
                                        <BookOpen className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <span className="font-medium text-sm">FAQ Knowledge Base</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-muted-foreground pb-4">
                                <p className="mb-2">Instant answers for common questions.</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Managed list of Questions & Answers</li>
                                    <li>Matches user queries automatically</li>
                                    <li>Prioritized before AI responses</li>
                                </ul>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="triggered" className="border rounded-lg px-4 bg-white shadow-sm">
                            <AccordionTrigger className="hover:no-underline py-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-md bg-yellow-100">
                                        <Zap className="w-4 h-4 text-yellow-600" />
                                    </div>
                                    <span className="font-medium text-sm">Triggered Messages</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-muted-foreground pb-4">
                                <p className="mb-2">Fire messages via API from external systems.</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Send Order Updates, OTPs, Alerts</li>
                                    <li>Secure API endpoint for each trigger</li>
                                    <li>Use in Zapier, Make, or your backend</li>
                                </ul>
                            </AccordionContent>
                        </AccordionItem>

                        <AccordionItem value="drip" className="border rounded-lg px-4 bg-white shadow-sm">
                            <AccordionTrigger className="hover:no-underline py-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-md bg-emerald-100">
                                        <RefreshCw className="w-4 h-4 text-emerald-600" />
                                    </div>
                                    <span className="font-medium text-sm">Drip Campaigns</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="text-sm text-muted-foreground pb-4">
                                <p className="mb-2">Scheduled sequences of messages.</p>
                                <ul className="list-disc list-inside space-y-1 ml-2">
                                    <li>Send message 1 &rarr; Wait 24h &rarr; Send message 2</li>
                                    <li>Great for onboarding and nurturing leads</li>
                                    <li>Fully automated scheduler</li>
                                </ul>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </CardContent>
            )}
        </Card>
    );
}

// ============================================================
// Welcome Message Section
// ============================================================

function WelcomeMessageSection({
    rules,
    accountId,
    onRefresh
}: {
    rules: AutomationRule[];
    accountId: number;
    onRefresh: () => void;
}) {
    const welcomeRule = rules.find(r => r.rule_type === 'welcome');
    const [message, setMessage] = useState(welcomeRule?.response_config?.message || '');
    const [isActive, setIsActive] = useState(welcomeRule?.is_active ?? false);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (welcomeRule) {
            setMessage(welcomeRule.response_config?.message || '');
            setIsActive(welcomeRule.is_active);
        }
    }, [welcomeRule]);

    const handleSave = async () => {
        setSaving(true);
        setSuccess(false);
        try {
            if (welcomeRule) {
                await updateRule(accountId, welcomeRule.id, {
                    response_config: { message },
                    is_active: isActive
                });
            } else {
                await createRule(accountId, {
                    name: 'Welcome Message',
                    rule_type: 'welcome',
                    response_type: 'text',
                    response_config: { message },
                    is_active: isActive,
                    priority: 1,
                    cooldown_seconds: 86400,
                    max_triggers_per_day: 1
                });
            }
            setSuccess(true);
            onRefresh();
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error('Failed to save welcome message:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-100">
                            <MessageCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Welcome Message</CardTitle>
                            <CardDescription>Auto-reply when new contacts message you for the first time</CardDescription>
                        </div>
                    </div>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label htmlFor="welcome-msg">Message</Label>
                    <Textarea
                        id="welcome-msg"
                        placeholder="Hello! Thank you for reaching out. How can we help you today?"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={3}
                        className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        This message is sent once per contact (24-hour cooldown)
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleSave} disabled={saving || !message.trim()}>
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Changes
                    </Button>
                    {success && (
                        <span className="text-sm text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> Saved!
                        </span>
                    )}
                </div>
                {welcomeRule && (
                    <p className="text-xs text-muted-foreground">
                        Triggered {welcomeRule.trigger_count} times
                        {welcomeRule.last_triggered_at && ` • Last: ${new Date(welcomeRule.last_triggered_at).toLocaleString()}`}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

// ============================================================
// Business Hours & Away Message Section
// ============================================================

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<string, string> = {
    mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
    fri: 'Friday', sat: 'Saturday', sun: 'Sunday'
};

const TIMEZONES = [
    { value: 'Asia/Kolkata', label: 'India (IST)' },
    { value: 'America/New_York', label: 'US Eastern' },
    { value: 'America/Los_Angeles', label: 'US Pacific' },
    { value: 'Europe/London', label: 'UK (GMT/BST)' },
    { value: 'UTC', label: 'UTC' }
];

function BusinessHoursSection({
    rules,
    businessHours,
    accountId,
    onRefresh
}: {
    rules: AutomationRule[];
    businessHours: BusinessHours | null;
    accountId: number;
    onRefresh: () => void;
}) {
    const awayRule = rules.find(r => r.rule_type === 'away');
    const [awayMessage, setAwayMessage] = useState(awayRule?.response_config?.message || '');
    const [isEnabled, setIsEnabled] = useState(businessHours?.is_enabled ?? false);
    const [timezone, setTimezone] = useState(businessHours?.timezone || 'Asia/Kolkata');
    const [schedule, setSchedule] = useState<Record<string, { enabled: boolean; start: string; end: string }>>(
        businessHours?.schedule || {
            mon: { enabled: true, start: '09:00', end: '18:00' },
            tue: { enabled: true, start: '09:00', end: '18:00' },
            wed: { enabled: true, start: '09:00', end: '18:00' },
            thu: { enabled: true, start: '09:00', end: '18:00' },
            fri: { enabled: true, start: '09:00', end: '18:00' },
            sat: { enabled: true, start: '09:00', end: '18:00' },
            sun: { enabled: false, start: '09:00', end: '18:00' }
        }
    );
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (awayRule) {
            setAwayMessage(awayRule.response_config?.message || '');
        }
        if (businessHours) {
            setIsEnabled(businessHours.is_enabled);
            setTimezone(businessHours.timezone);
            setSchedule(businessHours.schedule);
        }
    }, [awayRule, businessHours]);

    const handleDayToggle = (day: string) => {
        setSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], enabled: !prev[day]?.enabled }
        }));
    };

    const handleTimeChange = (day: string, field: 'start' | 'end', value: string) => {
        setSchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: value }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setSuccess(false);
        try {
            // Save business hours
            await updateBusinessHours(accountId, {
                timezone,
                is_enabled: isEnabled,
                schedule
            });

            // Save away message rule
            if (awayRule) {
                await updateRule(accountId, awayRule.id, {
                    response_config: { message: awayMessage },
                    is_active: isEnabled
                });
            } else if (awayMessage.trim()) {
                await createRule(accountId, {
                    name: 'Away Message',
                    rule_type: 'away',
                    response_type: 'text',
                    response_config: { message: awayMessage },
                    is_active: isEnabled,
                    priority: 2,
                    cooldown_seconds: 3600,
                    max_triggers_per_day: 3
                });
            }

            setSuccess(true);
            onRefresh();
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error('Failed to save business hours:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-100">
                            <Clock className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Business Hours & Away Message</CardTitle>
                            <CardDescription>Set your working hours and auto-reply when you're away</CardDescription>
                        </div>
                    </div>
                    <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Away Message */}
                <div>
                    <Label htmlFor="away-msg">Away Message</Label>
                    <Textarea
                        id="away-msg"
                        placeholder="Thanks for your message! We're currently away but will get back to you during business hours."
                        value={awayMessage}
                        onChange={(e) => setAwayMessage(e.target.value)}
                        rows={2}
                        className="mt-1.5"
                    />
                </div>

                {/* Timezone */}
                <div>
                    <Label>Timezone</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                        <SelectTrigger className="mt-1.5">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TIMEZONES.map(tz => (
                                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Schedule */}
                <div>
                    <Label className="mb-3 block">Working Hours</Label>
                    <div className="space-y-2">
                        {DAYS.map(day => (
                            <div key={day} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                                <Switch
                                    checked={schedule[day]?.enabled ?? false}
                                    onCheckedChange={() => handleDayToggle(day)}
                                />
                                <span className="w-24 text-sm font-medium">{DAY_LABELS[day]}</span>
                                {schedule[day]?.enabled ? (
                                    <>
                                        <Input
                                            type="time"
                                            value={schedule[day]?.start || '09:00'}
                                            onChange={(e) => handleTimeChange(day, 'start', e.target.value)}
                                            className="w-28"
                                        />
                                        <span className="text-muted-foreground">to</span>
                                        <Input
                                            type="time"
                                            value={schedule[day]?.end || '18:00'}
                                            onChange={(e) => handleTimeChange(day, 'end', e.target.value)}
                                            className="w-28"
                                        />
                                    </>
                                ) : (
                                    <span className="text-sm text-muted-foreground">Closed</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Changes
                    </Button>
                    {success && (
                        <span className="text-sm text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> Saved!
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================================
// Commands Section
// ============================================================

function CommandsSection({
    rules,
    accountId,
    onRefresh
}: {
    rules: AutomationRule[];
    accountId: number;
    onRefresh: () => void;
}) {
    const commandRules = rules.filter(r => r.rule_type === 'command');
    const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newCommand, setNewCommand] = useState({ name: '', command: '', aliases: '', message: '' });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!newCommand.name || !newCommand.command || !newCommand.message) return;
        setSaving(true);
        try {
            const aliases = newCommand.aliases.split(',').map(a => a.trim()).filter(Boolean);

            const payload = {
                name: newCommand.name,
                rule_type: 'command' as const,
                trigger_config: {
                    command: newCommand.command.startsWith('/') ? newCommand.command : `/${newCommand.command}`,
                    aliases
                },
                response_type: 'text' as const,
                response_config: { message: newCommand.message },
                is_active: true,
                priority: 10,
                cooldown_seconds: 60
            };

            if (editingRule) {
                // @ts-ignore
                await updateRule(accountId, editingRule.id, payload);
            } else {
                await createRule(accountId, payload);
            }

            setNewCommand({ name: '', command: '', aliases: '', message: '' });
            setEditingRule(null);
            setIsDialogOpen(false);
            onRefresh();
        } catch (err) {
            console.error('Failed to save command:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (rule: AutomationRule) => {
        await updateRule(accountId, rule.id, { is_active: !rule.is_active });
        onRefresh();
    };

    const handleDelete = async (ruleId: number) => {
        if (!confirm('Delete this command?')) return;
        await deleteRule(accountId, ruleId);
        onRefresh();
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-100">
                            <Zap className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Commands</CardTitle>
                            <CardDescription>Slash commands like /help, /menu that users can type</CardDescription>
                        </div>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) {
                            setEditingRule(null);
                            setNewCommand({ name: '', command: '', aliases: '', message: '' });
                        }
                    }}>
                        <DialogTrigger asChild>
                            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Command</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingRule ? 'Edit Command' : 'Create New Command'}</DialogTitle>
                                <DialogDescription>Add or modify a slash command that users can trigger</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                    <Label>Name</Label>
                                    <Input
                                        placeholder="Help Menu"
                                        value={newCommand.name}
                                        onChange={(e) => setNewCommand(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label>Command</Label>
                                    <Input
                                        placeholder="/help"
                                        value={newCommand.command}
                                        onChange={(e) => setNewCommand(prev => ({ ...prev, command: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label>Aliases (comma-separated)</Label>
                                    <Input
                                        placeholder="/h, help, ?"
                                        value={newCommand.aliases}
                                        onChange={(e) => setNewCommand(prev => ({ ...prev, aliases: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label>Response Message</Label>
                                    <Textarea
                                        placeholder="Here's how I can help you..."
                                        value={newCommand.message}
                                        onChange={(e) => setNewCommand(prev => ({ ...prev, message: e.target.value }))}
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleSave} disabled={saving}>
                                    {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                                    {editingRule ? 'Update' : 'Create'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {commandRules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No commands configured. Click "Add Command" to create one.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {commandRules.map(rule => (
                            <div key={rule.id} className="group p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all duration-200">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <Switch checked={rule.is_active} onCheckedChange={() => handleToggle(rule)} className="mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <p className="font-semibold text-sm text-gray-900">{rule.name}</p>
                                                {rule.is_active ? (
                                                    <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-xs">Inactive</Badge>
                                                )}
                                            </div>

                                            {/* Command and Aliases as Badges */}
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                                <Badge className="bg-purple-100 text-purple-800 font-mono text-xs px-2">
                                                    {rule.trigger_config?.command}
                                                </Badge>
                                                {rule.trigger_config?.aliases?.map((alias: string, idx: number) => (
                                                    <Badge key={idx} variant="outline" className="font-mono text-xs px-2 border-purple-200 text-purple-600">
                                                        {alias.startsWith('/') ? alias : `/${alias}`}
                                                    </Badge>
                                                ))}
                                            </div>

                                            {/* Response Preview */}
                                            <p className="text-xs text-muted-foreground line-clamp-2 bg-gray-50 p-2 rounded border border-gray-100">
                                                <span className="font-medium text-gray-500">Response:</span> {rule.response_config?.message?.substring(0, 100)}{rule.response_config?.message?.length > 100 ? '...' : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-1 rounded-full">
                                                        {rule.trigger_count} triggers
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Times this command was used</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setNewCommand({
                                                    name: rule.name,
                                                    command: rule.trigger_config.command,
                                                    aliases: rule.trigger_config.aliases?.join(', ') || '',
                                                    message: rule.response_config.message
                                                });
                                                setEditingRule(rule);
                                                setIsDialogOpen(true);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50"
                                        >
                                            <Edit className="w-4 h-4 text-blue-500" />
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(rule.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ============================================================
// Keywords Section
// ============================================================

function KeywordsSection({
    rules,
    accountId,
    onRefresh
}: {
    rules: AutomationRule[];
    accountId: number;
    onRefresh: () => void;
}) {
    const keywordRules = rules.filter(r => r.rule_type === 'keyword');
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newKeyword, setNewKeyword] = useState({ name: '', keywords: '', message: '', matchType: 'contains' });
    const [saving, setSaving] = useState(false);

    const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

    const handleSave = async () => {
        if (!newKeyword.name || !newKeyword.keywords || !newKeyword.message) return;
        setSaving(true);
        try {
            const keywords = newKeyword.keywords.split(',').map(k => k.trim()).filter(Boolean);

            const payload = {
                name: newKeyword.name,
                rule_type: 'keyword' as const,
                trigger_config: {
                    keywords,
                    match_type: newKeyword.matchType,
                    case_sensitive: false
                },
                response_type: 'text' as const,
                response_config: { message: newKeyword.message },
                is_active: true,
                priority: 50,
                cooldown_seconds: 300
            };

            if (editingRule) {
                // @ts-ignore
                await updateRule(accountId, editingRule.id, payload);
            } else {
                await createRule(accountId, payload);
            }

            setNewKeyword({ name: '', keywords: '', message: '', matchType: 'contains' });
            setEditingRule(null);
            setIsDialogOpen(false);
            onRefresh();
        } catch (err) {
            console.error('Failed to save keyword rule:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (rule: AutomationRule) => {
        await updateRule(accountId, rule.id, { is_active: !rule.is_active });
        onRefresh();
    };

    const handleDelete = async (ruleId: number) => {
        if (!confirm('Delete this keyword rule?')) return;
        await deleteRule(accountId, ruleId);
        onRefresh();
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-100">
                            <Hash className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Keyword Triggers</CardTitle>
                            <CardDescription>Auto-reply when messages contain specific words</CardDescription>
                        </div>
                    </div>
                    <Dialog open={isDialogOpen} onOpenChange={(open) => {
                        setIsDialogOpen(open);
                        if (!open) {
                            setEditingRule(null);
                            setNewKeyword({ name: '', keywords: '', message: '', matchType: 'contains' });
                        }
                    }}>
                        <DialogTrigger asChild>
                            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Keyword</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingRule ? 'Edit Keyword Trigger' : 'Create Keyword Trigger'}</DialogTitle>
                                <DialogDescription>Auto-reply when messages contain specific words</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                    <Label>Name</Label>
                                    <Input
                                        placeholder="Pricing Info"
                                        value={newKeyword.name}
                                        onChange={(e) => setNewKeyword(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label>Keywords (comma-separated)</Label>
                                    <Input
                                        placeholder="price, pricing, cost, how much"
                                        value={newKeyword.keywords}
                                        onChange={(e) => setNewKeyword(prev => ({ ...prev, keywords: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <Label>Match Type</Label>
                                    <Select value={newKeyword.matchType} onValueChange={(v) => setNewKeyword(prev => ({ ...prev, matchType: v }))}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="contains">Contains</SelectItem>
                                            <SelectItem value="exact">Exact Match</SelectItem>
                                            <SelectItem value="starts_with">Starts With</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Response Message</Label>
                                    <Textarea
                                        placeholder="Our pricing starts at..."
                                        value={newKeyword.message}
                                        onChange={(e) => setNewKeyword(prev => ({ ...prev, message: e.target.value }))}
                                        rows={3}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleSave} disabled={saving}>
                                    {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                                    {editingRule ? 'Update' : 'Create'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent>
                {keywordRules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                        No keyword triggers configured. Click "Add Keyword" to create one.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {keywordRules.map(rule => (
                            <div key={rule.id} className="group p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-100 hover:border-orange-200 hover:shadow-md transition-all duration-200">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-3 flex-1 min-w-0">
                                        <Switch checked={rule.is_active} onCheckedChange={() => handleToggle(rule)} className="mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <p className="font-semibold text-sm text-gray-900">{rule.name}</p>
                                                {rule.is_active ? (
                                                    <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="text-xs">Inactive</Badge>
                                                )}
                                                <Badge variant="outline" className="text-xs capitalize border-orange-200 text-orange-600">
                                                    {rule.trigger_config?.match_type === 'exact' ? 'Exact Match' :
                                                        rule.trigger_config?.match_type === 'starts_with' ? 'Starts With' : 'Contains'}
                                                </Badge>
                                            </div>

                                            {/* Keywords as Badges */}
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                                {rule.trigger_config?.keywords?.map((keyword: string, idx: number) => (
                                                    <Badge key={idx} className="bg-orange-100 text-orange-800 text-xs px-2">
                                                        {keyword}
                                                    </Badge>
                                                ))}
                                            </div>

                                            {/* Response Preview */}
                                            <p className="text-xs text-muted-foreground line-clamp-2 bg-gray-50 p-2 rounded border border-gray-100">
                                                <span className="font-medium text-gray-500">Response:</span> {rule.response_config?.message?.substring(0, 100)}{rule.response_config?.message?.length > 100 ? '...' : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-1 rounded-full">
                                                        {rule.trigger_count} triggers
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>Times these keywords were matched</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setNewKeyword({
                                                    name: rule.name,
                                                    keywords: rule.trigger_config.keywords.join(', '),
                                                    message: rule.response_config.message,
                                                    matchType: rule.trigger_config.match_type || 'contains'
                                                });
                                                setEditingRule(rule);
                                                setIsDialogOpen(true);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-50"
                                        >
                                            <Edit className="w-4 h-4 text-blue-500" />
                                        </Button>

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(rule.id)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ============================================================
// Ice Breakers Section
// ============================================================

function IceBreakersSection({
    iceBreakers,
    accountId,
    onRefresh
}: {
    iceBreakers: IceBreaker[];
    accountId: number;
    onRefresh: () => void;
}) {
    const [items, setItems] = useState<IceBreaker[]>(iceBreakers);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        setItems(iceBreakers);
    }, [iceBreakers]);

    const handleAdd = () => {
        if (items.length >= 4) return;
        setItems([...items, { content: '' }]);
    };

    const handleRemove = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const handleChange = (index: number, value: string) => {
        setItems(items.map((item, i) => i === index ? { content: value } : item));
    };

    const handleSave = async () => {
        const validItems = items.filter(i => i.content.trim());
        setSaving(true);
        setSuccess(false);
        try {
            await updateIceBreakers(accountId, validItems);
            setSuccess(true);
            onRefresh();
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error('Failed to save ice breakers:', err);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-100">
                        <Snowflake className="w-5 h-5 text-cyan-600" />
                    </div>
                    <div>
                        <CardTitle className="text-lg">Ice Breakers</CardTitle>
                        <CardDescription>Quick-reply buttons shown to new users when they open the chat</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert>
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>
                        Ice breakers only appear to users who haven't messaged you before. Maximum 4 items, 80 characters each.
                    </AlertDescription>
                </Alert>

                <div className="space-y-2">
                    {items.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <Input
                                placeholder={`Option ${index + 1} (e.g., "What services do you offer?")`}
                                value={item.content}
                                onChange={(e) => handleChange(index, e.target.value)}
                                maxLength={80}
                            />
                            <Button variant="ghost" size="sm" onClick={() => handleRemove(index)}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                        </div>
                    ))}
                </div>

                {items.length < 4 && (
                    <Button variant="outline" size="sm" onClick={handleAdd}>
                        <Plus className="w-4 h-4 mr-1" /> Add Option
                    </Button>
                )}

                <div className="flex items-center gap-2 pt-2">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Ice Breakers
                    </Button>
                    {success && (
                        <span className="text-sm text-green-600 flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" /> Saved!
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// ============================================================
// AI Auto-Reply Section (powered by RAG + Gemini)
// ============================================================

function AIChatbotSection({ accountId, workspaceId }: { accountId: number; workspaceId?: string | number }) {
    const [enabled, setEnabled] = useState(false);
    const [systemPrompt, setSystemPrompt] = useState('');
    const [fallbackMessage, setFallbackMessage] = useState("I'm sorry, I couldn't process your request. A team member will assist you soon.");
    const [adminAlertTemplate, setAdminAlertTemplate] = useState('admin_alert');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    // Load AI config on mount
    useEffect(() => {
        async function loadConfig() {
            try {
                const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/ai/config`, {
                    credentials: 'include'
                });
                if (res.ok) {
                    const data = await res.json();
                    setEnabled(data.enabled || false);
                    setSystemPrompt(data.system_prompt || '');
                    setFallbackMessage(data.fallback_message || '');
                    setAdminAlertTemplate(data.admin_alert_template || 'admin_alert');
                }
            } catch (err) {
                console.error('Failed to load AI config:', err);
            } finally {
                setLoading(false);
            }
        }
        loadConfig();
    }, [accountId]);

    const handleToggle = async (checked: boolean) => {
        setSaving(true);
        try {
            const endpoint = checked ? 'enable' : 'disable';
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/ai/${endpoint}`, {
                method: 'POST',
                credentials: 'include'
            });
            if (res.ok) {
                setEnabled(checked);
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            }
        } catch (err) {
            console.error('Failed to toggle AI:', err);
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/ai/config`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enabled,
                    system_prompt: systemPrompt,
                    fallback_message: fallbackMessage,
                    admin_alert_template: adminAlertTemplate
                })
            });
            if (res.ok) {
                setSuccess(true);
                setTimeout(() => setSuccess(false), 3000);
            }
        } catch (err) {
            console.error('Failed to save AI config:', err);
        } finally {
            setSaving(false);
        }
    };



    if (loading) {
        return <Skeleton className="h-48 w-full rounded-xl" />;
    }

    return (
        <Card className="border shadow-sm bg-gradient-to-br from-purple-50/50 via-white to-pink-50/30 overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500" />
            <CardHeader
                className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 shadow-md">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                AI Auto-Reply
                                <Badge className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-xs font-normal">
                                    Powered by Sociovia
                                </Badge>
                                {enabled && <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>}
                            </CardTitle>
                            <CardDescription>Automatic AI responses from your Knowledge Base when no rules match</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Switch
                            checked={enabled}
                            onCheckedChange={handleToggle}
                            disabled={saving}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </CardHeader>

            {isOpen && (
                <CardContent className="border-t pt-4 space-y-4">
                    <Alert className="bg-purple-50 border-purple-200">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <AlertDescription className="text-purple-800">
                            AI Auto-Reply handles messages that don't match any automation rules. It uses your Knowledge Base to provide accurate, context-aware responses about your business.
                        </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                        <div>
                            <Label>System Prompt (Optional)</Label>
                            <p className="text-xs text-muted-foreground mb-2">
                                Customize how the AI responds. Leave empty for default customer service behavior.
                            </p>
                            <Textarea
                                placeholder="You are a helpful customer service assistant for our company..."
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                rows={3}
                                className="mt-1"
                            />
                        </div>

                        <div>
                            <Label>Fallback Message</Label>
                            <p className="text-xs text-muted-foreground mb-2">
                                Message sent if AI is unavailable or fails to respond.
                            </p>
                            <Input
                                placeholder="I'm sorry, I couldn't process your request..."
                                value={fallbackMessage}
                                onChange={(e) => setFallbackMessage(e.target.value)}
                            />
                        </div>

                        {/* Admin Alert Template - Hidden for now, feature coming soon */}
                        {/* <div>
              <Label>Admin Alert Template Name</Label>
              <p className="text-xs text-muted-foreground mb-2">
                WhatsApp Utility Template to use for admin notifications (Format: Name, Number, Reason, Context).
              </p>
              <Input
                placeholder="admin_alert"
                value={adminAlertTemplate}
                onChange={(e) => setAdminAlertTemplate(e.target.value)}
              />
            </div> */}

                        <div className="flex gap-2">
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                Save Configuration
                            </Button>
                            {success && (
                                <span className="text-sm text-green-600 flex items-center gap-1">
                                    <CheckCircle className="w-4 h-4" /> Saved!
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Knowledge Base - Embedded */}
                    {workspaceId && (
                        <div className="border-t pt-4 mt-4">
                            <KnowledgeBaseSection workspaceId={workspaceId} />
                        </div>
                    )}
                </CardContent>
            )}
        </Card>
    );
}

// ============================================================
// FAQ Knowledge Base Section
// ============================================================

interface FAQ {
    id: number;
    question: string;
    answer: string;
    keywords: string[];
    category?: string;
    is_active: boolean;
    match_count: number;
}

function FAQSection({ accountId }: { accountId: number }) {
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
    const [saving, setSaving] = useState(false);
    const [testMessage, setTestMessage] = useState('');
    const [testResult, setTestResult] = useState<{ matched: boolean; answer?: string } | null>(null);
    const [testing, setTesting] = useState(false);

    // Form state
    const [newQuestion, setNewQuestion] = useState('');
    const [newAnswer, setNewAnswer] = useState('');
    const [newCategory, setNewCategory] = useState('');

    // Load FAQs on mount
    useEffect(() => {
        if (accountId) {
            loadFAQs();
        }
    }, [accountId]);

    async function loadFAQs() {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/faqs`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setFaqs(data.faqs || []);
            }
        } catch (err) {
            console.error('Failed to load FAQs:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveFaq() {
        if (!newQuestion.trim() || !newAnswer.trim()) return;

        setSaving(true);
        try {
            const url = editingFaq
                ? `${API_BASE}/api/whatsapp/accounts/${accountId}/faqs/${editingFaq.id}`
                : `${API_BASE}/api/whatsapp/accounts/${accountId}/faqs`;

            const res = await fetch(url, {
                method: editingFaq ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    question: newQuestion,
                    answer: newAnswer,
                    category: newCategory || null
                })
            });

            if (res.ok) {
                await loadFAQs();
                resetForm();
                setShowAddDialog(false);
                setEditingFaq(null);

                // Auto-enable FAQ rule when first FAQ is added
                if (!editingFaq) {
                    try {
                        await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/faqs/enable`, {
                            method: 'POST',
                            credentials: 'include'
                        });
                    } catch (err) {
                        console.error('Failed to enable FAQ rule:', err);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to save FAQ:', err);
        } finally {
            setSaving(false);
        }
    }

    async function handleDeleteFaq(faqId: number) {
        if (!confirm('Delete this FAQ?')) return;

        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/faqs/${faqId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                await loadFAQs();
            }
        } catch (err) {
            console.error('Failed to delete FAQ:', err);
        }
    }

    async function handleTestFaq() {
        if (!testMessage.trim()) return;

        setTesting(true);
        setTestResult(null);

        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/faqs/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ message: testMessage })
            });

            if (res.ok) {
                const data = await res.json();
                setTestResult({ matched: data.matched, answer: data.answer });
            }
        } catch (err) {
            console.error('Failed to test FAQ:', err);
        } finally {
            setTesting(false);
        }
    }

    function resetForm() {
        setNewQuestion('');
        setNewAnswer('');
        setNewCategory('');
    }

    function openEditDialog(faq: FAQ) {
        setEditingFaq(faq);
        setNewQuestion(faq.question);
        setNewAnswer(faq.answer);
        setNewCategory(faq.category || '');
        setShowAddDialog(true);
    }

    if (loading) {
        return <Skeleton className="h-24 w-full rounded-lg" />;
    }

    return (
        <Card className="border shadow-sm">
            <CardHeader
                className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 shadow-md">
                            <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-lg flex items-center gap-2">
                                FAQ Knowledge Base
                                <Badge className="bg-blue-100 text-blue-700 text-xs">{faqs.length}</Badge>
                            </CardTitle>
                            <CardDescription>Quick answers for common questions</CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setShowAddDialog(true); }}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4 mr-1" /> Add FAQ
                        </Button>
                        <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </div>
            </CardHeader>

            {isOpen && (
                <CardContent className="border-t pt-4 space-y-4">
                    <Alert className="bg-blue-50 border-blue-200">
                        <BookOpen className="w-4 h-4 text-blue-600" />
                        <AlertDescription className="text-blue-800">
                            FAQs are matched before AI responses, providing fast answers for common questions without API calls.
                        </AlertDescription>
                    </Alert>

                    {/* FAQ List */}
                    {faqs.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <HelpCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>No FAQs yet. Add your first FAQ to get started.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {faqs.map((faq) => (
                                <div key={faq.id} className="border rounded-lg p-3 bg-gray-50/50">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{faq.question}</p>
                                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{faq.answer}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                {faq.category && <Badge variant="outline" className="text-xs">{faq.category}</Badge>}
                                                <span className="text-xs text-muted-foreground">{faq.match_count} matches</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(faq)}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDeleteFaq(faq.id)}>
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Test FAQ Matching */}
                    <div className="border-t pt-4">
                        <Label>Test FAQ Matching</Label>
                        <div className="flex gap-2 mt-2">
                            <Input
                                placeholder="Type a test message..."
                                value={testMessage}
                                onChange={(e) => setTestMessage(e.target.value)}
                            />
                            <Button onClick={handleTestFaq} disabled={testing || !testMessage.trim()}>
                                {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Test'}
                            </Button>
                        </div>
                        {testResult && (
                            <div className={`mt-2 p-3 rounded-lg ${testResult.matched ? 'bg-green-50 border-green-200 border' : 'bg-yellow-50 border-yellow-200 border'}`}>
                                {testResult.matched ? (
                                    <>
                                        <p className="text-sm text-green-800 font-medium">✓ FAQ Matched</p>
                                        <p className="text-sm text-green-700 mt-1">{testResult.answer}</p>
                                    </>
                                ) : (
                                    <p className="text-sm text-yellow-800">No matching FAQ found. Will fall back to AI.</p>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            )}

            {/* Add/Edit Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingFaq ? 'Edit FAQ' : 'Add FAQ'}</DialogTitle>
                        <DialogDescription>
                            {editingFaq ? 'Update this FAQ entry' : 'Add a new question and answer pair'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>Question</Label>
                            <Input
                                placeholder="e.g., What are your business hours?"
                                value={newQuestion}
                                onChange={(e) => setNewQuestion(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Answer</Label>
                            <Textarea
                                placeholder="The answer that will be sent to customers..."
                                value={newAnswer}
                                onChange={(e) => setNewAnswer(e.target.value)}
                                rows={3}
                            />
                        </div>
                        <div>
                            <Label>Category (Optional)</Label>
                            <Input
                                placeholder="e.g., General, Pricing, Support"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditingFaq(null); resetForm(); }}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveFaq} disabled={saving || !newQuestion.trim() || !newAnswer.trim()}>
                            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {editingFaq ? 'Update' : 'Add'} FAQ
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}

// ============================================================
// Main Component
// ============================================================

// ============================================================
// Main Component
// ============================================================

export default function WhatsAppAutomation() {
    const navigate = useNavigate();
    const location = useLocation();
    const smartAiGate = useFeatureGate('whatsapp_smart_ai');
    const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
    const [rules, setRules] = useState<AutomationRule[]>([]);
    const [businessHours, setBusinessHours] = useState<BusinessHours | null>(null);
    const [iceBreakers, setIceBreakers] = useState<IceBreaker[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const openUnlockDialog = (level: number, name: string) => { };

    // New State for Hub UI
    const [activeTab, setActiveTab] = useState("overview");
    // All features unlocked by default (no enterprise lock)
    const [unlockedLevel, setUnlockedLevel] = useState<number>(3);

    // Fetch accounts on mount - filter by current workspace
    useEffect(() => {
        async function loadAccounts() {
            try {
                // Get workspace_id from storage to filter by current user's workspace
                const workspaceId = localStorage.getItem('sv_whatsapp_workspace_id') || sessionStorage.getItem('sv_whatsapp_workspace_id') || undefined;
                const data = await getWhatsAppAccounts(workspaceId);
                const allAccounts = data.accounts || [];
                const activeAccounts = allAccounts.filter((a: any) => a.is_active);
                setAccounts(activeAccounts);
                if (activeAccounts.length > 0) {
                    setSelectedAccountId(activeAccounts[0].id);
                } else {
                    setLoading(false); // Stop loading if no accounts
                }
            } catch (err) {
                console.error('Failed to load accounts:', err);
                setError('Failed to load WhatsApp accounts');
                setLoading(false);
            }
        }
        loadAccounts();
    }, []);

    // Fetch automation data when account changes
    const loadAutomationData = useCallback(async () => {
        if (!selectedAccountId) return;
        setLoading(true);
        setError(null);
        try {
            const [rulesData, hoursData, iceData] = await Promise.all([
                fetchAutomationRules(selectedAccountId),
                fetchBusinessHours(selectedAccountId),
                fetchIceBreakers(selectedAccountId)
            ]);
            setRules(rulesData);
            setBusinessHours(hoursData);
            setIceBreakers(iceData);
        } catch (err) {
            console.error('Failed to load automation data:', err);
            setError('Failed to load automation settings');
        } finally {
            setLoading(false);
        }
    }, [selectedAccountId]);

    useEffect(() => {
        loadAutomationData();
    }, [loadAutomationData]);

    const selectedAccount = accounts.find(a => a.id === selectedAccountId);

    const handleNavigate = (target: string) => {
        // Get base path from current location (agent or dashboard)
        const basePath = location.pathname.startsWith('/agent') ? '/agent' : '/dashboard';
        if (target === 'interactive-automation') {
            navigate(`${basePath}/interactive-automation`);
        } else {
            setActiveTab(target);
        }
    };

    if (accounts.length === 0 && !loading) {
        // Get base path from current location (agent or dashboard)
        const basePath = location.pathname.startsWith('/agent') ? '/agent' : '/dashboard';
        return (
            <div className="p-6">
                <Alert>
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>
                        No WhatsApp accounts connected. Please connect a WhatsApp number first.
                        <Button variant="link" className="px-2" onClick={() => navigate(`${basePath}/whatsapp/setup`)}>
                            Go to Settings <ChevronRight className="w-4 h-4" />
                        </Button>
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 space-y-6 w-full animate-in fade-in duration-500">

            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full hover:bg-slate-200">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <img src={logo} alt="Sociovia" className="h-8 w-auto" />
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Automation Hub</h1>
                            {selectedAccount && (
                                <p className="text-muted-foreground flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    Bot Active on {selectedAccount.display_phone_number}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Account Selector */}
                    {accounts.length > 1 && (
                        <Select value={String(selectedAccountId)} onValueChange={(v) => setSelectedAccountId(Number(v))}>
                            <SelectTrigger className="w-48 bg-white shadow-sm border-slate-200">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {accounts.map(acc => (
                                    <SelectItem key={acc.id} value={String(acc.id)}>
                                        {acc.verified_name || acc.display_phone_number}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <Button variant="outline" onClick={loadAutomationData} className="bg-white hover:bg-slate-50 border-slate-200 shadow-sm">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                </div>
            </div>

            {error && (
                <Alert variant="destructive" className="shadow-sm">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {loading ? (
                <AutomationLoadingScreen />
            ) : selectedAccountId ? (
                <Tabs
                    defaultValue="overview"
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="w-full space-y-6"
                >
                    <TabsList className="bg-white/80 backdrop-blur-md p-1 border rounded-xl shadow-sm h-14 w-full justify-start overflow-x-auto">
                        <TabsTrigger value="overview" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-md h-full px-6 rounded-lg transition-all gap-2">
                            <LayoutDashboard className="w-4 h-4" /> Overview
                        </TabsTrigger>

                        <TabsTrigger value="inbound" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white h-full px-6 rounded-lg transition-all gap-2">
                            <MessageCircle className="w-4 h-4" /> Inbound
                        </TabsTrigger>

                        <TabsTrigger value="tools" className="data-[state=active]:bg-orange-600 data-[state=active]:text-white h-full px-6 rounded-lg transition-all gap-2">
                            <Zap className="w-4 h-4" /> Tools
                        </TabsTrigger>

                        <TabsTrigger
                            value="ai"
                            className={`h-full px-6 rounded-lg transition-all gap-2 ${!smartAiGate.allowed
                                ? 'opacity-60 cursor-not-allowed'
                                : 'data-[state=active]:bg-indigo-600 data-[state=active]:text-white'
                                }`}
                            disabled={!smartAiGate.allowed}
                        >
                            <Sparkles className="w-4 h-4" /> Smart AI
                            {!smartAiGate.allowed && <Crown className="w-3 h-3 text-amber-500 ml-1" />}
                        </TabsTrigger>

                        <TabsTrigger value="campaigns" className="data-[state=active]:bg-rose-600 data-[state=active]:text-white h-full px-6 rounded-lg transition-all gap-2">
                            <RefreshCw className="w-4 h-4" /> Campaigns
                        </TabsTrigger>
                    </TabsList>

                    {/* ================= OVERVIEW TAB ================= */}
                    <TabsContent value="overview" className="mt-0 focus-visible:outline-none focus-visible:ring-0 space-y-8">
                        <AutomationOverview
                            unlockedLevel={unlockedLevel}
                            onUnlockRequest={() => { }}
                            onNavigate={handleNavigate}
                            accountId={selectedAccountId}
                        />

                        <HowAutomationWorks />
                    </TabsContent>

                    {/* ================= INBOUND TAB ================= */}
                    <TabsContent value="inbound" className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="grid lg:grid-cols-2 gap-6">
                            <WelcomeMessageSection
                                rules={rules}
                                accountId={selectedAccountId}
                                onRefresh={loadAutomationData}
                            />
                            <IceBreakersSection
                                iceBreakers={iceBreakers}
                                accountId={selectedAccountId}
                                onRefresh={loadAutomationData}
                            />
                        </div>

                        {unlockedLevel >= 2 ? (
                            <BusinessHoursSection
                                rules={rules}
                                businessHours={businessHours}
                                accountId={selectedAccountId}
                                onRefresh={loadAutomationData}
                            />
                        ) : (
                            <LockedFeatureBanner
                                title="Business Hours"
                                description="Set specific operating hours and customized away messages."
                                level="Growth"
                                onUnlock={() => openUnlockDialog(2, 'Growth')}
                            />
                        )}
                    </TabsContent>

                    {/* ================= TOOLS TAB ================= */}
                    <TabsContent value="tools" className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                        {unlockedLevel >= 2 ? (
                            <div className="grid lg:grid-cols-2 gap-6">
                                <CommandsSection
                                    rules={rules}
                                    accountId={selectedAccountId}
                                    onRefresh={loadAutomationData}
                                />
                                <KeywordsSection
                                    rules={rules}
                                    accountId={selectedAccountId}
                                    onRefresh={loadAutomationData}
                                />
                            </div>
                        ) : (
                            <LockedFeatureBanner
                                title="Advanced Tools"
                                description="Create custom /slash commands and keyword triggers."
                                level="Growth"
                                onUnlock={() => openUnlockDialog(2, 'Growth')}
                            />
                        )}
                    </TabsContent>

                    {/* ================= SMART AI TAB ================= */}
                    <TabsContent value="ai" className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                        {!smartAiGate.allowed ? (
                            <LockedFeatureBanner
                                title="Smart AI"
                                description={`Smart AI chatbots and FAQ auto-responses are available on ${smartAiGate.requiredPlanLabel} and above plans. Upgrade to unlock.`}
                                level={smartAiGate.requiredPlanLabel || 'Growth'}
                                onUnlock={() => navigate('/subscription')}
                            />
                        ) : unlockedLevel >= 3 ? (
                            <>
                                <AIChatbotSection
                                    accountId={selectedAccountId}
                                    workspaceId={selectedAccount?.workspace_id}
                                />
                                <FAQSection
                                    accountId={selectedAccountId}
                                />
                            </>
                        ) : (
                            <LockedFeatureBanner
                                title="AI Intelligence Suite"
                                description="Unlock Gemini-powered Chatbots and FAQ auto-responses."
                                level="Enterprise"
                                onUnlock={() => openUnlockDialog(3, 'Enterprise')}
                            />
                        )}
                    </TabsContent>

                    {/* ================= CAMPAIGNS TAB ================= */}
                    <TabsContent value="campaigns" className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                        {unlockedLevel >= 3 ? (
                            <>
                                {selectedAccount.workspace_id ? (
                                    <>
                                        <DripCampaignsSection
                                            accountId={selectedAccountId}
                                        />
                                        <TriggeredMessagesSection
                                            accountId={String(selectedAccountId)}
                                        />
                                    </>
                                ) : (
                                    <Alert variant="destructive">
                                        <AlertCircle className="w-4 h-4" />
                                        <AlertDescription>Workspace ID missing. Cannot load campaigns.</AlertDescription>
                                    </Alert>
                                )}
                            </>
                        ) : (
                            <LockedFeatureBanner
                                title="Marketing Campaigns"
                                description="Run advanced Drip Campaigns and API-triggered transactional messages."
                                level="Enterprise"
                                onUnlock={() => openUnlockDialog(3, 'Enterprise')}
                            />
                        )}
                    </TabsContent>
                </Tabs>
            ) : null}

            <div className="mt-12 text-center">
                <p className="text-xs text-muted-foreground/60 flex items-center justify-center gap-2">
                    <img src={logo} alt="Sociovia" className="w-4 h-4 opacity-50" />
                    Powered by Sociovia Automation Engine
                </p>
            </div>
        </div>
    );
}

// Helper for locked state within tabs
function LockedFeatureBanner({ title, description, level, onUnlock }: { title: string, description: string, level: string, onUnlock: () => void }) {
    return (
        <Card className="border-dashed border-2 border-slate-300 bg-slate-50 p-12 text-center shadow-none">
            <div className="flex flex-col items-center justify-center max-w-lg mx-auto">
                <div className="bg-white p-4 rounded-full shadow-sm mb-6 animate-pulse">
                    <Lock className="w-10 h-10 text-slate-400" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-3">{title} is Locked</h3>
                <p className="text-slate-500 mb-8 text-lg">{description}</p>
                <Button onClick={onUnlock} size="lg" className="bg-slate-900 text-white hover:bg-slate-800 shadow-lg hover:shadow-xl transition-all">
                    <Sparkles className="w-4 h-4 mr-2 text-yellow-400" />
                    Unlock {level} Plan
                </Button>
            </div>
        </Card>
    );
}

