import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AppLayout } from '@/components/AppLayout';
import { ImageUploadWithPreview } from '@/components/ImageUploadWithPreview';
import type { Campaign, ClientApp, Sponsor } from '@shared/schema';
import { Megaphone, Calendar, Globe } from 'lucide-react';

const COUNTRY_OPTIONS = [
  { code: 'NO', name: 'Norway' },
  { code: 'SE', name: 'Sweden' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'IS', name: 'Iceland' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'PT', name: 'Portugal' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'BR', name: 'Brazil' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' },
];

export default function NewCampaignPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { userId } = useUser();

  const searchParams = new URLSearchParams(window.location.search);
  const preselectedAppId = searchParams.get('appId');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState('');
  const [selectedAppId, setSelectedAppId] = useState<string>(preselectedAppId || '');
  const [selectedSponsorId, setSelectedSponsorId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [targetCountries, setTargetCountries] = useState<string[]>([]);

  const toggleCountry = (code: string) => {
    setTargetCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const { data: clientApps = [] } = useQuery<ClientApp[]>({
    queryKey: ['/api/client-apps', userId],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps?userId=${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: sponsorsList = [] } = useQuery<Sponsor[]>({
    queryKey: ['/api/sponsors', userId],
    queryFn: async () => {
      const res = await fetch(`/api/sponsors?userId=${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
  });

  const preselectedApp = clientApps.find(a => a.id === parseInt(preselectedAppId || ''));
  const selectedSponsor = sponsorsList.find(s => s.id === parseInt(selectedSponsorId || ''));

  const createMutation = useMutation<Campaign, Error, any>({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', '/api/campaigns', data);
      return response.json();
    },
    onSuccess: (newCampaign) => {
      toast({ title: 'Campaign Created', description: 'Your new campaign is ready.' });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key === '/api/campaigns' || key === '/api/client-apps';
        }
      });
      setLocation(`/campaigns/${newCampaign.id}`);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Could not create campaign', variant: 'destructive' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userId) return;

    const data: any = {
      name: name.trim(),
      description: description.trim() || undefined,
      logo: logo.trim() || undefined,
      userId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };

    if (selectedAppId && selectedAppId !== 'none') {
      data.clientAppId = parseInt(selectedAppId);
    }

    if (selectedSponsorId && selectedSponsorId !== 'none') {
      data.sponsorId = parseInt(selectedSponsorId);
    }

    if (targetCountries.length > 0) {
      data.targetCountries = targetCountries;
      data.isSegmented = 'true';
    }

    createMutation.mutate(data);
  };

  const breadcrumbs = preselectedApp
    ? [
        { label: 'Apps', href: '/apps' },
        { label: preselectedApp.name, href: `/apps/${preselectedApp.id}` },
        { label: 'New Campaign' },
      ]
    : [
        { label: 'Campaigns', href: '/campaigns' },
        { label: 'New Campaign' },
      ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-white/10 dark:bg-white/10 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-gray-300" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100" data-testid="text-page-title">
              Create New Campaign
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Set up a new campaign to manage broadcasts and events.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Basic Information
            </h2>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">Campaign Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer Sale 2026"
                required
                data-testid="input-campaign-name"
                className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-gray-700 dark:text-gray-300">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the campaign"
                rows={3}
                data-testid="input-campaign-description"
                className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>

            <ImageUploadWithPreview
              label="Logo"
              value={logo}
              onChange={setLogo}
              placeholder="Upload or paste logo URL"
              testId="input-campaign-logo"
            />
          </div>

          <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              App & Sponsor
            </h2>

            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">Assign to App</Label>
              <Select value={selectedAppId} onValueChange={setSelectedAppId}>
                <SelectTrigger
                  data-testid="select-app"
                  className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <SelectValue placeholder="Select an app (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No app</SelectItem>
                  {clientApps.map((app) => (
                    <SelectItem key={app.id} value={String(app.id)} data-testid={`option-app-${app.id}`}>
                      {app.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Link this campaign to an app to share components and branding.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">Sponsor</Label>
              <Select value={selectedSponsorId} onValueChange={setSelectedSponsorId}>
                <SelectTrigger
                  data-testid="select-sponsor"
                  className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <SelectValue placeholder="Select a sponsor (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No sponsor</SelectItem>
                  {sponsorsList.map((sponsor) => (
                    <SelectItem key={sponsor.id} value={String(sponsor.id)} data-testid={`option-sponsor-${sponsor.id}`}>
                      <span className="flex items-center gap-2">
                        {sponsor.logoUrl && (
                          <img src={sponsor.logoUrl} alt="" className="w-4 h-4 rounded object-cover" />
                        )}
                        {sponsor.primaryColor && (
                          <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: sponsor.primaryColor }} />
                        )}
                        {sponsor.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSponsor && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg mt-2">
                  {selectedSponsor.logoUrl && (
                    <img src={selectedSponsor.logoUrl} alt={selectedSponsor.name} className="w-8 h-8 rounded object-cover" data-testid="img-selected-sponsor" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white" data-testid="text-selected-sponsor">{selectedSponsor.name}</p>
                  </div>
                  {selectedSponsor.primaryColor && (
                    <span className="w-5 h-5 rounded-full border border-gray-200 dark:border-gray-600" style={{ backgroundColor: selectedSponsor.primaryColor }} />
                  )}
                  {selectedSponsor.secondaryColor && (
                    <span className="w-5 h-5 rounded-full border border-gray-200 dark:border-gray-600" style={{ backgroundColor: selectedSponsor.secondaryColor }} />
                  )}
                </div>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500">
                The sponsor's branding (colors, logo, avatar) will be used in the SDK.
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Schedule
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-gray-700 dark:text-gray-300">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Start Date
                  </span>
                </Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                  className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-gray-700 dark:text-gray-300">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> End Date
                  </span>
                </Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                  className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-4 h-4" /> Geographic Targeting
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Select the countries where this campaign will be active. Leave empty to target all countries.
            </p>

            {targetCountries.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {targetCountries.map(code => {
                  const c = COUNTRY_OPTIONS.find(o => o.code === code);
                  return (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded text-xs text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition"
                      onClick={() => toggleCountry(code)}
                      data-testid={`badge-selected-country-${code}`}
                    >
                      {c?.name || code} ✕
                    </span>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {COUNTRY_OPTIONS.map(country => (
                <label
                  key={country.code}
                  className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 dark:hover:bg-white/5 transition"
                  data-testid={`label-country-${country.code}`}
                >
                  <Checkbox
                    checked={targetCountries.includes(country.code)}
                    onCheckedChange={() => toggleCountry(country.code)}
                    data-testid={`checkbox-country-${country.code}`}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-mono text-xs text-gray-400 dark:text-gray-500 mr-1">{country.code}</span>
                    {country.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation(preselectedAppId ? `/apps/${preselectedAppId}` : '/campaigns')}
              data-testid="button-cancel"
              className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              data-testid="button-create-campaign"
              className="bg-white hover:bg-gray-200 text-[#0a0e1a] gap-2"
            >
              <Megaphone className="w-4 h-4" />
              {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
