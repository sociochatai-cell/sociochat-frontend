import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { API_BASE_URL } from '@/config';
import { usePlan } from '@/contexts/PlanContext';

type View = 'checking' | 'success' | 'failed';

/**
 * Landing page PayU redirects back to (via the backend /payu/return handler).
 * The backend has already verified the payment; here we poll the transaction
 * status to confirm and reflect the final state to the user.
 */
export default function PaymentResult() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { refreshPlan } = usePlan();
    const [view, setView] = useState<View>('checking');
    const refreshed = useRef(false);

    const txnid = params.get('txnid') || '';
    const hintedStatus = params.get('status') || '';

    // Where to send the user after showing the result — the page they started
    // from (signup -> /dashboard, tenant-admin -> tenant-admin, etc.).
    const returnTo = (() => {
        const v = localStorage.getItem('sv_payment_return_to');
        return v && v.startsWith('/') ? v : '/dashboard';
    })();

    const goBack = () => {
        localStorage.removeItem('sv_payment_return_to');
        navigate(returnTo);
    };

    useEffect(() => {
        let cancelled = false;
        let attempts = 0;

        const authHeaders = (): Record<string, string> => {
            const h: Record<string, string> = {};
            const userId = localStorage.getItem('sv_user_id');
            if (userId) h['X-User-Id'] = userId;
            const token = sessionStorage.getItem('sv_token') || localStorage.getItem('sv_token');
            if (token) h['Authorization'] = `Bearer ${token}`;
            return h;
        };

        const poll = async () => {
            if (cancelled) return;
            attempts += 1;
            try {
                const res = await fetch(`${API_BASE_URL}/api/payments/status/${encodeURIComponent(txnid)}`, {
                    credentials: 'include',
                    headers: authHeaders(),
                });
                const data = await res.json().catch(() => ({}));
                const status = data?.transaction?.status;
                if (status === 'success') {
                    if (!refreshed.current) {
                        refreshed.current = true;
                        await refreshPlan().catch(() => { });
                    }
                    if (!cancelled) {
                        setView('success');
                        // Return the user to where they started the payment.
                        setTimeout(() => {
                            if (!cancelled) {
                                localStorage.removeItem('sv_payment_return_to');
                                navigate(returnTo);
                            }
                        }, 2000);
                    }
                    return;
                }
                if (status === 'failed') {
                    if (!cancelled) {
                        setView('failed');
                        // Send them back to the originating page after a moment.
                        setTimeout(() => {
                            if (!cancelled) {
                                localStorage.removeItem('sv_payment_return_to');
                                navigate(returnTo);
                            }
                        }, 4000);
                    }
                    return;
                }
            } catch {
                /* keep polling */
            }
            // Still initiated / unknown — retry a few times (webhook may be in flight).
            if (attempts < 6 && !cancelled) {
                setTimeout(poll, 1500);
            } else if (!cancelled) {
                setView(hintedStatus === 'success' ? 'success' : 'failed');
            }
        };

        if (!txnid) {
            setView(hintedStatus === 'success' ? 'success' : 'failed');
            return;
        }
        poll();
        return () => { cancelled = true; };
    }, [txnid, hintedStatus, refreshPlan, navigate, returnTo]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <Card className="w-full max-w-md">
                <CardContent className="py-10 text-center space-y-5">
                    {view === 'checking' && (
                        <>
                            <Loader2 className="h-12 w-12 mx-auto animate-spin text-emerald-600" />
                            <h1 className="text-xl font-semibold">Confirming your payment…</h1>
                            <p className="text-sm text-muted-foreground">
                                This only takes a moment. Please don’t close this window.
                            </p>
                        </>
                    )}
                    {view === 'success' && (
                        <>
                            <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-600" />
                            <h1 className="text-2xl font-bold">Payment successful</h1>
                            <p className="text-sm text-muted-foreground">
                                Your subscription is now active. Taking you back…
                            </p>
                            <Button className="w-full" onClick={goBack}>
                                Continue
                            </Button>
                        </>
                    )}
                    {view === 'failed' && (
                        <>
                            <XCircle className="h-14 w-14 mx-auto text-red-500" />
                            <h1 className="text-2xl font-bold">Payment not completed</h1>
                            <p className="text-sm text-muted-foreground">
                                We couldn’t confirm your payment. No plan change was made. If money
                                was debited, it will be refunded automatically. Taking you back…
                            </p>
                            <Button className="w-full" onClick={goBack}>
                                Go back
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
