// Onboarding status labels and messages (Tech Provider hardening)
export type OnboardingStatus =
  | 'PENDING'
  | 'ASSET_SHARING_PENDING'
  | 'WABA_NOT_VISIBLE'
  | 'PHONE_NOT_VISIBLE'
  | 'SUBSCRIPTION_PENDING'
  | 'ACTIVE'
  | 'FAILED'
  | 'RECONNECT_REQUIRED';

export const ONBOARDING_STATUS_LABELS: Record<OnboardingStatus, string> = {
  PENDING: 'Portfolio Linking Pending',
  ASSET_SHARING_PENDING: 'Asset Sharing Pending',
  WABA_NOT_VISIBLE: 'WABA Not Visible',
  PHONE_NOT_VISIBLE: 'Phone Number Not Visible',
  SUBSCRIPTION_PENDING: 'Subscription Pending',
  ACTIVE: 'Connected Successfully',
  FAILED: 'Setup Failed',
  RECONNECT_REQUIRED: 'Reconnect Required',
};

/** Customer-safe messages mirroring backend onboarding_status.USER_MESSAGES (Phase 12) */
export const USER_MESSAGES: Record<string, string> = {
  missing_permissions:
    'We were unable to access your WhatsApp Business assets due to missing permissions or incomplete Meta Business setup. Please reconnect your WhatsApp account and ensure all requested permissions are granted.',
  incomplete_onboarding:
    'Your WhatsApp setup is incomplete. Please reconnect and complete all onboarding steps.',
  missing_business_access:
    'We cannot access the selected WhatsApp Business Account. Please ensure you have administrator access and reconnect.',
  asset_sharing_incomplete:
    'Asset sharing is incomplete. Please reconnect and share your WhatsApp Business Account with SocioChat during setup.',
  waba_not_visible:
    'We cannot see your WhatsApp Business Account yet. Meta may still be processing setup — we will retry automatically, or you can reconnect.',
  phone_not_visible:
    'We cannot see your WhatsApp phone number yet. Please ensure the number is added to your WABA and reconnect if needed.',
  subscription_failed:
    'Webhook subscription could not be completed. We will retry automatically, or please reconnect.',
  reconnect_required:
    'Please reconnect your WhatsApp account to complete setup and grant the required permissions.',
  portfolio_not_linked:
    'Your Meta Business Portfolio is not linked. Please complete Business Portfolio linking during Embedded Signup and reconnect.',
};

export function userMessageForStatus(
  status?: string | null,
  technicalError?: string | null
): string {
  if (!status) return USER_MESSAGES.incomplete_onboarding;
  if (status === 'RECONNECT_REQUIRED') return USER_MESSAGES.reconnect_required;
  if (status === 'ASSET_SHARING_PENDING') return USER_MESSAGES.asset_sharing_incomplete;
  if (status === 'WABA_NOT_VISIBLE') return USER_MESSAGES.waba_not_visible;
  if (status === 'PHONE_NOT_VISIBLE') return USER_MESSAGES.phone_not_visible;
  if (status === 'SUBSCRIPTION_PENDING') return USER_MESSAGES.subscription_failed;
  if (technicalError) {
    const lower = technicalError.toLowerCase();
    if (lower.includes('permission') || lower.includes('scope')) {
      return USER_MESSAGES.missing_permissions;
    }
    if (lower.includes('portfolio') || lower.includes('business')) {
      return USER_MESSAGES.portfolio_not_linked;
    }
    if (lower.includes('waba')) {
      return USER_MESSAGES.missing_business_access;
    }
  }
  return USER_MESSAGES.incomplete_onboarding;
}

export function isOnboardingComplete(status?: string | null): boolean {
  return status === 'ACTIVE';
}

export function isOnboardingPending(status?: string | null): boolean {
  if (!status) return false;
  return !isOnboardingComplete(status) && status !== 'FAILED' && status !== 'RECONNECT_REQUIRED';
}

/** True when account should be treated as fully connected in UI */
export function isAccountFullyConnected(
  account?: { is_active?: boolean; onboarding_status?: string | null } | null
): boolean {
  if (!account) return false;
  if (!account.is_active) return false;
  const status = account.onboarding_status;
  if (!status) return true; // legacy rows before migration
  return status === 'ACTIVE';
}

export function needsReconnect(status?: string | null): boolean {
  return status === 'RECONNECT_REQUIRED' || status === 'FAILED';
}
