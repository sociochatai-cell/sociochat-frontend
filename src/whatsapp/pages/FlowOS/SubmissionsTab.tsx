import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, User, Clock, ExternalLink, RefreshCw, Download, Eye } from 'lucide-react';
import { WHATSAPP_REST_API_PREFIX } from '@/config';
import { cachedFetch } from '../../utils/waPersistentCache';
import { cn } from '@/lib/utils';

interface Submission {
  id: number;
  flow_id: number;
  wa_id: string;
  conversation_id: number | null;
  response_json: Record<string, unknown>;
  status: string;
  submitted_at: string;
  flow_name?: string;
  form_type?: string;      // lead | feedback | booking | custom
  flow_category?: string;
}

const TYPE_META: Record<string, { l: string; c: string }> = {
  lead: { l: 'Lead Capture', c: 'bg-blue-500/10 text-blue-600' },
  feedback: { l: 'Feedback', c: 'bg-purple-500/10 text-purple-600' },
  booking: { l: 'Booking', c: 'bg-green-500/10 text-green-600' },
  custom: { l: 'Custom', c: 'bg-slate-500/10 text-slate-600' },
};
const TYPE_TABS = [
  { k: 'all', l: 'All' },
  { k: 'lead', l: 'Lead Capture' },
  { k: 'feedback', l: 'Feedback' },
  { k: 'booking', l: 'Booking' },
  { k: 'custom', l: 'Custom' },
];

