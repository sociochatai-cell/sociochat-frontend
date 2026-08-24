// Connect WhatsApp Button Component
// ==================================
// Button to initiate WhatsApp Business Account connection via Facebook Embedded Signup

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, MessageCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { WHATSAPP_REST_API_PREFIX } from "@/config";
import { ownerAuthHeaders } from '@/lib/authToken';
import { requestWhatsAppAccountStatusPopup } from '@/whatsapp/utils/accountStatusPopup';
import { invalidateWhatsAppAccountsCache } from '@/whatsapp/hooks/useWhatsAppData';
import { useAuth } from '@/contexts/AuthContext';
import {
    type ConnectExchangeResponse,
    type EmbeddedSignupAssets,
    createOnboardingSession,
    extractEmbeddedSignupCode,
    formatConnectExchangeError,
    formatPaymentReminder,
    hasEmbeddedSignupAssets,
    mergeEmbeddedSignupAssets,
    parseEmbeddedSignupMessage,
    postEmbeddedSignupEvent,
    waitForEmbeddedSignupAssets,
} from '@/whatsapp/utils/embeddedSignupSession';

const FB_APP_ID = import.meta.env.VITE_FB_APP_ID || '1782321995750055';
const WHATSAPP_CONFIG_ID = import.meta.env.VITE_WHATSAPP_CONFIG_ID || '1210552324305744';
const FB_GRAPH_VERSION = import.meta.env.VITE_FB_API_VERSION || import.meta.env.VITE_WHATSAPP_API_VERSION || 'v25.0';

interface ConnectWhatsAppButtonProps {
    workspaceId: string;
    onConnected?: () => void;
    // When true, the button is rendered in the coexistence onboarding flow
    // (connecting an existing WhatsApp number that's also used on the mobile app).
    coexistenceMode?: boolean;
}

