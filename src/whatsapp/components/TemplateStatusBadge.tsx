// Template Status Badge Component
// ================================
// Shows template approval status with appropriate styling

import { Badge } from '@/components/ui/badge';
import { Check, Clock, X, Pause, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TemplateStatusBadgeProps {
    status: string;
    className?: string;
}

export function TemplateStatusBadge({ status, className }: TemplateStatusBadgeProps) {
    const statusConfig: Record<string, { icon: typeof Check; label: string; variant: string }> = {
        APPROVED: {
            icon: Check,
            label: 'Approved',
            variant: 'bg-green-100 text-green-700 border-green-200',
        },
        PENDING: {
            icon: Clock,
            label: 'Pending',
            variant: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        },
        REJECTED: {
            icon: X,
            label: 'Rejected',
            variant: 'bg-red-100 text-red-700 border-red-200',
        },
        PAUSED: {
            icon: Pause,
            label: 'Paused',
            variant: 'bg-orange-100 text-orange-700 border-orange-200',
        },
        DISABLED: {
            icon: AlertCircle,
            label: 'Disabled',
            variant: 'bg-gray-100 text-gray-700 border-gray-200',
        },
    };

    const config = statusConfig[status.toUpperCase()] || statusConfig.PENDING;
    const Icon = config.icon;

    return (
        <Badge
            variant="outline"
            className={cn(
                'gap-1 font-medium border',
                config.variant,
                className
            )}
        >
            <Icon className="w-3 h-3" />
            {config.label}
        </Badge>
    );
}
