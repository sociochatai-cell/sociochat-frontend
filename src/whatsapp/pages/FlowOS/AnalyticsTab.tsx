import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, BarChart3, TrendingUp } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { cachedFetch } from '../../utils/waPersistentCache';
import { RefreshButton } from '../../components/RefreshButton';
import { cn } from '@/lib/utils';

const API_PREFIX = `${API_BASE_URL}/api/whatsapp`;

interface FlowStat { flow_id: number; name: string; category: string; status: string; submissions: number; }

export function AnalyticsTab({ accountId }: { accountId: string | null }) {
  const [data, setData] = useState<{ total_submissions: number; today_submissions: number; flows: FlowStat[]; categories: Record<string, number>; total_flows: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = () => {
    if (!accountId) return;
    setLoading(true);
    cachedFetch(`${API_PREFIX}/flows/analytics/summary?account_id=${accountId}`)
      .then(r => r.json())
      .then(j => { if (j.success) setData(j); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAnalytics(); }, [accountId]);

  if (loading) return <div className="flex justify-center py-12"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!data) return <Card><CardContent className="py-8 text-center text-muted-foreground">No analytics data</CardContent></Card>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <RefreshButton onRefresh={loadAnalytics} isRefreshing={loading} title="Refresh" size="sm" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Total Forms', v: data.total_flows, c: 'from-primary/15', i: BarChart3 },
          { l: 'Total Submissions', v: data.total_submissions, c: 'from-blue-500/15', i: TrendingUp },
          { l: 'Today', v: data.today_submissions, c: 'from-green-500/15', i: TrendingUp },
          { l: 'Avg / Form', v: data.total_flows > 0 ? Math.round(data.total_submissions / data.total_flows) : 0, c: 'from-amber-500/15', i: BarChart3 },
        ].map(({ l, v, c, i: Icon }) => (
          <Card key={l} className={cn("bg-gradient-to-br", c, "to-transparent")}><CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-bold mt-1">{v}</p></div>
              <Icon className="w-5 h-5 text-muted-foreground/40" />
            </div>
          </CardContent></Card>
        ))}
      </div>
      {Object.keys(data.categories).length > 0 && (
        <Card><CardContent className="p-4">
          <p className="text-sm font-medium mb-3">By Category</p>
          <div className="space-y-2">
            {Object.entries(data.categories).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-sm w-32 truncate text-muted-foreground">{cat || 'Unknown'}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary/60 rounded-full" style={{ width: `${data.total_submissions > 0 ? (count / data.total_submissions) * 100 : 0}%` }} />
                </div>
                <span className="text-sm font-medium w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </CardContent></Card>
      )}
      <Card><CardContent className="p-4">
        <p className="text-sm font-medium mb-3">Form Leaderboard</p>
        <div className="space-y-2">
          {data.flows.filter(f => f.submissions > 0).slice(0, 10).map((f, i) => (
            <div key={f.flow_id} className="flex items-center gap-3 py-1.5">
              <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                i === 0 ? "bg-amber-500/20 text-amber-600" : i === 1 ? "bg-gray-300/30 text-gray-600" : i === 2 ? "bg-orange-500/20 text-orange-600" : "bg-muted text-muted-foreground"
              )}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.category} · {f.status}</p>
              </div>
              <span className="text-sm font-bold">{f.submissions}</span>
            </div>
          ))}
          {data.flows.filter(f => f.submissions > 0).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No submissions yet across any forms</p>
          )}
        </div>
      </CardContent></Card>
    </div>
  );
}
