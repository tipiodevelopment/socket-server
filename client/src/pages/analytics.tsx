import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'wouter';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';
import {
  BarChart3, Smartphone, Megaphone, Radio, Users, TrendingUp, Vote,
  Trophy, Globe, Award, ChevronRight, ArrowLeft, Layers, Activity,
  Eye, MessageSquare, Package, Clock, Target, Zap,
} from 'lucide-react';

type DrillView = 
  | { type: 'global' }
  | { type: 'app'; id: number }
  | { type: 'campaign'; id: number }
  | { type: 'broadcast'; id: string };

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

function StatCard({ label, value, icon: Icon, sub, testId }: { label: string; value: string | number; icon: any; sub?: string; testId: string }) {
  return (
    <div className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-lg p-5" data-testid={testId}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">{label}</span>
        <Icon className="w-4 h-4 text-[#3d8b7a] dark:text-gray-500" />
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{typeof value === 'number' ? formatNum(value) : value}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</h2>
      {action}
    </div>
  );
}

function useChartTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  return {
    grid: isDark ? '#2a3142' : '#e5e7eb',
    tick: isDark ? '#6b7280' : '#9ca3af',
    tooltipBg: isDark ? '#141824' : '#ffffff',
    tooltipBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    tooltipColor: isDark ? '#fff' : '#1f2937',
    barFill: isDark ? '#ffffff' : '#3d8b7a',
    linePrimary: isDark ? '#ffffff' : '#3d8b7a',
    lineSecondary: isDark ? '#6b7280' : '#8fd8d0',
    progressBg: isDark ? 'bg-white/5' : 'bg-gray-100',
    progressFill: isDark ? 'bg-white/60' : 'bg-[#3d8b7a]/60',
    voteBg: isDark ? 'bg-white/5' : 'bg-gray-100',
    voteFill: isDark ? 'bg-white/50' : 'bg-[#3d8b7a]/50',
  };
}

