import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, User, Clock, ExternalLink, RefreshCw, Download } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { cachedFetch } from '../../utils/waPersistentCache';
import { cn } from '@/lib/utils';

const API_PREFIX = `${API_BASE_URL}/api/whatsapp`;

interface Submission {
  id: number;
  flow_id: number;
  wa_id: string;
  conversation_id: number | null;
  response_json: Record<string, unknown>;
  status: string;
  submitted_at: string;
  flow_name?: string;
}

export function SubmissionsTab({ accountId }: { accountId: string | null }) {
  const navigate = useNavigate();
  const [subs, setSubs] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetch_ = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const r = await cachedFetch(`${API_PREFIX}/flows/submissions?account_id=${accountId}&page=${page}&per_page=20`);
      const j = await r.json();
      if (j.success) { setSubs(j.submissions || []); setTotal(j.total || 0); }
    } catch { /* ignore */ } finally { setLoading(false); }
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
      <div className="grid grid-cols-3 gap-3">
        {[{ l: 'Total', v: total, c: 'from-blue-500/10' }, { l: 'Received', v: subs.filter(s => s.status === 'received').length, c: 'from-amber-500/10' }, { l: 'Confirmed', v: subs.filter(s => s.status === 'confirmed').length, c: 'from-green-500/10' }].map(({ l, v, c }) => (
          <Card key={l} className={cn("bg-gradient-to-br", c, "to-transparent")}><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p>
          </CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/30">
              {['User', 'Status', 'Submitted', 'Data', 'Inbox'].map(h => <th key={h} className="text-left py-2.5 px-3 text-xs font-medium text-muted-foreground uppercase">{h}</th>)}
            </tr></thead>
            <tbody>
              {subs.map(s => (
                <tr key={s.id} className="border-b hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => s.conversation_id && navigate(`/dashboard/inbox?conversation=${s.conversation_id}`)}>
                  <td className="py-2.5 px-3"><div className="flex items-center gap-2"><div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center"><User className="w-3.5 h-3.5 text-primary" /></div><span className="font-mono text-xs">{s.wa_id || '—'}</span></div></td>
                  <td className="py-2.5 px-3"><Badge variant="outline" className={cn("text-xs", sc(s.status))}>{s.status}</Badge></td>
                  <td className="py-2.5 px-3 text-muted-foreground"><div className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.submitted_at ? new Date(s.submitted_at).toLocaleString() : '—'}</div></td>
                  <td className="py-2.5 px-3"><div className="max-w-[200px] truncate text-xs text-muted-foreground">{s.response_json ? Object.entries(s.response_json).slice(0, 2).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}</div></td>
                  <td className="py-2.5 px-3">{s.conversation_id ? <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={e => { e.stopPropagation(); navigate(`/dashboard/inbox?conversation=${s.conversation_id}`); }}><ExternalLink className="w-3 h-3" />Open</Button> : <span className="text-xs text-muted-foreground">—</span>}</td>
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
    </div>
  );
}
