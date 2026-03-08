import { Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser } from '@/contexts/UserContext';
import { AppLayout } from '@/components/AppLayout';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Campaign, ClientApp, Channel, Sponsor } from '@shared/schema';
import { Plus, Calendar, BarChart3, Globe, Search, Megaphone, ChevronLeft, ChevronRight, ArrowUpDown, Pause, Play, Activity } from 'lucide-react';

type CampaignWithCount = Campaign & { 
  broadcastCount?: number; 
  totalEngagement?: number;
  sponsorName?: string;
  sponsorAvatarUrl?: string;
};

type CampaignStatus = 'active' | 'upcoming' | 'ended' | 'paused';

const PAGE_SIZE = 15;

function getCampaignStatus(campaign: Campaign): CampaignStatus {
  if (campaign.isPaused === 'true') return 'paused';
  const now = new Date();
  if (campaign.endDate && new Date(campaign.endDate) < now) return 'ended';
  if (campaign.startDate && new Date(campaign.startDate) > now) return 'upcoming';
  return 'active';
}

const STATUS_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
  active: {
    label: 'ACTIVE',
    className: 'bg-[#3d8b7a]/15 text-[#3d8b7a] border-[#3d8b7a]/30 dark:bg-[#3d8b7a]/20 dark:text-[#5eff9e] dark:border-[#3d8b7a]/40',
  },
  upcoming: {
    label: 'UPCOMING',
    className: 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/10 dark:text-gray-300 dark:border-white/20',
  },
  ended: {
    label: 'ENDED',
    className: 'bg-gray-500/10 text-gray-500 border-gray-500/20 dark:bg-gray-500/20 dark:text-gray-400 dark:border-gray-500/30',
  },
  paused: {
    label: 'PAUSED',
    className: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-500/30',
  },
};

const COUNTRY_NAMES: Record<string, string> = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AR: 'Argentina', AU: 'Australia',
  AT: 'Austria', BE: 'Belgium', BR: 'Brazil', CA: 'Canada', CL: 'Chile',
  CN: 'China', CO: 'Colombia', HR: 'Croatia', CZ: 'Czech Republic', DK: 'Denmark',
  EG: 'Egypt', FI: 'Finland', FR: 'France', DE: 'Germany', GR: 'Greece',
  HU: 'Hungary', IN: 'India', ID: 'Indonesia', IE: 'Ireland', IL: 'Israel',
  IT: 'Italy', JP: 'Japan', KR: 'South Korea', MX: 'Mexico', NL: 'Netherlands',
  NZ: 'New Zealand', NG: 'Nigeria', NO: 'Norway', PL: 'Poland', PT: 'Portugal',
  RO: 'Romania', RU: 'Russia', SA: 'Saudi Arabia', ZA: 'South Africa', ES: 'Spain',
  SE: 'Sweden', CH: 'Switzerland', TR: 'Turkey', UA: 'Ukraine', GB: 'United Kingdom',
  US: 'United States', UY: 'Uruguay', VE: 'Venezuela',
};

function getCountryLabel(code: string): string {
  try {
    const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
    return regionNames.of(code.toUpperCase()) || code;
  } catch (e) {
    return COUNTRY_NAMES[code.toUpperCase()] || code;
  }
}

const TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ended', label: 'Ended' },
  { value: 'paused', label: 'Paused' },
];

type SortKey = 'name' | 'date' | 'status';

