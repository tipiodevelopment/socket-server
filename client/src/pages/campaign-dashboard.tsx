import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pause, Play, MoreVertical, BarChart3, Radio, Puzzle, Settings, Activity, Eye, TrendingUp, ExternalLink, Square, ChevronDown, ChevronRight, Trophy, Loader2, X, Clock, Search, Check, Users2, Plus, Trash2 } from "lucide-react";
import { Campaign, Sponsor, Broadcast } from "@shared/schema";
import { OverviewTab } from "@/components/dashboard/OverviewTab";
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
  { value: 'sponsors', label: 'Sponsors', icon: Users2 },
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
    enabled: !!campaignId,
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

  const activeTabLabel = TABS.find(t => t.value === activeTab)?.label ?? 'Overview';
  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'Campaigns', href: '/campaigns' },
  ];
  if (campaign) {
    breadcrumbs.push({ label: campaign.name, href: `/campaigns/${campaignId}` });
    breadcrumbs.push({ label: activeTabLabel });
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
  const sponsor = sponsors.find(s => s.id === campaign.primarySponsorId);

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
        {activeTab === 'sponsors' && (
          <SponsorsTabContent campaignId={campaignId!} />
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
import { Filter, Calendar, Pencil } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type SportmonksLeague = { id: number; name: string; shortCode: string | null; logoUrl: string | null; countryName: string | null };
type SportmonksFixture = { id: number; name: string; startingAt: string; status: string | null; homeTeam: { id: number; name: string; logoUrl: string | null } | null; awayTeam: { id: number; name: string; logoUrl: string | null } | null };
type MatchFields = { sportmonksFixtureId: number | null; homeTeamName: string; homeTeamLogo: string; awayTeamName: string; awayTeamLogo: string; matchStartingAt: string; leagueName: string };

const emptyMatch = (): MatchFields => ({ sportmonksFixtureId: null, homeTeamName: '', homeTeamLogo: '', awayTeamName: '', awayTeamLogo: '', matchStartingAt: '', leagueName: '' });

function getDefaultDateRange() {
  const now = new Date();
  const from = new Date(now); from.setDate(from.getDate() - 1);
  const to = new Date(now); to.setDate(to.getDate() + 3);
  return { from: from.toISOString().split('T')[0], to: to.toISOString().split('T')[0] };
}

function TeamLogo({ url, name, size = 'sm' }: { url?: string | null; name: string; size?: 'sm' | 'md' }) {
  const sz = size === 'md' ? 'w-8 h-8' : 'w-5 h-5';
  if (url) return <img src={url} alt={name} className={`${sz} object-contain rounded`} />;
  return <div className={`${sz} rounded bg-gray-600 flex items-center justify-center text-white text-xs font-bold`}>{name.slice(0, 2).toUpperCase()}</div>;
}

function LeagueSelector({ leagues, value, onChange, testId }: { leagues: SportmonksLeague[]; value: number | null; onChange: (id: number | null) => void; testId?: string }) {
  const [open, setOpen] = useState(false);
  const selected = leagues.find(l => l.id === value);
  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-8 px-2 rounded border border-white/10 bg-background text-xs text-white flex items-center gap-2"
        data-testid={testId}
      >
        {selected ? (
          <>
            {selected.logoUrl
              ? <img src={selected.logoUrl} alt={selected.name} className="w-4 h-4 object-contain shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              : <div className="w-4 h-4 rounded bg-white/10 shrink-0" />}
            <span className="flex-1 text-left truncate">{selected.name}</span>
          </>
        ) : (
          <span className="text-white/40 flex-1 text-left">Select league...</span>
        )}
        <ChevronDown className="w-3 h-3 text-white/40 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#141824] border border-white/10 rounded-lg shadow-xl z-50 max-h-52 overflow-y-auto">
          <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="w-full px-3 py-2 text-xs text-white/40 hover:text-white hover:bg-white/5 text-left transition">Select league...</button>
          {leagues.map(l => (
            <button
              key={l.id}
              type="button"
              onClick={() => { onChange(l.id); setOpen(false); }}
              className={`w-full px-3 py-2 flex items-center gap-2 text-xs hover:bg-white/5 text-left transition ${value === l.id ? 'bg-white/10 text-white' : 'text-white/70'}`}
            >
              {l.logoUrl
                ? <img src={l.logoUrl} alt={l.name} className="w-4 h-4 object-contain shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                : <div className="w-4 h-4 rounded bg-white/10 shrink-0" />}
              <span className="flex-1 truncate">{l.name}</span>
              {l.countryName && <span className="text-white/30 shrink-0">{l.countryName}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BroadcastsTab({ campaignId }: { campaignId: number }) {
  const { toast } = useToast();
  const { userId } = useUser();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editBroadcast, setEditBroadcast] = useState<Broadcast | null>(null);
  const [editFormData, setEditFormData] = useState({
    broadcastName: '',
    externalId: '',
    startTime: '',
    endTime: '',
    status: 'upcoming' as string,
  });
  const [formData, setFormData] = useState({
    broadcastName: '',
    externalId: '',
    startTime: '',
    endTime: '',
    metadata: '',
  });

  // Link Match state — create dialog
  const [createMatchOpen, setCreateMatchOpen] = useState(false);
  const [createMatch, setCreateMatch] = useState<MatchFields>(emptyMatch());
  const [createLeagueId, setCreateLeagueId] = useState<number | null>(null);
  const [createDateRange, setCreateDateRange] = useState(getDefaultDateRange());
  const [createFixtureSearch, setCreateFixtureSearch] = useState('');

  // Link Match state — edit dialog
  const [editMatchOpen, setEditMatchOpen] = useState(false);
  const [editMatch, setEditMatch] = useState<MatchFields>(emptyMatch());
  const [editLeagueId, setEditLeagueId] = useState<number | null>(null);
  const [editDateRange, setEditDateRange] = useState(getDefaultDateRange());

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

  const { data: allBroadcastsForCount = [] } = useQuery<Broadcast[]>({
    queryKey: ['/api/broadcasts', campaignId, 'all-for-count'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('campaignId', String(campaignId));
      const res = await fetch(`/api/broadcasts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch broadcasts');
      return res.json();
    },
    staleTime: 30000,
  });

  const broadcastCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allBroadcastsForCount.length };
    for (const b of allBroadcastsForCount) {
      const s = (b as any).status || 'ended';
      counts[s] = (counts[s] || 0) + 1;
    }
    return counts;
  }, [allBroadcastsForCount]);

  const invalidateBroadcasts = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', campaignId] });
    queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'broadcasts'] });
  };

  const { data: leagues = [] } = useQuery<SportmonksLeague[]>({
    queryKey: ['/api/sportmonks/leagues'],
    queryFn: async () => {
      const res = await fetch('/api/sportmonks/leagues');
      if (!res.ok) throw new Error('Failed to fetch leagues');
      return res.json();
    },
    staleTime: 2 * 24 * 60 * 60 * 1000,
  });

  const { data: createFixtures = [], isFetching: createFixturesLoading } = useQuery<SportmonksFixture[]>({
    queryKey: ['/api/sportmonks/fixtures', createLeagueId, createDateRange.from, createDateRange.to],
    queryFn: async () => {
      if (!createLeagueId) return [];
      const res = await fetch(`/api/sportmonks/fixtures?leagueId=${createLeagueId}&dateFrom=${createDateRange.from}&dateTo=${createDateRange.to}`);
      if (!res.ok) throw new Error('Failed to fetch fixtures');
      return res.json();
    },
    enabled: !!createLeagueId,
  });

  const filteredCreateFixtures = useMemo(() => {
    if (!createFixtureSearch.trim()) return createFixtures;
    const q = createFixtureSearch.toLowerCase();
    return createFixtures.filter(f =>
      (f.homeTeam?.name ?? '').toLowerCase().includes(q) ||
      (f.awayTeam?.name ?? '').toLowerCase().includes(q)
    );
  }, [createFixtures, createFixtureSearch]);

  const activeEditLeagueId = editMatchOpen ? editLeagueId : null;
  const { data: editFixtures = [], isFetching: editFixturesLoading } = useQuery<SportmonksFixture[]>({
    queryKey: ['/api/sportmonks/fixtures', activeEditLeagueId, editDateRange.from, editDateRange.to],
    queryFn: async () => {
      if (!activeEditLeagueId) return [];
      const res = await fetch(`/api/sportmonks/fixtures?leagueId=${activeEditLeagueId}&dateFrom=${editDateRange.from}&dateTo=${editDateRange.to}`);
      if (!res.ok) throw new Error('Failed to fetch fixtures');
      return res.json();
    },
    enabled: !!activeEditLeagueId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return await apiRequest('POST', '/api/broadcasts', data);
    },
    onSuccess: () => {
      invalidateBroadcasts();
      toast({ title: 'Broadcast Created', description: 'The broadcast has been created.' });
      setCreateOpen(false);
      setFormData({ broadcastName: '', externalId: '', startTime: '', endTime: '', metadata: '' });
      setCreateMatch(emptyMatch());
      setCreateMatchOpen(false);
      setCreateLeagueId(null);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create broadcast.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ broadcastId, data }: { broadcastId: string; data: Record<string, unknown> }) => {
      return await apiRequest('PUT', `/api/broadcasts/${broadcastId}`, data);
    },
    onSuccess: () => {
      invalidateBroadcasts();
      toast({ title: 'Broadcast Updated', description: 'Changes have been saved.' });
      setEditBroadcast(null);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update broadcast.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (broadcastId: string) => {
      return await apiRequest('DELETE', `/api/broadcasts/${broadcastId}`);
    },
    onSuccess: () => {
      invalidateBroadcasts();
      toast({ title: 'Broadcast Deleted', description: 'The broadcast has been deleted.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete broadcast.', variant: 'destructive' });
    },
  });

  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  const quickStatusMutation = useMutation({
    mutationFn: async ({ broadcastId, newStatus, broadcast }: { broadcastId: string; newStatus: string; broadcast: Broadcast }) => {
      return await apiRequest('PUT', `/api/broadcasts/${broadcastId}`, {
        broadcastName: broadcast.broadcastName,
        externalId: broadcast.externalId,
        startTime: broadcast.startTime,
        endTime: broadcast.endTime,
        status: newStatus,
      });
    },
    onSuccess: (_, { newStatus }) => {
      invalidateBroadcasts();
      setPendingStatusId(null);
      const description =
        newStatus === 'live' ? 'Broadcast is now Live. WebSocket event emitted.' :
        newStatus === 'ended' ? 'Broadcast ended. WebSocket event emitted.' :
        'Broadcast status updated.';
      toast({ title: 'Status Updated', description });
    },
    onError: () => {
      setPendingStatusId(null);
      toast({ title: 'Error', description: 'Failed to update broadcast status.', variant: 'destructive' });
    },
  });

  const handleQuickStatus = (broadcast: Broadcast, newStatus: string) => {
    setPendingStatusId(broadcast.broadcastId);
    quickStatusMutation.mutate({ broadcastId: broadcast.broadcastId, newStatus, broadcast });
  };

  const openEditDialog = (broadcast: Broadcast) => {
    setEditBroadcast(broadcast);
    setEditMatchOpen(false);
    setEditLeagueId(null);
    setEditDateRange(getDefaultDateRange());
    const toLocalDatetime = (dt: string | Date | null | undefined) => {
      if (!dt) return '';
      const d = new Date(dt);
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    setEditFormData({
      broadcastName: broadcast.broadcastName,
      externalId: broadcast.externalId ?? '',
      startTime: toLocalDatetime(broadcast.startTime),
      endTime: toLocalDatetime(broadcast.endTime),
      status: broadcast.status,
    });
    setEditMatch({
      sportmonksFixtureId: (broadcast as any).sportmonksFixtureId ?? null,
      homeTeamName: (broadcast as any).homeTeamName ?? '',
      homeTeamLogo: (broadcast as any).homeTeamLogo ?? '',
      awayTeamName: (broadcast as any).awayTeamName ?? '',
      awayTeamLogo: (broadcast as any).awayTeamLogo ?? '',
      matchStartingAt: (broadcast as any).matchStartingAt ?? '',
      leagueName: (broadcast as any).leagueName ?? '',
    });
  };

  const handleUpdate = () => {
    if (!editBroadcast) return;
    if (!editFormData.broadcastName.trim()) {
      toast({ title: 'Validation Error', description: 'Broadcast name is required.', variant: 'destructive' });
      return;
    }
    updateMutation.mutate({
      broadcastId: editBroadcast.broadcastId,
      data: {
        broadcastName: editFormData.broadcastName,
        externalId: editFormData.externalId.trim() || null,
        startTime: editFormData.startTime || null,
        endTime: editFormData.endTime || null,
        status: editFormData.status,
        sportmonksFixtureId: editMatch.sportmonksFixtureId,
        homeTeamName: editMatch.homeTeamName || null,
        homeTeamLogo: editMatch.homeTeamLogo || null,
        awayTeamName: editMatch.awayTeamName || null,
        awayTeamLogo: editMatch.awayTeamLogo || null,
        matchStartingAt: editMatch.matchStartingAt || null,
        leagueName: editMatch.leagueName || null,
      },
    });
  };

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
      sportmonksFixtureId: createMatch.sportmonksFixtureId,
      homeTeamName: createMatch.homeTeamName || undefined,
      homeTeamLogo: createMatch.homeTeamLogo || undefined,
      awayTeamName: createMatch.awayTeamName || undefined,
      awayTeamLogo: createMatch.awayTeamLogo || undefined,
      matchStartingAt: createMatch.matchStartingAt || undefined,
      leagueName: createMatch.leagueName || undefined,
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
          {filterOptions.map((option) => {
            const count = broadcastCounts[option.value] ?? 0;
            return (
              <button
                key={option.value}
                onClick={() => setStatusFilter(option.value)}
                data-testid={`filter-broadcast-${option.value}`}
                className={`px-3.5 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 ${
                  statusFilter === option.value
                    ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white font-medium shadow-sm'
                    : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
              >
                {option.label}
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    statusFilter === option.value
                      ? 'bg-gray-100 dark:bg-white/20 text-gray-600 dark:text-gray-300'
                      : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-broadcast" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              New Broadcast
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[860px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Broadcast</DialogTitle>
              <DialogDescription>Configure a new live broadcast for your campaign.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-2">

              {/* Link Match Context */}
              <div className="bg-white/[0.03] rounded-lg border border-white/10 overflow-hidden">
                <div className="px-4 py-3 bg-white/5 border-b border-white/10">
                  <div className="flex items-center gap-2 text-white font-medium text-sm">
                    <Trophy className="w-3.5 h-3.5 text-white/50" />
                    <span>Link Match Context</span>
                    {createMatch.sportmonksFixtureId && (
                      <span className="ml-auto text-xs text-green-400 font-normal flex items-center gap-1.5">
                        <Check className="w-3 h-3" />
                        {createMatch.homeTeamName} vs {createMatch.awayTeamName}
                        <button type="button" onClick={() => setCreateMatch(emptyMatch())} className="ml-1 text-white/30 hover:text-red-400 transition" title="Unlink match">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-white/50">League / Competition</label>
                      <LeagueSelector leagues={leagues} value={createLeagueId} onChange={setCreateLeagueId} testId="select-create-league" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-medium text-white/50">Date</label>
                      <input
                        type="date"
                        className="w-full h-9 px-3 rounded-lg border border-white/10 bg-[#0a0e1a] text-sm text-white focus:border-white/30 focus:outline-none transition [color-scheme:dark]"
                        value={createDateRange.from}
                        onChange={e => setCreateDateRange({ from: e.target.value, to: e.target.value })}
                        data-testid="input-create-date-from"
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <label className="block text-xs font-medium text-white/50">Filter</label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search matches..."
                          className="w-full h-9 px-3 pr-9 rounded-lg border border-white/10 bg-[#0a0e1a] text-sm text-white placeholder-white/20 focus:border-white/30 focus:outline-none transition"
                          value={createFixtureSearch}
                          onChange={e => setCreateFixtureSearch(e.target.value)}
                          data-testid="input-create-fixture-search"
                        />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-white/50">Select Match</label>
                    {createFixturesLoading && (
                      <div className="flex items-center justify-center gap-2 text-xs text-white/30 py-6">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading fixtures...
                      </div>
                    )}
                    {!createFixturesLoading && !createLeagueId && (
                      <p className="text-xs text-white/25 py-6 text-center">Select a league to see available matches</p>
                    )}
                    {!createFixturesLoading && createLeagueId && filteredCreateFixtures.length === 0 && (
                      <p className="text-xs text-white/30 py-6 text-center">No fixtures found for this date</p>
                    )}
                    {filteredCreateFixtures.length > 0 && (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {filteredCreateFixtures.map(f => {
                          const isSelected = createMatch.sportmonksFixtureId === f.id;
                          const matchTime = new Date(f.startingAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          return (
                            <button
                              key={f.id}
                              type="button"
                              className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all text-left ${
                                isSelected
                                  ? 'bg-blue-500/10 border-blue-500/40'
                                  : 'bg-[#0a0e1a] border-white/10 hover:border-white/25 hover:bg-white/[0.03]'
                              }`}
                              data-testid={`fixture-create-${f.id}`}
                              onClick={() => {
                                if (isSelected) { setCreateMatch(emptyMatch()); return; }
                                const leagueName = leagues.find(l => l.id === createLeagueId)?.name ?? '';
                                setCreateMatch({
                                  sportmonksFixtureId: f.id,
                                  homeTeamName: f.homeTeam?.name ?? '',
                                  homeTeamLogo: f.homeTeam?.logoUrl ?? '',
                                  awayTeamName: f.awayTeam?.name ?? '',
                                  awayTeamLogo: f.awayTeam?.logoUrl ?? '',
                                  matchStartingAt: f.startingAt,
                                  leagueName,
                                });
                                if (!formData.broadcastName.trim()) {
                                  setFormData(prev => ({ ...prev, broadcastName: `${f.homeTeam?.name ?? ''} vs ${f.awayTeam?.name ?? ''}` }));
                                }
                              }}
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <div className="flex -space-x-3 shrink-0">
                                  {f.homeTeam?.logoUrl
                                    ? <img src={f.homeTeam.logoUrl} alt={f.homeTeam.name} className="w-10 h-10 rounded-full bg-white p-1.5 border-2 border-[#141824] z-10 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    : <div className="w-10 h-10 rounded-full bg-white/10 border-2 border-[#141824] z-10 flex items-center justify-center text-xs font-bold text-white">{(f.homeTeam?.name ?? '?').slice(0, 2).toUpperCase()}</div>
                                  }
                                  {f.awayTeam?.logoUrl
                                    ? <img src={f.awayTeam.logoUrl} alt={f.awayTeam.name} className="w-10 h-10 rounded-full bg-white p-1.5 border-2 border-[#141824] object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    : <div className="w-10 h-10 rounded-full bg-white/10 border-2 border-[#141824] flex items-center justify-center text-xs font-bold text-white">{(f.awayTeam?.name ?? '?').slice(0, 2).toUpperCase()}</div>
                                  }
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm text-white font-medium mb-1">
                                    {f.homeTeam?.name} <span className="text-white/35 font-normal">vs</span> {f.awayTeam?.name}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-white/35">
                                    <Clock className="w-2.5 h-2.5" />
                                    {matchTime}
                                  </div>
                                </div>
                              </div>
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/25'
                              }`}>
                                {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="broadcastName">Broadcast Name *</Label>
                  <Input id="broadcastName" data-testid="input-broadcast-name" value={formData.broadcastName} onChange={(e) => setFormData(prev => ({ ...prev, broadcastName: e.target.value }))} placeholder="Enter broadcast name" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="externalId">External Content ID</Label>
                  <Input id="externalId" data-testid="input-external-id" value={formData.externalId} onChange={(e) => setFormData(prev => ({ ...prev, externalId: e.target.value }))} placeholder="e.g. match-12345 (used by SDK)" />
                  <p className="text-[10px] text-white/25">Used to map this broadcast to your video player content ID.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="startTime">Start Time</Label>
                  <Input id="startTime" type="datetime-local" data-testid="input-start-time" value={formData.startTime} onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endTime">End Time</Label>
                  <Input id="endTime" type="datetime-local" data-testid="input-end-time" value={formData.endTime} onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="metadata">Metadata (JSON)</Label>
                  <Textarea id="metadata" data-testid="input-metadata" value={formData.metadata} onChange={(e) => setFormData(prev => ({ ...prev, metadata: e.target.value }))} placeholder='{"key": "value"}' rows={3} />
                </div>
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
                    {(broadcast as any).homeTeamName && (broadcast as any).awayTeamName ? (
                      <div className="flex items-center gap-2">
                        <TeamLogo url={(broadcast as any).homeTeamLogo} name={(broadcast as any).homeTeamName} size="md" />
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">{broadcast.broadcastName}</h3>
                        <TeamLogo url={(broadcast as any).awayTeamLogo} name={(broadcast as any).awayTeamName} size="md" />
                      </div>
                    ) : (
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white">{broadcast.broadcastName}</h3>
                    )}
                    {getStatusBadge(broadcast.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                    <span className="font-mono">ID: {broadcast.broadcastId}</span>
                    {broadcast.externalId && (
                      <span className="font-mono text-gray-400 dark:text-gray-500" data-testid={`text-external-id-${broadcast.broadcastId}`}>
                        ext: <span className="text-gray-600 dark:text-gray-400">{broadcast.externalId}</span>
                      </span>
                    )}
                    {(broadcast as any).leagueName && (
                      <span className="flex items-center gap-1 text-white/40">
                        <Trophy className="w-3 h-3" />
                        {(broadcast as any).leagueName}
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
                  {broadcast.status === 'upcoming' && (
                    <button
                      onClick={() => handleQuickStatus(broadcast, 'live')}
                      disabled={pendingStatusId === broadcast.broadcastId}
                      className="px-2.5 py-1 text-xs font-medium bg-green-500/15 hover:bg-green-500/25 text-green-400 rounded border border-green-500/30 transition flex items-center gap-1 disabled:opacity-50"
                      data-testid={`button-go-live-${broadcast.broadcastId}`}
                      title="Start Broadcast"
                    >
                      <Play className="w-3 h-3" />
                      Start Broadcast
                    </button>
                  )}
                  {broadcast.status === 'live' && (
                    <button
                      onClick={() => handleQuickStatus(broadcast, 'ended')}
                      disabled={pendingStatusId === broadcast.broadcastId}
                      className="px-2.5 py-1 text-xs font-medium bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded border border-red-500/30 transition flex items-center gap-1 disabled:opacity-50"
                      data-testid={`button-end-broadcast-${broadcast.broadcastId}`}
                      title="End broadcast"
                    >
                      <Square className="w-3 h-3" />
                      End
                    </button>
                  )}
                  <button
                    onClick={() => openEditDialog(broadcast)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded hover:bg-gray-100 dark:hover:bg-white/10 transition"
                    data-testid={`button-edit-broadcast-${broadcast.broadcastId}`}
                    title="Edit broadcast"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
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

      {/* Edit Broadcast Dialog */}
      <Dialog open={!!editBroadcast} onOpenChange={(open) => !open && setEditBroadcast(null)}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Broadcast</DialogTitle>
            <DialogDescription>Update broadcast details. Status changes trigger real-time WebSocket events.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Broadcast Name *</label>
              <input
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                value={editFormData.broadcastName}
                onChange={(e) => setEditFormData(prev => ({ ...prev, broadcastName: e.target.value }))}
                data-testid="input-edit-broadcast-name"
                placeholder="Broadcast name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">External ID</label>
              <input
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-mono"
                value={editFormData.externalId}
                onChange={(e) => setEditFormData(prev => ({ ...prev, externalId: e.target.value }))}
                data-testid="input-edit-broadcast-external-id"
                placeholder="partner-content-id (optional)"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Status</label>
              <select
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                value={editFormData.status}
                onChange={(e) => setEditFormData(prev => ({ ...prev, status: e.target.value }))}
                data-testid="select-edit-broadcast-status"
              >
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
                <option value="ended">Ended</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Start Time</label>
                <input
                  type="datetime-local"
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  value={editFormData.startTime}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  data-testid="input-edit-broadcast-start-time"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> End Time</label>
                <input
                  type="datetime-local"
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  value={editFormData.endTime}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  data-testid="input-edit-broadcast-end-time"
                />
              </div>
            </div>

            {/* Link Match section */}
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setEditMatchOpen(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition"
                data-testid="button-toggle-edit-link-match"
              >
                <span className="flex items-center gap-2">
                  <Trophy className="w-3.5 h-3.5" />
                  Link Match
                  {editMatch.sportmonksFixtureId && (
                    <span className="text-xs text-green-400 font-normal">— {editMatch.homeTeamName} vs {editMatch.awayTeamName}</span>
                  )}
                </span>
                {editMatchOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
              {editMatchOpen && (
                <div className="px-3 pb-3 pt-1 border-t border-white/10 space-y-3">
                  {editMatch.sportmonksFixtureId ? (
                    <div className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <TeamLogo url={editMatch.homeTeamLogo} name={editMatch.homeTeamName} size="md" />
                        <div className="text-sm font-semibold text-white">{editMatch.homeTeamName}</div>
                        <span className="text-xs text-white/40">vs</span>
                        <div className="text-sm font-semibold text-white">{editMatch.awayTeamName}</div>
                        <TeamLogo url={editMatch.awayTeamLogo} name={editMatch.awayTeamName} size="md" />
                      </div>
                      <button type="button" onClick={() => setEditMatch(emptyMatch())} className="p-1 text-white/40 hover:text-red-400 transition" title="Unlink match">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-white/50">League</label>
                          <LeagueSelector leagues={leagues} value={editLeagueId} onChange={setEditLeagueId} testId="select-edit-league" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-white/50">From</label>
                          <input type="date" className="w-full h-8 px-2 rounded border border-white/10 bg-background text-xs text-white" value={editDateRange.from} onChange={e => setEditDateRange(p => ({ ...p, from: e.target.value }))} data-testid="input-edit-date-from" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-white/50">To</label>
                          <input type="date" className="w-full h-8 px-2 rounded border border-white/10 bg-background text-xs text-white" value={editDateRange.to} onChange={e => setEditDateRange(p => ({ ...p, to: e.target.value }))} data-testid="input-edit-date-to" />
                        </div>
                      </div>
                      {editFixturesLoading && (
                        <div className="flex items-center gap-2 text-xs text-white/40 py-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading fixtures...</div>
                      )}
                      {!editFixturesLoading && editLeagueId && editFixtures.length === 0 && (
                        <p className="text-xs text-white/40 py-2 text-center">No fixtures found for this date range.</p>
                      )}
                      {editFixtures.length > 0 && (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {editFixtures.map(f => (
                            <button
                              key={f.id}
                              type="button"
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-left"
                              data-testid={`fixture-edit-${f.id}`}
                              onClick={() => {
                                const leagueName = leagues.find(l => l.id === editLeagueId)?.name ?? '';
                                setEditMatch({
                                  sportmonksFixtureId: f.id,
                                  homeTeamName: f.homeTeam?.name ?? '',
                                  homeTeamLogo: f.homeTeam?.logoUrl ?? '',
                                  awayTeamName: f.awayTeam?.name ?? '',
                                  awayTeamLogo: f.awayTeam?.logoUrl ?? '',
                                  matchStartingAt: f.startingAt,
                                  leagueName,
                                });
                                if (!editFormData.broadcastName.trim()) {
                                  setEditFormData(prev => ({ ...prev, broadcastName: `${f.homeTeam?.name ?? ''} vs ${f.awayTeam?.name ?? ''}` }));
                                }
                              }}
                            >
                              <TeamLogo url={f.homeTeam?.logoUrl} name={f.homeTeam?.name ?? '?'} />
                              <span className="text-xs text-white/80 flex-1">{f.homeTeam?.name} vs {f.awayTeam?.name}</span>
                              <TeamLogo url={f.awayTeam?.logoUrl} name={f.awayTeam?.name ?? '?'} />
                              <span className="text-xs text-white/30 shrink-0">{new Date(f.startingAt).toLocaleDateString()}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBroadcast(null)} data-testid="button-cancel-edit-broadcast">
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} data-testid="button-save-edit-broadcast">
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  engagement: 'Engagement',
  shoppable: 'Shoppable',
  full: 'Full',
  primary: 'Primary',
};
const ROLE_COLORS: Record<string, string> = {
  engagement: 'bg-blue-500/20 text-blue-400',
  shoppable: 'bg-green-500/20 text-green-400',
  full: 'bg-purple-500/20 text-purple-400',
  primary: 'bg-amber-500/20 text-amber-400',
};

function SponsorsTabContent({ campaignId }: { campaignId: number }) {
  const { toast } = useToast();
  const { userId } = useUser();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedSponsorId, setSelectedSponsorId] = useState('');
  const [selectedRole, setSelectedRole] = useState('shoppable');

  const { data: campaignSponsors = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/campaigns', campaignId, 'sponsors'],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/sponsors`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!campaignId,
  });

  // Fetch the campaign itself to know its primarySponsorId — it's stored on
  // `campaigns.primary_sponsor_id`, NOT in `campaign_sponsors`, so the list
  // above only returns secondaries. The primary is required + immutable and
  // must be shown in the Sponsors tab too.
  const { data: campaign } = useQuery<any>({
    queryKey: ['/api/campaigns', campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!campaignId,
  });

  // /api/sponsors requires userId — without it the endpoint 400s and the
  // "Add Sponsor" button stays disabled because availableSponsors is empty.
  const { data: allSponsors = [] } = useQuery<any[]>({
    queryKey: ['/api/sponsors', userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await fetch(`/api/sponsors?userId=${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
  });

  // Resolve the primary sponsor record by id from the user's sponsor pool.
  const primarySponsor = campaign?.primarySponsorId
    ? allSponsors.find((s: any) => s.id === campaign.primarySponsorId) ?? null
    : null;

  // Primary + secondaries both count as "linked" for the Add Sponsor dropdown —
  // can't re-link the primary as a secondary.
  const linkedSponsorIds = new Set<number>([
    ...campaignSponsors.map((s: any) => s.sponsorId),
    ...(primarySponsor ? [primarySponsor.id] : []),
  ]);
  const availableSponsors = allSponsors.filter((s: any) => !linkedSponsorIds.has(s.id));

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/sponsors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sponsorId: parseInt(selectedSponsorId), role: selectedRole }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'sponsors'] });
      toast({ title: 'Sponsor added' });
      setAddOpen(false);
      setSelectedSponsorId('');
      setSelectedRole('shoppable');
    },
    onError: () => toast({ title: 'Error', description: 'Could not add sponsor', variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: async (sponsorId: number) => {
      const res = await fetch(`/api/campaigns/${campaignId}/sponsors/${sponsorId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'sponsors'] });
      toast({ title: 'Sponsor removed' });
    },
    onError: () => toast({ title: 'Error', description: 'Could not remove sponsor', variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Campaign Sponsors</h3>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5" data-testid="button-add-sponsor" disabled={availableSponsors.length === 0}>
              <Plus className="w-3.5 h-3.5" />
              Add Sponsor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Add Sponsor</DialogTitle>
              <DialogDescription>Link a sponsor to this campaign with a role.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Sponsor</Label>
                <Select value={selectedSponsorId} onValueChange={setSelectedSponsorId}>
                  <SelectTrigger data-testid="select-add-sponsor">
                    <SelectValue placeholder="Select sponsor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSponsors.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        <div className="flex items-center gap-2">
                          {s.logoUrl ? (
                            <img src={s.logoUrl} alt={s.name} className="w-4 h-4 object-contain rounded" />
                          ) : (
                            <div className="w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center text-white"
                              style={{ backgroundColor: s.primaryColor ?? '#3d8b7a' }}>
                              {s.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger data-testid="select-sponsor-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="engagement">Engagement</SelectItem>
                    <SelectItem value="shoppable">Shoppable</SelectItem>
                    <SelectItem value="full">Full</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Engagement = polls/contests · Shoppable = products · Full = both
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button
                onClick={() => addMutation.mutate()}
                disabled={!selectedSponsorId || addMutation.isPending}
                data-testid="button-confirm-add-sponsor"
              >
                {addMutation.isPending ? 'Adding...' : 'Add Sponsor'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 bg-white/5 rounded-lg animate-pulse" />)}
        </div>
      ) : !primarySponsor && campaignSponsors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/10 rounded-xl">
          <Users2 className="w-10 h-10 text-white/20 mb-3" />
          <p className="text-sm font-medium text-white/40 mb-1">No sponsors linked</p>
          <p className="text-xs text-white/20">Add a sponsor to associate it with this campaign</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Primary sponsor — always first, immutable (no remove button). */}
          {primarySponsor && (
            <div
              key={`primary-${primarySponsor.id}`}
              className="flex items-center gap-4 p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl"
              data-testid={`card-primary-sponsor-${primarySponsor.id}`}
            >
              <div className="shrink-0">
                {primarySponsor.logoUrl ? (
                  <img src={primarySponsor.logoUrl} alt={primarySponsor.name} className="w-12 h-12 object-contain rounded-lg bg-white/5 p-1" />
                ) : (
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: primarySponsor.primaryColor ?? '#3d8b7a' }}
                  >
                    {primarySponsor.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white text-sm">{primarySponsor.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS.primary}`}>
                    Primary
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/30">
                  {primarySponsor.primaryColor && (
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: primarySponsor.primaryColor }} />
                      {primarySponsor.primaryColor}
                    </div>
                  )}
                  <span className="text-white/20">Immutable · set on campaign creation</span>
                </div>
              </div>
            </div>
          )}

          {campaignSponsors
            // Primary is rendered in the amber card above; /api/campaigns/:id/sponsors
            // now returns it too (as `role:'primary'`) so filter here to avoid duplicates.
            .filter((cs: any) => cs.role !== 'primary')
            .map((cs: any) => (
            <div
              key={cs.id}
              className="flex items-center gap-4 p-4 bg-transparent border border-white/10 rounded-xl hover:border-white/20 transition"
              data-testid={`card-campaign-sponsor-${cs.sponsorId}`}
            >
              <div className="shrink-0">
                {cs.logoUrl ? (
                  <img src={cs.logoUrl} alt={cs.name} className="w-12 h-12 object-contain rounded-lg bg-white/5 p-1" />
                ) : (
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: cs.primaryColor ?? '#3d8b7a' }}
                  >
                    {cs.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-white text-sm">{cs.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[cs.role] ?? 'bg-white/10 text-white/50'}`}>
                    {ROLE_LABELS[cs.role] ?? cs.role}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {cs.primaryColor && (
                    <div className="flex items-center gap-1 text-[11px] text-white/30">
                      <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: cs.primaryColor }} />
                      {cs.primaryColor}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeMutation.mutate(cs.sponsorId)}
                disabled={removeMutation.isPending}
                data-testid={`button-remove-sponsor-${cs.sponsorId}`}
                className="p-2 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                title="Remove sponsor"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
