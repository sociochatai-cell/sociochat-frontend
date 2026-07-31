/**
 * PaymentsSettings — per-business PayU credentials (SocioChat-only, removable).
 * ============================================================================
 * Each business connects its OWN PayU Merchant Key + Salt here so its
 * customers' payments settle to that business. The salt is write-only (never
 * returned by the API); to change it, re-enter it.
 *
 * Self-contained: delete this file + the "payments" tab wiring in
 * WhatsAppSettings to remove the feature from the UI.
 */

import React, { useCallback, useEffect, useState } from "react";
import apiClient from "@/lib/apiClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, CheckCircle2, Eye, EyeOff, Trash2, AlertCircle } from "lucide-react";

interface PayConfig {
  provider: string;
  mode: "test" | "live";
  connected: boolean;
  merchant_key_masked?: string;
  auto_request_payment?: boolean;
  notify_emails?: string[];
}

const PaymentsSettings: React.FC = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<PayConfig | null>(null);
  const [merchantKey, setMerchantKey] = useState("");
  const [merchantSalt, setMerchantSalt] = useState("");
  const [live, setLive] = useState(false);
  const [showSalt, setShowSalt] = useState(false);
  const [saving, setSaving] = useState(false);

  // Preferences (available without re-entering the salt)
  const [autoRequest, setAutoRequest] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [notifyEmails, setNotifyEmails] = useState("");
  const [emailsSaving, setEmailsSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/whatsapp/commerce/payment-config");
      if (res.ok && res.data?.success && res.data.config) {
        const cfg = res.data.config as PayConfig;
        setConfig(cfg);
        setLive((cfg.mode as string) === "live");
        setAutoRequest(Boolean(cfg.auto_request_payment));
        setNotifyEmails(Array.isArray(cfg.notify_emails) ? cfg.notify_emails.join(", ") : "");
      } else {
        setConfig({ provider: "payu", mode: "test", connected: false });
      }
    } catch {
      setConfig({ provider: "payu", mode: "test", connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!merchantKey.trim()) return toast({ title: "Error", description: "PayU Merchant Key is required", variant: "destructive" });
    if (!merchantSalt.trim()) return toast({ title: "Error", description: "PayU Merchant Salt is required", variant: "destructive" });
    setSaving(true);
    try {
      const res = await apiClient.post("/whatsapp/commerce/payment-config", {
        merchant_key: merchantKey.trim(),
        merchant_salt: merchantSalt.trim(),
        mode: live ? "live" : "test",
      });
      if (res.ok && res.data?.success) {
        toast({ title: "Saved", description: "PayU credentials connected" });
        setMerchantKey(""); setMerchantSalt("");
        load();
      } else {
        toast({ title: "Error", description: res.data?.message || res.error?.message || "Failed to save", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect PayU for this workspace? Payment links will stop working.")) return;
    const res = await apiClient.delete("/whatsapp/commerce/payment-config");
    if (res.ok && res.data?.success) { toast({ title: "Removed", description: "PayU disconnected" }); load(); }
    else toast({ title: "Error", description: "Failed to remove", variant: "destructive" });
  };

  // Toggle the auto-request-payment preference (no salt needed).
  const toggleAutoRequest = async (next: boolean) => {
    const prev = autoRequest;
    setAutoRequest(next); // optimistic
    setAutoSaving(true);
    try {
      const res = await apiClient.put("/whatsapp/commerce/payment-config/preferences", {
        auto_request_payment: next,
      });
      if (res.ok && res.data?.success) {
        const cfg = res.data.config as PayConfig | undefined;
        if (cfg && typeof cfg.auto_request_payment === "boolean") setAutoRequest(cfg.auto_request_payment);
        setConfig((c) => (c ? { ...c, auto_request_payment: next } : c));
        toast({ title: "Saved", description: next ? "Auto-send is on" : "Auto-send is off" });
      } else {
        setAutoRequest(prev); // revert
        toast({ title: "Error", description: res.data?.message || res.error?.message || "Failed to update", variant: "destructive" });
      }
    } catch {
      setAutoRequest(prev);
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    } finally {
      setAutoSaving(false);
    }
  };

  // Save the extra notification email recipients (no salt needed).
  const saveNotifyEmails = async () => {
    const emails = notifyEmails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    setEmailsSaving(true);
    try {
      const res = await apiClient.put("/whatsapp/commerce/payment-config/preferences", {
        notify_emails: emails,
      });
      if (res.ok && res.data?.success) {
        const cfg = res.data.config as PayConfig | undefined;
        if (cfg && Array.isArray(cfg.notify_emails)) setNotifyEmails(cfg.notify_emails.join(", "));
        setConfig((c) => (c ? { ...c, notify_emails: emails } : c));
        toast({ title: "Saved", description: "Notification emails updated" });
      } else {
        toast({ title: "Error", description: res.data?.message || res.error?.message || "Failed to save", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally {
      setEmailsSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2"><CreditCard className="h-5 w-5" /> Payments (PayU)</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Connect this business's own PayU account. When a customer orders, a payment link is generated
            with these credentials so the money settles into <span className="font-medium">your</span> PayU account.
          </p>
        </div>
        {config?.connected && (
          <Badge variant="default" className="gap-1 flex-shrink-0">
            <CheckCircle2 className="h-3 w-3" /> Connected ({config.mode})
          </Badge>
        )}
      </div>

      {config?.connected && (
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            Currently connected — Merchant Key <code className="bg-muted px-1.5 py-0.5 rounded">{config.merchant_key_masked}</code>,
            mode <span className="font-medium">{config.mode}</span>. Re-enter both fields below to update.
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 border rounded-lg p-4">
        <div className="space-y-2">
          <Label>PayU Merchant Key *</Label>
          <Input placeholder="e.g. gtKFFx" value={merchantKey} onChange={(e) => setMerchantKey(e.target.value)} className="font-mono" />
        </div>
        <div className="space-y-2">
          <Label>PayU Merchant Salt *</Label>
          <div className="relative">
            <Input
              type={showSalt ? "text" : "password"}
              placeholder="Your PayU salt (kept secret)"
              value={merchantSalt}
              onChange={(e) => setMerchantSalt(e.target.value)}
              className="font-mono pr-10"
            />
            <button type="button" onClick={() => setShowSalt(!showSalt)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showSalt ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Stored encrypted. Never shown again after saving.</p>
        </div>
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label className="cursor-pointer">Live mode</Label>
            <p className="text-xs text-muted-foreground">Off = PayU test/sandbox. Turn on for real payments.</p>
          </div>
          <Switch checked={live} onCheckedChange={setLive} />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {config?.connected ? "Update" : "Connect PayU"}</Button>
          {config?.connected && (
            <Button variant="outline" onClick={disconnect} className="gap-1 text-destructive"><Trash2 className="h-4 w-4" /> Disconnect</Button>
          )}
        </div>
      </div>

      {config?.connected && (
        <div className="space-y-5 border rounded-lg p-4">
          <h4 className="text-sm font-semibold">Payment preferences</h4>

          {/* Auto-send payment link */}
          <div className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div className="space-y-1">
              <Label className="cursor-pointer">Auto-send payment link when a catalog order arrives</Label>
              <p className="text-xs text-muted-foreground">
                When on, an order that comes in automatically gets a PayU link in the chat — no manual click.
              </p>
            </div>
            <Switch checked={autoRequest} onCheckedChange={toggleAutoRequest} disabled={autoSaving} />
          </div>

          {/* Notification emails */}
          <div className="space-y-2">
            <Label>Notification emails</Label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="owner@shop.com, accounts@shop.com"
                value={notifyEmails}
                onChange={(e) => setNotifyEmails(e.target.value)}
                type="text"
              />
              <Button variant="outline" onClick={saveNotifyEmails} disabled={emailsSaving}>
                {emailsSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Order &amp; payment notification emails also go to these addresses (in addition to your account email).
              Customers never get email — only WhatsApp. Separate multiple addresses with commas.
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Get your Merchant Key + Salt from your PayU dashboard (Settings → API/Merchant credentials). Once connected, a
        <span className="font-medium"> “Request Payment” </span> button appears in each inbox chat — it sends a PayU link for the
        exact amount, and the chat auto-replies “✅ Payment received” when the customer pays.
      </p>
    </div>
  );
};

export default PaymentsSettings;
