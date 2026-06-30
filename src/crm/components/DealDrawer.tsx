import { useEffect, useState } from 'react';
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
import {
    Loader2, Save, Trophy, XCircle, Activity as ActivityIcon, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import crmApi from '../api';
import type { Deal, DealStage } from '../types';
import { DEAL_COLUMNS, DEAL_STAGE_MAP, formatCurrency, timeAgo } from './statusConfig';

const CURRENCIES = ['USD', 'INR', 'EUR', 'GBP', 'AED'];

interface DealDrawerProps {
    deal: Deal | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called after a successful edit / close so the parent can refresh the board. */
    onUpdated?: (deal: Deal) => void;
}

/** Editable form shape — all strings so inputs stay controlled. */
interface DealForm {
    name: string;
    value: string;
    currency: string;
    stage: DealStage;
    probability: string;
    close_date: string;
    company: string;
    notes: string;
}

function notesOf(d: Deal): string {
    return (d as any).notes ?? (d as any).details?.notes ?? '';
}

function toDateInput(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
}

function toForm(d: Deal): DealForm {
    return {
        name: d.name ?? '',
        value: d.value != null ? String(d.value) : '',
        currency: d.currency || 'USD',
        stage: d.stage,
        probability: d.probability != null ? String(d.probability) : '',
        close_date: toDateInput((d as any).close_date),
        company: d.company ?? '',
        notes: notesOf(d),
    };
}

export default function DealDrawer({ deal, open, onOpenChange, onUpdated }: DealDrawerProps) {
    const [form, setForm] = useState<DealForm | null>(null);
    const [saving, setSaving] = useState(false);
    const [closing, setClosing] = useState<'won' | 'lost' | null>(null);
    const [activity, setActivity] = useState<any[]>([]);
    const [loadingActivity, setLoadingActivity] = useState(false);
    const [note, setNote] = useState('');
    const [addingNote, setAddingNote] = useState(false);

    useEffect(() => {
        setForm(deal ? toForm(deal) : null);
    }, [deal]);

    useEffect(() => {
        let cancelled = false;
        if (open && deal) {
            setLoadingActivity(true);
            crmApi.getDealActivity(deal.id)
                .then((rows) => { if (!cancelled) setActivity(Array.isArray(rows) ? rows : []); })
                .catch(() => { if (!cancelled) setActivity([]); })
                .finally(() => { if (!cancelled) setLoadingActivity(false); });
        }
        return () => { cancelled = true; };
    }, [open, deal]);

    if (!deal || !form) {
        return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent /></Sheet>;
    }

    const set = (k: keyof DealForm, v: string) =>
        setForm((f) => (f ? { ...f, [k]: v } : f));

    const handleSave = async () => {
        if (!form.name.trim()) { toast.error('Deal name is required'); return; }
        setSaving(true);
        try {
            const payload: Record<string, any> = {
                name: form.name.trim(),
                value: form.value === '' ? 0 : Number(form.value),
                currency: form.currency,
                stage: form.stage,
                probability: form.probability === '' ? null : Number(form.probability),
                company: form.company.trim() || null,
                notes: form.notes,
            };
            if (form.close_date) payload.close_date = form.close_date;
            const updated = await crmApi.updateDeal(deal.id, payload as any);
            toast.success('Deal saved');
            onUpdated?.({ ...(deal as any), ...payload, ...(updated || {}) } as Deal);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save deal');
        } finally {
            setSaving(false);
        }
    };

    const handleClose = async (status: 'won' | 'lost') => {
        setClosing(status);
        try {
            await crmApi.closeDeal(deal.id, status);
            const newStage = status as DealStage;
            set('stage', newStage);
            toast.success(status === 'won' ? 'Marked as Won 🎉' : 'Marked as Lost');
            onUpdated?.({ ...(deal as any), stage: newStage, status: 'closed' } as Deal);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to update deal');
        } finally {
            setClosing(null);
        }
    };

    const handleAddNote = async () => {
        if (!note.trim()) return;
        setAddingNote(true);
        try {
            await crmApi.addDealActivity(deal.id, { description: note.trim() });
            setNote('');
            const rows = await crmApi.getDealActivity(deal.id);
            setActivity(Array.isArray(rows) ? rows : []);
            toast.success('Note added');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to add note');
        } finally {
            setAddingNote(false);
        }
    };

    const stageDef = DEAL_STAGE_MAP[form.stage];

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md p-0 flex flex-col gap-0">
                <SheetHeader className="p-5 border-b border-border bg-gradient-to-br from-emerald-50 to-teal-50/40 text-left">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <SheetTitle className="text-lg font-bold text-slate-800 truncate">
                                {form.name || 'Deal'}
                            </SheetTitle>
                            <SheetDescription className="text-emerald-700 font-bold text-base mt-0.5">
                                {formatCurrency(Number(form.value) || 0, form.currency)}
                            </SheetDescription>
                        </div>
                        {stageDef && <Badge variant="outline" className={cn('shrink-0', stageDef.badge)}>{stageDef.label}</Badge>}
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Money — front and center */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label>Value</Label>
                            <Input type="number" min="0" value={form.value}
                                onChange={(e) => set('value', e.target.value)} placeholder="0" />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Currency</Label>
                            <Select value={form.currency} onValueChange={(v) => set('currency', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid gap-1.5">
                        <Label>Deal name</Label>
                        <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label>Stage</Label>
                            <Select value={form.stage} onValueChange={(v) => set('stage', v as DealStage)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {DEAL_COLUMNS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Probability %</Label>
                            <Input type="number" min="0" max="100" value={form.probability}
                                onChange={(e) => set('probability', e.target.value)} placeholder="0-100" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                            <Label>Close date</Label>
                            <Input type="date" value={form.close_date}
                                onChange={(e) => set('close_date', e.target.value)} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label>Company</Label>
                            <Input value={form.company} onChange={(e) => set('company', e.target.value)} />
                        </div>
                    </div>

                    <div className="grid gap-1.5">
                        <Label>Notes</Label>
                        <Textarea rows={3} value={form.notes}
                            onChange={(e) => set('notes', e.target.value)} placeholder="Add deal notes..." />
                    </div>

                    {/* Won / Lost quick actions */}
                    <div className="flex gap-2">
                        <Button variant="outline"
                            className="flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleClose('won')} disabled={closing !== null}>
                            {closing === 'won'
                                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                : <Trophy className="mr-1.5 h-4 w-4" />} Mark Won
                        </Button>
                        <Button variant="outline"
                            className="flex-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                            onClick={() => handleClose('lost')} disabled={closing !== null}>
                            {closing === 'lost'
                                ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                : <XCircle className="mr-1.5 h-4 w-4" />} Mark Lost
                        </Button>
                    </div>

                    {/* Activity / notes */}
                    <div className="pt-2 border-t border-border">
                        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-3">
                            <ActivityIcon className="h-4 w-4 text-emerald-600" /> Activity &amp; Notes
                        </h4>
                        <div className="flex gap-2 mb-3">
                            <Input value={note} onChange={(e) => setNote(e.target.value)}
                                placeholder="Add a note..."
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNote(); } }} />
                            <Button size="icon" className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                                onClick={handleAddNote} disabled={addingNote || !note.trim()}>
                                {addingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                        </div>
                        {loadingActivity ? (
                            <div className="flex justify-center py-4">
                                <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                            </div>
                        ) : activity.length === 0 ? (
                            <p className="text-xs text-slate-400 text-center py-4">No activity yet.</p>
                        ) : (
                            <ul className="space-y-3">
                                {activity.map((a: any, i: number) => (
                                    <li key={a.id ?? i} className="flex gap-2.5">
                                        <div className="mt-1 h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm text-slate-700">{a.title || a.description || a.type}</p>
                                            {a.description && a.title && (
                                                <p className="text-xs text-slate-500">{a.description}</p>
                                            )}
                                            <p className="text-[11px] text-slate-400">{timeAgo(a.timestamp || a.created_at)}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* Footer — Save */}
                <div className="p-4 border-t border-border bg-white">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                        Save Deal
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
