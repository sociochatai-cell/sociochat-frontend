/**
 * API Node editor panel — HTTP integration settings + test connection
 */
import React, { useState } from 'react';
import { KeyRound, Loader2, Plus, Trash2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/config';
import type { ApiNode, ApiKeyValue, ApiBranchRule, ApiButtonCaptureRule } from '../types';

interface ApiNodeEditorProps {
    node: ApiNode;
    onUpdate: (updates: Partial<ApiNode['data']>) => void;
    flowVariables?: Record<string, string>;
    automationId?: number;
    onOpenFlowVariables?: () => void;
}

const AUTH_HEADERS_PRESET: ApiKeyValue[] = [
    { key: 'Authorization', value: 'Bearer {{flow_api_token}}', enabled: true },
    { key: 'Content-Type', value: 'application/json', enabled: true },
];

export function ApiNodeEditor({ node, onUpdate, flowVariables, automationId, onOpenFlowVariables }: ApiNodeEditorProps) {
    const data = node.data;
    const [testing, setTesting] = useState(false);
    const needsFlowToken =
        JSON.stringify(data).includes('{{flow_api_token}}') &&
        (!flowVariables?.flow_api_token || flowVariables.flow_api_token === '***');

    const updateHeaders = (headers: ApiKeyValue[]) => onUpdate({ headers });
    const updateQuery = (queryParams: ApiKeyValue[]) => onUpdate({ queryParams });
    const updateBranches = (branches: ApiBranchRule[]) => onUpdate({ branches });
    const updateCapture = (buttonCapture: ApiButtonCaptureRule[]) => onUpdate({ buttonCapture });

    const applyAuthHeadersPreset = () => {
        const existing = data.headers || [];
        const keys = new Set(existing.map((h) => h.key.toLowerCase()));
        const merged = [...existing];
        for (const preset of AUTH_HEADERS_PRESET) {
            if (!keys.has(preset.key.toLowerCase())) {
                merged.push(preset);
            }
        }
        updateHeaders(merged);
    };

    const emptyKv = (): ApiKeyValue => ({ key: '', value: '', enabled: true });

    const handleTest = async () => {
        setTesting(true);
        try {
            const testVariables: Record<string, string> = {
                phone: '919876543210',
                name: 'Test User',
                customer_name: 'Test User',
                ...(flowVariables || {}),
            };
            const res = await fetch(`${API_BASE_URL}/api/whatsapp/interactive-automations/test-api-node`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    data,
                    variables: testVariables,
                    automation_id: automationId,
                }),
            });
            const json = await res.json();
            if (json.success) {
                toast({
                    title: 'API test succeeded',
                    description: `HTTP ${json.status_code} → handle "${json.handle}"`,
                });
            } else {
                toast({
                    title: 'API test failed',
                    description: json.error || json.errors?.join(', ') || 'Request failed',
                    variant: 'destructive',
                });
            }
        } catch (err) {
            toast({
                title: 'Test request failed',
                description: String(err),
                variant: 'destructive',
            });
        } finally {
            setTesting(false);
        }
    };

    const renderKvList = (
        label: string,
        items: ApiKeyValue[],
        onChange: (items: ApiKeyValue[]) => void
    ) => (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs">{label}</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange([...(items || []), emptyKv()])}>
                    <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
            </div>
            {(items || []).map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                    <Input
                        placeholder="Key"
                        value={row.key}
                        onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...row, key: e.target.value };
                            onChange(next);
                        }}
                        className="h-8 text-xs"
                    />
                    <Input
                        placeholder="Value or {{var}}"
                        value={row.value}
                        onChange={(e) => {
                            const next = [...items];
                            next[idx] = { ...row, value: e.target.value };
                            onChange(next);
                        }}
                        className="h-8 text-xs flex-1"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => onChange(items.filter((_, i) => i !== idx))}
                    >
                        <Trash2 className="w-3 h-3" />
                    </Button>
                </div>
            ))}
        </div>
    );

    return (
        <div className="space-y-4">
            {needsFlowToken && onOpenFlowVariables && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                    <p className="font-medium mb-2">API token required</p>
                    <p className="mb-2">
                        This node uses <code>{'{{flow_api_token}}'}</code>. Set it in flow settings — not in the header key field.
                    </p>
                    <Button type="button" variant="outline" size="sm" onClick={onOpenFlowVariables}>
                        <KeyRound className="w-3 h-3 mr-1" />
                        Open Flow variables
                    </Button>
                </div>
            )}
            <div>
                <Label>Label</Label>
                <Input
                    value={data.label || ''}
                    onChange={(e) => onUpdate({ label: e.target.value })}
                    placeholder="Order lookup"
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label>Method</Label>
                    <Select value={data.method || 'POST'} onValueChange={(v) => onUpdate({ method: v as ApiNode['data']['method'] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Timeout (sec)</Label>
                    <Input
                        type="number"
                        min={1}
                        max={30}
                        value={data.timeoutSec ?? 15}
                        onChange={(e) => onUpdate({ timeoutSec: Number(e.target.value) || 15 })}
                    />
                </div>
            </div>

            <div>
                <Label>URL</Label>
                <Input
                    value={data.url || ''}
                    onChange={(e) => onUpdate({ url: e.target.value })}
                    placeholder="https://api.example.com/v1/lookup"
                    className="font-mono text-xs"
                />
                <p className="text-[11px] text-gray-500 mt-1">Use {'{{phone}}'}, {'{{name}}'}, or collected field names.</p>
            </div>

            {renderKvList('Headers', data.headers || [], updateHeaders)}
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={applyAuthHeadersPreset}>
                Add Bearer auth headers (Authorization + Content-Type)
            </Button>
            {renderKvList('Query params', data.queryParams || [], updateQuery)}

            {data.method !== 'GET' && (
                <>
                    <div>
                        <Label>Body type</Label>
                        <Select value={data.bodyType || 'json'} onValueChange={(v) => onUpdate({ bodyType: v as 'json' | 'form' | 'none' })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="json">JSON</SelectItem>
                                <SelectItem value="form">Form</SelectItem>
                                <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {data.bodyType !== 'none' && (
                        <div>
                            <Label>Request body</Label>
                            <Textarea
                                value={data.body || ''}
                                onChange={(e) => onUpdate({ body: e.target.value })}
                                rows={5}
                                className="font-mono text-xs"
                            />
                        </div>
                    )}
                </>
            )}

            <Separator />

            <div>
                <Label>Store response as (optional)</Label>
                <Input
                    value={data.storeAs || ''}
                    onChange={(e) => onUpdate({ storeAs: e.target.value })}
                    placeholder="lookup_result"
                />
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Response branches</Label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => updateBranches([...(data.branches || []), { id: `case_${(data.branches?.length || 0) + 1}`, path: 'status', operator: 'equals', value: '' }])}
                    >
                        <Plus className="w-3 h-3 mr-1" /> Add branch
                    </Button>
                </div>
                {(data.branches || []).map((branch, idx) => (
                    <div key={branch.id} className="border rounded-md p-2 space-y-2 bg-gray-50">
                        <div className="flex gap-2">
                            <Input
                                value={branch.id}
                                onChange={(e) => {
                                    const next = [...(data.branches || [])];
                                    next[idx] = { ...branch, id: e.target.value };
                                    updateBranches(next);
                                }}
                                placeholder="branch id"
                                className="h-8 text-xs"
                            />
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => updateBranches((data.branches || []).filter((_, i) => i !== idx))}>
                                <Trash2 className="w-3 h-3" />
                            </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <Input
                                placeholder="JSON path"
                                value={branch.path || ''}
                                onChange={(e) => {
                                    const next = [...(data.branches || [])];
                                    next[idx] = { ...branch, path: e.target.value };
                                    updateBranches(next);
                                }}
                                className="h-8 text-xs"
                            />
                            <Select
                                value={branch.operator || 'equals'}
                                onValueChange={(v) => {
                                    const next = [...(data.branches || [])];
                                    next[idx] = { ...branch, operator: v as ApiBranchRule['operator'] };
                                    updateBranches(next);
                                }}
                            >
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {['equals', 'not_equals', 'contains', 'exists', 'not_exists', 'gt', 'lt'].map(op => (
                                        <SelectItem key={op} value={op}>{op}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                placeholder="value"
                                value={branch.value || ''}
                                onChange={(e) => {
                                    const next = [...(data.branches || [])];
                                    next[idx] = { ...branch, value: e.target.value };
                                    updateBranches(next);
                                }}
                                className="h-8 text-xs"
                            />
                        </div>
                        <p className="text-[10px] text-gray-500">Connect output handle &quot;branch-{branch.id}&quot;</p>
                    </div>
                ))}
            </div>

            <Separator />

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Button capture rules</Label>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => updateCapture([...(data.buttonCapture || []), { matchType: 'uuid', field: 'entity_id', valueFrom: 'button_id' }])}
                    >
                        <Plus className="w-3 h-3 mr-1" /> Add
                    </Button>
                </div>
                {(data.buttonCapture || []).map((rule, idx) => (
                    <div key={idx} className="border rounded-md p-2 space-y-2 bg-gray-50 text-xs">
                        <div className="grid grid-cols-2 gap-2">
                            <Select
                                value={rule.matchType || 'exact'}
                                onValueChange={(v) => {
                                    const next = [...(data.buttonCapture || [])];
                                    next[idx] = { ...rule, matchType: v as ApiButtonCaptureRule['matchType'] };
                                    updateCapture(next);
                                }}
                            >
                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {['uuid', 'exact', 'regex', 'any'].map((m) => (
                                        <SelectItem key={m} value={m}>{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                placeholder="field name"
                                value={rule.field || ''}
                                onChange={(e) => {
                                    const next = [...(data.buttonCapture || [])];
                                    next[idx] = { ...rule, field: e.target.value };
                                    updateCapture(next);
                                }}
                                className="h-8"
                            />
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => updateCapture((data.buttonCapture || []).filter((_, i) => i !== idx))}>
                            Remove rule
                        </Button>
                    </div>
                ))}
            </div>

            <Separator />

            <div className="space-y-2">
                <Label>Success response mapping</Label>
                <p className="text-[11px] text-gray-500">
                    Connect the green <strong>Success</strong> handle on the canvas to the next step after the API succeeds.
                    When the API returns <code>quickReplies</code>, the flow waits for a button click — then routes via QR hub or Success.
                </p>
                <Select
                    value={data.output?.onSuccess?.mode || 'auto'}
                    onValueChange={(v) => onUpdate({
                        output: {
                            ...data.output,
                            onSuccess: { ...data.output?.onSuccess, mode: v as 'auto' },
                        },
                    })}
                >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="auto">Auto (text / image / doc / buttons)</SelectItem>
                        <SelectItem value="text">Text only</SelectItem>
                        <SelectItem value="raw">Raw text body</SelectItem>
                    </SelectContent>
                </Select>
                <Input
                    placeholder="Text JSON path (e.g. message)"
                    value={data.output?.onSuccess?.textPath || ''}
                    onChange={(e) => onUpdate({
                        output: {
                            ...data.output,
                            onSuccess: { ...data.output?.onSuccess, textPath: e.target.value },
                        },
                    })}
                    className="text-xs"
                />
                <Input
                    placeholder="Buttons JSON path (e.g. quickReplies)"
                    value={data.output?.onSuccess?.buttonsPath || ''}
                    onChange={(e) => onUpdate({
                        output: {
                            ...data.output,
                            onSuccess: { ...data.output?.onSuccess, buttonsPath: e.target.value },
                        },
                    })}
                    className="text-xs"
                />
                <Input
                    placeholder="Image URL path (optional)"
                    value={data.output?.onSuccess?.imagePath || ''}
                    onChange={(e) => onUpdate({
                        output: {
                            ...data.output,
                            onSuccess: { ...data.output?.onSuccess, imagePath: e.target.value },
                        },
                    })}
                    className="text-xs"
                />
                <Input
                    placeholder="Document URL path (optional)"
                    value={data.output?.onSuccess?.documentPath || ''}
                    onChange={(e) => onUpdate({
                        output: {
                            ...data.output,
                            onSuccess: { ...data.output?.onSuccess, documentPath: e.target.value },
                        },
                    })}
                    className="text-xs"
                />
                <Textarea
                    placeholder="Fallback message if paths empty"
                    value={data.output?.onSuccess?.fallbackText || ''}
                    onChange={(e) => onUpdate({
                        output: {
                            ...data.output,
                            onSuccess: { ...data.output?.onSuccess, fallbackText: e.target.value },
                        },
                    })}
                    rows={2}
                    className="text-xs"
                />
            </div>

            <div>
                <Label>Error message to user</Label>
                <Textarea
                    value={data.output?.onError?.text || ''}
                    onChange={(e) => onUpdate({
                        output: {
                            ...data.output,
                            onError: { text: e.target.value },
                        },
                    })}
                    rows={2}
                    className="text-xs"
                />
            </div>

            <Button type="button" variant="secondary" className="w-full" onClick={handleTest} disabled={testing || !data.url?.trim()}>
                {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                Test API connection
            </Button>
        </div>
    );
}