export function SubmissionsTab({ accountId }: { accountId: string | null }) {
  const navigate = useNavigate();
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState<Submission | null>(null);

  const fetch_ = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const r = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/flows/submissions?account_id=${accountId}&page=${page}&per_page=20`);
      const j = await r.json();
      if (j.success) { setSubs(j.submissions || []); setTotal(j.total || 0); }
    } catch { } finally { setLoading(false); }
  }, [accountId, page]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const exportCSV = () => {
    if (!subs.length) return;
    const keys = new Set<string>();
    subs.forEach(s => { if (s.response_json) Object.keys(s.response_json).forEach(k => keys.add(k)); });
    const cols = ['wa_id', 'status', 'submitted_at', ...Array.from(keys)];
    const rows = subs.map(s => cols.map(k => {
      if (k === 'wa_id') return s.wa_id;
      if (k === 'status') return s.status;
      if (k === 'submitted_at') return s.submitted_at;
      const v = s.response_json?.[k]; return typeof v === 'string' ? `"${v}"` : v ?? '';
    }).join(','));
    const blob = new Blob([[cols.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `submissions_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  const sc = (s: string) => s === 'received' ? 'bg-blue-500/10 text-blue-600' : s === 'confirmed' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600';
  const filtered = typeFilter === 'all' ? subs : subs.filter(s => (s.form_type || 'custom') === typeFilter);

  if (loading) return <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>;

  if (!subs.length) return (
    <Card><CardContent className="py-12 text-center">
      <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
      <p className="text-muted-foreground">No submissions yet. Submissions appear here when users complete your forms.</p>
    </CardContent></Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} total submission{total !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetch_}><RefreshCw className="w-3.5 h-3.5 mr-1" />Refresh</Button>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-3.5 h-3.5 mr-1" />Export</Button>
        </div>
      </div>
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3">
        {[{ l: 'Total', v: total, c: 'from-blue-500/10' }, { l: 'Received', v: subs.filter(s => s.status === 'received').length, c: 'from-amber-500/10' }, { l: 'Confirmed', v: subs.filter(s => s.status === 'confirmed').length, c: 'from-green-500/10' }].map(({ l, v, c }) => (
          <Card key={l} className={cn("bg-gradient-to-br", c, "to-transparent")}><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p>
          </CardContent></Card>
        ))}
      </div>
      {/* Type filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TYPE_TABS.map(t => {
          const count = t.k === 'all' ? subs.length : subs.filter(s => (s.form_type || 'custom') === t.k).length;
          return (
            <Button key={t.k} variant={typeFilter === t.k ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setTypeFilter(t.k)}>
              {t.l}<span className="ml-1 opacity-60">{count}</span>
            </Button>
          );
        })}
      </div>
      {/* Table */}
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/30">
              {['User', 'Type', 'Status', 'Submitted', 'Data', 'Actions'].map(h => <th key={h} className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id} className="border-b hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelected(s)}>
                  <td className="py-2.5 px-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center"><User className="w-3.5 h-3.5 text-primary" /></div><span className="font-mono text-xs">{s.wa_id || '—'}</span></div></td>
                  <td className="py-2.5 px-3"><Badge variant="outline" className={cn("text-xs", (TYPE_META[s.form_type || 'custom'] || TYPE_META.custom).c)}>{(TYPE_META[s.form_type || 'custom'] || TYPE_META.custom).l}</Badge>{s.flow_name && <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">{s.flow_name}</div>}</td>
                  <td className="py-2.5 px-3"><Badge variant="outline" className={cn("text-xs", sc(s.status))}>{s.status}</Badge></td>
                  <td className="py-2.5 px-3 text-muted-foreground"><div className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}</div></td>
                  <td className="py-2.5 px-3"><div className="max-w-[200px] truncate text-xs text-muted-foreground">{s.response_json && Object.keys(s.response_json).length ? Object.entries(s.response_json).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}</div></td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={e => { e.stopPropagation(); setSelected(s); }}><Eye className="w-3 h-3" />View</Button>
                      {s.conversation_id ? <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={e => { e.stopPropagation(); navigate(`/dashboard/whatsapp/inbox?conversation=${s.conversation_id}`); }}><ExternalLink className="w-3 h-3" />Open</Button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
      {total > 20 && <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
        <span className="text-sm text-muted-foreground self-center">Page {page}/{Math.ceil(total / 20)}</span>
        <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>Next</Button>
      </div>}

      {/* Full submission details — every field the user filled, for any form type */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Submission details
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* meta chips */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("text-xs", (TYPE_META[selected.form_type || 'custom'] || TYPE_META.custom).c)}>
                  {(TYPE_META[selected.form_type || 'custom'] || TYPE_META.custom).l}
                </Badge>
                <Badge variant="outline" className={cn("text-xs", sc(selected.status))}>{selected.status}</Badge>
                {selected.flow_name && <span className="text-xs text-muted-foreground">{selected.flow_name}</span>}
              </div>

              {/* every field the user filled */}
              <div className="rounded-lg border divide-y">
                {selected.response_json && Object.keys(selected.response_json).length > 0 ? (
                  Object.entries(selected.response_json).map(([k, v]) => (
                    <div key={k} className="flex gap-3 px-3 py-2.5 text-sm">
                      <span className="w-2/5 shrink-0 font-medium text-muted-foreground capitalize break-words">
                        {k.replace(/_/g, ' ')}
                      </span>
                      <span className="flex-1 break-words whitespace-pre-wrap">
                        {v === null || v === undefined || v === ''
                          ? '—'
                          : typeof v === 'object'
                            ? JSON.stringify(v)
                            : String(v)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-4 text-sm text-muted-foreground text-center">No field data captured for this submission.</div>
                )}
              </div>

              {/* footer meta */}
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                <div><span className="font-medium">From: </span><span className="font-mono">{selected.wa_id || '—'}</span></div>
                <div><span className="font-medium">Submitted: </span>{selected.submitted_at ? new Date(selected.submitted_at).toLocaleString() : '—'}</div>
              </div>

              {selected.conversation_id && (
                <Button variant="outline" size="sm" className="w-full gap-1" onClick={() => navigate(`/dashboard/whatsapp/inbox?conversation=${selected.conversation_id}`)}>
                  <ExternalLink className="w-3.5 h-3.5" />Open conversation in inbox
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
