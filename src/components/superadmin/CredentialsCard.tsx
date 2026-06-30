// src/components/superadmin/CredentialsCard.tsx
// Displays generated tenant credentials (admin + demo) with copy-to-clipboard.
// These are shown only once after creation, so we surface a strong warning.
import { useState } from 'react';
import { Copy, Check, KeyRound, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CreateTenantCredentials, GeneratedCredential } from './useSuperAdminApi';

function CopyRow({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* clipboard not available */
        }
    };
    return (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2">
            <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
                <p className="truncate font-mono text-sm text-slate-800">{value}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={copy} className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
        </div>
    );
}

function CredentialBlock({ title, cred }: { title: string; cred: GeneratedCredential }) {
    return (
        <div className="space-y-2 rounded-lg border bg-slate-50 p-4">
            <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-emerald-600" />
                <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
                <CopyRow label="Tenant code" value={cred.tenant_code} />
                <CopyRow label="Email" value={cred.email} />
                <CopyRow label="Password" value={cred.password} />
            </div>
        </div>
    );
}

export function CredentialsCard({
    credentials,
    className,
}: {
    credentials: CreateTenantCredentials;
    className?: string;
}) {
    return (
        <div className={cn('space-y-4', className)}>
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p className="text-sm">
                    These credentials are shown <strong>only once</strong>. Copy and store them securely now —
                    they cannot be retrieved later.
                </p>
            </div>
            {credentials.admin && <CredentialBlock title="Admin account" cred={credentials.admin} />}
            {credentials.demo && <CredentialBlock title="Demo account" cred={credentials.demo} />}
        </div>
    );
}

export default CredentialsCard;
