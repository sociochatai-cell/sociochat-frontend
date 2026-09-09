import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Brain, User, Mail, Phone, Building2, Heart, MessageSquare,
  Wrench, Hash, Clock, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Conversation } from '../types';
import { WHATSAPP_REST_API_PREFIX } from '@/config';

interface AiInsightsPanelProps {
  conversation: Conversation | null;
  isOpen: boolean;
  onClose: () => void;
}

interface InsightData {
  id: number;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_company: string | null;
  interests: string | null;
  summary: string | null;
  actions_taken: Array<{
    tool: string;
    label: string;
    ok: boolean;
    detail?: string;
    timestamp?: string;
  }> | null;
  key_topics: string | null;
  sentiment: string | null;
  interaction_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export function AiInsightsPanel({ conversation, isOpen, onClose }: AiInsightsPanelProps) {
  const [insight, setInsight] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !conversation?.id) {
      setInsight(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const wsId = localStorage.getItem('wa_workspace_id') || '';

    fetch(`${WHATSAPP_REST_API_PREFIX}/conversations/${conversation.id}/insights`, {
      headers: {
        'X-Workspace-Id': wsId,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        setInsight(data.insight || null);
      })
      .catch(() => {
        setError('Failed to load insights');
      })
      .finally(() => setLoading(false));
  }, [isOpen, conversation?.id]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 360, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="h-full border-l bg-background overflow-hidden shrink-0"
        >
          <div className="h-full flex flex-col w-[360px]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                <h3 className="font-semibold text-sm">AI Insights</h3>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              )}

              {error && (
                <p className="text-sm text-red-500 text-center py-8">{error}</p>
              )}

              {!loading && !error && !insight && (
                <div className="text-center py-12 text-muted-foreground">
                  <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No AI insights yet</p>
                  <p className="text-xs mt-1">Insights appear after the AI agent interacts with this customer.</p>
                </div>
              )}

              {!loading && insight && (
                <>
                  {/* Summary */}
                  {insight.summary && (
                    <Section title="Summary" icon={<MessageSquare className="w-4 h-4" />}>
                      <p className="text-sm text-foreground/80 leading-relaxed">{insight.summary}</p>
                    </Section>
                  )}

                  {/* Customer Info */}
                  {(insight.customer_name || insight.customer_email || insight.customer_phone || insight.customer_company) && (
                    <Section title="Customer Details" icon={<User className="w-4 h-4" />}>
                      <div className="space-y-2">
                        {insight.customer_name && (
                          <InfoRow icon={<User className="w-3.5 h-3.5" />} label="Name" value={insight.customer_name} />
                        )}
                        {insight.customer_email && (
                          <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="Email" value={insight.customer_email} />
                        )}
                        {insight.customer_phone && (
                          <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="Phone" value={insight.customer_phone} />
                        )}
                        {insight.customer_company && (
                          <InfoRow icon={<Building2 className="w-3.5 h-3.5" />} label="Company" value={insight.customer_company} />
                        )}
                      </div>
                    </Section>
                  )}

                  {/* Interests */}
                  {insight.interests && (
                    <Section title="Interests" icon={<Heart className="w-4 h-4" />}>
                      <div className="flex flex-wrap gap-1.5">
                        {insight.interests.split(',').map((interest, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                          >
                            {interest.trim()}
                          </span>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Key Topics */}
                  {insight.key_topics && (
                    <Section title="Key Topics" icon={<Hash className="w-4 h-4" />}>
                      <div className="space-y-1.5">
                        {insight.key_topics.split(';').filter(Boolean).map((topic, i) => (
                          <p key={i} className="text-sm text-foreground/80">• {topic.trim()}</p>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Actions Taken */}
                  {insight.actions_taken && insight.actions_taken.length > 0 && (
                    <Section title="AI Actions" icon={<Wrench className="w-4 h-4" />}>
                      <div className="space-y-2">
                        {insight.actions_taken.map((action, i) => (
                          <div
                            key={i}
                            className={cn(
                              'flex items-start gap-2 text-sm rounded-md px-2.5 py-1.5',
                              action.ok
                                ? 'bg-green-50 dark:bg-green-900/20'
                                : 'bg-red-50 dark:bg-red-900/20',
                            )}
                          >
                            <span
                              className={cn(
                                'mt-0.5 w-1.5 h-1.5 rounded-full shrink-0',
                                action.ok ? 'bg-green-500' : 'bg-red-400',
                              )}
                            />
                            <div className="min-w-0">
                              <span className="font-medium">{action.label}</span>
                              {action.detail && (
                                <p className="text-xs text-muted-foreground mt-0.5 break-words">{action.detail}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Metadata */}
                  <div className="pt-3 border-t text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span>Interactions: {insight.interaction_count}</span>
                    </div>
                    {insight.updated_at && (
                      <p>Last updated: {new Date(insight.updated_at).toLocaleString()}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-muted-foreground">{icon}</span>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium truncate">{value}</span>
    </div>
  );
}
