// Facebook OAuth Login Button Component
// =====================================
// Simple Facebook OAuth login to authenticate and get access token
// Use this when you already have a WABA but need to authenticate

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { API_BASE_URL } from "@/config";

// Facebook App ID from environment (SocioChat App)
const FB_APP_ID = import.meta.env.VITE_FB_APP_ID || '1616370899364211';
const FB_SDK_VERSION = 'v25.0'; // SDK init version — must match Meta app dashboard

interface FacebookLoginButtonProps {
    workspaceId: string;
    onSuccess?: (accessToken: string) => void;
    onError?: (error: string) => void;
    variant?: 'default' | 'outline' | 'secondary' | 'ghost';
    size?: 'default' | 'sm' | 'lg';
    className?: string;
    buttonText?: string;
}

interface FBOAuthResponse {
    authResponse?: {
        accessToken?: string;
        userID?: string;
        expiresIn?: number;
    };
    status: 'connected' | 'not_authorized' | 'unknown';
}

// Type for FB SDK - use any to avoid conflicts with other FB declarations
type FacebookSDK = {
    init: (params: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
    login: (callback: (response: FBOAuthResponse) => void, options: { scope: string }) => void;
    getLoginStatus: (callback: (response: FBOAuthResponse) => void) => void;
};

// Get FB from window - cast to avoid type conflicts
const getFB = (): FacebookSDK | undefined => {
    return (window as any).FB;
};

const setFbAsyncInit = (callback: () => void) => {
    (window as any).fbAsyncInit = callback;
};

export function FacebookLoginButton({
    workspaceId,
    onSuccess,
    onError,
    variant = 'default',
    size = 'default',
    className = '',
    buttonText = 'Continue with Facebook'
}: FacebookLoginButtonProps) {
    const [loading, setLoading] = useState(false);
    const [fbReady, setFbReady] = useState(false);

    // Load Facebook SDK
    useEffect(() => {
        // Check if SDK is already loaded
        const fb = getFB();
        if (fb) {
            setFbReady(true);
            return;
        }

        // Save any existing fbAsyncInit (another component may have set it)
        const existingInit = (window as any).fbAsyncInit;

        // Define the callback for when SDK loads
        setFbAsyncInit(() => {
            const fb = getFB();
            if (fb) {
                fb.init({
                    appId: FB_APP_ID,
                    cookie: true,
                    xfbml: true,
                    version: FB_SDK_VERSION
                });
                setFbReady(true);
                console.log('[facebook] Facebook SDK initialized (FacebookLoginButton)');
                // Chain any previously-registered init
                if (existingInit && typeof existingInit === 'function') {
                    existingInit();
                }
            }
        });

        // Load the SDK script if not already loaded
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
            if (getFB()) {
                setFbReady(true);
                clearInterval(interval);
            }
        }, 300);
        return () => clearInterval(interval);
    }, [fbReady]);

    const handleFacebookLogin = useCallback(() => {
        if (!workspaceId) {
            toast({
                title: 'Error',
                description: 'No workspace selected',
                variant: 'destructive',
            });
            return;
        }

        const fb = getFB();
        if (!fbReady || !fb) {
            toast({
                title: 'Loading...',
                description: 'Facebook SDK is still loading. Please try again.',
                variant: 'destructive',
            });
            return;
        }

        setLoading(true);
        console.log('[facebook] Starting Facebook OAuth login');

        // Simple Facebook Login with required scopes for WhatsApp Business
        fb.login(
            function (response: FBOAuthResponse) {
                console.log('[facebook] FB.login response:', response);

                if (response.status === 'connected' && response.authResponse?.accessToken) {
                    const accessToken = response.authResponse.accessToken;

                    // Send to backend to exchange for long-lived token and auto-connect WABA
                    fetch(
                        `${API_BASE_URL}/api/whatsapp/oauth/facebook-login`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                                access_token: accessToken,
                                workspace_id: workspaceId,
                            }),
                        }
                    )
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                if (data.connected) {
                                    // WABA was auto-discovered and connected!
                                    toast({
                                        title: '✓ WhatsApp Connected!',
                                        description: `Connected: ${data.account?.display_phone_number || data.account?.phone_number_id}`,
                                    });
                                    // Redirect to dashboard after connection
                                    setTimeout(() => {
                                        window.location.href = '/dashboard';
                                    }, 1000);
                                } else {
                                    // Authenticated but no WABA found - need manual linking
                                    toast({
                                        title: 'Logged in successfully!',
                                        description: data.message || 'Please enter your WABA details manually.',
                                    });
                                    // Store token for manual connect form
                                    localStorage.setItem('fb_access_token', data.access_token);
                                    onSuccess?.(data.access_token || accessToken);
                                }
                            } else {
                                throw new Error(data.error || 'Login failed');
                            }
                        })
                        .catch((err: any) => {
                            console.error('[facebook] OAuth error:', err);
                            toast({
                                title: 'Login Failed',
                                description: err.message || 'Failed to authenticate with Facebook',
                                variant: 'destructive',
                            });
                            onError?.(err.message);
                        })
                        .finally(() => {
                            setLoading(false);
                        });
                } else {
                    // User cancelled or error
                    console.log('[facebook] User cancelled or not authorized');
                    toast({
                        title: 'Cancelled',
                        description: 'Facebook login was cancelled',
                        variant: 'destructive',
                    });
                    setLoading(false);
                }
            },
            {
                // WhatsApp Business required scopes
                scope: 'whatsapp_business_management,whatsapp_business_messaging,business_management,whatsapp_business_manage_events'
            }
        );
    }, [workspaceId, fbReady, onSuccess, onError]);

    return (
        <Button
            onClick={handleFacebookLogin}
            disabled={loading || !workspaceId}
            variant={variant}
            size={size}
            className={`${className} ${variant === 'default' ? 'bg-[#1877F2] hover:bg-[#166FE5] text-white' : ''}`}
        >
            {loading ? (
                <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Authenticating...
                </>
            ) : (
                <>
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    {buttonText}
                </>
            )}
        </Button>
    );
}

export default FacebookLoginButton;