declare global {
    interface Window {
        FB: {
            init: (params: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
            login: (callback: (response: FBLoginResponse) => void, options: { config_id: string; response_type: string; override_default_response_type: boolean; extras: { setup: object; featureType?: string; sessionInfoVersion?: string } }) => void;
        };
        fbAsyncInit: () => void;
    }
}

interface FBLoginResponse {
    authResponse?: {
        code?: string;
        accessToken?: string;
    };
    status: string;
}

async function exchangeEmbeddedSignupCode(
    workspaceId: string,
    code: string,
    assets: EmbeddedSignupAssets,
    session?: { sessionId?: string; resumeToken?: string },
): Promise<ConnectExchangeResponse> {
    const body: Record<string, string> = {
        code,
        workspace_id: workspaceId,
    };
    if (assets.business_id) body.business_id = assets.business_id;
    if (assets.waba_id) body.waba_id = assets.waba_id;
    if (assets.phone_number_id) body.phone_number_id = assets.phone_number_id;
    if (assets.event) body.embedded_signup_event = assets.event;
    if (session?.sessionId) body.onboarding_session_id = session.sessionId;
    if (session?.resumeToken) body.resume_token = session.resumeToken;

    const res = await fetch(`${WHATSAPP_REST_API_PREFIX}/connect/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...ownerAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    const data = (await res.json()) as ConnectExchangeResponse;
    if (!res.ok && !data.error) {
        data.success = false;
        data.error = `Connection failed (HTTP ${res.status})`;
    }
    return data;
}

interface WabaCandidate {
    waba_id?: string;
    waba_name?: string;
    phone_number_id?: string;
    display_phone_number?: string;
    verified_name?: string;
    business_id?: string;
    business_name?: string;
}

export function ConnectWhatsAppButton({ workspaceId, onConnected }: ConnectWhatsAppButtonProps) {
    const [loading, setLoading] = useState(false);
    const [fbReady, setFbReady] = useState(false);
    const sessionAssetsRef = useRef<EmbeddedSignupAssets>({});
    const onboardingSessionRef = useRef<{ sessionId?: string; resumeToken?: string }>({});
    const { user } = useAuth();

    // When the Meta account has MORE THAN ONE WhatsApp Business Account, the backend
    // returns requires_user_choice + candidates (it won't guess). We show a picker and
    // finish via a "resume" exchange that reuses the stashed token (no re-login).
    const [wabaChoice, setWabaChoice] = useState<{
        candidates: WabaCandidate[];
        sessionId?: string;
        resumeToken?: string;
    } | null>(null);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const parsed = parseEmbeddedSignupMessage(event);
            if (!parsed) return;
            sessionAssetsRef.current = mergeEmbeddedSignupAssets(sessionAssetsRef.current, parsed);
            console.log('[whatsapp] Embedded Signup session assets:', sessionAssetsRef.current);
            const sid = onboardingSessionRef.current.sessionId;
            if (sid && parsed.event) {
                void postEmbeddedSignupEvent(sid, parsed.event, {
                    business_id: parsed.business_id,
                    waba_id: parsed.waba_id,
                    phone_number_id: parsed.phone_number_id,
                });
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    useEffect(() => {
        if (window.FB) {
            setFbReady(true);
            return;
        }

        window.fbAsyncInit = function() {
            if (!FB_APP_ID) {
                console.error('[whatsapp] VITE_FB_APP_ID is not set; Embedded Signup cannot initialize.');
                return;
            }
            window.FB.init({
                appId: FB_APP_ID,
                cookie: true,
                xfbml: true,
                version: FB_GRAPH_VERSION
            });
            setFbReady(true);
            console.log('[whatsapp] Facebook SDK initialized');
        };

        const script = document.createElement('script');
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        script.async = true;
        script.defer = true;
        script.crossOrigin = 'anonymous';
        document.body.appendChild(script);
    }, []);

    const handleConnect = useCallback(() => {
        if (!workspaceId) {
            toast({
                title: 'Error',
                description: 'No workspace selected',
                variant: 'destructive',
            });
            return;
        }

        if (!fbReady || !window.FB) {
            toast({
                title: 'Loading...',
                description: 'Facebook SDK is still loading. Please try again.',
                variant: 'destructive',
            });
            return;
        }

        if (!FB_APP_ID || !WHATSAPP_CONFIG_ID) {
            toast({
                title: 'Configuration error',
                description: 'Set VITE_FB_APP_ID and VITE_WHATSAPP_CONFIG_ID (Facebook Login for Business configuration ID).',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        sessionAssetsRef.current = {};
        onboardingSessionRef.current = {};

        // FB.login() MUST be called SYNCHRONOUSLY inside this click handler.
        // Awaiting anything first (e.g. createOnboardingSession, which does a network
        // POST) consumes the browser's transient user-activation, so Meta's popup is
        // blocked and FB.login returns { authResponse: null, status: 'unknown' }
        // instantly ("not waiting"). So we kick the onboarding-session creation off
        // WITHOUT awaiting here and resolve it inside the callback before exchange.
        const sessionPromise: Promise<{ sessionId?: string; resumeToken?: string }> =
            user?.id
                ? createOnboardingSession(workspaceId, user.id, { configId: WHATSAPP_CONFIG_ID })
                : Promise.resolve<{ sessionId?: string; resumeToken?: string }>({});
        void sessionPromise.then((s) => { onboardingSessionRef.current = s; }).catch(() => { /* best effort */ });

        console.log('[whatsapp] Starting Embedded Signup flow (sessionInfoVersion 4)');

        window.FB.login(
            function(response: FBLoginResponse) {
                void (async () => {
                console.log('[whatsapp] FB.login response:', response);

                const authCode = extractEmbeddedSignupCode(response.authResponse);
                if (authCode) {
                    // The onboarding session was started (not awaited) at click time so
                    // the popup could open under the user gesture; make sure it has
                    // resolved before exchange since it carries the resume token.
                    try { onboardingSessionRef.current = await sessionPromise; } catch { /* best effort */ }
                    // Wait briefly for the Embedded Signup `message` event (WABA/phone
                    // assets). Do NOT hard-require it: that postMessage is unreliable
                    // across domains/browsers, and blocking on it means a completed
                    // signup never gets saved. If assets are missing we still call
                    // exchange — the backend auto-discovers the WABA/phone from the
                    // token (resolve_binding_for_auto_connect) and returns
                    // PROVISIONING_INCOMPLETE / ambiguity only when it genuinely can't.
                    const assets = await waitForEmbeddedSignupAssets(() => sessionAssetsRef.current, 8000);
                    if (!hasEmbeddedSignupAssets(assets)) {
                        console.warn(
                            '[whatsapp] No Embedded Signup assets from message event; ' +
                            'proceeding to exchange with backend auto-discovery.',
                        );
                    }
                    exchangeEmbeddedSignupCode(
                        workspaceId,
                        authCode,
                        assets,
                        onboardingSessionRef.current,
                    )
                    .then(data => {
                        if (data.success) {
                            invalidateWhatsAppAccountsCache(workspaceId);
                            const paymentHint = formatPaymentReminder(data.next_steps);
                            toast({
                                title: 'WhatsApp connected',
                                description: paymentHint
                                    ? `${data.account?.display_phone_number || data.account?.verified_name || 'Account linked'}. ${paymentHint}`
                                    : `Connected: ${data.account?.display_phone_number || data.account?.verified_name || 'Account linked'}`,
                            });
                            requestWhatsAppAccountStatusPopup(workspaceId);
                            onConnected?.();
                            return;
                        }

                        if (data.error_code === 'PROVISIONING_INCOMPLETE' && data.account?.id) {
                            invalidateWhatsAppAccountsCache(workspaceId);
                            toast({
                                title: 'Setup incomplete',
                                description: formatConnectExchangeError(data),
                                variant: 'destructive',
                            });
                            requestWhatsAppAccountStatusPopup(workspaceId);
                            onConnected?.();
                            return;
                        }

                        // Multiple WhatsApp Business Accounts on this Meta account →
                        // the backend can't auto-pick. Show a picker; the choice is
                        // finished via a resume exchange (reuses the stashed token).
                        const choiceData = data as unknown as {
                            requires_user_choice?: boolean;
                            candidates?: WabaCandidate[];
                            onboarding_session_id?: string;
                        };
                        if (
                            choiceData.requires_user_choice &&
                            Array.isArray(choiceData.candidates) &&
                            choiceData.candidates.length > 1
                        ) {
                            setWabaChoice({
                                candidates: choiceData.candidates,
                                sessionId:
                                    choiceData.onboarding_session_id ||
                                    onboardingSessionRef.current.sessionId,
                                resumeToken: onboardingSessionRef.current.resumeToken,
                            });
                            return;
                        }

                        throw new Error(formatConnectExchangeError(data));
                    })
                    .catch((err: unknown) => {
                        console.error('[whatsapp] Token exchange error:', err);
                        toast({
                            title: 'Connection Failed',
                            description: err instanceof Error ? err.message : 'Failed to exchange token',
                            variant: 'destructive',
                        });
                    })
                    .finally(() => {
                        setLoading(false);
                    });
                } else {
                    console.log('[whatsapp] User cancelled or no auth code');
                    toast({
                        title: 'Cancelled',
                        description: 'WhatsApp connection was cancelled',
                        variant: 'destructive',
                    });
                    setLoading(false);
                }
                })();
            },
            {
                config_id: WHATSAPP_CONFIG_ID,
                response_type: 'code',
                override_default_response_type: true,
                extras: {
                    setup: {},
                    featureType: '',
                    sessionInfoVersion: '4',
                }
            }
        );
    }, [workspaceId, fbReady, onConnected, user?.id]);

    // Finish a multi-WABA connection: reuse the token stashed during the ambiguous
    // exchange (no re-login) and connect the WABA the user picked.
    const finishWithChosenWaba = useCallback(async (candidate: WabaCandidate) => {
        if (!wabaChoice) return;
        setLoading(true);
        try {
            const res = await fetch(`${WHATSAPP_REST_API_PREFIX}/connect/exchange`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    workspace_id: workspaceId,
                    onboarding_session_id: wabaChoice.sessionId,
                    resume_token: wabaChoice.resumeToken,
                    waba_id: candidate.waba_id,
                    phone_number_id: candidate.phone_number_id,
                    business_id: candidate.business_id,
                }),
            });
            const data = (await res.json()) as ConnectExchangeResponse;
            if (data.success) {
                invalidateWhatsAppAccountsCache(workspaceId);
                toast({
                    title: 'WhatsApp connected',
                    description: `Connected: ${data.account?.display_phone_number || candidate.display_phone_number || candidate.verified_name || 'Account linked'}`,
                });
                setWabaChoice(null);
                requestWhatsAppAccountStatusPopup(workspaceId);
                onConnected?.();
                return;
            }
            toast({
                title: 'Connection Failed',
                description: formatConnectExchangeError(data),
                variant: 'destructive',
            });
        } catch (err) {
            toast({
                title: 'Connection Failed',
                description: err instanceof Error ? err.message : 'Failed to connect the selected number',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    }, [wabaChoice, workspaceId, onConnected]);

    return (
        <>
            <Button
                onClick={handleConnect}
                disabled={loading || !workspaceId}
                className="bg-[#25D366] hover:bg-[#128C7E] text-white"
                data-connect-whatsapp="true"
            >
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                    </>
                ) : (
                    <>
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Connect WhatsApp
                    </>
                )}
            </Button>

            {wabaChoice && (
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
                    onClick={() => !loading && setWabaChoice(null)}
                >
                    <div
                        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="mb-1 text-lg font-semibold text-gray-900">
                            Choose a WhatsApp number
                        </h3>
                        <p className="mb-4 text-sm text-gray-500">
                            This Meta account has more than one WhatsApp number. Pick the one you want to connect.
                        </p>
                        <div className="space-y-2">
                            {wabaChoice.candidates.map((c, i) => (
                                <button
                                    key={`${c.waba_id}-${c.phone_number_id}-${i}`}
                                    type="button"
                                    disabled={loading}
                                    onClick={() => finishWithChosenWaba(c)}
                                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left hover:border-[#25D366] hover:bg-green-50 disabled:opacity-60"
                                >
                                    <span>
                                        <span className="block font-medium text-gray-900">
                                            {c.display_phone_number || c.verified_name || 'WhatsApp number'}
                                        </span>
                                        <span className="block text-xs text-gray-500">
                                            {c.verified_name || c.waba_name || c.business_name || ''}
                                            {c.waba_id ? ` · WABA ${c.waba_id}` : ''}
                                        </span>
                                    </span>
                                    <MessageCircle className="h-5 w-5 text-[#25D366]" />
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => setWabaChoice(null)}
                            className="mt-4 w-full rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 disabled:opacity-60"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
