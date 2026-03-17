import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  MessageCircle,
  Facebook,
  Phone,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  RefreshCw,
  Settings,
  FileText,
  Send
} from 'lucide-react';
import { whatsappApi, type WABAInfo, type PhoneNumber } from '../api';
import type { LinkedPage } from '../types';

// ============================================================
// Types
// ============================================================

type SetupStep = 'initial' | 'facebook_login' | 'phone_verify' | 'permissions' | 'success';

interface EmbeddedSignupStubProps {
  workspaceId?: string;
  onSuccess?: (linkedAssets: LinkedPage[]) => void;
}

interface WABAState {
  waba: WABAInfo | null;
  phoneNumbers: PhoneNumber[];
  isLoading: boolean;
  error: string | null;
}

// ============================================================
// Step Components
// ============================================================

const StepIndicator: React.FC<{
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}> = ({ currentStep, totalSteps, stepLabels }) => {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm text-muted-foreground">
        {stepLabels.map((label, index) => (
          <span
            key={label}
            className={index + 1 <= currentStep ? 'text-primary font-medium' : ''}
          >
            {label}
          </span>
        ))}
      </div>
      <Progress value={progress} className="h-2" aria-label={`Step ${currentStep} of ${totalSteps}`} />
    </div>
  );
};

// ============================================================
// Main Component
// ============================================================

