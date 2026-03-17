// WhatsApp Help Guide Page
// ========================
// Comprehensive documentation and help for WhatsApp integration
// Clean, interactive, production-level UI

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    MessageCircle,
    ChevronDown,
    ChevronRight,
    ArrowLeft,
    Zap,
    FileText,
    Send,
    Clock,
    Shield,
    AlertTriangle,
    CheckCircle,
    Info,
    ExternalLink,
    BookOpen,
    Link2,
    Users,
    BarChart3,
    Settings,
    HelpCircle,
    Lightbulb,
    Target,
    XCircle,
    RefreshCw
} from 'lucide-react';
import logo from '@/assets/sociovia_logo.png';

interface AccordionItem {
    id: string;
    title: string;
    icon: React.ReactNode;
    content: React.ReactNode;
}

export function WhatsAppGuide() {
    const navigate = useNavigate();
    const [openSection, setOpenSection] = useState<string | null>('getting-started');

    const toggleSection = (id: string) => {
        setOpenSection(openSection === id ? null : id);
    };

    const sections: AccordionItem[] = [
        {
            id: 'getting-started',
            title: 'Getting Started',
            icon: <Zap className="w-5 h-5 text-green-600" />,
            content: (
                <div className="space-y-6">
                    <p className="text-muted-foreground">
                        Connect your WhatsApp Business Account to start engaging with customers directly through SocioChat.
                    </p>

                    <div className="grid gap-4">
                        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-green-100">
                                    <Shield className="w-4 h-4 text-green-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-green-900">Option 1: Embedded Signup (Recommended)</h4>
                                    <p className="text-sm text-green-700 mt-1">
                                        The fastest way to connect. Uses Meta's official signup flow directly in SocioChat.
                                        No external steps required.
                                    </p>
                                    <ul className="mt-3 space-y-1 text-sm text-green-700">
                                        <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3" /> Automatic token generation</li>
                                        <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3" /> Auto-discovers WABA & phone numbers</li>
                                        <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3" /> No manual credential entry</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-blue-100">
                                    <Link2 className="w-4 h-4 text-blue-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-blue-900">Option 2: Facebook Login</h4>
                                    <p className="text-sm text-blue-700 mt-1">
                                        Sign in with your Facebook account to grant WhatsApp permissions. Best for existing
                                        Meta Business accounts.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-gray-100">
                                    <Settings className="w-4 h-4 text-gray-600" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-900">Option 3: Manual Connect</h4>
                                    <p className="text-sm text-gray-600 mt-1">
                                        For advanced users who already have WhatsApp Cloud API credentials. Enter your
                                        WABA ID, Phone Number ID, and Access Token manually.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button onClick={() => navigate('/dashboard/setup')} className="bg-[#25D366] hover:bg-[#128C7E]">
                            <Zap className="w-4 h-4 mr-2" />
                            Connect Now
                        </Button>
                        <Button variant="outline" onClick={() => window.open('https://developers.facebook.com/docs/whatsapp/cloud-api', '_blank')}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Meta Docs
                        </Button>
                    </div>
                </div>
            )
        },
        {
            id: 'messaging',
            title: 'Understanding Messaging',
            icon: <Send className="w-5 h-5 text-blue-600" />,
            content: (
                <div className="space-y-6">
                    <p className="text-muted-foreground">
                        WhatsApp has specific rules about messaging to protect users from spam. Understanding these is crucial.
                    </p>

                    {/* 24-Hour Window */}
                    <div className="p-5 bg-amber-50 rounded-xl border border-amber-200">
                        <div className="flex items-center gap-2 mb-3">
                            <Clock className="w-5 h-5 text-amber-600" />
                            <h4 className="font-semibold text-amber-900">The 24-Hour Messaging Window</h4>
                        </div>
                        <p className="text-sm text-amber-800 mb-4">
                            When a customer messages you first, a 24-hour "session" opens. During this window:
                        </p>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-amber-100">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">Send unlimited free-form messages</span>
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-amber-100">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">Respond naturally to their questions</span>
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-amber-100">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">Send images, documents, media</span>
                            </div>
                            <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-amber-100">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span className="text-sm">No template required</span>
                            </div>
                        </div>
                    </div>

                    {/* Outside 24 Hours */}
                    <div className="p-5 bg-red-50 rounded-xl border border-red-200">
                        <div className="flex items-center gap-2 mb-3">
                            <XCircle className="w-5 h-5 text-red-600" />
                            <h4 className="font-semibold text-red-900">Outside the 24-Hour Window</h4>
                        </div>
                        <p className="text-sm text-red-800">
                            After 24 hours with no customer response, you can <strong>only</strong> send pre-approved
                            template messages. This prevents spam and maintains trust.
                        </p>
                    </div>

                    {/* Message Types */}
                    <div className="grid sm:grid-cols-2 gap-4 mt-4">
                        <div className="p-4 bg-white rounded-xl border shadow-sm">
                            <h5 className="font-semibold mb-2 flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 text-green-600" />
                                Session Messages
                            </h5>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Any text, media, or interactive message</li>
                                <li>• Free (no per-conversation charge)</li>
                                <li>• Only within 24-hour window</li>
                            </ul>
                        </div>
                        <div className="p-4 bg-white rounded-xl border shadow-sm">
                            <h5 className="font-semibold mb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-600" />
                                Template Messages
                            </h5>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Pre-approved by Meta</li>
                                <li>• Per-conversation pricing applies</li>
                                <li>• Can be sent anytime</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'templates',
            title: 'Message Templates',
            icon: <FileText className="w-5 h-5 text-purple-600" />,
            content: (
                <div className="space-y-6">
                    <p className="text-muted-foreground">
                        Templates are pre-approved message formats required for initiating conversations or messaging outside the 24-hour window.
                    </p>

                    {/* Template Categories */}
                    <div className="grid sm:grid-cols-3 gap-4">
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 text-center">
                            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-blue-100 flex items-center justify-center">
                                <Settings className="w-5 h-5 text-blue-600" />
                            </div>
                            <h5 className="font-semibold text-blue-900">Utility</h5>
                            <p className="text-xs text-blue-700 mt-1">
                                Order updates, shipping confirmations, account alerts
                            </p>
                            <span className="text-xs text-blue-600 mt-2 inline-block">Lowest cost</span>
                        </div>
                        <div className="p-4 bg-purple-50 rounded-xl border border-purple-200 text-center">
                            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-purple-100 flex items-center justify-center">
                                <Target className="w-5 h-5 text-purple-600" />
                            </div>
                            <h5 className="font-semibold text-purple-900">Marketing</h5>
                            <p className="text-xs text-purple-700 mt-1">
                                Promotions, offers, re-engagement, newsletters
                            </p>
                            <span className="text-xs text-purple-600 mt-2 inline-block">Higher cost</span>
                        </div>
                        <div className="p-4 bg-green-50 rounded-xl border border-green-200 text-center">
                            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-green-100 flex items-center justify-center">
                                <Shield className="w-5 h-5 text-green-600" />
                            </div>
                            <h5 className="font-semibold text-green-900">Authentication</h5>
                            <p className="text-xs text-green-700 mt-1">
                                OTPs, 2FA codes, login verification
                            </p>
                            <span className="text-xs text-green-600 mt-2 inline-block">Special handling</span>
                        </div>
                    </div>

                    {/* Tips */}
                    <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                        <h5 className="font-semibold mb-3 flex items-center gap-2">
                            <Lightbulb className="w-5 h-5 text-amber-500" />
                            Template Best Practices
                        </h5>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                Use clear, specific names (e.g., <code className="bg-white/50 px-1 rounded">order_shipped_v2</code>)
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                Keep messages concise and valuable to the user
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                Include an opt-out option for marketing messages
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                Test templates before large broadcasts
                            </li>
                        </ul>
                    </div>

                    <Button onClick={() => navigate('/dashboard/templates')} variant="outline">
                        <FileText className="w-4 h-4 mr-2" />
                        Manage Templates
                    </Button>
                </div>
            )
        },
        {
            id: 'flows',
            title: 'Flows & Automation',
            icon: <Zap className="w-5 h-5 text-orange-600" />,
            content: (
                <div className="space-y-6">
                    <p className="text-muted-foreground">
                        WhatsApp Flows are interactive forms and multi-step experiences that run natively within WhatsApp.
                    </p>

                    <div className="p-5 bg-orange-50 rounded-xl border border-orange-200">
                        <h4 className="font-semibold text-orange-900 mb-3">What Can Flows Do?</h4>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 text-sm text-orange-800">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                Collect lead information
                            </div>
                            <div className="flex items-center gap-2 text-sm text-orange-800">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                Book appointments
                            </div>
                            <div className="flex items-center gap-2 text-sm text-orange-800">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                Take orders and payments
                            </div>
                            <div className="flex items-center gap-2 text-sm text-orange-800">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                Run surveys and feedback forms
                            </div>
                            <div className="flex items-center gap-2 text-sm text-orange-800">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                Customer support routing
                            </div>
                            <div className="flex items-center gap-2 text-sm text-orange-800">
                                <CheckCircle className="w-4 h-4 text-green-500" />
                                Product catalogs
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-xl border">
                        <div className="flex items-center gap-2 mb-2">
                            <Info className="w-4 h-4 text-blue-500" />
                            <span className="font-medium text-sm">Note</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Flows can only be triggered within the 24-hour messaging window (via interactive messages)
                            or through template buttons. They require Meta app approval for production use.
                        </p>
                    </div>

                    <Button onClick={() => navigate('/dashboard/flows')} variant="outline">
                        <Zap className="w-4 h-4 mr-2" />
                        View Flows
                    </Button>
                </div>
            )
        },
        {
            id: 'automations',
            title: 'Automation Features',
            icon: <Zap className="w-5 h-5 text-amber-500" />,
            content: (
                <div className="space-y-6">
                    <p className="text-muted-foreground">
                        SocioChat provides a powerful suite of automation tools to engage customers 24/7.
                    </p>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-white rounded-xl border shadow-sm">
                            <h5 className="font-semibold mb-2 flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 text-green-600" />
                                Welcome & Away
                            </h5>
                            <p className="text-sm text-muted-foreground">
                                Auto-greet new customers and inform them when you are out of office.
                            </p>
                        </div>
                        <div className="p-4 bg-white rounded-xl border shadow-sm">
                            <h5 className="font-semibold mb-2 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-purple-600" />
                                Commands
                            </h5>
                            <p className="text-sm text-muted-foreground">
                                Allow users to trigger actions by typing slash commands like <code>/help</code> or <code>/menu</code>.
                            </p>
                        </div>
                        <div className="p-4 bg-white rounded-xl border shadow-sm">
                            <h5 className="font-semibold mb-2 flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-blue-600" />
                                FAQ & AI Chatbot
                            </h5>
                            <p className="text-sm text-muted-foreground">
                                Instant answers for common questions, powered by Gemini AI for complex queries.
                            </p>
                        </div>
                        <div className="p-4 bg-white rounded-xl border shadow-sm">
                            <h5 className="font-semibold mb-2 flex items-center gap-2">
                                <RefreshCw className="w-4 h-4 text-emerald-600" />
                                Drip Campaigns
                            </h5>
                            <p className="text-sm text-muted-foreground">
                                Nurture leads with scheduled sequences of messages over days or weeks.
                            </p>
                        </div>
                        <div className="p-4 bg-white rounded-xl border shadow-sm">
                            <h5 className="font-semibold mb-2 flex items-center gap-2">
                                <Zap className="w-4 h-4 text-yellow-600" />
                                API Triggers
                            </h5>
                            <p className="text-sm text-muted-foreground">
                                Fire messages from your external systems (e.g. Order Confirmation) via secure API.
                            </p>
                        </div>
                        <div className="p-4 bg-white rounded-xl border shadow-sm">
                            <h5 className="font-semibold mb-2 flex items-center gap-2">
                                <Target className="w-4 h-4 text-orange-600" />
                                Keywords
                            </h5>
                            <p className="text-sm text-muted-foreground">
                                Trigger specific responses when users type keywords like "price" or "location".
                            </p>
                        </div>
                    </div>

                    <Button onClick={() => navigate('/dashboard/automation')} className="bg-amber-600 hover:bg-amber-700 text-white">
                        <Settings className="w-4 h-4 mr-2" />
                        Configure Automations
                    </Button>
                </div>
            )
        },
        {
            id: 'best-practices',
            title: 'Best Practices',
            icon: <Lightbulb className="w-5 h-5 text-amber-600" />,
            content: (
                <div className="space-y-6">
                    <p className="text-muted-foreground">
                        Follow these guidelines to maintain a high-quality account and avoid restrictions.
                    </p>

                    <div className="grid gap-4">
                        {/* Quality Rating */}
                        <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                            <h5 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4" />
                                Quality Rating
                            </h5>
                            <p className="text-sm text-green-800 mb-3">
                                Meta monitors your messaging quality. Your rating can be:
                            </p>
                            <div className="flex gap-2 flex-wrap">
                                <span className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-xs font-medium">
                                    🟢 Green - Excellent
                                </span>
                                <span className="px-3 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs font-medium">
                                    🟡 Yellow - Medium
                                </span>
                                <span className="px-3 py-1 bg-red-200 text-red-800 rounded-full text-xs font-medium">
                                    🔴 Red - Low
                                </span>
                            </div>
                        </div>

                        {/* Do's */}
                        <div className="p-4 bg-white rounded-xl border shadow-sm">
                            <h5 className="font-semibold mb-3 flex items-center gap-2 text-green-700">
                                <CheckCircle className="w-4 h-4" />
                                Do's
                            </h5>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" />
                                    Get explicit opt-in before sending messages
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" />
                                    Provide clear opt-out instructions
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" />
                                    Respond to customers promptly
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle className="w-3 h-3 text-green-500 mt-1 flex-shrink-0" />
                                    Send relevant, valuable content
                                </li>
                            </ul>
                        </div>

                        {/* Don'ts */}
                        <div className="p-4 bg-white rounded-xl border shadow-sm">
                            <h5 className="font-semibold mb-3 flex items-center gap-2 text-red-700">
                                <XCircle className="w-4 h-4" />
                                Don'ts
                            </h5>
                            <ul className="space-y-2 text-sm text-muted-foreground">
                                <li className="flex items-start gap-2">
                                    <XCircle className="w-3 h-3 text-red-500 mt-1 flex-shrink-0" />
                                    Send unsolicited marketing messages
                                </li>
                                <li className="flex items-start gap-2">
                                    <XCircle className="w-3 h-3 text-red-500 mt-1 flex-shrink-0" />
                                    Buy or scrape phone number lists
                                </li>
                                <li className="flex items-start gap-2">
                                    <XCircle className="w-3 h-3 text-red-500 mt-1 flex-shrink-0" />
                                    Ignore customer block/report signals
                                </li>
                                <li className="flex items-start gap-2">
                                    <XCircle className="w-3 h-3 text-red-500 mt-1 flex-shrink-0" />
                                    Send too many messages too frequently
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'troubleshooting',
            title: 'Troubleshooting',
            icon: <HelpCircle className="w-5 h-5 text-red-600" />,
            content: (
                <div className="space-y-6">
                    <p className="text-muted-foreground">
                        Common issues and how to resolve them.
                    </p>

                    <div className="space-y-4">
                        {/* Issue 1 */}
                        <div className="p-4 bg-white rounded-xl border shadow-sm">
                            <h5 className="font-semibold mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                "Account not connected" error
                            </h5>
                            <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                                <li>• Go to Settings → Re-connect your account</li>
                                <li>• Check if your access token has expired</li>
                                <li>• Ensure you have the required Meta Business permissions</li>
                            </ul>
                        </div>

                        {/* Issue 2 */}
                        <div className="p-4 bg-white rounded-xl border shadow-sm">
                            <h5 className="font-semibold mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                Messages not sending
                            </h5>
                            <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                                <li>• Check if you're outside the 24-hour window (use templates)</li>
                                <li>• Verify the recipient's phone number format (+country code)</li>
                                <li>• Check your messaging limits in Meta Business Suite</li>
                            </ul>
                        </div>

                        {/* Issue 3 */}
                        <div className="p-4 bg-white rounded-xl border shadow-sm">
                            <h5 className="font-semibold mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                Templates rejected by Meta
                            </h5>
                            <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                                <li>• Review Meta's template policy guidelines</li>
                                <li>• Avoid promotional language in Utility templates</li>
                                <li>• Use proper variable placeholders ({"{{1}}"}, {"{{2}}"})</li>
                                <li>• Don't include phone numbers or URLs in template text</li>
                            </ul>
                        </div>

                        {/* Issue 4 */}
                        <div className="p-4 bg-white rounded-xl border shadow-sm">
                            <h5 className="font-semibold mb-2 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                Not receiving incoming messages
                            </h5>
                            <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                                <li>• Verify your webhook is properly configured</li>
                                <li>• Check webhook URL is accessible from the internet</li>
                                <li>• Confirm "messages" webhook field is subscribed</li>
                            </ul>
                        </div>
                    </div>

                    <Button onClick={() => navigate('/dashboard/settings')} variant="outline">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Check Connection Status
                    </Button>
                </div>
            )
        }
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-green-50/30">
            <div className="container mx-auto p-6 max-w-4xl">
                {/* Header */}
                <div className="mb-8">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/dashboard/settings')}
                        className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Settings
                    </Button>

                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-lg">
                            <BookOpen className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">WhatsApp Help Guide</h1>
                            <p className="text-muted-foreground">Everything you need to know about WhatsApp integration</p>
                        </div>
                    </div>
                </div>

                {/* Accordion Sections */}
                <div className="space-y-3">
                    {sections.map((section) => (
                        <Card key={section.id} className="border shadow-sm overflow-hidden">
                            <button
                                onClick={() => toggleSection(section.id)}
                                className="w-full text-left"
                            >
                                <CardHeader className="hover:bg-gray-50 transition-colors cursor-pointer">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-gray-100">
                                                {section.icon}
                                            </div>
                                            <CardTitle className="text-lg">{section.title}</CardTitle>
                                        </div>
                                        <ChevronDown
                                            className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${openSection === section.id ? 'rotate-180' : ''
                                                }`}
                                        />
                                    </div>
                                </CardHeader>
                            </button>

                            {openSection === section.id && (
                                <CardContent className="border-t pt-6 animate-in slide-in-from-top-2 duration-200">
                                    {section.content}
                                </CardContent>
                            )}
                        </Card>
                    ))}
                </div>

                {/* Support Section */}
                <Card className="mt-8 border-0 shadow-xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white overflow-hidden">
                    <CardContent className="p-8">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-white/20">
                                    <Users className="w-8 h-8" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Still need help?</h3>
                                    <p className="text-indigo-100">Our support team is ready to assist you</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    variant="secondary"
                                    className="bg-white text-black hover:bg-indigo-50"
                                    onClick={() => window.open('https://developers.facebook.com/docs/whatsapp/cloud-api', '_blank')}
                                >
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Meta Docs
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border-white/30 text-black hover:bg-white/10"
                                    onClick={() => window.open('mailto:support@sociovia.com', '_blank')}
                                >
                                    <Send className="w-4 h-4 mr-2" />
                                    Contact Us
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Footer */}
                <div className="mt-12 text-center">
                    <p className="text-xs text-muted-foreground/60 flex items-center justify-center gap-2">
                        <img src={logo} alt="Sociovia" className="w-4 h-4 opacity-50" />
                        Powered by Meta WhatsApp Business Platform
                    </p>
                </div>
            </div>
        </div>
    );
}

export default WhatsAppGuide;
