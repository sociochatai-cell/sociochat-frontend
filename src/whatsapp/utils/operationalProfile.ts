import type {
  CapabilityMatrixEntry,
  WhatsAppAccountStatusPayload,
  WhatsAppStatusCheck,
} from '@/components/WhatsAppAccountStatusPopup';

export type ConnectionAuthorityMode = 'APP_OWNED' | 'CLIENT_SHARED' | 'CLIENT_DIRECT';

export interface LimitedFeature {
  id: string;
  label: string;
  description: string;
}

export interface RoadmapStep {
  id: string;
  title: string;
  description: string;
  optional?: boolean;
}

export interface OperationalProfile {
  mode: ConnectionAuthorityMode;
  modeLabel: string;
  modeDescription: string;
  canSendMessages: boolean;
  canReceiveMessages: boolean;
  tokenType?: string;
  wabaOwnership?: string;
  limitedFeatures: LimitedFeature[];
  workingFeatures: { id: string; label: string }[];
  roadmap: RoadmapStep[];
  hints: string[];
}

const MODE_META: Record<
  ConnectionAuthorityMode,
  { label: string; description: string }
> = {
  APP_OWNED: {
    label: 'App-owned (Embedded Signup)',
    description:
      'Number onboarded through Sociovia. Meta usually grants full Cloud API messaging authority.',
  },
  CLIENT_SHARED: {
    label: 'Client-shared (Partner WABA)',
    description:
      'Client owns the WABA and shared it with Sociovia. A System User token from Sociovia Business Manager is required for reliable outbound messaging.',
  },
  CLIENT_DIRECT: {
    label: 'Client-linked (Facebook Login only)',
    description:
      'Personal Facebook token linked the account. Meta often allows inbox and webhooks but blocks outbound send on partner/client-owned WABAs.',
  },
};

function getSendCheck(checks?: WhatsAppStatusCheck[]) {
  return checks?.find((c) => c.name === 'messaging_send_permission' || c.name === 'send_permission');
}

function canSendFromMatrix(matrix?: Record<string, CapabilityMatrixEntry>): boolean {
  const cap = matrix?.can_send_messages;
  if (cap && typeof cap.enabled === 'boolean') return cap.enabled;
  return false;
}

export function deriveOperationalProfile(
  payload: WhatsAppAccountStatusPayload | null
): OperationalProfile | null {
  if (!payload) return null;

  const sendCheck = getSendCheck(payload.checks);
  const details = (sendCheck?.details || {}) as Record<string, unknown>;
  const tokenType = String(details.token_type || '').toUpperCase() || undefined;
  const wabaOwnership = String(details.waba_ownership_type || '').toUpperCase() || undefined;
  const hints = Array.isArray(details.hints) ? (details.hints as string[]) : [];

  const canSend =
    sendCheck?.status === 'healthy' ||
    canSendFromMatrix(payload.capabilityMatrix) ||
    false;

  const isClientOwned = wabaOwnership === 'CLIENT_OWNED';
  const isUserToken = tokenType === 'USER';

  let mode: ConnectionAuthorityMode = 'APP_OWNED';
  if (isClientOwned && isUserToken) {
    mode = 'CLIENT_DIRECT';
  } else if (isClientOwned) {
    mode = 'CLIENT_SHARED';
  } else if (isUserToken && !canSend) {
    mode = 'CLIENT_DIRECT';
  } else if (!canSend && payload.connectionStatus === 'CONNECTED') {
    mode = 'CLIENT_SHARED';
  }

  const limitedFeatures: LimitedFeature[] = [];
  const workingFeatures: { id: string; label: string }[] = [
    { id: 'inbox', label: 'Incoming messages & inbox' },
    { id: 'metadata', label: 'Account metadata & health checks' },
  ];

  if (!canSend) {
    limitedFeatures.push(
      {
        id: 'outbound',
        label: 'Outbound messages',
        description:
          'Manual replies, bulk sends, and automations that call the send API will fail until Meta grants messaging authority.',
      },
      {
        id: 'templates_send',
        label: 'Template & session sends',
        description: 'Proactive template messages and free-form replies outside the 24h window require send permission.',
      }
    );
  }

  if (payload.capabilityMatrix?.webhook_subscribed?.enabled === false) {
    limitedFeatures.push({
      id: 'webhook_mgmt',
      label: 'Webhook auto-subscription',
      description:
        'Real-time delivery may be degraded until webhook subscription succeeds with a token that has management rights.',
    });
  }

  if (payload.warmupState?.in_warmup_window) {
    limitedFeatures.push({
      id: 'warmup',
      label: 'Broadcast & aggressive automation',
      description: `Warmup active — daily cap ~${payload.warmupState.effective_daily_send_cap ?? 'reduced'}; broadcasts/drips may be blocked.`,
    });
  }

  if (canSend) {
    workingFeatures.push({ id: 'outbound', label: 'Outbound messaging' });
  } else {
    workingFeatures.push({ id: 'webhooks_in', label: 'Webhooks for inbound events (when subscribed)' });
  }

  const roadmap: RoadmapStep[] = [];

  if (!canSend && (mode === 'CLIENT_DIRECT' || mode === 'CLIENT_SHARED')) {
    roadmap.push(
      {
        id: 'partner',
        title: 'Confirm partner access in client Business Manager',
        description:
          'Trusthomes BM → Partners → Sociovia: grant WhatsApp account permissions including messaging on behalf of the WABA.',
      },
      {
        id: 'system_user',
        title: 'Create a System User token in Sociovia Business Manager',
        description:
          'Business Settings → System users → Generate token for app Sociovia.ai, assign the client WABA, scopes: whatsapp_business_messaging & whatsapp_business_management.',
      },
      {
        id: 'manual_reconnect',
        title: 'Reconnect in Sociovia via Manual Connection',
        description: 'Paste WABA ID, Phone Number ID, and the System User permanent token (not a personal Facebook login token).',
      },
      {
        id: 'embedded_alt',
        title: 'Alternative: onboard a new number',
        description: 'Use Embedded Signup only if the client can use a brand-new WhatsApp Business number through Sociovia.',
        optional: true,
      }
    );
  } else if (!canSend) {
    roadmap.push(
      {
        id: 'health',
        title: 'Run health check in WhatsApp Settings',
        description: 'Review messaging_send_permission and follow the listed Meta hints.',
      },
      {
        id: 'token',
        title: 'Update access token',
        description: 'Ensure the token matches app 1782321995750055 and has not expired.',
      }
    );
  }

  if (payload.capabilityMatrix?.business_profile_complete?.enabled === false) {
    roadmap.push({
      id: 'profile',
      title: 'Complete WhatsApp Business profile',
      description: 'Add business email and address in Meta WhatsApp Manager to improve trust signals.',
      optional: true,
    });
  }

  return {
    mode,
    modeLabel: MODE_META[mode].label,
    modeDescription: MODE_META[mode].description,
    canSendMessages: canSend,
    canReceiveMessages: payload.connectionStatus === 'CONNECTED',
    tokenType,
    wabaOwnership,
    limitedFeatures,
    workingFeatures,
    roadmap,
    hints,
  };
}
