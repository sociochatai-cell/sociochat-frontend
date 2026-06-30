/**
 * Booking Dashboard — WhatsApp Flow OS
 * ======================================
 * Calendar view + booking management for appointment flows.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, User, RefreshCw, ArrowLeft, CheckCircle, XCircle, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { WHATSAPP_API_BASE_URL } from '@/config';
import { cachedFetch } from '../utils/waPersistentCache';
import { cn } from '@/lib/utils';

const API_BASE = WHATSAPP_API_BASE_URL;

interface BookingItem {
  id: number;
  wa_id: string;
  booking_date: string;
  booking_time: string;
  service_type: string | null;
  customer_name: string | null;
  status: string;
  booked_at: string;
  conversation_id: number | null;
}

interface SlotItem {
  id: number;
  slot_time: string;
  max_capacity: number;
  current_bookings: number;
  is_blocked: boolean;
  is_full: boolean;
  available: number;
}

export function BookingDashboard() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [slots, setSlots] = useState<SlotItem[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const accountId = 1; // TODO: Get from workspace context

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      const [bookingsRes, slotsRes, analyticsRes] = await Promise.all([
        cachedFetch(`${API_BASE}/api/whatsapp/bookings?account_id=${accountId}&date=${selectedDate}`, { headers, credentials: 'include' }),
        cachedFetch(`${API_BASE}/api/whatsapp/bookings/slots/capacity?account_id=${accountId}&date=${selectedDate}`, { headers, credentials: 'include' }),
        cachedFetch(`${API_BASE}/api/whatsapp/bookings/analytics?account_id=${accountId}&days=30`, { headers, credentials: 'include' }),
      ]);

      const [bJson, sJson, aJson] = await Promise.all([bookingsRes.json(), slotsRes.json(), analyticsRes.json()]);

      if (bJson.success) setBookings(bJson.bookings || []);
      if (sJson.success) setSlots(sJson.slots || []);
      if (aJson.success) setAnalytics(aJson);
    } catch (err) {
      console.error('Failed to fetch booking data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, accountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const cancelBooking = async (bookingId: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await cachedFetch(`${API_BASE}/api/whatsapp/bookings/${bookingId}/cancel`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ reason: 'Cancelled by admin' }),
      });
      const json = await res.json();
      if (json.success) fetchData();
    } catch (err) {
      console.error('Failed to cancel booking:', err);
    }
  };

  const completeBooking = async (bookingId: number) => {
    try {
      const token = localStorage.getItem('token');
      await cachedFetch(`${API_BASE}/api/whatsapp/bookings/${bookingId}/complete`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      fetchData();
    } catch (err) {
      console.error('Failed to complete booking:', err);
    }
  };

  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      confirmed: 'bg-green-500/10 text-green-600 border-green-500/20',
      cancelled: 'bg-red-500/10 text-red-600 border-red-500/20',
      completed: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      no_show: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    };
    return map[status] || 'bg-muted text-muted-foreground';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Booking Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">Manage appointments from WhatsApp Forms</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shiftDate(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-40" />
            <Button variant="outline" size="icon" onClick={() => shiftDate(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}>Today</Button>
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => navigate('/dashboard/whatsapp/bookings/settings')}>
              <Settings className="w-4 h-4" /> Settings
            </Button>
          </div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Today', value: analytics.today_bookings ?? 0, color: 'from-primary/20 to-primary/5' },
            { label: '30-Day Total', value: analytics.total_bookings ?? 0, color: 'from-blue-500/20 to-blue-500/5' },
            { label: 'Confirmed', value: analytics.confirmed ?? 0, color: 'from-green-500/20 to-green-500/5' },
            { label: 'Cancelled', value: analytics.cancelled ?? 0, color: 'from-red-500/20 to-red-500/5' },
            { label: 'Cancel Rate', value: `${analytics.cancellation_rate ?? 0}%`, color: 'from-amber-500/20 to-amber-500/5' },
          ].map(({ label, value, color }) => (
            <Card key={label} className={cn("bg-gradient-to-br", color)}>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold mt-1">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Slot Capacity */}
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Slots — {new Date(selectedDate + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No slots configured</p>
              ) : (
                slots.map(slot => (
                  <div key={slot.id} className={cn(
                    "flex items-center justify-between py-2 px-3 rounded-lg border transition-colors",
                    slot.is_blocked ? "bg-red-500/5 border-red-500/20" :
                    slot.is_full ? "bg-amber-500/5 border-amber-500/20" :
                    "bg-green-500/5 border-green-500/20 hover:bg-green-500/10"
                  )}>
                    <span className="text-sm font-medium">{slot.slot_time}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all",
                            slot.is_full ? "bg-red-500" : slot.current_bookings > 0 ? "bg-amber-500" : "bg-green-500"
                          )}
                          style={{ width: `${slot.max_capacity > 0 ? (slot.current_bookings / slot.max_capacity) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {slot.current_bookings}/{slot.max_capacity}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Bookings List */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Bookings ({bookings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : bookings.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-muted-foreground">
                  <Calendar className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">No bookings for this date</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookings.map(b => (
                    <div key={b.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{b.customer_name || b.wa_id}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />{b.booking_time}
                            {b.service_type && <span>· {b.service_type}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-xs", statusBadge(b.status))}>{b.status}</Badge>
                        {b.status === 'confirmed' && (
                          <>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => completeBooking(b.id)} title="Mark complete">
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => cancelBooking(b.id)} title="Cancel">
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default BookingDashboard;
