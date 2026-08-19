import { useParams, Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useUser } from '@/contexts/UserContext';
import { AppLayout } from '@/components/AppLayout';
import type { ClientApp, Campaign, Component as ComponentType } from '@shared/schema';
import { Checkbox } from '@/components/ui/checkbox';
import {
  PLATFORM_KINDS, PLATFORM_LABELS, platformsToMap, platformsToPayload,
  type SurfacePlatform,
} from '@/lib/platforms';

/** A surface spans platforms (web/iOS/Android/Vev/TV) — served with the app. */
type ClientAppWithPlatforms = ClientApp & { platforms?: SurfacePlatform[] };
import { ImageUploadWithPreview } from '@/components/ImageUploadWithPreview';
import { ArrowLeft, Plus, Key, Copy, RefreshCw, Eye, EyeOff, Settings, ChevronRight, Megaphone, Puzzle, BarChart3, Users, Radio, Palette, Shield, Bell, Plug, X, Calendar, Tv } from 'lucide-react';

function formatViewers(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function getCampaignStatus(campaign: Campaign): { label: string; colorClass: string } {
  if (campaign.isPaused === 'true') return { label: 'Paused', colorClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  if (campaign.startDate && new Date(campaign.startDate) > new Date()) return { label: 'Upcoming', colorClass: 'bg-white/10 text-gray-300 border-white/20' };
  if (campaign.endDate && new Date(campaign.endDate) < new Date()) return { label: 'Ended', colorClass: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
  return { label: 'Active', colorClass: 'bg-[#3d8b7a]/15 text-[#3d8b7a] border-[#3d8b7a]/30' };
}

function getStatusBadge(status: string) {
  const labels: Record<string, string> = { active: 'Active', paused: 'Paused', archived: 'Archived' };
  const colors: Record<string, string> = {
    active: 'bg-[#3d8b7a]/15 text-[#3d8b7a] border border-[#3d8b7a]/30',
    paused: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
    archived: 'bg-white/10 text-gray-400 border border-white/20',
  };
  return { label: labels[status] || status, colorClass: colors[status] || 'bg-white/10 text-gray-400 border border-white/20' };
}

export default function AppDetailPage() {
  const { appId } = useParams();
  const appIdNum = appId ? parseInt(appId) : null;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { userId, isLoading: userLoading } = useUser();

  const [visibleApiKey, setVisibleApiKey] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');
  const [addComponentOpen, setAddComponentOpen] = useState(false);
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [platformsOpen, setPlatformsOpen] = useState(false);
  // kind → identifier ('' = selected without one). Presence in the map = selected.
  const [platformDraft, setPlatformDraft] = useState<Record<string, string>>({});

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editIconUrl, setEditIconUrl] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [editWebhookUrl, setEditWebhookUrl] = useState('');
  const [editPartnerDeviceRegisterUrl, setEditPartnerDeviceRegisterUrl] = useState('');
  const [editTvEnabled, setEditTvEnabled] = useState(false);
  const [editTvPlatforms, setEditTvPlatforms] = useState<string[]>([]);

  const { data: app, isLoading: appLoading } = useQuery<ClientAppWithPlatforms>({
    queryKey: ['/api/client-apps', appIdNum, userId],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps/${appIdNum}?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch app');
      return res.json();
    },
    enabled: !!appIdNum && !!userId
  });

  const { data: appStats } = useQuery<any[]>({
    queryKey: ['/api/client-apps/with-stats', userId],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps/with-stats?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: !!userId
  });

  const currentAppStats = appStats?.find((s: any) => s.id === appIdNum);

  const { data: appCampaigns = [], isLoading: campaignsLoading } = useQuery<any[]>({
    queryKey: ['/api/client-apps', appIdNum, 'campaigns', 'enriched'],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps/${appIdNum}/campaigns`);
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      const campaigns = await res.json();
      
      // Enrich with broadcast counts
      const campaignIds = campaigns.map((c: any) => c.id);
      if (campaignIds.length === 0) return [];
      
      const countsRes = await fetch(`/api/campaigns/broadcast-counts?ids=${campaignIds.join(',')}`);
      if (countsRes.ok) {
        const countsMap = await countsRes.json();
        return campaigns.map((c: any) => ({
          ...c,
          broadcastCount: countsMap[c.id] || 0
        }));
      }
      return campaigns;
    },
    enabled: !!appIdNum
  });

  // App placements (named instances declared by the SDK manifest):
  // each row is a (name, componentType, locationId) tuple the dev's app
  // registered via Vio.registerPlacement(...). This replaces the legacy
  // app_components view where the dashboard listed raw types — operators
  // now see the actual named placements they can bind in campaigns.
  const { data: appPlacementsData = [] } = useQuery<any[]>({
    queryKey: ['/api/client-apps', appIdNum, 'placements'],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps/${appIdNum}/placements`);
      if (!res.ok) throw new Error('Failed to fetch placements');
      return res.json();
    },
    enabled: !!appIdNum
  });

  // Locations declared by the SDK manifest. Source for the "Add from
  // library" form's locationId dropdown — operator can only assign a
  // placement to a slot the dev's app actually exposes.
  const { data: appLocationsData = [] } = useQuery<any[]>({
    queryKey: ['/api/client-apps', appIdNum, 'component-locations'],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps/${appIdNum}/component-locations`);
      if (!res.ok) throw new Error('Failed to fetch app locations');
      return res.json();
    },
    enabled: !!appIdNum
  });

  // Read-only library templates (`is_template = true`). Source for the
  // "Add from library" form's template dropdown.
  const { data: allComponents = [] } = useQuery<ComponentType[]>({
    queryKey: ['/api/components'],
    queryFn: async () => {
      const res = await fetch('/api/components?isTemplate=true');
      if (!res.ok) throw new Error('Failed to fetch components');
      return res.json();
    },
    enabled: addComponentOpen
  });

  const updateAppMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('PATCH', `/api/client-apps/${appIdNum}`, { userId, ...data });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', appIdNum] });
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps/with-stats'] });
      setEditModalOpen(false);
      toast({ title: 'App Updated', description: 'Changes saved successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update app', variant: 'destructive' });
    }
  });

  // Replace the whole platform set of this surface (PUT is a full replace,
  // mirroring the picker below).
  const platformsMutation = useMutation({
    mutationFn: async (platforms: { kind: string; identifier: string | null }[]) => {
      const response = await apiRequest('PUT', `/api/client-apps/${appIdNum}/platforms`, { platforms });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', appIdNum] });
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps/with-stats'] });
      setPlatformsOpen(false);
      toast({ title: 'Platforms updated', description: 'This surface now reflects where it runs.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update platforms', variant: 'destructive' });
    }
  });

  const openPlatforms = () => {
    setPlatformDraft(platformsToMap(app?.platforms));
    setPlatformsOpen(true);
  };

  const togglePlatform = (kind: string) => setPlatformDraft((prev) => {
    const next = { ...prev };
    if (kind in next) delete next[kind]; else next[kind] = '';
    return next;
  });

  const regenerateKeyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/client-apps/${appIdNum}/regenerate-key`, { userId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', appIdNum] });
      setRegenerateDialogOpen(false);
      toast({ title: 'API Key Regenerated', description: 'The new API key is now active.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to regenerate API key', variant: 'destructive' });
    }
  });

  // Create a named app_placement (operator-driven). Body shape matches
  // the backend's POST /api/client-apps/:id/placements endpoint.
  const createPlacementMutation = useMutation({
    mutationFn: async (args: { componentId: string; locationId: string; name: string }) => {
      const response = await apiRequest('POST', `/api/client-apps/${appIdNum}/placements`, args);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', appIdNum, 'placements'] });
      toast({ title: 'Placement created', description: 'Available now in campaign placement pickers.' });
    },
    onError: (err: any) => {
      const code = err?.code ?? '';
      const msg = err?.message ?? 'Failed to create placement';
      toast({ title: code || 'Error', description: msg, variant: 'destructive' });
    }
  });

  // Soft-delete a named placement. Existing campaign_components keep
  // rendering with a deprecation warning until the operator unbinds them.
  const deprecatePlacementMutation = useMutation({
    mutationFn: async (placementId: number) => {
      await apiRequest('DELETE', `/api/client-apps/${appIdNum}/placements/${placementId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', appIdNum, 'placements'] });
      toast({ title: 'Placement deprecated', description: 'Existing campaign instances stay live with a warning.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to deprecate placement', variant: 'destructive' });
    }
  });

  // ── Legacy mutations (RETIRED — endpoints return 410) ──────────────────
  const addComponentMutation = useMutation({
    mutationFn: async (componentId: string) => {
      const response = await apiRequest('POST', `/api/client-apps/${appIdNum}/components`, { componentId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', appIdNum, 'components'] });
      toast({ title: 'Component Added', description: 'Component has been added to the app.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to add component', variant: 'destructive' });
    }
  });

  const removeComponentMutation = useMutation({
    mutationFn: async (componentId: string) => {
      await apiRequest('DELETE', `/api/client-apps/${appIdNum}/components/${componentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', appIdNum, 'components'] });
      toast({ title: 'Component Removed', description: 'Component has been removed from the app.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to remove component', variant: 'destructive' });
    }
  });

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied!', description: `${label} copied to clipboard` });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
    }
  };

  const openEditModal = () => {
    if (!app) return;
    setEditName(app.name);
    setEditDescription(app.description || '');
    setEditStatus(app.status || 'active');
    setEditIconUrl(app.iconUrl || '');
    setEditBannerUrl(app.bannerUrl || '');
    setEditModalOpen(true);
  };

  const openSettingsModal = (tab: string = 'general') => {
    if (app) {
      setEditWebhookUrl(app.webhookUrl || '');
      setEditPartnerDeviceRegisterUrl(app.partnerDeviceRegisterUrl || '');
      setEditTvEnabled(((app as any).tvEnabled as boolean | null | undefined) === true);
      setEditTvPlatforms(((app as any).tvPlatforms as string[] | null | undefined) ?? []);
    }
    setSettingsTab(tab);
    setSettingsModalOpen(true);
  };

  const activeCampaignsCount = appCampaigns.filter(c => {
    const status = getCampaignStatus(c);
    return status.label === 'Active' || status.label === 'Upcoming';
  }).length;

  const liveBroadcastsCount = currentAppStats?.stats?.activeBroadcasts ?? 0;
  const totalViewers = currentAppStats?.stats?.totalViewers ?? 0;
  const engagementRate = currentAppStats?.stats?.engagementPercent ?? 0;

  // All canonical templates are pickable for the "Add from library" form.
  // The dual-UNIQUE on app_placements (per name + per slot) and the
  // server-side validation handle dedupe — no need to filter client-side.
  const availableComponents = allComponents;

  if (appLoading || userLoading || (!app && !userId)) {
    return (
      <AppLayout breadcrumbs={[{ label: 'Apps', href: '/apps' }, { label: 'Loading...' }]}>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading app...</p>
        </div>
      </AppLayout>
    );
  }

  if (!app) {
    return (
      <AppLayout breadcrumbs={[{ label: 'Apps', href: '/apps' }, { label: 'Not Found' }]}>
        <div className="text-center py-12">
          <p className="text-gray-900 dark:text-gray-100">App not found</p>
        </div>
      </AppLayout>
    );
  }

  const statusBadge = getStatusBadge(app.status || 'active');

  return (
    <AppLayout breadcrumbs={[{ label: 'Apps', href: '/apps' }, { label: app.name }]}>
      <div className="space-y-6">
        {app.bannerUrl && (
          <div className="relative h-32 rounded-xl overflow-hidden -mt-2 mb-2">
            <img src={app.bannerUrl} alt={`${app.name} banner`} className="w-full h-full object-cover" data-testid="img-app-banner" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        )}
        <div className="flex items-center gap-3">
          <Link href="/apps">
            <button
              data-testid="button-back"
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          {app.iconUrl && (
            <div className="w-9 h-9 rounded overflow-hidden border border-white/20 flex-shrink-0">
              <img src={app.iconUrl} alt={`${app.name} logo`} className="w-full h-full object-cover" data-testid="img-app-logo" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-white" data-testid="text-app-name">{app.name}</h1>
          <span
            data-testid="badge-app-status"
            className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full ${statusBadge.colorClass}`}
          >
            {statusBadge.label}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div data-testid="stat-campaigns" className="border border-white/10 rounded-lg p-5">
            <div className="text-xs text-gray-400 mb-1 uppercase font-medium">Active Campaigns</div>
            <div className="text-2xl font-bold text-white">{activeCampaignsCount}</div>
          </div>
          <div data-testid="stat-broadcasts" className="border border-white/10 rounded-lg p-5">
            <div className="text-xs text-gray-400 mb-1 uppercase font-medium">Live Broadcasts</div>
            <div className="text-2xl font-bold text-white">{liveBroadcastsCount}</div>
          </div>
          <div data-testid="stat-viewers" className="border border-white/10 rounded-lg p-5">
            <div className="text-xs text-gray-400 mb-1 uppercase font-medium">Total Viewers</div>
            <div className="text-2xl font-bold text-white">{formatViewers(totalViewers)}</div>
          </div>
          <div data-testid="stat-engagement" className="border border-white/10 rounded-lg p-5">
            <div className="text-xs text-gray-400 mb-1 uppercase font-medium">Engagement Rate</div>
            <div className="text-2xl font-bold text-white">{engagementRate}%</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="border border-white/10 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-semibold text-gray-400 uppercase">App Details</h2>
                <button
                  data-testid="button-edit-details"
                  onClick={openEditModal}
                  className="px-4 py-1.5 bg-white hover:bg-gray-200 text-black rounded text-xs font-medium flex items-center gap-2 transition"
                >
                  <Settings className="w-3 h-3" />
                  Manage
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="w-36 text-xs text-gray-500 uppercase font-medium pt-0.5">App Name</div>
                  <div className="flex-1 text-sm text-gray-200">{app.name}</div>
                </div>
                <div className="flex items-start">
                  <div className="w-36 text-xs text-gray-500 uppercase font-medium pt-1">Platforms</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {app.platforms && app.platforms.length > 0 ? (
                        app.platforms.map((p) => (
                          <span
                            key={p.id}
                            className="px-2 py-1 rounded text-xs bg-white/5 border border-white/10 text-gray-200"
                            data-testid={`platform-${p.kind}`}
                          >
                            {PLATFORM_LABELS[p.kind] ?? p.kind}
                            {p.identifier && <span className="ml-1.5 font-mono text-gray-400">{p.identifier}</span>}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-500">No platforms yet</span>
                      )}
                      <button
                        onClick={openPlatforms}
                        data-testid="button-edit-platforms"
                        className="px-2 py-1 rounded text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
                {app.bundleId && (
                  <div className="flex items-start">
                    <div className="w-36 text-xs text-gray-500 uppercase font-medium pt-2">Bundle ID</div>
                    <div className="flex-1">
                      <span className="text-sm font-mono bg-white/5 border border-white/10 px-3 py-2 rounded inline-block text-gray-200">{app.bundleId}</span>
                      <p className="text-[11px] text-gray-500 mt-1">Legacy — identifiers now live per platform.</p>
                    </div>
                  </div>
                )}
                <div className="flex items-start">
                  <div className="w-36 text-xs text-gray-500 uppercase font-medium pt-2">API Key</div>
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-white/5 border border-white/10 px-3 py-2 rounded text-gray-200">
                        {visibleApiKey ? app.apiKey : 'sk_live_' + '•'.repeat(16)}
                      </span>
                      <button
                        data-testid="button-copy-key"
                        onClick={() => copyToClipboard(app.apiKey, 'API Key')}
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs transition text-gray-400 hover:text-white"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        data-testid="button-toggle-key"
                        onClick={() => setVisibleApiKey(!visibleApiKey)}
                        className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs transition text-gray-400 hover:text-white"
                      >
                        {visibleApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-36 text-xs text-gray-500 uppercase font-medium pt-0.5">Status</div>
                  <div className="flex-1">
                    <span className="px-2 py-0.5 bg-white text-black text-[10px] uppercase font-bold rounded-full">
                      {statusBadge.label}
                    </span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-36 text-xs text-gray-500 uppercase font-medium pt-0.5">Created</div>
                  <div className="flex-1 text-sm text-gray-300">
                    {new Date(app.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-white/10 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-semibold text-gray-400 uppercase mb-1">Placements</h2>
                  <p className="text-xs text-gray-500">
                    Named placements available to campaigns. Each is a (template, slot, name) trio
                    — pick from <code className="text-gray-400">{appLocationsData.filter((l: any) => !l.deprecatedAt).length} declared slot{appLocationsData.filter((l: any) => !l.deprecatedAt).length !== 1 ? 's' : ''}</code>.
                  </p>
                </div>
                <button
                  data-testid="button-add-placement"
                  onClick={() => setAddComponentOpen(true)}
                  disabled={appLocationsData.filter((l: any) => !l.deprecatedAt).length === 0}
                  className="px-4 py-1.5 bg-white hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-black rounded text-xs font-medium flex items-center gap-2 transition"
                >
                  <Plus className="w-3 h-3" />
                  Add from library
                </button>
              </div>

              <div className="space-y-3">
                {appPlacementsData.length === 0 ? (
                  <div className="text-center py-8">
                    <Puzzle className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No placements created yet</p>
                    {appLocationsData.filter((l: any) => !l.deprecatedAt).length === 0 ? (
                      <p className="text-xs text-amber-400 mt-1">
                        ⚠ The app's SDK hasn't declared any locations yet. Cold-start the app once so the manifest registers slots.
                      </p>
                    ) : (
                      <p className="text-xs text-gray-600 mt-1">Click "Add from library" to bind a template to a declared slot.</p>
                    )}
                  </div>
                ) : (
                  appPlacementsData.map((pl: any) => {
                    const deprecated = !!pl.deprecatedAt;
                    return (
                      <div
                        key={pl.id}
                        className={`border ${deprecated ? 'border-amber-700/40 bg-amber-950/20' : 'border-white/10 hover:border-white/30'} rounded-lg p-4 flex items-center justify-between transition`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white/10 rounded flex items-center justify-center">
                            <Puzzle className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm text-white">{pl.name}</h3>
                              {deprecated && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-700/30 text-amber-300">deprecated</span>}
                            </div>
                            <p className="text-xs text-gray-500">
                              {pl.component?.type || 'unknown_type'} · <span className="text-gray-400">{pl.locationId}</span>
                            </p>
                          </div>
                        </div>
                        {!deprecated && (
                          <button
                            onClick={() => deprecatePlacementMutation.mutate(pl.id)}
                            className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-gray-500 hover:text-white transition"
                            data-testid={`button-deprecate-placement-${pl.id}`}
                            title="Deprecate placement (soft-delete; existing campaign uses keep rendering)"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="border border-white/10 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-semibold text-gray-400 uppercase mb-1">Campaigns</h2>
                  <p className="text-xs text-gray-500">Recent campaign activity</p>
                </div>
                <button
                  data-testid="button-new-campaign"
                  onClick={() => setLocation(`/campaigns/new?appId=${appIdNum}`)}
                  className="px-4 py-1.5 bg-white hover:bg-gray-200 text-black rounded text-xs font-medium flex items-center gap-2 transition"
                >
                  <Plus className="w-3 h-3" />
                  New Campaign
                </button>
              </div>

              <div className="space-y-3">
                {campaignsLoading ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">Loading campaigns...</p>
                  </div>
                ) : appCampaigns.length === 0 ? (
                  <div className="text-center py-8">
                    <Megaphone className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No campaigns yet</p>
                  </div>
                ) : (
                  appCampaigns.map((campaign) => {
                    const status = getCampaignStatus(campaign);
                    return (
                      <div
                        key={campaign.id}
                        data-testid={`card-campaign-${campaign.id}`}
                        className="border border-white/10 rounded-lg p-4 hover:border-white/30 transition cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/10 rounded flex items-center justify-center">
                              <Megaphone className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm text-white">{campaign.name}</h3>
                              {campaign.description && (
                                <p className="text-xs text-gray-500 line-clamp-1">{campaign.description}</p>
                              )}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 text-[10px] uppercase font-medium rounded border ${status.colorClass}`}>
                            {status.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Radio className="w-3 h-3" />
                              {campaign.broadcastCount ?? 0} broadcast{(campaign.broadcastCount ?? 0) !== 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {campaign.startDate
                                ? new Date(campaign.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : '—'}
                            </span>
                          </div>
                          <Link href={`/campaigns/${campaign.id}`}>
                            <button
                              data-testid={`button-view-campaign-${campaign.id}`}
                              className="text-gray-400 hover:text-white transition"
                            >
                              View →
                            </button>
                          </Link>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="border border-white/10 rounded-lg p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4">Quick Actions</h2>

              <div className="space-y-1">
                <button
                  data-testid="button-api-keys"
                  onClick={() => openSettingsModal('api-keys')}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded hover:bg-white/5 transition text-left"
                >
                  <div className="w-9 h-9 bg-white/10 rounded flex items-center justify-center flex-shrink-0">
                    <Key className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">API Keys</div>
                    <div className="text-xs text-gray-500">Manage authentication</div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-gray-500" />
                </button>

                <button
                  data-testid="button-branding"
                  onClick={() => openSettingsModal('branding')}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded hover:bg-white/5 transition text-left"
                >
                  <div className="w-9 h-9 bg-white/10 rounded flex items-center justify-center flex-shrink-0">
                    <Palette className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">Branding</div>
                    <div className="text-xs text-gray-500">Customize appearance</div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-gray-500" />
                </button>

                <button
                  data-testid="button-integrations"
                  onClick={() => openSettingsModal('integrations')}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded hover:bg-white/5 transition text-left"
                >
                  <div className="w-9 h-9 bg-white/10 rounded flex items-center justify-center flex-shrink-0">
                    <Plug className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">Integrations</div>
                    <div className="text-xs text-gray-500">Connect external services</div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-gray-500" />
                </button>

                <button
                  disabled
                  className="w-full flex items-center gap-3 px-3 py-3 rounded opacity-40 cursor-not-allowed text-left"
                >
                  <div className="w-9 h-9 bg-white/10 rounded flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">Team Access</div>
                    <div className="text-xs text-gray-500">Manage team members</div>
                  </div>
                  <span className="px-2 py-0.5 bg-white/10 text-gray-400 text-[10px] rounded">Soon</span>
                </button>

                <button
                  disabled
                  className="w-full flex items-center gap-3 px-3 py-3 rounded opacity-40 cursor-not-allowed text-left"
                >
                  <div className="w-9 h-9 bg-white/10 rounded flex items-center justify-center flex-shrink-0">
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">Security</div>
                    <div className="text-xs text-gray-500">Security settings</div>
                  </div>
                  <span className="px-2 py-0.5 bg-white/10 text-gray-400 text-[10px] rounded">Soon</span>
                </button>
              </div>
            </div>

            <div className="border border-white/10 rounded-lg p-6">
              <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4">Recent Activity</h2>
              <div className="text-center py-8">
                <Bell className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Activity tracking coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={platformsOpen} onOpenChange={setPlatformsOpen}>
        <DialogContent className="bg-[#141824] border border-white/10 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Platforms</DialogTitle>
            <DialogDescription>
              Where this surface runs. One surface can span web, mobile and TV — each platform keeps its
              own identifier.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {PLATFORM_KINDS.map(({ kind, label, placeholder }) => {
              const selected = kind in platformDraft;
              return (
                <div key={kind} className="flex items-center gap-3">
                  <label className="flex items-center gap-2 w-28 shrink-0 cursor-pointer">
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => togglePlatform(kind)}
                      data-testid={`checkbox-edit-platform-${kind}`}
                    />
                    <span className="text-sm text-gray-200">{label}</span>
                  </label>
                  <Input
                    value={platformDraft[kind] ?? ''}
                    onChange={(e) => setPlatformDraft((p) => ({ ...p, [kind]: e.target.value }))}
                    placeholder={placeholder}
                    disabled={!selected}
                    className="h-9 bg-white/5 border-white/10 text-gray-200"
                    data-testid={`input-edit-platform-${kind}`}
                  />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <button
              onClick={() => setPlatformsOpen(false)}
              className="px-4 py-2 rounded text-sm text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              onClick={() => platformsMutation.mutate(platformsToPayload(platformDraft))}
              disabled={platformsMutation.isPending}
              data-testid="button-save-platforms"
              className="px-4 py-2 bg-white hover:bg-gray-200 text-black rounded text-sm font-medium transition disabled:opacity-50"
            >
              {platformsMutation.isPending ? 'Saving…' : 'Save platforms'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="bg-[#141824] border border-white/10 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Edit App Details</DialogTitle>
            <DialogDescription className="text-gray-500">
              Update your app information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-400 text-xs uppercase">App Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-white/5 border-white/10 text-white mt-1"
                data-testid="input-edit-name"
              />
            </div>
            <div className={app.bundleId ? undefined : 'hidden'}>
              <Label className="text-gray-400 text-xs uppercase">Bundle ID</Label>
              <Input
                value={app.bundleId ?? ''}
                readOnly
                className="bg-white/5 border-white/10 text-gray-500 font-mono cursor-not-allowed mt-1"
                data-testid="input-edit-bundle-id"
              />
              <p className="text-xs text-gray-600 mt-1">Legacy — edit Platforms instead.</p>
            </div>
            <div>
              <Label className="text-gray-400 text-xs uppercase">Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Describe your app..."
                className="bg-white/5 border-white/10 text-white mt-1"
                data-testid="input-edit-description"
              />
            </div>
            <div>
              <Label className="text-gray-400 text-xs uppercase">Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1" data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141824] border-white/10">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ImageUploadWithPreview
              label="Logo"
              value={editIconUrl}
              onChange={setEditIconUrl}
              placeholder="Upload or paste logo URL"
              testId="input-edit-logo"
            />
            <ImageUploadWithPreview
              label="Banner"
              value={editBannerUrl}
              onChange={setEditBannerUrl}
              placeholder="Upload or paste banner URL"
              testId="input-edit-banner"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} className="border-white/10 text-gray-300 bg-transparent hover:bg-white/5">
              Cancel
            </Button>
            <Button
              onClick={() => updateAppMutation.mutate({ name: editName, description: editDescription, status: editStatus, iconUrl: editIconUrl || null, bannerUrl: editBannerUrl || null })}
              disabled={updateAppMutation.isPending || !editName.trim()}
              className="bg-white hover:bg-gray-200 text-black"
              data-testid="button-save-edit"
            >
              {updateAppMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="max-w-4xl h-[80vh] bg-[#141824] border border-white/10 p-0 overflow-hidden">
          <div className="flex h-full">
            <div className="w-52 border-r border-white/10 p-4 flex flex-col">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2">Settings</h3>
              <nav className="space-y-1">
                {[
                  { id: 'general', label: 'General', icon: Settings },
                  { id: 'api-keys', label: 'API Keys', icon: Key },
                  { id: 'branding', label: 'Branding', icon: Palette },
                  { id: 'platforms', label: 'Platforms', icon: Tv },
                  { id: 'integrations', label: 'Integrations', icon: Plug },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSettingsTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm transition text-left ${
                      settingsTab === tab.id
                        ? 'bg-white text-black'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
                <button
                  disabled
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-600 cursor-not-allowed text-left"
                >
                  <Bell className="w-4 h-4" />
                  Notifications
                  <span className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded">Soon</span>
                </button>
                <button
                  disabled
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm text-gray-600 cursor-not-allowed text-left"
                >
                  <Shield className="w-4 h-4" />
                  Security
                  <span className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded">Soon</span>
                </button>
              </nav>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              <DialogHeader className="mb-6">
                <DialogTitle className="text-white">
                  {settingsTab === 'general' && 'General Settings'}
                  {settingsTab === 'api-keys' && 'API Keys'}
                  {settingsTab === 'branding' && 'Branding'}
                  {settingsTab === 'platforms' && 'Platforms'}
                  {settingsTab === 'integrations' && 'Integrations'}
                </DialogTitle>
              </DialogHeader>

              {settingsTab === 'general' && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-gray-400 text-xs uppercase">WebSocket URL</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        value={`wss://${window.location.host}/ws`}
                        readOnly
                        className="bg-white/5 border-white/10 text-gray-300 font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(`wss://${window.location.host}/ws`, 'WebSocket URL')}
                        className="border-white/10 bg-transparent hover:bg-white/5 text-gray-400"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Auto-generated WebSocket endpoint for real-time communication</p>
                  </div>
                </div>
              )}

              {settingsTab === 'api-keys' && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-gray-400 text-xs uppercase">API Key</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="flex-1 bg-white/5 border border-white/10 px-3 py-2 rounded text-sm font-mono text-gray-200 overflow-hidden">
                        {visibleApiKey ? app.apiKey : '•'.repeat(Math.min(app.apiKey.length, 40))}
                      </code>
                      <Button variant="outline" size="icon" onClick={() => setVisibleApiKey(!visibleApiKey)} className="border-white/10 bg-transparent hover:bg-white/5 text-gray-400">
                        {visibleApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(app.apiKey, 'API Key')} className="border-white/10 bg-transparent hover:bg-white/5 text-gray-400">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setRegenerateDialogOpen(true)} className="border-white/10 bg-transparent hover:bg-white/5 text-gray-400">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded p-4">
                    <pre className="text-xs overflow-x-auto text-gray-400">
{`// Swift SDK
ReachuSDK.configure(
    apiKey: "${app.apiKey}",
    environment: .production
)`}
                    </pre>
                  </div>
                </div>
              )}

              {settingsTab === 'branding' && (
                <div className="text-center py-12">
                  <Palette className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-white mb-2">Branding Customization</h3>
                  <p className="text-sm text-gray-500">Customize your app's visual appearance. Coming soon.</p>
                </div>
              )}

              {settingsTab === 'platforms' && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-gray-200 text-sm font-medium">TV companion app</Label>
                        <p className="text-xs text-gray-500 mt-1">
                          Enable if this host app ships a TV companion (Apple TV / Android TV / …) that loads <code className="text-gray-400">VioTVSDK</code> or the Kotlin TV SDK. When off, <code className="text-gray-400">POST /v2/tv/broadcast/subscribe</code> returns <code className="text-gray-400">{"{subscribed:false, reason:\"tv_not_enabled_for_this_platform\"}"}</code> and the SDK stays idle.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer ml-4">
                        <input
                          type="checkbox"
                          checked={editTvEnabled}
                          onChange={(e) => setEditTvEnabled(e.target.checked)}
                          className="sr-only peer"
                          data-testid="toggle-tv-enabled"
                        />
                        <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-green-500/60 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition"></div>
                      </label>
                    </div>
                  </div>

                  <div className={editTvEnabled ? '' : 'opacity-40 pointer-events-none'}>
                    <Label className="text-gray-400 text-xs uppercase">Supported platforms</Label>
                    <p className="text-xs text-gray-500 mt-1 mb-3">
                      Pick which TV platforms this app supports. Subscribe rejects any TV client whose <code className="text-gray-400">platform</code> isn't in this list.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'apple-tv',   label: 'Apple TV',   sub: 'tvOS — VioTVSDK' },
                        { id: 'android-tv', label: 'Android TV', sub: 'Kotlin TV SDK (pending)' },
                        { id: 'fire-tv',    label: 'Fire TV',    sub: 'not supported yet' },
                        { id: 'roku',       label: 'Roku',       sub: 'not supported yet' },
                      ].map(p => {
                        const checked = editTvPlatforms.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                              checked
                                ? 'bg-green-500/5 border-green-500/30'
                                : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                setEditTvPlatforms(prev =>
                                  e.target.checked
                                    ? [...prev, p.id]
                                    : prev.filter(x => x !== p.id)
                                );
                              }}
                              className="mt-0.5 accent-green-500"
                              data-testid={`checkbox-tv-platform-${p.id}`}
                            />
                            <div className="flex-1">
                              <div className="text-sm text-white">{p.label}</div>
                              <div className="text-[11px] text-gray-500">{p.sub}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      updateAppMutation.mutate({
                        tvEnabled: editTvEnabled,
                        tvPlatforms: editTvEnabled ? editTvPlatforms : [],
                      });
                      setSettingsModalOpen(false);
                    }}
                    disabled={updateAppMutation.isPending}
                    className="bg-white hover:bg-gray-200 text-black"
                    data-testid="button-save-platforms"
                  >
                    {updateAppMutation.isPending ? 'Saving...' : 'Save platforms'}
                  </Button>
                </div>
              )}

              {settingsTab === 'integrations' && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-gray-400 text-xs uppercase">Partner Webhook URL</Label>
                    <Input
                      value={editWebhookUrl}
                      onChange={(e) => setEditWebhookUrl(e.target.value)}
                      placeholder="https://your-backend.com/webhook/vio-events"
                      className="bg-white/5 border-white/10 text-white font-mono text-sm mt-2"
                      data-testid="input-webhook-url"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      URL to receive all offline events from Vio (cart-intent, polls, contests, etc.). When users are offline, Vio sends events to your backend via webhook so you can deliver push notifications.
                    </p>
                    <p className="text-xs text-gray-600 mt-2">
                      POST body (canonical envelope):{" "}
                      <code className="text-gray-400">
                        {"{ vio_notification_version: 1, vio_event_type: \"...\", action: \"...\", userId, campaignId, ...eventData }"}
                      </code>
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Event types: <code className="text-gray-400">cart_intent, poll_created, contest_started, broadcast_live, ...</code>
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-400 text-xs uppercase">Partner device registration URL</Label>
                    <Input
                      value={editPartnerDeviceRegisterUrl}
                      onChange={(e) => setEditPartnerDeviceRegisterUrl(e.target.value)}
                      placeholder="https://partner.example.com/api/v1/partner/devices/register"
                      className="bg-white/5 border-white/10 text-white font-mono text-sm mt-2"
                      data-testid="input-partner-device-register-url"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      After each SDK <code className="text-gray-400">register-device</code>, Vio stores the token and optionally POSTs the same body to this URL:{" "}
                      <code className="text-gray-400">{"{ userId, deviceToken, platform }"}</code>. The partner keeps tokens in its own system for offline push. Leave empty to skip forward (Vio-only <code className="text-gray-400">device_tokens</code>).
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      updateAppMutation.mutate({
                        webhookUrl: editWebhookUrl || null,
                        partnerDeviceRegisterUrl: editPartnerDeviceRegisterUrl || null,
                      });
                      setSettingsModalOpen(false);
                    }}
                    disabled={updateAppMutation.isPending}
                    className="bg-white hover:bg-gray-200 text-black"
                    data-testid="button-save-integration-urls"
                  >
                    {updateAppMutation.isPending ? 'Saving...' : 'Save integration URLs'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddPlacementFromLibraryDialog
        open={addComponentOpen}
        onOpenChange={setAddComponentOpen}
        availableComponents={availableComponents}
        availableLocations={appLocationsData.filter((l: any) => !l.deprecatedAt)}
        existingPlacementNames={new Set(appPlacementsData.filter((p: any) => !p.deprecatedAt).map((p: any) => p.name))}
        onSubmit={(args) => {
          createPlacementMutation.mutate(args, {
            onSuccess: () => setAddComponentOpen(false)
          });
        }}
        submitting={createPlacementMutation.isPending}
      />

      <AlertDialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <AlertDialogContent className="bg-[#141824] border border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Regenerate API Key?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500">
              This will invalidate the current key. Any SDK using the old key will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 text-gray-300 bg-transparent hover:bg-white/5">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => regenerateKeyMutation.mutate()}
              className="bg-white hover:bg-gray-200 text-black"
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

// ── Add-from-library dialog ────────────────────────────────────────────────
// Inline component (per rule #7: no new files for this iteration). Renders
// the 3-field form for creating a named app_placement from a library
// template + a declared location.
function AddPlacementFromLibraryDialog({
  open,
  onOpenChange,
  availableComponents,
  availableLocations,
  existingPlacementNames,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableComponents: any[];
  availableLocations: any[];
  existingPlacementNames: Set<string>;
  onSubmit: (args: { componentId: string; locationId: string; name: string }) => void;
  submitting: boolean;
}) {
  const [componentId, setComponentId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [name, setName] = useState('');

  // Reset on open/close so the form is fresh each time.
  React.useEffect(() => {
    if (!open) {
      setComponentId('');
      setLocationId('');
      setName('');
    }
  }, [open]);

  const trimmedName = name.trim();
  const nameTaken = trimmedName !== '' && existingPlacementNames.has(trimmedName);
  const canSubmit = componentId !== '' && locationId !== '' && trimmedName !== '' && !nameTaken && !submitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#141824] border border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Add placement from library</DialogTitle>
          <DialogDescription className="text-gray-500">
            Pick a template, a slot the SDK declared, and give it a human name.
            The result is available to all campaigns of this app.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Template</label>
            <select
              data-testid="select-placement-component"
              value={componentId}
              onChange={(e) => setComponentId(e.target.value)}
              className="w-full bg-[#0d1018] border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
            >
              <option value="">— Select a template —</option>
              {availableComponents.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Slot location (declared by SDK)</label>
            <select
              data-testid="select-placement-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full bg-[#0d1018] border border-white/10 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
            >
              <option value="">— Select a slot —</option>
              {availableLocations.map((l: any) => (
                <option key={l.locationId} value={l.locationId}>
                  {l.locationId}{l.displayName ? ` — ${l.displayName}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Name</label>
            <input
              data-testid="input-placement-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Carrusel home"
              className="w-full bg-[#0d1018] border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
            />
            {nameTaken && (
              <p className="text-xs text-red-400 mt-1">Name already used by another placement in this app.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-1.5 text-xs text-gray-300 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            data-testid="button-submit-placement"
            disabled={!canSubmit}
            onClick={() => onSubmit({ componentId, locationId, name: trimmedName })}
            className="px-4 py-1.5 bg-white hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-black rounded text-xs font-medium transition"
          >
            {submitting ? 'Creating…' : 'Create placement'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
