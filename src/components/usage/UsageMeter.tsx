// Reusable, purely-presentational usage/exhaustion meters.
// Consumed at all usage surfaces (end-user subscription page, tenant-admin
// per-user dialog, super-admin per-tenant-user expander). Callers fetch a usage
// object and map it to rows via `usageRowsFrom`; this file does NO fetching.
//
// Convention (matches the backend get_user_usage_stats shape): a limit of -1
// (or null) means UNLIMITED. Bar turns amber at >=80% and red at >=100%.
import type { ReactNode } from 'react';
import { MessageSquare, Image as ImageIcon, Users, Workflow, IndianRupee, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface UsageRow {
    label: string;
    used: number;
    limit: number; // -1 (or null coerced to -1) => unlimited
    unit?: string; // '' | '₹'
    icon?: ReactNode;
    prefixUnit?: boolean; // true => '₹1,000', false => '1,000'
}

export interface UsagePanelProps {
    rows: UsageRow[];
    title?: string;
    dense?: boolean;
    className?: string;
}

function fmt(n: number): string {
    return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function UsageMeterRow({ label, used, limit, unit = '', icon, prefixUnit }: UsageRow) {
    const unlimited = limit === -1 || limit === null || limit === undefined;
    // A finite limit of 0 with recorded usage is fully over-limit (not 0%); this
    // also keeps the divide-by-zero guard for the 0-used case.
    const pct = unlimited
        ? 0
        : limit <= 0
          ? (used > 0 ? 100 : 0)
          : Math.min((used / limit) * 100, 100);
    const near = !unlimited && pct >= 80 && pct < 100;
    const over = !unlimited && pct >= 100;
    const val = (n: number) => (prefixUnit ? `${unit}${fmt(n)}` : `${fmt(n)}${unit}`);

    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    {icon}
                    {label}
                </span>
                <span
                    className={cn(
                        'font-medium tabular-nums',
                        over
                            ? 'text-red-600'
                            : near
                              ? 'text-amber-600'
                              : 'text-slate-900 dark:text-slate-100',
                    )}
                >
                    {val(used)} / {unlimited ? '∞' : val(limit)}
                </span>
            </div>
            {unlimited ? (
                <div className="flex h-2 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                    <span className="text-[10px] font-medium tracking-wide text-emerald-700 dark:text-emerald-300">
                        UNLIMITED
                    </span>
                </div>
            ) : (
                <Progress
                    value={pct}
                    className={cn(
                        'h-2',
                        over ? '[&>div]:bg-red-500' : near ? '[&>div]:bg-amber-500' : '[&>div]:bg-emerald-500',
                    )}
                />
            )}
        </div>
    );
}

export function UsagePanel({ rows, title, dense, className }: UsagePanelProps) {
    return (
        <div className={cn(dense ? 'space-y-3' : 'space-y-4', className)}>
            {title && <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h4>}
            {rows.map((r) => (
                <UsageMeterRow key={r.label} {...r} />
            ))}
        </div>
    );
}

/** Map a backend usage object (get_user_usage_stats `usage` block) to meter rows.
 *  Kept next to the component so every surface renders identical rows. */
export function usageRowsFrom(u: Record<string, any> | null | undefined): UsageRow[] {
    if (!u) return [];
    return [
        { label: 'Messages today', used: u.messages_today, limit: u.messages_limit, icon: <MessageSquare className="h-4 w-4" /> },
        { label: 'Image credits', used: Math.round(u.image_credits_used || 0), limit: u.image_credits_limit, icon: <ImageIcon className="h-4 w-4" /> },
        { label: 'Workspaces', used: u.workspaces, limit: u.workspaces_limit, icon: <Users className="h-4 w-4" /> },
        { label: 'Interactive flows', used: u.interactive_flows, limit: u.interactive_flows_limit, icon: <Workflow className="h-4 w-4" /> },
        { label: 'Ad spend', used: u.ad_spend_inr, limit: u.ad_spend_limit, unit: '₹', prefixUnit: true, icon: <IndianRupee className="h-4 w-4" /> },
        ...(u.ai_generations !== undefined
            ? [{ label: 'AI generations (month)', used: u.ai_generations, limit: u.ai_generations_limit ?? -1, icon: <Sparkles className="h-4 w-4" /> } as UsageRow]
            : []),
    ];
}
