// Delivery Funnel - Visual message flow
// Shows Sent → Delivered → Read with clear explanations

import { useEffect, useRef, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeliveryFunnelProps {
    sent: number;
    delivered: number;
    read: number;
    failed?: number;
    loading?: boolean;
}

export function DeliveryFunnel({ sent, delivered, read, failed = 0, loading = false }: DeliveryFunnelProps) {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const [isInView, setIsInView] = useState(false);

    useEffect(() => {
        if (loading || !cardRef.current || isInView) return;

        const fallbackTimer = window.setTimeout(() => {
            setIsInView(true);
        }, 650);

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry?.isIntersecting) {
                    setIsInView(true);
                    window.clearTimeout(fallbackTimer);
                    observer.disconnect();
                }
            },
            { threshold: 0.08, rootMargin: '0px 0px -8% 0px' }
        );

        observer.observe(cardRef.current);
        return () => {
            window.clearTimeout(fallbackTimer);
            observer.disconnect();
        };
    }, [isInView, loading]);

    if (loading) {
        return (
            <Card className="border-0 shadow-md">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">📊 Delivery Funnel</CardTitle>
                    <CardDescription>How your messages flow from sent to read</CardDescription>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                    <div className="space-y-1">
                        <div className="h-4 w-24 rounded bg-muted animate-pulse" />
                        <div className="h-12 w-full rounded-lg bg-gradient-to-r from-indigo-200/70 via-indigo-100/50 to-indigo-200/70 animate-pulse" />
                    </div>
                    <div className="h-5 w-20 mx-auto rounded bg-muted animate-pulse" />
                    <div className="space-y-1">
                        <div className="h-4 w-28 rounded bg-muted animate-pulse" />
                        <div className="h-12 w-4/5 mx-auto rounded-lg bg-gradient-to-r from-green-200/70 via-green-100/50 to-green-200/70 animate-pulse" />
                    </div>
                    <div className="h-5 w-24 mx-auto rounded bg-muted animate-pulse" />
                    <div className="space-y-1">
                        <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                        <div className="h-12 w-3/5 mx-auto rounded-lg bg-gradient-to-r from-blue-200/70 via-blue-100/50 to-blue-200/70 animate-pulse" />
                    </div>
                    <div className="mt-4 h-14 w-full rounded-lg bg-muted/60 animate-pulse" />
                </CardContent>
            </Card>
        );
    }

    // Calculate rates
    const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
    const readRate = delivered > 0 ? Math.round((read / delivered) * 100) : 0;
    const failureRate = sent > 0 ? Math.round((failed / sent) * 100) : 0;
    
    // Calculate widths for visual funnel effect (min 30% for visibility)
    const sentWidth = 100;
    const deliveredWidth = Math.max(30, deliveryRate);
    const readWidth = Math.max(20, (read / sent) * 100 || 0);
    const animatedSentWidth = isInView ? sentWidth : 0;
    const animatedDeliveredWidth = isInView ? deliveredWidth : 0;
    const animatedReadWidth = isInView ? readWidth : 0;
    const animatedFailedWidth = isInView ? Math.max(15, failureRate) : 0;
    
    return (
        <Card ref={cardRef} className="border-0 shadow-md">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                    📊 Delivery Funnel
                </CardTitle>
                <CardDescription>
                    How your messages flow from sent to read
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="space-y-2">
                    {/* Sent */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-foreground">Sent</span>
                            <span className="font-bold text-lg">{sent.toLocaleString()}</span>
                        </div>
                        <div 
                            className="h-12 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm transition-all duration-700 ease-out"
                            style={{ width: `${animatedSentWidth}%` }}
                        >
                            {sent.toLocaleString()} messages
                        </div>
                    </div>
                    
                    {/* Arrow with drop-off info */}
                    <div className="flex items-center justify-center py-1">
                        <ArrowDown className="w-5 h-5 text-muted-foreground" />
                        {sent > delivered && (
                            <span className="text-xs text-muted-foreground ml-2">
                                {(sent - delivered).toLocaleString()} not delivered
                            </span>
                        )}
                    </div>
                    
                    {/* Delivered */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-foreground">Delivered</span>
                            <span className="flex items-center gap-2">
                                <span className="font-bold text-lg">{delivered.toLocaleString()}</span>
                                <span className={cn(
                                    'text-xs px-2 py-0.5 rounded-full',
                                    deliveryRate >= 95 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                    deliveryRate >= 80 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                )}>
                                    {deliveryRate}%
                                </span>
                            </span>
                        </div>
                        <div 
                            className="h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm transition-all duration-700 ease-out mx-auto"
                            style={{ width: `${animatedDeliveredWidth}%` }}
                        >
                            {delivered.toLocaleString()}
                        </div>
                    </div>
                    
                    {/* Arrow with drop-off info */}
                    <div className="flex items-center justify-center py-1">
                        <ArrowDown className="w-5 h-5 text-muted-foreground" />
                        {delivered > read && (
                            <span className="text-xs text-muted-foreground ml-2">
                                {(delivered - read).toLocaleString()} not opened
                            </span>
                        )}
                    </div>
                    
                    {/* Read */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-foreground">Read</span>
                            <span className="flex items-center gap-2">
                                <span className="font-bold text-lg">{read.toLocaleString()}</span>
                                <span className={cn(
                                    'text-xs px-2 py-0.5 rounded-full',
                                    readRate >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                    readRate >= 40 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                )}>
                                    {readRate}%
                                </span>
                            </span>
                        </div>
                        <div 
                            className="h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm transition-all duration-700 ease-out mx-auto"
                            style={{ width: `${animatedReadWidth}%`, minWidth: '80px' }}
                        >
                            {read.toLocaleString()}
                        </div>
                    </div>
                    
                    {/* Failed section (if any) */}
                    {failed > 0 && (
                        <>
                            <div className="flex items-center justify-center py-1">
                                <ArrowDown className="w-5 h-5 text-red-400" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium text-red-600">Failed</span>
                                    <span className="flex items-center gap-2">
                                        <span className="font-bold text-lg text-red-600">{failed.toLocaleString()}</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                            {failureRate}%
                                        </span>
                                    </span>
                                </div>
                                <div 
                                    className="h-10 bg-gradient-to-r from-red-500 to-red-600 rounded-lg flex items-center justify-center text-white font-semibold shadow-sm mx-auto transition-all duration-700 ease-out"
                                    style={{ width: `${animatedFailedWidth}%`, minWidth: '60px' }}
                                >
                                    {failed.toLocaleString()}
                                </div>
                            </div>
                        </>
                    )}
                </div>
                
                {/* Explanation */}
                <div className="mt-6 p-3 bg-muted/40 rounded-lg flex items-start gap-2">
                    <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                        <strong>Why messages don't deliver:</strong> Invalid phone numbers, blocked contacts, or network issues.
                        <br />
                        <strong>Why messages aren't read:</strong> Customer hasn't opened WhatsApp or has notifications off.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

export default DeliveryFunnel;
