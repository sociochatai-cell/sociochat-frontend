/**
 * WhatsApp Product Catalog Management
 * =====================================
 * Lets users view, connect, create, and disconnect Meta Commerce product catalogs
 * from their WhatsApp Business Account directly inside Sociovia.
 */

import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { buildApiUrl } from '@/config';
import { getWorkspaceId } from '../utils/workspaceContext';
import { toast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Catalog {
  id: string;
  name: string;
  vertical?: string;
  product_count?: number;
}

// ─── API helpers ─────────────────────────────────────────────────────────────

function catalogApi(path: string, options?: RequestInit) {
  const workspaceId = getWorkspaceId();
  let url = buildApiUrl(`/api/whatsapp${path}`);
  if (workspaceId) {
    url += `${url.includes('?') ? '&' : '?'}workspace_id=${encodeURIComponent(workspaceId)}`;
  }

  return fetch(url, {
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

  // Connect existing
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [manualCatalogId, setManualCatalogId] = useState('');

  // Create new
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Disconnect
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // ── Fetch connected catalogs ──────────────────────────────────────────────

  const fetchConnected = useCallback(async () => {
    setLoadingConnected(true);
    try {
      const { ok, data } = await catalogApi('/catalogs');
      if (ok) {
        setConnected(data.catalogs ?? []);
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
  }, []);

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

  useEffect(() => {
    fetchConnected();
    fetchAvailable();
  }, [fetchConnected, fetchAvailable]);

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
        await fetchConnected();
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
      if (ok && data.catalog_id) {
        toast({
          title: 'Catalog created',
          description: `Catalog "${createName.trim()}" created. Connecting to WhatsApp...`,
        });
        setCreateName('');
        setCreateDescription('');

        const connectRes = await catalogApi('/catalogs/connect', {
          method: 'POST',
          body: JSON.stringify({ catalog_id: data.catalog_id }),
        });

        if (connectRes.ok) {
          toast({
            title: 'Catalog connected',
            description: 'Your new catalog is linked to your WhatsApp account.',
          });
        } else {
          toast({
            title: 'Created but not connected',
            description: connectRes.data.error || 'Connect it manually from the Connect Existing tab.',
            variant: 'destructive',
          });
        }

        await Promise.all([fetchConnected(), fetchAvailable()]);
      } else {
        if (data.needs_business_id) setNeedsBusinessId(true);
        toast({
          title: 'Create failed',
          description: data.error || 'Could not create catalog',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  // ── Disconnect catalog ────────────────────────────────────────────────────

  async function handleDisconnect(catalogId: string) {
    setDisconnectingId(catalogId);
    try {
      const { ok, data } = await catalogApi(`/catalogs/${encodeURIComponent(catalogId)}`, {
        method: 'DELETE',
      });
      if (ok) {
        toast({ title: 'Catalog disconnected', description: data.message });
        setConnected((prev) => prev.filter((c) => c.id !== catalogId));
      } else {
        toast({ title: 'Disconnect failed', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setDisconnectingId(null);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const connectedIds = new Set(connected.map((c) => c.id));

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/dashboard/whatsapp/templates')}
          aria-label="Back to Templates"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-green-600" />
            Product Catalog Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Connect a Meta Commerce catalog to your WhatsApp Business Account to use CATALOG button templates.
          </p>
        </div>
      </div>

      {/* Connected catalogs */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Connected Catalogs</CardTitle>
              <CardDescription>Catalogs currently linked to your WABA.</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchConnected}
              disabled={loadingConnected}
              aria-label="Refresh"
            >
              {loadingConnected ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingConnected ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : connected.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <PackageOpen className="h-8 w-8 opacity-40" />
              <p className="text-sm">No catalog connected yet.</p>
              <p className="text-xs">Use the tabs below to connect or create one.</p>
            </div>
          ) : (
            <ul className="divide-y">
              {connected.map((cat) => (
                <li key={cat.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{cat.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{cat.id}</p>
                    {cat.product_count !== undefined && (
                      <p className="text-xs text-muted-foreground">{cat.product_count} products</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDisconnect(cat.id)}
                      disabled={disconnectingId === cat.id}
                    >
                      {disconnectingId === cat.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Link2Off className="h-3 w-3 mr-1" />
                      )}
                      Disconnect
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <Tabs defaultValue="connect">
        <TabsList className="grid grid-cols-2 w-full max-w-xs">
          <TabsTrigger value="connect">Connect Existing</TabsTrigger>
          <TabsTrigger value="create">Create New</TabsTrigger>
        </TabsList>

        {/* ── Connect existing ── */}
        <TabsContent value="connect" className="mt-4 space-y-4">
          {/* From business catalogs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Your Business Catalogs</CardTitle>
              <CardDescription className="text-xs">
                Catalogs owned by your Meta Business Manager.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAvailable ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </div>
              ) : availableError ? (
                <Alert variant={needsBusinessId ? 'default' : 'destructive'} className="py-3">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="text-sm">
                    {needsBusinessId ? 'Business ID required' : 'Could not load catalogs'}
                  </AlertTitle>
                  <AlertDescription className="text-xs">
                    {availableError}
                    {needsBusinessId && (
                      <span>
                        {' '}
                        Go to{' '}
                        <button
                          className="underline font-medium"
                          onClick={() => navigate('/dashboard/whatsapp/settings')}
                        >
                          WhatsApp Settings
                        </button>{' '}
                        to add your Meta Business Manager ID.
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              ) : available.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">
                  No business-owned catalogs found. Create one in the "Create New" tab.
                </p>
              ) : (
                <ul className="divide-y">
                  {available.map((cat) => {
                    const alreadyConnected = connectedIds.has(cat.id);
                    return (
                      <li
                        key={cat.id}
                        className="flex items-center justify-between py-2.5 gap-4"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{cat.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{cat.id}</p>
                          {cat.product_count !== undefined && (
                            <p className="text-xs text-muted-foreground">{cat.product_count} products</p>
                          )}
                        </div>
                        {alreadyConnected ? (
                          <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200 shrink-0">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConnect(cat.id)}
                            disabled={connectingId !== null}
                            className="shrink-0"
                          >
                            {connectingId === cat.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Link2 className="h-3 w-3 mr-1" />
                            )}
                            Connect
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Separator />

          {/* Manual connect by ID */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Connect by Catalog ID</CardTitle>
              <CardDescription className="text-xs">
                Enter a Meta product catalog ID directly if you know it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. 1234567890123456"
                  value={manualCatalogId}
                  onChange={(e) => setManualCatalogId(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  onClick={() => handleConnect(manualCatalogId)}
                  disabled={!manualCatalogId.trim() || connectingId !== null}
                >
                  {connectingId === manualCatalogId && manualCatalogId !== '' ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-1" />
                  )}
                  Connect
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Link to Meta Commerce Manager */}
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-sm text-blue-800">Find your Catalog ID</AlertTitle>
            <AlertDescription className="text-xs text-blue-700">
              Open{' '}
              <a
                href="https://business.facebook.com/commerce"
                target="_blank"
                rel="noopener noreferrer"
                className="underline inline-flex items-center gap-0.5"
              >
                Meta Commerce Manager
                <ExternalLink className="h-3 w-3" />
              </a>
              , select your catalog, and copy the Catalog ID from the Settings tab.
            </AlertDescription>
          </Alert>
        </TabsContent>

        {/* ── Create new ── */}
        <TabsContent value="create" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Create a New Catalog</CardTitle>
              <CardDescription className="text-xs">
                Creates a new product catalog under your Meta Business Manager. Requires the Meta
                Business Manager ID to be set in WhatsApp Settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="catalog-name">Catalog name *</Label>
                  <Input
                    id="catalog-name"
                    placeholder="My Product Catalog"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="catalog-description">Description (optional)</Label>
                  <Input
                    id="catalog-description"
                    placeholder="A brief description of this catalog"
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={creating || !createName.trim()}>
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Create Catalog
                </Button>
              </form>

              {needsBusinessId && (
                <Alert variant="default" className="mt-4 border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-sm text-amber-800">Meta Business Manager ID missing</AlertTitle>
                  <AlertDescription className="text-xs text-amber-700">
                    Go to{' '}
                    <button
                      className="underline font-medium"
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
      </Tabs>
    </div>
  );
}

export default WhatsAppCatalog;
