// Category Performance - Side-by-side category cards
// Shows UTILITY, MARKETING, AUTHENTICATION with costs

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Megaphone, Shield, IndianRupee } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CategoryData {
    category: string;
    total_sent: number;
    delivered: number;
    read: number;
    failed: number;
    delivery_rate: number;
    read_rate: number;
    failure_rate: number;
}

interface CategoryPerformanceProps {
    categories: Record<string, CategoryData> | null;
}

// Estimated costs per category in INR (WhatsApp Business API India pricing)
const CATEGORY_COSTS = {
    utility: 0.15,        // Order updates, alerts - ₹0.15
    marketing: 0.78,      // Promotions, offers - ₹0.78
    authentication: 0.15, // OTP, login codes - ₹0.15
};

const CATEGORY_INFO = {
    utility: {
        icon: FileText,
        label: 'UTILITY',
        description: 'Order updates, alerts',
        color: 'blue',
        bgColor: 'bg-blue-50 dark:bg-blue-950/20',
        textColor: 'text-blue-600 dark:text-blue-400',
        borderColor: 'border-blue-200 dark:border-blue-800',
    },
    marketing: {
        icon: Megaphone,
        label: 'MARKETING',
        description: 'Offers, promotions',
        color: 'green',
        bgColor: 'bg-green-50 dark:bg-green-950/20',
        textColor: 'text-green-600 dark:text-green-400',
        borderColor: 'border-green-200 dark:border-green-800',
    },
    authentication: {
        icon: Shield,
        label: 'AUTHENTICATION',
        description: 'OTP, login',
        color: 'purple',
        bgColor: 'bg-purple-50 dark:bg-purple-950/20',
        textColor: 'text-purple-600 dark:text-purple-400',
        borderColor: 'border-purple-200 dark:border-purple-800',
    },
};

const CategoryCard = ({
    categoryKey,
    data
}: {
    categoryKey: 'utility' | 'marketing' | 'authentication';
    data: CategoryData | undefined;
}) => {
    const info = CATEGORY_INFO[categoryKey];
    const Icon = info.icon;
    const cost = (data?.total_sent || 0) * CATEGORY_COSTS[categoryKey];

    const sent = data?.total_sent || 0;
    const deliveryRate = data?.delivery_rate || 0;
    const readRate = data?.read_rate || 0;

    return (
        <Card className={cn(
            'border-2 transition-all duration-300 hover:shadow-lg',
            info.borderColor,
            info.bgColor
        )}>
            <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className={cn('p-2 rounded-lg', info.bgColor)}>
                            <Icon className={cn('w-5 h-5', info.textColor)} />
                        </div>
                        <div>
                            <Badge variant="outline" className={cn('font-semibold', info.textColor)}>
                                {info.label}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {info.description}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="text-center p-2 bg-background/50 rounded-lg">
                        <p className="text-xl font-bold">{sent.toLocaleString('en-IN')}</p>
                        <p className="text-xs text-muted-foreground">Sent</p>
                    </div>
                    <div className="text-center p-2 bg-background/50 rounded-lg">
                        <p className={cn(
                            'text-xl font-bold',
                            deliveryRate >= 95 ? 'text-green-600' :
                                deliveryRate >= 80 ? 'text-yellow-600' : 'text-red-600'
                        )}>
                            {deliveryRate}%
                        </p>
                        <p className="text-xs text-muted-foreground">Delivery</p>
                    </div>
                    <div className="text-center p-2 bg-background/50 rounded-lg">
                        <p className={cn(
                            'text-xl font-bold',
                            readRate >= 70 ? 'text-green-600' :
                                readRate >= 40 ? 'text-yellow-600' : 'text-red-600'
                        )}>
                            {readRate}%
                        </p>
                        <p className="text-xs text-muted-foreground">Read</p>
                    </div>
                    {/* Removed Est. Cost display */}
                </div>

                {/* Progress bars */}
                <div className="space-y-2">
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Delivery Rate</span>
                            <span className="font-medium">{deliveryRate}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(deliveryRate, 100)}%` }}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Read Rate</span>
                            <span className="font-medium">{readRate}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(readRate, 100)}%` }}
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export function CategoryPerformance({ categories }: CategoryPerformanceProps) {
    // Calculate total cost
    const totalCost = categories ?
        Object.entries(categories).reduce((sum, [key, data]) => {
            const costRate = CATEGORY_COSTS[key as keyof typeof CATEGORY_COSTS] || 0;
            return sum + (data.total_sent * costRate);
        }, 0) : 0;

    return (
        <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            💰 Category Performance
                        </CardTitle>
                        <CardDescription>
                            Message breakdown by category
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <CategoryCard
                        categoryKey="utility"
                        data={categories?.utility}
                    />
                    <CategoryCard
                        categoryKey="marketing"
                        data={categories?.marketing}
                    />
                    <CategoryCard
                        categoryKey="authentication"
                        data={categories?.authentication}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

export default CategoryPerformance;
