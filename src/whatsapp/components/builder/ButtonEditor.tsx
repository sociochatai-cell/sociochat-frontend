// Button Editor Component
// =======================
// Configures template buttons: Quick Reply, URL, Phone, or Flow

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TemplateButton, ButtonType, TemplateCategory } from '../../utils/templateUtils';
import { Plus, Trash2, ExternalLink, Phone, MessageSquare, AlertCircle, Workflow } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Flow {
    id: number;
    meta_flow_id: string;
    name: string;
    status: string;
}

interface ButtonEditorProps {
    buttons: TemplateButton[];
    category: TemplateCategory;
    onChange: (buttons: TemplateButton[]) => void;
    error?: string;
    accountId?: number; // Needed to fetch flows for the same WABA
}

export function ButtonEditor({ buttons, category, onChange, error, accountId }: ButtonEditorProps) {
    const isDisabled = category === 'AUTHENTICATION';
    const maxButtons = 3;
    const [flows, setFlows] = useState<Flow[]>([]);
    const [loadingFlows, setLoadingFlows] = useState(false);

    // Fetch published flows when component mounts or accountId changes
    useEffect(() => {
        console.log('[ButtonEditor] accountId changed:', accountId);
        if (accountId) {
            fetchPublishedFlows();
        }
    }, [accountId]);

    const fetchPublishedFlows = async () => {
        if (!accountId) return;
        try {
            setLoadingFlows(true);
            const url = `/api/whatsapp/flows?account_id=${accountId}&status=PUBLISHED`;
            console.log('[ButtonEditor] Fetching flows from:', url);
            const res = await fetch(url);
            const data = await res.json();
            console.log('[ButtonEditor] Flows API response:', data);
            if (data.success) {
                setFlows(data.flows || []);
                console.log('[ButtonEditor] Set flows:', data.flows?.length || 0, 'flows');
            }
        } catch (err) {
            console.error('[ButtonEditor] Failed to fetch flows:', err);
        } finally {
            setLoadingFlows(false);
        }
    };

    const addButton = () => {
        if (buttons.length >= maxButtons || isDisabled) return;

        onChange([
            ...buttons,
            { type: 'quick_reply', text: '' }
        ]);
    };

    const updateButton = (index: number, updates: Partial<TemplateButton>) => {
        const newButtons = [...buttons];
        newButtons[index] = { ...newButtons[index], ...updates };
        onChange(newButtons);
    };

    const removeButton = (index: number) => {
        onChange(buttons.filter((_, i) => i !== index));
    };

    const getButtonIcon = (type: ButtonType) => {
        switch (type) {
            case 'quick_reply': return <MessageSquare className="w-4 h-4" />;
            case 'url': return <ExternalLink className="w-4 h-4" />;
            case 'phone': return <Phone className="w-4 h-4" />;
            case 'flow': return <Workflow className="w-4 h-4" />;
        }
    };

    if (isDisabled) {
        return (
            <div className="space-y-3">
                <Label className="text-sm font-medium text-muted-foreground">Buttons (Optional)</Label>
                <Alert className="bg-amber-50 border-amber-200">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <AlertDescription className="text-sm text-amber-800">
                        Authentication templates cannot have buttons.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Buttons (Optional)</Label>
                <span className="text-xs text-muted-foreground">
                    {buttons.length}/{maxButtons} buttons
                </span>
            </div>

            {buttons.length === 0 ? (
                <div className="border border-dashed rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                        Add interactive buttons to your template
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addButton}
                        className="gap-1"
                    >
                        <Plus className="w-4 h-4" />
                        Add Button
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {buttons.map((btn, idx) => (
                        <div key={idx} className="border rounded-lg p-3 space-y-3 bg-muted/30">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">Button {idx + 1}</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeButton(idx)}
                                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>

                            <div className="grid grid-cols-[120px_1fr] gap-3">
                                <Select
                                    value={btn.type}
                                    onValueChange={(v) => updateButton(idx, { type: v as ButtonType })}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="quick_reply">
                                            <div className="flex items-center gap-2">
                                                <MessageSquare className="w-4 h-4" />
                                                Quick Reply
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="url">
                                            <div className="flex items-center gap-2">
                                                <ExternalLink className="w-4 h-4" />
                                                URL
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="phone">
                                            <div className="flex items-center gap-2">
                                                <Phone className="w-4 h-4" />
                                                Phone
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="flow">
                                            <div className="flex items-center gap-2">
                                                <Workflow className="w-4 h-4 text-green-600" />
                                                Flow
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>

                                <Input
                                    placeholder="Button text (max 25 chars)"
                                    value={btn.text}
                                    onChange={(e) => updateButton(idx, { text: e.target.value })}
                                    maxLength={25}
                                    className="h-9"
                                />
                            </div>

                            {btn.type === 'url' && (
                                <Input
                                    placeholder="https://example.com/..."
                                    value={btn.url || ''}
                                    onChange={(e) => updateButton(idx, { url: e.target.value })}
                                    className="h-9"
                                />
                            )}

                            {btn.type === 'phone' && (
                                <Input
                                    placeholder="+1234567890"
                                    value={btn.phone || ''}
                                    onChange={(e) => updateButton(idx, { phone: e.target.value })}
                                    className="h-9"
                                />
                            )}

                            {btn.type === 'flow' && (
                                <div className="space-y-2">
                                    <Select
                                        value={btn.flow_id || ''}
                                        onValueChange={(v) => updateButton(idx, { flow_id: v })}
                                    >
                                        <SelectTrigger className="h-9">
                                            <SelectValue placeholder={loadingFlows ? "Loading flows..." : "Select a published flow"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {flows.length === 0 ? (
                                                <div className="p-2 text-sm text-muted-foreground text-center">
                                                    No published flows available
                                                </div>
                                            ) : (
                                                flows.map(flow => (
                                                    <SelectItem key={flow.id} value={flow.meta_flow_id || String(flow.id)}>
                                                        <div className="flex items-center gap-2">
                                                            <Workflow className="w-4 h-4 text-green-600" />
                                                            {flow.name}
                                                            {flow.meta_flow_id?.startsWith('demo_') &&
                                                                <span className="text-xs text-amber-500">(Demo)</span>
                                                            }
                                                        </div>
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                    {flows.length === 0 && !loadingFlows && (
                                        <p className="text-xs text-amber-600">
                                            Create and publish a flow first at /dashboard/flows/new
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}

                    {buttons.length < maxButtons && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addButton}
                            className="w-full gap-1"
                        >
                            <Plus className="w-4 h-4" />
                            Add Button
                        </Button>
                    )}
                </div>
            )}

            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}
        </div>
    );
}

