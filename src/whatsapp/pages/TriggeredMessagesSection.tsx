import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Zap, Plus, Trash2, Copy, Play, Loader2, Code } from 'lucide-react';
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
    trigger_count: number;
    last_triggered_at: string | null;
    webhook_url: string;
}

export function TriggeredMessagesSection({ accountId }: { accountId: number }) {
    const [triggers, setTriggers] = useState<Trigger[]>([]);
    const [loading, setLoading] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

    // Create Dialog
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newTrigger, setNewTrigger] = useState({ name: '', template_name: '', description: '' });
    const [creating, setCreating] = useState(false);

    // Test Dialog
    const [testTrigger, setTestTrigger] = useState<Trigger | null>(null);
    const [testPhone, setTestPhone] = useState('');
    const [testing, setTesting] = useState(false);

    // View Code Dialog
    const [codeTrigger, setCodeTrigger] = useState<Trigger | null>(null);

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

    async function handleCreate() {
        if (!newTrigger.name || !newTrigger.template_name) {
            toast.error("Name and Template Name are required");
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
                setNewTrigger({ name: '', template_name: '', description: '' });
                loadTriggers();
            } else {
                const err = await res.json();
                toast.error(err.error || "Failed to create trigger");
            }
        } catch (err) {
            console.error('Failed to create trigger:', err);
            toast.error("Failed to create trigger");
        } finally {
            setCreating(false);
        }
    }

    async function handleDelete(id: number) {
        if (!confirm("Are you sure? This will break any external integrations using this trigger.")) return;

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
            console.error('Failed to delete trigger:', err);
            toast.error("Failed to delete trigger");
        }
    }

    async function handleTestFire() {
        if (!testTrigger || !testPhone) return;

        try {
            setTesting(true);
            const res = await fetch(`${API_BASE}/api/whatsapp/hooks/${testTrigger.id}?secret=${testTrigger.secret_key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: testPhone })
            });

            const data = await res.json();

            if (res.ok && data.success) {
                toast.success("Trigger fired successfully!");
                setTestTrigger(null);
                setTestPhone('');
                loadTriggers(); // Refresh stats
            } else {
                toast.error(data.error || "Failed to fire trigger");
            }
        } catch (err) {
            console.error('Test fire failed:', err);
            toast.error("Network error firing trigger");
        } finally {
            setTesting(false);
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    const getCurlCommand = (t: Trigger) => {
        const url = `${window.location.protocol}//${window.location.host}${API_BASE}${t.webhook_url}?secret=${t.secret_key}`;
        return `curl -X POST "${url}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "15550239483",
    "variables": ["Order #1234"]
  }'`;
    };

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
                                Send specific templates via API calls (Order Updates, OTPs, Alerts)
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Badge variant="secondary" className="px-3 py-1 font-mono text-xs">
                            {triggers.length} Triggers
                        </Badge>
                        {isOpen ? <div className="text-indigo-500">▼</div> : <div className="text-gray-400">▶</div>}
                    </div>
                </div>
            </CardHeader>

            {isOpen && (
                <CardContent className="pt-0 pb-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex justify-end mb-4">
                        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-indigo-600 hover:bg-indigo-700">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Trigger
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>New API Trigger</DialogTitle>
                                    <DialogDescription>
                                        Create an endpoint to send a specific WhatsApp template.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Friendly Name</Label>
                                        <Input
                                            placeholder="e.g. Order Confirmation"
                                            value={newTrigger.name}
                                            onChange={e => setNewTrigger({ ...newTrigger, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>WhatsApp Template Name</Label>
                                        <Input
                                            placeholder="e.g. order_update_v2"
                                            value={newTrigger.template_name}
                                            onChange={e => setNewTrigger({ ...newTrigger, template_name: e.target.value })}
                                        />
                                        <p className="text-xs text-muted-foreground">Must match an approved template in Meta.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Description (Optional)</Label>
                                        <Input
                                            placeholder="Sent when order status changes"
                                            value={newTrigger.description}
                                            onChange={e => setNewTrigger({ ...newTrigger, description: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                                    <Button onClick={handleCreate} disabled={creating}>
                                        {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Create Trigger
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="rounded-md border bg-white overflow-hidden">
                        <Table>
                            <TableHeader className="bg-gray-50/50">
                                <TableRow>
                                    <TableHead>Trigger Name</TableHead>
                                    <TableHead>Template</TableHead>
                                    <TableHead>Stats</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {triggers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            No API triggers configured yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    triggers.map(trigger => (
                                        <TableRow key={trigger.id}>
                                            <TableCell>
                                                <div className="font-medium">{trigger.name}</div>
                                                <div className="text-xs text-muted-foreground truncate max-w-[200px]">{trigger.description}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono text-xs">{trigger.template_name}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-medium">{trigger.trigger_count} Sent</span>
                                                    {trigger.last_triggered_at && (
                                                        <span className="text-[10px] text-muted-foreground">
                                                            Last: {new Date(trigger.last_triggered_at).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setCodeTrigger(trigger)}
                                                        className="h-8 w-8 p-0"
                                                        title="View Integration Code"
                                                    >
                                                        <Code className="h-4 w-4 text-indigo-600" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setTestTrigger(trigger)}
                                                        className="h-8 w-8 p-0"
                                                        title="Test Fire"
                                                    >
                                                        <Play className="h-4 w-4 text-green-600" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(trigger.id)}
                                                        className="h-8 w-8 p-0 hover:bg-red-50"
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
                </CardContent>
            )}

            {/* Test Dialog */}
            <Dialog open={!!testTrigger} onOpenChange={(open) => !open && setTestTrigger(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Test Fire: {testTrigger?.name}</DialogTitle>
                        <DialogDescription>
                            Send this template to a phone number to test the configuration.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Recipient Phone Number</Label>
                            <Input
                                placeholder="e.g. 15551234567"
                                value={testPhone}
                                onChange={e => setTestPhone(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Only works for numbers in the 24h window if not a template.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTestTrigger(null)}>Cancel</Button>
                        <Button onClick={handleTestFire} disabled={testing || !testPhone}>
                            {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Fire Trigger
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Code View Dialog */}
            <Dialog open={!!codeTrigger} onOpenChange={(open) => !open && setCodeTrigger(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Integration Code</DialogTitle>
                        <DialogDescription>
                            Use this cURL command to fire this trigger from your backend, Zapier, or Make.com.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <div className="relative bg-slate-900 rounded-md p-4 overflow-x-auto">
                            <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                                {codeTrigger ? getCurlCommand(codeTrigger) : ''}
                            </pre>
                            <Button
                                className="absolute top-2 right-2 h-6 w-6"
                                variant="ghost"
                                size="icon"
                                onClick={() => codeTrigger && copyToClipboard(getCurlCommand(codeTrigger))}
                            >
                                <Copy className="h-3 w-3 text-white" />
                            </Button>
                        </div>
                        <p className="mt-4 text-sm text-yellow-600 bg-yellow-50 p-2 rounded border border-yellow-200">
                            ⚠️ Keep your Secret Key safe. Anyone with this URL can send messages from your account.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setCodeTrigger(null)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </Card>
    );
}
