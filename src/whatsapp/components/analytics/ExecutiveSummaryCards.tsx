// Executive Summary Cards - CEO View
// Business-friendly metrics with period comparison

import { Card, CardContent } from '@/components/ui/card';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    MessageCircle,
    CheckCheck,
    Eye,
    Users,
    Clock,
    TrendingUp,
    TrendingDown,
    Minus,
    Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryData {
    current: {
        sent: number;
        delivered: number;
        read: number;
        failed: number;
        delivery_rate: number;
        read_rate: number;
        active_customers: number;
        avg_response_time_seconds?: number;
    };
    previous: {
        sent: number;
        delivered: number;
        read: number;
        failed: number;
    };
    comparison: {
        sent_change: number;
        delivered_change: number;
        read_change: number;
    };
    period_days: number;
}

interface ExecutiveSummaryCardsProps {
    data: SummaryData | null;
    loading?: boolean;
}

// Business-friendly metric descriptions
const METRIC_INFO: Record<string, { label: string; description: string }> = {
    messages_sent: {
        label: 'Messages Sent',
        description: 'Total outgoing messages sent to customers. This shows your WhatsApp activity level.',
    },
    delivery_health: {
        label: 'Delivery Health',
        description: 'Percentage of messages successfully delivered to customer devices. 95%+ is healthy.',
    },
    customer_attention: {
        label: 'Customer Attention',
        description: 'Percentage of delivered messages that were opened and read. Higher = better engagement.',
    },
    active_customers: {
        label: 'Active Customers',
        description: 'Unique customers who exchanged messages with you in this period.',
    },
    response_speed: {
        label: 'Response Speed',
        description: 'Average time to respond to customer messages. Faster responses lead to better satisfaction.',
    },
};

const TrendIndicator = ({ value, inverted = false }: { value: number; inverted?: boolean }) => {
    const isPositive = inverted ? value < 0 : value > 0;
    const isNegative = inverted ? value > 0 : value < 0;
    
    if (value === 0) {
        return (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Minus className="w-3 h-3" />
                No change
            </span>
        );
    }
    
    return (
        <span className={cn(
            'flex items-center gap-1 text-xs font-medium',
            isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-muted-foreground'
        )}>
            {value > 0 ? (
                <TrendingUp className="w-3 h-3" />
            ) : (
                <TrendingDown className="w-3 h-3" />
            )}
            {value > 0 ? '+' : ''}{value}% vs last period
        </span>
    );
};

const InfoTooltip = ({ metricKey }: { metricKey: string }) => {
    const info = METRIC_INFO[metricKey];
    if (!info) return null;
    
    return (
        <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
                <button className="group relative ml-1.5 inline-flex items-center justify-center">
                    <Info className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">{info.description}</p>
            </TooltipContent>
        </Tooltip>
    );
};

const MetricCard = ({
    label,
    businessLabel,
    value,
    subtitle,
    icon: Icon,
    trend,
    color,
    metricKey,
}: {
    label: string;
    businessLabel: string;
    value: string | number;
    subtitle?: string;
    icon: typeof MessageCircle;
    trend?: number;
    color: 'blue' | 'green' | 'purple' | 'orange' | 'cyan' | 'pink';
    metricKey: string;
}) => {
    const colorClasses = {
        blue: 'from-blue-500/15 to-blue-500/5 text-blue-600 dark:text-blue-400',
        green: 'from-green-500/15 to-green-500/5 text-green-600 dark:text-green-400',
        purple: 'from-purple-500/15 to-purple-500/5 text-purple-600 dark:text-purple-400',
        orange: 'from-orange-500/15 to-orange-500/5 text-orange-600 dark:text-orange-400',
        cyan: 'from-cyan-500/15 to-cyan-500/5 text-cyan-600 dark:text-cyan-400',
        pink: 'from-pink-500/15 to-pink-500/5 text-pink-600 dark:text-pink-400',
    };
    
    const iconBgClasses = {
        blue: 'bg-blue-100 dark:bg-blue-900/30',
        green: 'bg-green-100 dark:bg-green-900/30',
        purple: 'bg-purple-100 dark:bg-purple-900/30',
        orange: 'bg-orange-100 dark:bg-orange-900/30',
        cyan: 'bg-cyan-100 dark:bg-cyan-900/30',
        pink: 'bg-pink-100 dark:bg-pink-900/30',
    };
    
    return (
        <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 border-0 shadow-md">
            <div className={cn(
                'absolute inset-0 bg-gradient-to-br opacity-60 group-hover:opacity-80 transition-opacity',
                colorClasses[color]
            )} />
            <CardContent className="relative p-4 md:p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-muted-foreground flex items-center">
                            {businessLabel}
                            <InfoTooltip metricKey={metricKey} />
                        </p>
                        <p className="text-2xl md:text-3xl font-bold mt-1 tracking-tight">
                            {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
                        </p>
                        {subtitle && (
                            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
                        )}
                        {trend !== undefined && (
                            <div className="mt-2">
                                <TrendIndicator value={trend} />
                            </div>
                        )}
                    </div>
                    <div className={cn(
                        'p-2.5 rounded-xl transition-transform duration-300 group-hover:scale-110 shrink-0',
                        iconBgClasses[color]
                    )}>
                        <Icon className={cn('w-5 h-5', colorClasses[color].split(' ').slice(-1)[0])} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export function ExecutiveSummaryCards({ data, loading }: ExecutiveSummaryCardsProps) {
    if (loading || !data) {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
                {[...Array(5)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                        <CardContent className="p-4 md:p-5">
                            <div className="h-4 bg-muted rounded w-24 mb-2" />
                            <div className="h-8 bg-muted rounded w-16 mb-2" />
                            <div className="h-3 bg-muted rounded w-20" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }
    
    // Format response time
    const formatResponseTime = (seconds?: number) => {
        if (!seconds) return 'N/A';
        if (seconds < 60) return `${Math.round(seconds)}s`;
        if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
        return `${Math.round(seconds / 3600)}h`;
    };
    
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Executive Summary</h2>
                <span className="text-xs text-muted-foreground">
                    Last {data.period_days} days vs previous {data.period_days} days
                </span>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
                <MetricCard
                    label="Messages Sent"
                    businessLabel="Messages Sent"
                    value={data.current.sent}
                    trend={data.comparison.sent_change}
                    icon={MessageCircle}
                    color="blue"
                    metricKey="messages_sent"
                />
                <MetricCard
                    label="Delivery Rate"
                    businessLabel="Delivery Health"
                    value={`${data.current.delivery_rate}%`}
                    subtitle={`${data.current.delivered.toLocaleString('en-IN')} delivered`}
                    trend={data.comparison.delivered_change}
                    icon={CheckCheck}
                    color="green"
                    metricKey="delivery_health"
                />
                <MetricCard
                    label="Read Rate"
                    businessLabel="Customer Attention"
                    value={`${data.current.read_rate}%`}
                    subtitle={`${data.current.read.toLocaleString('en-IN')} read`}
                    trend={data.comparison.read_change}
                    icon={Eye}
                    color="purple"
                    metricKey="customer_attention"
                />
                <MetricCard
                    label="Active Customers"
                    businessLabel="Active Customers"
                    value={data.current.active_customers}
                    icon={Users}
                    color="orange"
                    metricKey="active_customers"
                />
                <MetricCard
                    label="Response Time"
                    businessLabel="Response Speed"
                    value={formatResponseTime(data.current.avg_response_time_seconds)}
                    icon={Clock}
                    color="cyan"
                    metricKey="response_speed"
                />
            </div>
        </div>
    );
}

export default ExecutiveSummaryCards;
