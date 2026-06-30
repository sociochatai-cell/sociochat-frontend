import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings } from 'lucide-react';
import { BookingSettingsPanel } from './FlowOS/BookingSettingsPanel';
import { getWorkspaceId } from '../utils/workspaceContext';
import { useWhatsAppConnection } from '../hooks/useWhatsAppData';

export function BookingSettings() {
  const navigate = useNavigate();
  const workspaceId = getWorkspaceId();

  // Retrieve WABA connection information to get account id
  const { data: connectionData } = useWhatsAppConnection(workspaceId || '');

  const accountId = useMemo(() => {
    if (!connectionData || connectionData.status !== 'CONNECTED') {
      return localStorage.getItem('selectedAccountId') || '1';
    }
    return String(connectionData.account_summary?.id || '1');
  }, [connectionData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Booking & Slots Settings
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure business hours, slot durations, capacity caps, and block holidays.
            </p>
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="bg-card border rounded-xl p-4 md:p-6 shadow-sm">
          <BookingSettingsPanel accountId={accountId} />
        </div>
      </div>
    </div>
  );
}

export default BookingSettings;
