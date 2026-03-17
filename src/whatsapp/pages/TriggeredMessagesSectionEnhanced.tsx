import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, Plus, Trash2, Copy, Play, Loader2, Code, History, Upload, Users, BarChart3, ExternalLink, CheckCircle2, XCircle, Clock, ChevronRight, Book } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config';

const API_BASE = API_BASE_URL;

interface Trigger {
    id: number;
    name: string;
    slug: string;
    description: string;
    template_name: string;
    language: string;
    is_active: boolean;
    secret_key: string;
    variable_count?: number;
    trigger_count: number;
    last_triggered_at: string | null;
    webhook_url: string;
}

interface TriggerLog {
    id: number;
    trigger_id: number;
    recipient_phone: string;
    variables: string[];
    source_type: string;
    source_reference: string;
    success: boolean;
    message_id: string;
    error_message: string;
    delivery_status: string;
    created_at: string;
}

interface TriggerAnalytics {
    summary: {
        total_sent: number;
        total_failed: number;
        total: number;
        delivered: number;
        read: number;
        delivery_rate: number;
        read_rate: number;
    };
    per_trigger: Array<{
        trigger_id: number;
        trigger_name: string;
        total: number;
        success: number;
        failed: number;
    }>;
    daily: Array<{
        date: string;
        total: number;
        success: number;
        failed: number;
    }>;
}

