import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useUser } from '@/contexts/UserContext';
import { AppLayout } from '@/components/AppLayout';
import type { Campaign, ClientApp, Channel, Sponsor } from '@shared/schema';
import { Plus, Calendar, BarChart3, Globe, Search, Megaphone, ChevronLeft, ChevronRight } from 'lucide-react';

type CampaignWithCount = Campaign & { broadcastCount?: number };

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
    className: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  upcoming: {
    label: 'UPCOMING',
    className: 'bg-white/10 text-gray-300 border-white/20',
  },
  ended: {
    label: 'ENDED',
    className: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  },
  paused: {
    label: 'PAUSED',
    className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  },
};

const TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ended', label: 'Ended' },
  { value: 'paused', label: 'Paused' },
];

export default function CampaignsPage() {
  const { userId } = useUser();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

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
    return result;
  }, [campaigns, statusFilter, searchQuery]);

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
          {TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => handleFilterChange(tab.value)}
              data-testid={`filter-${tab.value}`}
              className={`px-3.5 py-1.5 text-sm rounded-md transition-all ${
                statusFilter === tab.value
                  ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white font-medium shadow-sm'
                  : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-white/30" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            data-testid="input-search-campaigns"
            className="pl-9 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30"
          />
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

              return (
                <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                  <div
                    className="flex items-start gap-4 p-5 bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-white/[0.06] rounded-lg hover:border-gray-300 dark:hover:border-white/[0.12] transition-all cursor-pointer group"
                    data-testid={`card-campaign-${campaign.id}`}
                  >
                    {sponsor?.avatarUrl && (
                      <img
                        src={sponsor.avatarUrl}
                        alt={sponsor.name}
                        className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-white/10 shrink-0 mt-0.5"
                        data-testid={`img-sponsor-avatar-${campaign.id}`}
                      />
                    )}

                    <div className="flex-1 min-w-0">
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

                    <div className="flex flex-col items-end gap-1 text-xs text-gray-400 dark:text-white/40 shrink-0">
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
                      {countries && countries.length > 0 && (
                        <span className="flex items-center gap-1.5" data-testid={`text-campaign-countries-${campaign.id}`}>
                          <Globe className="w-3.5 h-3.5" />
                          {countries.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
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
