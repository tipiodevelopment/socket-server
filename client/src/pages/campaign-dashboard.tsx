import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pause, Play, MoreVertical, BarChart3, Radio, Puzzle, Settings, Activity, Eye, TrendingUp, ExternalLink, Zap } from "lucide-react";
import { Campaign, Sponsor, Broadcast } from "@shared/schema";
import { OverviewTab } from "@/components/dashboard/OverviewTab";
import { EventsTab } from "@/components/dashboard/EventsTab";
import { ScheduledTab } from "@/components/dashboard/ScheduledTab";
import { ComponentsTab } from "@/components/dashboard/ComponentsTab";
import { IntegrationsTab } from "@/components/dashboard/IntegrationsTab";
import { SettingsTab } from "@/components/dashboard/SettingsTab";
import { AppLayout } from "@/components/AppLayout";
import type { BreadcrumbItem } from "@/components/AppLayout";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type CampaignStatus = 'active' | 'upcoming' | 'ended' | 'paused';

function getCampaignStatus(campaign: Campaign): CampaignStatus {
  if (campaign.isPaused === 'true') return 'paused';
  const now = new Date();
  if (campaign.endDate && new Date(campaign.endDate) < now) return 'ended';
  if (campaign.startDate && new Date(campaign.startDate) > now) return 'upcoming';
  return 'active';
}

