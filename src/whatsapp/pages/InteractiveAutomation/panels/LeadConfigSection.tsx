/**
 * LeadConfigSection Component
 * ===========================
 * Shared "Mark as lead" configuration block rendered inside the Message,
 * Input and API node editors. When enabled it lets the user define a
 * condition, pick a CRM lead type + pipeline stage, and map captured
 * values onto the lead's standard fields.
 *
 * Lead types and pipeline stages are fetched from the MONOLITH backend
 * (API_BASE_URL). If the fetch fails we transparently fall back to
 * free-text inputs so the editor keeps working offline / unauthenticated.
 */

import React, { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import type { LeadAction, LeadActionCondition, LeadActionOperator } from '../types';

export interface LeadTypeOption {
    id: number | string;
    key: string;
    label: string;
    color?: string;
}

export interface StageOption {
    id: number | string;
    key: string;
    label: string;
}

// Module-level caches so the two GET requests are shared across every
// node editor instance for the lifetime of the page.
let leadTypesCache: LeadTypeOption[] | null = null;
let stagesCache: StageOption[] | null = null;

export const OPERATOR_OPTIONS: { value: LeadActionOperator; label: string }[] = [
    { value: 'any', label: 'Always (no condition)' },
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'exists', label: 'Exists' },
    { value: 'not_exists', label: 'Does not exist' },
    { value: 'gt', label: 'Greater than' },
    { value: 'lt', label: 'Less than' },
    { value: 'regex', label: 'Matches regex' },
];

// Operators that don't need a comparison value
export const VALUELESS_OPERATORS: LeadActionOperator[] = ['any', 'exists', 'not_exists'];

/**
 * Shared hook that fetches CRM lead types + pipeline stages from the monolith
 * (credentials included) and exposes whether each list should fall back to a
 * free-text input. Used by both the inline LeadConfigSection toggle and the
 * dedicated Lead node editor.
 */
export function useLeadOptions(active: boolean) {
    const [leadTypes, setLeadTypes] = useState<LeadTypeOption[]>(() => leadTypesCache || []);
    const [stages, setStages] = useState<StageOption[]>(() => stagesCache || []);
    const [leadTypesFailed, setLeadTypesFailed] = useState(false);
    const [stagesFailed, setStagesFailed] = useState(false);

    useEffect(() => {
        if (!active) return;

        let cancelled = false;

        if (!leadTypesCache && !leadTypesFailed) {
            fetch(`${API_BASE_URL}/api/lead-types`, { credentials: 'include' })
                .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
                .then((json) => {
                    const list: LeadTypeOption[] = json?.lead_types || json?.data || [];
                    leadTypesCache = list;
                    if (!cancelled) setLeadTypes(list);
                })
                .catch(() => {
                    if (!cancelled) setLeadTypesFailed(true);
                });
        }

        if (!stagesCache && !stagesFailed) {
            fetch(`${API_BASE_URL}/api/pipelines`, { credentials: 'include' })
                .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
                .then((json) => {
                    const pipelines: Array<{ is_default?: boolean; stages?: StageOption[] }> = json?.pipelines || [];
                    // Prefer the default pipeline's stages, otherwise flatten all stages.
                    const defaultPipeline = pipelines.find((p) => p.is_default) || pipelines[0];
                    const list: StageOption[] = defaultPipeline?.stages
                        || pipelines.flatMap((p) => p.stages || []);
                    stagesCache = list;
                    if (!cancelled) setStages(list);
                })
                .catch(() => {
                    if (!cancelled) setStagesFailed(true);
                });
        }

        return () => {
            cancelled = true;
        };
    }, [active, leadTypesFailed, stagesFailed]);

    return {
        leadTypes,
        stages,
        // Fall back to free-text inputs when the fetch failed or returned nothing.
        useLeadTypeFreeText: leadTypesFailed || leadTypes.length === 0,
        useStageFreeText: stagesFailed || stages.length === 0,
    };
}

interface LeadConfigSectionProps {
    value?: LeadAction;
    onChange: (leadAction: LeadAction) => void;
}