// Integration Guide Component
function IntegrationGuide({ trigger }: { trigger: Trigger }) {
    const [activeTab, setActiveTab] = useState('curl');
    const baseUrl = API_BASE.replace(/\/$/, "");
    const webhookPath = trigger.webhook_url || `/api/whatsapp/hooks/${trigger.id}`;
    const fullUrl = `${baseUrl}${webhookPath}`;
    const varCount = trigger.variable_count || 0;

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    // Generate variable examples
    const variableExamples = varCount > 0
        ? Array.from({ length: varCount }, (_, i) => `"Variable ${i + 1}"`)
        : [];

    const codeExamples = {
        curl: `# Single message
curl -X POST "${fullUrl}?secret=${trigger.secret_key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "1234567890",
    "variables": [${variableExamples.join(', ')}]
  }'

# Bulk send (up to 100 recipients)
curl -X POST "${fullUrl}/bulk?secret=${trigger.secret_key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipients": [
      {"phone": "1234567890", "variables": [${variableExamples.join(', ')}]},
      {"phone": "0987654321", "variables": [${variableExamples.join(', ')}]}
    ]
  }'`,

        python: `import requests

# Configuration
TRIGGER_URL = "${fullUrl}"
SECRET = "${trigger.secret_key}"

# Send single message
def send_whatsapp_message(phone: str, variables: list = None):
    response = requests.post(
        f"{TRIGGER_URL}?secret={SECRET}",
        json={
            "to": phone,
            "variables": variables or []
        }
    )
    return response.json()

# Send to multiple recipients
def send_bulk_messages(recipients: list):
    response = requests.post(
        f"{TRIGGER_URL}/bulk?secret={SECRET}",
        json={"recipients": recipients}
    )
    return response.json()

# Usage
result = send_whatsapp_message("1234567890", [${variableExamples.join(', ')}])
print(result)`,

        nodejs: `const axios = require('axios');

// Configuration
const TRIGGER_URL = "${fullUrl}";
const SECRET = "${trigger.secret_key}";

// Send single message
async function sendWhatsAppMessage(phone, variables = []) {
    try {
        const response = await axios.post(\`\${TRIGGER_URL}?secret=\${SECRET}\`, {
            to: phone,
            variables: variables
        });
        return response.data;
    } catch (error) {
        console.error('Error sending message:', error.response?.data || error.message);
        throw error;
    }
}

// Send to multiple recipients
async function sendBulkMessages(recipients) {
    try {
        const response = await axios.post(\`\${TRIGGER_URL}/bulk?secret=\${SECRET}\`, {
            recipients: recipients
        });
        return response.data;
    } catch (error) {
        console.error('Error sending bulk messages:', error.response?.data || error.message);
        throw error;
    }
}

// Usage
sendWhatsAppMessage("1234567890", [${variableExamples.join(', ')}])
    .then(data => console.log('Success:', data))
    .catch(err => console.error('Failed'));`,

        javascript: `// Configuration
    const TRIGGER_URL = "${fullUrl}";
    const SECRET = "${trigger.secret_key}";

    // Send single message
    async function sendWhatsAppMessage(phone, variables = []) {
        const response = await fetch(\`\${TRIGGER_URL}?secret=\${SECRET}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: phone, variables })
    });
    return response.json();
}

// Send to multiple recipients
async function sendBulkMessages(recipients) {
    const response = await fetch(\`\${TRIGGER_URL}/bulk?secret=\${SECRET}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients })
    });
    return response.json();
}

// Usage
sendWhatsAppMessage("1234567890", [${variableExamples.join(', ')}])
    .then(console.log);`,

        php: `<?php
// Configuration
$triggerUrl = "${fullUrl}";
$secret = "${trigger.secret_key}";

// Send single message
function sendWhatsAppMessage($phone, $variables = []) {
    global $triggerUrl, $secret;
    
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, "{$triggerUrl}?secret={$secret}");
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'to' => $phone,
        'variables' => $variables
    ]));
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    return json_decode($response, true);
}

// Usage
$result = sendWhatsAppMessage("1234567890", [${variableExamples.join(', ')}]);
print_r($result);
?>`,

        shopify: `<!-- Shopify Flow / Custom App Integration -->
<!-- 
Endpoint for Shopify Order Webhooks:
${fullUrl}/ecommerce?secret=${trigger.secret_key}&platform=shopify

Auto-extracted fields from Shopify order:
- Phone: customer.phone or billing_address.phone
- Variables: [first_name, order_number, total_price, currency]

Setup in Shopify:
1. Go to Settings > Notifications > Webhooks
2. Add webhook for "Order creation" event
3. Set URL to the endpoint above
4. Format: JSON

For Shopify Flow:
1. Create a new workflow
2. Trigger: Order created
3. Action: Send HTTP request
4. Method: POST
5. URL: ${fullUrl}/ecommerce?secret=${trigger.secret_key}&platform=shopify
6. Body: {{order}} (JSON)
-->`,

        zapier: `<!-- Zapier / Make.com Integration -->
<!-- 
Endpoint: ${fullUrl}/zapier?secret=${trigger.secret_key}

Setup in Zapier:
1. Trigger: Your trigger (e.g., "New Shopify Order")
2. Action: Webhooks by Zapier > POST
3. URL: ${fullUrl}/zapier?secret=${trigger.secret_key}
4. Payload Type: JSON
5. Data:
   - phone: {{Phone Number Field}}
   - var1: {{First Variable}}
   - var2: {{Second Variable}}
   ...

Example payload:
{
    "phone": "1234567890",
    "var1": "John Doe",
    "var2": "Order #123",
    "var3": "$99.99"
}
-->`
    };

    return (
        <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-amber-800 flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    API Endpoint
                </h4>
                <div className="mt-2 flex items-center gap-2">
                    <code className="bg-amber-100 px-3 py-1.5 rounded text-sm font-mono flex-1 truncate">
                        POST {fullUrl}
                    </code>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(fullUrl)}
                    >
                        <Copy className="w-4 h-4" />
                    </Button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-amber-700">Secret Key:</span>
                    <code className="bg-amber-100 px-2 py-1 rounded text-xs font-mono">
                        {trigger.secret_key.substring(0, 8)}...
                    </code>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(trigger.secret_key)}
                    >
                        <Copy className="w-3 h-3" />
                    </Button>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-6">
                    <TabsTrigger value="curl">cURL</TabsTrigger>
                    <TabsTrigger value="python">Python</TabsTrigger>
                    <TabsTrigger value="nodejs">Node.js</TabsTrigger>
                    <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                    <TabsTrigger value="php">PHP</TabsTrigger>
                    <TabsTrigger value="shopify">Shopify</TabsTrigger>
                    <TabsTrigger value="zapier">Zapier</TabsTrigger>
                </TabsList>

                {Object.entries(codeExamples).map(([key, code]) => (
                    <TabsContent key={key} value={key} className="mt-4">
                        <div className="relative">
                            <pre className="bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto text-xs font-mono whitespace-pre-wrap">
                                {code}
                            </pre>
                            <Button
                                className="absolute top-2 right-2"
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(code)}
                            >
                                <Copy className="w-4 h-4 text-white" />
                            </Button>
                        </div>
                    </TabsContent>
                ))}
            </Tabs>

            {varCount > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <h4 className="font-medium text-blue-800">Template Variables</h4>
                    <p className="text-sm text-blue-700 mt-1">
                        This template requires <strong>{varCount} variable(s)</strong>.
                        Pass them in the <code className="bg-blue-100 px-1 rounded">variables</code> array in order.
                    </p>
                </div>
            )}
        </div>
    );
}

