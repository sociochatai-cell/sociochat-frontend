// Conversation Insights - Team Efficiency Metrics
// Shows new conversations, replies, response time, and open/closed stats

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    MessageSquarePlus, 
    MessagesSquare, 
    Clock, 
    CheckCircle2,
    XCircle,
    Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversationInsightsProps {
    conversations: {
        total: number;
        open: number;
        with_unread: number;
        active_sessions: number;
    } | null;
}

const MetricBox = ({
    icon: Icon,
    label,
    value,
    subtitle,
    color,
}: {
    icon: typeof MessageSquarePlus;
    label: string;
    value: string | number;
    subtitle?: string;
    color: 'blue' | 'green' | 'orange' | 'purple' | 'red' | 'cyan';
}) => {
    const colorClasses = {
        blue: 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400',
        green: 'bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400',
        orange: 'bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400',
        purple: 'bg-purple-50 dark:bg-purple-950/20 text-purple-600 dark:text-purple-400',
        red: 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400',
        cyan: 'bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-400',
    };
    
    return (
        <div className={cn(
            'p-4 rounded-xl transition-all duration-300 hover:shadow-md',
            colorClasses[color]
        )}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                    <p className="text-2xl font-bold">
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </p>
                    {subtitle && (
                        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
                    )}
                </div>
                <div className={cn('p-2 rounded-lg', colorClasses[color].split(' ')[0])}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
        </div>
    );
};

export function ConversationInsights({ conversations }: ConversationInsightsProps) {
    if (!conversations) {
        return (
            <Card className="border-0 shadow-md">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        💬 Conversation Insights
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="animate-pulse p-4 bg-muted/30 rounded-xl">
                                <div className="h-3 bg-muted rounded w-20 mb-2" />
                                <div className="h-8 bg-muted rounded w-12" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    // Calculate closed conversations
    const closed = Math.max(0, conversations.total - conversations.open);
    
    // Calculate open/closed ratio
    const openRatio = conversations.total > 0 
        ? Math.round((conversations.open / conversations.total) * 100) 
        : 0;
    
    return (
        <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                    💬 Conversation Insights
                </CardTitle>
                <CardDescription>
                    Team efficiency and conversation management
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <MetricBox
                        icon={Users}
                        label="Total Conversations"
                        value={conversations.total}
                        subtitle="All time"
                        color="blue"
                    />
                    <MetricBox
                        icon={MessageSquarePlus}
                        label="Open Chats"
                        value={conversations.open}
                        subtitle={`${openRatio}% of total`}
                        color="green"
                    />
                    <MetricBox
                        icon={Clock}
                        label="Active Sessions"
                        value={conversations.active_sessions}
                        subtitle="24h window"
                        color="orange"
                    />
                    <MetricBox
                        icon={MessagesSquare}
                        label="Needs Attention"
                        value={conversations.with_unread}
                        subtitle="Unread messages"
                        color="red"
                    />
                </div>
                
                {/* Open vs Closed visual */}
                <div className="mt-6 p-4 bg-muted/30 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">Open vs Closed</span>
                        <span className="text-xs text-muted-foreground">
                            {conversations.open} open / {closed} closed
                        </span>
                    </div>
                    <div className="h-4 bg-muted rounded-full overflow-hidden flex">
                        <div 
                            className="h-full bg-green-500 transition-all duration-500"
                            style={{ width: `${openRatio}%` }}
                        />
                        <div 
                            className="h-full bg-gray-400 transition-all duration-500"
                            style={{ width: `${100 - openRatio}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="text-muted-foreground">Open ({openRatio}%)</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <div className="w-3 h-3 rounded-full bg-gray-400" />
                            <span className="text-muted-foreground">Closed ({100 - openRatio}%)</span>
                        </div>
                    </div>
                </div>
                
                {/* Tips */}
                {conversations.with_unread > 0 && (
                    <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <p className="text-xs text-orange-700 dark:text-orange-400">
                            <strong>⚠️ Action needed:</strong> You have {conversations.with_unread} conversation(s) 
                            with unread messages waiting for a response.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default ConversationInsights;
