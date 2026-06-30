// src/whatsapp/components/WhatsAppConnectionGuard.tsx
// Wrap any WhatsApp page's content in this guard. If the current workspace has
// NO WhatsApp account connected, it renders the shared <NotConnectedPrompt/>
// instead of the page (so every WhatsApp page shows a consistent "Connect your
// WhatsApp number" screen). While the account list is first loading it shows a
// spinner. Resolves the workspace id automatically from storage, with an
// optional explicit override.
import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useWhatsAppAccounts } from '@/whatsapp/hooks/useWhatsAppData';
import NotConnectedPrompt from './NotConnectedPrompt';

/** Resolve the active workspace id the WhatsApp pages use (localStorage key). */
function resolveWorkspaceId(explicit?: string | number | null): string {
    if (explicit !== undefined && explicit !== null && String(explicit) !== '') {
        return String(explicit);
    }
    try {
        return (
            localStorage.getItem('sv_whatsapp_workspace_id') ||
            sessionStorage.getItem('sv_whatsapp_workspace_id') ||
            ''
        );
    } catch {
        return '';
    }
}

export interface WhatsAppConnectionGuardProps {
    /** Feature name for the connect-prompt copy, e.g. "Forms", "Templates". */
    feature?: string;
    /** Optional explicit workspace id; falls back to stored value. */
    workspaceId?: string | number | null;
    children: ReactNode;
}

export function WhatsAppConnectionGuard({ feature, workspaceId, children }: WhatsAppConnectionGuardProps) {
    const wsId = resolveWorkspaceId(workspaceId);
    const { data: accounts, isLoading } = useWhatsAppAccounts(wsId);

    // No workspace at all → nothing can be connected.
    if (!wsId) return <NotConnectedPrompt feature={feature} />;

    // First load (no cached data yet) → spinner, so we don't flash the prompt.
    if (isLoading && accounts == null) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
            </div>
        );
    }

    if (!accounts || accounts.length === 0) {
        return <NotConnectedPrompt feature={feature} />;
    }

    return <>{children}</>;
}

export default WhatsAppConnectionGuard;
