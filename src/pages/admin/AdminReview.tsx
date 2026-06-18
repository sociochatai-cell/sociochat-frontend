import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { adminApi } from '@/lib/adminApi';

export default function AdminReview() {
    const [users, setUsers] = useState<{ id: number; name: string; email: string }[]>([]);
    const { toast } = useToast();

    const load = async () => {
        const res = await adminApi.getReviewUsers();
        if (res.success) setUsers(res.users || []);
    };

    useEffect(() => { load(); }, []);

    const approve = async (id: number) => {
        const res = await adminApi.approveUser(id);
        if (res.success) {
            toast({ title: 'Approved' });
            load();
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">Pending Review</h1>
            <Card>
                <CardHeader><CardTitle>{users.length} users awaiting approval</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    {users.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No pending users</p>
                    ) : users.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                                <p className="font-medium">{u.name}</p>
                                <p className="text-sm text-muted-foreground">{u.email}</p>
                            </div>
                            <Button onClick={() => approve(u.id)}>Approve</Button>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
