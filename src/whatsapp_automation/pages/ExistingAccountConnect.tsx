/**
 * Existing Account Connect (Path B)
 * ==================================
 * 
 * Form for users who already have WhatsApp Cloud API credentials:
 * - WABA ID
 * - Phone Number ID
 * - Access Token
 * 
 * Includes:
 * - Real-time token validation
 * - Friendly field help text
 * - Error handling with actionable guidance
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Link2,
    Loader2,
    CheckCircle2,
    AlertCircle,
    HelpCircle,
    Eye,
    EyeOff,
    ExternalLink
} from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import whatsappApi, { type AccountSummary } from '../api/whatsappApi';

// ============================================================
// Props
// ============================================================

interface ExistingAccountConnectProps {
    workspaceId: string;
    existingAccount?: AccountSummary | null;
    onSuccess: () => void;
    onCancel?: () => void;
    showCancelButton?: boolean;
}

// ============================================================
// Field Help Tooltip
// ============================================================

const FieldHelp: React.FC<{ text: string }> = ({ text }) => (
    <TooltipProvider>
        <Tooltip>
            <TooltipTrigger asChild>
                <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
                <p className="text-sm">{text}</p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);

// ============================================================
// Main Component
// ============================================================

export const ExistingAccountConnect: React.FC<ExistingAccountConnectProps> = ({
    workspaceId,
    existingAccount,
    onSuccess,
    onCancel,
    showCancelButton = true,
}) => {
    const [wabaId, setWabaId] = useState(existingAccount?.waba_id || '');
    const [phoneNumberId, setPhoneNumberId] = useState(existingAccount?.phone_number_id || '');
    const [accessToken, setAccessToken] = useState('');
    const [showToken, setShowToken] = useState(false);

    const [isValidating, setIsValidating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [tokenValid, setTokenValid] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isReconnect = !!existingAccount;

    // ============================================================
    // Token Validation
    // ============================================================
    const validateTokenAsync = useCallback(async (token: string) => {
        if (!token || token.length < 50) {
            setTokenValid(null);
            return;
        }

        setIsValidating(true);
        try {
            const result = await whatsappApi.validateToken(token);
            setTokenValid(result.valid);
            if (!result.valid && result.error) {
                setError(`Token validation: ${result.error}`);
            } else {
                setError(null);
            }
        } catch {
            setTokenValid(false);
        } finally {
            setIsValidating(false);
        }
    }, []);

    const handleTokenBlur = () => {
        if (accessToken) {
            validateTokenAsync(accessToken);
        }
    };

    // ============================================================
    // Form Submission
    // ============================================================
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const result = await whatsappApi.connectManual({
                workspace_id: workspaceId,
                waba_id: wabaId.trim(),
                phone_number_id: phoneNumberId.trim(),
                access_token: accessToken.trim(),
            });

            if (result.success) {
                onSuccess();
            } else {
                setError(result.error || 'Connection failed');
            }
        } catch (err) {
            setError('An unexpected error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    const isFormValid = wabaId.trim() && phoneNumberId.trim() && accessToken.trim();

    // ============================================================
    // Render
    // ============================================================
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Link2 className="w-5 h-5" />
                    {isReconnect ? 'Reconnect WhatsApp Account' : 'Connect Existing WhatsApp'}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {isReconnect
                        ? 'Your connection expired. Enter your credentials to reconnect.'
                        : 'Already have a WhatsApp Cloud API setup? Enter your credentials below.'}
                </p>
            </div>

            {/* Where to Find Info */}
            <Alert>
                <HelpCircle className="h-4 w-4" />
                <AlertTitle>Where to find these values</AlertTitle>
                <AlertDescription className="mt-2 space-y-2">
                    <p>You can find all three values in your Meta Business Settings:</p>
                    <div className="flex gap-2 mt-2">
                        <Button variant="outline" size="sm" asChild>
                            <a
                                href="https://business.facebook.com/settings/whatsapp-business-accounts"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                Open Meta Business Settings
                                <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                        </Button>
                    </div>
                </AlertDescription>
            </Alert>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* WABA ID */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="waba_id">WABA ID</Label>
                        <FieldHelp text="WhatsApp Business Account ID. Found in Meta Business Settings → WhatsApp Accounts." />
                    </div>
                    <Input
                        id="waba_id"
                        type="text"
                        placeholder="123456789012345"
                        value={wabaId}
                        onChange={(e) => setWabaId(e.target.value)}
                        disabled={isSubmitting}
                    />
                    <p className="text-xs text-muted-foreground">
                        This identifies your WhatsApp Business account
                    </p>
                </div>

                {/* Phone Number ID */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="phone_number_id">Phone Number ID</Label>
                        <FieldHelp text="The unique ID for your phone number, NOT the phone number itself. Found in WhatsApp API Setup." />
                    </div>
                    <Input
                        id="phone_number_id"
                        type="text"
                        placeholder="109876543210987"
                        value={phoneNumberId}
                        onChange={(e) => setPhoneNumberId(e.target.value)}
                        disabled={isSubmitting}
                    />
                    <p className="text-xs text-muted-foreground">
                        This is the phone number's ID, not the actual number
                    </p>
                </div>

                {/* Access Token */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Label htmlFor="access_token">Access Token</Label>
                        <FieldHelp text="System user access token with whatsapp_business_messaging permission. Use a permanent token for production." />
                        {tokenValid === true && (
                            <Badge className="bg-green-100 text-green-800 gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Valid
                            </Badge>
                        )}
                        {tokenValid === false && (
                            <Badge variant="destructive" className="gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Invalid
                            </Badge>
                        )}
                        {isValidating && (
                            <Badge variant="secondary" className="gap-1">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Validating
                            </Badge>
                        )}
                    </div>
                    <div className="relative">
                        <Input
                            id="access_token"
                            type={showToken ? 'text' : 'password'}
                            placeholder="EAAxxxxxxxx..."
                            value={accessToken}
                            onChange={(e) => setAccessToken(e.target.value)}
                            onBlur={handleTokenBlur}
                            disabled={isSubmitting}
                            className="pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowToken(!showToken)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Use a permanent token from System Users for production
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Connection Failed</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Buttons */}
                <div className="flex gap-3 pt-2">
                    <Button
                        type="submit"
                        disabled={!isFormValid || isSubmitting}
                        className="flex-1"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            <>
                                <Link2 className="w-4 h-4 mr-2" />
                                {isReconnect ? 'Reconnect Account' : 'Connect Account'}
                            </>
                        )}
                    </Button>
                    {showCancelButton && onCancel && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                    )}
                </div>
            </form>

            {/* Why can't I select my number */}
            <div className="pt-4 border-t">
                <details className="group">
                    <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                        Why can't I select my existing WhatsApp number?
                    </summary>
                    <div className="mt-2 text-sm text-muted-foreground space-y-2 pl-2 border-l-2">
                        <p>
                            WhatsApp numbers can only be connected to <strong>one platform at a time</strong>.
                        </p>
                        <p>
                            If your number is already linked elsewhere (like Twilio, WATI, or another tool),
                            Meta will block reuse.
                        </p>
                        <p>
                            To use it in Sociovia, first <strong>disconnect it from the previous platform</strong>.
                        </p>
                    </div>
                </details>
            </div>
        </div>
    );
};

export default ExistingAccountConnect;
