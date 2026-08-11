/**
 * WaEntryPage — Sociovia → SocioChat SSO landing page.
 *
 * Flow:
 *  1. Sociovia redirects the browser to /wa-entry?token=...&workspace_id=...&next=...
 *  2. This page calls GET /api/auth/wa-entry with those params.
 *  3. On success: stores the JWT, marks sociovia_source in localStorage, navigates to `next`.
 *  4. On failure: redirects to /signup?error=link_expired.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '@/config';

export default function WaEntryPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState<'loading' | 'error'>('loading');

    useEffect(() => {
        const token = searchParams.get('token') || '';
        const workspaceId = searchParams.get('workspace_id') || '';
        const next = searchParams.get('next') || '/dashboard/inbox';

        if (!token) {
            navigate('/signup?error=link_expired', { replace: true });
            return;
        }

        const params = new URLSearchParams({ token, workspace_id: workspaceId, next });

        fetch(`${API_BASE_URL}/api/auth/wa-entry?${params.toString()}`, {
            method: 'GET',
            credentials: 'include',
        })
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.error || 'link_expired');
                }

                // Store JWT — same keys used across SocioChat.
                if (data.token) {
                    localStorage.setItem('sc_token', data.token);
                    sessionStorage.setItem('sc_token', data.token);
                }

                // Store user info the same way the login flow does.
                if (data.user) {
                    localStorage.setItem('sv_user', JSON.stringify(data.user));
                }

                // Mark this session as originating from Sociovia so the sidebar
                // can show the "← Sociovia Dashboard" return button.
                localStorage.setItem('sociovia_source', 'true');

                // Navigate to the intended destination (e.g. /dashboard/inbox).
                // StripWhatsAppPrefix in the router handles /dashboard/whatsapp/* → /dashboard/*.
                navigate(data.next || '/dashboard/inbox', { replace: true });
            })
            .catch(() => {
                setStatus('error');
                navigate('/signup?error=link_expired', { replace: true });
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (status === 'error') {
        return null; // navigation is already in flight
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-white">
            <div className="flex flex-col items-center gap-4">
                <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full border-4 border-emerald-200 animate-pulse" />
                    <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 animate-spin" />
                </div>
                <p className="text-sm text-slate-500 font-medium">Signing you in…</p>
            </div>
        </div>
    );
}
