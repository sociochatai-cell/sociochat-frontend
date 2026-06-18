import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, User, RefreshCw, CheckCircle, XCircle, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { API_BASE_URL } from '@/config';
import { cachedFetch } from '../../utils/waPersistentCache';
import { cn } from '@/lib/utils';
import { BookingSettingsPanel } from './BookingSettingsPanel';

const API_PREFIX = `${API_BASE_URL}/api/whatsapp/bookings`;

interface BookingItem { id: number; wa_id: string; booking_date: string; booking_time: string; service_type: string | null; customer_name: string | null; status: string; }
interface SlotItem { id: number; slot_time: string; max_capacity: number; current_bookings: number; is_blocked: boolean; is_full: boolean; }

export function BookingsTab({ accountId }: { accountId: string | null }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const fetch_ = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    try {
      const [bR, sR, aR] = await Promise.all([
        cachedFetch(`${API_PREFIX}?account_id=${accountId}&date=${date}`, { credentials: 'include' }),
        cachedFetch(`${API_PREFIX}/slots/capacity?account_id=${accountId}&date=${date}`, { credentials: 'include' }),
        cachedFetch(`${API_PREFIX}/analytics?account_id=${accountId}&days=30`, { credentials: 'include' }),
      ]);
      const [bJ, sJ, aJ] = await Promise.all([bR.json(), sR.json(), aR.json()]);
      if (bJ.success) setBookings(bJ.bookings || []);
      if (sJ.success) setSlots(sJ.slots || []);
      if (aJ.success) setAnalytics(aJ);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [accountId, date]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const action = async (id: number, act: 'cancel' | 'complete') => {
    try {
      await cachedFetch(`${API_PREFIX}/${id}/${act}`, {
        method: 'PUT',
        credentials: 'include',
        ...(act === 'cancel' ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'Admin cancelled' }) } : {}),
      });
      fetch_();
    } catch { /* ignore */ }
  };

  const shift = (d: number) => { const dt = new Date(date); dt.setDate(dt.getDate() + d); setDate(dt.toISOString().slice(0, 10)); };
  const sb = (s: string) => ({ confirmed: 'bg-green-500/10 text-green-600', cancelled: 'bg-red-500/10 text-red-600', completed: 'bg-blue-500/10 text-blue-600' }[s] || 'bg-muted text-muted-foreground');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)}><ChevronLeft className="w-4 h-4" /></Button>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-40 h-8" />
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)}><ChevronRight className="w-4 h-4" /></Button>
        <Button variant="outline" size="sm" className="h-8" onClick={() => setDate(new Date().toISOString().slice(0, 10))}>Today</Button>
        <Button variant={showSettings ? 'default' : 'outline'} size="sm" className="h-8 ml-auto gap-1" onClick={() => setShowSettings(v => !v)}><Settings className="w-3.5 h-3.5" />{showSettings ? 'Back' : 'Configure'}</Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={fetch_}><RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} /></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { l: 'Today', v: analytics.today_bookings ?? 0, c: 'from-primary/15' },
          { l: '30d Total', v: analytics.total_bookings ?? 0, c: 'from-blue-500/15' },
          { l: 'Confirmed', v: analytics.confirmed ?? 0, c: 'from-green-500/15' },
          { l: 'Cancel Rate', v: `${analytics.cancellation_rate ?? 0}%`, c: 'from-red-500/15' },
        ].map(({ l, v, c }) => (
          <Card key={l} className={cn("bg-gradient-to-br", c, "to-transparent")}><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{l}</p><p className="text-xl font-bold">{v}</p>
          </CardContent></Card>
        ))}
      </div>

      {showSettings ? <BookingSettingsPanel accountId={accountId} /> :
      loading ? <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-primary" /></div> : (
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary" />Slots</CardTitle></CardHeader>
            <CardContent className="space-y-1.5">
              {slots.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">No slots configured. Set business hours first.</p> :
                slots.map(s => (
                  <div key={s.id} className={cn("flex items-center justify-between py-1.5 px-2.5 rounded-md border text-sm",
                    s.is_blocked ? "bg-red-500/5 border-red-500/20" : s.is_full ? "bg-amber-500/5 border-amber-500/20" : "bg-green-500/5 border-green-500/20"
                  )}>
                    <span className="font-medium text-xs">{s.slot_time}</span>
                    <span className="text-[10px] text-muted-foreground">{s.current_bookings}/{s.max_capacity}</span>
                  </div>
                ))
              }
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1.5"><User className="w-4 h-4 text-primary" />Bookings ({bookings.length})</CardTitle></CardHeader>
            <CardContent>
              {bookings.length === 0 ? <div className="text-center py-6 text-muted-foreground"><Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No bookings for this date</p></div> :
                <div className="space-y-2">
                  {bookings.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center"><User className="w-4 h-4 text-primary" /></div>
                        <div>
                          <p className="text-sm font-medium">{b.customer_name || b.wa_id}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{b.booking_time}{b.service_type && ` · ${b.service_type}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={cn("text-xs", sb(b.status))}>{b.status}</Badge>
                        {b.status === 'confirmed' && <>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => action(b.id, 'complete')}><CheckCircle className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" onClick={() => action(b.id, 'cancel')}><XCircle className="w-3.5 h-3.5" /></Button>
                        </>}
                      </div>
                    </div>
                  ))}
                </div>
              }
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
