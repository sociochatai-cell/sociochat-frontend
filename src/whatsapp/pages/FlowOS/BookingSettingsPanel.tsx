import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Settings, Clock, CalendarOff, Save, Trash2, Plus, Loader2 } from 'lucide-react';
import { WHATSAPP_REST_API_PREFIX } from '@/config';
import { cachedFetch } from '../../utils/waPersistentCache';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface BizHour { id?: number; day_of_week: number; day_name: string; open_time: string; close_time: string; slot_duration_minutes: number; max_bookings_per_slot: number; max_bookings_per_day: number | null; is_active: boolean; }
interface BlockedDateItem { id: number; blocked_date: string; reason: string | null; }

export function BookingSettingsPanel({ accountId }: { accountId: string | null }) {
  const { toast } = useToast();
  const defaultHours: BizHour[] = DAYS.map((name, i) => ({
    day_of_week: i, day_name: name,
    open_time: '09:00', close_time: '17:00',
    slot_duration_minutes: 30,
    max_bookings_per_slot: 1, max_bookings_per_day: null,
    is_active: i < 5,
  }));
  const [hours, setHours] = useState<BizHour[]>(defaultHours);
  const [blocked, setBlocked] = useState<BlockedDateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newBlockDate, setNewBlockDate] = useState('');
  const [newBlockReason, setNewBlockReason] = useState('');

  const fetchData = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const h = { Authorization: `Bearer ${localStorage.getItem('token')}` };
      const [hR, bR] = await Promise.all([
        cachedFetch(`${WHATSAPP_REST_API_PREFIX}/bookings/business-hours?account_id=${accountId}`, { headers: h, credentials: 'include' }),
        cachedFetch(`${WHATSAPP_REST_API_PREFIX}/bookings/blocked-dates?account_id=${accountId}`, { headers: h, credentials: 'include' }),
      ]);
      const [hJ, bJ] = await Promise.all([hR.json(), bR.json()]);

      if (hJ.success && hJ.hours?.length > 0) {
        setHours(hJ.hours);
      } else {
        // Initialize defaults for all 7 days
        setHours(DAYS.map((name, i) => ({
          day_of_week: i, day_name: name,
          open_time: '09:00', close_time: '17:00',
          slot_duration_minutes: 30,
          max_bookings_per_slot: 1, max_bookings_per_day: null,
          is_active: i < 5, // Mon-Fri active by default
        })));
      }
      if (bJ.success) setBlocked(bJ.dates || []);
    } catch { } finally { setLoading(false); }
  }, [accountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateHour = (idx: number, field: keyof BizHour, value: unknown) => {
    setHours(prev => prev.map((h, i) => i === idx ? { ...h, [field]: value } : h));
  };

  const saveHours = async () => {
    if (!accountId) return;
    setSaving(true);
    try {
      const res = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/bookings/business-hours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
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
      const res = await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/bookings/blocked-dates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
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
    } catch { }
  };

  const removeBlock = async (id: number) => {
    try {
      await cachedFetch(`${WHATSAPP_REST_API_PREFIX}/bookings/blocked-dates/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        credentials: 'include',
      });
      fetchData();
    } catch { }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Business Hours */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary" /> Business Hours & Slot Duration
          </CardTitle>
          <p className="text-xs text-muted-foreground">Set when you accept bookings. Slots auto-generate from these hours.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-[60px_minmax(140px,1.5fr)_minmax(90px,1fr)_70px_70px_50px] sm:grid-cols-[80px_minmax(160px,1.5fr)_minmax(100px,1fr)_80px_80px_50px] gap-2 px-2 pb-1 text-[11px] sm:text-xs font-semibold text-muted-foreground">
            <div>Day</div>
            <div>Hours</div>
            <div>Duration</div>
            <div title="Max bookings allowed per time slot">Slot Cap</div>
            <div title="Max bookings allowed for the whole day (optional)">Daily Cap</div>
            <div>Active</div>
          </div>
          {hours.map((h, i) => (
            <div key={h.day_of_week} className={cn(
              "grid grid-cols-[60px_minmax(140px,1.5fr)_minmax(90px,1fr)_70px_70px_50px] sm:grid-cols-[80px_minmax(160px,1.5fr)_minmax(100px,1fr)_80px_80px_50px] gap-2 items-center py-1.5 px-2 rounded-md border",
              h.is_active ? "bg-green-500/5 border-green-500/15" : "bg-muted/30 border-transparent opacity-60"
            )}>
              <span className="text-sm font-medium">{h.day_name.slice(0, 3)}</span>
              <div className="flex items-center gap-1">
                <Input type="time" value={h.open_time} onChange={e => updateHour(i, 'open_time', e.target.value)} className="h-7 text-xs px-1" disabled={!h.is_active} />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="time" value={h.close_time} onChange={e => updateHour(i, 'close_time', e.target.value)} className="h-7 text-xs px-1" disabled={!h.is_active} />
              </div>
              <div className="flex items-center gap-1">
                <Input type="number" min={5} max={240} step={5} value={h.slot_duration_minutes} onChange={e => updateHour(i, 'slot_duration_minutes', parseInt(e.target.value) || 30)} className="h-7 text-xs w-14" disabled={!h.is_active} />
                <span className="text-[10px] text-muted-foreground">min</span>
              </div>
              <Input type="number" min={1} value={h.max_bookings_per_slot || 1} onChange={e => updateHour(i, 'max_bookings_per_slot', parseInt(e.target.value) || 1)} className="h-7 text-xs w-12" disabled={!h.is_active} title="Max bookings per individual time slot" />
              <Input type="number" min={1} value={h.max_bookings_per_day || ''} placeholder="∞" onChange={e => updateHour(i, 'max_bookings_per_day', e.target.value ? parseInt(e.target.value) : null)} className="h-7 text-xs w-12" disabled={!h.is_active} title="Leave blank for unlimited (based on slot count)" />
              <div className="flex justify-end pr-2">
                <Switch checked={h.is_active} onCheckedChange={v => updateHour(i, 'is_active', v)} />
              </div>
            </div>
          ))}
          <Button onClick={saveHours} disabled={saving} className="w-full mt-3 gap-1.5" size="sm">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Business Hours
          </Button>
        </CardContent>
      </Card>

      {/* Blocked Dates */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <CalendarOff className="w-4 h-4 text-red-500" /> Blocked Dates (Holidays / Closures)
          </CardTitle>
          <p className="text-xs text-muted-foreground">Block specific dates — no bookings will be accepted on these days.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add new */}
          <div className="flex gap-2">
            <Input type="date" value={newBlockDate} onChange={e => setNewBlockDate(e.target.value)} className="h-8 flex-1" />
            <Input placeholder="Reason (optional)" value={newBlockReason} onChange={e => setNewBlockReason(e.target.value)} className="h-8 flex-1" />
            <Button size="sm" className="h-8 gap-1" onClick={addBlockedDate} disabled={!newBlockDate}>
              <Plus className="w-3.5 h-3.5" /> Block
            </Button>
          </div>
          {/* List */}
          {blocked.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">No blocked dates</p>
          ) : (
            <div className="space-y-1">
              {blocked.map(b => (
                <div key={b.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-md border border-red-500/15 bg-red-500/5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-red-500/10 text-red-600 text-xs border-red-500/20">
                      {new Date(b.blocked_date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </Badge>
                    {b.reason && <span className="text-xs text-muted-foreground">{b.reason}</span>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700" onClick={() => removeBlock(b.id)}>
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
