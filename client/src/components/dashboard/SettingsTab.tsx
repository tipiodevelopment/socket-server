import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { Settings, Trash2, Upload, X } from "lucide-react";
import { Campaign, UpdateCampaign } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ImageUploadWithPreview } from "@/components/ImageUploadWithPreview";
import { useLocation } from "wouter";

interface SettingsTabProps {
  campaignId: number;
  campaign: Campaign;
}

const COUNTRY_OPTIONS = [
  { code: 'US', name: 'United States' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CO', name: 'Colombia' },
  { code: 'BR', name: 'Brazil' },
  { code: 'ES', name: 'Spain' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'SG', name: 'Singapore' },
  { code: 'IN', name: 'India' },
  { code: 'KR', name: 'South Korea' },
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
