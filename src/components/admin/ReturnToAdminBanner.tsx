import { useState } from 'react';
import { ArrowLeft, Loader2, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
    clearImpersonationReturn,
    exitImpersonation,
    hasImpersonationReturn,
    restoreAdminSession,
} from '@/lib/impersonation';

/**
 * Shown while an admin/owner is impersonating another user (see lib/impersonation
 * — wired from the super-admin, platform-admin and tenant-admin "log in as user"
 * flows). "Return to Admin" restores the admin/owner session on BOTH the client
 * (token/id/user) and the server (POST /auth/exit-impersonation — the backend
 * resolves identity from the session before the token, so the token alone is not
 * enough), then hard-reloads back to the admin surface so all in-memory tenant
 * state (branding, workspace) resets cleanly.
 *
 * The destructive part (discarding the return bundle + reloading) is gated on the
 * server CONFIRMING the session flip. If that request fails transiently we keep
 * the bundle + banner so the user can retry, rather than reloading into an
 * identity-confused state (critical for the tenant-admin realm, whose token was
 * never swapped and so can't self-heal from a stale server session).
 */
export function ReturnToAdminBanner() {
    const { toast } = useToast();
    const [busy, setBusy] = useState(false);

    if (!hasImpersonationReturn()) return null;

    // Best-effort label for who we're currently viewing as.
    let asWho = '';
    try {
        const u = JSON.parse(localStorage.getItem('sv_user') || '{}');
        asWho = u?.email || u?.name || '';
    } catch {
        /* ignore */
    }

    const handleReturn = async () => {
        setBusy(true);
        // 1. Restore the admin/owner token + user on the client so the exit request
        //    below authenticates as the admin/owner. Does NOT discard the bundle yet.
        const returnPath = restoreAdminSession();
        // 2. Re-establish the matching SESSION server-side. Session wins over the
        //    Bearer token, so we must NOT reload until the server confirms the flip.
        const ok = await exitImpersonation();
        if (!ok) {
            toast({
                title: 'Could not return to admin',
                description: 'Please try again in a moment.',
                variant: 'destructive',
            });
            setBusy(false);
            return; // keep the bundle + banner so the user can retry
        }
        // 3. Server confirmed — discard the bundle and hard-reload as the admin.
        clearImpersonationReturn();
        window.location.href = returnPath;
    };

    return (
        <div className="sticky top-0 z-[60] flex items-center justify-between gap-3 border-b border-indigo-200 bg-indigo-50 px-4 py-2 text-indigo-950">
            <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <UserCog className="h-4 w-4 shrink-0 text-indigo-600" />
                <span className="truncate">
                    Viewing as{' '}
                    {asWho ? <strong className="font-semibold">{asWho}</strong> : 'another user'}{' '}
                    &middot; impersonation
                </span>
            </div>
            <Button
                size="sm"
                variant="outline"
                className="shrink-0 border-indigo-300 bg-white text-indigo-900 hover:bg-indigo-100"
                onClick={handleReturn}
                disabled={busy}
            >
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ArrowLeft className="mr-1 h-4 w-4" />}
                Return to Admin
            </Button>
        </div>
    );
}
