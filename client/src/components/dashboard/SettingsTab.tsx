import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { Trash2, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Campaign, UpdateCampaign, Channel, CampaignEngagementConfig, CampaignFeatureFlags } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface SettingsTabProps {
  campaignId: number;
  campaign: Campaign;
}

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
  { code: 'PL', name: 'Poland' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CO', name: 'Colombia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'SG', name: 'Singapore' },
  { code: 'IN', name: 'India' },
  { code: 'CN', name: 'China' },
];

export function SettingsTab({ campaignId, campaign }: SettingsTabProps) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description || '');
  const [startDate, setStartDate] = useState(
    campaign.startDate ? new Date(campaign.startDate).toISOString().slice(0, 16) : ''
  );
  const [endDate, setEndDate] = useState(
    campaign.endDate ? new Date(campaign.endDate).toISOString().slice(0, 16) : ''
  );
  const [isSegmented, setIsSegmented] = useState(campaign.isSegmented === 'true');
  const [targetCountries, setTargetCountries] = useState<string[]>(campaign.targetCountries || []);
  const [targetPercentage, setTargetPercentage] = useState<number>(campaign.targetPercentage || 100);
  const [countrySearch, setCountrySearch] = useState('');
  const [channelId, setChannelId] = useState<number | null>(campaign.channelId || null);
  const [reachuApiKey, setReachuApiKey] = useState(campaign.reachuApiKey || '');
  const [paymentMethods, setPaymentMethods] = useState<string[]>((campaign.paymentMethods as string[] | null) || ['apple_pay']);

  // Engagement config
  const [demoMode, setDemoMode] = useState(false);
  const [defaultPollDuration, setDefaultPollDuration] = useState(300);
  const [defaultContestDuration, setDefaultContestDuration] = useState(600);
  const [maxVotesPerPoll, setMaxVotesPerPoll] = useState(1);
  const [maxContestsPerMatch, setMaxContestsPerMatch] = useState(10);
  const [enableRealTimeUpdates, setEnableRealTimeUpdates] = useState(true);
  const [updateInterval, setUpdateInterval] = useState(1000);

  // Feature flags
  const [enableLiveStreaming, setEnableLiveStreaming] = useState(true);
  const [enableProductCatalog, setEnableProductCatalog] = useState(true);
  const [enableEngagement, setEnableEngagement] = useState(true);
  const [enablePolls, setEnablePolls] = useState(true);
  const [enableContests, setEnableContests] = useState(true);

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: [`/api/channels?userId=${campaign.userId}`],
  });

  const { data: engagementConfig } = useQuery<CampaignEngagementConfig | null>({
    queryKey: [`/api/campaigns/${campaignId}/engagement-config`],
  });

  const { data: featureFlagsData } = useQuery<CampaignFeatureFlags | null>({
    queryKey: [`/api/campaigns/${campaignId}/feature-flags`],
  });

  useEffect(() => {
    if (engagementConfig) {
      if (engagementConfig.demoMode !== undefined) setDemoMode(engagementConfig.demoMode);
      if (engagementConfig.defaultPollDuration !== undefined) setDefaultPollDuration(engagementConfig.defaultPollDuration);
      if (engagementConfig.defaultContestDuration !== undefined) setDefaultContestDuration(engagementConfig.defaultContestDuration);
      if (engagementConfig.maxVotesPerPoll !== undefined) setMaxVotesPerPoll(engagementConfig.maxVotesPerPoll);
      if (engagementConfig.maxContestsPerMatch !== undefined) setMaxContestsPerMatch(engagementConfig.maxContestsPerMatch);
      if (engagementConfig.enableRealTimeUpdates !== undefined) setEnableRealTimeUpdates(engagementConfig.enableRealTimeUpdates);
      if (engagementConfig.updateInterval !== undefined) setUpdateInterval(engagementConfig.updateInterval);
    }
  }, [engagementConfig]);

  useEffect(() => {
    if (featureFlagsData) {
      if (featureFlagsData.enableLiveStreaming !== undefined) setEnableLiveStreaming(featureFlagsData.enableLiveStreaming);
      if (featureFlagsData.enableProductCatalog !== undefined) setEnableProductCatalog(featureFlagsData.enableProductCatalog);
      if (featureFlagsData.enableEngagement !== undefined) setEnableEngagement(featureFlagsData.enableEngagement);
      if (featureFlagsData.enablePolls !== undefined) setEnablePolls(featureFlagsData.enablePolls);
      if (featureFlagsData.enableContests !== undefined) setEnableContests(featureFlagsData.enableContests);
    }
  }, [featureFlagsData]);

  const updateCampaignMutation = useMutation({
    mutationFn: async (data: UpdateCampaign) => {
      return await apiRequest('PUT', `/api/campaigns/${campaignId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId] });
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === '/api/campaigns'
      });
      toast({ title: 'Campaign Updated', description: 'Your changes have been saved.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update campaign.', variant: 'destructive' });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', `/api/campaigns/${campaignId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === '/api/campaigns'
      });
      toast({ title: 'Campaign Deleted', description: 'The campaign has been permanently deleted.' });
      setLocation('/');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete campaign.', variant: 'destructive' });
    },
  });

  const saveEngagementConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PUT', `/api/campaigns/${campaignId}/engagement-config`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/engagement-config`] });
      toast({ title: 'Saved', description: 'Engagement settings saved.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save engagement settings.', variant: 'destructive' });
    },
  });

  const saveFeatureFlagsMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PUT', `/api/campaigns/${campaignId}/feature-flags`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/feature-flags`] });
      toast({ title: 'Saved', description: 'Feature flags saved.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save feature flags.', variant: 'destructive' });
    },
  });

  const handleSaveBasicInfo = (e: React.FormEvent) => {
    e.preventDefault();
    updateCampaignMutation.mutate({ name, description });
  };

  const handleSaveDates = (e: React.FormEvent) => {
    e.preventDefault();
    updateCampaignMutation.mutate({
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null,
    });
  };

  const handleSaveChannel = () => {
    updateCampaignMutation.mutate({ channelId });
  };

  const handleSaveReachuApiKey = () => {
    updateCampaignMutation.mutate({ reachuApiKey: reachuApiKey || null });
  };

  const handleTogglePaymentMethod = (method: string) => {
    setPaymentMethods(prev =>
      prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]
    );
  };

  const handleSavePaymentMethods = () => {
    updateCampaignMutation.mutate({ paymentMethods });
  };

  const handleSaveSegmentation = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSegmented && targetCountries.length === 0) {
      toast({ title: 'Validation Error', description: 'Select at least one country for segmentation.', variant: 'destructive' });
      return;
    }
    updateCampaignMutation.mutate({
      isSegmented: isSegmented ? 'true' : 'false',
      targetCountries: isSegmented ? targetCountries : null,
      targetPercentage: isSegmented ? targetPercentage : null,
    });
  };

  const handleSaveEngagement = (e: React.FormEvent) => {
    e.preventDefault();
    saveEngagementConfigMutation.mutate({
      demoMode: demoMode ? 'true' : 'false',
      defaultPollDuration,
      defaultContestDuration,
      maxVotesPerPoll,
      maxContestsPerMatch,
      enableRealTimeUpdates: enableRealTimeUpdates ? 'true' : 'false',
      updateInterval,
    });
  };

  const handleSaveFeatureFlags = (e: React.FormEvent) => {
    e.preventDefault();
    saveFeatureFlagsMutation.mutate({
      enableLiveStreaming: enableLiveStreaming ? 'true' : 'false',
      enableProductCatalog: enableProductCatalog ? 'true' : 'false',
      enableEngagement: enableEngagement ? 'true' : 'false',
      enablePolls: enablePolls ? 'true' : 'false',
      enableContests: enableContests ? 'true' : 'false',
    });
  };

  const toggleCountry = (code: string) => {
    setTargetCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const filteredCountries = COUNTRY_OPTIONS.filter(country =>
    country.code.includes(countrySearch.toUpperCase()) ||
    country.name.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const isSaving = updateCampaignMutation.isPending;

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Basic Information */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-1">Basic Information</h2>
        <p className="text-xs text-gray-500 mb-4">Update your campaign's name and description</p>
        <div className="border border-white/10 rounded-lg p-6">
          <form onSubmit={handleSaveBasicInfo} className="space-y-4">
            <div className="space-y-1.5">
              <div className="text-xs text-gray-500 uppercase font-medium">Campaign Name</div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter campaign name"
                required
                data-testid="input-campaign-name"
              />
            </div>
            <div className="space-y-1.5">
              <div className="text-xs text-gray-500 uppercase font-medium">Description</div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter campaign description"
                rows={3}
                data-testid="input-campaign-description"
              />
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 bg-white hover:bg-gray-200 text-black rounded text-xs transition font-medium disabled:opacity-50"
              data-testid="button-save-basic-info"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      </div>

      {/* Campaign Schedule */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-1">Campaign Schedule</h2>
        <p className="text-xs text-gray-500 mb-4">Set the start and end dates</p>
        <div className="border border-white/10 rounded-lg p-6">
          <form onSubmit={handleSaveDates} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="text-xs text-gray-500 uppercase font-medium">Start Date</div>
                <Input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-xs text-gray-500 uppercase font-medium">End Date</div>
                <Input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 bg-white hover:bg-gray-200 text-black rounded text-xs transition font-medium disabled:opacity-50"
              data-testid="button-save-dates"
            >
              {isSaving ? 'Saving...' : 'Save Schedule'}
            </button>
          </form>
        </div>
      </div>

      {/* Channel Assignment */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-1">Channel Assignment</h2>
        <p className="text-xs text-gray-500 mb-4">Optional — assign to a channel for grouping or legacy integrations</p>
        <div className="border border-white/10 rounded-lg p-6 space-y-4">
          <div className="space-y-1.5">
            <div className="text-xs text-gray-500 uppercase font-medium">Channel</div>
            <Select
              value={channelId?.toString() || "__none__"}
              onValueChange={(value) => setChannelId(value === "__none__" ? null : parseInt(value))}
            >
              <SelectTrigger data-testid="select-channel">
                <SelectValue placeholder="No channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No channel</SelectItem>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id.toString()}>
                    {channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            onClick={handleSaveChannel}
            disabled={isSaving}
            className="px-4 py-1.5 bg-white hover:bg-gray-200 text-black rounded text-xs transition font-medium disabled:opacity-50"
            data-testid="button-save-channel"
          >
            {isSaving ? 'Saving...' : 'Save Channel'}
          </button>
        </div>
      </div>

      {/* Commerce Integration */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-1">Commerce Integration</h2>
        <p className="text-xs text-gray-500 mb-4">API key for the Commerce module integration</p>
        <div className="border border-white/10 rounded-lg p-6 space-y-4">
          <div className="space-y-1.5">
            <div className="text-xs text-gray-500 uppercase font-medium">API Key</div>
            <Input
              value={reachuApiKey}
              onChange={(e) => setReachuApiKey(e.target.value)}
              placeholder="Enter Commerce API key..."
              className="font-mono text-sm"
              data-testid="input-campaign-reachu-key"
            />
          </div>
          <button
            onClick={handleSaveReachuApiKey}
            disabled={isSaving}
            className="px-4 py-1.5 bg-white hover:bg-gray-200 text-black rounded text-xs transition font-medium disabled:opacity-50"
            data-testid="button-save-campaign-reachu-key"
          >
            {isSaving ? 'Saving...' : 'Save API Key'}
          </button>
        </div>
      </div>

      {/* Payment Methods */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-1">Payment Methods</h2>
        <p className="text-xs text-gray-500 mb-4">Select which payment methods are enabled for checkout in this campaign</p>
        <div className="border border-white/10 rounded-lg p-6 space-y-4">
          {[
            { id: 'apple_pay', label: 'Apple Pay' },
            { id: 'klarna', label: 'Klarna' },
            { id: 'vipps', label: 'Vipps' },
            { id: 'stripe_link', label: 'Stripe Link' },
          ].map(({ id, label }) => (
            <div key={id} className="flex items-center gap-3">
              <Checkbox
                id={`pm-${id}`}
                checked={paymentMethods.includes(id)}
                onCheckedChange={() => handleTogglePaymentMethod(id)}
                data-testid={`checkbox-payment-${id}`}
              />
              <label htmlFor={`pm-${id}`} className="text-sm text-white cursor-pointer">{label}</label>
            </div>
          ))}
          <button
            onClick={handleSavePaymentMethods}
            disabled={updateCampaignMutation.isPending}
            className="px-4 py-1.5 bg-white hover:bg-gray-200 text-black rounded text-xs transition font-medium disabled:opacity-50 mt-2"
            data-testid="button-save-payment-methods"
          >
            {updateCampaignMutation.isPending ? 'Saving...' : 'Save Payment Methods'}
          </button>
        </div>
      </div>

      {/* Targeting & Segmentation */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-1">Targeting & Segmentation</h2>
        <p className="text-xs text-gray-500 mb-4">Restrict campaign visibility by country and user percentage</p>
        <div className="border border-white/10 rounded-lg p-6">
          <form onSubmit={handleSaveSegmentation} className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={isSegmented}
                onCheckedChange={(checked) => setIsSegmented(checked as boolean)}
                data-testid="checkbox-enable-segmentation"
              />
              <span className="text-sm text-gray-200">Enable segmentation for this campaign</span>
            </label>

            {isSegmented && (
              <>
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 uppercase font-medium">Target Countries</div>
                  <p className="text-xs text-gray-600">Select which countries can see this campaign</p>
                  <Input
                    placeholder="Search countries..."
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    data-testid="input-country-search"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-3 max-h-56 overflow-y-auto border border-white/10 rounded-lg p-3">
                    {filteredCountries.map(country => (
                      <label key={country.code} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-2 py-1.5 rounded">
                        <Checkbox
                          checked={targetCountries.includes(country.code)}
                          onCheckedChange={() => toggleCountry(country.code)}
                          data-testid={`checkbox-country-${country.code}`}
                        />
                        <span className="text-xs text-gray-300">{country.code} — {country.name}</span>
                      </label>
                    ))}
                  </div>
                  {targetCountries.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {targetCountries.map(code => {
                        const country = COUNTRY_OPTIONS.find(c => c.code === code);
                        return (
                          <span key={code} className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-gray-300" data-testid={`badge-country-${code}`}>
                            {country?.name || code}
                            <button type="button" onClick={() => toggleCountry(code)} className="hover:text-white ml-0.5">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-gray-500 uppercase font-medium">
                    User Percentage — {targetPercentage}%
                  </div>
                  <p className="text-xs text-gray-600">Show to this percentage of users (deterministic by user ID)</p>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={targetPercentage}
                    onChange={(e) => setTargetPercentage(parseInt(e.target.value))}
                    className="w-full accent-white"
                    data-testid="input-target-percentage"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={targetPercentage}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val >= 1 && val <= 100) setTargetPercentage(val);
                      }}
                      className="w-20"
                      data-testid="input-percentage-number"
                    />
                    <span className="text-xs text-gray-500">%</span>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-1.5 bg-white hover:bg-gray-200 text-black rounded text-xs transition font-medium disabled:opacity-50"
              data-testid="button-save-segmentation"
            >
              {isSaving ? 'Saving...' : 'Save Targeting'}
            </button>
          </form>
        </div>
      </div>

      {/* Engagement Settings */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-1">Engagement Settings</h2>
        <p className="text-xs text-gray-500 mb-4">Configure polls, contests, and real-time defaults for this campaign</p>
        <div className="border border-white/10 rounded-lg p-6">
          <form onSubmit={handleSaveEngagement} className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-200">Demo Mode</div>
                <div className="text-xs text-gray-500 mt-0.5">Use mock data for testing only</div>
              </div>
              <Switch
                checked={demoMode}
                onCheckedChange={setDemoMode}
                data-testid="switch-demo-mode"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="text-xs text-gray-500 uppercase font-medium">Default Poll Duration (s)</div>
                <Input
                  type="number"
                  value={defaultPollDuration}
                  onChange={(e) => setDefaultPollDuration(parseInt(e.target.value) || 300)}
                  min={30}
                  max={3600}
                  data-testid="input-poll-duration"
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-xs text-gray-500 uppercase font-medium">Default Contest Duration (s)</div>
                <Input
                  type="number"
                  value={defaultContestDuration}
                  onChange={(e) => setDefaultContestDuration(parseInt(e.target.value) || 600)}
                  min={60}
                  max={7200}
                  data-testid="input-contest-duration"
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-xs text-gray-500 uppercase font-medium">Max Votes Per Poll</div>
                <Input
                  type="number"
                  value={maxVotesPerPoll}
                  onChange={(e) => setMaxVotesPerPoll(parseInt(e.target.value) || 1)}
                  min={1}
                  max={10}
                  data-testid="input-max-votes"
                />
              </div>
              <div className="space-y-1.5">
                <div className="text-xs text-gray-500 uppercase font-medium">Max Contests Per Broadcast</div>
                <Input
                  type="number"
                  value={maxContestsPerMatch}
                  onChange={(e) => setMaxContestsPerMatch(parseInt(e.target.value) || 10)}
                  min={1}
                  max={50}
                  data-testid="input-max-contests"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-200">Real-Time Updates</div>
                <div className="text-xs text-gray-500 mt-0.5">Use WebSocket for live data</div>
              </div>
              <Switch
                checked={enableRealTimeUpdates}
                onCheckedChange={setEnableRealTimeUpdates}
                data-testid="switch-realtime-updates"
              />
            </div>

            {!enableRealTimeUpdates && (
              <div className="space-y-1.5">
                <div className="text-xs text-gray-500 uppercase font-medium">Polling Interval (ms)</div>
                <Input
                  type="number"
                  value={updateInterval}
                  onChange={(e) => setUpdateInterval(parseInt(e.target.value) || 1000)}
                  min={500}
                  max={10000}
                  data-testid="input-update-interval"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={saveEngagementConfigMutation.isPending}
              className="px-4 py-1.5 bg-white hover:bg-gray-200 text-black rounded text-xs transition font-medium disabled:opacity-50"
              data-testid="button-save-engagement"
            >
              {saveEngagementConfigMutation.isPending ? 'Saving...' : 'Save Engagement Settings'}
            </button>
          </form>
        </div>
      </div>

      {/* Feature Flags */}
      <div>
        <h2 className="text-sm font-semibold text-gray-400 uppercase mb-1">Feature Flags</h2>
        <p className="text-xs text-gray-500 mb-4">Enable or disable SDK features for this campaign</p>
        <div className="border border-white/10 rounded-lg p-6">
          <form onSubmit={handleSaveFeatureFlags} className="space-y-5">
            {[
              { label: 'Live Streaming', desc: 'Enable video live streaming features', state: enableLiveStreaming, set: setEnableLiveStreaming, testId: 'switch-live-streaming' },
              { label: 'Product Catalog', desc: 'Enable product browsing and shopping', state: enableProductCatalog, set: setEnableProductCatalog, testId: 'switch-product-catalog' },
              { label: 'Engagement', desc: 'Enable polls, contests, and interactions', state: enableEngagement, set: setEnableEngagement, testId: 'switch-engagement' },
              { label: 'Polls', desc: 'Allow users to vote in polls', state: enablePolls, set: setEnablePolls, testId: 'switch-polls' },
              { label: 'Contests', desc: 'Allow users to participate in contests', state: enableContests, set: setEnableContests, testId: 'switch-contests' },
            ].map(({ label, desc, state, set, testId }) => (
              <div key={label} className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-200">{label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
                </div>
                <Switch checked={state} onCheckedChange={set} data-testid={testId} />
              </div>
            ))}

            <button
              type="submit"
              disabled={saveFeatureFlagsMutation.isPending}
              className="px-4 py-1.5 bg-white hover:bg-gray-200 text-black rounded text-xs transition font-medium disabled:opacity-50"
              data-testid="button-save-feature-flags"
            >
              {saveFeatureFlagsMutation.isPending ? 'Saving...' : 'Save Feature Flags'}
            </button>
          </form>
        </div>
      </div>

      {/* Danger Zone */}
      <div>
        <h2 className="text-sm font-semibold text-red-400/80 uppercase mb-1">Danger Zone</h2>
        <p className="text-xs text-gray-500 mb-4">Permanent and irreversible actions</p>
        <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-200">Delete Campaign</div>
              <div className="text-xs text-gray-500 mt-0.5">Permanently delete this campaign and all associated data</div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded text-xs transition font-medium flex items-center gap-1.5"
                  data-testid="button-delete-campaign"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the campaign
                    "<strong>{campaign.name}</strong>" and all associated data including:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>All campaign components</li>
                      <li>Scheduled components</li>
                      <li>Event history</li>
                      <li>Form states</li>
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteCampaignMutation.mutate()}
                    disabled={deleteCampaignMutation.isPending}
                    className="bg-destructive hover:bg-destructive/90"
                    data-testid="button-confirm-delete"
                  >
                    {deleteCampaignMutation.isPending ? 'Deleting...' : 'Delete Campaign'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

    </div>
  );
}
