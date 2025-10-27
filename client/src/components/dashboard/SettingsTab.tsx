import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Settings, Trash2, Upload } from "lucide-react";
import { Campaign } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ImageUploadWithPreview } from "@/components/ImageUploadWithPreview";
import { useLocation } from "wouter";

interface SettingsTabProps {
  campaignId: number;
  campaign: Campaign;
}

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
  const [logo, setLogo] = useState(campaign.logo || '');

  const updateCampaignMutation = useMutation({
    mutationFn: async (data: Partial<Campaign>) => {
      return await apiRequest('PUT', `/api/campaigns/${campaignId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId] });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
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
    const updates: { startDate: Date | null; endDate: Date | null } = {
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    };
    
    updateCampaignMutation.mutate(updates);
  };

  const handleSaveLogo = () => {
    updateCampaignMutation.mutate({ logo });
  };

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
