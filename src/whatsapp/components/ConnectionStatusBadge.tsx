// Connection Status Badge Component
// ==================================
// Shows connection status and token type

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';

interface ConnectionStatusBadgeProps {
  isActive: boolean;
  tokenType: string;
}

export function ConnectionStatusBadge({ isActive, tokenType }: ConnectionStatusBadgeProps) {
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

