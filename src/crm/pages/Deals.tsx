import { useEffect, useMemo, useState } from 'react';
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
import { Progress } from '@/components/ui/progress';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Handshake, Plus, Building2, Loader2, RefreshCw, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import crmApi from '../api';
import type { Deal, DealStage } from '../types';
import { DEAL_COLUMNS, DEAL_STAGE_MAP, formatCurrency } from '../components/statusConfig';
import DealDrawer from '../components/DealDrawer';

export default function Deals() {
    const [deals, setDeals] = useState<Deal[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const [addOpen, setAddOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState<{ name: string; company: string; value: string; stage: DealStage }>({
        name: '', company: '', value: '', stage: 'prospect',
    });

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const fetchDeals = async () => {
        setLoading(true);
        try {
            const data = await crmApi.getDeals();
            setDeals(Array.isArray(data) ? data : []);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to load deals');
            setDeals([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchDeals(); }, []);

    const byStage = useMemo(() => {
        const map = {} as Record<DealStage, Deal[]>;
        for (const c of DEAL_COLUMNS) map[c.key] = [];
        for (const d of deals) (map[d.stage] ?? (map.prospect)).push(d);
        return map;
    }, [deals]);

    const activeDeal = activeId ? deals.find((d) => d.id === activeId) ?? null : null;

    const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

    const onDragEnd = async (e: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = e;
        if (!over) return;
        const dealId = String(active.id);
        const newStage = String(over.id) as DealStage;
        const deal = deals.find((d) => d.id === dealId);
        if (!deal || deal.stage === newStage || !DEAL_STAGE_MAP[newStage]) return;

        const prevStage = deal.stage;
        setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d)));
        try {
            await crmApi.changeDealStage(dealId, newStage);
            toast.success(`"${deal.name}" → ${DEAL_STAGE_MAP[newStage].label}`);
        } catch (err: any) {
            setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: prevStage } : d)));
            toast.error(err?.message || 'Failed to change stage');
        }
    };

    const handleAdd = async () => {
        if (!form.name.trim()) { toast.error('Deal name is required'); return; }
        setSubmitting(true);
        try {
            const created: any = await crmApi.createDeal({
                name: form.name.trim(),
                company: form.company.trim() || undefined,
                value: Number(form.value) || 0,
                stage: form.stage,
            });
            // Backend returns only { id } (or { deal:{...} }); rebuild the row from
            // the form so the new deal shows its name/value/stage instead of blank.
            const newId = created?.id ?? created?.deal?.id;
            if (newId) {
                const newDeal: Deal = (created?.deal && created.deal.name)
                    ? created.deal
                    : {
                        ...(created?.deal || {}),
                        id: newId,
                        name: form.name.trim(),
                        company: form.company.trim() || undefined,
                        value: Number(form.value) || 0,
                        stage: form.stage,
                    } as Deal;
                setDeals((prev) => [newDeal, ...prev]);
            } else {
                fetchDeals();
            }
            toast.success('Deal added');
            setAddOpen(false);
            setForm({ name: '', company: '', value: '', stage: 'prospect' });
        } catch (e: any) {
            toast.error(e?.message || 'Failed to add deal');
        } finally {
            setSubmitting(false);
        }
    };

    const totalValue = useMemo(() => deals.reduce((s, d) => s + (d.value || 0), 0), [deals]);

    return (
        <div className="p-4 sm:p-6 space-y-6 min-w-0">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Handshake className="h-6 w-6 text-emerald-600 shrink-0" /> Deals
                    </h1>
                    <p className="text-slate-500 text-sm">
                        Pipeline value <span className="font-semibold text-slate-700">{formatCurrency(totalValue)}</span> across {deals.length} deals.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={fetchDeals} disabled={loading} title="Refresh">
                        <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
                    </Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setAddOpen(true)}>
                        <Plus className="mr-1.5 h-4 w-4" /> Add Deal
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
                </div>
            ) : deals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                        <Handshake className="h-8 w-8 text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">No deals yet</h3>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm">
                        Convert a qualified lead or add a deal to start building your pipeline.
                    </p>
                    <Button className="mt-5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setAddOpen(true)}>
                        <Plus className="mr-1.5 h-4 w-4" /> Add Deal
                    </Button>
                </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCorners}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                >
                    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
                        {DEAL_COLUMNS.map((col) => {
                            const items = byStage[col.key];
                            const sum = items.reduce((s, d) => s + (d.value || 0), 0);
                            return (
                                <StageColumn
                                    key={col.key}
                                    colKey={col.key}
                                    label={col.label}
                                    accent={col.accent}
                                    dot={col.dot}
                                    count={items.length}
                                    sum={sum}
                                >
                                    {items.map((deal) => (
                                        <DealCard key={deal.id} deal={deal}
                                            onOpen={(d) => { setSelectedDeal(d); setDrawerOpen(true); }} />
                                    ))}
                                </StageColumn>
                            );
                        })}
                    </div>
                    <DragOverlay>
                        {activeDeal ? <DealCard deal={activeDeal} dragging /> : null}
                    </DragOverlay>
                </DndContext>
            )}

            {/* Add dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Deal</DialogTitle>
                        <DialogDescription>Create a new deal in your pipeline.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label htmlFor="deal-name">Deal name</Label>
                            <Input id="deal-name" value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="Enterprise plan — Acme" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="deal-company">Company</Label>
                            <Input id="deal-company" value={form.company}
                                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                                placeholder="Acme Inc." />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="deal-value">Value</Label>
                            <Input id="deal-value" type="number" min="0" value={form.value}
                                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                                placeholder="5000" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Stage</Label>
                            <Select value={form.stage}
                                onValueChange={(v) => setForm((f) => ({ ...f, stage: v as DealStage }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {DEAL_COLUMNS.map((c) => (
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
                            Add Deal
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DealDrawer
                deal={selectedDeal}
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                onUpdated={(d) => setDeals((prev) => prev.map((x) => (x.id === d.id ? { ...x, ...d } : x)))}
            />
        </div>
    );
}

function StageColumn({
    colKey, label, accent, dot, count, sum, children,
}: {
    colKey: string; label: string; accent: string; dot: string;
    count: number; sum: number; children: React.ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: colKey });
    return (
        <div className="flex flex-col w-72 shrink-0">
            <div className={cn('rounded-xl border px-3 py-2 mb-3', accent)}>
                <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                        <span className={cn('h-2 w-2 rounded-full', dot)} /> {label}
                    </span>
                    <span className="text-xs font-semibold rounded-full bg-white/70 px-2 py-0.5">{count}</span>
                </div>
                <div className="text-xs font-medium mt-1 opacity-80">{formatCurrency(sum)}</div>
            </div>
            <div
                ref={setNodeRef}
                className={cn(
                    'flex-1 min-h-[120px] space-y-2.5 rounded-xl p-1.5 transition-colors',
                    isOver ? 'bg-emerald-50/70 ring-2 ring-emerald-200' : 'bg-slate-50/60',
                )}
            >
                {count === 0 && (
                    <p className="text-center text-xs text-slate-400 py-6">Drop deals here</p>
                )}
                {children}
            </div>
        </div>
    );
}

function DealCard({ deal, dragging, onOpen }: { deal: Deal; dragging?: boolean; onOpen?: (d: Deal) => void }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id });
    const prob = typeof deal.probability === 'number' ? Math.max(0, Math.min(100, deal.probability)) : null;
    return (
        <motion.div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            initial={false}
            onClick={() => onOpen?.(deal)}
            className={cn(
                'cursor-grab active:cursor-grabbing rounded-xl border border-border bg-white p-3 shadow-sm hover:shadow-md transition-shadow',
                (isDragging || dragging) && 'opacity-60 shadow-lg ring-2 ring-emerald-200',
            )}
        >
            <p className="font-semibold text-slate-800 text-sm truncate">{deal.name}</p>
            {deal.company && (
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 truncate">
                    <Building2 className="h-3 w-3 shrink-0" /> {deal.company}
                </p>
            )}
            <div className="mt-2.5 flex items-center justify-between">
                <span className="text-sm font-bold text-emerald-700">
                    {formatCurrency(deal.value, deal.currency || 'USD')}
                </span>
                {prob != null && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                        <TrendingUp className="h-3 w-3" /> {prob}%
                    </span>
                )}
            </div>
            {prob != null && (
                <Progress value={prob} className="h-1.5 mt-2 bg-slate-100 [&>div]:bg-emerald-500" />
            )}
        </motion.div>
    );
}
