// src/components/superadmin/subscriptionDisplay.ts
// Pure display helpers for tenant subscriptions: price formatting + expiry
// ("in N days / expired") computation. Kept separate from PlanPicker.tsx so the
// component file only exports a component (React Fast Refresh friendliness) and
// non-component consumers (e.g. the tenant list) can import these directly.

/** Human-readable monthly price. null/undefined => custom/unpriced. */
export function formatPlanPrice(price?: number | null): string {
    if (price == null) return 'Custom pricing';
    if (price <= 0) return 'Free';
    return `₹${price.toLocaleString('en-IN')}/mo`;
}

export type ExpiryTone = 'ok' | 'warn' | 'expired' | 'none';

export interface ExpiryStatus {
    /** Short status label, e.g. "Expires in 320 days", "Expired 3 days ago". */
    label: string;
    tone: ExpiryTone;
    /** Formatted expiry date (absent when there is no expiry). */
    expiresOn?: string;
    /** Days until expiry (negative = already expired); undefined when no expiry. */
    days?: number;
}

const MS_PER_DAY = 86_400_000;

/** Compute a display-friendly expiry status from an ISO date string. */
export function getExpiryStatus(iso?: string | null, now: Date = new Date()): ExpiryStatus {
    if (!iso) return { label: 'No expiry', tone: 'none' };
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { label: 'No expiry', tone: 'none' };

    const expiresOn = d.toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
    });
    const days = Math.ceil((d.getTime() - now.getTime()) / MS_PER_DAY);
    const plural = (n: number) => (Math.abs(n) === 1 ? '' : 's');

    if (days < 0) {
        return { label: `Expired ${Math.abs(days)} day${plural(days)} ago`, tone: 'expired', expiresOn, days };
    }
    if (days === 0) return { label: 'Expires today', tone: 'warn', expiresOn, days };
    if (days <= 14) return { label: `Expires in ${days} day${plural(days)}`, tone: 'warn', expiresOn, days };
    return { label: `Expires in ${days} days`, tone: 'ok', expiresOn, days };
}

/** Badge color classes per expiry tone. */
export const EXPIRY_TONE_CLASS: Record<ExpiryTone, string> = {
    ok: 'bg-emerald-100 text-emerald-700',
    warn: 'bg-amber-100 text-amber-700',
    expired: 'bg-red-100 text-red-700',
    none: 'bg-slate-100 text-slate-600',
};
