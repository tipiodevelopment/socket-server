import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Image,
  Clock,
  Gift,
  BarChart3,
  Trophy,
  ChartNoAxesColumn,
  Pencil,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Campaign, CampaignComponent, Component, CampaignFeatureFlags, Broadcast } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CampaignComponentConfigForm } from "./ComponentsTab";
import { Button } from "@/components/ui/button";

interface OverviewTabProps {
  campaignId: number;
  campaign: Campaign & { clientAppName?: string | null; channelName?: string | null };
  onNavigateTab?: (tab: string) => void;
}

type CampaignStats = {
  totalViews: number;
  engagementRate: number;
  totalPollResponses: number;
  totalPolls: number;
  totalContests: number;
  liveBroadcasts: number;
  upcomingBroadcasts: number;
  endedBroadcasts: number;
  totalBroadcasts: number;
};

type EnrichedBroadcast = Broadcast & {
  pollCount: number;
  activePollCount: number;
  contestCount: number;
};

function formatViewers(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${Math.round(count / 1000)}K`;
  return count.toLocaleString();
}

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

const COMPONENT_ICONS: Record<string, typeof Image> = {
  banner: Image,
  countdown: Clock,
  offer_badge: Gift,
  offer_banner: Gift,
  carousel_auto: Image,
  carousel_manual: Image,
  product_spotlight: Gift,
  product_carousel: Image,
  product_banner: Image,
  product_store: Gift,
};

const COMPONENT_TYPE_LABELS: Record<string, string> = {
  banner: 'Banner',
  countdown: 'Countdown',
  carousel_auto: 'Auto Carousel',
  carousel_manual: 'Manual Carousel',
  product_spotlight: 'Spotlight',
  offer_badge: 'Offer',
  offer_banner: 'Offer Banner',
  product_carousel: 'Carousel',
  product_banner: 'Banner',
  product_store: 'Store',
};

export function OverviewTab({ campaignId, campaign, onNavigateTab }: OverviewTabProps) {
  const { toast } = useToast();
  const [editingConfigFor, setEditingConfigFor] = useState<(CampaignComponent & { component: Component }) | null>(null);

  const { data: stats } = useQuery<CampaignStats>({
    queryKey: ['/api/campaigns', campaignId, 'stats'],
  });

  const { data: broadcasts = [] } = useQuery<EnrichedBroadcast[]>({
    queryKey: ['/api/campaigns', campaignId, 'broadcasts'],
  });

  const { data: campaignComponents = [] } = useQuery<Array<CampaignComponent & { component: Component }>>({
    queryKey: ['/api/campaigns', campaignId, 'components'],
    refetchInterval: 5000,
  });

  const { data: featureFlags } = useQuery<CampaignFeatureFlags>({
    queryKey: ['/api/campaigns', campaignId, 'feature-flags'],
  });

  const activeComponents = campaignComponents.filter(cc => cc.status === 'active');

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ componentId, status }: { componentId: string; status: 'active' | 'inactive' }) => {
      return await apiRequest('PATCH', `/api/campaigns/${campaignId}/components/${componentId}`, { status });
    },
    onSuccess: async () => {
      toast({ title: 'Status Updated', description: 'Component status has been updated.' });
      await queryClient.invalidateQueries({
        queryKey: ['/api/campaigns', campaignId, 'components'],
        refetchType: 'active'
      });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update component status.', variant: 'destructive' });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({ componentId, customConfig }: { componentId: string; customConfig: any }) => {
      return await apiRequest('PATCH', `/api/campaigns/${campaignId}/components/${componentId}/config`, { customConfig });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'components'] });
      setEditingConfigFor(null);
      toast({ title: 'Configuration Updated', description: 'The component configuration has been personalized for this campaign.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message || 'Failed to update component configuration.', variant: 'destructive' });
    },
  });

  const updateFeatureFlagsMutation = useMutation({
    mutationFn: async (flags: Record<string, string>) => {
      return await apiRequest('PUT', `/api/campaigns/${campaignId}/feature-flags`, flags);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'feature-flags'] });
      toast({ title: 'Feature Flags Updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update feature flags.', variant: 'destructive' });
    },
  });

  const isCampaignActive = () => {
    const now = new Date();
    if (campaign.startDate && new Date(campaign.startDate) > now) return false;
    if (campaign.endDate && new Date(campaign.endDate) < now) return false;
    return true;
  };
  const isPaused = campaign.isPaused === 'true';

  const toggleFlag = (key: string, currentValue: string) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    if (featureFlags) {
      updateFeatureFlagsMutation.mutate({
        ...{
          enableLiveStreaming: featureFlags.enableLiveStreaming,
          enableProductCatalog: featureFlags.enableProductCatalog,
          enableEngagement: featureFlags.enableEngagement,
          enablePolls: featureFlags.enablePolls,
          enableContests: featureFlags.enableContests,
        },
        [key]: newValue,
      });
    }
  };

  const featureFlagItems = featureFlags ? [
    { key: 'enablePolls', label: 'Live Polls', desc: 'Allow real-time polling during broadcast', value: featureFlags.enablePolls },
    { key: 'enableContests', label: 'Contests & Trivia', desc: 'Enable interactive contests and quizzes', value: featureFlags.enableContests },
    { key: 'enableEngagement', label: 'Match Predictions', desc: 'Allow users to predict match outcomes', value: featureFlags.enableEngagement },
    { key: 'enableProductCatalog', label: 'Product Spotlights', desc: 'Show sponsored product highlights', value: featureFlags.enableProductCatalog },
    { key: 'enableLiveStreaming', label: 'Live Streaming', desc: 'Enable live streaming features', value: featureFlags.enableLiveStreaming },
  ] : [];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6" data-testid="section-stats">
        <div className="bg-transparent border border-white/10 rounded-lg p-5">
          <div className="text-xs text-gray-400 mb-1 uppercase font-medium">Total Views</div>
          <div className="text-2xl font-bold text-white" data-testid="stat-total-views">
            {stats ? formatViewers(stats.totalViews) : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Across {stats?.totalBroadcasts || 0} broadcasts</div>
        </div>
        <div className="bg-transparent border border-white/10 rounded-lg p-5">
          <div className="text-xs text-gray-400 mb-1 uppercase font-medium">Engagement Rate</div>
          <div className="text-2xl font-bold text-white" data-testid="stat-engagement-rate">
            {stats && stats.engagementRate > 0 ? `${stats.engagementRate}%` : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Average across broadcasts</div>
        </div>
        <div className="bg-transparent border border-white/10 rounded-lg p-5">
          <div className="text-xs text-gray-400 mb-1 uppercase font-medium">Poll Responses</div>
          <div className="text-2xl font-bold text-white" data-testid="stat-poll-responses">
            {stats ? formatViewers(stats.totalPollResponses) : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Across {stats?.totalPolls || 0} polls</div>
        </div>
        <div className="bg-transparent border border-white/10 rounded-lg p-5">
          <div className="text-xs text-gray-400 mb-1 uppercase font-medium">Active Broadcasts</div>
          <div className="text-2xl font-bold text-white" data-testid="stat-active-broadcasts">
            {stats ? stats.liveBroadcasts + stats.upcomingBroadcasts : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {stats ? `${stats.liveBroadcasts} live, ${stats.upcomingBroadcasts} upcoming` : '—'}
          </div>
        </div>
      </div>

      {/* Campaign Details */}
      <div data-testid="section-campaign-details">
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4">Campaign Details</h2>
        <div className="bg-transparent border border-white/10 rounded-lg p-6">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-5">
              <div>
                <div className="text-xs text-gray-500 mb-1 uppercase font-medium">Description</div>
                <div className="text-sm text-gray-200" data-testid="text-campaign-description">
                  {campaign.description || 'No description provided'}
                </div>
              </div>
              {(campaign.matchId || campaign.matchName) && (
                <div>
                  <div className="text-xs text-gray-500 mb-1 uppercase font-medium">Match Context</div>
                  {campaign.matchId && <div className="text-sm text-gray-200">Match ID: {campaign.matchId}</div>}
                  {campaign.matchName && <div className="text-sm text-gray-200">{campaign.matchName}</div>}
                  {campaign.matchStartTime && (
                    <div className="text-sm text-gray-400">
                      {new Date(campaign.matchStartTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' - '}
                      {new Date(campaign.matchStartTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500 mb-1 uppercase font-medium">Campaign Period</div>
                <div className="text-sm text-gray-200" data-testid="text-campaign-period">
                  {campaign.startDate
                    ? new Date(campaign.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Not set'}
                  {' - '}
                  {campaign.endDate
                    ? new Date(campaign.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Ongoing'}
                </div>
              </div>
            </div>
            <div className="space-y-5">
              {campaign.targetCountries && campaign.targetCountries.length > 0 && (
                <div>
                  <div className="text-xs text-gray-500 mb-1 uppercase font-medium">Target Countries</div>
                  <div className="flex flex-wrap gap-2 mt-2" data-testid="list-target-countries">
                    {campaign.targetCountries.map((country) => (
                      <span key={country} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300">
                        {country}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {campaign.targetPercentage && (
                <div>
                  <div className="text-xs text-gray-500 mb-1 uppercase font-medium">Audience Targeting</div>
                  <div className="text-sm text-gray-200">{campaign.targetPercentage}% of users in target countries</div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-500 mb-1 uppercase font-medium">Branding</div>
                <div className="flex items-center space-x-3 mt-2" data-testid="section-branding">
                  {campaign.brandName && (
                    <div className="flex items-center space-x-2">
                      {campaign.brandIconUrl && (
                        <img src={campaign.brandIconUrl} alt={campaign.brandName} className="w-8 h-8 rounded object-cover" />
                      )}
                      <span className="text-xs text-gray-400">{campaign.brandName}</span>
                    </div>
                  )}
                  {campaign.logo && (
                    <div className="flex items-center space-x-2">
                      <img src={campaign.logo} alt="Campaign logo" className="w-8 h-8 rounded object-cover" />
                      <span className="text-xs text-gray-400">Logo</span>
                    </div>
                  )}
                  {!campaign.brandName && !campaign.logo && (
                    <span className="text-xs text-gray-500">No branding configured</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Broadcasts */}
      <div data-testid="section-broadcasts">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase">Broadcasts</h2>
          <button
            onClick={() => onNavigateTab?.('broadcasts')}
            className="px-4 py-1.5 bg-white hover:bg-gray-200 text-black rounded text-xs transition font-medium cursor-pointer"
            data-testid="button-view-all-broadcasts"
          >
            View All
          </button>
        </div>
        {broadcasts.length === 0 ? (
          <div className="bg-transparent border border-white/10 rounded-lg p-8 text-center">
            <p className="text-sm text-gray-500">No broadcasts created yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {broadcasts.map((broadcast) => {
              const viewers = broadcast.metadata && typeof broadcast.metadata === 'object' && 'viewers' in broadcast.metadata
                ? Number((broadcast.metadata as Record<string, unknown>).viewers) || 0
                : 0;
              return (
                <Link key={broadcast.broadcastId} href={`/broadcasts/${broadcast.broadcastId}`} className="block">
                  <div
                    className="bg-transparent border border-white/10 rounded-lg p-5 hover:border-white/30 transition-all cursor-pointer"
                    data-testid={`overview-broadcast-${broadcast.broadcastId}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white">{broadcast.broadcastName}</h3>
                          {broadcast.status === 'live' && (
                            <span className="px-2 py-0.5 bg-[#3d8b7a] text-white dark:bg-white dark:text-black text-[10px] uppercase font-bold rounded-full">Live</span>
                          )}
                          {broadcast.status === 'upcoming' && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300 text-[10px] uppercase font-bold rounded-full border border-gray-200 dark:border-white/20">Upcoming</span>
                          )}
                          {broadcast.status === 'ended' && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-400 dark:bg-white/10 dark:text-gray-400 text-[10px] uppercase font-bold rounded-full border border-gray-200 dark:border-white/10">Ended</span>
                          )}
                        </div>
                        {broadcast.description && (
                          <div className="text-sm text-gray-400 mb-3">{broadcast.description}</div>
                        )}
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          {viewers > 0 && (
                            <div className="flex items-center space-x-1.5">
                              <ChartNoAxesColumn className="w-3 h-3" />
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
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        {broadcast.status === 'live' && broadcast.startTime && (
                          <div className="text-xs text-gray-400">Started {formatTimeAgo(new Date(broadcast.startTime))}</div>
                        )}
                        {broadcast.status === 'upcoming' && broadcast.startTime && (
                          <div className="text-xs text-gray-400">{formatTimeUntil(new Date(broadcast.startTime))}</div>
                        )}
                        {broadcast.status === 'ended' && broadcast.endTime && (
                          <div className="text-xs text-gray-400">Ended {formatTimeAgo(new Date(broadcast.endTime))}</div>
                        )}
                        <span className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition">
                          {broadcast.status === 'live' ? 'Manage' : broadcast.status === 'upcoming' ? 'Configure' : 'View Report'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Components */}
      <div data-testid="section-components">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase">Active Components</h2>
          <button
            onClick={() => onNavigateTab?.('components')}
            className="px-4 py-1.5 bg-transparent border border-white/20 hover:border-white/40 text-white rounded text-xs transition font-medium"
            data-testid="button-manage-components"
          >
            Manage Components
          </button>
        </div>
        {activeComponents.length === 0 && campaignComponents.length === 0 ? (
          <div className="bg-transparent border border-white/10 rounded-lg p-8 text-center">
            <p className="text-sm text-gray-500">No components added to this campaign</p>
          </div>
        ) : activeComponents.length === 0 ? (
          <div className="bg-transparent border border-white/10 rounded-lg p-8 text-center">
            <p className="text-sm text-gray-500">No active components — {campaignComponents.length} component{campaignComponents.length !== 1 ? 's' : ''} inactive</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {activeComponents.map((cc) => {
              const IconComponent = COMPONENT_ICONS[cc.component.type] || Image;
              return (
                <div
                  key={cc.id}
                  className="bg-transparent border border-white/10 rounded-lg p-4"
                  data-testid={`overview-component-${cc.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center">
                      <IconComponent className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-gray-500 uppercase font-medium">
                        {COMPONENT_TYPE_LABELS[cc.component.type] || cc.component.type}
                      </span>
                      <button
                        onClick={() => setEditingConfigFor(cc)}
                        className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-white transition"
                        data-testid={`overview-customize-${cc.id}`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => toggleStatusMutation.mutate({ componentId: cc.componentId, status: 'inactive' })}
                        disabled={toggleStatusMutation.isPending || !isCampaignActive() || isPaused}
                        className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-white transition"
                        data-testid={`overview-toggle-${cc.id}`}
                      >
                        <ToggleRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="text-sm font-medium text-white mb-1">{cc.instanceName || cc.component.name}</div>
                  <div className="text-xs text-gray-500">
                    {cc.scheduledTime ? `Scheduled: ${new Date(cc.scheduledTime).toLocaleDateString()}` : 'Active during broadcast'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feature Flags */}
      {featureFlags && (
        <div data-testid="section-feature-flags">
          <h2 className="text-sm font-semibold text-gray-400 uppercase mb-4">Feature Flags</h2>
          <div className="bg-transparent border border-white/10 rounded-lg p-6">
            <div className="space-y-4">
              {featureFlagItems.map((flag, i) => (
                <div
                  key={flag.key}
                  className={`flex items-center justify-between py-2 ${i > 0 ? 'border-t border-white/5' : ''}`}
                  data-testid={`flag-${flag.key}`}
                >
                  <div>
                    <div className="text-sm font-medium text-white mb-0.5">{flag.label}</div>
                    <div className="text-xs text-gray-500">{flag.desc}</div>
                  </div>
                  <button
                    onClick={() => toggleFlag(flag.key, flag.value)}
                    disabled={updateFeatureFlagsMutation.isPending}
                    className="focus:outline-none"
                    data-testid={`toggle-${flag.key}`}
                  >
                    {flag.value === 'true' ? (
                      <div className="w-11 h-6 bg-white rounded-full relative cursor-pointer">
                        <div className="w-5 h-5 bg-black rounded-full absolute top-0.5 right-0.5"></div>
                      </div>
                    ) : (
                      <div className="w-11 h-6 bg-white/20 rounded-full relative cursor-pointer">
                        <div className="w-5 h-5 bg-white/40 rounded-full absolute top-0.5 left-0.5"></div>
                      </div>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Customize Config Dialog */}
      <Dialog open={!!editingConfigFor} onOpenChange={(open) => !open && setEditingConfigFor(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customize Component</DialogTitle>
            <DialogDescription>
              Edit this component's configuration for this campaign. Changes broadcast in real-time via WebSocket.
            </DialogDescription>
          </DialogHeader>
          {editingConfigFor && (
            <CampaignComponentConfigForm
              campaignComponent={editingConfigFor}
              onSubmit={(customConfig) =>
                updateConfigMutation.mutate({
                  componentId: editingConfigFor.componentId,
                  customConfig
                })
              }
              onRevertToDefault={() => {
                updateConfigMutation.mutate({
                  componentId: editingConfigFor.componentId,
                  customConfig: null
                });
              }}
              onCancel={() => setEditingConfigFor(null)}
              isLoading={updateConfigMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
