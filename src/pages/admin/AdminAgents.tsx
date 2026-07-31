/**
 * Admin — Agent Management (platform super-admin portal).
 * =======================================================
 * A super-admin picks an ACCOUNT (owner user) and manages that account's
 * agent sub-logins. Selecting an account renders the shared <AgentsManager />
 * bound to an admin-authenticated adapter scoped to that account.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ArrowLeft, Building2, Users as UsersIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import AgentsManager from '@/agent_login/components/AgentsManager';
import { listAccounts, makeSuperAdminAgentApi, type AccountRow } from '@/agent_login/lib/agentAdminApi';

export default function AdminAgents() {
    const { toast } = useToast();
    const [accounts, setAccounts] = useState<AccountRow[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<AccountRow | null>(null);

    // Stable adapter identity per account — recreating it every render would
    // retrigger the manager's data effect.
    const agentApi = useMemo(
        () => (selected ? makeSuperAdminAgentApi(selected.id) : null),
        [selected],
    );

    const load = useCallback(async (q?: string) => {
        setLoading(true);
        try {
            const data = await listAccounts(q);
            if (data.success) {
                setAccounts(data.accounts || []);
            } else {
                toast({ title: 'Error', description: data.message || 'Failed to load accounts', variant: 'destructive' });
            }
        } catch {
            toast({ title: 'Error', description: 'Failed to load accounts', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    // Debounced search — also covers the initial load (search starts empty).
    useEffect(() => {
        const t = setTimeout(() => { load(search.trim() || undefined); }, 300);
        return () => clearTimeout(t);
    }, [search, load]);

    // Managing a chosen account's agents.
    if (selected && agentApi) {
        return (
            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">Agent Management</h1>
                        <p className="text-muted-foreground text-sm">
                            Managing agents for <span className="font-medium">{selected.name}</span>{' '}
                            ({selected.email}) — Account ID{' '}
                            <code className="bg-muted px-1.5 py-0.5 rounded">{selected.id}</code>
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => setSelected(null)}>
                        <ArrowLeft className="h-4 w-4 mr-1" /> Change account
                    </Button>
                </div>
                <AgentsManager api={agentApi} />
            </div>
        );
    }

    // Account picker.
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Agent Management</h1>
                <p className="text-muted-foreground text-sm">Pick an account to manage its agent sub-logins</p>
            </div>
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                    className="pl-10"
                    placeholder="Search accounts by name or email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            <Card>
                <CardHeader><CardTitle>Accounts ({accounts.length})</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    {loading ? (
                        <p className="text-sm text-muted-foreground">Loading...</p>
                    ) : accounts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No accounts found.</p>
                    ) : accounts.map(a => (
                        <button
                            key={a.id}
                            onClick={() => setSelected(a)}
                            className="w-full text-left flex flex-wrap items-center gap-3 p-3 border rounded-lg bg-white hover:bg-slate-50 transition-colors"
                        >
                            <div className="flex-1 min-w-[200px]">
                                <p className="font-medium">{a.name}</p>
                                <p className="text-sm text-muted-foreground">{a.email}</p>
                            </div>
                            <Badge variant="outline" className="gap-1">
                                <Building2 className="h-3 w-3" /> {a.workspace_count} workspaces
                            </Badge>
                            <Badge variant="outline" className="gap-1">
                                <UsersIcon className="h-3 w-3" /> {a.agent_count} agents
                            </Badge>
                        </button>
                    ))}
                </CardContent>
            </Card>
        </div>
    );
}
