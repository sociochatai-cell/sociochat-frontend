// Trend Chart - 7-Day Line Chart
// Shows Sent/Delivered/Read trends over time

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
    const periodText = periodLabel || `the last ${periodDays} days`;
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
                <p className="font-medium text-sm mb-2">{formatDate(label)}</p>
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
    
    if (!data || data.length === 0) {
        return (
            <Card className="border-0 shadow-md">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        📈 Trend Analysis
                    </CardTitle>
                    <CardDescription>
                        Message activity over {periodText}
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
    
    // Format data with proper date labels
    const chartData = data.map(d => ({
        ...d,
        displayDate: formatDate(d.date),
    }));
    
    return (
        <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                    📈 Trend Analysis
                </CardTitle>
                <CardDescription>
                    Message activity over {periodText}
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                <ResponsiveContainer width="100%" height={280}>
                    <LineChart 
                        data={chartData}
                        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                    >
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
                        <Tooltip content={<CustomTooltip />} />
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
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            dot={{ fill: '#6366f1', strokeWidth: 0, r: 4 }}
                            activeDot={{ r: 6, fill: '#6366f1' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="delivered"
                            name="Delivered"
                            stroke="#22c55e"
                            strokeWidth={2.5}
                            dot={{ fill: '#22c55e', strokeWidth: 0, r: 4 }}
                            activeDot={{ r: 6, fill: '#22c55e' }}
                        />
                        <Line
                            type="monotone"
                            dataKey="read"
                            name="Read"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
                            activeDot={{ r: 6, fill: '#3b82f6' }}
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
