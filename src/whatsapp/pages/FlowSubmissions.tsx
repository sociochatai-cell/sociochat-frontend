/**
 * Flow Submissions Page — WhatsApp Flow OS
 * ==========================================
 * View all form submissions from WhatsApp Flows.
 * Click any row → opens inbox at that conversation.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, MessageCircle, ArrowLeft, RefreshCw, Download, ExternalLink, User, Clock, Calendar } from 'lucide-react';
import { WHATSAPP_API_BASE_URL } from '@/config';
import { getWorkspaceId } from '../utils/workspaceContext';
import { cachedFetch } from '../utils/waPersistentCache';
import { cn } from '@/lib/utils';

const API_BASE = WHATSAPP_API_BASE_URL;

interface Submission {
  id: number;
  flow_id: number;
  account_id: number;
  wa_id: string;
  conversation_id: number | null;
  message_id: number | null;
  flow_token: string | null;
  response_json: Record<string, unknown>;
  status: string;
  submitted_at: string;
  user_name: string | null;
}

export function FlowSubmissions() {
  const navigate = useNavigate();
  const { flowId } = useParams<{ flowId: string }>();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [flowName, setFlowName] = useState('');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const statusQ = statusFilter !== 'all' ? `&status=${statusFilter}` : '';
      const url = flowId
        ? `${API_BASE}/api/whatsapp/flows/${flowId}/submissions?page=${page}&per_page=25${statusQ}`
        : `${API_BASE}/api/whatsapp/flows/submissions?account_id=1&page=${page}&per_page=25${statusQ}`;

      const res = await cachedFetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        setSubmissions(json.submissions || []);
        setTotal(json.total || 0);
        if (json.flow_name) setFlowName(json.flow_name);
      }
    } catch (err) {
      console.error('Failed to fetch submissions:', err);
    } finally {
      setLoading(false);
    }
  }, [flowId, page, statusFilter]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const openInInbox = (conversationId: number | null) => {
    if (conversationId) {
      navigate(`/dashboard/whatsapp/inbox?conversation=${conversationId}`);
    }
  };

  const exportCSV = () => {
    if (!submissions.length) return;
    const allKeys = new Set<string>();
    submissions.forEach(s => {
      if (s.response_json) Object.keys(s.response_json).forEach(k => allKeys.add(k));
    });
    const keys = ['wa_id', 'user_name', 'status', 'submitted_at', ...Array.from(allKeys)];
    const header = keys.join(',');
    const rows = submissions.map(s => {
      return keys.map(k => {
        if (k === 'wa_id') return s.wa_id || '';
        if (k === 'user_name') return s.user_name || '';
        if (k === 'status') return s.status;
        if (k === 'submitted_at') return s.submitted_at;
        const val = s.response_json?.[k];
        return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val ?? '';
      }).join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flow_submissions_${flowId || 'all'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'confirmed': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'received': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {flowName ? `${flowName} — Submissions` : 'Flow Submissions'}
              </h1>
              <p className="text-sm text-muted-foreground">{total} total submission{total !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchSubmissions}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
            <Button variant="outline" onClick={exportCSV} className="gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{total}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Confirmed</p>
              <p className="text-2xl font-bold">{submissions.filter(s => s.status === 'confirmed').length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{submissions.filter(s => s.status === 'received').length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Cancelled</p>
              <p className="text-2xl font-bold">{submissions.filter(s => s.status === 'cancelled').length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Submissions Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mb-3 opacity-30" />
                <p>No submissions yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">User</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Phone</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Submitted</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Data</th>
                      <th className="text-left py-3 px-4 text-xs font-medium text-muted-foreground uppercase">Inbox</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map(sub => (
                      <tr key={sub.id} className="border-b hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => openInInbox(sub.conversation_id)}>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-primary" />
                            </div>
                            <span className="text-sm font-medium">{sub.user_name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground font-mono">{sub.wa_id || '—'}</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className={cn("text-xs", statusColor(sub.status))}>{sub.status}</Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : '—'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="max-w-xs truncate text-xs text-muted-foreground">
                            {sub.response_json ? Object.entries(sub.response_json).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {sub.conversation_id ? (
                            <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={(e) => { e.stopPropagation(); openInInbox(sub.conversation_id); }}>
                              <ExternalLink className="w-3.5 h-3.5" /> Open
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {total > 25 && (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / 25)}</span>
            <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default FlowSubmissions;
