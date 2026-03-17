// Connect WhatsApp Button Component
// ==================================
// Button to initiate WhatsApp Business Account connection via Facebook Embedded Signup
// Supports both Standard and Coexistence (existing WABA) modes

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, MessageCircle, Smartphone } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { API_BASE_URL } from "@/config";

// Facebook App ID and Config ID from environment (SocioChat App)
const FB_APP_ID = import.meta.env.VITE_FB_APP_ID || '1616370899364211';
const WHATSAPP_CONFIG_ID = import.meta.env.VITE_WHATSAPP_CONFIG_ID || '1684758789571645';
const FB_SDK_VERSION = 'v25.0'; // SDK init version — must match Meta app dashboard, NOT the Graph API version

interface ConnectWhatsAppButtonProps {
    workspaceId: string;
    onConnected?: () => void;
    /** Enable coexistence mode — connects existing WhatsApp Business App */
    coexistenceMode?: boolean;
}

// Declare FB types
declare global {
    interface Window {
        FB: {
            init: (params: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }) => void;
            login: (callback: (response: FBLoginResponse) => void, options: Record<string, any>) => void;
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

// Session info captured from Embedded Signup postMessage
interface EmbeddedSignupSessionData {
    phone_number_id?: string;
    waba_id?: string;
}

export function ConnectWhatsAppButton({ workspaceId, onConnected, coexistenceMode = false }: ConnectWhatsAppButtonProps) {
    const [loading, setLoading] = useState(false);
    const [fbReady, setFbReady] = useState(false);
    const sessionDataRef = useRef<EmbeddedSignupSessionData>({});

    // Load Facebook SDK
    useEffect(() => {
        // Check if SDK is already loaded
        if (window.FB) {
            setFbReady(true);
            return;
        }

        // Save any existing fbAsyncInit (another component may have set it)
        const existingInit = window.fbAsyncInit;

        // Define the callback for when SDK loads
        window.fbAsyncInit = function () {
            window.FB.init({
                appId: FB_APP_ID,
                autoLogAppEvents: true,
                xfbml: true,
                version: FB_SDK_VERSION
            });
            setFbReady(true);
            console.log('[whatsapp] Facebook SDK initialized (ConnectWhatsAppButton)');
            // Call any previously-registered fbAsyncInit so other components also get notified
            if (existingInit && existingInit !== window.fbAsyncInit) {
                existingInit();
            }
        };

        // Load the SDK script
        if (!document.getElementById('facebook-jssdk')) {
            const script = document.createElement('script');
            script.id = 'facebook-jssdk';
            script.src = 'https://connect.facebook.net/en_US/sdk.js';
            script.async = true;
            script.defer = true;
            script.crossOrigin = 'anonymous';
            document.body.appendChild(script);
        }
    }, []);

    // Poll for FB SDK in case another component initialized it
    useEffect(() => {
        if (fbReady) return;
        const interval = setInterval(() => {
            if (window.FB) {
                setFbReady(true);
                clearInterval(interval);
            }
        }, 300);
        return () => clearInterval(interval);
    }, [fbReady]);

    // Listen for Embedded Signup session info via postMessage
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== "https://www.facebook.com" && event.origin !== "https://web.facebook.com") {
                return;
            }
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'WA_EMBEDDED_SIGNUP') {
                    if (data.event === 'FINISH') {
                        const { phone_number_id, waba_id } = data.data;
                        console.log('[whatsapp] Embedded Signup FINISH — phone:', phone_number_id, 'waba:', waba_id);
                        sessionDataRef.current = { phone_number_id, waba_id };
                    } else if (data.event === 'CANCEL') {
                        console.warn('[whatsapp] Embedded Signup cancelled at step:', data.data?.current_step);
                    } else if (data.event === 'ERROR') {
                        console.error('[whatsapp] Embedded Signup error:', data.data?.error_message);
                    }
                }
            } catch {
                // Non-JSON message, ignore
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
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

        if (!window.FB) {
            toast({
                title: 'Loading...',
                description: 'Facebook SDK is still loading. Please try again in a moment.',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        // Clear previous session data
        sessionDataRef.current = {};
        console.log(`[whatsapp] Starting Embedded Signup flow (coexistence=${coexistenceMode})`);

        // Determine the exchange endpoint
        const exchangeEndpoint = coexistenceMode
            ? `${API_BASE_URL}/api/whatsapp/coexistence/connect`
            : `${API_BASE_URL}/api/whatsapp/connect/exchange`;

        // Callback when user completes FB Login
        const fbLoginCallback = (response: FBLoginResponse) => {
            console.log('[whatsapp] FB.login response:', response);

            if (response.authResponse?.code) {
                // Include WABA and phone IDs from session info if available
                const { phone_number_id, waba_id } = sessionDataRef.current;

                fetch(exchangeEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        code: response.authResponse.code,
                        workspace_id: workspaceId,
                        // Pass session info so backend doesn't need to discover via API
                        ...(waba_id && { waba_id }),
                        ...(phone_number_id && { phone_number_id }),
                    }),
                })
                    .then(res => res.json())
                    .then(data => {
                        if (data.success) {
                            toast({
                                title: 'Success!',
                                description: coexistenceMode
                                    ? `WhatsApp Business App connected in coexistence mode (${data.mps_limit || 5} MPS)`
                                    : 'WhatsApp account connected successfully!',
                            });
                            onConnected?.();
                            const redirectPath = coexistenceMode ? '/dashboard/coexistence' : '/dashboard';
                            setTimeout(() => { window.location.href = redirectPath; }, 500);
                        } else {
                            throw new Error(data.error || 'Failed to connect account');
                        }
                    })
                    .catch((err: any) => {
                        console.error('[whatsapp] Token exchange error:', err);
                        toast({
                            title: 'Connection Failed',
                            description: err.message || 'Failed to exchange token',
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
        };

        // Launch Embedded Signup with Facebook Login (v3 ES format)
        window.FB.login(fbLoginCallback, {
            config_id: WHATSAPP_CONFIG_ID,
            response_type: 'code',
            override_default_response_type: true,
            extras: {
                version: 'v3',
                setup: {
                    business: {
                        id: null, name: null, email: null,
                        phone: { code: null, number: null },
                        website: null,
                        address: { streetAddress1: null, streetAddress2: null, city: null, state: null, zipPostal: null, country: null },
                        timezone: null
                    },
                    phone: { displayName: null, category: null, description: null },
                    preVerifiedPhone: { ids: null },
                    solutionID: null,
                    whatsAppBusinessAccount: { ids: null },
                },
                ...(coexistenceMode && { featureType: 'whatsapp_business_app_onboarding' }),
            }
        });
    }, [workspaceId, fbReady, onConnected, coexistenceMode]);

    return (
        <Button
            onClick={handleConnect}
            disabled={loading || !workspaceId}
            className={coexistenceMode
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-[#25D366] hover:bg-[#128C7E] text-white"}
            data-connect-whatsapp="true"
        >
            {loading ? (
                <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                </>
            ) : coexistenceMode ? (
                <>
                    <Smartphone className="w-4 h-4 mr-2" />
                    Connect Existing Account
                </>
            ) : (
                <>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Connect WhatsApp
                </>
            )}
        </Button>
    );
}