// Trigger Logs Component
function TriggerLogsView({ accountId, triggerId }: { accountId: string; triggerId?: number }) {
    const [logs, setLogs] = useState<TriggerLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all');

    useEffect(() => {
        loadLogs();
    }, [accountId, triggerId, filter]);

    async function loadLogs() {
        try {
            setLoading(true);
            let url = `${API_BASE}/api/whatsapp/accounts/${accountId}/trigger-logs?limit=50`;
            if (triggerId) url += `&trigger_id=${triggerId}`;
            if (filter !== 'all') url += `&success=${filter === 'success'}`;

            const res = await fetch(url, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs || []);
            }
        } catch (err) {
            console.error('Failed to load logs:', err);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h4 className="font-medium">Recent Activity</h4>
                <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
                    <SelectTrigger className="w-32">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {loading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
            ) : logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                    No trigger activity yet
                </div>
            ) : (
                <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                        {logs.map((log) => (
                            <div
                                key={log.id}
                                className={`p-3 rounded-lg border ${log.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {log.success ? (
                                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                                        ) : (
                                            <XCircle className="w-4 h-4 text-red-600" />
                                        )}
                                        <span className="font-mono text-sm">{log.recipient_phone}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(log.created_at).toLocaleString()}
                                    </span>
                                </div>
                                {log.variables?.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {log.variables.map((v, i) => (
                                            <Badge key={i} variant="secondary" className="text-[10px]">
                                                {v}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                                {log.error_message && (
                                    <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-[10px]">{log.source_type}</Badge>
                                    {log.delivery_status && (
                                        <Badge variant={log.delivery_status === 'read' ? 'default' : 'secondary'} className="text-[10px]">
                                            {log.delivery_status}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            )}
        </div>
    );
}

// Analytics Component
function TriggerAnalyticsView({ accountId }: { accountId: string }) {
    const [analytics, setAnalytics] = useState<TriggerAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(7);

    useEffect(() => {
        loadAnalytics();
    }, [accountId, days]);

    async function loadAnalytics() {
        try {
            setLoading(true);
            const res = await fetch(
                `${API_BASE}/api/whatsapp/accounts/${accountId}/trigger-analytics?days=${days}`,
                { credentials: 'include' }
            );
            if (res.ok) {
                const data = await res.json();
                setAnalytics(data);
            }
        } catch (err) {
            console.error('Failed to load analytics:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!analytics) {
        return <div className="text-center py-8 text-muted-foreground">No analytics data</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h4 className="font-medium">Analytics Overview</h4>
                <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
                    <SelectTrigger className="w-32">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="14">Last 14 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{analytics.summary.total}</div>
                    <div className="text-xs text-blue-700">Total Sent</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{analytics.summary.delivered}</div>
                    <div className="text-xs text-green-700">Delivered</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600">{analytics.summary.read}</div>
                    <div className="text-xs text-purple-700">Read</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{analytics.summary.total_failed}</div>
                    <div className="text-xs text-red-700">Failed</div>
                </div>
            </div>

            {/* Per-Trigger Stats */}
            {analytics.per_trigger.length > 0 && (
                <div>
                    <h5 className="font-medium mb-2">By Trigger</h5>
                    <div className="space-y-2">
                        {analytics.per_trigger.map((t) => (
                            <div key={t.trigger_id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                                <span className="font-medium">{t.trigger_name}</span>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-green-600">{t.success} sent</span>
                                    {t.failed > 0 && <span className="text-sm text-red-600">{t.failed} failed</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// Main Enhanced Component
export function TriggeredMessagesSectionEnhanced({ accountId }: { accountId: string }) {
    const [triggers, setTriggers] = useState<Trigger[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);

    // Dialog states
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newTrigger, setNewTrigger] = useState({ name: '', template_name: '', description: '', language: 'en_US' });
    const [creating, setCreating] = useState(false);
    const [selectedTrigger, setSelectedTrigger] = useState<Trigger | null>(null);
    const [viewMode, setViewMode] = useState<'code' | 'logs' | 'analytics'>('code');

    useEffect(() => {
        if (isOpen && accountId) {
            loadTriggers();
        }
    }, [isOpen, accountId]);

    async function loadTriggers() {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/triggers`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setTriggers(data.triggers || []);
            }
        } catch (err) {
            console.error('Failed to load triggers:', err);
            toast.error("Failed to load triggers");
        } finally {
            setLoading(false);
        }
    }

    async function loadTemplates() {
        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/templates?account_id=${accountId}&status=APPROVED`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setTemplates(data.templates || []);
            }
        } catch (err) {
            console.error('Failed to load templates:', err);
        }
    }

    async function handleCreate() {
        if (!newTrigger.name || !newTrigger.template_name) {
            toast.error("Name and Template are required");
            return;
        }

        try {
            setCreating(true);
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/triggers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(newTrigger)
            });

            if (res.ok) {
                toast.success("Trigger created successfully");
                setIsCreateOpen(false);
                setNewTrigger({ name: '', template_name: '', description: '', language: 'en_US' });
                loadTriggers();
            } else {
                const err = await res.json();
                toast.error(err.error || "Failed to create trigger");
            }
        } catch (err) {
            toast.error("Failed to create trigger");
        } finally {
            setCreating(false);
        }
    }

    async function handleDelete(id: number) {
        if (!confirm("Are you sure? This will break any integrations using this trigger.")) return;

        try {
            const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/triggers/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (res.ok) {
                toast.success("Trigger deleted");
                setTriggers(triggers.filter(t => t.id !== id));
            }
        } catch (err) {
            toast.error("Failed to delete trigger");
        }
    }

    async function handleTestFire(trigger: Trigger, phone: string) {
        try {
            const payload: any = { to: phone };
            const varCount = trigger.variable_count || 0;
            if (varCount > 0) {
                payload.variables = Array.from({ length: varCount }, (_, i) => `test_var_${i + 1}`);
            }

            const res = await fetch(`${API_BASE}/api/whatsapp/hooks/${trigger.id}?secret=${trigger.secret_key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Test message sent!");
                loadTriggers();
            } else {
                toast.error(data.error || "Failed to send");
            }
        } catch (err) {
            toast.error("Network error");
        }
    }

    return (
        <Card className="border shadow-sm bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/30">
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-500" />
            <CardHeader
                className="cursor-pointer hover:bg-gray-50/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 shadow-sm">
                            <Zap className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <CardTitle className="text-xl flex items-center gap-2">
                                Triggered Messages
                                <Badge variant="outline" className="ml-2 font-normal text-xs bg-white/50 text-indigo-600 border-indigo-200">
                                    API
                                </Badge>
                            </CardTitle>
                            <CardDescription>
                                Send templates via API - integrate with Shopify, WooCommerce, Zapier & more
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="px-3 py-1 font-mono text-xs">
                            {triggers.length} Triggers
                        </Badge>
                        <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                    </div>
                </div>
            </CardHeader>

            {isOpen && (
                <CardContent className="pt-0 pb-6 animate-in slide-in-from-top-2 duration-200">
                    {/* Action Bar */}
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(`${API_BASE}/api/whatsapp/triggers/api-docs`, '_blank')}
                            >
                                <Book className="w-4 h-4 mr-1" />
                                API Docs
                            </Button>
                        </div>
                        <Dialog open={isCreateOpen} onOpenChange={(open) => {
                            setIsCreateOpen(open);
                            if (open) loadTemplates();
                        }}>
                            <DialogTrigger asChild>
                                <Button className="bg-indigo-600 hover:bg-indigo-700">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Trigger
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Create API Trigger</DialogTitle>
                                    <DialogDescription>
                                        Create an endpoint to send WhatsApp templates programmatically.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Trigger Name</Label>
                                        <Input
                                            placeholder="e.g. Order Confirmation"
                                            value={newTrigger.name}
                                            onChange={e => setNewTrigger({ ...newTrigger, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Template</Label>
                                        <Select
                                            value={newTrigger.template_name ? `${newTrigger.template_name}|${newTrigger.language}` : ''}
                                            onValueChange={(val) => {
                                                const [name, lang] = val.split('|');
                                                setNewTrigger({ ...newTrigger, template_name: name, language: lang });
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select an approved template" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {templates.map(t => (
                                                    <SelectItem key={`${t.name}-${t.language}`} value={`${t.name}|${t.language}`}>
                                                        {t.name} ({t.language})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Description (Optional)</Label>
                                        <Textarea
                                            placeholder="What is this trigger used for?"
                                            value={newTrigger.description}
                                            onChange={e => setNewTrigger({ ...newTrigger, description: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                                    <Button onClick={handleCreate} disabled={creating}>
                                        {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Create
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Triggers Table */}
                    <div className="rounded-md border bg-white overflow-hidden">
                        <Table>
                            <TableHeader className="bg-gray-50/50">
                                <TableRow>
                                    <TableHead>Trigger</TableHead>
                                    <TableHead>Template</TableHead>
                                    <TableHead>Stats</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {triggers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-12">
                                            <div className="flex flex-col items-center gap-3">
                                                <Zap className="w-12 h-12 text-gray-200" />
                                                <p className="text-muted-foreground">No triggers configured yet</p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => setIsCreateOpen(true)}
                                                >
                                                    Create your first trigger
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    triggers.map(trigger => (
                                        <TableRow key={trigger.id}>
                                            <TableCell>
                                                <div className="font-medium">{trigger.name}</div>
                                                {trigger.description && (
                                                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                                        {trigger.description}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono text-xs">
                                                    {trigger.template_name}
                                                </Badge>
                                                {trigger.variable_count && trigger.variable_count > 0 && (
                                                    <span className="text-[10px] text-muted-foreground ml-1">
                                                        ({trigger.variable_count} vars)
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm font-medium">{trigger.trigger_count} Sent</div>
                                                {trigger.last_triggered_at && (
                                                    <div className="text-[10px] text-muted-foreground">
                                                        Last: {new Date(trigger.last_triggered_at).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => { setSelectedTrigger(trigger); setViewMode('code'); }}
                                                        title="Integration Code"
                                                    >
                                                        <Code className="h-4 w-4 text-indigo-600" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => { setSelectedTrigger(trigger); setViewMode('logs'); }}
                                                        title="View Logs"
                                                    >
                                                        <History className="h-4 w-4 text-blue-600" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(trigger.id)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Analytics Quick View */}
                    {triggers.length > 0 && (
                        <div className="mt-6">
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => { setSelectedTrigger(null); setViewMode('analytics'); }}
                            >
                                <BarChart3 className="w-4 h-4 mr-2" />
                                View Analytics Dashboard
                            </Button>
                        </div>
                    )}

                    {/* Detail Dialog */}
                    <Dialog open={!!selectedTrigger || viewMode === 'analytics'} onOpenChange={(open) => {
                        if (!open) { setSelectedTrigger(null); setViewMode('code'); }
                    }}>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                            {selectedTrigger ? (
                                <>
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <Zap className="w-5 h-5 text-indigo-600" />
                                            {selectedTrigger.name}
                                        </DialogTitle>
                                        <DialogDescription>
                                            Template: {selectedTrigger.template_name}
                                        </DialogDescription>
                                    </DialogHeader>

                                    <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                                        <TabsList>
                                            <TabsTrigger value="code">
                                                <Code className="w-4 h-4 mr-1" />
                                                Integration
                                            </TabsTrigger>
                                            <TabsTrigger value="logs">
                                                <History className="w-4 h-4 mr-1" />
                                                Logs
                                            </TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="code" className="mt-4">
                                            <IntegrationGuide trigger={selectedTrigger} />
                                        </TabsContent>

                                        <TabsContent value="logs" className="mt-4">
                                            <TriggerLogsView accountId={accountId} triggerId={selectedTrigger.id} />
                                        </TabsContent>
                                    </Tabs>
                                </>
                            ) : viewMode === 'analytics' ? (
                                <>
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <BarChart3 className="w-5 h-5 text-indigo-600" />
                                            Trigger Analytics
                                        </DialogTitle>
                                    </DialogHeader>
                                    <TriggerAnalyticsView accountId={accountId} />
                                </>
                            ) : null}
                        </DialogContent>
                    </Dialog>
                </CardContent>
            )}
        </Card>
    );
}
