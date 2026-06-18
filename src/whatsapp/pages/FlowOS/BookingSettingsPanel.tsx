import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Settings, Clock, CalendarOff, Save, Trash2, Plus, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { cachedFetch } from '../../utils/waPersistentCache';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const API_PREFIX = `${API_BASE_URL}/api/whatsapp/bookings`;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface BizHour { id?: number; day_of_week: number; day_name: string; open_time: string; close_time: string; slot_duration_minutes: number; max_bookings_per_slot: number; max_bookings_per_day: number | null; is_active: boolean; }
interface BlockedDateItem { id: number; blocked_date: string; reason: string | null; }

export function BookingSettingsPanel({ accountId }: { accountId: string | null }) {
  const { toast } = useToast();
  const [hours, setHours] = useState<BizHour[]>([]);
  const [blocked, setBlocked] = useState<BlockedDateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');

  const fetchData = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [hR, bR] = await Promise.all([
        cachedFetch(`${API_PREFIX}/business-hours?account_id=${accountId}`, { credentials: 'include' }),
        cachedFetch(`${API_PREFIX}/blocked-dates?account_id=${accountId}`, { credentials: 'include' }),
      ]);
      const [hJ, bJ] = await Promise.all([hR.json(), bR.json()]);

      if (hJ.success && hJ.hours?.length > 0) {
        setHours(hJ.hours);
      } else {
        setHours(DAYS.map((name, i) => ({
          day_of_week: i, day_name: name,
          open_time: '09:00', close_time: '17:00',
          slot_duration_minutes: 30,
          max_bookings_per_slot: 1, max_bookings_per_day: null,
          is_active: i < 5,
        })));
      }
      if (bJ.success) setBlocked(bJ.dates || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [accountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateHour = (idx: number, field: keyof BizHour, value: unknown) => {
    setHours(prev => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h));
  };

  const saveHours = async () => {
    if (!accountId) return;
    setSaving(true);
    try {
      const res = await cachedFetch(`${API_PREFIX}/business-hours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ account_id: parseInt(accountId), hours }),
      });
      const j = await res.json();
      if (j.success) {
        toast({ title: 'Saved', description: `Updated ${j.hours?.length || 0} business hour entries` });
        fetchData();
      } else {
        toast({ title: 'Error', description: j.error || 'Failed to save', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const addBlockedDate = async () => {
    if (!accountId || !newBlockDate) return;
    try {
      const res = await cachedFetch(`${API_PREFIX}/blocked-dates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ account_id: parseInt(accountId), date: newBlockDate, reason: newBlockReason || 'Closed' }),
      });
      const j = await res.json();
      if (j.success) {
        setNewBlockDate(''); setNewBlockReason('');
        toast({ title: 'Date blocked' });
        fetchData();
      } else {
        toast({ title: 'Error', description: j.error, variant: 'destructive' });
      }
    } catch { /* ignore */ }
  };

  const removeBlock = async (id: number) => {
    try {
      await cachedFetch(`${API_PREFIX}/blocked-dates/${id}`, { method: 'DELETE', credentials: 'include' });
      fetchData();
    } catch { /* ignore */ }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary" /> Business Hours & Slot Duration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {hours.map((h, i) => (
            <div key={h.day_of_week} className={cn(
              "grid grid-cols-[60px_1fr_80px_60px_50px] gap-2 items-center py-1.5 px-2 rounded-md border text-sm",
              h.is_active ? "bg-green-500/5 border-green-500/15" : "bg-muted/30 border-transparent opacity-60"
            )}>
              <span className="font-medium">{h.day_name.slice(0, 3)}</span>
              <div className="flex items-center gap-1">
                <Input type="time" value={h.open_time} onChange={e => updateHour(i, 'open_time', e.target.value)} className="h-7 text-xs" disabled={!h.is_active} />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="time" value={h.close_time} onChange={e => updateHour(i, 'close_time', e.target.value)} className="h-7 text-xs" disabled={!h.is_active} />
              </div>
              <Input type="number" min={5} value={h.slot_duration_minutes} onChange={e => updateHour(i, 'slot_duration_minutes', parseInt(e.target.value) || 30)} className="h-7 text-xs" disabled={!h.is_active} />
              <Input type="number" min={1} value={h.max_bookings_per_slot || 1} onChange={e => updateHour(i, 'max_bookings_per_slot', parseInt(e.target.value) || 1)} className="h-7 text-xs" disabled={!h.is_active} />
              <Switch checked={h.is_active} onCheckedChange={v => updateHour(i, 'is_active', v)} />
            </div>
          ))}
          <Button onClick={saveHours} disabled={saving} className="w-full mt-3 gap-1.5" size="sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Business Hours
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <CalendarOff className="w-4 h-4 text-red-500" /> Blocked Dates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input type="date" value={newBlockDate} onChange={e => setNewBlockDate(e.target.value)} className="h-8 flex-1" />
            <Input placeholder="Reason (optional)" value={newBlockReason} onChange={e => setNewBlockReason(e.target.value)} className="h-8 flex-1" />
            <Button size="sm" className="h-8 gap-1" onClick={addBlockedDate} disabled={!newBlockDate}>
              <Plus className="w-3.5 h-3.5" /> Block
            </Button>
          </div>
          {blocked.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No blocked dates</p>
          ) : (
            <div className="space-y-1">
              {blocked.map(b => (
                <div key={b.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-md border border-red-500/15 bg-red-500/5">
                  <Badge variant="outline" className="bg-red-500/10 text-red-600 text-xs">{b.blocked_date}</Badge>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => removeBlock(b.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
