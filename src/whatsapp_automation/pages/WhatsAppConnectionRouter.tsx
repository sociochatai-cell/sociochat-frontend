/**
 * WhatsApp Connection Router
 * ==========================
 * 
 * Smart component that auto-detects the appropriate connection path:
 * - NO_ACCOUNT → Show Embedded Signup (new number)
 * - PARTIAL → Show "Finish setup" form
 * - RELINK_REQUIRED → Show "Reconnect" form
 * - CONNECTED → Show account summary
 * 
 * Users never have to decide which path to use - the backend decides for them.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    MessageCircle,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    RefreshCw,
    Settings,
    Phone,
    Link2,
    Smartphone,
    TestTube2
} from 'lucide-react';
import whatsappApi, {
    type ConnectionPathResponse,
    type ConnectionStatus,
    type AccountSummary
} from '../api/whatsappApi';
import { ExistingAccountConnect } from './ExistingAccountConnect';
import { FacebookLoginButton } from '@/whatsapp/components/FacebookLoginButton';
import { ConnectWhatsAppButton } from '@/whatsapp/components/ConnectWhatsAppButton';
import { setStoredAccountId } from '@/whatsapp/utils/accountContext';

// ============================================================
// Props
// ============================================================

interface WhatsAppConnectionRouterProps {
    workspaceId: string;
    onConnectionComplete?: () => void;
}

// ============================================================
// Status Badge Component
// ============================================================

const StatusBadge: React.FC<{ status: ConnectionStatus }> = ({ status }) => {
    switch (status) {
        case 'CONNECTED':
            return <Badge className="bg-green-100 text-green-800">Connected</Badge>;
        case 'PARTIAL':
            return <Badge className="bg-yellow-100 text-yellow-800">Setup Incomplete</Badge>;
        case 'RELINK_REQUIRED':
            return <Badge className="bg-orange-100 text-orange-800">Reconnect Required</Badge>;
        case 'NO_ACCOUNT':
        default:
            return <Badge variant="outline">Not Connected</Badge>;
    }
};

// ============================================================
// Connected Account View
// ============================================================

const ConnectedAccountView: React.FC<{
    account: AccountSummary;
    onRefresh: () => void;
}> = ({ account, onRefresh }) => {
    const navigate = useNavigate();

    return (
        <div className="space-y-6">
            {/* Success Banner */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                        <h4 className="font-semibold text-green-900">
                            {account.verified_name || 'WhatsApp Business Connected'}
                        </h4>
                        <p className="text-sm text-green-700 mt-1">
                            {account.phone_number || 'Phone number configured'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                            {account.is_test_number && (
                                <Badge variant="secondary" className="gap-1">
                                    <TestTube2 className="w-3 h-3" />
                                    Test Number
                                </Badge>
                            )}
                            {account.display_name_status === 'IN_REVIEW' && (
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                                    Name In Review
                                </Badge>
                            )}
                            {account.quality_rating && (
                                <Badge className={
                                    account.quality_rating === 'GREEN' ? 'bg-green-100 text-green-800' :
                                        account.quality_rating === 'YELLOW' ? 'bg-yellow-100 text-yellow-800' :
                                            'bg-red-100 text-red-800'
                                }>
                                    Quality: {account.quality_rating}
                                </Badge>
                            )}
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onRefresh}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Test Number Warning */}
            {account.is_test_number && (
                <Alert>
                    <TestTube2 className="h-4 w-4" />
                    <AlertTitle>Test Number</AlertTitle>
                    <AlertDescription>
                        This is a temporary number provided by Meta for testing.
                        It <strong>cannot</strong> be used for real customer messaging.
                        To go live, connect a real WhatsApp Business number.
                    </AlertDescription>
                </Alert>
            )}

            {/* Quick Actions */}
            <div className="grid gap-3 sm:grid-cols-3">
                <Button
                    onClick={() => navigate('/dashboard/inbox')}
                    className="w-full !bg-green-600 hover:!bg-green-700 !text-white"
                >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Open Inbox
                </Button>
                <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard/templates')}
                    className="w-full"
                >
                    Templates
                </Button>
                <Button
                    variant="outline"
                    onClick={() => navigate('/dashboard/settings')}
                    className="w-full"
                >
                    <Settings className="w-4 h-4 mr-2" />
                    Settings
                </Button>
            </div>
        </div>
    );
};

// ============================================================
// Embedded Signup View (Path A)
// ============================================================

