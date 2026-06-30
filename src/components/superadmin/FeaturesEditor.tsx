// src/components/superadmin/FeaturesEditor.tsx
// Renders the feature catalog grouped by category with per-feature toggles and
// a number input for limit-type features. Emits a draft override map; never saves.
import { useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FeatureCatalogItem, FeatureOverrideMap } from './useSuperAdminApi';

interface FeaturesEditorProps {
    features: FeatureCatalogItem[];
    overrides: FeatureOverrideMap;
    onChange: (next: FeatureOverrideMap) => void;
    loading?: boolean;
}

function isLimitType(f: FeatureCatalogItem): boolean {
    const t = (f.feature_type || '').toLowerCase();
    return t === 'limit' || t === 'numeric' || t === 'number' || t === 'quota';
}

export function FeaturesEditor({ features, overrides, onChange, loading }: FeaturesEditorProps) {
    const grouped = useMemo(() => {
        const map = new Map<string, FeatureCatalogItem[]>();
        for (const f of features) {
            const cat = f.category || 'General';
            if (!map.has(cat)) map.set(cat, []);
            map.get(cat)!.push(f);
        }
        return Array.from(map.entries());
    }, [features]);

    const setEnabled = (key: string, enabled: boolean) => {
        const current = overrides[key] || {};
        onChange({ ...overrides, [key]: { ...current, enabled } });
    };

    const setLimit = (key: string, raw: string) => {
        const current = overrides[key] || {};
        const next = { ...overrides };
        if (raw === '') {
            const { limit_value, ...rest } = current;
            next[key] = rest;
        } else {
            const n = Number(raw);
            next[key] = { ...current, limit_value: Number.isNaN(n) ? 0 : n };
        }
        onChange(next);
    };

    if (loading) {
        return <p className="text-sm text-muted-foreground py-6">Loading features…</p>;
    }
    if (features.length === 0) {
        return <p className="text-sm text-muted-foreground py-6">No features available.</p>;
    }

    return (
        <div className="space-y-6">
            {grouped.map(([category, items]) => (
                <div key={category} className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{category}</h3>
                    <div className="rounded-lg border divide-y">
                        {items.map((f) => {
                            const ov = overrides[f.key] || {};
                            const enabled = ov.enabled ?? false;
                            const limit = isLimitType(f);
                            return (
                                <div key={f.key} className="flex flex-wrap items-center gap-3 p-3">
                                    <div className="flex-1 min-w-[180px]">
                                        <p className="text-sm font-medium">{f.label}</p>
                                        <p className="text-xs text-muted-foreground">{f.key}</p>
                                    </div>
                                    {limit && (
                                        <div className="flex items-center gap-2">
                                            <Label className="text-xs text-muted-foreground">Limit</Label>
                                            <Input
                                                type="number"
                                                className="w-28 h-9"
                                                placeholder="unlimited"
                                                value={ov.limit_value ?? ''}
                                                onChange={(e) => setLimit(f.key, e.target.value)}
                                                disabled={!enabled}
                                            />
                                        </div>
                                    )}
                                    <Switch checked={enabled} onCheckedChange={(v) => setEnabled(f.key, v)} />
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default FeaturesEditor;
