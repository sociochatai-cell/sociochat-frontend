/**
 * AutoRenewManager — view + cancel the recurring subscription (PayU autopay).
 * Self-contained: fetches GET /api/payments/autopay and cancels via
 * POST /api/payments/autopay/cancel. Mount it on the Subscription page.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '@/config';
import { authHeaders } from '@/lib/payu';

interface Mandate {
  status: string;
  plan_slug: string;
  amount: number;
  currency: string;
  next_charge_at: string | null;
  active: boolean;
}

const AutoRenewManager: React.FC = () => {
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/autopay`, {
        credentials: 'include', headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      setMandate(data?.autopay || null);
    } catch { setMandate(null); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cancel = async () => {
    if (!confirm('Turn off auto-renew? Your current plan stays active until it expires; it just won\'t renew automatically.')) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/autopay/cancel`, {
        method: 'POST', credentials: 'include', headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.success) await load();
      else alert(data?.message || 'Could not cancel auto-renew.');
    } finally { setBusy(false); }
  };

  if (loading) return null;

  const on = mandate && ['active', 'pending_registration', 'paused'].includes(mandate.status);
  const nextDate = mandate?.next_charge_at ? new Date(mandate.next_charge_at).toLocaleDateString() : null;

  return (
    <div className="rounded-xl border bg-white p-4 flex items-center justify-between gap-4">
      <div>
        <div className="font-semibold flex items-center gap-2">
          Auto-renew
          <span className={`text-xs px-2 py-0.5 rounded-full ${on ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {on ? 'ON' : 'OFF'}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {on
            ? <>Renews the <b>{mandate!.plan_slug}</b> plan automatically{nextDate ? <> — next charge <b>{nextDate}</b></> : ''} (₹{mandate!.amount}/period).</>
            : <>Off — choose a plan with <b>auto-renew</b> at checkout to enable automatic monthly billing.</>}
        </p>
      </div>
      {on && (
        <button onClick={cancel} disabled={busy}
          className="text-sm px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 whitespace-nowrap">
          {busy ? 'Cancelling…' : 'Turn off'}
        </button>
      )}
    </div>
  );
};

export default AutoRenewManager;
