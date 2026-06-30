// Shared status/stage color maps + small helpers reused across the CRM pages.
// Keeps the look consistent with the white-label app (brand green primary,
// slate text, soft tonal badges).
import type { LeadStatus, DealStage } from '../types';

export interface ColumnDef<T extends string> {
    key: T;
    label: string;
    /** classes for the column header pill / accent */
    accent: string;
    /** classes for a badge rendered in this state */
    badge: string;
    /** a single dot color (tailwind text-*) */
    dot: string;
}

export const LEAD_COLUMNS: ColumnDef<LeadStatus>[] = [
    { key: 'new', label: 'New', accent: 'text-sky-700 bg-sky-50 border-sky-200', badge: 'bg-sky-100 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
    { key: 'contacted', label: 'Contacted', accent: 'text-amber-700 bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    { key: 'qualified', label: 'Qualified', accent: 'text-violet-700 bg-violet-50 border-violet-200', badge: 'bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
    { key: 'proposal', label: 'Proposal', accent: 'text-indigo-700 bg-indigo-50 border-indigo-200', badge: 'bg-indigo-100 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
    { key: 'closed', label: 'Closed', accent: 'text-emerald-700 bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
];

export const LEAD_STATUS_MAP: Record<LeadStatus, ColumnDef<LeadStatus>> =
    LEAD_COLUMNS.reduce((acc, c) => { acc[c.key] = c; return acc; }, {} as Record<LeadStatus, ColumnDef<LeadStatus>>);

export const DEAL_COLUMNS: ColumnDef<DealStage>[] = [
    { key: 'prospect', label: 'Prospect', accent: 'text-slate-700 bg-slate-50 border-slate-200', badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
    { key: 'discovery', label: 'Discovery', accent: 'text-sky-700 bg-sky-50 border-sky-200', badge: 'bg-sky-100 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
    { key: 'qualified', label: 'Qualified', accent: 'text-violet-700 bg-violet-50 border-violet-200', badge: 'bg-violet-100 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
    { key: 'proposal', label: 'Proposal', accent: 'text-amber-700 bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    { key: 'negotiation', label: 'Negotiation', accent: 'text-orange-700 bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
    { key: 'won', label: 'Won', accent: 'text-emerald-700 bg-emerald-50 border-emerald-200', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    { key: 'lost', label: 'Lost', accent: 'text-rose-700 bg-rose-50 border-rose-200', badge: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
];

export const DEAL_STAGE_MAP: Record<DealStage, ColumnDef<DealStage>> =
    DEAL_COLUMNS.reduce((acc, c) => { acc[c.key] = c; return acc; }, {} as Record<DealStage, ColumnDef<DealStage>>);

/** Format a currency value compactly (e.g. $12,500). */
export function formatCurrency(value?: number | null, currency = 'USD'): string {
    if (value == null || isNaN(value)) return '—';
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `${value}`;
    }
}

/** Human "time ago" string from an ISO timestamp. */
export function timeAgo(iso?: string | null): string {
    if (!iso) return '—';
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '—';
    const diff = Date.now() - then;
    const sec = Math.round(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.round(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.round(hr / 24);
    if (day < 30) return `${day}d ago`;
    const mo = Math.round(day / 30);
    if (mo < 12) return `${mo}mo ago`;
    return `${Math.round(mo / 12)}y ago`;
}

/** Build the WhatsApp inbox deep-link for a lead. Mirrors the existing
 *  WhatsAppContacts convention: /dashboard/inbox?startNew=<phone>&name=<name>. */
export function inboxLinkForLead(lead: {
    phone?: string | null;
    name?: string | null;
    external_id?: string | null;
    details?: Record<string, any> | null;
}): string {
    const convId = lead.details?.conversation_id || lead.details?.conversationId;
    if (convId) return `/dashboard/inbox?conversation=${encodeURIComponent(convId)}`;
    const phone = lead.phone || lead.external_id || '';
    const params = new URLSearchParams();
    if (phone) params.set('startNew', phone);
    if (lead.name) params.set('name', lead.name);
    const qs = params.toString();
    return qs ? `/dashboard/inbox?${qs}` : '/dashboard/inbox';
}

/** Initials for an avatar fallback. */
export function initials(name?: string | null): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}
