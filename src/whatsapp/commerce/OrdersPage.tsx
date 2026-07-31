/**
 * OrdersPage — payment statement / orders list (SocioChat-only, removable).
 * ============================================================================
 * Reads GET /whatsapp/commerce/orders and shows a summary bar + a table of
 * orders with a status filter and refresh. Handles the "feature off" and empty
 * states. Self-contained: delete this file + its route/nav entry to remove it.
 */

import React, { useCallback, useEffect, useState } from "react";
import apiClient from "@/lib/apiClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { IndianRupee, RefreshCw, Loader2, Receipt, CircleSlash } from "lucide-react";

type OrderStatus = "pending" | "paid" | "failed";
type OrderOrigin = "manual" | "auto";

interface Order {
  id: number;
  txnid: string;
  customer_phone: string;
  customer_name?: string;
  amount: number;
  currency: string;
  productinfo?: string;
  status: OrderStatus;
  origin: OrderOrigin;
  conversation_id?: number;
  created_at?: string;
  paid_at?: string;
}

interface OrdersSummary {
  total_collected: number;
  currency: string;
  paid_count: number;
  pending_count: number;
  failed_count: number;
  total_count: number;
}

type StatusFilter = "all" | OrderStatus;

const fmtMoney = (amount: number, currency = "INR") => {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `₹${n.toFixed(2)}`;
  }
};

const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const StatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  if (status === "paid") {
    return <Badge className="bg-green-600 hover:bg-green-600 text-white border-0">Paid</Badge>;
  }
  if (status === "failed") {
    return <Badge className="bg-red-600 hover:bg-red-600 text-white border-0">Failed</Badge>;
  }
  return <Badge className="bg-amber-500 hover:bg-amber-500 text-white border-0">Pending</Badge>;
};

const OrdersPage: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [available, setAvailable] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [summary, setSummary] = useState<OrdersSummary | null>(null);
  const [status, setStatus] = useState<StatusFilter>("all");

  const load = useCallback(async (statusFilter: StatusFilter, silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const res = await apiClient.get(`/whatsapp/commerce/orders${qs}`);
      if (res.ok && res.data?.success) {
        setAvailable(res.data.available !== false);
        setOrders(Array.isArray(res.data.orders) ? res.data.orders : []);
        setSummary(res.data.summary || null);
      } else if (res.data && res.data.available === false) {
        setAvailable(false);
        setOrders([]);
        setSummary(null);
      } else {
        toast({
          title: "Couldn't load orders",
          description: res.data?.message || res.error?.message || "Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(status); }, [status, load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!available) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Card className="border-2 border-dashed">
          <CardContent className="p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <CircleSlash className="w-7 h-7 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Payments not enabled</h2>
            <p className="text-muted-foreground">
              In-chat payments aren't enabled for this workspace. Connect PayU under
              <span className="font-medium"> Settings → Payments</span> to start collecting payments in chat.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-6 w-6 text-emerald-600" /> Payments &amp; Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every PayU order created from your chats, and what's been collected.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => load(status, true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold flex items-center gap-1 text-emerald-600">
              <IndianRupee className="h-5 w-5" />
              {fmtMoney(summary?.total_collected || 0, summary?.currency).replace(/^₹/, "")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{summary?.paid_count ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-500">{summary?.pending_count ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{summary?.failed_count ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders table */}
      <Card>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Receipt className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">
                {status === "all" ? "No orders yet." : `No ${status} orders.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Origin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {fmtDate(o.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{o.customer_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate" title={o.productinfo || ""}>
                        {o.productinfo || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        {fmtMoney(o.amount, o.currency)}
                      </TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{o.origin}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrdersPage;
