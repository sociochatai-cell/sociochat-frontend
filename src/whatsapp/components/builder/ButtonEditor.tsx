// Button Editor Component
// =======================
// Configures template buttons: Quick Reply, URL, Phone, or Flow

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TemplateButton, ButtonType, TemplateCategory } from '../../utils/templateUtils';
import { Plus, Trash2, ExternalLink, Phone, MessageSquare, AlertCircle, Workflow, Copy, PhoneCall, Store } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WHATSAPP_REST_API_PREFIX } from '@/config';

interface Flow {
    id: number;
    meta_flow_id: string;
    name: string;
    status: string;
    entry_screen_id?: string; // the flow's first screen — used as navigate_screen
}

interface VoiceCallCapability {
    success: boolean;
    strict_mode: boolean;
    voice_calling_ready: boolean;
    block_template_submission: boolean;
    receive_in_sociovia_dashboard: boolean;
    receive_path?: string;
    warnings?: string[];
}

interface ButtonEditorProps {
    buttons: TemplateButton[];
    category: TemplateCategory;
    onChange: (buttons: TemplateButton[]) => void;
    error?: string;
    accountId?: number; // Needed to fetch flows for the same WABA
    voiceCallCapability?: VoiceCallCapability | null;
    loadingVoiceCallCapability?: boolean;
}

