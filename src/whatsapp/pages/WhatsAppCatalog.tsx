/**
 * WhatsApp Product Catalog Management
 * =====================================
 * Lets users view, connect, create, and disconnect Meta Commerce product catalogs
 * from their WhatsApp Business Account directly inside Sociovia, as well as managing
 * storefront commerce settings (Cart toggles & Catalog visibility), viewing live products,
 * running catalog health diagnostics, and accessing an in-app usage guide.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  ShoppingBag,
  Plus,
  Link2,
  Link2Off,
  RefreshCw,
  Loader2,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  PackageOpen,
  Info,
  ArrowLeft,
  ShoppingCart,
  Store,
  HelpCircle,
  Sparkles,
  Eye,
  CheckCircle,
  Layers,
  Trash2,
  BookOpen,
  Activity,
  ChevronDown,
  ChevronRight,
  XCircle,
  Zap,
  Send,
  MessageSquare,
  Users,
  Repeat,
  Shield,
  FileText,
  Clock,
} from 'lucide-react';
import { WHATSAPP_REST_API_PREFIX } from "@/config";
import { getWorkspaceId } from '../utils/workspaceContext';
import { cachedFetch } from '../utils/waPersistentCache';
import { toast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Catalog {
  id: string;
  name: string;
  vertical?: string;
  product_count?: number;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price?: string;
  currency?: string;
  image_url?: string;
  availability?: string;
  retailer_id?: string;
}

interface CommerceSettings {
  is_cart_enabled: boolean;
  is_catalog_visible: boolean;
}

interface HealthCheck {
  id: string;
  label: string;
  status: 'pass' | 'warning' | 'fail';
  detail: string;
  fix?: string;
}

interface HealthData {
  score: number;
  max_score: number;
  checks: HealthCheck[];
  overall_status: 'ready' | 'needs_attention' | 'setup_required';
  waba_id?: string;
  display_phone_number?: string;
  verified_name?: string;
  meta_business_id?: string;
  account_id?: number;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

function catalogApi(path: string, options?: RequestInit) {
  const workspaceId = getWorkspaceId();
  // WHATSAPP_REST_API_PREFIX is relative ("/api/whatsapp") in the same-origin merged app,
  // so `new URL()` needs an absolute base or it throws "Invalid URL" (which was silently
  // swallowed, making every catalog fetch no-op). Passing window.location.origin as the base
  // works for both the relative prefix and an absolute prod prefix.
  const url = new URL(`${WHATSAPP_REST_API_PREFIX}${path}`, window.location.origin);
  if (workspaceId) url.searchParams.set('workspace_id', workspaceId);

  return cachedFetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    credentials: 'include',
  }).then(async (res) => {
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  });
}

// ─── Utilities ───────────────────────────────────────────────────────────────

const sanitizeImageUrl = (url: string) => {
  if (!url) return '';
  const fileDRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  const openIdRegex = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
  const docsDRegex = /docs\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  const ucRegex = /drive\.google\.com\/uc\?(?:export=download&)?id=([a-zA-Z0-9_-]+)/;
  const ucRegexAlt = /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)(?:&export=download)?/;
  const usercontentRegex = /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/;

  let fileId = '';
  const matchD = url.match(fileDRegex);
  const matchOpen = url.match(openIdRegex);
  const matchDocs = url.match(docsDRegex);
  const matchUc = url.match(ucRegex) || url.match(ucRegexAlt);
  const matchUsercontent = url.match(usercontentRegex);

  if (matchD) fileId = matchD[1];
  else if (matchOpen) fileId = matchOpen[1];
  else if (matchDocs) fileId = matchDocs[1];
  else if (matchUc) fileId = matchUc[1];
  else if (matchUsercontent) fileId = matchUsercontent[1];

  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }
  return url;
};

const renderPrice = (priceVal: any, currencyVal?: string) => {
  if (!priceVal) return '—';
  // If it's already a formatted string containing currency characters, return it
  if (typeof priceVal === 'string' && (priceVal.includes('₹') || priceVal.includes('$') || priceVal.includes('€') || priceVal.includes('£') || /[A-Za-z]/.test(priceVal))) {
    return priceVal;
  }
  // Otherwise try to format it
  try {
    const num = parseFloat(priceVal);
    if (!isNaN(num)) {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currencyVal || 'INR' }).format(num);
    }
  } catch (e) {}
  return String(priceVal);
};

// ─── Health Score Ring ───────────────────────────────────────────────────────

function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" className="text-muted/20" strokeWidth="6" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-black" style={{ color }}>{Math.round(score)}</span>
        <span className="text-[9px] text-muted-foreground font-medium -mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WhatsAppCatalog() {
  const navigate = useNavigate();

  // Connected catalogs
  const [connected, setConnected] = useState<Catalog[]>([]);
  const [loadingConnected, setLoadingConnected] = useState(false);

  // Available (business-owned) catalogs
  const [available, setAvailable] = useState<Catalog[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [availableError, setAvailableError] = useState<string | null>(null);
  const [needsBusinessId, setNeedsBusinessId] = useState(false);

  // Commerce settings
  const [settings, setSettings] = useState<CommerceSettings>({ is_cart_enabled: true, is_catalog_visible: false });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState<string | null>(null);
  const [settingsLastSynced, setSettingsLastSynced] = useState<Date | null>(null);

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  // Health diagnostics
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());

  // Tabs & Modal States
  const [activeTab, setActiveTab] = useState('products');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [driveLinkDetected, setDriveLinkDetected] = useState(false);
  const [newProduct, setNewProduct] = useState({
    retailer_id: '',
    name: '',
    price: '',
    currency: 'USD',
    image_url: '',
    url: '',
    brand: '',
    description: '',
    availability: 'in stock',
    condition: 'new'
  });

  // Actions
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [manualCatalogId, setManualCatalogId] = useState('');
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // ── Fetch connected catalogs ──────────────────────────────────────────────

  const fetchConnected = useCallback(async () => {
    setLoadingConnected(true);
    try {
      const { ok, data } = await catalogApi('/catalogs');
      if (ok) {
        const list = data.catalogs ?? [];
        setConnected(list);
        if (list.length > 0 && !selectedCatalogId) {
          setSelectedCatalogId(list[0].id);
        }
      } else {
        toast({
          title: 'Failed to load catalogs',
          description: data.error || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Network error', description: 'Could not reach server', variant: 'destructive' });
    } finally {
      setLoadingConnected(false);
    }
  }, [selectedCatalogId]);

  // ── Fetch available (business) catalogs ──────────────────────────────────

  const fetchAvailable = useCallback(async () => {
    setLoadingAvailable(true);
    setAvailableError(null);
    setNeedsBusinessId(false);
    try {
      const { ok, data } = await catalogApi('/catalogs/available');
      if (ok) {
        setAvailable(data.catalogs ?? []);
      } else {
        setAvailableError(data.error || 'Failed to load business catalogs');
        if (data.needs_business_id) setNeedsBusinessId(true);
      }
    } catch {
      setAvailableError('Network error — could not reach server');
    } finally {
      setLoadingAvailable(false);
    }
  }, []);

  // ── Fetch commerce settings ───────────────────────────────────────────────

  const fetchCommerceSettings = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const { ok, data } = await catalogApi('/catalogs/commerce-settings');
      if (ok) {
        setSettings({
          is_cart_enabled: data.is_cart_enabled ?? true,
          is_catalog_visible: data.is_catalog_visible ?? false,
        });
        setSettingsLastSynced(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch commerce settings:', err);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  // ── Fetch products in catalog ─────────────────────────────────────────────

  const fetchProducts = useCallback(async (catalogId: string) => {
    if (!catalogId) return;
    setLoadingProducts(true);
    setProductsError(null);
    try {
      const { ok, data } = await catalogApi(`/catalogs/${catalogId}/products`);
      if (ok) {
        setProducts(data.products ?? []);
      } else {
        setProductsError(data.error || 'Failed to load catalog products');
      }
    } catch {
      setProductsError('Network error — failed to load products');
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // ── Fetch health diagnostics ──────────────────────────────────────────────

  const fetchHealth = useCallback(async () => {
    setLoadingHealth(true);
    try {
      const { ok, data } = await catalogApi('/catalogs/health');
      if (ok) {
        setHealth({
          score: data.score,
          max_score: data.max_score,
          checks: data.checks,
          overall_status: data.overall_status,
          waba_id: data.waba_id,
          display_phone_number: data.display_phone_number,
          verified_name: data.verified_name,
          meta_business_id: data.meta_business_id,
          account_id: data.account_id,
        });

        // Auto-expand checks that are in "fail" or "warning" status
        if (data.checks && Array.isArray(data.checks)) {
          const warnOrFailIds = data.checks
            .filter((c: any) => c.status === 'fail' || c.status === 'warning')
            .map((c: any) => c.id);
          setExpandedChecks(new Set(warnOrFailIds));
        }
      }
    } catch (err) {
      console.error('Failed to fetch health:', err);
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  // ── Initial & Catalog Triggered Loads ─────────────────────────────────────

  useEffect(() => {
    fetchConnected();
    fetchAvailable();
    fetchCommerceSettings();
    fetchHealth();
  }, [fetchConnected, fetchAvailable, fetchCommerceSettings, fetchHealth]);

  useEffect(() => {
    if (selectedCatalogId) {
      fetchProducts(selectedCatalogId);
    } else {
      setProducts([]);
    }
  }, [selectedCatalogId, fetchProducts]);

  // ── Connect catalog ───────────────────────────────────────────────────────

  async function handleConnect(catalogId: string) {
    if (!catalogId.trim()) return;
    setConnectingId(catalogId);
    try {
      const { ok, data } = await catalogApi('/catalogs/connect', {
        method: 'POST',
        body: JSON.stringify({ catalog_id: catalogId }),
      });
      if (ok) {
        toast({ title: 'Catalog connected', description: data.message });
        setManualCatalogId('');
        setSelectedCatalogId(catalogId);
        await fetchConnected();
        fetchHealth();
      } else {
        toast({ title: 'Connect failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setConnectingId(null);
    }
  }

  // ── Create catalog ────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const { ok, data } = await catalogApi('/catalogs/create', {
        method: 'POST',
        body: JSON.stringify({ name: createName.trim(), description: createDescription.trim() }),
      });
      if (ok) {
        toast({ title: 'Catalog created', description: `Catalog '${createName.trim()}' created. Connecting to WhatsApp...` });
        setCreateName('');
        setCreateDescription('');
        
        // Auto-connect after creation
        setConnectingId(data.catalog_id);
        const connectRes = await catalogApi('/catalogs/connect', {
          method: 'POST',
          body: JSON.stringify({ catalog_id: data.catalog_id }),
        });
        
        if (connectRes.ok) {
          toast({ title: 'Catalog connected', description: 'Your new catalog has been automatically bound to WhatsApp!' });
          setSelectedCatalogId(data.catalog_id);
          await fetchConnected();
          setActiveTab('products');
        } else {
          toast({
            title: 'Catalog created but connection failed',
            description: connectRes.data.error || 'Please connect it manually on the Link Catalog tab.',
            variant: 'destructive',
          });
          await fetchAvailable();
          setActiveTab('connect');
        }
        fetchHealth();
      } else {
        toast({ title: 'Create failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setCreating(false);
      setConnectingId(null);
    }
  }

  // ── Disconnect catalog ────────────────────────────────────────────────────

  async function handleDisconnect(catalogId: string) {
    if (!confirm('Are you sure you want to disconnect this catalog from your WhatsApp phone number?')) return;
    setDisconnectingId(catalogId);
    try {
      const { ok, data } = await catalogApi(`/catalogs/${encodeURIComponent(catalogId)}`, {
        method: 'DELETE',
      });
      if (ok) {
        toast({ title: 'Catalog disconnected', description: data.message });
        setConnected((prev) => prev.filter((c) => c.id !== catalogId));
        if (selectedCatalogId === catalogId) {
          setSelectedCatalogId(null);
        }
        fetchHealth();
      } else {
        toast({ title: 'Disconnect failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setDisconnectingId(null);
    }
  }

  // ── Delete catalog permanently ────────────────────────────────────────────

  async function handleDeleteCatalogPermanent(catalogId: string, catalogName: string) {
    const confirmDelete = confirm(
      `WARNING: Are you sure you want to permanently delete the catalog "${catalogName}" (${catalogId}) from Meta?\n\nThis will completely delete the catalog and all its products from the Meta Business Manager, and disconnect it from your WhatsApp account. THIS ACTION CANNOT BE UNDONE.`
    );
    if (!confirmDelete) return;

    setDeletingId(catalogId);
    try {
      const { ok, data } = await catalogApi(`/catalogs/${encodeURIComponent(catalogId)}/permanent`, {
        method: 'DELETE',
      });
      if (ok) {
        toast({ title: 'Catalog permanently deleted', description: data.message });
        setConnected((prev) => prev.filter((c) => c.id !== catalogId));
        setAvailable((prev) => prev.filter((c) => c.id !== catalogId));
        if (selectedCatalogId === catalogId) {
          setSelectedCatalogId(null);
        }
        fetchHealth();
      } else {
        toast({ title: 'Delete failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  }

  // ── Add product to catalog ────────────────────────────────────────────────

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCatalogId) return;
    setAddingProduct(true);
    try {
      const { ok, data } = await catalogApi(`/catalogs/${selectedCatalogId}/products`, {
        method: 'POST',
        body: JSON.stringify(newProduct),
      });
      if (ok) {
        toast({ title: 'Product added successfully', description: 'Product has been published to Meta Commerce catalog!' });
        setNewProduct({
          retailer_id: '',
          name: '',
          price: '',
          currency: 'USD',
          image_url: '',
          url: '',
          brand: '',
          description: '',
          availability: 'in stock',
          condition: 'new'
        });
        setDriveLinkDetected(false);
        setShowAddProductModal(false);
        fetchProducts(selectedCatalogId);
        fetchHealth();
      } else {
        toast({ title: 'Failed to add product', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setAddingProduct(false);
    }
  }

  const handleImageUrlChange = (urlVal: string) => {
    const fileDRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
    const openIdRegex = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;
    const docsDRegex = /docs\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;

    let fileId = '';
    const matchD = urlVal.match(fileDRegex);
    const matchOpen = urlVal.match(openIdRegex);
    const matchDocs = urlVal.match(docsDRegex);

    if (matchD) fileId = matchD[1];
    else if (matchOpen) fileId = matchOpen[1];
    else if (matchDocs) fileId = matchDocs[1];

    if (fileId) {
      const convertedUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
      setNewProduct(prev => ({ ...prev, image_url: convertedUrl }));
      setDriveLinkDetected(true);
    } else {
      setNewProduct(prev => ({ ...prev, image_url: urlVal }));
      setDriveLinkDetected(false);
    }
  };

  // ── Delete product from catalog ───────────────────────────────────────────

  async function handleDeleteProduct(productId: string, productName: string) {
    if (!confirm(`Are you sure you want to permanently delete the product "${productName}" from this catalog?`)) return;
    setDeletingProductId(productId);
    try {
      const { ok, data } = await catalogApi(`/catalogs/products/${productId}`, {
        method: 'DELETE',
      });
      if (ok) {
        toast({ title: 'Product deleted', description: data.message });
        if (selectedCatalogId) fetchProducts(selectedCatalogId);
        fetchHealth();
      } else {
        toast({ title: 'Failed to delete product', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setDeletingProductId(null);
    }
  }

  // ── Toggle settings ───────────────────────────────────────────────────────

  async function handleToggleSetting(key: keyof CommerceSettings, val: boolean) {
    setUpdatingSettings(key);
    try {
      const { ok, data } = await catalogApi('/catalogs/commerce-settings', {
        method: 'POST',
        body: JSON.stringify({ [key]: val }),
      });
      if (ok) {
        setSettings(prev => ({ ...prev, [key]: val }));
        toast({
          title: 'Settings updated',
          description: `Shopping ${key === 'is_cart_enabled' ? 'Cart' : 'Catalog Visibility'} updated successfully.`,
        });
        // Re-verify from Meta after a short delay
        setTimeout(async () => {
          await fetchCommerceSettings();
          fetchHealth();
        }, 2000);
      } else {
        toast({ title: 'Update failed', description: data.error || 'Meta API error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setUpdatingSettings(null);
    }
  }

  // ── Health check helpers ──────────────────────────────────────────────────

  const toggleCheckExpand = (checkId: string) => {
    setExpandedChecks(prev => {
      const next = new Set(prev);
      if (next.has(checkId)) next.delete(checkId);
      else next.add(checkId);
      return next;
    });
  };

  const statusIcon = (status: string) => {
    if (status === 'pass') return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
    if (status === 'warning') return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />;
    return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
  };

  const statusBadge = (status: string) => {
    if (status === 'pass') return <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Pass</Badge>;
    if (status === 'warning') return <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/20">Warning</Badge>;
    return <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-600 border-red-500/20">Fail</Badge>;
  };

  const overallLabel = useMemo(() => {
    if (!health) return { text: 'Loading...', color: 'text-muted-foreground', bg: 'bg-muted/20' };
    if (health.overall_status === 'ready') return { text: 'Ready to Use', color: 'text-emerald-700', bg: 'bg-emerald-500/10 border-emerald-500/20' };
    if (health.overall_status === 'needs_attention') return { text: 'Needs Attention', color: 'text-amber-700', bg: 'bg-amber-500/10 border-amber-500/20' };
    return { text: 'Setup Required', color: 'text-red-700', bg: 'bg-red-500/10 border-red-500/20' };
  }, [health]);

  const connectedIds = new Set(connected.map((c) => c.id));

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-background to-muted/20 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/dashboard/whatsapp')}
              aria-label="Back to WhatsApp Settings"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2 tracking-tight">
                <ShoppingBag className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
                Product Catalog Management
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Connect and manage Meta Commerce catalogs on your WhatsApp Business Profile.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => {
                fetchConnected();
                fetchAvailable();
                fetchCommerceSettings();
                fetchHealth();
                if (selectedCatalogId) fetchProducts(selectedCatalogId);
              }}
              disabled={loadingConnected || loadingAvailable || loadingSettings || loadingHealth}
            >
              <RefreshCw className={`h-4 w-4 ${(loadingConnected || loadingHealth) && "animate-spin"}`} />
              Sync All
            </Button>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            HEALTH & READINESS DASHBOARD
            ═══════════════════════════════════════════════════════════════════ */}
        <Card className="border shadow-sm overflow-hidden bg-card/65 backdrop-blur-md">
          <CardHeader className="bg-muted/10 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                <Activity className="h-4 w-4 text-cyan-500" />
                Catalog Health & Readiness
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px] ${overallLabel.bg} ${overallLabel.color}`}>
                  {overallLabel.text}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={fetchHealth}
                  disabled={loadingHealth}
                  title="Re-run diagnostics"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingHealth && "animate-spin"}`} />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Live diagnostics — checks your catalog setup against Meta's requirements for WhatsApp Commerce.</p>
          </CardHeader>
          <CardContent className="pt-5">
            {loadingHealth && !health ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-cyan-500" /> Running diagnostics...
              </div>
            ) : health ? (
              <div className="flex flex-col md:flex-row gap-6">
                {/* Score Ring & Account Info */}
                <div className="flex flex-col sm:flex-row md:flex-col items-center gap-4 shrink-0 sm:border-r md:border-r sm:pr-6 md:pr-6 border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <ScoreRing score={health.score} size={100} />
                    <p className="text-[10px] text-muted-foreground font-medium">Readiness Score</p>
                  </div>
                  
                  {/* Account Summary Panel */}
                  {health.waba_id && (
                    <div className="w-full sm:w-48 md:w-full space-y-1.5 text-left bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80 text-[10px]">
                      <div className="font-semibold text-slate-700 dark:text-slate-200 border-b pb-1 mb-1.5 flex items-center gap-1 truncate">
                        <Shield className="h-3.5 w-3.5 text-cyan-600 shrink-0" />
                        <span className="truncate">{health.verified_name}</span>
                      </div>
                      <div className="space-y-1 font-mono text-muted-foreground">
                        <div className="flex justify-between gap-3">
                          <span>WABA ID:</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 select-all">{health.waba_id}</span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span>Phone No:</span>
                          <span className="text-slate-600 dark:text-slate-400 font-semibold">{health.display_phone_number || 'N/A'}</span>
                        </div>
                        {health.meta_business_id && (
                          <div className="flex justify-between gap-3">
                            <span>Business ID:</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300 select-all">{health.meta_business_id}</span>
                          </div>
                        )}
                        <div className="flex justify-between gap-3 text-[9px] border-t pt-1 mt-1 opacity-70">
                          <span>Status:</span>
                          <span className="text-emerald-600 font-bold uppercase">Active</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Check Items */}
                <div className="flex-1 space-y-1.5">
                  {health.checks.map((check) => {
                    const isExpanded = expandedChecks.has(check.id);
                    return (
                      <div key={check.id} className="border rounded-lg overflow-hidden transition-all hover:shadow-sm">
                        <button
                          onClick={() => toggleCheckExpand(check.id)}
                          className="w-full flex items-center gap-2.5 p-2.5 text-left hover:bg-muted/5 transition-colors"
                        >
                          {statusIcon(check.status)}
                          <span className="text-xs font-medium flex-1 text-slate-700 dark:text-slate-200">{check.label}</span>
                          {statusBadge(check.status)}
                          {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-0 border-t bg-muted/5">
                            <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{check.detail}</p>
                            {check.fix && (
                              <div className="mt-2 flex items-start gap-1.5 text-[11px] text-cyan-700 dark:text-cyan-400 bg-cyan-500/5 border border-cyan-500/10 rounded-md p-2">
                                <Zap className="h-3 w-3 mt-0.5 shrink-0" />
                                <span className="font-medium">Fix: {check.fix}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground">
                <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-amber-400" />
                <p>Could not load diagnostics. Click refresh to retry.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════════════
            MAIN INTERFACE LAYOUT
            ═══════════════════════════════════════════════════════════════════ */}
        <div className="grid lg:grid-cols-3 gap-6 items-start">
          {/* Left Column - Settings & Connected Catalogs */}
          <div className="lg:col-span-1 space-y-6">
            {/* Storefront settings panel */}
            <Card className="border shadow-sm bg-card/65 backdrop-blur-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <ShoppingCart className="h-4 w-4 text-cyan-500" />
                  Storefront Settings
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure shopping cart & profile visibility settings for your active phone number.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingSettings ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Fetching settings...
                  </div>
                ) : (
                  <>
                    {/* Cart switch */}
                    <div className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/20">
                      <div className="space-y-0.5 min-w-0">
                        <Label htmlFor="toggle-cart" className="text-xs font-semibold flex items-center gap-1">
                          Shopping Cart
                        </Label>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Allow customers to add items to a shopping cart and send orders directly in chat.
                        </p>
                      </div>
                      <div className="flex items-center h-8 shrink-0">
                        {updatingSettings === 'is_cart_enabled' ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Switch
                            id="toggle-cart"
                            checked={settings.is_cart_enabled}
                            onCheckedChange={(val) => handleToggleSetting('is_cart_enabled', val)}
                          />
                        )}
                      </div>
                    </div>

                    {/* Catalog visibility switch */}
                    <div className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/20">
                      <div className="space-y-0.5 min-w-0">
                        <Label htmlFor="toggle-visibility" className="text-xs font-semibold flex items-center gap-1">
                          Catalog Storefront Icon
                        </Label>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          Displays the catalog store button on your WhatsApp business profile header.
                        </p>
                      </div>
                      <div className="flex items-center h-8 shrink-0">
                        {updatingSettings === 'is_catalog_visible' ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Switch
                            id="toggle-visibility"
                            checked={settings.is_catalog_visible}
                            onCheckedChange={(val) => handleToggleSetting('is_catalog_visible', val)}
                          />
                        )}
                      </div>
                    </div>

                    {/* Sync verification note */}
                    <div className="flex items-start gap-2 p-2.5 rounded-md bg-cyan-500/5 border border-cyan-500/10">
                      <Clock className="h-3.5 w-3.5 text-cyan-600 mt-0.5 shrink-0" />
                      <div className="text-[10px] text-cyan-700 dark:text-cyan-400 leading-relaxed">
                        <p className="font-semibold">Settings are verified from Meta after each change.</p>
                        <p className="mt-0.5">The storefront icon may take 5–10 minutes to appear on your WhatsApp profile after enabling.</p>
                        {settingsLastSynced && (
                          <p className="mt-1 opacity-70">Last verified: {settingsLastSynced.toLocaleTimeString()}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Connected Catalogs Card */}
            <Card className="border shadow-sm bg-card/65 backdrop-blur-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                      Connected Catalogs
                    </CardTitle>
                    <CardDescription className="text-xs">Linked Meta catalogs for templates.</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={fetchConnected}
                    disabled={loadingConnected}
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingConnected && "animate-spin"}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {loadingConnected ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading catalogs...
                  </div>
                ) : connected.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground bg-muted/15 border border-dashed rounded-lg">
                    <PackageOpen className="h-7 w-7 opacity-40 text-slate-400" />
                    <p className="text-xs font-medium">No catalogs connected.</p>
                    <p className="text-[10px] max-w-[200px]">Link an existing catalog or create a new one using the tabs.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {connected.map((cat) => (
                      <div
                        key={cat.id}
                        onClick={() => setSelectedCatalogId(cat.id)}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedCatalogId === cat.id
                            ? 'border-cyan-500 bg-cyan-500/5 ring-1 ring-cyan-500/10'
                            : 'hover:bg-muted/10 border-slate-200'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-semibold text-xs truncate text-slate-800 dark:text-slate-200">{cat.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">{cat.id}</p>
                          {cat.product_count !== undefined && (
                            <Badge variant="secondary" className="mt-1 text-[9px] px-1.5 py-0">
                              {cat.product_count} Items
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Disconnect catalog */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-amber-500 hover:text-amber-700 hover:bg-amber-500/10"
                            title="Disconnect from WABA"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDisconnect(cat.id);
                            }}
                            disabled={disconnectingId === cat.id}
                          >
                            {disconnectingId === cat.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Link2Off className="h-3.5 w-3.5" />
                            )}
                          </Button>

                          {/* Permanently delete catalog from Meta */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-500/10"
                            title="Permanently Delete Catalog from Meta"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCatalogPermanent(cat.id, cat.name);
                            }}
                            disabled={deletingId === cat.id}
                          >
                            {deletingId === cat.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Helper Links */}
            <Alert className="border-cyan-200 bg-cyan-500/5 shadow-sm">
              <Info className="h-4 w-4 text-cyan-600" />
              <AlertTitle className="text-xs font-semibold text-cyan-800">Need help linking your inventory?</AlertTitle>
              <AlertDescription className="text-[11px] text-cyan-700 mt-1 leading-relaxed">
                Log into your{' '}
                <a
                  href="https://business.facebook.com/commerce"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold inline-flex items-center gap-0.5"
                >
                  Meta Commerce Manager
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>{' '}
                to populate your catalog with products, manage stock counts, and verify items are approved by Meta policies.
              </AlertDescription>
            </Alert>
          </div>

          {/* Right Columns - Connection Options & Product Catalog Inventory Viewer */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-4 w-full max-w-lg bg-muted/30">
                <TabsTrigger value="products" className="text-xs">Live Inventory</TabsTrigger>
                <TabsTrigger value="connect" className="text-xs">Link Catalog</TabsTrigger>
                <TabsTrigger value="create" className="text-xs">New Catalog</TabsTrigger>
                <TabsTrigger value="guide" className="text-xs gap-1">
                  <BookOpen className="h-3 w-3" /> Guide
                </TabsTrigger>
              </TabsList>

              {/* ════════════════════════════════════════════════════════════
                  Tab 1: Live Product Inventory
                  ════════════════════════════════════════════════════════════ */}
              <TabsContent value="products" className="mt-4">
                <Card className="border shadow-sm bg-card/65 backdrop-blur-md">
                  <CardHeader className="pb-3 border-b">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                          <Layers className="h-4 w-4 text-cyan-500" />
                          Product Inventory Viewer
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Live items fetched directly from the currently selected commerce catalog.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {connected.length > 0 && selectedCatalogId && (
                          <Button
                            size="sm"
                            className="h-8 text-xs gap-1"
                            onClick={() => setShowAddProductModal(true)}
                          >
                            <Plus className="h-3 w-3" /> Add Product
                          </Button>
                        )}
                        {connected.length > 0 && (
                          <select
                            value={selectedCatalogId || ''}
                            onChange={(e) => setSelectedCatalogId(e.target.value)}
                            className="h-8 text-xs rounded-md border border-input bg-background px-2 py-1 font-medium shadow-sm w-36"
                          >
                            {connected.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {loadingProducts ? (
                      <div className="flex flex-col items-center py-16 text-muted-foreground gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
                        <p className="text-xs">Syncing products from Meta...</p>
                      </div>
                    ) : productsError ? (
                      <div className="flex flex-col items-center py-12 text-center text-muted-foreground bg-muted/15 rounded-lg border border-dashed p-6">
                        <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                        <p className="text-xs font-semibold">Could not load items</p>
                        <p className="text-[10px] mt-1 max-w-sm">{productsError}</p>
                      </div>
                    ) : !selectedCatalogId ? (
                      <div className="flex flex-col items-center py-16 text-center text-muted-foreground bg-muted/15 border border-dashed rounded-lg p-6">
                        <PackageOpen className="h-10 w-10 opacity-30 text-slate-400 mb-2" />
                        <p className="text-xs font-semibold">Select a connected catalog</p>
                        <p className="text-[10px] mt-1">Connect a commerce catalog on the "Link Catalog" tab to see products.</p>
                      </div>
                    ) : products.length === 0 ? (
                      <div className="flex flex-col items-center py-16 text-center text-muted-foreground bg-muted/15 border border-dashed rounded-lg p-6">
                        <PackageOpen className="h-10 w-10 opacity-30 text-slate-400 mb-2" />
                        <p className="text-xs font-semibold">Catalog is empty</p>
                        <p className="text-[10px] mt-1 max-w-xs">
                          There are no items inside this Meta catalog yet. Click "Add Product" above or go to Meta Commerce Manager.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {products.map((p) => (
                          <div key={p.id} className="flex gap-3 p-3 rounded-lg border bg-card hover:shadow-sm transition-all border-slate-100 dark:border-slate-800">
                            {/* Product Image */}
                            <div className="w-16 h-16 rounded-md bg-muted/50 overflow-hidden flex items-center justify-center shrink-0 border">
                              {p.image_url ? (
                                <img src={sanitizeImageUrl(p.image_url)} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <ShoppingBag className="h-5 w-5 opacity-30 text-slate-400" />
                              )}
                            </div>
                            {/* Product Info */}
                            <div className="min-w-0 flex-1 flex flex-col justify-between">
                              <div>
                                <div className="flex items-start justify-between gap-1.5">
                                  <h4 className="font-semibold text-xs truncate text-slate-800 dark:text-slate-100">{p.name}</h4>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <Badge
                                      variant="outline"
                                      className={`text-[8px] px-1 py-0 uppercase shrink-0 ${
                                        p.availability === 'in stock'
                                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                          : 'bg-red-500/10 text-red-600 border-red-500/20'
                                      }`}
                                    >
                                      {p.availability === 'in stock' ? 'In Stock' : 'Out of Stock'}
                                    </Badge>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-500/10 shrink-0"
                                      title="Delete Product"
                                      onClick={() => handleDeleteProduct(p.id, p.name)}
                                      disabled={deletingProductId === p.id}
                                    >
                                      {deletingProductId === p.id ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                </div>
                                <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                                  {p.description || 'No description provided.'}
                                </p>
                              </div>
                              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                                <span className="font-bold text-xs text-slate-700 dark:text-slate-300">
                                  {renderPrice(p.price, p.currency)}
                                </span>
                                <span className="text-[9px] text-muted-foreground font-mono">
                                  ID: {p.retailer_id || p.id.slice(0, 8)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ════════════════════════════════════════════════════════════
                  Tab 2: Connect Existing
                  ════════════════════════════════════════════════════════════ */}
              <TabsContent value="connect" className="mt-4 space-y-4">
                <Card className="border shadow-sm bg-card/65 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Available Business Catalogs</CardTitle>
                    <CardDescription className="text-xs">
                      Select a commerce catalog owned by your linked Meta Business Manager.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    {loadingAvailable ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-cyan-500" /> Retrieving catalogs...
                      </div>
                    ) : availableError ? (
                      <Alert variant={needsBusinessId ? 'default' : 'destructive'} className="py-3 shadow-none border-dashed">
                        <AlertTriangle className="h-4 w-4 text-cyan-600" />
                        <AlertTitle className="text-xs font-semibold">
                          {needsBusinessId ? 'Business Manager ID required' : 'Retrieval error'}
                        </AlertTitle>
                        <AlertDescription className="text-[10px] mt-1">
                          {availableError}
                          {needsBusinessId && (
                            <span>
                              {' '}
                              Please navigate to{' '}
                              <button
                                className="underline font-semibold text-cyan-800"
                                onClick={() => navigate('/dashboard/whatsapp/settings')}
                              >
                                WhatsApp Settings
                              </button>{' '}
                              to configure your Meta Business ID.
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    ) : available.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4 bg-muted/15 rounded-lg border border-dashed">
                        No available catalogs found. Create a new one inside the "New Catalog" tab.
                      </p>
                    ) : (
                      <div className="divide-y border rounded-lg bg-card overflow-hidden">
                        {available.map((cat) => {
                          const alreadyConnected = connectedIds.has(cat.id);
                          return (
                            <div
                              key={cat.id}
                              className="flex items-center justify-between p-3 gap-4 hover:bg-muted/5 transition-colors"
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200">{cat.name}</p>
                                <p className="text-[10px] text-muted-foreground font-mono truncate">{cat.id}</p>
                                {cat.product_count !== undefined && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">{cat.product_count} products</p>
                                )}
                              </div>
                              {alreadyConnected ? (
                                <Badge variant="secondary" className="text-emerald-700 bg-emerald-50 border-emerald-200 shrink-0 text-[10px] px-2">
                                  Connected
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 gap-1 border-slate-300 shrink-0"
                                  onClick={() => handleConnect(cat.id)}
                                  disabled={connectingId !== null}
                                >
                                  {connectingId === cat.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Link2 className="h-3 w-3" />
                                  )}
                                  Link Catalog
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Connect manual catalog ID */}
                <Card className="border shadow-sm bg-card/65 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Connect by Catalog ID</CardTitle>
                    <CardDescription className="text-xs">
                      Directly link a catalog ID if it does not appear in your Business Manager list.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. 1234567890123456"
                        value={manualCatalogId}
                        onChange={(e) => setManualCatalogId(e.target.value)}
                        className="font-mono text-xs h-9"
                      />
                      <Button
                        className="h-9 gap-1"
                        onClick={() => handleConnect(manualCatalogId)}
                        disabled={!manualCatalogId.trim() || connectingId !== null}
                      >
                        {connectingId === manualCatalogId && manualCatalogId !== '' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Link2 className="h-3.5 w-3.5" />
                        )}
                        Link
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ════════════════════════════════════════════════════════════
                  Tab 3: Create New
                  ════════════════════════════════════════════════════════════ */}
              <TabsContent value="create" className="mt-4">
                <Card className="border shadow-sm bg-card/65 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">Create a New Product Catalog</CardTitle>
                    <CardDescription className="text-xs">
                      Creates a new product catalog under your Meta Business Manager portfolio. Requires your Business Manager ID to be set.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <form onSubmit={handleCreate} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="catalog-name" className="text-xs font-semibold">Catalog Name *</Label>
                        <Input
                          id="catalog-name"
                          placeholder="e.g., Summer Products"
                          value={createName}
                          onChange={(e) => setCreateName(e.target.value)}
                          required
                          className="h-9"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="catalog-description" className="text-xs font-semibold">Description (optional)</Label>
                        <Input
                          id="catalog-description"
                          placeholder="Catalog description details..."
                          value={createDescription}
                          onChange={(e) => setCreateDescription(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <Button type="submit" disabled={creating || !createName.trim()} className="h-9 gap-1.5">
                        {creating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                        Create Catalog
                      </Button>
                    </form>

                    {needsBusinessId && (
                      <Alert variant="default" className="mt-4 border-amber-200 bg-amber-50 shadow-none">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertTitle className="text-xs font-semibold text-amber-800">Business Manager ID missing</AlertTitle>
                        <AlertDescription className="text-[10px] text-amber-700 leading-relaxed mt-1">
                          Go to{' '}
                          <button
                            className="underline font-semibold text-amber-900"
                            onClick={() => navigate('/dashboard/whatsapp/settings')}
                          >
                            WhatsApp Settings
                          </button>{' '}
                          and add your Meta Business Manager ID to enable catalog creation.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ════════════════════════════════════════════════════════════
                  Tab 4: Guide
                  ════════════════════════════════════════════════════════════ */}
              <TabsContent value="guide" className="mt-4 space-y-4">
                {/* Getting Started */}
                <Card className="border shadow-sm bg-card/65 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-cyan-500" />
                      Getting Started
                    </CardTitle>
                    <CardDescription className="text-xs">Complete these steps to start selling through WhatsApp.</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="space-y-3">
                      {[
                        { step: 1, title: 'Connect WhatsApp Account', desc: 'Ensure your WhatsApp Business Account (WABA) is connected in WhatsApp Settings. Your WABA must be associated with a Meta Business Manager.', icon: <Link2 className="h-3.5 w-3.5" /> },
                        { step: 2, title: 'Set Business Manager ID', desc: 'Go to WhatsApp Settings → Meta Business Manager ID section. Enter your Business Manager ID (found at business.facebook.com → Settings → Business Info).', icon: <Shield className="h-3.5 w-3.5" /> },
                        { step: 3, title: 'Create or Link a Catalog', desc: 'Use the "New Catalog" tab to create one, or "Link Catalog" to connect an existing Meta Commerce catalog to your WABA.', icon: <ShoppingBag className="h-3.5 w-3.5" /> },
                        { step: 4, title: 'Add Products', desc: 'Add products with name, price, image, and website URL. Meta requires all four fields for product approval. Use publicly accessible image URLs.', icon: <Plus className="h-3.5 w-3.5" /> },
                        { step: 5, title: 'Enable Storefront', desc: 'Toggle ON both "Shopping Cart" and "Catalog Storefront Icon" in the Storefront Settings panel. This makes your catalog visible on your WhatsApp business profile.', icon: <Store className="h-3.5 w-3.5" /> },
                      ].map((item) => (
                        <div key={item.step} className="flex gap-3 items-start p-3 rounded-lg border bg-muted/5 hover:bg-muted/10 transition-colors">
                          <div className="w-7 h-7 rounded-full bg-cyan-500/10 text-cyan-600 flex items-center justify-center shrink-0 text-xs font-bold">
                            {item.step}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                              {item.icon} {item.title}
                            </h4>
                            <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Using Catalogs in Templates */}
                <Card className="border shadow-sm bg-card/65 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-cyan-500" />
                      Using Catalogs in Message Templates
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-3">
                    <div className="p-3 rounded-lg border bg-muted/5">
                      <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100 mb-1.5">How to Create a Catalog Template</h4>
                      <ol className="text-[10px] text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                        <li>Go to <strong>Template Builder</strong> from the WhatsApp sidebar menu.</li>
                        <li>Set the template category to <strong>MARKETING</strong> — catalog buttons require this category.</li>
                        <li>Design your header and body content (e.g., "Check out our latest products!").</li>
                        <li>In the <strong>Buttons</strong> section, click <strong>"Add Button"</strong> and select <strong>CATALOG</strong> type.</li>
                        <li>Only <strong>1 catalog button</strong> is allowed per template. It automatically links to your connected catalog.</li>
                        <li>Submit the template for Meta review. Approval typically takes a few minutes to 24 hours.</li>
                      </ol>
                    </div>
                    <Alert className="border-amber-200 bg-amber-50/50 shadow-none py-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      <AlertDescription className="text-[10px] text-amber-700">
                        <strong>Important:</strong> The catalog button cannot be combined with Quick Reply buttons. It can coexist with URL, Phone, and Copy Code buttons.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>

                {/* Sending to Individual Customers */}
                <Card className="border shadow-sm bg-card/65 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <MessageSquare className="h-4 w-4 text-cyan-500" />
                      Sending Catalog to Individual Customers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-2">
                    <div className="p-3 rounded-lg border bg-muted/5 text-[10px] text-muted-foreground leading-relaxed space-y-2">
                      <p><strong className="text-slate-700 dark:text-slate-200">Via WhatsApp Inbox:</strong> Open any conversation in the Sociovia Inbox. Use the template sending feature and select your approved catalog template. The customer will see a "View Catalog" button that opens your full product list directly in WhatsApp.</p>
                      <p><strong className="text-slate-700 dark:text-slate-200">Via Direct Product Share:</strong> If the customer is browsing your catalog and asks about a specific product, you can share individual product links from your Meta Commerce Manager.</p>
                      <p><strong className="text-slate-700 dark:text-slate-200">Via API:</strong> Use the WhatsApp Test Console to send a catalog template message to any phone number. Select the template, enter the recipient number, and send.</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Bulk Campaigns */}
                <Card className="border shadow-sm bg-card/65 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-cyan-500" />
                      Using Catalogs in Bulk Campaigns
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-2">
                    <div className="p-3 rounded-lg border bg-muted/5 text-[10px] text-muted-foreground leading-relaxed space-y-2">
                      <p><strong className="text-slate-700 dark:text-slate-200">Step 1:</strong> Create and get approval for a MARKETING template with a CATALOG button (see template guide above).</p>
                      <p><strong className="text-slate-700 dark:text-slate-200">Step 2:</strong> Go to <strong>Datasets</strong> in the sidebar, and upload or select your target audience contact list.</p>
                      <p><strong className="text-slate-700 dark:text-slate-200">Step 3:</strong> Navigate to <strong>Campaigns → New Campaign</strong>. Select your approved catalog template.</p>
                      <p><strong className="text-slate-700 dark:text-slate-200">Step 4:</strong> Choose your dataset (audience), schedule the send time, and launch the campaign.</p>
                      <p className="text-cyan-700 dark:text-cyan-400 font-medium">💡 Tip: Start with a small test batch (50-100 contacts) before sending to your full audience to monitor delivery rates and engagement.</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Drip Campaign Integration */}
                <Card className="border shadow-sm bg-card/65 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <Repeat className="h-4 w-4 text-cyan-500" />
                      Using Catalogs in Drip Campaigns
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-2">
                    <div className="p-3 rounded-lg border bg-muted/5 text-[10px] text-muted-foreground leading-relaxed space-y-2">
                      <p><strong className="text-slate-700 dark:text-slate-200">What are Drip Campaigns?</strong> Drip campaigns send a sequence of messages over time. They're perfect for nurturing leads through your product catalog.</p>
                      <p><strong className="text-slate-700 dark:text-slate-200">Adding Catalog Messages:</strong> When building a drip sequence in the <strong>Drip Campaigns</strong> section, add a step that uses your approved MARKETING catalog template.</p>
                      <p><strong className="text-slate-700 dark:text-slate-200">Suggested Flow:</strong></p>
                      <ol className="list-decimal list-inside space-y-1 pl-2">
                        <li><strong>Day 1:</strong> Welcome message introducing your brand.</li>
                        <li><strong>Day 3:</strong> Send the catalog template ("Browse our products →").</li>
                        <li><strong>Day 7:</strong> Follow up with a special offer or discount code.</li>
                        <li><strong>Day 14:</strong> Re-engage with new arrivals catalog update.</li>
                      </ol>
                      <p className="text-cyan-700 dark:text-cyan-400 font-medium">💡 Tip: Use conditional logic — if a customer interacted with the catalog in step 2, send them a personalized product recommendation in step 3.</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Meta Policy Compliance */}
                <Card className="border shadow-sm bg-card/65 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-cyan-500" />
                      Meta Policy & Compliance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-2">
                    <div className="p-3 rounded-lg border bg-muted/5 text-[10px] text-muted-foreground leading-relaxed space-y-2">
                      <p><strong className="text-slate-700 dark:text-slate-200">Product Image Requirements:</strong></p>
                      <ul className="list-disc list-inside pl-2 space-y-0.5">
                        <li>Must be a publicly accessible URL (no login-gated images).</li>
                        <li>Minimum resolution: 500×500 pixels.</li>
                        <li>Supported formats: JPEG, PNG, WebP.</li>
                        <li>Google Drive links are auto-converted by Sociovia to a direct download format.</li>
                      </ul>
                      <p><strong className="text-slate-700 dark:text-slate-200">Required Fields:</strong> Each product must have: Name, Price (in cents), Currency, Image URL, Website URL, Brand, and Retailer ID (SKU).</p>
                      <p><strong className="text-slate-700 dark:text-slate-200">Approval Process:</strong> Products are reviewed by Meta for compliance with their Commerce Policies. Items violating policies (weapons, adult content, counterfeit goods, etc.) will be rejected.</p>
                      <p><strong className="text-slate-700 dark:text-slate-200">Pricing Format:</strong> Prices are stored in the smallest currency unit (e.g., cents for USD, paise for INR). Enter ₹49.99 as 49.99 — Sociovia auto-converts to 4999 for Meta.</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Troubleshooting */}
                <Card className="border shadow-sm bg-card/65 backdrop-blur-md">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                      <HelpCircle className="h-4 w-4 text-cyan-500" />
                      Troubleshooting
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-2">
                    <div className="space-y-3">
                      {[
                        {
                          q: 'Storefront icon not showing on WhatsApp',
                          a: 'Ensure: (1) A catalog is linked to the WABA, (2) "Catalog Storefront Icon" is toggled ON, (3) The catalog has at least 1 approved product. It may take 5-10 minutes to appear after enabling.',
                        },
                        {
                          q: 'INVALID_PRODUCT_CATALOGUE_ID error',
                          a: 'This means the catalog is not owned by the same Meta Business Manager as your WABA. Make sure the catalog is created under or shared with the same Business Manager portfolio.',
                        },
                        {
                          q: 'Products not showing in WhatsApp catalog',
                          a: 'Check the Health Dashboard for product compliance issues. Products need to pass Meta review. Ensure all required fields are filled and images are publicly accessible.',
                        },
                        {
                          q: 'Images not loading in product cards',
                          a: 'If using Google Drive, paste the sharing link — Sociovia auto-converts it. If using other hosts, ensure the image URL is direct (no redirects) and publicly accessible.',
                        },
                        {
                          q: 'Template with catalog button rejected',
                          a: 'Catalog buttons require MARKETING category. Check that only 1 catalog button is used and it\'s not combined with Quick Reply buttons.',
                        },
                      ].map((faq, idx) => (
                        <div key={idx} className="p-3 rounded-lg border bg-muted/5">
                          <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <HelpCircle className="h-3 w-3 text-cyan-500 shrink-0" /> {faq.q}
                          </h4>
                          <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">{faq.a}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      
      {/* Add Product Modal Overlay */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto flex flex-col transition-all scale-100 duration-200">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-900/20">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-slate-800 dark:text-slate-100">Add Product to Catalog</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Publish a new item directly to Meta Commerce Catalog.</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 text-muted-foreground hover:text-slate-800 dark:hover:text-slate-200"
                onClick={() => {
                  setShowAddProductModal(false);
                  setDriveLinkDetected(false);
                }}
              >
                ✕
              </Button>
            </div>
            <form onSubmit={handleAddProduct} className="p-6 space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-4">
                {/* Name */}
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">Product Name *</Label>
                  <Input
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    placeholder="e.g. Classic Leather Jacket"
                    required
                  />
                </div>
                {/* SKU / Retailer ID */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Retailer ID / SKU *</Label>
                  <Input
                    value={newProduct.retailer_id}
                    onChange={(e) => setNewProduct({ ...newProduct, retailer_id: e.target.value })}
                    placeholder="e.g. SKU-JACKET-001"
                    required
                  />
                </div>
                {/* Brand */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Brand *</Label>
                  <Input
                    value={newProduct.brand}
                    onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                    placeholder="e.g. MyShop"
                    required
                  />
                </div>
                {/* Price */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Price *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    placeholder="e.g. 99.99"
                    required
                  />
                </div>
                {/* Currency */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Currency *</Label>
                  <select
                    value={newProduct.currency}
                    onChange={(e) => setNewProduct({ ...newProduct, currency: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required
                  >
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="AED">AED (د.إ)</option>
                    <option value="SAR">SAR (ر.س)</option>
                  </select>
                </div>
                {/* Image URL */}
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">Image URL *</Label>
                  <Input
                    type="url"
                    value={newProduct.image_url}
                    onChange={(e) => handleImageUrlChange(e.target.value)}
                    placeholder="e.g. https://example.com/images/jacket.jpg"
                    required
                  />
                  {driveLinkDetected ? (
                    <p className="text-[10px] text-emerald-600 font-semibold leading-relaxed animate-pulse">
                      ✓ Google Drive link detected! Automatically standardized to direct download format to ensure Meta Commerce compatibility.
                    </p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground leading-none">Meta requires a valid, public image link.</p>
                  )}
                </div>
                {/* Website URL */}
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">Website Product URL *</Label>
                  <Input
                    type="url"
                    value={newProduct.url}
                    onChange={(e) => setNewProduct({ ...newProduct, url: e.target.value })}
                    placeholder="e.g. https://myshop.com/products/leather-jacket"
                    required
                  />
                  <p className="text-[10px] text-muted-foreground leading-none">Meta requires a web storefront link for catalog items.</p>
                </div>
                {/* Description */}
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">Description</Label>
                  <Input
                    value={newProduct.description}
                    onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                    placeholder="Genuine leather premium jacket..."
                  />
                </div>
                {/* Availability */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Availability</Label>
                  <select
                    value={newProduct.availability}
                    onChange={(e) => setNewProduct({ ...newProduct, availability: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="in stock">In Stock</option>
                    <option value="out of stock">Out of Stock</option>
                  </select>
                </div>
                {/* Condition */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Condition</Label>
                  <select
                    value={newProduct.condition}
                    onChange={(e) => setNewProduct({ ...newProduct, condition: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="new">New</option>
                    <option value="refurbished">Refurbished</option>
                    <option value="used">Used</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAddProductModal(false);
                    setDriveLinkDetected(false);
                  }}
                  disabled={addingProduct}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={addingProduct}
                  className="gap-1.5"
                >
                  {addingProduct ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Publish Product
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default WhatsAppCatalog;
