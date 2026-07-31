/**
 * RequestPaymentButton — in-chat "Request Payment" (SocioChat-only, removable).
 * ============================================================================
 * Self-contained. Checks payment availability itself (GET payment-config): if
 * PayU is not connected for this workspace (or the tenant isn't SocioChat) it
 * renders nothing. Otherwise it shows a button that opens a dialog to send a
 * PayU payment link for an exact amount into the customer's chat.
 *
 * To remove the feature from the inbox: delete this file + the one import/usage
 * in ConversationThread.tsx.
 */

import React, { useEffect, useState } from "react";
import apiClient from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { IndianRupee, Loader2, CheckCircle2, Copy, Check, ChevronDown, Zap } from "lucide-react";

type AutoMode = "default" | "on" | "off";

interface Props {
  phone?: string;
  conversationId?: number;
  customerName?: string;
}

// Short label for the current per-chat auto mode.
function autoLabel(mode: AutoMode, workspaceDefault: boolean): string {
  if (mode === "on") return "On";
  if (mode === "off") return "Off";
  return `Default (${workspaceDefault ? "on" : "off"})`;
}

const RequestPaymentButton: React.FC<Props> = ({ phone, conversationId, customerName }) => {
  const { toast } = useToast();
  const [available, setAvailable] = useState(false);
  const [connected, setConnected] = useState(false);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);

  // Per-chat auto mode
  const [autoMode, setAutoMode] = useState<AutoMode>("default");
  const [workspaceDefault, setWorkspaceDefault] = useState(false);
  const [autoUpdating, setAutoUpdating] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiClient.get("/whatsapp/commerce/payment-config");
        if (!alive) return;
        // Show the button whenever the feature is enabled for this tenant.
        // If PayU isn't connected yet, we guide the user to Settings on click.
        setAvailable(Boolean(res.ok && res.data?.available));
        setConnected(Boolean(res.data?.config?.connected));
      } catch {
        if (alive) { setAvailable(false); setConnected(false); }
      }
    })();
    return () => { alive = false; };
  }, []);

  // Load the per-chat auto mode once we know the feature is usable for this chat.
  useEffect(() => {
    if (!available || !connected || !conversationId) return;
    let alive = true;
    (async () => {
      try {
        const res = await apiClient.get(`/whatsapp/commerce/chat-auto/${conversationId}`);
        if (!alive) return;
        if (res.ok && res.data?.success) {
          setAutoMode((res.data.mode as AutoMode) || "default");
          setWorkspaceDefault(Boolean(res.data.workspace_default));
        }
      } catch {
        /* non-fatal — keep default */
      }
    })();
    return () => { alive = false; };
  }, [available, connected, conversationId]);

  const setChatAuto = async (mode: AutoMode) => {
    if (!conversationId) return;
    const prev = autoMode;
    setAutoMode(mode); // optimistic
    setAutoUpdating(true);
    try {
      const res = await apiClient.put(`/whatsapp/commerce/chat-auto/${conversationId}`, { mode });
      if (res.ok && res.data?.success) {
        setAutoMode((res.data.mode as AutoMode) || mode);
        toast({ title: "Updated", description: `Auto-payment: ${autoLabel(mode, workspaceDefault)}` });
      } else {
        setAutoMode(prev);
        toast({ title: "Error", description: res.data?.message || res.error?.message || "Failed to update", variant: "destructive" });
      }
    } catch {
      setAutoMode(prev);
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    } finally {
      setAutoUpdating(false);
    }
  };

  if (!available || !phone) return null;

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast({ title: "Enter an amount", description: "Amount must be greater than 0.", variant: "destructive" });
      return;
    }
    setSending(true);
    setLastLink(null);
    try {
      const res = await apiClient.post("/whatsapp/commerce/request-payment", {
        phone,
        amount: amt,
        description: description.trim() || undefined,
        conversation_id: conversationId,
        customer_name: customerName || undefined,
      });
      if (res.ok && res.data?.success) {
        setLastLink(res.data.pay_link || null);
        toast({
          title: res.data.message_sent ? "Payment link sent" : "Order created",
          description: res.data.message || "Done.",
        });
        setAmount(""); setDescription("");
      } else {
        toast({
          title: "Couldn't create payment",
          description: res.data?.message || res.error?.message || "Please try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network error", description: "Please try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => { setOpen(true); setLastLink(null); }}>
          <IndianRupee className="w-4 h-4" />
          Request Payment
        </Button>

        {connected && conversationId ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 h-8 px-2 text-xs text-muted-foreground" disabled={autoUpdating}>
                {autoUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Auto: {autoLabel(autoMode, workspaceDefault)}
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Auto-send payment link</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setChatAuto("default")} className="gap-2">
                {autoMode === "default" && <Check className="w-4 h-4" />}
                <span className={autoMode === "default" ? "" : "pl-6"}>
                  Default (workspace: {workspaceDefault ? "on" : "off"})
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setChatAuto("on")} className="gap-2">
                {autoMode === "on" && <Check className="w-4 h-4" />}
                <span className={autoMode === "on" ? "" : "pl-6"}>Always on</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setChatAuto("off")} className="gap-2">
                {autoMode === "off" && <Check className="w-4 h-4" />}
                <span className={autoMode === "off" ? "" : "pl-6"}>Always off</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5" /> Request Payment
            </DialogTitle>
            <DialogDescription>
              Sends a secure PayU payment link to {customerName || phone} in this chat.
            </DialogDescription>
          </DialogHeader>

          {lastLink ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Payment link generated and sent to the customer.</span>
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={lastLink} className="font-mono text-xs" />
                <Button
                  type="button" variant="outline" size="icon"
                  onClick={() => { navigator.clipboard?.writeText(lastLink); toast({ title: "Copied" }); }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : !connected ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              PayU isn't connected for this workspace yet. Go to
              <span className="font-medium"> Settings → Payments </span>
              and connect your PayU keys, then come back here.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number" min="1" step="0.01" inputMode="decimal"
                  placeholder="e.g. 1499"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="e.g. Order #123 — 2 items"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={160}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {lastLink || !connected ? (
              <Button onClick={() => setOpen(false)} variant={lastLink ? "default" : "outline"}>
                {lastLink ? "Done" : "Close"}
              </Button>
            ) : (
              <Button onClick={submit} disabled={sending} className="gap-2">
                {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Payment Link
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RequestPaymentButton;