export function ButtonEditor({
    buttons,
    category,
    onChange,
    error,
    accountId,
    voiceCallCapability,
    loadingVoiceCallCapability,
}: ButtonEditorProps) {
    const isDisabled = category === 'AUTHENTICATION';
    const maxButtons = 10;
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
            const url = `${WHATSAPP_REST_API_PREFIX}/flows?account_id=${accountId}&status=PUBLISHED`;
            console.log('[ButtonEditor] Fetching flows from:', url);
            const res = await fetch(url, { credentials: 'include' });
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

    // Backfill navigate_screen for any flow button that already has a flow_id but
    // no screen (e.g. editing a saved draft) once the flows (with entry_screen_id)
    // load — so the user never has to supply the screen id manually.
    useEffect(() => {
        if (!flows.length) return;
        let changed = false;
        const next = buttons.map((b) => {
            if (b.type === 'flow' && b.flow_id && !b.navigate_screen) {
                const sel = flows.find((f) => (f.meta_flow_id || String(f.id)) === b.flow_id);
                if (sel?.entry_screen_id) {
                    changed = true;
                    return { ...b, navigate_screen: sel.entry_screen_id, flow_action: b.flow_action || 'navigate' };
                }
            }
            return b;
        });
        if (changed) onChange(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flows]);

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
            case 'copy_code': return <Copy className="w-4 h-4" />;
            case 'voice_call': return <PhoneCall className="w-4 h-4" />;
            case 'catalog': return <Store className="w-4 h-4" />;
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

            {(buttons.some(b => b.type === 'flow') || buttons.some(b => b.type === 'catalog')) && (
                <Alert className="bg-blue-50 border-blue-200">
                    <AlertCircle className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-xs text-blue-800 space-y-1">
                        {buttons.some(b => b.type === 'flow') && (
                            <p>Flow button: select a PUBLISHED flow from the same WhatsApp account.</p>
                        )}
                        {buttons.some(b => b.type === 'catalog') && (
                            <p>Catalog button: requires MARKETING category and a product catalog connected to this WABA in WhatsApp Manager.</p>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            {buttons.some(b => b.type === 'voice_call') && (
                <Alert className={
                    voiceCallCapability?.voice_calling_ready
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-amber-50 border-amber-200'
                }>
                    <AlertCircle className={
                        voiceCallCapability?.voice_calling_ready
                            ? 'w-4 h-4 text-emerald-600'
                            : 'w-4 h-4 text-amber-600'
                    } />
                    <AlertDescription className={
                        voiceCallCapability?.voice_calling_ready
                            ? 'text-xs text-emerald-800 space-y-1'
                            : 'text-xs text-amber-800 space-y-1'
                    }>
                        {loadingVoiceCallCapability ? (
                            <p>Checking call readiness...</p>
                        ) : (
                            <>
                                <p>
                                    {voiceCallCapability?.voice_calling_ready
                                        ? 'Call readiness check passed for this account.'
                                        : 'Call readiness check is incomplete for this account.'}
                                </p>
                                <p>
                                    {voiceCallCapability?.receive_path || 'Calls are handled in WhatsApp clients, not inside Sociovia dashboard.'}
                                </p>
                                {voiceCallCapability?.block_template_submission && (
                                    <p>Strict mode is enabled, so submission is blocked until readiness checks pass.</p>
                                )}
                                {(voiceCallCapability?.warnings || []).slice(0, 2).map((w, idx) => (
                                    <p key={idx}>{w}</p>
                                ))}
                            </>
                        )}
                    </AlertDescription>
                </Alert>
            )}

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
                                    onValueChange={(v) => {
                                        const nextType = v as ButtonType;
                                        updateButton(idx, {
                                            type: nextType,
                                            text: nextType === 'copy_code'
                                                ? ''
                                                : nextType === 'catalog'
                                                ? 'View catalog'
                                                : (btn.text || (nextType === 'voice_call' ? 'Call' : '')),
                                            url: undefined,
                                            phone: undefined,
                                            flow_id: undefined,
                                            flow_token: undefined,
                                            copy_code: undefined,
                                        });
                                    }}
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
                                        <SelectItem value="copy_code">
                                            <div className="flex items-center gap-2">
                                                <Copy className="w-4 h-4" />
                                                Copy Offer Code
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="voice_call">
                                            <div className="flex items-center gap-2">
                                                <PhoneCall className="w-4 h-4" />
                                                Call on WhatsApp
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="catalog">
                                            <div className="flex items-center gap-2">
                                                <Store className="w-4 h-4" />
                                                View Catalog
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
                                    disabled={btn.type === 'copy_code'}
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
                                        onValueChange={(v) => {
                                            // Auto-derive navigate_screen from the flow's entry screen
                                            // so the user never has to type a screen id.
                                            const selected = flows.find(
                                                (f) => (f.meta_flow_id || String(f.id)) === v
                                            );
                                            updateButton(idx, {
                                                flow_id: v,
                                                flow_action: btn.flow_action || 'navigate',
                                                navigate_screen:
                                                    selected?.entry_screen_id || btn.navigate_screen || 'WELCOME',
                                            });
                                        }}
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
                                            Create and publish a flow first at /dashboard/whatsapp/flows/new
                                        </p>
                                    )}
                                    {/* navigate_screen is auto-derived from the selected flow's entry
                                        screen (Meta requires it) — shown read-only, no manual entry. */}
                                    {btn.flow_id && btn.navigate_screen && (
                                        <p className="text-xs text-muted-foreground">
                                            Opens screen <span className="font-mono text-foreground">{btn.navigate_screen}</span> (auto-detected).
                                        </p>
                                    )}
                                </div>
                            )}

                            {btn.type === 'copy_code' && (
                                <Input
                                    placeholder="Offer code (alphanumeric, max 15)"
                                    value={btn.copy_code || ''}
                                    onChange={(e) => updateButton(idx, { copy_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                                    maxLength={15}
                                    className="h-9"
                                />
                            )}

                            {btn.type === 'catalog' && (
                                <p className="text-xs text-muted-foreground">
                                    Catalog button opens the product catalog connected to your WABA. The button text (e.g., "View catalog") is required by Meta. You cannot select specific products — the entire connected catalog is displayed.
                                </p>
                            )}

                            {btn.type === 'voice_call' && (
                                <p className="text-xs text-muted-foreground">
                                    This button asks the user to allow WhatsApp calling with your business.
                                </p>
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