export const EmbeddedSignupStub: React.FC<EmbeddedSignupStubProps> = ({
  workspaceId: propWorkspaceId,
  onSuccess
}) => {
  const navigate = useNavigate();
  const { id: paramWorkspaceId } = useParams<{ id: string }>();
  const workspaceId = propWorkspaceId || paramWorkspaceId || 'default';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<SetupStep>('initial');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedAssets, setLinkedAssets] = useState<LinkedPage[]>([]);

  // WABA state - check if already connected
  const [wabaState, setWabaState] = useState<WABAState>({
    waba: null,
    phoneNumbers: [],
    isLoading: true,
    error: null,
  });

  // Phone verification state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Check existing WABA connection on mount
  useEffect(() => {
    const checkExistingWABA = async () => {
      setWabaState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await whatsappApi.getWABA(workspaceId);

        if (response.error) {
          // No WABA linked yet - this is expected for new workspaces
          setWabaState({
            waba: null,
            phoneNumbers: [],
            isLoading: false,
            error: null,
          });
        } else {
          setWabaState({
            waba: response.waba,
            phoneNumbers: response.phone_numbers || [],
            isLoading: false,
            error: null,
          });

          // Convert to LinkedPage format for success state
          if (response.waba) {
            const linkedPages: LinkedPage[] = (response.phone_numbers || []).map(phone => ({
              page_id: response.waba!.id,
              page_name: response.waba!.name,
              waba_id: response.waba!.id,
              phone_number_id: phone.id,
            }));
            setLinkedAssets(linkedPages);
          }
        }
      } catch (err) {
        setWabaState({
          waba: null,
          phoneNumbers: [],
          isLoading: false,
          error: 'Failed to check WABA status',
        });
      }
    };

    checkExistingWABA();
  }, [workspaceId]);

  const stepLabels = ['Login', 'Verify Phone', 'Permissions', 'Complete'];
  const stepNumber = {
    initial: 0,
    facebook_login: 1,
    phone_verify: 2,
    permissions: 3,
    success: 4,
  };

  const handleStartSetup = useCallback(() => {
    setIsModalOpen(true);
    setCurrentStep('facebook_login');
    setError(null);
  }, []);

  const handleFacebookLogin = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // STUB: In production, this would initiate Facebook OAuth flow
      // For now, we simulate a successful login
      await new Promise(resolve => setTimeout(resolve, 1500));
      setCurrentStep('phone_verify');
    } catch (err) {
      setError('Failed to connect with Facebook. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSendOTP = useCallback(async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid phone number.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // STUB: In production, this would send OTP via WhatsApp Business API
      await new Promise(resolve => setTimeout(resolve, 1000));
      setOtpSent(true);
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber]);

  const handleVerifyOTP = useCallback(async () => {
    if (!otpCode || otpCode.length !== 6) {
      setError('Please enter a valid 6-digit OTP.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // STUB: In production, this would verify OTP
      await new Promise(resolve => setTimeout(resolve, 1000));
      setCurrentStep('permissions');
    } catch (err) {
      setError('Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [otpCode]);

  const handleGrantPermissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Call WhatsApp API to link Meta accounts
      const response = await whatsappApi.linkWABA({
        workspace_id: workspaceId,
        waba_id: '', // Will be populated by OAuth flow
        access_token: '', // Will be populated by OAuth flow
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to link accounts.');
      }

      // Fetch phone numbers for the newly linked WABA
      const phoneResponse = await whatsappApi.getPhoneNumbers(workspaceId);

      // Update WABA state with newly linked info
      if (response.waba) {
        setWabaState({
          waba: response.waba,
          phoneNumbers: phoneResponse.phone_numbers || [],
          isLoading: false,
          error: null,
        });

        // Convert to LinkedPage format for success state
        const linkedPages: LinkedPage[] = (phoneResponse.phone_numbers || []).map(phone => ({
          page_id: response.waba!.id,
          page_name: response.waba!.name,
          waba_id: response.waba!.id,
          phone_number_id: phone.id,
        }));
        setLinkedAssets(linkedPages);
        onSuccess?.(linkedPages);
      }

      setCurrentStep('success');
    } catch (err: unknown) {
      // Handle specific error cases
      const apiErr = err as { status?: number; message?: string };
      if (apiErr?.status === 401) {
        setError('Session expired. Please log in again and retry.');
      } else if (apiErr?.status === 429) {
        setError('Too many requests. Please wait a moment and try again.');
      } else {
        const errorMsg = apiErr?.message || (err instanceof Error ? err.message : 'Failed to grant permissions. Please try again.');
        setError(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, onSuccess]);

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    if (currentStep === 'success') {
      // Optionally navigate or reset state
      setCurrentStep('initial');
    }
  }, [currentStep]);

  const handleRetry = useCallback(() => {
    setError(null);
    // Retry from current step
    switch (currentStep) {
      case 'facebook_login':
        handleFacebookLogin();
        break;
      case 'permissions':
        handleGrantPermissions();
        break;
    }
  }, [currentStep, handleFacebookLogin, handleGrantPermissions]);

  // ============================================================
  // Render Functions
  // ============================================================

  const renderStepContent = () => {
    switch (currentStep) {
      case 'facebook_login':
        return (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Facebook className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg">Connect with Facebook</h3>
              <p className="text-muted-foreground text-sm">
                Log in with your Facebook account to connect your WhatsApp Business Account.
              </p>
            </div>

            <Button
              onClick={handleFacebookLogin}
              disabled={isLoading}
              className="w-full bg-[#1877F2] hover:bg-[#166FE5]"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Facebook className="w-4 h-4 mr-2" />
              )}
              Continue with Facebook
            </Button>
          </div>
        );

      case 'phone_verify':
        return (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Phone className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg">Verify Phone Number</h3>
              <p className="text-muted-foreground text-sm">
                Enter the WhatsApp Business phone number you want to use for ads.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={otpSent}
                  aria-describedby="phone-hint"
                />
                <p id="phone-hint" className="text-xs text-muted-foreground">
                  Include country code (e.g., +1 for US, +91 for India)
                </p>
              </div>

              {!otpSent ? (
                <Button
                  onClick={handleSendOTP}
                  disabled={isLoading || !phoneNumber}
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4 mr-2" />
                  )}
                  Send Verification Code
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp">Verification Code</Label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      aria-describedby="otp-hint"
                    />
                    <p id="otp-hint" className="text-xs text-muted-foreground">
                      Enter the 6-digit code sent to your WhatsApp
                    </p>
                  </div>

                  <Button
                    onClick={handleVerifyOTP}
                    disabled={isLoading || otpCode.length !== 6}
                    className="w-full"
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Verify Code
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => setOtpSent(false)}
                    className="w-full"
                  >
                    Use different number
                  </Button>
                </div>
              )}
            </div>
          </div>
        );

      case 'permissions':
        return (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                <Shield className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-lg">Grant Permissions</h3>
              <p className="text-muted-foreground text-sm">
                Allow SocioChat to manage your WhatsApp Business Account for ad campaigns.
              </p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-sm">Permissions requested:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Create and manage Click-to-WhatsApp ads
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Access WhatsApp Business phone number
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  View conversation metrics
                </li>
              </ul>
            </div>

            <Button
              onClick={handleGrantPermissions}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Shield className="w-4 h-4 mr-2" />
              )}
              Grant Permissions
            </Button>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-6 py-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg">Successfully Connected!</h3>
              <p className="text-muted-foreground text-sm">
                Your WhatsApp Business Account is now linked and ready for ads.
              </p>
            </div>

            {linkedAssets.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Linked Assets:</h4>
                <div className="space-y-2">
                  {linkedAssets.map((asset) => (
                    <div
                      key={asset.page_id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-sm">{asset.page_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Page ID: {asset.page_id}
                        </p>
                        {asset.waba_id && (
                          <p className="text-xs text-muted-foreground">
                            WABA ID: {asset.waba_id}
                          </p>
                        )}
                        {asset.phone_number_id && (
                          <p className="text-xs text-muted-foreground">
                            Phone ID: {asset.phone_number_id}
                          </p>
                        )}
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={() => navigate(`/dashboard/campaign/create`)}
                className="flex-1"
              >
                Create CTWA Ad
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ============================================================
  // Loading State while checking existing WABA
  // ============================================================
  if (wabaState.isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-green-500" />
              WhatsApp Business Status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-green-500" />
              <span className="text-muted-foreground">Checking WhatsApp Business Account status...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================
  // Existing WABA Connected State
  // ============================================================
  if (wabaState.waba) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-green-500" />
              WhatsApp Business Connected
            </CardTitle>
            <CardDescription>
              Your WhatsApp Business Account is linked and ready to create Click-to-WhatsApp ads.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* WABA Info */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <h4 className="font-semibold text-green-900">{wabaState.waba.name || 'WhatsApp Business Account'}</h4>
                  </div>
                  <p className="text-sm text-green-700">WABA ID: {wabaState.waba.id}</p>
                  {wabaState.waba.status && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      {wabaState.waba.status}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/dashboard/settings/integrations')}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Phone Numbers */}
            {wabaState.phoneNumbers.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Linked Phone Numbers
                </h4>
                <div className="space-y-2">
                  {wabaState.phoneNumbers.map((phone) => (
                    <div
                      key={phone.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-sm">{phone.display_phone_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {phone.verified_name || 'WhatsApp Business'}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {phone.quality_rating?.toLowerCase() || 'Active'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Button
                onClick={() => navigate('/dashboard/campaign/create')}
                className="w-full"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Create CTWA Ad
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard/templates')}
                className="w-full"
              >
                <FileText className="w-4 h-4 mr-2" />
                Manage Templates
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/dashboard/test')}
                className="w-full"
              >
                <Send className="w-4 h-4 mr-2" />
                Test Messages
              </Button>
            </div>

            {/* Feature Cards */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <MessageCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <h4 className="font-medium text-sm">Direct Conversations</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Connect with customers instantly via WhatsApp
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <Shield className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <h4 className="font-medium text-sm">Verified Business</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Show your verified business profile
                </p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <CheckCircle2 className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                <h4 className="font-medium text-sm">Higher Conversions</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  90%+ open rates on WhatsApp messages
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ============================================================
  // No WABA Connected - Show Setup Flow
  // ============================================================
  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-green-500" />
            Connect WhatsApp Business
          </CardTitle>
          <CardDescription>
            Link your WhatsApp Business Account to create Click-to-WhatsApp ads and
            engage with customers directly on WhatsApp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <MessageCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <h4 className="font-medium text-sm">Direct Conversations</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Connect with customers instantly via WhatsApp
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <Shield className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <h4 className="font-medium text-sm">Verified Business</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Show your verified business profile
              </p>
            </div>
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <CheckCircle2 className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <h4 className="font-medium text-sm">Higher Conversions</h4>
              <p className="text-xs text-muted-foreground mt-1">
                90%+ open rates on WhatsApp messages
              </p>
            </div>
          </div>

          <Button onClick={handleStartSetup} className="w-full" size="lg">
            <MessageCircle className="w-5 h-5 mr-2" />
            Connect WhatsApp Business Account
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent
          className="sm:max-w-md"
          aria-describedby="setup-dialog-description"
        >
          <DialogHeader>
            <DialogTitle>WhatsApp Business Setup</DialogTitle>
            <DialogDescription id="setup-dialog-description">
              Follow the steps to connect your WhatsApp Business Account.
            </DialogDescription>
          </DialogHeader>

          {currentStep !== 'initial' && currentStep !== 'success' && (
            <StepIndicator
              currentStep={stepNumber[currentStep]}
              totalSteps={4}
              stepLabels={stepLabels}
            />
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="flex items-center justify-between">
                <span>{error}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="ml-2"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {renderStepContent()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmbeddedSignupStub;
