import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { AppLayout } from '@/components/AppLayout';
import type { ClientApp, Campaign, Broadcast } from '@shared/schema';
import {
  Smartphone,
  Megaphone,
  Radio,
  Plus,
  ChevronRight,
  Activity,
  Clock,
  Zap,
} from 'lucide-react';

export default function DashboardPage() {
  const { userId, reachuUserId } = useUser();

  const { data: clientApps = [] } = useQuery<ClientApp[]>({
    queryKey: ['/api/client-apps', userId],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps?userId=${userId}`);
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

  const { data: broadcasts = [] } = useQuery<Broadcast[]>({
    queryKey: ['/api/broadcasts', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/broadcasts');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
  });

  const activeCampaigns = campaigns.filter(c => !c.isPaused);
  const liveBroadcasts = broadcasts.filter(b => b.status === 'live');
  const upcomingBroadcasts = broadcasts.filter(b => b.status === 'upcoming');

  const stats = [
    {
      label: 'Apps',
      value: clientApps.length,
      icon: Smartphone,
      href: '/apps',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Campaigns',
      value: campaigns.length,
      icon: Megaphone,
      href: '/campaigns',
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      subtitle: `${activeCampaigns.length} active`,
    },
    {
      label: 'Broadcasts',
      value: broadcasts.length,
      icon: Radio,
      href: '/broadcasts',
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      subtitle: `${liveBroadcasts.length} live`,
    },
  ];

  const recentCampaigns = [...campaigns]
    .sort((a, b) => (b.id || 0) - (a.id || 0))
    .slice(0, 5);

  const recentBroadcasts = [...broadcasts]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 5);

  return (
    <AppLayout title={`Welcome back, ${reachuUserId || 'User'}`} subtitle="Here's an overview of your platform">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="border border-white/10 hover:border-white/20 transition-all cursor-pointer group" data-testid={`stat-${stat.label.toLowerCase()}`}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`w-12 h-12 rounded-xl ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  {stat.subtitle && (
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.subtitle}</p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="border border-white/10">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-purple-400" />
              Recent Campaigns
            </CardTitle>
            <Link href="/campaigns">
              <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="link-all-campaigns">
                View all <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentCampaigns.length === 0 ? (
              <div className="text-center py-8">
                <Megaphone className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">No campaigns yet</p>
                <Link href="/campaigns">
                  <Button size="sm" className="gap-1">
                    <Plus className="w-3 h-3" /> Create Campaign
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentCampaigns.map((campaign) => (
                  <Link key={campaign.id} href={`/campaigns/${campaign.id}`}>
                    <div
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      data-testid={`dashboard-campaign-${campaign.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${campaign.isPaused ? 'bg-yellow-400' : 'bg-green-400'}`} />
                        <div>
                          <p className="text-sm font-medium">{campaign.name}</p>
                          {campaign.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[250px]">{campaign.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {campaign.isPaused ? 'Paused' : 'Active'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-white/10">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Radio className="w-4 h-4 text-green-400" />
              Recent Broadcasts
            </CardTitle>
            <Link href="/broadcasts">
              <Button variant="ghost" size="sm" className="text-xs gap-1" data-testid="link-all-broadcasts">
                View all <ChevronRight className="w-3 h-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentBroadcasts.length === 0 ? (
              <div className="text-center py-8">
                <Radio className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">No broadcasts yet</p>
                <Link href="/broadcasts">
                  <Button size="sm" className="gap-1">
                    <Plus className="w-3 h-3" /> Create Broadcast
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentBroadcasts.map((broadcast) => (
                  <Link key={broadcast.broadcastId} href={`/broadcasts/${broadcast.broadcastId}`}>
                    <div
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                      data-testid={`dashboard-broadcast-${broadcast.broadcastId}`}
                    >
                      <div className="flex items-center gap-3">
                        <StatusDot status={broadcast.status} />
                        <div>
                          <p className="text-sm font-medium">{broadcast.broadcastName}</p>
                          <p className="text-xs text-muted-foreground">
                            Campaign #{broadcast.campaignId}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={broadcast.status} />
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {liveBroadcasts.length > 0 && (
        <Card className="border border-green-500/30 bg-green-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400 animate-pulse" />
              Live Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {liveBroadcasts.map((broadcast) => (
                <Link key={broadcast.broadcastId} href={`/broadcasts/${broadcast.broadcastId}`}>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/10 hover:bg-green-500/15 transition-colors cursor-pointer" data-testid={`live-broadcast-${broadcast.broadcastId}`}>
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{broadcast.broadcastName}</p>
                      <p className="text-xs text-muted-foreground">Campaign #{broadcast.campaignId}</p>
                    </div>
                    <Zap className="w-4 h-4 text-green-400" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/apps">
          <Button variant="outline" className="gap-2" data-testid="quick-new-app">
            <Plus className="w-4 h-4" /> New App
          </Button>
        </Link>
        <Link href="/campaigns">
          <Button variant="outline" className="gap-2" data-testid="quick-new-campaign">
            <Plus className="w-4 h-4" /> New Campaign
          </Button>
        </Link>
        <Link href="/broadcasts">
          <Button variant="outline" className="gap-2" data-testid="quick-new-broadcast">
            <Plus className="w-4 h-4" /> New Broadcast
          </Button>
        </Link>
      </div>
    </AppLayout>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    live: 'bg-green-400',
    upcoming: 'bg-yellow-400',
    ended: 'bg-gray-400',
  };
  return <div className={`w-2 h-2 rounded-full ${colors[status] || 'bg-gray-400'}`} />;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    live: 'bg-green-500/20 text-green-400',
    upcoming: 'bg-yellow-500/20 text-yellow-400',
    ended: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.ended}`}>
      {status}
    </span>
  );
}