const EmbeddedSignupView: React.FC<{
    workspaceId: string;
    onSuccess: () => void;
    onSwitchToManual: () => void;
}> = ({ workspaceId, onSuccess, onSwitchToManual }) => {
    const navigate = useNavigate();
    const [showFacebookLogin, setShowFacebookLogin] = useState(false);
    const [fbCredentials, setFbCredentials] = useState<{
        accessToken: string;
        userId?: string;
        scopes?: string[];
    } | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    const handleStartSignup = () => {
        // Navigate to the Embedded Signup flow
        navigate(`/dashboard/setup?workspace_id=${workspaceId}`);
    };

    const handleFacebookLoginSuccess = (accessToken: string) => {
        // Store credentials for display
        console.log('[WhatsApp] Facebook login successful, received token');
        setFbCredentials({ accessToken });
        localStorage.setItem('fb_access_token', accessToken);
    };

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        setTimeout(() => setCopied(null), 2000);
    };

    // State for WABA discovery
    const [discoveredWabas, setDiscoveredWabas] = useState<any[] | null>(null);
    const [discovering, setDiscovering] = useState(false);
    const [discoveryError, setDiscoveryError] = useState<string | null>(null);

    const discoverWaba = async () => {
        if (!fbCredentials?.accessToken) return;

        setDiscovering(true);
        setDiscoveryError(null);

        try {
            const res = await fetch('/api/whatsapp/oauth/discover-waba', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ access_token: fbCredentials.accessToken }),
            });
            const data = await res.json();

            if (data.success) {
                setDiscoveredWabas(data.wabas || []);
                if (data.wabas?.length === 0) {
                    setDiscoveryError(data.message || 'No WhatsApp Business Accounts found');
                }
            } else {
                setDiscoveryError(data.error || 'Failed to discover WABA');
            }
        } catch (err: any) {
            setDiscoveryError(err.message || 'Network error');
        } finally {
            setDiscovering(false);
        }
    };

    // If we have credentials from Facebook login, show them
    if (fbCredentials) {
        return (
            <div className="space-y-6">
                {/* Success Banner */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                        <div>
                            <h4 className="font-semibold text-green-900">Facebook Login Successful!</h4>
                            <p className="text-sm text-green-700 mt-1">
                                Your permanent access token is ready.
                                {!discoveredWabas && ' Click "Fetch My WABA Info" to find your account details.'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* WABA Discovery Section */}
                {!discoveredWabas && (
                    <div className="p-4 border-2 border-dashed border-primary/30 rounded-lg bg-primary/5">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                            <RefreshCw className="w-5 h-5" />
                            Auto-Discover Your WABA
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3">
                            Click below to automatically find your WABA ID and Phone Number ID using your access token.
                        </p>
                        <Button
                            onClick={discoverWaba}
                            disabled={discovering}
                            className="w-full"
                        >
                            {discovering ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Discovering...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Fetch My WABA Info
                                </>
                            )}
                        </Button>
                        {discoveryError && (
                            <p className="text-sm text-red-600 mt-2">{discoveryError}</p>
                        )}
                    </div>
                )}

                {/* Discovered WABAs */}
                {discoveredWabas && discoveredWabas.length > 0 && (
                    <div className="space-y-4">
                        <h4 className="font-semibold">Found {discoveredWabas.length} WhatsApp Business Account(s):</h4>
                        {discoveredWabas.map((waba, idx) => (
                            <div key={idx} className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h5 className="font-semibold text-blue-900">
                                            {waba.waba_name || waba.business_name || 'WhatsApp Business Account'}
                                        </h5>
                                        <p className="text-xs text-blue-700">WABA ID: {waba.waba_id}</p>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => copyToClipboard(waba.waba_id, `waba-${idx}`)}
                                    >
                                        {copied === `waba-${idx}` ? '✓ Copied' : 'Copy ID'}
                                    </Button>
                                </div>

                                {waba.phone_numbers?.length > 0 ? (
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-blue-800">Phone Numbers:</p>
                                        {waba.phone_numbers.map((phone: any, pIdx: number) => (
                                            <div key={pIdx} className="flex items-center justify-between p-2 bg-white rounded border">
                                                <div>
                                                    <p className="font-medium text-sm">{phone.display_phone_number}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Phone ID: {phone.id}
                                                        {phone.verified_name && ` • ${phone.verified_name}`}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => copyToClipboard(phone.id, `phone-${idx}-${pIdx}`)}
                                                >
                                                    {copied === `phone-${idx}-${pIdx}` ? '✓' : 'Copy Phone ID'}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-blue-700">No phone numbers found for this WABA</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Access Token (always visible) */}
                <div className="p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">Access Token (Permanent)</label>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(fbCredentials.accessToken, 'token')}
                            className="h-8 px-2"
                        >
                            {copied === 'token' ? (
                                <span className="text-green-600 text-xs">✓ Copied!</span>
                            ) : (
                                <span className="text-xs">Copy</span>
                            )}
                        </Button>
                    </div>
                    <div className="p-2 bg-background rounded border">
                        <code className="text-xs break-all block max-h-24 overflow-y-auto">
                            {fbCredentials.accessToken}
                        </code>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        This is a long-lived token (~60 days).
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <Button onClick={onSwitchToManual} className="flex-1">
                        <Link2 className="w-4 h-4 mr-2" />
                        Enter WABA Details Manually
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setFbCredentials(null);
                            setDiscoveredWabas(null);
                        }}
                    >
                        Back
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center mb-2">
                <h3 className="text-lg font-semibold">Choose Your Connection Method</h3>
                <p className="text-sm text-muted-foreground">Select how you'd like to connect your WhatsApp Business Account</p>
            </div>

            {/* Connection Options - Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Tile 1: New WhatsApp Number */}
                <Card
                    className="hover:border-green-400 hover:shadow-md transition-all border-2 flex flex-col"
                >
                    <CardContent className="p-6 flex flex-col flex-1">
                        <div className="flex flex-col items-center text-center flex-1">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] mb-4">
                                <Smartphone className="w-8 h-8 text-white" />
                            </div>
                            <div className="flex items-center gap-2 mb-2 flex-wrap justify-center">
                                <h4 className="font-semibold text-lg">New WhatsApp Number</h4>
                                <Badge className="bg-green-100 text-green-800 text-xs">Recommended</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4 flex-1">
                                Create a brand new WhatsApp Business number with Meta's guided Embedded Signup flow.
                            </p>
                            <div className="w-full mt-auto" onClick={(e) => e.stopPropagation()}>
                                <ConnectWhatsAppButton
                                    workspaceId={workspaceId}
                                    onConnected={onSuccess}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tile 2: Get Access Token via Facebook */}
                <Card
                    className="cursor-pointer hover:border-blue-400 hover:shadow-md transition-all border-2 flex flex-col"
                    onClick={() => !showFacebookLogin && setShowFacebookLogin(true)}
                >
                    <CardContent className="p-6 flex flex-col flex-1">
                        <div className="flex flex-col items-center text-center flex-1">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-[#1877F2] to-[#0D5DC7] mb-4">
                                <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                </svg>
                            </div>
                            <h4 className="font-semibold text-lg mb-2">Log in with Facebook</h4>
                            <p className="text-sm text-muted-foreground mb-4 flex-1">
                                Login to already created WhatsApp Business account in WhatsApp manager with Facebook.
                            </p>
                            <div className="w-full mt-auto" onClick={(e) => e.stopPropagation()}>
                                {!showFacebookLogin ? (
                                    <Button variant="outline" className="w-full border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => setShowFacebookLogin(true)}>
                                        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                        </svg>
                                        Login with Facebook
                                    </Button>
                                ) : (
                                    <FacebookLoginButton
                                        workspaceId={workspaceId}
                                        onSuccess={handleFacebookLoginSuccess}
                                        buttonText="Login with Facebook"
                                        className="w-full"
                                    />
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tile 3: Manual Connection */}
                <Card
                    className="cursor-pointer hover:border-gray-400 hover:shadow-md transition-all border-2 flex flex-col"
                    onClick={onSwitchToManual}
                >
                    <CardContent className="p-6 flex flex-col flex-1">
                        <div className="flex flex-col items-center text-center flex-1">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-gray-500 to-gray-700 mb-4">
                                <Link2 className="w-8 h-8 text-white" />
                            </div>
                            <h4 className="font-semibold text-lg mb-2">Manual Connection</h4>
                            <p className="text-sm text-muted-foreground mb-4 flex-1">
                                Already have your credentials? Enter your WABA ID, Phone Number ID, and Access Token directly.
                            </p>
                            <Button variant="outline" className="w-full mt-auto">
                                <Link2 className="w-4 h-4 mr-2" />
                                Enter Credentials Manually
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Tile 4: Coexistence — Connect Existing WhatsApp Business App */}
                <Card
                    className="hover:border-purple-400 hover:shadow-md transition-all border-2 flex flex-col"
                >
                    <CardContent className="p-6 flex flex-col flex-1">
                        <div className="flex flex-col items-center text-center flex-1">
                            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 mb-4">
                                <Phone className="w-8 h-8 text-white" />
                            </div>
                            <div className="flex items-center gap-2 mb-2 flex-wrap justify-center">
                                <h4 className="font-semibold text-lg">Existing App</h4>
                                <Badge className="bg-purple-100 text-purple-800 text-xs">Coexistence</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-4 flex-1">
                                Keep using your WhatsApp Business mobile app while connecting to Cloud API. 5 MPS limit applies.
                            </p>
                            <div className="w-full mt-auto" onClick={(e) => e.stopPropagation()}>
                                <ConnectWhatsAppButton
                                    workspaceId={workspaceId}
                                    onConnected={onSuccess}
                                    coexistenceMode={true}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

// ============================================================
// Main Component
// ============================================================

export const WhatsAppConnectionRouter: React.FC<WhatsAppConnectionRouterProps> = ({
    workspaceId,
    onConnectionComplete
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connectionData, setConnectionData] = useState<ConnectionPathResponse | null>(null);
    const [showManualForm, setShowManualForm] = useState(false);

    const fetchConnectionPath = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const result = await whatsappApi.getConnectionPath(workspaceId);
            setConnectionData(result);
        } catch (err) {
            setError('Failed to check WhatsApp connection status');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (workspaceId) {
            fetchConnectionPath();
        } else {
            setIsLoading(false);
            setError('No workspace found. Please go to Settings to configure your workspace first.');
        }
    }, [workspaceId]);

    const handleConnectionSuccess = async () => {
        // Fetch connection data and store the new account ID
        const result = await whatsappApi.getConnectionPath(workspaceId);
        setConnectionData(result);

        // Store the newly connected account ID for use across the app
        if (result.account_summary?.id) {
            setStoredAccountId(result.account_summary.id);
            console.log('[WhatsApp] Stored new account ID:', result.account_summary.id);
        }

        onConnectionComplete?.();
    };

    // ============================================================
    // Loading State
    // ============================================================
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="w-6 h-6 text-green-500" />
                        WhatsApp Business
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-12">
                    <div className="flex items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-green-500" />
                        <span className="text-muted-foreground">Checking connection status...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // ============================================================
    // Error State
    // ============================================================
    if (error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="w-6 h-6 text-green-500" />
                        WhatsApp Business
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Connection Error</AlertTitle>
                        <AlertDescription className="flex items-center justify-between">
                            <span>{error}</span>
                            <Button variant="outline" size="sm" onClick={fetchConnectionPath}>
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Retry
                            </Button>
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    const status = connectionData?.status || 'NO_ACCOUNT';

    // ============================================================
    // Render Based on Status
    // ============================================================
    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageCircle className="w-6 h-6 text-green-500" />
                        <CardTitle>WhatsApp Business</CardTitle>
                    </div>
                    <StatusBadge status={status} />
                </div>
                <CardDescription>
                    {status === 'CONNECTED'
                        ? 'Your WhatsApp Business is connected and ready'
                        : status === 'PARTIAL'
                            ? 'Complete your WhatsApp setup to start messaging'
                            : status === 'RELINK_REQUIRED'
                                ? 'Your connection expired — reconnect to continue'
                                : 'Connect WhatsApp to chat with customers directly'
                    }
                </CardDescription>
            </CardHeader>
            <CardContent>
                {status === 'CONNECTED' && connectionData?.account_summary ? (
                    <ConnectedAccountView
                        account={connectionData.account_summary}
                        onRefresh={fetchConnectionPath}
                    />
                ) : showManualForm ? (
                    <ExistingAccountConnect
                        workspaceId={workspaceId}
                        existingAccount={connectionData?.account_summary}
                        onSuccess={handleConnectionSuccess}
                        onCancel={() => setShowManualForm(false)}
                        showCancelButton={true}
                    />
                ) : (
                    <EmbeddedSignupView
                        workspaceId={workspaceId}
                        onSuccess={handleConnectionSuccess}
                        onSwitchToManual={() => setShowManualForm(true)}
                    />
                )}
            </CardContent>
        </Card>
    );
};

export default WhatsAppConnectionRouter;
