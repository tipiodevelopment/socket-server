import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Campaign, ReachuChannel, TipioLivestream } from '@shared/schema';
import { ArrowLeft, Rocket, ShoppingBag, Radio } from 'lucide-react';

export default function NewCampaignPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    description: ''
  });

  // Integration states
  const [enableReachu, setEnableReachu] = useState(false);
  const [enableTipio, setEnableTipio] = useState(false);
  
  // Reachu states
  const [reachuApiKey, setReachuApiKey] = useState('');
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  
  // Tipio livestream states
  const [tipioLivestream, setTipioLivestream] = useState<Partial<TipioLivestream>>({
    title: '',
    liveStreamId: '',
    hls: null,
    player: '',
    thumbnail: '',
    broadcasting: false,
    date: '',
    end_date: '',
    streamDone: null,
    videoId: ''
  });

  // Fetch Reachu channels when enabled
  const { data: reachuChannels, isLoading: loadingChannels } = useQuery<ReachuChannel[]>({
    queryKey: ['/api/reachu/channels'],
    enabled: enableReachu
  });

  const createMutation = useMutation<Campaign, Error, typeof formData>({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', '/api/campaigns', data);
      return response.json();
    },
    onSuccess: (newCampaign) => {
      toast({
        title: "Campaign Created",
        description: "Your new campaign is ready to use",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      setLocation(`/campaign/${newCampaign.id}/admin`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Could not create campaign",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-card/60 backdrop-blur-xl border-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Rocket className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Campaign Manager</h1>
                <p className="text-sm text-muted-foreground">Create a new event campaign</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Link href="/">
          <Button variant="ghost" className="mb-6 gap-2" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
            Back to campaigns
          </Button>
        </Link>

        {/* Form Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create New Campaign</CardTitle>
            <CardDescription>
              Fill in the information for your new event campaign. You can add more configuration options after creation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                
                <div>
                  <Label htmlFor="name">Campaign Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Champions League 2024"
                    required
                    data-testid="input-campaign-name"
                    className="border-0 mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose a descriptive name for your campaign
                  </p>
                </div>

                <div>
                  <Label htmlFor="logo">Logo URL</Label>
                  <Input
                    id="logo"
                    value={formData.logo}
                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    data-testid="input-campaign-logo"
                    className="border-0 mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Optional: Add a logo to display on all events
                  </p>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the campaign"
                    rows={4}
                    data-testid="input-campaign-description"
                    className="border-0 mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Provide a brief description of what this campaign is about
                  </p>
                </div>
              </div>

              {/* Future sections can be added here */}
              {/* 
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Campaign Settings</h3>
                // More fields will be added here
              </div>
              */}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <Link href="/">
                  <Button 
                    type="button" 
                    variant="outline" 
                    data-testid="button-cancel"
                    className="border-0"
                  >
                    Cancel
                  </Button>
                </Link>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending}
                  data-testid="button-submit-campaign"
                  className="gap-2"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
