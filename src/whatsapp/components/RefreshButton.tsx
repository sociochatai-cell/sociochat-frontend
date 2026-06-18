import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RefreshButtonProps {
    onRefresh: () => void;
    isRefreshing?: boolean;
    title?: string;
    size?: 'sm' | 'default' | 'icon';
    className?: string;
}

export function RefreshButton({ onRefresh, isRefreshing, title = 'Refresh', size = 'sm', className }: RefreshButtonProps) {
    return (
        <Button variant="outline" size={size} onClick={onRefresh} disabled={isRefreshing} title={title} className={className}>
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin', size !== 'icon' && 'mr-1')} />
            {size !== 'icon' && 'Refresh'}
        </Button>
    );
}
