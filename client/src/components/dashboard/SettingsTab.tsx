import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Settings, Trash2, Upload, X, Link, Calendar, Palette, Zap, ToggleRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Campaign, UpdateCampaign, Channel, CampaignEngagementConfig, CampaignUiConfig, CampaignFeatureFlags } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ImageUploadWithPreview } from "@/components/ImageUploadWithPreview";
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
  const [activeTab, setActiveTab] = useState('basic');
  const [description, setDescription] = useState(campaign.description || '');
  const [startDate, setStartDate] = useState(
    campaign.startDate ? new Date(campaign.startDate).toISOString().slice(0, 16) : ''
  );
  const [endDate, setEndDate] = useState(
    campaign.endDate ? new Date(campaign.endDate).toISOString().slice(0, 16) : ''
  );
  const [logo, setLogo] = useState(campaign.logo || '');
  const [isSegmented, setIsSegmented] = useState(campaign.isSegmented === 'true');
  const [targetCountries, setTargetCountries] = useState<string[]>(campaign.targetCountries || []);
  const [targetPercentage, setTargetPercentage] = useState<number>(campaign.targetPercentage || 100);
  const [countrySearch, setCountrySearch] = useState('');
  const [channelId, setChannelId] = useState<number | null>(campaign.channelId || null);
  const [matchId, setMatchId] = useState(campaign.matchId || '');
  const [matchName, setMatchName] = useState(campaign.matchName || '');
  const [matchStartTime, setMatchStartTime] = useState(
    campaign.matchStartTime ? new Date(campaign.matchStartTime).toISOString().slice(0, 16) : ''
  );
  const [reachuApiKey, setReachuApiKey] = useState(campaign.reachuApiKey || '');


  // Engagement config
  const [demoMode, setDemoMode] = useState(false);
  const [defaultPollDuration, setDefaultPollDuration] = useState(300);
  const [defaultContestDuration, setDefaultContestDuration] = useState(600);
  const [maxVotesPerPoll, setMaxVotesPerPoll] = useState(1);
  const [maxContestsPerMatch, setMaxContestsPerMatch] = useState(10);
  const [enableRealTimeUpdates, setEnableRealTimeUpdates] = useState(true);
  const [updateInterval, setUpdateInterval] = useState(1000);

  // UI config
  const [primaryColor, setPrimaryColor] = useState('#007AFF');
  const [secondaryColor, setSecondaryColor] = useState('#5856D6');

  // Feature flags
  const [enableLiveStreaming, setEnableLiveStreaming] = useState(true);
  const [enableProductCatalog, setEnableProductCatalog] = useState(true);
  const [enableEngagement, setEnableEngagement] = useState(true);
  const [enablePolls, setEnablePolls] = useState(true);
  const [enableContests, setEnableContests] = useState(true);

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: [`/api/channels?userId=${campaign.userId}`],
  });

  // Fetch engagement config
  const { data: engagementConfig, isLoading: isLoadingEngagement } = useQuery<CampaignEngagementConfig | null>({
    queryKey: [`/api/campaigns/${campaignId}/engagement-config`],
  });

  // Fetch UI config
  const { data: uiConfig, isLoading: isLoadingUi } = useQuery<CampaignUiConfig | null>({
    queryKey: [`/api/campaigns/${campaignId}/ui-config`],
  });

  // Fetch feature flags
  const { data: featureFlagsData, isLoading: isLoadingFlags } = useQuery<CampaignFeatureFlags | null>({
    queryKey: [`/api/campaigns/${campaignId}/feature-flags`],
  });

  // Sync engagement config to state when loaded
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

  // Sync UI config to state when loaded
  useEffect(() => {
    if (uiConfig) {
      if (uiConfig.primaryColor) setPrimaryColor(uiConfig.primaryColor);
      if (uiConfig.secondaryColor) setSecondaryColor(uiConfig.secondaryColor);
    }
  }, [uiConfig]);

  // Sync feature flags to state when loaded
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
      // Invalidate all campaign queries (including tenant-scoped ones)
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === '/api/campaigns'
      });
      toast({
        title: 'Campaign Updated',
        description: 'Your changes have been saved successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update campaign.',
        variant: 'destructive',
      });
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', `/api/campaigns/${campaignId}`);
    },
    onSuccess: () => {
      // Invalidate all campaign queries (including tenant-scoped ones)
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === '/api/campaigns'
      });
      toast({
        title: 'Campaign Deleted',
        description: 'The campaign has been permanently deleted.',
      });
      setLocation('/');
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete campaign.',
        variant: 'destructive',
      });
    },
  });

  // Mutations for config sections
  const saveEngagementConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PUT', `/api/campaigns/${campaignId}/engagement-config`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/engagement-config`] });
      toast({ title: 'Saved', description: 'Engagement settings saved successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save engagement settings.', variant: 'destructive' });
    },
  });

  const saveUiConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PUT', `/api/campaigns/${campaignId}/ui-config`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/ui-config`] });
      toast({ title: 'Saved', description: 'UI theme saved successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save UI theme.', variant: 'destructive' });
    },
  });

  const saveFeatureFlagsMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('PUT', `/api/campaigns/${campaignId}/feature-flags`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/feature-flags`] });
      toast({ title: 'Saved', description: 'Feature flags saved successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save feature flags.', variant: 'destructive' });
    },
  });

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

  const handleSaveUiTheme = (e: React.FormEvent) => {
    e.preventDefault();
    saveUiConfigMutation.mutate({
      primaryColor,
      secondaryColor,
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

  const handleSaveBasicInfo = (e: React.FormEvent) => {
    e.preventDefault();
    updateCampaignMutation.mutate({
      name,
      description,
    });
  };

  const handleSaveDates = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Always include both dates in the update
    // Send as ISO strings (the backend will convert them to Date objects)
    const updates: UpdateCampaign = {
      startDate: startDate ? new Date(startDate).toISOString() : null,
      endDate: endDate ? new Date(endDate).toISOString() : null
    };
    
    updateCampaignMutation.mutate(updates);
  };

  const handleSaveLogo = () => {
    updateCampaignMutation.mutate({ logo });
  };

  const handleSaveChannel = () => {
    updateCampaignMutation.mutate({ channelId });
  };

  const handleSaveReachuApiKey = () => {
    updateCampaignMutation.mutate({ reachuApiKey: reachuApiKey || null });
  };

  const handleSaveMatchContext = (e: React.FormEvent) => {
    e.preventDefault();
    updateCampaignMutation.mutate({
      matchId: matchId || null,
      matchName: matchName || null,
      matchStartTime: matchStartTime ? new Date(matchStartTime).toISOString() : null,
    });
  };

  const handleClearMatchContext = () => {
    setMatchId('');
    setMatchName('');
    setMatchStartTime('');
    updateCampaignMutation.mutate({
      matchId: null,
      matchName: null,
      matchStartTime: null,
    });
  };

  const handleSaveSegmentation = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSegmented && targetCountries.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one country for segmentation',
        variant: 'destructive',
      });
      return;
    }

    updateCampaignMutation.mutate({
      isSegmented: isSegmented ? 'true' : 'false',
      targetCountries: isSegmented ? targetCountries : null,
      targetPercentage: isSegmented ? targetPercentage : null,
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

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Basic Information
          </CardTitle>
          <CardDescription>
            Update your campaign's basic details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveBasicInfo} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter campaign name"
                required
                data-testid="input-campaign-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-description">Description</Label>
              <Textarea
                id="campaign-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter campaign description"
                rows={3}
                data-testid="input-campaign-description"
              />
            </div>
            <Button 
              type="submit" 
              disabled={updateCampaignMutation.isPending}
              data-testid="button-save-basic-info"
            >
              {updateCampaignMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Channel Assignment */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="w-5 h-5" />
            Channel Assignment
          </CardTitle>
          <CardDescription>
            Optional — assign to a channel for grouping or legacy integrations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="channel-select">Channel</Label>
            <Select
              value={channelId?.toString() || ""}
              onValueChange={(value) => setChannelId(value ? parseInt(value) : null)}
            >
              <SelectTrigger id="channel-select" data-testid="select-channel">
                <SelectValue placeholder="Select a channel" />
              </SelectTrigger>
              <SelectContent>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id.toString()}>
                    {channel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleSaveChannel}
            disabled={updateCampaignMutation.isPending}
            data-testid="button-save-channel"
          >
            {updateCampaignMutation.isPending ? 'Saving...' : 'Save Channel'}
          </Button>
        </CardContent>
      </Card>

      {/* Reachu Integration */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Reachu Integration
          </CardTitle>
          <CardDescription>
            API key for Reachu commerce integration (optional)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reachu-api-key">Reachu API Key</Label>
            <Input
              id="reachu-api-key"
              value={reachuApiKey}
              onChange={(e) => setReachuApiKey(e.target.value)}
              placeholder="Enter Reachu API key..."
              className="font-mono text-sm"
              data-testid="input-campaign-reachu-key"
            />
          </div>
          <Button
            onClick={handleSaveReachuApiKey}
            disabled={updateCampaignMutation.isPending}
            data-testid="button-save-campaign-reachu-key"
          >
            {updateCampaignMutation.isPending ? 'Saving...' : 'Save API Key'}
          </Button>
        </CardContent>
      </Card>

      {/* Campaign Dates */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle>Campaign Schedule</CardTitle>
          <CardDescription>
            Set the start and end dates for your campaign
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveDates} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
            </div>
            <Button 
              type="submit" 
              disabled={updateCampaignMutation.isPending}
              data-testid="button-save-dates"
            >
              {updateCampaignMutation.isPending ? 'Saving...' : 'Save Schedule'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Campaign Logo */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Campaign Logo
          </CardTitle>
          <CardDescription>
            Upload or provide a URL for your campaign logo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ImageUploadWithPreview
            value={logo}
            onChange={setLogo}
            label="Logo"
            testId="campaign-logo"
          />
          <Button 
            onClick={handleSaveLogo}
            disabled={updateCampaignMutation.isPending}
            data-testid="button-save-logo"
          >
            {updateCampaignMutation.isPending ? 'Saving...' : 'Save Logo'}
          </Button>
        </CardContent>
      </Card>

      {/* Match Context */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Match Context
          </CardTitle>
          <CardDescription>
            Associate this campaign with a specific match or event for context-aware targeting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveMatchContext} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="match-id">Match ID</Label>
              <Input
                id="match-id"
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                placeholder="Enter external match identifier (e.g., match-123)"
                data-testid="input-match-id"
              />
              <p className="text-xs text-muted-foreground">
                External identifier to link this campaign to a specific match
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="match-name">Match Name</Label>
              <Input
                id="match-name"
                value={matchName}
                onChange={(e) => setMatchName(e.target.value)}
                placeholder="Enter match name (e.g., Team A vs Team B)"
                data-testid="input-match-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="match-start-time">Match Start Time</Label>
              <Input
                id="match-start-time"
                type="datetime-local"
                value={matchStartTime}
                onChange={(e) => setMatchStartTime(e.target.value)}
                data-testid="input-match-start-time"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                type="submit" 
                disabled={updateCampaignMutation.isPending}
                data-testid="button-save-match-context"
              >
                {updateCampaignMutation.isPending ? 'Saving...' : 'Save Match Context'}
              </Button>
              {(matchId || matchName || matchStartTime) && (
                <Button 
                  type="button"
                  variant="outline"
                  onClick={handleClearMatchContext}
                  disabled={updateCampaignMutation.isPending}
                  data-testid="button-clear-match-context"
                >
                  Clear Match Context
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Targeting & Segmentation */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Targeting & Segmentation
          </CardTitle>
          <CardDescription>
            Restrict campaign visibility by country and user percentage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveSegmentation} className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="enable-segmentation"
                checked={isSegmented}
                onCheckedChange={(checked) => setIsSegmented(checked as boolean)}
                data-testid="checkbox-enable-segmentation"
              />
              <Label htmlFor="enable-segmentation" className="cursor-pointer">
                Enable segmentation for this campaign
              </Label>
            </div>

            {isSegmented && (
              <>
                <div className="space-y-2">
                  <Label>Target Countries</Label>
                  <p className="text-xs text-muted-foreground">
                    Select which countries can see this campaign
                  </p>
                  <Input
                    placeholder="Search countries..."
                    value={countrySearch}
                    onChange={(e) => setCountrySearch(e.target.value)}
                    data-testid="input-country-search"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 max-h-60 overflow-y-auto border rounded-lg p-3">
                    {filteredCountries.map(country => (
                      <label key={country.code} className="flex items-center space-x-2 cursor-pointer hover:bg-accent p-2 rounded">
                        <Checkbox
                          checked={targetCountries.includes(country.code)}
                          onCheckedChange={() => toggleCountry(country.code)}
                          data-testid={`checkbox-country-${country.code}`}
                        />
                        <span className="text-sm">{country.code}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {targetCountries.map(code => {
                      const country = COUNTRY_OPTIONS.find(c => c.code === code);
                      return (
                        <Badge key={code} variant="secondary" className="flex items-center gap-1" data-testid={`badge-country-${code}`}>
                          {country?.name || code}
                          <button
                            type="button"
                            onClick={() => toggleCountry(code)}
                            className="hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target-percentage">
                    User Percentage: {targetPercentage}%
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Only show this campaign to this percentage of users (deterministic by user ID)
                  </p>
                  <Input
                    id="target-percentage"
                    type="range"
                    min="1"
                    max="100"
                    value={targetPercentage}
                    onChange={(e) => setTargetPercentage(parseInt(e.target.value))}
                    data-testid="input-target-percentage"
                  />
                  <div className="flex gap-2">
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
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
              </>
            )}

            <Button 
              type="submit" 
              disabled={updateCampaignMutation.isPending}
              data-testid="button-save-segmentation"
            >
              {updateCampaignMutation.isPending ? 'Saving...' : 'Save Targeting Settings'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Engagement Settings */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Engagement Settings
          </CardTitle>
          <CardDescription>
            Configure polls, contests, and real-time updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveEngagement} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Demo Mode</Label>
                <p className="text-xs text-muted-foreground">Use mock data (for testing only)</p>
              </div>
              <Switch
                checked={demoMode}
                onCheckedChange={setDemoMode}
                data-testid="switch-demo-mode"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="poll-duration">Default Poll Duration (seconds)</Label>
                <Input
                  id="poll-duration"
                  type="number"
                  value={defaultPollDuration}
                  onChange={(e) => setDefaultPollDuration(parseInt(e.target.value) || 300)}
                  min={30}
                  max={3600}
                  data-testid="input-poll-duration"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contest-duration">Default Contest Duration (seconds)</Label>
                <Input
                  id="contest-duration"
                  type="number"
                  value={defaultContestDuration}
                  onChange={(e) => setDefaultContestDuration(parseInt(e.target.value) || 600)}
                  min={60}
                  max={7200}
                  data-testid="input-contest-duration"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-votes">Max Votes Per Poll</Label>
                <Input
                  id="max-votes"
                  type="number"
                  value={maxVotesPerPoll}
                  onChange={(e) => setMaxVotesPerPoll(parseInt(e.target.value) || 1)}
                  min={1}
                  max={10}
                  data-testid="input-max-votes"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-contests">Max Contests Per Match</Label>
                <Input
                  id="max-contests"
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
                <Label>Enable Real-Time Updates</Label>
                <p className="text-xs text-muted-foreground">Use WebSocket for live updates</p>
              </div>
              <Switch
                checked={enableRealTimeUpdates}
                onCheckedChange={setEnableRealTimeUpdates}
                data-testid="switch-realtime-updates"
              />
            </div>
            {!enableRealTimeUpdates && (
              <div className="space-y-2">
                <Label htmlFor="update-interval">Polling Interval (ms)</Label>
                <Input
                  id="update-interval"
                  type="number"
                  value={updateInterval}
                  onChange={(e) => setUpdateInterval(parseInt(e.target.value) || 1000)}
                  min={500}
                  max={10000}
                  data-testid="input-update-interval"
                />
              </div>
            )}
            <Button 
              type="submit" 
              disabled={saveEngagementConfigMutation.isPending}
              data-testid="button-save-engagement"
            >
              {saveEngagementConfigMutation.isPending ? 'Saving...' : 'Save Engagement Settings'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* UI Theme */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            UI Theme
          </CardTitle>
          <CardDescription>
            Customize colors for SDK components
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveUiTheme} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary-color">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary-color"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-12 h-10 p-1"
                    data-testid="input-primary-color"
                  />
                  <Input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#007AFF"
                    className="flex-1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary-color">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary-color"
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-12 h-10 p-1"
                    data-testid="input-secondary-color"
                  />
                  <Input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#5856D6"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="w-12 h-12 rounded-lg" style={{ backgroundColor: primaryColor }} />
              <div className="w-12 h-12 rounded-lg" style={{ backgroundColor: secondaryColor }} />
              <span className="text-sm text-muted-foreground self-center ml-2">Color preview</span>
            </div>
            <Button 
              type="submit" 
              disabled={saveUiConfigMutation.isPending}
              data-testid="button-save-ui-theme"
            >
              {saveUiConfigMutation.isPending ? 'Saving...' : 'Save UI Theme'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ToggleRight className="w-5 h-5" />
            Feature Flags
          </CardTitle>
          <CardDescription>
            Enable or disable SDK features for this campaign
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveFeatureFlags} className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Live Streaming</Label>
                  <p className="text-xs text-muted-foreground">Enable video live streaming features</p>
                </div>
                <Switch
                  checked={enableLiveStreaming}
                  onCheckedChange={setEnableLiveStreaming}
                  data-testid="switch-live-streaming"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Product Catalog</Label>
                  <p className="text-xs text-muted-foreground">Enable product browsing and shopping</p>
                </div>
                <Switch
                  checked={enableProductCatalog}
                  onCheckedChange={setEnableProductCatalog}
                  data-testid="switch-product-catalog"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Engagement</Label>
                  <p className="text-xs text-muted-foreground">Enable polls, contests, and interactions</p>
                </div>
                <Switch
                  checked={enableEngagement}
                  onCheckedChange={setEnableEngagement}
                  data-testid="switch-engagement"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Polls</Label>
                  <p className="text-xs text-muted-foreground">Allow users to vote in polls</p>
                </div>
                <Switch
                  checked={enablePolls}
                  onCheckedChange={setEnablePolls}
                  data-testid="switch-polls"
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Contests</Label>
                  <p className="text-xs text-muted-foreground">Allow users to participate in contests</p>
                </div>
                <Switch
                  checked={enableContests}
                  onCheckedChange={setEnableContests}
                  data-testid="switch-contests"
                />
              </div>
            </div>
            <Button 
              type="submit" 
              disabled={saveFeatureFlagsMutation.isPending}
              data-testid="button-save-feature-flags"
            >
              {saveFeatureFlagsMutation.isPending ? 'Saving...' : 'Save Feature Flags'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-0 border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently delete this campaign and all its data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                data-testid="button-delete-campaign"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Campaign
              </Button>
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
        </CardContent>
      </Card>
    </div>
  );
}
