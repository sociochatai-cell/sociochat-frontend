// Facebook OAuth Login Button — onboarding-aware (Phase 8 / 12)
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { API_BASE_URL } from "@/config";
import {
  ONBOARDING_STATUS_LABELS,
  type OnboardingStatus,
  isOnboardingComplete,
  isOnboardingPending,
  userMessageForStatus,
} from '../constants/onboardingStatus';

const FB_APP_ID = import.meta.env.VITE_FB_APP_ID || '1616370899364211';
const FB_SDK_VERSION = 'v25.0';

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

interface FacebookLoginResult {
    success?: boolean;
    connected?: boolean;
    onboarding_status?: OnboardingStatus;
    user_message?: string;
    message?: string;
    error?: string;
    access_token?: string;
    account?: { display_phone_number?: string; phone_number_id?: string };
}

type FacebookSDK = {
    init: (params: { appId: string; cookie: boolean; xfbml: boolean; version: string }) => void;
    login: (callback: (response: FBOAuthResponse) => void, options: { scope: string }) => void;
    getLoginStatus: (callback: (response: FBOAuthResponse) => void) => void;
};

const getFB = (): FacebookSDK | undefined => (window as any).FB;

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

    useEffect(() => {
        const fb = getFB();
        if (fb) {
            setFbReady(true);
            return;
        }

        const existingInit = (window as any).fbAsyncInit;

        setFbAsyncInit(() => {
            const fbInstance = getFB();
            if (fbInstance) {
                fbInstance.init({
                    appId: FB_APP_ID,
                    cookie: true,
                    xfbml: true,
                    version: FB_SDK_VERSION
                });
                setFbReady(true);
                if (existingInit && typeof existingInit === 'function') {
                    existingInit();
                }
            }
        });

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
            toast({ title: 'Error', description: 'No workspace selected', variant: 'destructive' });
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

        fb.login(
            function (response: FBOAuthResponse) {
                if (response.status === 'connected' && response.authResponse?.accessToken) {
                    const accessToken = response.authResponse.accessToken;

                    fetch(`${API_BASE_URL}/api/whatsapp/oauth/facebook-login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            access_token: accessToken,
                            workspace_id: workspaceId,
                        }),
                    })
                        .then(res => res.json())
                        .then((data: FacebookLoginResult) => {
                            const obStatus = data.onboarding_status;
                            const userMsg =
                                data.user_message
                                || userMessageForStatus(obStatus, data.error)
                                || data.message
                                || data.error;

                            if (data.success && data.connected && (!obStatus || isOnboardingComplete(obStatus))) {
                                toast({
                                    title: 'Connected Successfully',
                                    description: `Connected: ${data.account?.display_phone_number || data.account?.phone_number_id || 'WhatsApp Business'}`,
                                });
                                setTimeout(() => { window.location.href = '/dashboard'; }, 1000);
                                return;
                            }

                            if (obStatus && isOnboardingPending(obStatus)) {
                                toast({
                                    title: ONBOARDING_STATUS_LABELS[obStatus],
                                    description: userMsg || 'Setup is in progress.',
                                });
                                onSuccess?.(data.access_token || accessToken);
                                return;
                            }

                            if (!data.success && data.access_token) {
                                toast({
                                    title: obStatus ? ONBOARDING_STATUS_LABELS[obStatus] : 'Manual setup required',
                                    description: userMsg || 'Please enter your WABA details manually.',
                                });
                                localStorage.setItem('fb_access_token', data.access_token);
                                onSuccess?.(data.access_token);
                                return;
                            }

                            if (data.success && !data.connected && data.access_token) {
                                toast({
                                    title: 'Logged in successfully',
                                    description: userMsg || 'Please enter your WABA details manually.',
                                });
                                localStorage.setItem('fb_access_token', data.access_token);
                                onSuccess?.(data.access_token);
                                return;
                            }

                            throw new Error(userMsg || data.error || 'Login failed');
                        })
                        .catch((err: Error) => {
                            toast({
                                title: 'Login Failed',
                                description: err.message || 'Failed to authenticate with Facebook',
                                variant: 'destructive',
                            });
                            onError?.(err.message);
                        })
                        .finally(() => setLoading(false));
                } else {
                    toast({
                        title: 'Cancelled',
                        description: 'Facebook login was cancelled',
                        variant: 'destructive',
                    });
                    setLoading(false);
                }
            },
            {
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
