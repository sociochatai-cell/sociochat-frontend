import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Users, Search, Plus, Loader2, RefreshCw, Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import crmApi from '../api';
import type { Contact } from '../types';
import ContactDrawer from '../components/ContactDrawer';
import { timeAgo, initials } from '../components/statusConfig';

export default function Contacts() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [selected, setSelected] = useState<Contact | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const [addOpen, setAddOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({ name: '', phone: '', email: '', company: '' });

    const fetchContacts = async () => {
        setLoading(true);
        try {
            const data = await crmApi.getContacts();
            setContacts(Array.isArray(data) ? data : []);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to load contacts');
            setContacts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchContacts(); }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return contacts;
        return contacts.filter((c) =>
            c.name?.toLowerCase().includes(q) ||
            c.phone?.toLowerCase().includes(q) ||
            c.email?.toLowerCase().includes(q) ||
            c.company?.toLowerCase().includes(q));
    }, [contacts, search]);

    const openContact = (c: Contact) => { setSelected(c); setDrawerOpen(true); };

    const handleUpdated = (updated: Contact) => {
        setContacts((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
        setSelected((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
    };

    const handleAdd = async () => {
        if (!form.name.trim() && !form.phone.trim()) {
            toast.error('Enter a name or phone number');
            return;
        }
        setSubmitting(true);
        try {
            const created: any = await crmApi.createContact({
                name: form.name.trim() || form.phone.trim(),
                phone: form.phone.trim() || undefined,
                email: form.email.trim() || undefined,
                company: form.company.trim() || undefined,
            });
            // Normal create returns the full contact; the "already exists" (deduped)
            // path returns only { id } with no name — rebuild from the form so the
            // row never shows "Unknown".
            if (created && created.id) {
                const newContact = created.name
                    ? created
                    : {
                        ...created,
                        id: created.id,
                        name: form.name.trim() || form.phone.trim(),
                        phone: form.phone.trim() || undefined,
                        email: form.email.trim() || undefined,
                        company: form.company.trim() || undefined,
                    };
                setContacts((prev) => [newContact, ...prev]);
            } else {
                fetchContacts();
            }
            toast.success('Contact added');
            setAddOpen(false);
            setForm({ name: '', phone: '', email: '', company: '' });
        } catch (e: any) {
            toast.error(e?.message || 'Failed to add contact');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (c: Contact) => {
        const prev = contacts;
        setContacts((p) => p.filter((x) => x.id !== c.id));
        try {
            await crmApi.deleteContact(c.id);
            toast.success(`Removed ${c.name}`);
        } catch (e: any) {
            setContacts(prev);
            toast.error(e?.message || 'Failed to delete contact');
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 min-w-0 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="h-6 w-6 text-emerald-600 shrink-0" /> Contacts
                    </h1>
                    <p className="text-slate-500 text-sm">Your unified CRM contact directory.</p>
                </div>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                    onClick={() => setAddOpen(true)}>
                    <Plus className="mr-1.5 h-4 w-4" /> Add Contact
                </Button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 sm:gap-4 items-center">
                <div className="relative flex-1 min-w-0 sm:max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search by name, phone, company…"
                        className="pl-8 bg-white"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button variant="outline" size="icon" onClick={fetchContacts} disabled={loading} title="Refresh">
                    <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                </Button>
            </div>

            {/* Table */}
            <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Tags</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Last Contact</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-12">
                                        <Loader2 className="h-6 w-6 animate-spin text-emerald-600 mx-auto" />
                                    </TableCell>
                                </TableRow>
                            )}
                            {!loading && filtered.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-12 text-slate-400">
                                        {search.trim() ? 'No contacts match your search.' : 'No contacts yet. Add one to get started.'}
                                    </TableCell>
                                </TableRow>
                            )}
                            {!loading && filtered.map((c) => (
                                <TableRow key={c.id} className="cursor-pointer" onClick={() => openContact(c)}>
                                    <TableCell className="font-medium text-slate-800">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-9 w-9">
                                                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
                                                    {initials(c.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <div className="truncate max-w-[180px]">{c.name || 'Unknown'}</div>
                                                {c.email && <div className="text-xs text-slate-400 truncate max-w-[180px]">{c.email}</div>}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-slate-600">{c.phone || '—'}</TableCell>
                                    <TableCell className="text-slate-600">{c.company || '—'}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                                            {(c.tags && c.tags.length > 0)
                                                ? c.tags.slice(0, 3).map((t) => (
                                                    <Badge key={t} variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px]">
                                                        {t}
                                                    </Badge>
                                                ))
                                                : <span className="text-slate-300">—</span>}
                                            {c.tags && c.tags.length > 3 && (
                                                <span className="text-[10px] text-slate-400">+{c.tags.length - 3}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {c.status
                                            ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{c.status}</Badge>
                                            : <span className="text-slate-300">—</span>}
                                    </TableCell>
                                    <TableCell className="text-slate-500 text-sm">{timeAgo(c.last_contacted)}</TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="ghost" size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                            onClick={() => handleDelete(c)}
                                            title="Delete contact"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Detail drawer */}
            <ContactDrawer contact={selected} open={drawerOpen} onOpenChange={setDrawerOpen} onUpdated={handleUpdated} />

            {/* Add dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Contact</DialogTitle>
                        <DialogDescription>Add a new contact to your CRM directory.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label htmlFor="c-name">Name</Label>
                            <Input id="c-name" value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="John Doe" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="c-phone">Phone</Label>
                            <Input id="c-phone" value={form.phone}
                                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                placeholder="+1 555 000 1234" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="c-email">Email (optional)</Label>
                            <Input id="c-email" type="email" value={form.email}
                                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                placeholder="john@company.com" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="c-company">Company (optional)</Label>
                            <Input id="c-company" value={form.company}
                                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                                placeholder="Acme Inc." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleAdd} disabled={submitting}>
                            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                            Add Contact
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