const STATUS_STYLES: Record<CampaignStatus, string> = {
  active: 'bg-[#3d8b7a] text-white dark:bg-white dark:text-black border-[#3d8b7a] dark:border-white',
  upcoming: 'bg-white/10 text-gray-300 border-white/20',
  ended: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const TABS = [
  { value: 'overview', label: 'Overview', icon: BarChart3 },
  { value: 'broadcasts', label: 'Broadcasts', icon: Radio },
  { value: 'components', label: 'Components', icon: Puzzle },
  { value: 'live', label: 'Live', icon: Zap },
  { value: 'analytics', label: 'Analytics', icon: Activity },
  { value: 'settings', label: 'Settings', icon: Settings },
] as const;

export default function CampaignDashboard() {
  const params = useParams();
  const { userId } = useUser();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const campaignId = params.campaignId ? parseInt(params.campaignId) : (params.id ? parseInt(params.id) : null);
  const [activeTab, setActiveTab] = useState<string>('overview');

  const { data: campaign, isLoading } = useQuery<Campaign & { clientAppName?: string | null; channelName?: string | null }>({
    queryKey: ['/api/campaigns', campaignId],
    enabled: !!campaignId
  });

  const { data: campaignBroadcasts = [] } = useQuery<Broadcast[]>({
    queryKey: ['/api/broadcasts', { campaignId }],
    queryFn: async () => {
      const res = await fetch(`/api/broadcasts?campaignId=${campaignId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!campaignId && activeTab === 'analytics',
  });

  const { data: sponsors = [] } = useQuery<Sponsor[]>({
    queryKey: ['/api/sponsors', userId],
    queryFn: async () => {
      const res = await fetch(`/api/sponsors?userId=${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
  });

  const togglePauseMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('PATCH', `/api/campaigns/${campaignId}/toggle-pause`, {});
    },
    onSuccess: async (data: any) => {
      const isPaused = data.isPaused === 'true';
      toast({
        title: isPaused ? 'Campaign Paused' : 'Campaign Resumed',
        description: isPaused
          ? 'All components are now hidden from viewers'
          : 'Campaign is now active and broadcasting',
      });
      await queryClient.invalidateQueries({
        queryKey: ['/api/campaigns', campaignId],
        refetchType: 'active'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle campaign state.',
        variant: 'destructive',
      });
    },
  });

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Campaigns', href: '/campaigns' },
  ];
  if (campaign) {
    breadcrumbs.push({ label: campaign.name });
  } else {
    breadcrumbs.push({ label: 'Loading...' });
  }

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading campaign...</p>
        </div>
      </AppLayout>
    );
  }

  if (!campaign) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="text-center py-12">
          <p className="text-foreground">Campaign not found</p>
        </div>
      </AppLayout>
    );
  }

  const status = getCampaignStatus(campaign);
  const isPaused = campaign.isPaused === 'true';

  const appName = campaign.clientAppName || null;
  const channelName = campaign.channelName || null;
  const sponsor = campaign.sponsorId ? sponsors.find(s => s.id === campaign.sponsorId) : undefined;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="mb-6 pb-6 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/campaigns')}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-3 mb-1">
                {sponsor?.avatarUrl && (
                  <img
                    src={sponsor.avatarUrl}
                    alt={sponsor.name}
                    className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-white/10"
                    data-testid="img-campaign-sponsor"
                  />
                )}
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-campaign-name">
                  {campaign.name}
                </h1>
                <span
                  className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded-full border ${STATUS_STYLES[status]}`}
                  data-testid="badge-campaign-status"
                >
                  {status}
                </span>
              </div>
              {(appName || channelName) && (
                <div className="flex items-center text-xs text-gray-400 dark:text-gray-500 gap-2">
                  {appName && <span className="text-gray-500 dark:text-gray-300" data-testid="text-campaign-app">{appName}</span>}
                  {appName && channelName && <span className="text-gray-300 dark:text-gray-700">/</span>}
                  {channelName && <span className="text-gray-500 dark:text-gray-300" data-testid="text-campaign-channel">{channelName}</span>}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => togglePauseMutation.mutate()}
              disabled={togglePauseMutation.isPending || status === 'ended'}
              className="gap-2 border-gray-200 dark:border-white/20 hover:border-gray-300 dark:hover:border-white/40"
              data-testid="button-toggle-pause"
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  <span>Pause</span>
                </>
              )}
            </Button>
            <button
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-white transition"
              data-testid="button-more-options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 dark:border-white/10 mb-6">
        <div className="flex items-center gap-1">
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              data-testid={`tab-${tab.value}`}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                activeTab === tab.value
                  ? 'text-gray-900 dark:text-white border-gray-900 dark:border-white'
                  : 'text-gray-400 border-transparent hover:text-gray-600 dark:hover:text-white hover:border-gray-300 dark:hover:border-white/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {activeTab === 'overview' && (
          <OverviewTab campaignId={campaignId!} campaign={campaign} onNavigateTab={setActiveTab} />
        )}
        {activeTab === 'broadcasts' && (
          <BroadcastsTab campaignId={campaignId!} />
        )}
        {activeTab === 'components' && (
          <ComponentsTab campaignId={campaignId!} />
        )}
        {activeTab === 'live' && (
          <div className="space-y-8">
            <EventsTab campaignId={campaignId!} campaign={campaign} />
            <ScheduledTab campaignId={campaignId!} />
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="space-y-8">
            <SettingsTab campaignId={campaignId!} campaign={campaign} />
            <IntegrationsTab campaignId={campaignId!} campaign={campaign} />
          </div>
        )}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Radio, label: 'Total Broadcasts', value: campaignBroadcasts.length.toLocaleString() },
                { icon: Activity, label: 'Live Now', value: campaignBroadcasts.filter(b => b.status === 'live').length.toLocaleString() },
                { icon: Eye, label: 'Total Viewers', value: campaignBroadcasts.reduce((sum, b) => sum + (b.viewerCount ?? 0), 0).toLocaleString() },
                { icon: TrendingUp, label: 'Peak Viewers', value: Math.max(0, ...campaignBroadcasts.map(b => b.peakViewers ?? 0)).toLocaleString() },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <div className="text-xs text-gray-400 dark:text-gray-500">{label}</div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
                </div>
              ))}
            </div>

            {campaignBroadcasts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl">
                <Activity className="w-12 h-12 text-gray-300 dark:text-white/20 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No broadcasts yet</h3>
                <p className="text-sm text-gray-500 dark:text-white/40">Analytics data will appear when you create broadcasts for this campaign.</p>
              </div>
            ) : (
              <div className="bg-white dark:bg-black border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Broadcast Performance</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-white/10">
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">Broadcast</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">Viewers</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase">Peak</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 dark:text-gray-500 uppercase"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-white/10">
                    {campaignBroadcasts.map(b => (
                      <tr key={b.broadcastId} className="hover:bg-gray-50 dark:hover:bg-white/5 transition group" data-testid={`row-broadcast-${b.broadcastId}`}>
                        <td className="px-6 py-3 text-gray-900 dark:text-white font-medium">{b.broadcastName}</td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                            b.status === 'live' ? 'bg-green-500/20 text-green-400' :
                            b.status === 'upcoming' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>{b.status}</span>
                        </td>
                        <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-300">{(b.viewerCount ?? 0).toLocaleString()}</td>
                        <td className="px-6 py-3 text-right text-gray-600 dark:text-gray-300">{(b.peakViewers ?? 0).toLocaleString()}</td>
                        <td className="px-6 py-3 text-right">
                          <Link href={`/broadcasts/${b.broadcastId}`}>
                            <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white opacity-0 group-hover:opacity-100 transition cursor-pointer" data-testid={`link-broadcast-detail-${b.broadcastId}`}>
                              <ExternalLink className="w-3 h-3" />
                              View
                            </span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Clock, Filter, Calendar } from 'lucide-react';

function getStatusBadge(status: string) {
  switch (status) {
    case 'live':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400" data-testid="badge-status-live">Live</span>;
    case 'ended':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400" data-testid="badge-status-ended">Ended</span>;
    case 'upcoming':
    default:
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400" data-testid="badge-status-upcoming">Upcoming</span>;
  }
}

function BroadcastsTab({ campaignId }: { campaignId: number }) {
  const { toast } = useToast();
  const { userId } = useUser();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    broadcastName: '',
    externalId: '',
    startTime: '',
    endTime: '',
    metadata: '',
  });

  const { data: broadcasts = [], isLoading } = useQuery<Broadcast[]>({
    queryKey: ['/api/broadcasts', campaignId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('campaignId', String(campaignId));
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/broadcasts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch broadcasts');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return await apiRequest('POST', '/api/broadcasts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', campaignId] });
      toast({ title: 'Broadcast Created', description: 'The broadcast has been created.' });
      setCreateOpen(false);
      setFormData({ broadcastName: '', externalId: '', startTime: '', endTime: '', metadata: '' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create broadcast.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (broadcastId: string) => {
      return await apiRequest('DELETE', `/api/broadcasts/${broadcastId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', campaignId] });
      toast({ title: 'Broadcast Deleted', description: 'The broadcast has been deleted.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete broadcast.', variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    if (!formData.broadcastName.trim()) {
      toast({ title: 'Validation Error', description: 'Broadcast name is required.', variant: 'destructive' });
      return;
    }
    let metadata = undefined;
    if (formData.metadata.trim()) {
      try {
        metadata = JSON.parse(formData.metadata);
      } catch {
        toast({ title: 'Validation Error', description: 'Metadata must be valid JSON.', variant: 'destructive' });
        return;
      }
    }
    createMutation.mutate({
      broadcastName: formData.broadcastName,
      externalId: formData.externalId.trim() || undefined,
      campaignId,
      startTime: formData.startTime || undefined,
      endTime: formData.endTime || undefined,
      metadata,
      createdBy: userId,
    });
  };

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'live', label: 'Live' },
    { value: 'ended', label: 'Ended' },
  ];

  const broadcastDetailHref = (broadcastId: string) => `/broadcasts/${broadcastId}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              data-testid={`filter-broadcast-${option.value}`}
              className={`px-3.5 py-1.5 text-sm rounded-md transition-all ${
                statusFilter === option.value
                  ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white font-medium shadow-sm'
                  : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-broadcast" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              New Broadcast
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Broadcast</DialogTitle>
              <DialogDescription>Create a new broadcast for this campaign.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="broadcastName">Broadcast Name *</Label>
                <Input
                  id="broadcastName"
                  data-testid="input-broadcast-name"
                  value={formData.broadcastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, broadcastName: e.target.value }))}
                  placeholder="Enter broadcast name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="externalId">External Content ID</Label>
                <Input
                  id="externalId"
                  data-testid="input-external-id"
                  value={formData.externalId}
                  onChange={(e) => setFormData(prev => ({ ...prev, externalId: e.target.value }))}
                  placeholder="e.g. match-12345 (used by SDK to identify this broadcast)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    data-testid="input-start-time"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input
                    id="endTime"
                    type="datetime-local"
                    data-testid="input-end-time"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="metadata">Metadata (JSON)</Label>
                <Textarea
                  id="metadata"
                  data-testid="input-metadata"
                  value={formData.metadata}
                  onChange={(e) => setFormData(prev => ({ ...prev, metadata: e.target.value }))}
                  placeholder='{"key": "value"}'
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} data-testid="button-cancel-create">Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-submit-broadcast">
                {createMutation.isPending ? 'Creating...' : 'Create Broadcast'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : broadcasts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Radio className="w-12 h-12 text-gray-300 dark:text-white/20 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No broadcasts yet</h3>
          <p className="text-sm text-gray-500 dark:text-white/40 mb-4">Create your first broadcast for this campaign</p>
          <Button onClick={() => setCreateOpen(true)} data-testid="button-create-first-broadcast" size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Create Broadcast
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((broadcast) => (
            <div
              key={broadcast.broadcastId}
              className="bg-white dark:bg-transparent border border-gray-200 dark:border-white/10 rounded-lg p-5 hover:border-gray-300 dark:hover:border-white/30 transition-all cursor-pointer"
              data-testid={`card-broadcast-${broadcast.broadcastId}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">{broadcast.broadcastName}</h3>
                    {getStatusBadge(broadcast.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                    <span className="font-mono">ID: {broadcast.broadcastId}</span>
                    {broadcast.externalId && (
                      <span className="font-mono text-gray-400 dark:text-gray-500" data-testid={`text-external-id-${broadcast.broadcastId}`}>
                        ext: <span className="text-gray-600 dark:text-gray-400">{broadcast.externalId}</span>
                      </span>
                    )}
                    {broadcast.startTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(broadcast.startTime).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={broadcastDetailHref(broadcast.broadcastId)}>
                    <button
                      className="px-3 py-1.5 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white rounded text-xs transition"
                      data-testid={`button-manage-broadcast-${broadcast.broadcastId}`}
                    >
                      Manage
                    </button>
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                        data-testid={`button-delete-broadcast-${broadcast.broadcastId}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Broadcast?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{broadcast.broadcastName}"? All polls and contests will be permanently deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(broadcast.broadcastId)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
