import { useParams, Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
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
import { ImageUploadWithPreview } from '@/components/ImageUploadWithPreview';
import { ArrowLeft, Plus, Key, Copy, RefreshCw, Eye, EyeOff, Settings, ChevronRight, Megaphone, Puzzle, BarChart3, Users, Radio, Palette, Shield, Bell, Plug, X } from 'lucide-react';

const gradients = [
  'from-gray-700 to-gray-800',
  'from-gray-600 to-gray-800',
  'from-gray-500 to-gray-700',
  'from-gray-600 to-gray-700',
];

function formatViewers(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function getCampaignStatus(campaign: Campaign): { label: string; color: string; bgColor: string; borderColor: string } {
  if (campaign.isPaused === 'true') {
    return { label: 'Paused', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/20' };
  }
  if (campaign.startDate && new Date(campaign.startDate) > new Date()) {
    return { label: 'Upcoming', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/20' };
  }
  if (campaign.endDate && new Date(campaign.endDate) < new Date()) {
    return { label: 'Ended', color: 'text-gray-400', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/20' };
  }
  return { label: 'Active', color: 'text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20' };
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return { label: 'Active', color: 'text-green-400 dark:text-green-400', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/20' };
    case 'paused':
      return { label: 'Paused', color: 'text-yellow-400 dark:text-yellow-400', bgColor: 'bg-yellow-500/10', borderColor: 'border-yellow-500/20' };
    case 'archived':
      return { label: 'Archived', color: 'text-gray-400 dark:text-gray-400', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/20' };
    default:
      return { label: status, color: 'text-gray-400', bgColor: 'bg-gray-500/10', borderColor: 'border-gray-500/20' };
  }
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

  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editIconUrl, setEditIconUrl] = useState('');
  const [editBannerUrl, setEditBannerUrl] = useState('');
  const [editingReachuKey, setEditingReachuKey] = useState('');
  const [reachuKeyInitialized, setReachuKeyInitialized] = useState(false);

  const { data: app, isLoading: appLoading } = useQuery<ClientApp>({
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

  const { data: appCampaigns = [], isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/client-apps', appIdNum, 'campaigns'],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps/${appIdNum}/campaigns`);
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      return res.json();
    },
    enabled: !!appIdNum
  });

  const { data: appComponentsData = [] } = useQuery<any[]>({
    queryKey: ['/api/client-apps', appIdNum, 'components'],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps/${appIdNum}/components`);
      if (!res.ok) throw new Error('Failed to fetch components');
      return res.json();
    },
    enabled: !!appIdNum
  });

  const { data: allComponents = [] } = useQuery<ComponentType[]>({
    queryKey: ['/api/components'],
    queryFn: async () => {
      const res = await fetch('/api/components');
      if (!res.ok) throw new Error('Failed to fetch components');
      return res.json();
    },
    enabled: addComponentOpen
  });

  useEffect(() => {
    if (app && !reachuKeyInitialized) {
      setEditingReachuKey(app.reachuApiKey || '');
      setReachuKeyInitialized(true);
    }
  }, [app, reachuKeyInitialized]);

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

  const updateReachuKeyMutation = useMutation({
    mutationFn: async (reachuApiKey: string) => {
      const response = await apiRequest('PATCH', `/api/client-apps/${appIdNum}`, { userId, reachuApiKey });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', appIdNum] });
      toast({ title: 'Reachu API Key Updated', description: 'The key has been saved.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update key', variant: 'destructive' });
    }
  });

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
    setSettingsTab(tab);
    setSettingsModalOpen(true);
  };

  const activeCampaignsCount = appCampaigns.filter(c => {
    const status = getCampaignStatus(c);
    return status.label === 'Active' || status.label === 'Upcoming';
  }).length;

  const liveBroadcastsCount = currentAppStats?.broadcastCount || 0;
  const totalViewers = currentAppStats?.totalViewers || 0;
  const engagementRate = currentAppStats?.engagementRate || 75;

  const assignedComponentIds = new Set(appComponentsData.map((ac: any) => ac.componentId));
  const availableComponents = allComponents.filter(c => !assignedComponentIds.has(c.id));

  if (appLoading || userLoading || (!app && !userId)) {
    return (
      <AppLayout breadcrumbs={[{ label: 'My Apps', href: '/apps' }, { label: 'Loading...' }]}>
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading app...</p>
        </div>
      </AppLayout>
    );
  }

  if (!app) {
    return (
      <AppLayout breadcrumbs={[{ label: 'My Apps', href: '/apps' }, { label: 'Not Found' }]}>
        <div className="text-center py-12">
          <p className="text-gray-900 dark:text-gray-100">App not found</p>
        </div>
      </AppLayout>
    );
  }

  const statusBadge = getStatusBadge(app.status || 'active');

  return (
    <AppLayout breadcrumbs={[{ label: 'My Apps', href: '/apps' }, { label: app.name }]}>
      <div className="space-y-6">
        {app.bannerUrl && (
          <div className="relative h-32 rounded-xl overflow-hidden -mt-2 mb-2">
            <img src={app.bannerUrl} alt={`${app.name} banner`} className="w-full h-full object-cover" data-testid="img-app-banner" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        )}
        <div className="flex items-center gap-4">
          <Link href="/apps">
            <button
              data-testid="button-back"
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          {app.iconUrl && (
            <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-gray-200 dark:border-gray-600 shadow-sm flex-shrink-0">
              <img src={app.iconUrl} alt={`${app.name} logo`} className="w-full h-full object-cover" data-testid="img-app-logo" />
            </div>
          )}
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100" data-testid="text-app-name">{app.name}</h1>
          <span
            data-testid="badge-app-status"
            className={`px-3 py-1 ${statusBadge.bgColor} ${statusBadge.color} text-xs rounded-full border ${statusBadge.borderColor}`}
          >
            {statusBadge.label}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div data-testid="stat-campaigns" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#3d8b7a]/10 dark:bg-white/10 rounded-lg flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-[#3d8b7a] dark:text-gray-300" />
              </div>
              <span className="text-xs text-green-400 flex items-center gap-1">
                <span>↑</span>
                <span>12%</span>
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{activeCampaignsCount}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Active Campaigns</div>
          </div>

          <div data-testid="stat-broadcasts" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-[#3d8b7a]/10 dark:bg-white/10 rounded-lg flex items-center justify-center">
                <Radio className="w-5 h-5 text-[#3d8b7a] dark:text-gray-300" />
              </div>
              <span className="text-xs text-green-400 flex items-center gap-1">
                <span>↑</span>
                <span>8%</span>
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{liveBroadcastsCount}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Live Broadcasts</div>
          </div>

          <div data-testid="stat-viewers" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-green-400" />
              </div>
              <span className="text-xs text-green-400 flex items-center gap-1">
                <span>↑</span>
                <span>24%</span>
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{formatViewers(totalViewers)}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Viewers</div>
          </div>

          <div data-testid="stat-engagement" className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-pink-500/10 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-pink-400" />
              </div>
              <span className="text-xs text-green-400 flex items-center gap-1">
                <span>↑</span>
                <span>18%</span>
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{engagementRate}%</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Engagement Rate</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">App Details</h2>
                <Button
                  data-testid="button-edit-details"
                  size="sm"
                  onClick={openEditModal}
                  className="bg-[#3d8b7a] hover:bg-[#2f7365] text-white dark:bg-white dark:hover:bg-gray-200 dark:text-[#0a0e1a]"
                >
                  Edit Details
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="w-32 text-sm text-gray-500 dark:text-gray-400">App Name</div>
                  <div className="flex-1 text-sm text-gray-900 dark:text-gray-100">{app.name}</div>
                </div>
                <div className="flex items-start">
                  <div className="w-32 text-sm text-gray-500 dark:text-gray-400">Bundle ID</div>
                  <div className="flex-1 text-sm font-mono bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg inline-block text-gray-900 dark:text-gray-100">{app.bundleId}</div>
                </div>
                <div className="flex items-start">
                  <div className="w-32 text-sm text-gray-500 dark:text-gray-400">API Key</div>
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg text-gray-900 dark:text-gray-100">
                        {visibleApiKey ? app.apiKey : 'sk_live_' + '•'.repeat(16)}
                      </span>
                      <button
                        data-testid="button-copy-key"
                        onClick={() => copyToClipboard(app.apiKey, 'API Key')}
                        className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-xs transition text-gray-600 dark:text-gray-300"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        data-testid="button-toggle-key"
                        onClick={() => setVisibleApiKey(!visibleApiKey)}
                        className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-xs transition text-gray-600 dark:text-gray-300"
                      >
                        {visibleApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-32 text-sm text-gray-500 dark:text-gray-400">Status</div>
                  <div className="flex-1">
                    <span className={`px-3 py-1 ${statusBadge.bgColor} ${statusBadge.color} text-xs rounded-full border ${statusBadge.borderColor}`}>
                      {statusBadge.label}
                    </span>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-32 text-sm text-gray-500 dark:text-gray-400">Created</div>
                  <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
                    {new Date(app.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Components</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Components assigned to this app</p>
                </div>
                <Button
                  data-testid="button-add-component"
                  size="sm"
                  onClick={() => setAddComponentOpen(true)}
                  className="bg-[#3d8b7a] hover:bg-[#2f7365] text-white dark:bg-white dark:hover:bg-gray-200 dark:text-[#0a0e1a] gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Component
                </Button>
              </div>

              <div className="space-y-3">
                {appComponentsData.length === 0 ? (
                  <div className="text-center py-8">
                    <Puzzle className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No components assigned yet</p>
                  </div>
                ) : (
                  appComponentsData.map((ac: any) => (
                    <div
                      key={ac.id}
                      className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#3d8b7a]/10 dark:bg-white/10 rounded-lg flex items-center justify-center">
                          <Puzzle className="w-4 h-4 text-[#3d8b7a] dark:text-gray-300" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{ac.component?.name || ac.componentId}</h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{ac.component?.type || 'Component'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeComponentMutation.mutate(ac.componentId)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition"
                        data-testid={`button-remove-component-${ac.componentId}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Active Campaigns</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Recent campaign activity</p>
                </div>
                <Button
                  data-testid="button-new-campaign"
                  size="sm"
                  onClick={() => setLocation(`/campaigns/new?appId=${appIdNum}`)}
                  className="bg-[#3d8b7a] hover:bg-[#2f7365] text-white dark:bg-white dark:hover:bg-gray-200 dark:text-[#0a0e1a] gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New Campaign
                </Button>
              </div>

              <div className="space-y-3">
                {campaignsLoading ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Loading campaigns...</p>
                  </div>
                ) : appCampaigns.length === 0 ? (
                  <div className="text-center py-8">
                    <Megaphone className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">No campaigns yet</p>
                  </div>
                ) : (
                  appCampaigns.map((campaign, index) => {
                    const status = getCampaignStatus(campaign);
                    const gradient = gradients[index % gradients.length];
                    return (
                      <div
                        key={campaign.id}
                        data-testid={`card-campaign-${campaign.id}`}
                        className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:border-[#3d8b7a] dark:hover:border-white/30 transition cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 bg-gradient-to-br ${gradient} rounded-lg flex items-center justify-center`}>
                              <Megaphone className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm text-gray-900 dark:text-white">{campaign.name}</h3>
                              {campaign.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{campaign.description}</p>
                              )}
                            </div>
                          </div>
                          <span className={`px-2 py-1 ${status.bgColor} ${status.color} text-xs rounded border ${status.borderColor}`}>
                            {status.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Radio className="w-3 h-3" />
                              0 broadcasts
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {campaign.startDate
                                ? new Date(campaign.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : '0 viewers'}
                            </span>
                          </div>
                          <Link href={`/campaigns/${campaign.id}`}>
                            <button
                              data-testid={`button-view-campaign-${campaign.id}`}
                              className="text-[#3d8b7a] dark:text-gray-300 hover:text-[#2f7365] dark:hover:text-gray-200 transition"
                            >
                              View Details →
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
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Quick Actions</h2>

              <div className="space-y-2">
                <button
                  data-testid="button-settings"
                  onClick={() => openSettingsModal('general')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left"
                >
                  <div className="w-10 h-10 bg-[#3d8b7a]/10 dark:bg-white/10 rounded-lg flex items-center justify-center">
                    <Settings className="w-4 h-4 text-[#3d8b7a] dark:text-gray-300" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">App Settings</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Configuration & preferences</div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                </button>

                <button
                  data-testid="button-api-keys"
                  onClick={() => openSettingsModal('api-keys')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left"
                >
                  <div className="w-10 h-10 bg-[#3d8b7a]/10 dark:bg-white/10 rounded-lg flex items-center justify-center">
                    <Key className="w-4 h-4 text-[#3d8b7a] dark:text-gray-300" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">API Keys</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Manage authentication</div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                </button>

                <button
                  data-testid="button-branding"
                  onClick={() => openSettingsModal('branding')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left"
                >
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <Palette className="w-4 h-4 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Branding</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Customize appearance</div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                </button>

                <button
                  data-testid="button-integrations"
                  onClick={() => openSettingsModal('integrations')}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left"
                >
                  <div className="w-10 h-10 bg-pink-500/10 rounded-lg flex items-center justify-center">
                    <Plug className="w-4 h-4 text-pink-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Integrations</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Connect external services</div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-gray-400" />
                </button>

                <button
                  disabled
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg opacity-50 cursor-not-allowed text-left"
                >
                  <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
                    <Users className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Team Access</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Manage team members</div>
                  </div>
                  <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 text-[10px] rounded-full">Coming Soon</span>
                </button>

                <button
                  disabled
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg opacity-50 cursor-not-allowed text-left"
                >
                  <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
                    <Shield className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Security</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Security settings</div>
                  </div>
                  <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400 text-[10px] rounded-full">Coming Soon</span>
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h2>
              <div className="text-center py-8">
                <Bell className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Activity tracking coming soon</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Edit App Details</DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              Update your app information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-gray-700 dark:text-gray-300">App Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                data-testid="input-edit-name"
              />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Bundle ID</Label>
              <Input
                value={app.bundleId}
                readOnly
                className="bg-gray-100 dark:bg-gray-600 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 font-mono cursor-not-allowed"
                data-testid="input-edit-bundle-id"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Cannot be changed after creation</p>
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Describe your app..."
                className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                data-testid="input-edit-description"
              />
            </div>
            <div>
              <Label className="text-gray-700 dark:text-gray-300">Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white" data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600">
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
            <Button variant="outline" onClick={() => setEditModalOpen(false)} className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">
              Cancel
            </Button>
            <Button
              onClick={() => updateAppMutation.mutate({ name: editName, description: editDescription, status: editStatus, iconUrl: editIconUrl || null, bannerUrl: editBannerUrl || null })}
              disabled={updateAppMutation.isPending || !editName.trim()}
              className="bg-[#3d8b7a] hover:bg-[#2f7365] text-white dark:bg-white dark:hover:bg-gray-200 dark:text-[#0a0e1a]"
              data-testid="button-save-edit"
            >
              {updateAppMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsModalOpen} onOpenChange={setSettingsModalOpen}>
        <DialogContent className="max-w-4xl h-[80vh] bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 p-0 overflow-hidden">
          <div className="flex h-full">
            <div className="w-56 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 px-3">Settings</h3>
              <nav className="space-y-1">
                {[
                  { id: 'general', label: 'General', icon: Settings },
                  { id: 'api-keys', label: 'API Keys', icon: Key },
                  { id: 'branding', label: 'Branding', icon: Palette },
                  { id: 'integrations', label: 'Integrations', icon: Plug },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSettingsTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition text-left ${
                      settingsTab === tab.id
                        ? 'bg-[#3d8b7a] text-white dark:bg-white dark:text-[#0a0e1a]'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
                <button
                  disabled
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed text-left"
                >
                  <Bell className="w-4 h-4" />
                  Notifications
                  <span className="ml-auto text-[10px] bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">Soon</span>
                </button>
                <button
                  disabled
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 dark:text-gray-500 cursor-not-allowed text-left"
                >
                  <Shield className="w-4 h-4" />
                  Security
                  <span className="ml-auto text-[10px] bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded">Soon</span>
                </button>
              </nav>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              <DialogHeader className="mb-6">
                <DialogTitle className="text-gray-900 dark:text-white">
                  {settingsTab === 'general' && 'General Settings'}
                  {settingsTab === 'api-keys' && 'API Keys'}
                  {settingsTab === 'branding' && 'Branding'}
                  {settingsTab === 'integrations' && 'Integrations'}
                </DialogTitle>
              </DialogHeader>

              {settingsTab === 'general' && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">WebSocket URL</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        value={`wss://${window.location.host}/ws`}
                        readOnly
                        className="bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(`wss://${window.location.host}/ws`, 'WebSocket URL')}
                        className="border-gray-200 dark:border-gray-600"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Auto-generated WebSocket endpoint for real-time communication</p>
                  </div>
                </div>
              )}

              {settingsTab === 'api-keys' && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">API Key</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="flex-1 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg text-sm font-mono text-gray-900 dark:text-gray-100 overflow-hidden">
                        {visibleApiKey ? app.apiKey : '•'.repeat(Math.min(app.apiKey.length, 40))}
                      </code>
                      <Button variant="outline" size="icon" onClick={() => setVisibleApiKey(!visibleApiKey)} className="border-gray-200 dark:border-gray-600">
                        {visibleApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(app.apiKey, 'API Key')} className="border-gray-200 dark:border-gray-600">
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setRegenerateDialogOpen(true)} className="border-gray-200 dark:border-gray-600">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-4">
                    <pre className="text-xs overflow-x-auto text-gray-700 dark:text-gray-300">
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
                  <Palette className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Branding Customization</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Customize your app's visual appearance. Coming soon.</p>
                </div>
              )}

              {settingsTab === 'integrations' && (
                <div className="space-y-6">
                  <div>
                    <Label className="text-gray-700 dark:text-gray-300">Reachu API Key</Label>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">External API key for Reachu integration (optional)</p>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Enter Reachu API key..."
                        value={editingReachuKey}
                        onChange={(e) => setEditingReachuKey(e.target.value)}
                        className="flex-1 font-mono text-sm bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                        data-testid="input-reachu-key"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={updateReachuKeyMutation.isPending}
                        onClick={() => updateReachuKeyMutation.mutate(editingReachuKey)}
                        className="border-gray-200 dark:border-gray-600"
                        data-testid="button-save-reachu-key"
                      >
                        {updateReachuKeyMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addComponentOpen} onOpenChange={setAddComponentOpen}>
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-white">Add Component</DialogTitle>
            <DialogDescription className="text-gray-500 dark:text-gray-400">
              Select a component from the library to add to this app
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto py-2">
            {availableComponents.length === 0 ? (
              <div className="text-center py-8">
                <Puzzle className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No available components to add</p>
              </div>
            ) : (
              availableComponents.map(comp => (
                <button
                  key={comp.id}
                  onClick={() => {
                    addComponentMutation.mutate(comp.id);
                    setAddComponentOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition text-left border border-gray-200 dark:border-gray-600"
                  data-testid={`button-select-component-${comp.id}`}
                >
                  <div className="w-10 h-10 bg-[#3d8b7a]/10 dark:bg-white/10 rounded-lg flex items-center justify-center">
                    <Puzzle className="w-4 h-4 text-[#3d8b7a] dark:text-gray-300" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">{comp.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{comp.type}</div>
                  </div>
                  <Plus className="w-4 h-4 text-gray-400" />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={regenerateDialogOpen} onOpenChange={setRegenerateDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-900 dark:text-white">Regenerate API Key?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
              This will invalidate the current key. Any SDK using the old key will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => regenerateKeyMutation.mutate()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
