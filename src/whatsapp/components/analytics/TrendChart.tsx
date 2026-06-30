// Trend Chart - 7-Day Line Chart
// Shows Sent/Delivered/Read trends over time

import { useEffect, useMemo, useRef, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { TrendingUp, Info } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine,
} from 'recharts';

interface TrendData {
    date: string;
    sent: number;
    delivered: number;
    read: number;
}

interface TrendChartProps {
    data: TrendData[];
    loading?: boolean;
    periodDays?: number;
    periodLabel?: string;
}

export function TrendChart({ data, loading, periodDays = 7, periodLabel }: TrendChartProps) {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const gradientIdRef = useRef(`trend-grad-${Math.random().toString(36).slice(2)}`);
    const [isInView, setIsInView] = useState(false);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [hoverProgress, setHoverProgress] = useState<number | null>(null);

    useEffect(() => {
        if (!cardRef.current || isInView) return;

        const observer = new IntersectionObserver(
            (entries) => {
                const [entry] = entries;
                if (entry?.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.25 }
        );

        observer.observe(cardRef.current);
        return () => observer.disconnect();
    }, [isInView]);

    // Format date for display
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };
    
    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        
        return (
            <div className="bg-background/95 backdrop-blur-sm border rounded-lg p-3 shadow-lg">
                <p className="font-medium text-sm mb-2">{label}</p>
                <div className="space-y-1">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                            <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: entry.color }}
                            />
                            <span className="text-muted-foreground">{entry.name}:</span>
                            <span className="font-semibold">{entry.value.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const safeData = data ?? [];

    // Format data with proper date labels
    const chartData = useMemo(() => safeData.map(d => ({
        ...d,
        displayDate: formatDate(d.date),
    })), [safeData]);

    useEffect(() => {
        if (hoverIndex === null) {
            setHoverProgress(null);
            return;
        }

        let rafId = 0;
        let current = hoverProgress ?? hoverIndex;

        const animate = () => {
            current += (hoverIndex - current) * 0.22;
            if (Math.abs(hoverIndex - current) < 0.01) {
                setHoverProgress(hoverIndex);
                return;
            }
            setHoverProgress(current);
            rafId = window.requestAnimationFrame(animate);
        };

        rafId = window.requestAnimationFrame(animate);
        return () => {
            if (rafId) window.cancelAnimationFrame(rafId);
        };
    }, [hoverIndex, hoverProgress]);

    const hoverPercent = useMemo(() => {
        if (hoverProgress === null || chartData.length <= 1) return null;
        const clampedProgress = Math.max(0, Math.min(chartData.length - 1, hoverProgress));
        return (clampedProgress / (chartData.length - 1)) * 100;
    }, [hoverProgress, chartData.length]);

    const fadeStart = hoverPercent === null ? null : Math.max(0, Math.min(100, hoverPercent));
    const fadeEnd = hoverPercent === null ? null : Math.max(0, Math.min(100, hoverPercent + 12));

    const hoveredX = hoverProgress !== null && chartData.length > 0
        ? chartData[Math.max(0, Math.min(chartData.length - 1, Math.round(hoverProgress)))]?.displayDate
        : null;

    if (loading) {
        return (
            <Card className="border-0 shadow-md">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        📈 Trend Analysis
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="h-[280px] flex items-center justify-center">
                        <div className="animate-pulse text-muted-foreground">
                            Loading trends...
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (chartData.length === 0) {
        return (
            <Card className="border-0 shadow-md">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        📈 Trend Analysis
                    </CardTitle>
                    <CardDescription>
                        Message activity over the last {periodLabel || `${periodDays} days`}
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                    <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>No data available for this period</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card ref={cardRef} className="border-0 shadow-md">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                    📈 Trend Analysis
                </CardTitle>
                <CardDescription>
                    Message activity over the last {periodLabel || `${periodDays} days`}
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart 
                        data={chartData}
                        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                        onMouseMove={(state) => {
                            if (state?.isTooltipActive && typeof state.activeTooltipIndex === 'number') {
                                setHoverIndex(state.activeTooltipIndex);
                            }
                        }}
                        onMouseLeave={() => setHoverIndex(null)}
                    >
                        <defs>
                            <linearGradient id={`${gradientIdRef.current}-sent`} x1="0" y1="0" x2="1" y2="0">
                                <stop offset={`${fadeStart ?? 100}%`} stopColor="#6366f1" stopOpacity="1" />
                                <stop offset={`${fadeEnd ?? 100}%`} stopColor="#6366f1" stopOpacity="0.12" />
                                <stop offset="100%" stopColor="#6366f1" stopOpacity="0.12" />
                            </linearGradient>
                            <linearGradient id={`${gradientIdRef.current}-delivered`} x1="0" y1="0" x2="1" y2="0">
                                <stop offset={`${fadeStart ?? 100}%`} stopColor="#22c55e" stopOpacity="1" />
                                <stop offset={`${fadeEnd ?? 100}%`} stopColor="#22c55e" stopOpacity="0.12" />
                                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.12" />
                            </linearGradient>
                            <linearGradient id={`${gradientIdRef.current}-read`} x1="0" y1="0" x2="1" y2="0">
                                <stop offset={`${fadeStart ?? 100}%`} stopColor="#3b82f6" stopOpacity="1" />
                                <stop offset={`${fadeEnd ?? 100}%`} stopColor="#3b82f6" stopOpacity="0.12" />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.12" />
                            </linearGradient>
                        </defs>

                        <CartesianGrid 
                            strokeDasharray="3 3" 
                            stroke="#e5e7eb" 
                            vertical={false}
                        />
                        <XAxis 
                            dataKey="displayDate" 
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                            tickLine={false}
                            axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis 
                            tick={{ fill: '#6b7280', fontSize: 11 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => value.toLocaleString()}
                        />
                        <Tooltip
                            content={<CustomTooltip />}
                            cursor={{ stroke: '#94a3b8', strokeDasharray: '4 4', strokeWidth: 1.5 }}
                        />
                        {hoveredX && (
                            <ReferenceLine x={hoveredX} stroke="#94a3b8" strokeDasharray="4 4" />
                        )}
                        <Legend 
                            verticalAlign="top"
                            height={36}
                            formatter={(value) => (
                                <span className="text-sm text-muted-foreground">{value}</span>
                            )}
                        />
                        <Line
                            type="monotone"
                            dataKey="sent"
                            name="Sent"
                            stroke={hoverPercent === null ? '#6366f1' : `url(#${gradientIdRef.current}-sent)`}
                            strokeWidth={2.5}
                            dot={{ fill: '#6366f1', strokeWidth: 0, r: 4 }}
                            activeDot={{ r: 6, fill: '#6366f1' }}
                            isAnimationActive={isInView}
                            animationDuration={900}
                            connectNulls
                        />
                        <Line
                            type="monotone"
                            dataKey="delivered"
                            name="Delivered"
                            stroke={hoverPercent === null ? '#22c55e' : `url(#${gradientIdRef.current}-delivered)`}
                            strokeWidth={2.5}
                            dot={{ fill: '#22c55e', strokeWidth: 0, r: 4 }}
                            activeDot={{ r: 6, fill: '#22c55e' }}
                            isAnimationActive={isInView}
                            animationDuration={900}
                            connectNulls
                        />
                        <Line
                            type="monotone"
                            dataKey="read"
                            name="Read"
                            stroke={hoverPercent === null ? '#3b82f6' : `url(#${gradientIdRef.current}-read)`}
                            strokeWidth={2.5}
                            dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
                            activeDot={{ r: 6, fill: '#3b82f6' }}
                            isAnimationActive={isInView}
                            animationDuration={900}
                            connectNulls
                        />
                    </LineChart>
                </ResponsiveContainer>
                
                {/* Insight note */}
                <div className="mt-4 p-3 bg-muted/40 rounded-lg flex items-start gap-2">
                    <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                        <strong>Reading the chart:</strong> Spikes usually indicate campaigns or broadcasts. 
                        A widening gap between Sent and Delivered may indicate delivery issues.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

export default TrendChart;
