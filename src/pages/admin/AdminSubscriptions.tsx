import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { adminApi } from '@/lib/adminApi';

export default function AdminSubscriptions() {
    const [stats, setStats] = useState<Record<string, unknown> | null>(null);

    useEffect(() => {
        adminApi.getSubscriptionStats().then(res => {
            if (res.success) setStats(res.stats);
        });
    }, []);

    const byPlan = (stats?.users_by_plan || {}) as Record<string, number>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Subscription Overview</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'Total Users', value: stats?.total_users ?? 0 },
                    { label: 'Workspaces', value: stats?.total_workspaces ?? 0 },
                    { label: 'Messages Today', value: stats?.messages_today ?? 0 },
                    { label: 'Image Credits (month)', value: stats?.image_credits_this_month ?? 0 },
                ].map(s => (
                    <Card key={s.label}>
                        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{s.label}</CardTitle></CardHeader>
                        <CardContent><p className="text-2xl font-bold">{String(s.value)}</p></CardContent>
                    </Card>
                ))}
            </div>
            <Card>
                <CardHeader><CardTitle>Users by Plan</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(byPlan).map(([plan, count]) => (
                        <div key={plan} className="p-3 border rounded-lg text-center">
                            <p className="text-sm text-muted-foreground capitalize">{plan}</p>
                            <p className="text-xl font-bold">{count}</p>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
