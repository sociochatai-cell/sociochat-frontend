import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    MessageCircle, ArrowRightLeft, Loader2, Save,
    Activity as ActivityIcon, Send, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import crmApi from '../api';
import type { Lead, LeadStatus, Activity } from '../types';
import { LEAD_COLUMNS, LEAD_STATUS_MAP, timeAgo, inboxLinkForLead, initials } from './statusConfig';

interface LeadDrawerProps {
    lead: Lead | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called after a successful field edit so the parent can refresh the board. */
    onUpdated?: (lead: Lead) => void;
    /** Called after a successful convert-to-deal so the parent can refresh. */
    onConverted?: (lead: Lead) => void;
    /** Currency symbol shown on the money input. Defaults to ₹. */
    currencySymbol?: string;
}

/** The editable shape of a lead form. All strings so inputs stay controlled. */
interface LeadForm {
    name: string;
    email: string;
    phone: string;
    company: string;
    job_title: string;
    source: string;
    status: LeadStatus;
    value: string; // money, kept as string for the input
    score: string; // 0-100, kept as string for the input
    notes: string;
}

function jobTitleOf(lead: Lead): string {
    return (lead as any).job_title ?? lead.details?.job_title ?? '';
}

function notesOf(lead: Lead): string {
    return (lead as any).notes ?? lead.details?.notes ?? '';
}

function toForm(lead: Lead): LeadForm {
    return {
        name: lead.name ?? '',
        email: lead.email ?? '',
        phone: lead.phone ?? '',
        company: lead.company ?? '',
        job_title: jobTitleOf(lead),
        source: lead.source ?? lead.external_source ?? '',
        status: lead.status,
        value: lead.value != null ? String(lead.value) : '',
        score: lead.score != null ? String(Math.round(lead.score)) : '',
        notes: notesOf(lead),
    };
}

