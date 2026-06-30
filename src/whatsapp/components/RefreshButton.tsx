/**
 * RefreshButton / CacheStatusBar
 * ==============================
 * Shared "last updated • refresh" controls for WhatsApp pages.
 *
 * Pairs with `useDataCache` (which exposes `lastUpdated`, `isRefreshing`, `refresh`)
 * and with the persistent cache: pages now paint instantly from cache, and this bar
 * tells the user how fresh that data is and lets them pull the latest on demand.
 */

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Human-friendly "x ago" from an epoch-ms timestamp. */
export function formatRelativeTime(ts: number | null | undefined): string {
    if (!ts) return '';
    const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
}

/** Re-renders on an interval so a relative timestamp stays current without prop churn. */
function useNow(intervalMs = 15000, enabled = true): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!enabled) return;
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs, enabled]);
    return now;
}

export interface LastUpdatedProps {
    lastUpdated: number | null | undefined;
    className?: string;
    prefix?: string;
}

/** "Updated 12s ago" — live-updating, hidden until there is a timestamp. */
export function LastUpdated({ lastUpdated, className, prefix = 'Updated' }: LastUpdatedProps) {
    // Subscribe to a ticking clock so the label refreshes itself.
    useNow(15000, !!lastUpdated);
    if (!lastUpdated) return null;
    return (
        <span className={cn('text-xs text-muted-foreground whitespace-nowrap', className)}>
            {prefix} {formatRelativeTime(lastUpdated)}
        </span>
    );
}

export interface RefreshButtonProps {
    onRefresh: () => void | Promise<void>;
    /** Show the spinning state. */
    isRefreshing?: boolean;
    disabled?: boolean;
    className?: string;
    title?: string;
    /** "icon" = compact icon-only button (default); "button" = icon + "Refresh" label. */
    variant?: 'icon' | 'button';
    label?: string;
    size?: 'sm' | 'default';
}

/** A standardized refresh button with a spinning icon while refreshing. */
export function RefreshButton({
    onRefresh,
    isRefreshing = false,
    disabled = false,
    className,
    title = 'Refresh',
    variant = 'icon',
    label = 'Refresh',
    size = 'default',
}: RefreshButtonProps) {
    const spin = <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />;
    if (variant === 'button') {
        return (
            <Button
                variant="outline"
                size={size}
                onClick={() => void onRefresh()}
                disabled={disabled || isRefreshing}
                title={title}
                className={cn('gap-1.5', className)}
            >
                {spin}
                {label}
            </Button>
        );
    }
    return (
        <Button
            variant="outline"
            size="icon"
            onClick={() => void onRefresh()}
            disabled={disabled || isRefreshing}
            title={title}
            className={className}
        >
            {spin}
        </Button>
    );
}

export interface CacheStatusBarProps {
    lastUpdated: number | null | undefined;
    isRefreshing?: boolean;
    onRefresh: () => void | Promise<void>;
    disabled?: boolean;
    className?: string;
    /** Hide the "Updated x ago" label (e.g. on very narrow layouts). */
    hideTimestamp?: boolean;
    refreshVariant?: 'icon' | 'button';
}

/**
 * "Updated x ago  ⟳" — the standard combined control for page headers.
 */
export function CacheStatusBar({
    lastUpdated,
    isRefreshing = false,
    onRefresh,
    disabled = false,
    className,
    hideTimestamp = false,
    refreshVariant = 'icon',
}: CacheStatusBarProps) {
    return (
        <div className={cn('flex items-center gap-2', className)}>
            {!hideTimestamp && <LastUpdated lastUpdated={lastUpdated} className="hidden sm:block" />}
            <RefreshButton
                onRefresh={onRefresh}
                isRefreshing={isRefreshing}
                disabled={disabled}
                variant={refreshVariant}
                title="Refresh data"
            />
        </div>
    );
}

export default RefreshButton;
