import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/AppLayout';
import { useUser } from '@/contexts/UserContext';
import type { Sponsor, Campaign } from '@shared/schema';
import {
  ArrowLeft,
  Users,
  Building2,
  Radio,
  LayoutGrid,
  ExternalLink,
} from 'lucide-react';

interface CampaignWithSponsor extends Campaign {
  sponsorId?: number | null;
  isPaused?: string | boolean;
}

export default function SponsorDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { userId } = useUser();

  const sponsorId = parseInt(params.id || '0');

  const { data: sponsor, isLoading: sponsorLoading } = useQuery<Sponsor>({
    queryKey: ['/api/sponsors', sponsorId],
    queryFn: async () => {
      const res = await fetch(`/api/sponsors/${sponsorId}`);
      if (!res.ok) throw new Error('Sponsor not found');
      return res.json();
    },
    enabled: !!sponsorId,
  });

  const { data: allCampaigns = [] } = useQuery<CampaignWithSponsor[]>({
    queryKey: ['/api/campaigns', userId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      return res.json();
    },
    enabled: !!userId,
  });

  const sponsoredCampaigns = allCampaigns.filter(c => c.sponsorId === sponsorId);
  const activeCampaigns = sponsoredCampaigns.filter(c => c.isPaused !== 'true' && c.isPaused !== true);

  if (sponsorLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!sponsor) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Building2 className="w-10 h-10 text-gray-600 mb-3" />
          <p className="text-gray-400">Sponsor not found</p>
          <button onClick={() => setLocation('/sponsors')} className="mt-4 text-sm text-gray-400 hover:text-white underline">
            Back to Sponsors
          </button>
        </div>
      </AppLayout>
    );
  }

  const primary = sponsor.primaryColor || '#3d8b7a';
  const secondary = sponsor.secondaryColor || '#666666';

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Back */}
        <button
          onClick={() => setLocation('/sponsors')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition"
          data-testid="button-back-sponsors"
        >
          <ArrowLeft className="w-4 h-4" />
          Sponsors
        </button>

        {/* Header card */}
        <div className="border border-white/10 rounded-xl overflow-hidden" data-testid="card-sponsor-profile">
          {/* Color banner */}
          <div
            className="h-24 w-full"
            style={{ background: `linear-gradient(135deg, ${primary}33 0%, ${secondary}22 100%)` }}
          />

          <div className="px-6 pb-6">
            {/* Logo/avatar overlapping banner */}
            <div className="flex items-end justify-between -mt-8 mb-4">
              <div className="w-16 h-16 rounded-xl border-2 border-[#0a0e1a] overflow-hidden bg-[#141824] flex items-center justify-center shadow-lg">
                {sponsor.logoUrl ? (
                  <img
                    src={sponsor.logoUrl}
                    alt={`${sponsor.name} logo`}
                    className="w-full h-full object-cover"
                    data-testid="img-sponsor-logo"
                  />
                ) : (
                  <Users className="w-7 h-7 text-gray-500" />
                )}
              </div>
              {sponsor.avatarUrl && (
                <img
                  src={sponsor.avatarUrl}
                  alt={`${sponsor.name} avatar`}
                  className="w-10 h-10 rounded-full border-2 border-[#0a0e1a] object-cover"
                  data-testid="img-sponsor-avatar"
                />
              )}
            </div>

            <h1 className="text-xl font-bold text-white mb-1" data-testid="text-sponsor-name">{sponsor.name}</h1>
            {sponsor.description && (
              <p className="text-sm text-gray-400 mb-4" data-testid="text-sponsor-description">{sponsor.description}</p>
            )}

            {/* Colors */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded border border-white/10"
                  style={{ backgroundColor: primary }}
                  data-testid="swatch-primary"
                />
                <span className="text-xs text-gray-500 font-mono">{primary}</span>
                <span className="text-[10px] text-gray-600">Primary</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className="w-5 h-5 rounded border border-white/10"
                  style={{ backgroundColor: secondary }}
                  data-testid="swatch-secondary"
                />
                <span className="text-xs text-gray-500 font-mono">{secondary}</span>
                <span className="text-[10px] text-gray-600">Secondary</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-white/10 rounded-xl p-5 flex items-center gap-4" data-testid="stat-total-campaigns">
            <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{sponsoredCampaigns.length}</div>
              <div className="text-xs text-gray-500">Total campaigns</div>
            </div>
          </div>
          <div className="border border-white/10 rounded-xl p-5 flex items-center gap-4" data-testid="stat-active-campaigns">
            <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center">
              <Radio className="w-5 h-5 text-[#3d8b7a]" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{activeCampaigns.length}</div>
              <div className="text-xs text-gray-500">Active campaigns</div>
            </div>
          </div>
        </div>

        {/* Campaigns list */}
        <div className="border border-white/10 rounded-xl" data-testid="section-campaigns">
          <div className="px-5 py-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-gray-300">Campaigns using this sponsor</h2>
          </div>

          {sponsoredCampaigns.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <LayoutGrid className="w-8 h-8 text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No campaigns linked to this sponsor yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {sponsoredCampaigns.map(campaign => {
                const isActive = campaign.isPaused !== 'true' && campaign.isPaused !== true;
                return (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition cursor-pointer"
                    onClick={() => setLocation(`/campaigns/${campaign.id}`)}
                    data-testid={`row-campaign-${campaign.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                        <LayoutGrid className="w-4 h-4 text-gray-500" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{campaign.name}</div>
                        <div className="text-xs text-gray-500">{(campaign as any).status || 'Draft'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        isActive
                          ? 'bg-[#3d8b7a]/10 text-[#3d8b7a]'
                          : 'bg-white/5 text-gray-500'
                      }`}>
                        {isActive ? 'Active' : 'Paused'}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-600" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}
