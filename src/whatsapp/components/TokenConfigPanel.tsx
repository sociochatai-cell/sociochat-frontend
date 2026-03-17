// Token Configuration Panel
// =========================
// Manages WhatsApp API credentials in localStorage

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Save, RefreshCw } from 'lucide-react';
import { STORAGE_KEYS, type WhatsAppConfig } from '../types';
import { healthCheck } from '../api';

interface TokenConfigPanelProps {
  config: WhatsAppConfig;
  onConfigChange: (config: WhatsAppConfig) => void;
}

export default function TokenConfigPanel({ config, onConfigChange }: TokenConfigPanelProps) {
  const [showToken, setShowToken] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');

  // Load from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '';
    const savedPhoneId = localStorage.getItem(STORAGE_KEYS.PHONE_NUMBER_ID) || '';
    const savedWabaId = localStorage.getItem(STORAGE_KEYS.WABA_ID) || '';
    const savedVersion = localStorage.getItem(STORAGE_KEYS.API_VERSION) || 'v22.0';
    
    if (savedToken || savedPhoneId) {
      onConfigChange({
        accessToken: savedToken,
        phoneNumberId: savedPhoneId,
        wabaId: savedWabaId,
        apiVersion: savedVersion,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, config.accessToken);
    localStorage.setItem(STORAGE_KEYS.PHONE_NUMBER_ID, config.phoneNumberId);
    localStorage.setItem(STORAGE_KEYS.WABA_ID, config.wabaId || '');
    localStorage.setItem(STORAGE_KEYS.API_VERSION, config.apiVersion);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleTestConnection = async () => {
    if (!config.accessToken) {
      setConnectionStatus('error');
      return;
    }
    
    setIsChecking(true);
    try {
      const result = await healthCheck(config.accessToken);
      setConnectionStatus(result.status === 'ok' ? 'connected' : 'error');
    } catch {
      setConnectionStatus('error');
    } finally {
      setIsChecking(false);
    }
  };

  const updateField = (field: keyof WhatsAppConfig, value: string) => {
    onConfigChange({ ...config, [field]: value });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">🔐 Authentication & Meta Config</CardTitle>
            <CardDescription>
              Configure your WhatsApp Cloud API credentials
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {connectionStatus === 'connected' && (
              <Badge variant="default" className="bg-green-500">Connected</Badge>
            )}
            {connectionStatus === 'error' && (
              <Badge variant="destructive">Error</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Access Token */}
        <div className="space-y-2">
          <Label htmlFor="accessToken" className="flex items-center gap-2">
            Access Token
            <span className="text-xs text-muted-foreground">(Temporary - 1 hour)</span>
          </Label>
          <div className="relative">
            <Textarea
              id="accessToken"
              value={config.accessToken}
              onChange={(e) => updateField('accessToken', e.target.value)}
              placeholder="Paste your WhatsApp Cloud API access token..."
              className="pr-10 font-mono text-xs min-h-[80px]"
              style={{ fontFamily: 'monospace' }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-2 top-2"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {!showToken && config.accessToken && (
            <p className="text-xs text-muted-foreground">
              Token hidden. {config.accessToken.length} characters.
            </p>
          )}
        </div>

        {/* Phone Number ID & WABA ID */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumberId">Phone Number ID *</Label>
            <Input
              id="phoneNumberId"
              value={config.phoneNumberId}
              onChange={(e) => updateField('phoneNumberId', e.target.value)}
              placeholder="e.g., 945507418635325"
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wabaId">
              WABA ID <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="wabaId"
              value={config.wabaId || ''}
              onChange={(e) => updateField('wabaId', e.target.value)}
              placeholder="WhatsApp Business Account ID"
              className="font-mono"
            />
          </div>
        </div>

        {/* API Version */}
        <div className="space-y-2">
          <Label htmlFor="apiVersion">API Version</Label>
          <Input
            id="apiVersion"
            value={config.apiVersion}
            onChange={(e) => updateField('apiVersion', e.target.value)}
            placeholder="v22.0"
            className="font-mono w-32"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2">
          <Button onClick={handleSave} size="sm" variant="outline">
            <Save className="h-4 w-4 mr-2" />
            {isSaved ? 'Saved!' : 'Save to Browser'}
          </Button>
          <Button 
            onClick={handleTestConnection} 
            size="sm" 
            variant="secondary"
            disabled={isChecking || !config.accessToken}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
            Test Connection
          </Button>
        </div>

        {/* Helper text */}
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-md">
          <p className="font-medium mb-1">⚠️ Token is stored in browser localStorage only</p>
          <p>Get a temporary token from: Meta Developer Console → WhatsApp → API Setup</p>
        </div>
      </CardContent>
    </Card>
  );
}