export function LeadConfigSection({ value, onChange }: LeadConfigSectionProps) {
    const enabled = value?.enabled || false;
    const condition: LeadActionCondition = value?.condition || { source: 'response', operator: 'any' };
    const operator = condition.operator || 'any';
    const showValueInput = !VALUELESS_OPERATORS.includes(operator);

    // Fetch lead types + pipeline stages from the monolith (only once enabled).
    const { leadTypes, stages, useLeadTypeFreeText, useStageFreeText } = useLeadOptions(enabled);

    // Helpers to emit a fully-formed LeadAction on every change.
    const emit = (patch: Partial<LeadAction>) => {
        onChange({
            enabled,
            condition,
            leadType: value?.leadType,
            stage: value?.stage,
            mapFields: value?.mapFields,
            ...patch,
        });
    };

    const emitCondition = (patch: Partial<LeadActionCondition>) => {
        emit({ condition: { ...condition, ...patch } });
    };

    const emitMapField = (key: 'name' | 'email' | 'phone', fieldValue: string) => {
        emit({ mapFields: { ...(value?.mapFields || {}), [key]: fieldValue || undefined } });
    };

    const mapFields = value?.mapFields || {};

    return (
        <div className="space-y-4">
            <Separator />

            {/* Mark as lead toggle */}
            <div
                className={`
                    flex items-center justify-between p-3 rounded-xl border transition-all duration-200
                    ${enabled
                        ? 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 shadow-[0_8px_22px_-14px_rgba(5,150,105,0.7)]'
                        : 'bg-gradient-to-br from-slate-50 to-emerald-50/70 border-emerald-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_4px_12px_-10px_rgba(5,150,105,0.45)]'
                    }
                `}
            >
                <div className="flex-1 flex items-start gap-2">
                    <UserPlus className="w-4 h-4 text-emerald-600 mt-0.5" />
                    <div>
                        <Label className="text-sm font-medium text-emerald-900">Mark as lead</Label>
                        <p className="text-xs text-emerald-700 mt-1">
                            Create or update a CRM lead when this step runs
                        </p>
                    </div>
                </div>
                <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => emit({ enabled: checked })}
                    className="
                        ml-3
                        border border-emerald-200/80
                        shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_4px_10px_-7px_rgba(6,95,70,0.6)]
                        data-[state=checked]:bg-emerald-600 data-[state=checked]:shadow-[0_6px_14px_-8px_rgba(5,150,105,0.85)]
                        data-[state=unchecked]:bg-white/90
                        [&>span]:bg-white [&>span]:border [&>span]:border-emerald-200 [&>span]:shadow-sm
                        data-[state=unchecked]:[&>span]:bg-emerald-100 data-[state=checked]:[&>span]:bg-white
                    "
                />
            </div>

            {enabled && (
                <div className="space-y-4 p-3 bg-slate-50 border rounded-lg">
                    {/* Condition */}
                    <div>
                        <Label className="text-xs font-semibold">Condition</Label>
                        <p className="text-[11px] text-muted-foreground mb-1.5">
                            Only mark as lead when this is true
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <Select
                                value={operator}
                                onValueChange={(v: LeadActionOperator) => emitCondition({ operator: v })}
                            >
                                <SelectTrigger className="h-8 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {OPERATOR_OPTIONS.map((op) => (
                                        <SelectItem key={op.value} value={op.value}>
                                            {op.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {showValueInput && (
                                <Input
                                    className="h-8 text-sm"
                                    placeholder="Value"
                                    value={condition.value || ''}
                                    onChange={(e) => emitCondition({ value: e.target.value })}
                                />
                            )}
                        </div>
                        {operator !== 'any' && (
                            <Input
                                className="h-8 text-sm mt-2"
                                placeholder="Path (optional, e.g. response or data.status)"
                                value={condition.path || ''}
                                onChange={(e) => emitCondition({ path: e.target.value })}
                            />
                        )}
                    </div>

                    {/* Lead type */}
                    <div>
                        <Label className="text-xs font-semibold">Lead type</Label>
                        {useLeadTypeFreeText ? (
                            <Input
                                className="h-8 text-sm mt-1"
                                placeholder="e.g. whatsapp"
                                value={value?.leadType || ''}
                                onChange={(e) => emit({ leadType: e.target.value || undefined })}
                            />
                        ) : (
                            <Select
                                value={value?.leadType || '_none'}
                                onValueChange={(v) => emit({ leadType: v === '_none' ? undefined : v })}
                            >
                                <SelectTrigger className="h-8 text-sm mt-1">
                                    <SelectValue placeholder="Select lead type..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_none">None</SelectItem>
                                    {leadTypes.map((lt) => (
                                        <SelectItem key={lt.id} value={lt.key}>
                                            {lt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Stage */}
                    <div>
                        <Label className="text-xs font-semibold">Stage</Label>
                        {useStageFreeText ? (
                            <Input
                                className="h-8 text-sm mt-1"
                                placeholder="e.g. new"
                                value={value?.stage || ''}
                                onChange={(e) => emit({ stage: e.target.value || undefined })}
                            />
                        ) : (
                            <Select
                                value={value?.stage || '_none'}
                                onValueChange={(v) => emit({ stage: v === '_none' ? undefined : v })}
                            >
                                <SelectTrigger className="h-8 text-sm mt-1">
                                    <SelectValue placeholder="Select stage..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_none">None</SelectItem>
                                    {stages.map((st) => (
                                        <SelectItem key={st.id} value={st.key}>
                                            {st.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {/* Field mapping */}
                    <div>
                        <Label className="text-xs font-semibold">Map fields (optional)</Label>
                        <p className="text-[11px] text-muted-foreground mb-1.5">
                            Source values / paths to copy onto the lead
                        </p>
                        <div className="space-y-2">
                            <div className="grid grid-cols-[64px_1fr] items-center gap-2">
                                <Label className="text-[11px] text-gray-500">Name</Label>
                                <Input
                                    className="h-8 text-sm"
                                    placeholder="e.g. name"
                                    value={mapFields.name || ''}
                                    onChange={(e) => emitMapField('name', e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-[64px_1fr] items-center gap-2">
                                <Label className="text-[11px] text-gray-500">Phone</Label>
                                <Input
                                    className="h-8 text-sm"
                                    placeholder="e.g. phone"
                                    value={mapFields.phone || ''}
                                    onChange={(e) => emitMapField('phone', e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-[64px_1fr] items-center gap-2">
                                <Label className="text-[11px] text-gray-500">Email</Label>
                                <Input
                                    className="h-8 text-sm"
                                    placeholder="e.g. email"
                                    value={mapFields.email || ''}
                                    onChange={(e) => emitMapField('email', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
