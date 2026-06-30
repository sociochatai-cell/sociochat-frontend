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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    MessageCircle, Clock, Save, Loader2, X, Tag as TagIcon,
    Activity as ActivityIcon, Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import crmApi from '../api';
import type { Contact } from '../types';
import { timeAgo, initials } from './statusConfig';

interface ContactDrawerProps {
    contact: Contact | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Called after a successful save so the parent can refresh its list. */
    onUpdated?: (contact: Contact) => void;
}

interface ContactForm {
    name: string;
    email: string;
    phone: string;
    company: string;
    role: string;
    status: string;
    tags: string[];
    notes: string;
}

const STATUS_OPTIONS = [
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
];

function toForm(c: Contact): ContactForm {
    return {
        name: c.name ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        company: c.company ?? '',
        role: c.role ?? '',
        status: c.status || 'active',
        tags: Array.isArray(c.tags) ? c.tags : [],
        // `notes` is part of the API contract but not on the Contact type yet.
        notes: (c as any).notes ?? '',
    };
}

export default function ContactDrawer({ contact, open, onOpenChange, onUpdated }: ContactDrawerProps) {
    const navigate = useNavigate();

    const [form, setForm] = useState<ContactForm>(() => (contact ? toForm(contact) : {
        name: '', email: '', phone: '', company: '', role: '', status: 'active', tags: [], notes: '',
    }));
    const [saving, setSaving] = useState(false);
    const [tagDraft, setTagDraft] = useState('');

    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [noteDraft, setNoteDraft] = useState('');
    const [addingNote, setAddingNote] = useState(false);

    // Reset the form whenever a different contact is opened.
    useEffect(() => {
        if (contact) setForm(toForm(contact));
        setTagDraft('');
        setNoteDraft('');
    }, [contact]);

    // Load history when the drawer opens for a contact.
    useEffect(() => {
        if (!open || !contact) return;
        let cancelled = false;
        setHistory([]);
        setLoadingHistory(true);
        crmApi
            .getContactHistory(contact.id)
            .then((rows) => { if (!cancelled) setHistory(Array.isArray(rows) ? rows : []); })
            .catch(() => { if (!cancelled) setHistory([]); })
            .finally(() => { if (!cancelled) setLoadingHistory(false); });
        return () => { cancelled = true; };
    }, [open, contact]);

    // Compute only the fields that actually changed vs. the original contact.
    const changed = useMemo(() => {
        if (!contact) return {} as Partial<ContactForm>;
        const orig = toForm(contact);
        const diff: Record<string, any> = {};
        (Object.keys(form) as (keyof ContactForm)[]).forEach((k) => {
            if (k === 'tags') {
                const a = form.tags, b = orig.tags;
                if (a.length !== b.length || a.some((t, i) => t !== b[i])) diff.tags = a;
            } else if (form[k] !== orig[k]) {
                diff[k] = form[k];
            }
        });
        return diff;
    }, [form, contact]);

    const hasChanges = Object.keys(changed).length > 0;

    if (!contact) return null;

    const set = <K extends keyof ContactForm>(key: K, value: ContactForm[K]) =>
        setForm((f) => ({ ...f, [key]: value }));

    const addTag = () => {
        const t = tagDraft.trim();
        if (!t) return;
        if (!form.tags.includes(t)) set('tags', [...form.tags, t]);
        setTagDraft('');
    };

    const removeTag = (t: string) => set('tags', form.tags.filter((x) => x !== t));

    const openChat = () => {
        const params = new URLSearchParams();
        if (form.phone) params.set('startNew', form.phone);
        if (form.name) params.set('name', form.name);
        const qs = params.toString();
        navigate(qs ? `/dashboard/inbox?${qs}` : '/dashboard/inbox');
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error('Name is required');
            return;
        }
        if (!hasChanges) {
            toast.info('No changes to save');
            return;
        }
        setSaving(true);
        try {
            const updated = await crmApi.updateContact(contact.id, changed as Partial<Contact>);
            const merged = { ...contact, ...(changed as Partial<Contact>), ...(updated || {}) } as Contact;
            toast.success('Contact updated');
            onUpdated?.(merged);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to update contact');
        } finally {
            setSaving(false);
        }
    };

    const handleAddNote = async () => {
        const description = noteDraft.trim();
        if (!description) return;
        setAddingNote(true);
        try {
            await crmApi.addContactHistory(contact.id, { description });
            setNoteDraft('');
            // Refetch so the new entry shows with its server timestamp.
            const rows = await crmApi.getContactHistory(contact.id);
            setHistory(Array.isArray(rows) ? rows : []);
            toast.success('Note added');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to add note');
        } finally {
            setAddingNote(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
                {/* Header banner */}
                <div className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-6 pt-6 pb-5 border-b border-border">
                    <SheetHeader className="space-y-0 text-left">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 ring-2 ring-white shadow-sm">
                                <AvatarFallback className="bg-emerald-100 text-emerald-700 font-semibold">
                                    {initials(form.name || contact.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <SheetTitle className="text-slate-800 truncate">
                                    {form.name || contact.name || 'Contact'}
                                </SheetTitle>
                                <SheetDescription className="truncate">
                                    {form.role || form.company || 'Contact'}
                                </SheetDescription>
                            </div>
                        </div>
                    </SheetHeader>
                </div>

                <div className="px-6 py-5 space-y-6">
                    {/* Quick actions */}
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={openChat}>
                            <MessageCircle className="mr-1.5 h-4 w-4" /> Open chat
                        </Button>
                        <div className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
                            <Clock className="h-3.5 w-3.5" /> {timeAgo(contact.last_contacted)}
                        </div>
                    </div>

                    {/* Editable details */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Details</h4>

                        <div className="grid gap-1.5">
                            <Label htmlFor="cd-name" className="text-slate-600">Name</Label>
                            <Input id="cd-name" value={form.name}
                                onChange={(e) => set('name', e.target.value)} placeholder="Full name" />
                        </div>

                        <div className="grid gap-1.5">
                            <Label htmlFor="cd-email" className="text-slate-600">Email</Label>
                            <Input id="cd-email" type="email" value={form.email}
                                onChange={(e) => set('email', e.target.value)} placeholder="name@company.com" />
                        </div>

                        <div className="grid gap-1.5">
                            <Label htmlFor="cd-phone" className="text-slate-600">Phone</Label>
                            <Input id="cd-phone" value={form.phone}
                                onChange={(e) => set('phone', e.target.value)} placeholder="+1 555 000 1234" />
                        </div>

                        <div className="grid gap-1.5">
                            <Label htmlFor="cd-company" className="text-slate-600">Company</Label>
                            <Input id="cd-company" value={form.company}
                                onChange={(e) => set('company', e.target.value)} placeholder="Acme Inc." />
                        </div>

                        <div className="grid gap-1.5">
                            <Label htmlFor="cd-role" className="text-slate-600">Role</Label>
                            <Input id="cd-role" value={form.role}
                                onChange={(e) => set('role', e.target.value)} placeholder="Head of Sales" />
                        </div>

                        <div className="grid gap-1.5">
                            <Label className="text-slate-600">Status</Label>
                            <Select value={form.status} onValueChange={(v) => set('status', v)}>
                                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Tags */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                            <TagIcon className="h-3.5 w-3.5" /> Tags
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                            {form.tags.length === 0 && (
                                <span className="text-sm text-slate-300">No tags yet.</span>
                            )}
                            {form.tags.map((t) => (
                                <Badge key={t} variant="outline"
                                    className="bg-slate-50 text-slate-600 border-slate-200 gap-1 pr-1">
                                    {t}
                                    <button type="button" onClick={() => removeTag(t)}
                                        className="rounded-full hover:bg-slate-200 p-0.5 text-slate-400 hover:text-slate-600"
                                        aria-label={`Remove ${t}`}>
                                        <X className="h-3 w-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                        <Input
                            value={tagDraft}
                            onChange={(e) => setTagDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); addTag(); }
                                if (e.key === 'Backspace' && !tagDraft && form.tags.length) {
                                    removeTag(form.tags[form.tags.length - 1]);
                                }
                            }}
                            placeholder="Type a tag and press Enter"
                        />
                    </div>

                    {/* Notes */}
                    <div className="grid gap-1.5">
                        <Label htmlFor="cd-notes" className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Notes
                        </Label>
                        <Textarea id="cd-notes" rows={3} value={form.notes}
                            onChange={(e) => set('notes', e.target.value)}
                            placeholder="Internal notes about this contact…" />
                    </div>

                    {/* Save */}
                    <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                    >
                        {saving
                            ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                            : <Save className="mr-1.5 h-4 w-4" />}
                        {saving ? 'Saving…' : 'Save changes'}
                    </Button>

                    {/* History / activity timeline */}
                    <div className="space-y-3 border-t border-border pt-5">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
                            <ActivityIcon className="h-3.5 w-3.5" /> History
                        </h4>

                        {/* Add-note composer */}
                        <div className="flex items-start gap-2">
                            <Textarea
                                rows={2}
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                        e.preventDefault();
                                        handleAddNote();
                                    }
                                }}
                                placeholder="Add a note…"
                                className="flex-1"
                            />
                            <Button
                                size="icon"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0"
                                onClick={handleAddNote}
                                disabled={addingNote || !noteDraft.trim()}
                                title="Add note"
                            >
                                {addingNote
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Plus className="h-4 w-4" />}
                            </Button>
                        </div>

                        {loadingHistory ? (
                            <div className="flex items-center gap-2 text-sm text-slate-400 py-3">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
                            </div>
                        ) : history.length === 0 ? (
                            <p className="text-sm text-slate-400 py-3">No history recorded yet.</p>
                        ) : (
                            <ol className="relative border-l border-slate-200 pl-4 space-y-4">
                                {history.map((h, i) => (
                                    <li key={h.id ?? i} className="relative">
                                        <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
                                        <p className="text-sm font-medium text-slate-700">
                                            {h.title || h.description || h.type || 'Note'}
                                        </p>
                                        {h.description && (h.title || h.type) && (
                                            <p className="text-xs text-slate-500 mt-0.5">{h.description}</p>
                                        )}
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            {timeAgo(h.created_at)}
                                        </p>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