function GlobalDashboard({ onDrill }: { onDrill: (view: DrillView) => void }) {
  const { data: overview, isLoading: loadingOverview, isError: errorOverview } = useQuery<any>({ queryKey: ['/api/analytics/overview'] });
  const { data: engagement, isLoading: loadingEngagement } = useQuery<any>({ queryKey: ['/api/analytics/engagement'] });
  const { data: geo, isLoading: loadingGeo } = useQuery<any>({ queryKey: ['/api/analytics/geographic'] });
  const { data: sponsorData, isLoading: loadingSponsors } = useQuery<any>({ queryKey: ['/api/analytics/sponsors'] });
  const chart = useChartTheme();

  if (errorOverview) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 dark:text-gray-500" data-testid="error-analytics">
        <div className="text-center">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-sm">Failed to load analytics data. Please try again.</p>
        </div>
      </div>
    );
  }

  if (loadingOverview) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-28 bg-gray-100 dark:bg-[#141824]" />)}
        </div>
      </div>
    );
  }

  const o = overview || { apps: {}, campaigns: {}, broadcasts: {}, engagement: {}, totals: {} };

  return (
    <div className="space-y-8">
      <SectionHeader title="Platform KPIs" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="section-kpis">
        <StatCard label="Active Apps" value={o.apps?.active ?? 0} icon={Smartphone} sub={`${o.apps?.total ?? 0} total`} testId="stat-active-apps" />
        <StatCard label="Active Campaigns" value={o.campaigns?.active ?? 0} icon={Megaphone} sub={`${o.campaigns?.paused ?? 0} paused · ${o.campaigns?.ended ?? 0} ended`} testId="stat-active-campaigns" />
        <StatCard label="Live Broadcasts" value={o.broadcasts?.live ?? 0} icon={Radio} sub={`${o.broadcasts?.upcoming ?? 0} upcoming · ${o.broadcasts?.ended ?? 0} ended`} testId="stat-live-broadcasts" />
        <StatCard label="Engaged Users" value={o.engagement?.uniqueUsers ?? 0} icon={Users} sub={`${o.engagement?.uniqueVoters ?? 0} voters · ${o.engagement?.uniqueParticipants ?? 0} participants`} testId="stat-engaged-users" />
        <StatCard label="Total Votes" value={o.engagement?.totalVotes ?? 0} icon={Vote} sub={`Across ${o.totals?.polls ?? 0} polls`} testId="stat-total-votes" />
        <StatCard label="Participations" value={o.engagement?.totalParticipations ?? 0} icon={Trophy} sub={`Across ${o.totals?.contests ?? 0} contests`} testId="stat-total-participations" />
        <StatCard label="Components" value={o.totals?.components ?? 0} icon={Package} testId="stat-components" />
        <StatCard label="Sponsors" value={o.totals?.sponsors ?? 0} icon={Award} testId="stat-sponsors" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-lg p-5" data-testid="section-broadcast-activity">
          <SectionHeader title="Broadcast Activity (30 days)" />
          {loadingEngagement ? (
            <Skeleton className="h-48 bg-gray-100 dark:bg-[#1c2030]" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={engagement?.broadcastActivity || []}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis dataKey="date" tick={{ fill: chart.tick, fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
                <YAxis tick={{ fill: chart.tick, fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8, color: chart.tooltipColor }} />
                <Bar dataKey="count" fill={chart.barFill} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-lg p-5" data-testid="section-geographic">
          <SectionHeader title="Geographic Distribution" />
          {loadingGeo ? (
            <Skeleton className="h-48 bg-gray-100 dark:bg-[#1c2030]" />
          ) : (geo?.countries?.length ?? 0) === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">No geographic data available</div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {geo?.countries?.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-white/5">
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-[#3d8b7a] dark:text-gray-500" />
                    <span className="text-sm text-gray-900 dark:text-white">{c.country}</span>
                  </div>
                  <span className="text-xs text-gray-400">{c.campaignCount} campaigns</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-lg p-5" data-testid="section-top-campaigns">
        <SectionHeader title="Top Campaigns by Engagement" />
        {loadingEngagement ? (
          <Skeleton className="h-40 bg-gray-100 dark:bg-[#1c2030]" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 dark:text-gray-500 text-xs uppercase border-b border-gray-200 dark:border-white/10">
                  <th className="pb-3 pr-4">Campaign</th>
                  <th className="pb-3 pr-4">App</th>
                  <th className="pb-3 pr-4 text-right">Polls</th>
                  <th className="pb-3 pr-4 text-right">Contests</th>
                  <th className="pb-3 pr-4 text-right">Votes</th>
                  <th className="pb-3 pr-4 text-right">Participations</th>
                  <th className="pb-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(engagement?.topCampaigns || []).map((c: any) => (
                  <tr
                    key={c.id}
                    className="border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition"
                    onClick={() => onDrill({ type: 'campaign', id: c.id })}
                    data-testid={`row-campaign-${c.id}`}
                  >
                    <td className="py-3 pr-4 text-gray-900 dark:text-white font-medium">{c.name}</td>
                    <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">{c.clientAppName || '—'}</td>
                    <td className="py-3 pr-4 text-right text-gray-600 dark:text-gray-300">{c.totalPolls}</td>
                    <td className="py-3 pr-4 text-right text-gray-600 dark:text-gray-300">{c.totalContests}</td>
                    <td className="py-3 pr-4 text-right text-gray-600 dark:text-gray-300">{formatNum(c.totalVotes)}</td>
                    <td className="py-3 pr-4 text-right text-gray-600 dark:text-gray-300">{formatNum(c.totalParticipations)}</td>
                    <td className="py-3 text-right text-gray-900 dark:text-white font-medium">{formatNum(c.totalEngagement)}</td>
                  </tr>
                ))}
                {(engagement?.topCampaigns?.length ?? 0) === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center text-gray-400 dark:text-gray-500">No campaign data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-lg p-5" data-testid="section-top-components">
          <SectionHeader title="Most Used Components" />
          {loadingEngagement ? (
            <Skeleton className="h-40 bg-gray-100 dark:bg-[#1c2030]" />
          ) : (
            <div className="space-y-3">
              {(engagement?.topComponents || []).map((c: any, i: number) => {
                const maxCount = engagement?.topComponents?.[0]?.campaignCount || 1;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-900 dark:text-white">{c.name}</span>
                      <span className="text-xs text-gray-400">{c.type} · {c.campaignCount} campaigns</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-1.5">
                      <div className="bg-[#3d8b7a] dark:bg-white/60 h-1.5 rounded-full" style={{ width: `${(c.campaignCount / maxCount) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
              {(engagement?.topComponents?.length ?? 0) === 0 && (
                <div className="py-8 text-center text-gray-400 dark:text-gray-500 text-sm">No component data yet</div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-lg p-5" data-testid="section-sponsors">
          <SectionHeader title="Sponsor Performance" />
          {loadingSponsors ? (
            <Skeleton className="h-40 bg-gray-100 dark:bg-[#1c2030]" />
          ) : (
            <div className="space-y-3">
              {(sponsorData?.sponsors || []).slice(0, 5).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    {s.logoUrl ? (
                      <img src={s.logoUrl} alt={s.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center"><Award className="w-4 h-4 text-[#3d8b7a] dark:text-gray-400" /></div>
                    )}
                    <div>
                      <div className="text-sm text-gray-900 dark:text-white font-medium">{s.name}</div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">{s.campaignCount} campaigns · {s.broadcastCount} broadcasts</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-900 dark:text-white font-medium">{formatNum(s.totalEngagement)}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500">engagement</div>
                  </div>
                </div>
              ))}
              {(sponsorData?.sponsors?.length ?? 0) === 0 && (
                <div className="py-8 text-center text-gray-400 dark:text-gray-500 text-sm">No sponsor data yet</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AppAnalytics({ appId, onDrill, onBack }: { appId: number; onDrill: (view: DrillView) => void; onBack: () => void }) {
  const { data, isLoading, isError } = useQuery<any>({ queryKey: ['/api/analytics/apps', appId] });

  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 bg-gray-100 dark:bg-[#141824]" />)}</div>;
  if (isError || !data) return <div className="text-center text-gray-400 dark:text-gray-500 py-12" data-testid="error-app-analytics">Failed to load app analytics</div>;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition" data-testid="button-back-app">
        <ArrowLeft className="w-4 h-4" /> Back to Overview
      </button>
      <div className="flex items-center gap-3 mb-2">
        <Smartphone className="w-5 h-5 text-[#3d8b7a] dark:text-white" />
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white" data-testid="text-app-name">{data.app.name}</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">{data.app.bundleId} · {data.app.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Campaigns" value={data.kpis.campaignCount} icon={Megaphone} sub={`${data.kpis.activeCampaigns} active`} testId="stat-app-campaigns" />
        <StatCard label="Channels" value={data.kpis.channelCount} icon={Layers} testId="stat-app-channels" />
        <StatCard label="Broadcasts" value={data.kpis.broadcastCount} icon={Radio} testId="stat-app-broadcasts" />
        <StatCard label="Total Engagement" value={data.kpis.totalVotes + data.kpis.totalParticipations} icon={Activity} sub={`${formatNum(data.kpis.totalVotes)} votes · ${formatNum(data.kpis.totalParticipations)} participations`} testId="stat-app-engagement" />
      </div>

      <div className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-lg p-5">
        <SectionHeader title="Campaigns" />
        <div className="space-y-2">
          {data.campaigns.map((c: any) => (
            <div
              key={c.id}
              className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition"
              onClick={() => onDrill({ type: 'campaign', id: c.id })}
              data-testid={`app-campaign-${c.id}`}
            >
              <div>
                <div className="text-sm text-gray-900 dark:text-white font-medium">{c.name}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {c.isPaused === 'true' ? 'Paused' : c.endDate && new Date(c.endDate) < new Date() ? 'Ended' : 'Active'}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-gray-900 dark:text-white">{formatNum(c.totalEngagement)}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">engagement</div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </div>
            </div>
          ))}
          {data.campaigns.length === 0 && <div className="py-6 text-center text-gray-400 dark:text-gray-500 text-sm">No campaigns yet</div>}
        </div>
      </div>
    </div>
  );
}

function VoteBar({ options }: { options: any[] }) {
  const total = options.reduce((s: number, o: any) => s + (o.voteCount || 0), 0);
  if (total === 0) return <span className="text-xs text-gray-400 dark:text-gray-500">No votes</span>;
  return (
    <div className="space-y-1.5 w-full">
      {options.sort((a: any, b: any) => a.displayOrder - b.displayOrder).map((opt: any) => {
        const pct = total > 0 ? Math.round((opt.voteCount / total) * 100) : 0;
        return (
          <div key={opt.id} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-24 truncate">{opt.text}</span>
            <div className="flex-1 bg-gray-100 dark:bg-white/5 rounded-full h-2">
              <div className="bg-[#3d8b7a] dark:bg-white/50 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 w-12 text-right">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function CampaignAnalytics({ campaignId, onDrill, onBack }: { campaignId: number; onDrill: (view: DrillView) => void; onBack: () => void }) {
  const { data, isLoading, isError } = useQuery<any>({ queryKey: ['/api/analytics/campaigns', campaignId] });
  const chart = useChartTheme();

  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 bg-gray-100 dark:bg-[#141824]" />)}</div>;
  if (isError || !data) return <div className="text-center text-gray-400 dark:text-gray-500 py-12" data-testid="error-campaign-analytics">Failed to load campaign analytics</div>;

  const c = data.campaign;
  const isPaused = c.isPaused === 'true';
  const hasEnded = c.endDate && new Date(c.endDate) < new Date();
  const statusLabel = isPaused ? 'Paused' : hasEnded ? 'Ended' : 'Active';

  const timelineData: any[] = [];
  const voteDates = new Map((data.engagementTimeline?.votes || []).map((v: any) => [v.date, v.count]));
  const partDates = new Map((data.engagementTimeline?.participations || []).map((v: any) => [v.date, v.count]));
  const allDates = new Set([...Array.from(voteDates.keys()), ...Array.from(partDates.keys())]);
  allDates.forEach(d => {
    timelineData.push({ date: d, votes: voteDates.get(d) || 0, participations: partDates.get(d) || 0 });
  });
  timelineData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition" data-testid="button-back-campaign">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white" data-testid="text-campaign-name">{c.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded ${statusLabel === 'Active' ? 'bg-[#3d8b7a] text-white dark:bg-white dark:text-black' : statusLabel === 'Paused' ? 'bg-amber-100 text-amber-700 dark:bg-yellow-500/20 dark:text-yellow-400' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>{statusLabel}</span>
            {c.clientAppName && <span className="text-xs text-gray-400 dark:text-gray-500">{c.clientAppName}</span>}
            {c.sponsorName && <span className="text-xs text-gray-400 dark:text-gray-500">· Sponsor: {c.sponsorName}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="section-campaign-kpis">
        <StatCard label="Broadcasts" value={data.kpis.broadcastCount} icon={Radio} testId="stat-campaign-broadcasts" />
        <StatCard label="Polls" value={data.kpis.pollCount} icon={Vote} testId="stat-campaign-polls" />
        <StatCard label="Contests" value={data.kpis.contestCount} icon={Trophy} testId="stat-campaign-contests" />
        <StatCard label="Total Votes" value={data.kpis.totalVotes} icon={TrendingUp} testId="stat-campaign-votes" />
        <StatCard label="Participations" value={data.kpis.totalParticipations} icon={Users} testId="stat-campaign-participations" />
        <StatCard label="Active Components" value={data.kpis.activeComponents} icon={Package} testId="stat-campaign-components" />
      </div>

      {timelineData.length > 0 && (
        <div className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-lg p-5" data-testid="section-engagement-timeline">
          <SectionHeader title="Engagement Timeline" />
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={timelineData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis dataKey="date" tick={{ fill: chart.tick, fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
              <YAxis tick={{ fill: chart.tick, fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8, color: chart.tooltipColor }} />
              <Legend wrapperStyle={{ fontSize: 12, color: chart.tick }} />
              <Line type="monotone" dataKey="votes" stroke={chart.linePrimary} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="participations" stroke={chart.lineSecondary} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-lg p-5" data-testid="section-polls-performance">
        <SectionHeader title="Polls Performance" />
        <div className="space-y-4">
          {data.polls.length === 0 && <div className="py-6 text-center text-gray-400 dark:text-gray-500 text-sm">No polls in this campaign</div>}
          {data.polls.map((p: any) => (
            <div key={p.id} className="border border-gray-200 dark:border-white/5 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm text-gray-900 dark:text-white font-medium">{p.question}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Broadcast: {p.broadcastName} · {p.totalVotes} votes · {p.isActive ? 'Active' : 'Closed'}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${p.isActive ? 'bg-[#3d8b7a] text-white dark:bg-white dark:text-black' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>
                  {p.isActive ? 'Active' : 'Closed'}
                </span>
              </div>
              <VoteBar options={p.options || []} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-lg p-5" data-testid="section-contests-performance">
        <SectionHeader title="Contests Performance" />
        <div className="space-y-3">
          {data.contests.length === 0 && <div className="py-6 text-center text-gray-400 dark:text-gray-500 text-sm">No contests in this campaign</div>}
          {data.contests.map((ct: any) => (
            <div key={ct.id} className="flex items-center justify-between py-3 px-3 border border-gray-200 dark:border-white/5 rounded-lg hover:bg-gray-50 dark:hover:bg-white/[0.02] transition">
              <div>
                <div className="text-sm text-gray-900 dark:text-white font-medium">{ct.title}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {ct.contestType} · {ct.broadcastName} {ct.prize && `· Prize: ${ct.prize}`}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-gray-900 dark:text-white">{ct.participationCount}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">participants</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${ct.isActive ? 'bg-[#3d8b7a] text-white dark:bg-white dark:text-black' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>
                  {ct.isActive ? 'Active' : 'Closed'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {data.components.length > 0 && (
        <div className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-lg p-5" data-testid="section-campaign-components">
          <SectionHeader title="Components" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.components.map((comp: any) => (
              <div key={comp.id} className="border border-gray-200 dark:border-white/5 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-900 dark:text-white font-medium">{comp.instanceName || comp.componentName}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${comp.status === 'active' ? 'bg-[#3d8b7a] text-white dark:bg-white dark:text-black' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>{comp.status}</span>
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">{comp.type}</div>
                {comp.activatedAt && <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Activated: {new Date(comp.activatedAt).toLocaleDateString()}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {c.isSegmented === 'true' && (
        <div className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-lg p-5" data-testid="section-segmentation">
          <SectionHeader title="Segmentation" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Target Countries</div>
              <div className="flex flex-wrap gap-1">
                {(c.targetCountries || []).map((country: string) => (
                  <span key={country} className="text-xs bg-[#3d8b7a]/10 text-[#3d8b7a] dark:bg-white/10 dark:text-white px-2 py-0.5 rounded">{country}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Target Percentage</div>
              <div className="text-sm text-gray-900 dark:text-white">{c.targetPercentage || 100}%</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BroadcastAnalytics({ broadcastId, onBack }: { broadcastId: string; onBack: () => void }) {
  const { data, isLoading, isError } = useQuery<any>({ queryKey: ['/api/analytics/broadcasts', broadcastId] });
  const chart = useChartTheme();

  if (isLoading) return <div className="space-y-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 bg-gray-100 dark:bg-[#141824]" />)}</div>;
  if (isError || !data) return <div className="text-center text-gray-400 dark:text-gray-500 py-12" data-testid="error-broadcast-analytics">Failed to load broadcast analytics</div>;

  const b = data.broadcast;
  const statusColors: Record<string, string> = {
    live: 'bg-[#3d8b7a] text-white dark:bg-white dark:text-black',
    upcoming: 'border border-[#3d8b7a] text-[#3d8b7a] dark:border-white/20 dark:text-white',
    ended: 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-gray-900 dark:hover:text-white text-sm transition" data-testid="button-back-broadcast">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white" data-testid="text-broadcast-name">{b.broadcastName}</h2>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded ${statusColors[b.status] || 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>{b.status}</span>
          {b.campaignName && <span className="text-xs text-gray-400 dark:text-gray-500">{b.campaignName}</span>}
          {b.channelName && <span className="text-xs text-gray-400 dark:text-gray-500">· {b.channelName}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="section-broadcast-kpis">
        <StatCard label="Polls" value={data.kpis.pollCount} icon={Vote} testId="stat-bc-polls" />
        <StatCard label="Contests" value={data.kpis.contestCount} icon={Trophy} testId="stat-bc-contests" />
        <StatCard label="Total Votes" value={data.kpis.totalVotes} icon={TrendingUp} testId="stat-bc-votes" />
        <StatCard label="Participations" value={data.kpis.totalParticipations} icon={Users} testId="stat-bc-participations" />
        <StatCard label="Unique Users" value={data.kpis.uniqueUsers} icon={Eye} testId="stat-bc-unique" />
      </div>

      {data.engagementTimeline.length > 0 && (
        <div className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-lg p-5" data-testid="section-bc-timeline">
          <SectionHeader title="Vote Timeline" />
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.engagementTimeline}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis dataKey="time" tick={{ fill: chart.tick, fontSize: 10 }} tickFormatter={(v) => new Date(v).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })} />
              <YAxis tick={{ fill: chart.tick, fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: chart.tooltipBg, border: `1px solid ${chart.tooltipBorder}`, borderRadius: 8, color: chart.tooltipColor }} />
              <Bar dataKey="votes" fill={chart.barFill} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-lg p-5" data-testid="section-bc-polls">
        <SectionHeader title="Poll Results" />
        <div className="space-y-4">
          {data.polls.length === 0 && <div className="py-6 text-center text-gray-400 dark:text-gray-500 text-sm">No polls</div>}
          {data.polls.map((p: any) => (
            <div key={p.id} className="border border-gray-200 dark:border-white/5 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm text-gray-900 dark:text-white font-medium">{p.question}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{p.totalVotes} votes · {p.uniqueVoters} unique voters</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${p.isActive ? 'bg-[#3d8b7a] text-white dark:bg-white dark:text-black' : 'bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400'}`}>{p.isActive ? 'Active' : 'Closed'}</span>
              </div>
              <VoteBar options={p.options || []} />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-lg p-5" data-testid="section-bc-contests">
        <SectionHeader title="Contest Results" />
        <div className="space-y-3">
          {data.contests.length === 0 && <div className="py-6 text-center text-gray-400 dark:text-gray-500 text-sm">No contests</div>}
          {data.contests.map((ct: any) => (
            <div key={ct.id} className="border border-gray-200 dark:border-white/5 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-900 dark:text-white font-medium">{ct.title}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{ct.contestType} {ct.prize && `· Prize: ${ct.prize}`}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-900 dark:text-white">{ct.participationCount}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">{ct.uniqueParticipants} unique</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [view, setView] = useState<DrillView>({ type: 'global' });

  const handleDrill = (newView: DrillView) => setView(newView);
  const handleBack = () => setView({ type: 'global' });

  const breadcrumbs: { label: string; href?: string }[] = [{ label: 'Analytics', href: '/analytics' }];
  if (view.type !== 'global') {
    breadcrumbs.push({ label: view.type === 'app' ? 'App Detail' : view.type === 'campaign' ? 'Campaign Detail' : 'Broadcast Detail', href: '#' });
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs} title="Analytics">
      <div className="max-w-7xl mx-auto" data-testid="page-analytics">
        {view.type === 'global' && <GlobalDashboard onDrill={handleDrill} />}
        {view.type === 'app' && <AppAnalytics appId={view.id} onDrill={handleDrill} onBack={handleBack} />}
        {view.type === 'campaign' && <CampaignAnalytics campaignId={view.id} onDrill={handleDrill} onBack={handleBack} />}
        {view.type === 'broadcast' && <BroadcastAnalytics broadcastId={view.id} onBack={handleBack} />}
      </div>
    </AppLayout>
  );
}