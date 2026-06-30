// src/components/superadmin/PlanPicker.tsx
// Visual subscription-plan picker for the Super Admin tenant flows. Renders ALL
// available plans as selectable cards (price + blurb) and clearly highlights the
// one currently selected. Shared by the creation wizard and the tenant edit page.
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PlanItem } from './useSuperAdminApi';
import { formatPlanPrice } from './subscriptionDisplay';

interface PlanPickerProps {
    plans: PlanItem[];
    /** Currently-selected plan slug. */
    value: string;
    onChange: (slug: string) => void;
    className?: string;
}

/** Card grid of selectable plans (radio-style). */
export function PlanPicker({ plans, value, onChange, className }: PlanPickerProps) {
    if (!plans.length) {
        return <p className="text-sm text-muted-foreground">No plans available.</p>;
    }
    return (
        <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)} role="radiogroup">
            {plans.map((p) => {
                const selected = p.slug === value;
                return (
                    <button
                        key={p.slug}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => onChange(p.slug)}
                        className={cn(
                            'relative flex flex-col items-start rounded-xl border p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500',
                            selected
                                ? 'border-emerald-500 bg-emerald-50/60 ring-2 ring-emerald-500/40'
                                : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50',
                        )}
                    >
                        {selected && (
                            <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                                <Check className="h-3.5 w-3.5" />
                            </span>
                        )}
                        <span className="pr-6 text-sm font-semibold capitalize text-slate-900">{p.name}</span>
                        <span className="mt-1 text-sm font-medium text-emerald-700">
                            {formatPlanPrice(p.price_monthly_inr)}
                        </span>
                        {p.description && (
                            <span className="mt-2 line-clamp-3 text-xs text-muted-foreground">{p.description}</span>
                        )}
                        <span
                            className={cn(
                                'mt-3 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                                selected
                                    ? 'bg-emerald-600/10 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500',
                            )}
                        >
                            {selected ? 'Currently selected' : 'Select'}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

export default PlanPicker;