export default function CampaignsPage() {
  const { userId } = useUser();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortKey>('date');

  const { data: campaigns = [], isLoading } = useQuery<CampaignWithCount[]>({
    queryKey: ['/api/campaigns', userId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?userId=${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: clientApps = [] } = useQuery<ClientApp[]>({
    queryKey: ['/api/client-apps', userId],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps?userId=${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: allChannels = [] } = useQuery<Channel[]>({
    queryKey: ['/api/channels', userId],
    queryFn: async () => {
      const res = await fetch(`/api/channels?userId=${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
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

  const appMap = useMemo(() => new Map(clientApps.map(a => [a.id, a])), [clientApps]);
  const channelMap = useMemo(() => new Map(allChannels.map(c => [c.id, c])), [allChannels]);
  const sponsorMap = useMemo(() => new Map(sponsors.map(s => [s.id, s])), [sponsors]);

  const getAppForCampaign = (campaign: Campaign): ClientApp | undefined => {
    if (campaign.clientAppId) return appMap.get(campaign.clientAppId);
    if (campaign.channelId) {
      const ch = channelMap.get(campaign.channelId);
      if (ch) return appMap.get(ch.clientAppId);
    }
    return undefined;
  };

  const getChannelForCampaign = (campaign: Campaign): Channel | undefined => {
    if (campaign.channelId) return channelMap.get(campaign.channelId);
    return undefined;
  };

  const togglePauseMutation = useMutation({
    mutationFn: async (campaignId: number) => {
      return apiRequest('PATCH', `/api/campaigns/${campaignId}/toggle-pause`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', userId] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update campaign status', variant: 'destructive' });
    },
  });

  const STATUS_ORDER: Record<CampaignStatus, number> = { active: 0, upcoming: 1, paused: 2, ended: 3 };

  const filteredCampaigns = useMemo(() => {
    let result = campaigns;
    if (statusFilter !== 'all') {
      result = result.filter(c => getCampaignStatus(c) === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
      );
    }
    const sorted = [...result];
    if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'date') {
      sorted.sort((a, b) => {
        const da = a.startDate ? new Date(a.startDate).getTime() : 0;
        const db = b.startDate ? new Date(b.startDate).getTime() : 0;
        return db - da;
      });
    } else if (sortBy === 'status') {
      sorted.sort((a, b) => STATUS_ORDER[getCampaignStatus(a)] - STATUS_ORDER[getCampaignStatus(b)]);
    }
    return sorted;
  }, [campaigns, statusFilter, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedCampaigns = filteredCampaigns.slice(
    (safeCurrentPage - 1) * PAGE_SIZE,
    safeCurrentPage * PAGE_SIZE
  );

  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  };

  return (
    <AppLayout
      breadcrumbs={[{ label: 'Campaigns' }]}
      title="Campaigns"
      subtitle="Manage engagement campaigns across all your apps"
      actions={
        <Link href="/campaigns/new">
          <Button data-testid="button-create-campaign" className="gap-2">
            <Plus className="w-4 h-4" /> New Campaign
          </Button>
        </Link>
      }
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex gap-1 flex-wrap">
          {TABS.map(tab => {
            const count = tab.value === 'all'
              ? campaigns.length
              : campaigns.filter(c => getCampaignStatus(c) === tab.value).length;
            return (
              <button
                key={tab.value}
                onClick={() => handleFilterChange(tab.value)}
                data-testid={`filter-${tab.value}`}
                className={`px-3.5 py-1.5 text-sm rounded-md transition-all flex items-center gap-1.5 ${
                  statusFilter === tab.value
                    ? 'bg-[#3d8b7a] text-white dark:bg-white/10 dark:text-white font-medium shadow-sm'
                    : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5'
                }`}
              >
                {tab.label}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  statusFilter === tab.value
                    ? 'bg-white/20 text-white dark:bg-white/20'
                    : 'bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-white/30'
                }`}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/30" />
            <Input
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              data-testid="input-search-campaigns"
              className="pl-9 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30"
            />
          </div>
          <div className="flex items-center gap-1 border border-gray-200 dark:border-white/10 rounded-md px-1 py-1 bg-gray-50 dark:bg-white/5">
            <ArrowUpDown className="w-3 h-3 text-gray-400 dark:text-white/30 ml-1" />
            {(['name', 'date', 'status'] as SortKey[]).map(key => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                data-testid={`sort-${key}`}
                className={`px-2.5 py-1 text-xs rounded transition-all ${
                  sortBy === key
                    ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white font-medium shadow-sm'
                    : 'text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white/60'
                }`}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-100 dark:bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Megaphone className="w-12 h-12 text-gray-300 dark:text-white/20 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No campaigns found</h3>
          <p className="text-sm text-gray-500 dark:text-white/40 mb-4">
            {statusFilter !== 'all' || searchQuery ? 'Try a different filter or search.' : 'Create your first campaign to get started.'}
          </p>
          {statusFilter === 'all' && !searchQuery && (
            <Link href="/campaigns/new">
              <Button data-testid="button-create-first-campaign" className="gap-2">
                <Plus className="w-4 h-4" /> Create Campaign
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginatedCampaigns.map((campaign) => {
              const status = getCampaignStatus(campaign);
              const statusCfg = STATUS_CONFIG[status];
              const app = getAppForCampaign(campaign);
              const channel = getChannelForCampaign(campaign);
              const countries = campaign.targetCountries?.filter(Boolean);
              const sponsor = campaign.sponsorId ? sponsorMap.get(campaign.sponsorId) : undefined;
              const sponsorName = campaign.sponsorName || sponsor?.name;
              const sponsorAvatarUrl = campaign.sponsorAvatarUrl || sponsor?.avatarUrl;

              const isPaused = campaign.isPaused === 'true';
              const canTogglePause = status === 'active' || status === 'paused';

              return (
                <div
                  key={campaign.id}
                  className="flex items-start gap-4 p-5 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-lg hover:border-gray-300 dark:hover:border-white/[0.12] transition-all cursor-pointer group"
                  data-testid={`card-campaign-${campaign.id}`}
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                >
                    <div className="flex flex-col items-center gap-1 shrink-0 mt-0.5" data-testid={`sponsor-info-${campaign.id}`}>
                      {sponsorAvatarUrl ? (
                        <img
                          src={sponsorAvatarUrl}
                          alt={sponsorName}
                          className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-white/10"
                          data-testid={`img-sponsor-avatar-${campaign.id}`}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center border border-gray-200 dark:border-white/10">
                          <span className="text-xs font-bold text-gray-500 dark:text-white/40">{sponsorName ? sponsorName.charAt(0) : 'S'}</span>
                        </div>
                      )}
                      <span className="text-[10px] font-medium text-gray-500 dark:text-white/50 text-center max-w-[64px] truncate" data-testid={`text-sponsor-name-${campaign.id}`}>
                        {sponsorName}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 ml-1">
                      <div className="flex items-center gap-2.5 mb-1">
                        <h3 className="font-semibold text-gray-900 dark:text-white text-[15px] truncate" data-testid={`text-campaign-name-${campaign.id}`}>
                          {campaign.name}
                        </h3>
                        <span
                          className={`text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded border shrink-0 ${statusCfg.className}`}
                          data-testid={`badge-status-${campaign.id}`}
                        >
                          {statusCfg.label}
                        </span>
                      </div>

                      {campaign.description && (
                        <p className="text-sm text-gray-500 dark:text-white/40 mb-2 truncate" data-testid={`text-campaign-desc-${campaign.id}`}>
                          {campaign.description}
                        </p>
                      )}

                      <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-white/30">
                        {app && (
                          <span data-testid={`text-campaign-app-${campaign.id}`}>{app.name}</span>
                        )}
                        {app && channel && (
                          <span className="text-gray-300 dark:text-white/15">/</span>
                        )}
                        {channel && (
                          <span data-testid={`text-campaign-channel-${campaign.id}`}>{channel.name}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3 shrink-0">
                      <div className="flex flex-col items-end gap-1 text-xs text-gray-400 dark:text-white/40">
                        {campaign.startDate && (
                          <span className="flex items-center gap-1.5" data-testid={`text-campaign-date-${campaign.id}`}>
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(campaign.startDate)}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5" data-testid={`text-campaign-broadcasts-${campaign.id}`}>
                          <BarChart3 className="w-3.5 h-3.5" />
                          {campaign.broadcastCount || 0} broadcast{(campaign.broadcastCount || 0) !== 1 ? 's' : ''}
                        </span>
                        {campaign.totalEngagement !== undefined && (
                          <span className="flex items-center gap-1.5" data-testid={`text-campaign-engagement-${campaign.id}`}>
                            <Activity className="w-3.5 h-3.5" />
                            {campaign.totalEngagement} engagement
                          </span>
                        )}
                        {countries && countries.length > 0 && (
                          <span className="flex items-center gap-1.5" data-testid={`text-campaign-countries-${campaign.id}`}>
                            <Globe className="w-3.5 h-3.5" />
                            {countries.map(getCountryLabel).join(', ')}
                          </span>
                        )}
                      </div>
                      {canTogglePause && (
                        <button
                          onClick={(e) => { e.stopPropagation(); togglePauseMutation.mutate(campaign.id); }}
                          disabled={togglePauseMutation.isPending}
                          title={isPaused ? 'Resume campaign' : 'Pause campaign'}
                          data-testid={`button-toggle-pause-${campaign.id}`}
                          className={`mt-0.5 p-1.5 rounded border transition flex items-center gap-1 text-xs font-medium disabled:opacity-50 ${
                            isPaused
                              ? 'border-green-500/30 text-green-400 hover:bg-green-500/10'
                              : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                          }`}
                        >
                          {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-white/10">
              <span className="text-sm text-gray-500 dark:text-white/40">
                Showing {(safeCurrentPage - 1) * PAGE_SIZE + 1}-{Math.min(safeCurrentPage * PAGE_SIZE, filteredCampaigns.length)} of {filteredCampaigns.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  data-testid="button-prev-page"
                  className="gap-1"
                >
                  <ChevronLeft className="w-4 h-4" /> Prev
                </Button>
                <span className="text-sm text-gray-600 dark:text-white/50 px-2">
                  {safeCurrentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  data-testid="button-next-page"
                  className="gap-1"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