export default function LeadDrawer({
    lead, open, onOpenChange, onUpdated, onConverted, currencySymbol = '₹',
}: LeadDrawerProps) {
    const navigate = useNavigate();

    const [form, setForm] = useState<LeadForm | null>(null);
    const [saving, setSaving] = useState(false);

    // Activity timeline
    const [activity, setActivity] = useState<Activity[]>([]);
    const [loadingActivity, setLoadingActivity] = useState(false);
    const [note, setNote] = useState('');
    const [addingNote, setAddingNote] = useState(false);

    // Convert-to-deal inline panel
    const [convertOpen, setConvertOpen] = useState(false);
    const [dealValue, setDealValue] = useState('');
    const [converting, setConverting] = useState(false);

    // (Re)initialise the form whenever a new lead is shown.
    useEffect(() => {
        if (!open || !lead) return;
        setForm(toForm(lead));
        setNote('');
        setConvertOpen(false);
        setDealValue(lead.value != null ? String(lead.value) : '');
    }, [open, lead]);

    // Load the activity timeline.
    const loadActivity = (leadId: string) => {
        setLoadingActivity(true);
        crmApi
            .getLeadActivity(leadId)
            .then((rows) => setActivity(Array.isArray(rows) ? rows : []))
            .catch(() => setActivity([]))
            .finally(() => setLoadingActivity(false));
    };

    useEffect(() => {
        if (!open || !lead) return;
        setActivity([]);
        loadActivity(lead.id);
    }, [open, lead]);

    // Diff the form against the original lead → only changed fields.
    const changes = useMemo(() => {
        if (!lead || !form) return {} as Record<string, any>;
        const out: Record<string, any> = {};
        const orig = toForm(lead);

        (['name', 'email', 'phone', 'company', 'job_title', 'source', 'notes'] as const).forEach((k) => {
            if (form[k].trim() !== orig[k].trim()) out[k] = form[k].trim();
        });
        if (form.status !== orig.status) out.status = form.status;

        // value (money) — compare as numbers, allow clearing
        const vNum = form.value.trim() === '' ? null : Number(form.value);
        const origVNum = lead.value ?? null;
        if (form.value.trim() === '' ? origVNum != null : (!isNaN(vNum as number) && vNum !== origVNum)) {
            out.value = form.value.trim() === '' ? null : vNum;
        }

        // score (0-100)
        const sNum = form.score.trim() === '' ? null : Number(form.score);
        const origSNum = lead.score != null ? Math.round(lead.score) : null;
        if (form.score.trim() === '' ? origSNum != null : (!isNaN(sNum as number) && sNum !== origSNum)) {
            out.score = form.score.trim() === '' ? null : sNum;
        }
        return out;
    }, [lead, form]);

    const dirty = Object.keys(changes).length > 0;

    if (!lead || !form) return null;

    const status = LEAD_STATUS_MAP[form.status];

    const set = <K extends keyof LeadForm>(k: K, v: LeadForm[K]) =>
        setForm((f) => (f ? { ...f, [k]: v } : f));

    const handleSave = async () => {
        if (!dirty) return;
        // Guard score range
        if (changes.score != null && (changes.score < 0 || changes.score > 100)) {
            toast.error('Score must be between 0 and 100');
            return;
        }
        if (changes.value != null && isNaN(changes.value)) {
            toast.error('Enter a valid value');
            return;
        }
        setSaving(true);
        try {
            const updated = await crmApi.updateLead(lead.id, changes as Partial<Lead>);
            // Backend may echo the row; fall back to merging local changes.
            const merged: Lead = updated && (updated as any).id
                ? updated
                : ({ ...lead, ...changes } as Lead);
            toast.success('Lead updated');
            onUpdated?.(merged);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to update lead');
        } finally {
            setSaving(false);
        }
    };

    const handleAddNote = async () => {
        const description = note.trim();
        if (!description) return;
        setAddingNote(true);
        try {
            await crmApi.addLeadActivity(lead.id, { description });
            setNote('');
            loadActivity(lead.id); // refetch so it appears immediately
            toast.success('Note added');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to add note');
        } finally {
            setAddingNote(false);
        }
    };

    const handleConvert = async () => {
        setConverting(true);
        try {
            const v = dealValue.trim() === '' ? undefined : Number(dealValue);
            if (v != null && isNaN(v)) {
                toast.error('Enter a valid deal value');
                setConverting(false);
                return;
            }
            await crmApi.convertLeadToDeal(lead.id, { value: v });
            toast.success(`"${lead.name}" converted to a deal`);
            onConverted?.(lead);
            onOpenChange(false);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to convert lead to deal');
        } finally {
            setConverting(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
                {/* Header banner */}
                <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-6 pt-6 pb-5 border-b border-border shrink-0">
                    <SheetHeader className="space-y-0 text-left">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 ring-2 ring-white shadow-sm">
                                <AvatarFallback className="bg-emerald-100 text-emerald-700 font-semibold">
                                    {initials(form.name || lead.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <SheetTitle className="text-slate-800 truncate">{form.name || lead.name}</SheetTitle>
                                <SheetDescription className="flex items-center gap-2 mt-1">
                                    {status && (
                                        <Badge variant="outline" className={cn('border', status.badge)}>
                                            {status.label}
                                        </Badge>
                                    )}
                                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                        <MessageCircle className="h-3 w-3" /> WhatsApp
                                    </span>
                                </SheetDescription>
                            </div>
                        </div>
                    </SheetHeader>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                    {/* Quick actions */}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={() => navigate(inboxLinkForLead(lead))}
                        >
                            <MessageCircle className="mr-1.5 h-4 w-4" /> Open chat
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConvertOpen((o) => !o)}
                        >
                            <ArrowRightLeft className="mr-1.5 h-4 w-4" /> Convert to Deal
                        </Button>
                    </div>

                    {/* Convert-to-deal inline panel */}
                    {convertOpen && (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                    Deal value
                                </Label>
                                <button
                                    onClick={() => setConvertOpen(false)}
                                    className="text-emerald-700/70 hover:text-emerald-700"
                                    aria-label="Cancel convert"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                                        {currencySymbol}
                                    </span>
                                    <Input
                                        type="number"
                                        inputMode="decimal"
                                        min={0}
                                        placeholder="0"
                                        className="pl-7 bg-white"
                                        value={dealValue}
                                        onChange={(e) => setDealValue(e.target.value)}
                                    />
                                </div>
                                <Button
                                    size="sm"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={handleConvert}
                                    disabled={converting}
                                >
                                    {converting
                                        ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                        : <ArrowRightLeft className="mr-1.5 h-4 w-4" />}
                                    Convert
                                </Button>
                            </div>
                            <p className="text-[11px] text-emerald-700/70">
                                Creates a deal from this lead. Value is optional.
                            </p>
                        </div>
                    )}

                    {/* Editable details */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Details</h4>

                        <Field id="lead-name" label="Name">
                            <Input id="lead-name" value={form.name}
                                onChange={(e) => set('name', e.target.value)} placeholder="Jane Cooper" />
                        </Field>

                        <div className="grid grid-cols-2 gap-3">
                            <Field id="lead-phone" label="Phone">
                                <Input id="lead-phone" value={form.phone}
                                    onChange={(e) => set('phone', e.target.value)} placeholder="+1 555 000 1234" />
                            </Field>
                            <Field id="lead-email" label="Email">
                                <Input id="lead-email" type="email" value={form.email}
                                    onChange={(e) => set('email', e.target.value)} placeholder="jane@company.com" />
                            </Field>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Field id="lead-company" label="Company">
                                <Input id="lead-company" value={form.company}
                                    onChange={(e) => set('company', e.target.value)} placeholder="Acme Inc." />
                            </Field>
                            <Field id="lead-job" label="Job title">
                                <Input id="lead-job" value={form.job_title}
                                    onChange={(e) => set('job_title', e.target.value)} placeholder="Head of Sales" />
                            </Field>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Field id="lead-source" label="Source">
                                <Input id="lead-source" value={form.source}
                                    onChange={(e) => set('source', e.target.value)} placeholder="whatsapp" />
                            </Field>
                            <Field label="Status">
                                <Select value={form.status} onValueChange={(v) => set('status', v as LeadStatus)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {LEAD_COLUMNS.map((c) => (
                                            <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Field id="lead-value" label="Value">
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                                        {currencySymbol}
                                    </span>
                                    <Input id="lead-value" type="number" inputMode="decimal" min={0}
                                        className="pl-7"
                                        value={form.value}
                                        onChange={(e) => set('value', e.target.value)} placeholder="0" />
                                </div>
                            </Field>
                            <Field id="lead-score" label="Score (0-100)">
                                <Input id="lead-score" type="number" min={0} max={100}
                                    value={form.score}
                                    onChange={(e) => set('score', e.target.value)} placeholder="0" />
                            </Field>
                        </div>

                        <Field id="lead-notes" label="Notes">
                            <Textarea id="lead-notes" value={form.notes}
                                onChange={(e) => set('notes', e.target.value)}
                                placeholder="Add context about this lead…"
                                className="min-h-[80px] resize-none" />
                        </Field>
                    </div>

                    {/* Activity timeline */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                            <ActivityIcon className="h-3.5 w-3.5" /> Activity
                        </h4>

                        {/* Add-note input */}
                        <div className="flex items-start gap-2">
                            <Textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Add a note…"
                                className="min-h-[40px] resize-none"
                                onKeyDown={(e) => {
                                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddNote();
                                    }
                                }}
                            />
                            <Button
                                size="icon"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                                onClick={handleAddNote}
                                disabled={addingNote || !note.trim()}
                                title="Add note"
                            >
                                {addingNote
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Send className="h-4 w-4" />}
                            </Button>
                        </div>

                        {loadingActivity ? (
                            <div className="flex items-center gap-2 text-sm text-slate-400 py-3">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
                            </div>
                        ) : activity.length === 0 ? (
                            <p className="text-sm text-slate-400 py-3">No activity recorded yet.</p>
                        ) : (
                            <ol className="relative border-l border-slate-200 pl-4 space-y-4">
                                {activity.map((a) => (
                                    <li key={a.id} className="relative">
                                        <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                                        <p className="text-sm font-medium text-slate-700">
                                            {a.title || a.type}
                                        </p>
                                        {a.description && (
                                            <p className="text-xs text-slate-500 mt-0.5">{a.description}</p>
                                        )}
                                        <p className="text-[11px] text-slate-400 mt-0.5">{timeAgo(a.created_at)}</p>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-border bg-white px-6 py-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">
                        {dirty ? 'Unsaved changes' : 'All changes saved'}
                    </span>
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={handleSave}
                        disabled={saving || !dirty}
                    >
                        {saving
                            ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            : <Save className="mr-1.5 h-4 w-4" />}
                        Save
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function Field({
    id, label, children,
}: { id?: string; label: string; children: React.ReactNode }) {
    return (
        <div className="grid gap-1.5">
            <Label htmlFor={id} className="text-slate-500">{label}</Label>
            {children}
        </div>
    );
}
