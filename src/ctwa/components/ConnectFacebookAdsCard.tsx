// Connect Facebook Ads — Settings card (redirect-based)
// =====================================================
// Links the FACEBOOK ADS side (Ad Account + Page) needed for WhatsApp Status ads
// and Click-to-WhatsApp ads. Uses a full-page REDIRECT to Facebook (not a JS
// popup) so browser popup-blockers can't stop it. Facebook returns to
// /api/ctwa/oauth/callback, which stores the connection and bounces back here
// with ?ads_connected=N or ?ads_error=...

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Megaphone, CheckCircle2, RefreshCw } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { getWorkspaceId } from '@/whatsapp/utils/workspaceContext';
import { getAdsConnectionStatus, type AdsConnectionStatus } from '@/ctwa';
import { API_BASE_URL } from '@/config';

export function ConnectFacebookAdsCard() {
    const workspaceId = getWorkspaceId() || '';
    const [checking, setChecking] = useState(true);
    const [status, setStatus] = useState<AdsConnectionStatus | null>(null);

    const refreshStatus = useCallback(async () => {
        if (!workspaceId) { setChecking(false); return; }
        setChecking(true);
        try {
            setStatus(await getAdsConnectionStatus(workspaceId));
        } catch {
            setStatus({ connected: false });
        } finally {
            setChecking(false);
        }
    }, [workspaceId]);

    useEffect(() => { refreshStatus(); }, [refreshStatus]);

    // Handle the return trip from Facebook (?ads_connected=N / ?ads_error=...).
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const connected = params.get('ads_connected');
        const err = params.get('ads_error');
        if (connected !== null) {
            toast({
                title: '✓ Facebook Ads connected',
                description: `${connected} ad account(s) linked. You can now build ads.`,
            });
        } else if (err) {
            toast({
                title: 'Facebook Ads connection failed',
                description: decodeURIComponent(err),
                variant: 'destructive',
            });
        }
        if (connected !== null || err) {
            // Strip the query params so a refresh doesn't re-toast.
            const clean = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', clean);
        }
    }, []);

    const handleConnect = useCallback(() => {
        if (!workspaceId) {
            toast({ title: 'No workspace', description: 'Select a workspace first.', variant: 'destructive' });
            return;
        }
        // Full-page navigation to the backend, which redirects to Facebook. We pass
        // our own origin so the callback + return URL come back to THIS app (not the
        // backend). Uses the absolute API base so it works after deployment too.
        const origin = encodeURIComponent(window.location.origin);
        window.location.href =
            `${API_BASE_URL}/api/ctwa/oauth/connect?workspace_id=${encodeURIComponent(workspaceId)}&origin=${origin}`;
    }, [workspaceId]);

    const connected = !!status?.connected;

    return (
        <Card className="border shadow-sm bg-white">
            <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-fuchsia-100 flex items-center justify-center">
                        <Megaphone className="w-5 h-5 text-fuchsia-600" />
                    </div>
                    <div className="flex-1">
                        <CardTitle className="text-base flex items-center gap-2">
                            Facebook Ads Connection
                            {connected && (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
                                </Badge>
                            )}
                        </CardTitle>
                        <CardDescription className="text-sm">
                            Link your Ad Account &amp; Page to run WhatsApp Status Ads and Click-to-WhatsApp Ads.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    WhatsApp Status ads are bought through Meta's ad system, which needs a Facebook{' '}
                    <b>Ad Account</b> (to pay) and a <b>Page</b> (the advertiser identity) — separate from your
                    WhatsApp connection.
                </p>

                {checking ? (
                    <div className="flex items-center text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking connection…
                    </div>
                ) : connected ? (
                    <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                        <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">Account</span>
                            <span className="font-medium">{status?.account_name || '—'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                            <span className="text-muted-foreground">Ad Account</span>
                            <span className="font-mono text-xs">{status?.ad_account_id || 'not selected'}</span>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        Not connected yet. Connect to enable the ad wizards.
                    </div>
                )}

                <div className="flex gap-2">
                    <Button
                        onClick={handleConnect}
                        disabled={!workspaceId}
                        className="bg-[#1877F2] hover:bg-[#166FE5] text-white"
                    >
                        <Megaphone className="w-4 h-4 mr-2" />
                        {connected ? 'Reconnect Ads' : 'Connect Facebook Ads'}
                    </Button>
                    {connected && (
                        <Button variant="outline" onClick={refreshStatus} disabled={checking}>
                            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

export default ConnectFacebookAdsCard;
