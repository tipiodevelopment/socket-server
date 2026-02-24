import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useUser } from '@/contexts/UserContext';
import { AppLayout } from '@/components/AppLayout';
import type { Broadcast, Campaign } from '@shared/schema';
import { Plus, Clock, BarChart3, Trophy, Radio, Search, Filter, ChartNoAxesColumn } from 'lucide-react';

type EnrichedBroadcast = Broadcast & {
  pollCount: number;
  activePollCount: number;
  contestCount: number;
  campaignName: string | null;
  clientAppName: string | null;
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours !== 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
}

function formatTimeUntil(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs < 0) return formatTimeAgo(date);
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `Starts in ${diffMins} min${diffMins !== 1 ? 's' : ''}`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Starts in ${diffHours} hr${diffHours !== 1 ? 's' : ''}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatViewers(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${Math.round(count / 1000)}K`;
  return String(count);
}

function CampaignAppLabel({ campaignName, clientAppName }: { campaignName: string | null; clientAppName: string | null }) {
  if (!campaignName && !clientAppName) return null;
  return (
    <div className="flex items-center space-x-2 text-xs text-gray-400 dark:text-gray-500 mb-3">
      {campaignName && <span className="text-gray-600 dark:text-gray-300">{campaignName}</span>}
      {campaignName && clientAppName && <span className="text-gray-300 dark:text-gray-700">/</span>}
      {clientAppName && <span className="text-gray-600 dark:text-gray-300">{clientAppName}</span>}
    </div>
  );
}

function LiveBroadcastCard({ broadcast }: { broadcast: EnrichedBroadcast }) {
  const viewers = broadcast.metadata && typeof broadcast.metadata === 'object' && 'viewers' in broadcast.metadata
    ? Number((broadcast.metadata as Record<string, unknown>).viewers) || 0
    : 0;
  const engagement = broadcast.metadata && typeof broadcast.metadata === 'object' && 'engagement' in broadcast.metadata
    ? Number((broadcast.metadata as Record<string, unknown>).engagement) || 0
    : 0;

  return (
    <Link href={`/broadcasts/${broadcast.broadcastId}`}>
      <div
        className="bg-white dark:bg-transparent border border-gray-200 dark:border-white/10 rounded-lg p-5 hover:border-[#3d8b7a] dark:hover:border-white/30 transition-all cursor-pointer"
        data-testid={`card-broadcast-${broadcast.broadcastId}`}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white" data-testid={`text-broadcast-name-${broadcast.broadcastId}`}>{broadcast.broadcastName}</h3>
              <span className="px-2 py-0.5 bg-[#3d8b7a] text-white dark:bg-white dark:text-black text-[10px] uppercase font-bold rounded-full" data-testid={`badge-status-${broadcast.broadcastId}`}>Live</span>
              {broadcast.startTime && (
                <span className="flex items-center space-x-1 text-xs text-gray-400">
                  <div className="w-2 h-2 bg-[#3d8b7a] dark:bg-white rounded-full animate-pulse"></div>
                  <span>{formatTimeAgo(new Date(broadcast.startTime))}</span>
                </span>
              )}
            </div>
            {broadcast.description && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-3" data-testid={`text-broadcast-desc-${broadcast.broadcastId}`}>{broadcast.description}</div>
            )}
            <CampaignAppLabel campaignName={broadcast.campaignName} clientAppName={broadcast.clientAppName} />
          </div>
          <span className="px-4 py-1.5 bg-[#3d8b7a] hover:bg-[#2f7365] dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black rounded text-xs font-medium" data-testid={`button-manage-broadcast-${broadcast.broadcastId}`}>
            Manage
          </span>
        </div>
        <div className="grid grid-cols-5 gap-4 pt-4 border-t border-gray-100 dark:border-white/5">
          <div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Viewers</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white" data-testid={`stat-viewers-${broadcast.broadcastId}`}>{viewers > 0 ? formatViewers(viewers) : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Active Polls</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white" data-testid={`stat-active-polls-${broadcast.broadcastId}`}>{broadcast.activePollCount}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Total Polls</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white" data-testid={`stat-total-polls-${broadcast.broadcastId}`}>{broadcast.pollCount}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Contests</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white" data-testid={`stat-contests-${broadcast.broadcastId}`}>{broadcast.contestCount}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Engagement</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white" data-testid={`stat-engagement-${broadcast.broadcastId}`}>{engagement > 0 ? `${engagement}%` : '—'}</div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function UpcomingBroadcastCard({ broadcast }: { broadcast: EnrichedBroadcast }) {
  return (
    <Link href={`/broadcasts/${broadcast.broadcastId}`}>
      <div
        className="bg-white dark:bg-transparent border border-gray-200 dark:border-white/10 rounded-lg p-5 hover:border-[#3d8b7a] dark:hover:border-white/30 transition-all cursor-pointer"
        data-testid={`card-broadcast-${broadcast.broadcastId}`}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white" data-testid={`text-broadcast-name-${broadcast.broadcastId}`}>{broadcast.broadcastName}</h3>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300 text-[10px] uppercase font-bold rounded-full border border-gray-200 dark:border-white/20" data-testid={`badge-status-${broadcast.broadcastId}`}>Upcoming</span>
            </div>
            {broadcast.description && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-3" data-testid={`text-broadcast-desc-${broadcast.broadcastId}`}>{broadcast.description}</div>
            )}
            <CampaignAppLabel campaignName={broadcast.campaignName} clientAppName={broadcast.clientAppName} />
            <div className="flex items-center space-x-4 text-xs text-gray-400 dark:text-gray-500">
              {broadcast.startTime && (
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeUntil(new Date(broadcast.startTime))}</span>
                </div>
              )}
              <div className="flex items-center space-x-1.5">
                <BarChart3 className="w-3 h-3" />
                <span>{broadcast.pollCount} poll{broadcast.pollCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Trophy className="w-3 h-3" />
                <span>{broadcast.contestCount} contest{broadcast.contestCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
          <span className="px-4 py-1.5 bg-transparent border border-gray-300 dark:border-white/20 hover:border-[#3d8b7a] dark:hover:border-white/40 text-gray-700 dark:text-white rounded text-xs font-medium" data-testid={`button-configure-broadcast-${broadcast.broadcastId}`}>
            Configure
          </span>
        </div>
      </div>
    </Link>
  );
}

function EndedBroadcastCard({ broadcast }: { broadcast: EnrichedBroadcast }) {
  const viewers = broadcast.metadata && typeof broadcast.metadata === 'object' && 'viewers' in broadcast.metadata
    ? Number((broadcast.metadata as Record<string, unknown>).viewers) || 0
    : 0;

  return (
    <Link href={`/broadcasts/${broadcast.broadcastId}`}>
      <div
        className="bg-white dark:bg-transparent border border-gray-200 dark:border-white/10 rounded-lg p-5 hover:border-gray-300 dark:hover:border-white/30 transition-all cursor-pointer opacity-60"
        data-testid={`card-broadcast-${broadcast.broadcastId}`}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white" data-testid={`text-broadcast-name-${broadcast.broadcastId}`}>{broadcast.broadcastName}</h3>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-gray-400 text-[10px] uppercase font-bold rounded-full border border-gray-200 dark:border-white/10" data-testid={`badge-status-${broadcast.broadcastId}`}>Ended</span>
            </div>
            {broadcast.description && (
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-3" data-testid={`text-broadcast-desc-${broadcast.broadcastId}`}>{broadcast.description}</div>
            )}
            <CampaignAppLabel campaignName={broadcast.campaignName} clientAppName={broadcast.clientAppName} />
            <div className="flex items-center space-x-4 text-xs text-gray-400 dark:text-gray-500">
              {viewers > 0 && (
                <div className="flex items-center space-x-1.5">
                  <BarChart3 className="w-3 h-3" />
                  <span>{formatViewers(viewers)} viewers</span>
                </div>
              )}
              <div className="flex items-center space-x-1.5">
                <BarChart3 className="w-3 h-3" />
                <span>{broadcast.pollCount} poll{broadcast.pollCount !== 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Trophy className="w-3 h-3" />
                <span>{broadcast.contestCount} contest{broadcast.contestCount !== 1 ? 's' : ''}</span>
              </div>
              {broadcast.endTime && (
                <div className="flex items-center space-x-1.5">
                  <Clock className="w-3 h-3" />
                  <span>{formatTimeAgo(new Date(broadcast.endTime))}</span>
                </div>
              )}
            </div>
          </div>
          <span className="px-4 py-1.5 bg-transparent border border-gray-300 dark:border-white/20 hover:border-gray-400 dark:hover:border-white/40 text-gray-600 dark:text-white rounded text-xs font-medium" data-testid={`button-view-broadcast-${broadcast.broadcastId}`}>
            View Report
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function BroadcastsPage() {
  const { toast } = useToast();
  const { userId } = useUser();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    broadcastName: '',
    description: '',
    campaignId: '',
    startTime: '',
    endTime: '',
    metadata: '',
  });

  const { data: broadcasts = [], isLoading } = useQuery<EnrichedBroadcast[]>({
    queryKey: ['/api/broadcasts', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/broadcasts');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns', userId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?userId=${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
  });

  const filtered = useMemo(() => {
    let list = broadcasts;
    if (statusFilter !== 'all') {
      list = list.filter(b => b.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b =>
        b.broadcastName.toLowerCase().includes(q) ||
        (b.description && b.description.toLowerCase().includes(q)) ||
        (b.campaignName && b.campaignName.toLowerCase().includes(q)) ||
        (b.clientAppName && b.clientAppName.toLowerCase().includes(q)) ||
        b.broadcastId.toLowerCase().includes(q)
      );
    }
    return list;
  }, [broadcasts, statusFilter, searchQuery]);

  const liveBroadcasts = filtered.filter(b => b.status === 'live');
  const upcomingBroadcasts = filtered.filter(b => b.status === 'upcoming');
  const endedBroadcasts = filtered.filter(b => b.status === 'ended');

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return await apiRequest('POST', '/api/broadcasts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
      toast({ title: 'Broadcast Created' });
      setCreateOpen(false);
      setFormData({ broadcastName: '', description: '', campaignId: '', startTime: '', endTime: '', metadata: '' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create broadcast', variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    if (!formData.broadcastName.trim() || !formData.campaignId) {
      toast({ title: 'Required', description: 'Name and campaign are required.', variant: 'destructive' });
      return;
    }
    let metadata = undefined;
    if (formData.metadata.trim()) {
      try { metadata = JSON.parse(formData.metadata); }
      catch { toast({ title: 'Error', description: 'Metadata must be valid JSON.', variant: 'destructive' }); return; }
    }
    createMutation.mutate({
      broadcastName: formData.broadcastName,
      description: formData.description || undefined,
      campaignId: parseInt(formData.campaignId),
      startTime: formData.startTime || undefined,
      endTime: formData.endTime || undefined,
      metadata,
      createdBy: userId,
    });
  };

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'live', label: 'Live' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'ended', label: 'Ended' },
  ];

  const hasResults = filtered.length > 0;

  return (
    <AppLayout
      breadcrumbs={[{ label: 'Broadcasts' }]}
      title="Broadcasts"
      subtitle="All broadcasts across campaigns"
      actions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-broadcast" className="gap-2 bg-[#3d8b7a] hover:bg-[#2f7365] dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black font-medium" disabled={campaigns.length === 0}>
              <Plus className="w-4 h-4" /> New Broadcast
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Broadcast</DialogTitle>
              <DialogDescription>Create a new broadcast and assign it to a campaign.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Broadcast Name *</Label>
                <Input
                  data-testid="input-broadcast-name"
                  value={formData.broadcastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, broadcastName: e.target.value }))}
                  placeholder="Enter broadcast name"
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Input
                  data-testid="input-broadcast-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the broadcast"
                />
              </div>
              <div className="grid gap-2">
                <Label>Campaign *</Label>
                <Select value={formData.campaignId} onValueChange={(v) => setFormData(prev => ({ ...prev, campaignId: v }))}>
                  <SelectTrigger data-testid="select-campaign">
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Start Time</Label>
                  <Input
                    type="datetime-local"
                    data-testid="input-start-time"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>End Time</Label>
                  <Input
                    type="datetime-local"
                    data-testid="input-end-time"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Metadata (JSON)</Label>
                <Textarea
                  data-testid="input-metadata"
                  value={formData.metadata}
                  onChange={(e) => setFormData(prev => ({ ...prev, metadata: e.target.value }))}
                  placeholder='{"key": "value"}'
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-submit-broadcast">
                {createMutation.isPending ? 'Creating...' : 'Create Broadcast'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-2">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                statusFilter === opt.value
                  ? 'bg-[#3d8b7a] text-white dark:bg-white dark:text-black'
                  : 'bg-gray-100 dark:bg-transparent border border-gray-200 dark:border-white/20 hover:border-[#3d8b7a] dark:hover:border-white/40 text-gray-600 dark:text-gray-300'
              }`}
              onClick={() => setStatusFilter(opt.value)}
              data-testid={`filter-status-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search broadcasts..."
              className="w-64 px-3 py-1.5 bg-gray-50 dark:bg-transparent border border-gray-200 dark:border-white/20 rounded text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-[#3d8b7a] dark:focus:border-white/40"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-broadcasts"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 w-3.5 h-3.5" />
          </div>
          <button className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 dark:border-white/20 hover:border-[#3d8b7a] dark:hover:border-white/40 text-gray-400 hover:text-[#3d8b7a] dark:hover:text-white transition" data-testid="button-filter">
            <Filter className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-400">Loading broadcasts...</p>
        </div>
      ) : !hasResults ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Radio className="w-12 h-12 text-gray-300 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">No broadcasts found</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4 text-center max-w-md text-sm">
            {searchQuery
              ? 'No broadcasts match your search.'
              : statusFilter !== 'all'
                ? `No ${statusFilter} broadcasts.`
                : campaigns.length === 0
                  ? 'Create a campaign first, then add broadcasts.'
                  : 'Create your first broadcast to get started.'}
          </p>
          {campaigns.length > 0 && !searchQuery && statusFilter === 'all' && (
            <Button onClick={() => setCreateOpen(true)} className="bg-[#3d8b7a] hover:bg-[#2f7365] dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black" data-testid="button-create-first-broadcast">
              <Plus className="w-4 h-4 mr-2" /> Create Broadcast
            </Button>
          )}
        </div>
      ) : (
        <div>
          {(statusFilter === 'all' || statusFilter === 'live') && liveBroadcasts.length > 0 && (
            <div className="mb-8" data-testid="section-live-broadcasts">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">Live Now</h2>
                <span className="text-xs text-gray-400 dark:text-gray-500">{liveBroadcasts.length} broadcast{liveBroadcasts.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-3">
                {liveBroadcasts.map(b => <LiveBroadcastCard key={b.broadcastId} broadcast={b} />)}
              </div>
            </div>
          )}

          {(statusFilter === 'all' || statusFilter === 'upcoming') && upcomingBroadcasts.length > 0 && (
            <div className="mb-8" data-testid="section-upcoming-broadcasts">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">Upcoming</h2>
                <span className="text-xs text-gray-400 dark:text-gray-500">{upcomingBroadcasts.length} broadcast{upcomingBroadcasts.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-3">
                {upcomingBroadcasts.map(b => <UpcomingBroadcastCard key={b.broadcastId} broadcast={b} />)}
              </div>
            </div>
          )}

          {(statusFilter === 'all' || statusFilter === 'ended') && endedBroadcasts.length > 0 && (
            <div className="mb-8" data-testid="section-ended-broadcasts">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">Recently Ended</h2>
                <span className="text-xs text-gray-400 dark:text-gray-500">{endedBroadcasts.length} broadcast{endedBroadcasts.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="space-y-3">
                {endedBroadcasts.map(b => <EndedBroadcastCard key={b.broadcastId} broadcast={b} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}