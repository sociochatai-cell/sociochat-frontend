import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Clock, Activity, AlertCircle, Info, RefreshCw, ShieldAlert } from 'lucide-react';
import { getOperationalTimeline } from '../api';
import { getWorkspaceId } from '../utils/workspaceContext';
import { RefreshButton } from '../components/RefreshButton';

export function TrustCenter({ accountId }: { accountId: number }) {
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<any[]>([]);

  const fetchTimeline = async () => {
    setLoading(true);
    const wsId = getWorkspaceId() || '';
    const result = await getOperationalTimeline(accountId, wsId);
    if (result && result.success) {
      setTimeline(result.timeline || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (accountId) fetchTimeline();
  }, [accountId]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'onboarding': return <Shield className="w-4 h-4 text-purple-600" />;
      case 'webhook': return <Activity className="w-4 h-4 text-blue-600" />;
      case 'trust_snapshot': return <Clock className="w-4 h-4 text-orange-600" />;
      case 'safe_mode': return <ShieldAlert className="w-4 h-4 text-rose-600" />;
      default: return <Info className="w-4 h-4 text-gray-600" />;
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-muted-foreground justify-center">
        <RefreshCw className="w-5 h-5 animate-spin" />
        Loading Trust Timeline...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Operational Timeline
              </CardTitle>
              <CardDescription>
                History of account quality, onboarding events, and webhook health changes.
              </CardDescription>
            </div>
            <RefreshButton onRefresh={fetchTimeline} isRefreshing={loading} title="Refresh" />
          </div>
        </CardHeader>
        <CardContent>
          {timeline.length > 0 ? (
            <div className="space-y-4">
              {timeline.map((event, i) => (
                <div key={i} className="flex gap-4 p-3 border rounded-lg bg-gray-50/50 hover:bg-white transition-colors">
                  <div className="mt-1 bg-white p-2 border rounded-full shrink-0 shadow-sm">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <p className="font-semibold text-sm">{event.description}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(event.timestamp)}
                      </span>
                    </div>
                    {event.details && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {event.details.quality && (
                          <Badge variant="outline" className={
                            event.details.quality === 'GREEN' ? 'bg-green-50 text-green-700' :
                            event.details.quality === 'YELLOW' ? 'bg-yellow-50 text-yellow-700' :
                            'bg-red-50 text-red-700'
                          }>
                            Quality: {event.details.quality}
                          </Badge>
                        )}
                        {event.details.webhook_health && (
                          <Badge variant="outline" className={
                            event.details.webhook_health === 'healthy' ? 'bg-green-50 text-green-700' :
                            'bg-red-50 text-red-700'
                          }>
                            Webhooks: {event.details.webhook_health.replace(/_/g, ' ')}
                          </Badge>
                        )}
                        {event.details.restriction_state && (
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            Restriction: {event.details.restriction_state}
                          </Badge>
                        )}
                        {event.type === 'safe_mode' && (
                          <>
                            <Badge variant="outline" className="bg-rose-50 text-rose-700">
                              Event: {event.details.event_type}
                            </Badge>
                            {event.details.new_mode && (
                              <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-300">
                                Mode: {event.details.previous_mode} &rarr; {event.details.new_mode}
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No operational events recorded yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
