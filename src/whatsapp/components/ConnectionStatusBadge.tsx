// Connection Status Badge Component
// ==================================
// Shows connection / onboarding status and token type

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, AlertTriangle, Loader2, Link2 } from 'lucide-react';
import {
  ONBOARDING_STATUS_LABELS,
  type OnboardingStatus,
  isOnboardingComplete,
} from '../constants/onboardingStatus';

interface ConnectionStatusBadgeProps {
  isActive: boolean;
  tokenType: string;
  onboardingStatus?: string | null;
}

export function ConnectionStatusBadge({
  isActive,
  tokenType,
  onboardingStatus,
}: ConnectionStatusBadgeProps) {
  const status = onboardingStatus as OnboardingStatus | undefined;

  if (status && !isOnboardingComplete(status)) {
    if (status === 'RECONNECT_REQUIRED' || status === 'FAILED') {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <Link2 className="w-3 h-3" />
          {ONBOARDING_STATUS_LABELS[status]}
        </Badge>
      );
    }
    if (status === 'SUBSCRIPTION_PENDING' || status === 'PENDING') {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          {ONBOARDING_STATUS_LABELS[status]}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="flex items-center gap-1 border-amber-500 text-amber-700">
        <AlertTriangle className="w-3 h-3" />
        {ONBOARDING_STATUS_LABELS[status]}
      </Badge>
    );
  }

  if (!isActive) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        Inactive
      </Badge>
    );
  }

  if (tokenType === 'permanent') {
    return (
      <Badge variant="default" className="flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" />
        Connected
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="flex items-center gap-1">
      <Clock className="w-3 h-3" />
      Temporary
    </Badge>
  );
}
