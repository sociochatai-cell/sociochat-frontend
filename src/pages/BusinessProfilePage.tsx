import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import apiClient from "@/lib/apiClient";
import { Sparkles, Loader2, ArrowLeft, ImagePlus } from "lucide-react";

/**
 * Business Profile page (/dashboard/workspaces/:id/profile).
 * Shown right after creating a workspace so the owner can enter their business
 * details — by pasting a URL (AI auto-fill) or manually. Saved to workspaces2
 * and later used by the AI (get_business_info). Entirely additive; skipping is fine.
 */
type Profile = {
  business_name: string;
  website: string;
  business_type: string;
  industry: string;
  description: string;
  usp: string;
  audience_description: string;
  b2b_b2c: string;
  city: string;
  country: string;
  social_links: string;
};

const EMPTY: Profile = {
  business_name: "", website: "", business_type: "", industry: "", description: "",
  usp: "", audience_description: "", b2b_b2c: "", city: "", country: "", social_links: "",
};

export default function BusinessProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [form, setForm] = useState<Profile>(EMPTY);
  const [analyzeUrl, setAnalyzeUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logoPath, setLogoPath] = useState<string>("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Prefill from the existing workspace record.
  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get("/workspaces");
        if (res.ok && Array.isArray(res.data?.workspaces)) {
          const ws = res.data.workspaces.find((w: any) => String(w.id) === String(id));
          if (ws) {
            setForm((f) => ({
              ...f,
              business_name: ws.business_name || ws.name || "",
              website: ws.website || "",
              business_type: ws.business_type || "",
              industry: ws.industry || "",
              description: ws.description || "",
              usp: ws.usp || "",
              audience_description: ws.audience_description || "",
              b2b_b2c: ws.b2b_b2c || "",
              city: ws.city || "",
              country: ws.country || "",
              social_links: ws.social_links || "",
            }));
            if (ws.website) setAnalyzeUrl(ws.website);
            if (ws.logo_path) setLogoPath(String(ws.logo_path));
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const uploadLogo = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return;
    }
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      // Multipart upload — can't go through apiClient (JSON only). Send cookies
      // plus the same fallback identity headers the rest of the app uses.
      const headers: Record<string, string> = {};
      const uid = localStorage.getItem("sv_user_id");
      const tok = sessionStorage.getItem("sv_token") || localStorage.getItem("sv_token");
      if (uid) headers["X-User-Id"] = uid;
      if (tok) headers["Authorization"] = `Bearer ${tok}`;
      const res = await fetch(`${apiClient.API_BASE}/workspaces/${id}/logo`, {
        method: "POST",
        credentials: "include",
        headers,
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success && data.logo_path) {
        setLogoPath(String(data.logo_path));
        toast({ title: "Logo uploaded", description: "It'll be used in your AI-generated ads." });
      } else {
        toast({ title: "Logo upload failed", description: data?.error || "Please try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Logo upload failed", description: "Please check your connection.", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
    }
  };

  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  const analyze = async () => {
    const url = analyzeUrl.trim();
    if (!url) {
      toast({ title: "Enter your website URL first", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    try {
      const res = await apiClient.post("/workspaces/analyze-url", { url });
      if (res.ok && res.data?.success && res.data.profile) {
        const p = res.data.profile as Partial<Profile>;
        // Only fill fields that came back non-empty; keep anything the user already typed.
        setForm((f) => {
          const next = { ...f };
          (Object.keys(EMPTY) as (keyof Profile)[]).forEach((k) => {
            const v = (p as any)[k];
            if (v && !next[k]) (next as any)[k] = String(v);
          });
          if (p.website) next.website = String(p.website);
          return next;
        });
        toast({ title: "Details filled from your website", description: "Review and edit anything, then save." });
      } else {
        toast({ title: "Could not analyze", description: res.data?.error || "Please fill details manually.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Analyze failed", description: "Please fill details manually.", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    if (!form.business_name.trim()) {
      toast({ title: "Business name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.put(`/workspaces/${id}`, form);
      if (res.ok) {
        toast({ title: "Business profile saved", description: "Your AI will now use these details." });
        navigate("/dashboard");
      } else {
        toast({ title: "Could not save", description: res.error?.message || "Please try again.", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, k: keyof Profile, placeholder = "", textarea = false) => (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      {textarea ? (
        <textarea
          value={form[k]} onChange={set(k)} placeholder={placeholder} rows={3}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
        />
      ) : (
        <Input value={form[k]} onChange={set(k)} placeholder={placeholder} />
      )}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <button onClick={() => navigate("/dashboard/workspaces")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
        <ArrowLeft className="h-4 w-4" /> Back to workspaces
      </button>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Tell us about your business</CardTitle>
          <p className="text-sm text-slate-500">
            Paste your website and we'll fill it in for you — or enter the details manually.
            Your AI assistant uses this to answer customers accurately.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={analyzeUrl} onChange={(e) => setAnalyzeUrl(e.target.value)}
              placeholder="yourbusiness.com"
              onKeyDown={(e) => { if (e.key === "Enter") analyze(); }}
            />
            <Button onClick={analyze} disabled={analyzing} className="gap-1.5 whitespace-nowrap">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {analyzing ? "Analyzing…" : "Analyze & auto-fill"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Business details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 gap-4">
                {field("Business name *", "business_name", "Acme Pvt Ltd")}
                {field("Website", "website", "https://acme.com")}
                {field("Business type", "business_type", "SaaS, Retail, Clinic…")}
                {field("Industry", "industry", "Healthcare, Fashion…")}
                {field("City", "city", "Mumbai")}
                {field("Country", "country", "India")}
                {field("B2B / B2C", "b2b_b2c", "B2B, B2C or B2B2C")}
                {field("Social links", "social_links", "instagram.com/…, facebook.com/…")}
              </div>
              {field("What does your business do?", "description", "One or two lines about your business", true)}
              {field("Unique selling points (USP)", "usp", "What makes you different", true)}
              {field("Target audience", "audience_description", "Who are your customers?", true)}

              {/* Brand logo — auto-fetch doesn't grab this, so the user adds it.
                  It's saved to the workspace and composed into AI-generated ads. */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Brand logo</label>
                <p className="text-xs text-slate-500 -mt-1">Used on your AI-generated ad creatives. PNG or JPG, up to 5MB.</p>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.currentTarget.value = ""; }}
                />
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {logoPath ? (
                      <img src={logoPath} alt="Brand logo" className="h-full w-full object-contain" />
                    ) : (
                      <ImagePlus className="h-6 w-6 text-slate-300" />
                    )}
                  </div>
                  <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo} className="gap-1.5">
                    {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {uploadingLogo ? "Uploading…" : logoPath ? "Replace logo" : "Upload logo"}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => navigate("/dashboard")} disabled={saving}>Skip for now</Button>
                <Button onClick={save} disabled={saving} className="gap-1.5">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save profile
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
