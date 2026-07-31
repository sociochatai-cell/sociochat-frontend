import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import {
    DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
    useDraggable, useDroppable, closestCorners,
    type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Users, Search, Plus, LayoutGrid, List, MessageCircle, Loader2, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import crmApi from '../api';
import type { Lead, LeadStatus } from '../types';
import LeadDrawer from '../components/LeadDrawer';
import {
    LEAD_COLUMNS, LEAD_STATUS_MAP, timeAgo, formatCurrency, inboxLinkForLead,
} from '../components/statusConfig';

type ViewMode = 'kanban' | 'list';

export default function Leads() {
    const navigate = useNavigate();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<ViewMode>('kanban');
    const [search, setSearch] = useState('');
    const [activeId, setActiveId] = useState<string | null>(null);

    // Drawer
    const [selected, setSelected] = useState<Lead | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Add dialog
    const [addOpen, setAddOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState<{ name: string; phone: string; email: string; status: LeadStatus }>({
        name: '', phone: '', email: '', status: 'new',
    });

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const data = await crmApi.getLeads();
            setLeads(Array.isArray(data) ? data : []);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to load leads');
            setLeads([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLeads(); }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return leads;
        return leads.filter((l) =>
            l.name?.toLowerCase().includes(q) ||
            l.phone?.toLowerCase().includes(q) ||
            l.email?.toLowerCase().includes(q));
    }, [leads, search]);

    const byStatus = useMemo(() => {
        const map: Record<LeadStatus, Lead[]> = {
            new: [], contacted: [], qualified: [], proposal: [], closed: [],
        };
        for (const l of filtered) {
            (map[l.status] ?? (map.new)).push(l);
        }
        return map;
    }, [filtered]);

    const activeLead = activeId ? leads.find((l) => l.id === activeId) ?? null : null;

    // ── Drag handlers: optimistic status update, revert on error ──
    const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

    const onDragEnd = async (e: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = e;
        if (!over) return;
        const leadId = String(active.id);
        const newStatus = String(over.id) as LeadStatus;
        const lead = leads.find((l) => l.id === leadId);
        if (!lead || lead.status === newStatus) return;
        if (!LEAD_STATUS_MAP[newStatus]) return;

        const prevStatus = lead.status;
        setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)));
        try {
            await crmApi.updateLead(leadId, { status: newStatus });
            toast.success(`Moved "${lead.name}" to ${LEAD_STATUS_MAP[newStatus].label}`);
        } catch (err: any) {
            setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: prevStatus } : l)));
            toast.error(err?.message || 'Failed to move lead');
        }
    };

    const openLead = (lead: Lead) => { setSelected(lead); setDrawerOpen(true); };

    const handleAdd = async () => {
        if (!form.name.trim() && !form.phone.trim()) {
            toast.error('Enter a name or phone number');
            return;
        }
        setSubmitting(true);
        try {
            const created: any = await crmApi.createLead({
                name: form.name.trim() || form.phone.trim(),
                phone: form.phone.trim() || undefined,
                email: form.email.trim() || undefined,
                status: form.status,
                source: 'whatsapp',
            });
            // Backend returns only { id } (or { lead:{...} }); rebuild the row from
            // the form so the new lead shows its name/phone instead of a blank card.
            const newId = created?.id ?? created?.lead?.id;
            if (newId) {
                const newLead = (created?.lead && created.lead.name)
                    ? created.lead
                    : {
                        ...(created?.lead || {}),
                        id: newId,
                        name: form.name.trim() || form.phone.trim(),
                        phone: form.phone.trim() || undefined,
                        email: form.email.trim() || undefined,
                        status: form.status,
                        source: 'whatsapp',
                    };
                setLeads((prev) => [newLead, ...prev]);
            } else {
                fetchLeads();
            }
            toast.success('Lead added');
            setAddOpen(false);
            setForm({ name: '', phone: '', email: '', status: 'new' });
        } catch (e: any) {
            toast.error(e?.message || 'Failed to add lead');
        } finally {
            setSubmitting(false);
        }
    };

    // Inline status change (list view)
    const changeStatus = async (lead: Lead, newStatus: LeadStatus) => {
        if (lead.status === newStatus) return;
        const prev = lead.status;
        setLeads((p) => p.map((l) => (l.id === lead.id ? { ...l, status: newStatus } : l)));
        try {
            await crmApi.updateLead(lead.id, { status: newStatus });
        } catch (e: any) {
            setLeads((p) => p.map((l) => (l.id === lead.id ? { ...l, status: prev } : l)));
            toast.error(e?.message || 'Failed to update status');
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-6 min-w-0">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="h-6 w-6 text-emerald-600 shrink-0" /> Leads
                    </h1>
                    <p className="text-slate-500 text-sm">Track and nurture your WhatsApp leads through the pipeline.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search name or phone…"
                            className="pl-8 bg-white"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    {/* View toggle */}
                    <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
                        <button
                            onClick={() => setView('kanban')}
                            className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                                view === 'kanban' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-700')}
                        >
                            <LayoutGrid className="h-4 w-4" /> <span className="hidden sm:inline">Board</span>
                        </button>
                        <button
                            onClick={() => setView('list')}
                            className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
                                view === 'list' ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:text-slate-700')}
                        >
                            <List className="h-4 w-4" /> <span className="hidden sm:inline">List</span>
                        </button>
                    </div>
                    <Button variant="outline" size="icon" onClick={fetchLeads} disabled={loading} title="Refresh">
                        <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                    </Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setAddOpen(true)}>
                        <Plus className="mr-1.5 h-4 w-4" /> Add Lead
                    </Button>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-24 text-slate-400">
                    <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState onAdd={() => setAddOpen(true)} hasSearch={!!search.trim()} />
            ) : view === 'kanban' ? (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                >
                    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
                        {LEAD_COLUMNS.map((col) => (
                            <KanbanColumn
                                key={col.key}
                                colKey={col.key}
                                label={col.label}
                                accent={col.accent}
                                dot={col.dot}
                                count={byStatus[col.key].length}
                            >
                                {byStatus[col.key].map((lead) => (
                                    <LeadCard
                                        key={lead.id}
                                        lead={lead}
                                        onOpen={() => openLead(lead)}
                                        onChat={() => navigate(inboxLinkForLead(lead))}
                                    />
                                ))}
                            </KanbanColumn>
                        ))}
                    </div>
                    <DragOverlay>
                        {activeLead ? <LeadCard lead={activeLead} dragging /> : null}
                    </DragOverlay>
                </DndContext>
            ) : (
                <ListView
                    leads={filtered}
                    onOpen={openLead}
                    onChat={(l) => navigate(inboxLinkForLead(l))}
                    onChangeStatus={changeStatus}
                />
            )}

            {/* Detail drawer */}
            <LeadDrawer
                lead={selected}
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                onUpdated={(updated) => {
                    setLeads((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
                    setSelected((s) => (s && s.id === updated.id ? { ...s, ...updated } : s));
                }}
                onConverted={() => fetchLeads()}
            />

            {/* Add dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Lead</DialogTitle>
                        <DialogDescription>Create a new lead in your pipeline.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label htmlFor="lead-name">Name</Label>
                            <Input id="lead-name" value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="Jane Cooper" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="lead-phone">Phone</Label>
                            <Input id="lead-phone" value={form.phone}
                                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                placeholder="+1 555 000 1234" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="lead-email">Email (optional)</Label>
                            <Input id="lead-email" type="email" value={form.email}
                                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                placeholder="jane@company.com" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Status</Label>
                            <Select value={form.status}
                                onValueChange={(v) => setForm((f) => ({ ...f, status: v as LeadStatus }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {LEAD_COLUMNS.map((c) => (
                                        <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleAdd} disabled={submitting}>
                            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                            Add Lead
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ──────────────────────────────────────────────
// Kanban column (droppable)
// ──────────────────────────────────────────────
function KanbanColumn({
    colKey, label, accent, dot, count, children,
}: {
    colKey: string; label: string; accent: string; dot: string; count: number; children: React.ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: colKey });
    return (
        <div className="flex flex-col w-72 shrink-0">
            <div className={cn('flex items-center justify-between rounded-xl border px-3 py-2 mb-3', accent)}>
                <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className={cn('h-2 w-2 rounded-full', dot)} /> {label}
                </span>
                <span className="text-xs font-semibold rounded-full bg-white/70 px-2 py-0.5">{count}</span>
            </div>
            <div
                ref={setNodeRef}
                className={cn(
                    'flex-1 min-h-[120px] space-y-2.5 rounded-xl p-1.5 transition-colors',
                    isOver ? 'bg-emerald-50/70 ring-2 ring-emerald-200' : 'bg-slate-50/60',
                )}
            >
                {count === 0 && (
                    <p className="text-center text-xs text-slate-400 py-6">Drop leads here</p>
                )}
                {children}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────
// Lead card (draggable)
// ──────────────────────────────────────────────
function LeadCard({
    lead, onOpen, onChat, dragging,
}: {
    lead: Lead; onOpen?: () => void; onChat?: () => void; dragging?: boolean;
}) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
    return (
        <motion.div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            initial={false}
            className={cn(
                'group cursor-grab active:cursor-grabbing rounded-xl border border-border bg-white p-3 shadow-sm hover:shadow-md transition-shadow',
                (isDragging || dragging) && 'opacity-60 shadow-lg ring-2 ring-emerald-200',
            )}
            onClick={(e) => {
                // ignore click that ends a drag
                if (isDragging) return;
                e.stopPropagation();
                onOpen?.();
            }}
        >
            <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-slate-800 text-sm truncate">{lead.name}</p>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 shrink-0">
                    <MessageCircle className="h-3 w-3" /> WhatsApp
                </span>
            </div>
            {lead.phone && <p className="text-xs text-slate-500 mt-1 truncate">{lead.phone}</p>}

            {typeof lead.score === 'number' && (
                <div className="mt-2.5">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wide text-slate-400">Score</span>
                        <span className="text-[10px] font-semibold text-slate-600">{Math.round(lead.score)}</span>
                    </div>
                    <Progress
                        value={Math.max(0, Math.min(100, lead.score))}
                        className="h-1.5 bg-slate-100 [&>div]:bg-emerald-500"
                    />
                </div>
            )}

            <div className="mt-2.5 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">{timeAgo(lead.last_interaction_at)}</span>
                {onChat && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onChat(); }}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                        <MessageCircle className="h-3.5 w-3.5" /> Open chat
                    </button>
                )}
            </div>
        </motion.div>
    );
}

// ──────────────────────────────────────────────
// List view
// ──────────────────────────────────────────────
function ListView({
    leads, onOpen, onChat, onChangeStatus,
}: {
    leads: Lead[];
    onOpen: (l: Lead) => void;
    onChat: (l: Lead) => void;
    onChangeStatus: (l: Lead, s: LeadStatus) => void;
}) {
    return (
        <Card className="overflow-hidden">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Last Contact</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {leads.map((lead) => (
                            <TableRow
                                key={lead.id}
                                className="cursor-pointer"
                                onClick={() => onOpen(lead)}
                            >
                                <TableCell className="font-medium text-slate-800">
                                    <div className="truncate max-w-[200px]">{lead.name}</div>
                                    {lead.phone && <div className="text-xs text-slate-400">{lead.phone}</div>}
                                </TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                    <Select value={lead.status} onValueChange={(v) => onChangeStatus(lead, v as LeadStatus)}>
                                        <SelectTrigger className="h-8 w-[140px] border-none bg-transparent px-0 focus:ring-0">
                                            <Badge variant="outline" className={cn('border', LEAD_STATUS_MAP[lead.status]?.badge)}>
                                                {LEAD_STATUS_MAP[lead.status]?.label ?? lead.status}
                                            </Badge>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {LEAD_COLUMNS.map((c) => (
                                                <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </TableCell>
                                <TableCell>
                                    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                                        <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                                        {lead.source || lead.external_source || 'whatsapp'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-slate-500 text-sm">{timeAgo(lead.last_interaction_at)}</TableCell>
                                <TableCell className="text-right text-slate-700 font-medium">
                                    {formatCurrency(lead.value)}
                                </TableCell>
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                        onClick={() => onChat(lead)}>
                                        <MessageCircle className="mr-1 h-4 w-4" /> Chat
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </Card>
    );
}

function EmptyState({ onAdd, hasSearch }: { onAdd: () => void; hasSearch: boolean }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
                {hasSearch ? 'No leads match your search' : 'No leads yet'}
            </h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm">
                {hasSearch ? 'Try a different name or phone number.' : 'Leads from WhatsApp conversations will appear here. Add one to get started.'}
            </p>
            {!hasSearch && (
                <Button className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onAdd}>
                    <Plus className="mr-1.5 h-4 w-4" /> Add Lead
                </Button>
            )}
        </div>
    );
}
