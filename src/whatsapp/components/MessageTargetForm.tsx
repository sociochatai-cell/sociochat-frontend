// Message Target Form
// ====================
// Phone number input with E.164 validation

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Phone, AlertCircle } from 'lucide-react';

interface MessageTargetFormProps {
  phoneNumberId: string;
  toNumber: string;
  onToNumberChange: (value: string) => void;
}

export default function MessageTargetForm({
  phoneNumberId,
  toNumber,
  onToNumberChange,
}: MessageTargetFormProps) {
  const [error, setError] = useState<string | null>(null);

  // Validate E.164 format (only digits, optional + at start)
  const validatePhoneNumber = (value: string) => {
    // Remove all non-digit characters except +
    const cleaned = value.replace(/[^\d+]/g, '');
    
    // Check if it starts with + or is all digits
    if (cleaned.length === 0) {
      setError(null);
      return cleaned;
    }
    
    // Remove + for digit-only validation
    const digitsOnly = cleaned.replace('+', '');
    
    if (!/^\d+$/.test(digitsOnly)) {
      setError('Only digits allowed');
    } else if (digitsOnly.length < 10) {
      setError('Phone number too short');
    } else if (digitsOnly.length > 15) {
      setError('Phone number too long');
    } else {
      setError(null);
    }
    
    return digitsOnly; // Return digits only (E.164 without +)
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const validated = validatePhoneNumber(e.target.value);
    onToNumberChange(validated);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">👤 Message Target</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* From (read-only) */}
        <div className="space-y-2">
          <Label className="text-muted-foreground">From Phone Number ID</Label>
          <div className="flex items-center gap-2">
            <Input
              value={phoneNumberId || 'Not configured'}
              disabled
              className="font-mono bg-muted"
            />
            {phoneNumberId && (
              <Badge variant="outline" className="shrink-0">
                <Phone className="h-3 w-3 mr-1" />
                Sender
              </Badge>
            )}
          </div>
        </div>

        {/* To */}
        <div className="space-y-2">
          <Label htmlFor="toNumber">
            To Phone Number *
            <span className="text-xs text-muted-foreground ml-2">E.164 format</span>
          </Label>
          <div className="relative">
            <Input
              id="toNumber"
              value={toNumber}
              onChange={handleChange}
              placeholder="919876543210"
              className={`font-mono ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            />
          </div>
          {error && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Enter full number with country code. Example: 919876543210 (India)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
