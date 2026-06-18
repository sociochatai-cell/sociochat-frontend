/**
 * Flow-level variables (API tokens, URLs) stored in the database per automation.
 * Referenced in API nodes as {{variable_name}} — e.g. {{flow_api_token}}.
 */
import React, { useEffect, useState } from 'react';
import { KeyRound, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface FlowVariablesState {
    variables: Record<string, string>;
    variableDefaults: Record<string, string>;
}

interface FlowVariablesDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    value: FlowVariablesState;
    onSave: (next: FlowVariablesState) => void;
}

const SENSITIVE_RE = /token|secret|password|api_key|apikey|credential/i;

function isSensitiveKey(key: string): boolean {
    return SENSITIVE_RE.test(key);
}

function entriesFromRecord(record: Record<string, string>): Array<{ key: string; value: string }> {
    return Object.entries(record || {}).map(([key, value]) => ({ key, value: String(value ?? '') }));
}

function recordFromEntries(entries: Array<{ key: string; value: string }>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const row of entries) {
        const k = row.key.trim();
        if (!k) continue;
        const v = row.value.trim();
        // Preserve existing secrets when field left blank (loaded as *** from API).
        if (isSensitiveKey(k) && !v) {
            out[k] = '***';
        } else {
            out[k] = row.value;
        }
    }
    return out;
}

export function FlowVariablesDialog({ open, onOpenChange, value, onSave }: FlowVariablesDialogProps) {
    const [varRows, setVarRows] = useState<Array<{ key: string; value: string }>>([]);
    const [defaultRows, setDefaultRows] = useState<Array<{ key: string; value: string }>>([]);

    useEffect(() => {
        if (!open) return;
        setVarRows(entriesFromRecord(value.variables));
        setDefaultRows(entriesFromRecord(value.variableDefaults));
    }, [open, value]);

    const addVarRow = () => setVarRows((rows) => [...rows, { key: '', value: '' }]);
    const addDefaultRow = () => setDefaultRows((rows) => [...rows, { key: '', value: '' }]);

    const addBearerPreset = () => {
        setVarRows((rows) => {
            if (rows.some((r) => r.key === 'flow_api_token')) return rows;
            return [...rows, { key: 'flow_api_token', value: '' }];
        });
    };

    const handleSave = () => {
        onSave({
            variables: recordFromEntries(varRows),
            variableDefaults: recordFromEntries(defaultRows),
        });
        onOpenChange(false);
    };

    const renderRows = (
        rows: Array<{ key: string; value: string }>,
        onChange: (rows: Array<{ key: string; value: string }>) => void,
        valuePlaceholder: string,
    ) => (
        <div className="space-y-2">
            {rows.length === 0 && (
                <p className="text-xs text-gray-500 italic">No entries yet.</p>
            )}
            {rows.map((row, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                    <Input
                        placeholder="key e.g. flow_api_token"
                        value={row.key}
                        onChange={(e) => {
                            const next = [...rows];
                            next[idx] = { ...row, key: e.target.value };
                            onChange(next);
                        }}
                        className="h-8 text-xs font-mono w-[42%]"
                    />
                    <Input
                        type={isSensitiveKey(row.key) ? 'password' : 'text'}
                        placeholder={valuePlaceholder}
                        value={row.value === '***' ? '' : row.value}
                        onChange={(e) => {
                            const next = [...rows];
                            next[idx] = { ...row, value: e.target.value };
                            onChange(next);
                        }}
                        className="h-8 text-xs font-mono flex-1"
                    />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => onChange(rows.filter((_, i) => i !== idx))}
                    >
                        <Trash2 className="w-3 h-3" />
                    </Button>
                </div>
            ))}
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-violet-600" />
                        Flow variables & secrets
                    </DialogTitle>
                    <DialogDescription>
                        Stored securely per flow in the database. Use in API node headers/body as{' '}
                        <code className="text-xs bg-gray-100 px-1 rounded">{'{{flow_api_token}}'}</code>,{' '}
                        <code className="text-xs bg-gray-100 px-1 rounded">{'{{phone}}'}</code>, etc.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm">Variables (secrets & config)</Label>
                            <div className="flex gap-1">
                                <Button type="button" variant="outline" size="sm" onClick={addBearerPreset}>
                                    + Bearer token
                                </Button>
                                <Button type="button" variant="ghost" size="sm" onClick={addVarRow}>
                                    <Plus className="w-3 h-3 mr-1" /> Add
                                </Button>
                            </div>
                        </div>
                        {renderRows(varRows, setVarRows, 'value or leave blank to keep existing')}
                        <p className="text-[11px] text-gray-500 mt-2">
                            API header example — Key: <strong>Authorization</strong>, Value:{' '}
                            <strong>Bearer {'{{flow_api_token}}'}</strong>
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label className="text-sm">Default values (optional)</Label>
                            <Button type="button" variant="ghost" size="sm" onClick={addDefaultRow}>
                                <Plus className="w-3 h-3 mr-1" /> Add
                            </Button>
                        </div>
                        {renderRows(defaultRows, setDefaultRows, 'default when field empty')}
                        <p className="text-[11px] text-gray-500 mt-2">
                            Used when a placeholder is empty — e.g. <code>demo_date</code> → tomorrow
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Apply</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
