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

  const createMutation = useMutation<Campaign, Error, any>({
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
    
    const campaignData: any = {
      ...formData,
      ...(enableReachu && {
        reachuChannelId: selectedChannelId,
        reachuApiKey: reachuApiKey
      }),
      ...(enableTipio && {
        tipioLiveshowId: tipioLivestream.liveStreamId,
        tipioLivestreamData: tipioLivestream
      })
    };
    
    createMutation.mutate(campaignData);
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

              {/* Reachu Integration Section */}
              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShoppingBag className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="text-lg font-semibold">Reachu.io Integration</h3>
                      <p className="text-sm text-muted-foreground">Connect to your e-commerce channel</p>
                    </div>
                  </div>
                  <Switch
                    checked={enableReachu}
                    onCheckedChange={setEnableReachu}
                    data-testid="switch-reachu"
                  />
                </div>

                {enableReachu && (
                  <div className="space-y-4 pl-8">
                    <div>
                      <Label htmlFor="reachu-api-key">API Key *</Label>
                      <Input
                        id="reachu-api-key"
                        type="password"
                        value={reachuApiKey}
                        onChange={(e) => setReachuApiKey(e.target.value)}
                        placeholder="Enter your Reachu API key"
                        className="mt-2"
                        data-testid="input-reachu-api-key"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Your API key to authenticate with Reachu
                      </p>
                    </div>

                    {reachuApiKey && (
                      <div>
                        <Label htmlFor="reachu-channel">Select Channel *</Label>
                        {loadingChannels ? (
                          <div className="text-sm text-muted-foreground mt-2">Loading channels...</div>
                        ) : (
                          <>
                            <Select
                              value={selectedChannelId}
                              onValueChange={setSelectedChannelId}
                            >
                              <SelectTrigger className="mt-2" data-testid="select-reachu-channel">
                                <SelectValue placeholder="Choose a channel" />
                              </SelectTrigger>
                              <SelectContent>
                                {reachuChannels?.map((channel) => (
                                  <SelectItem 
                                    key={channel.id} 
                                    value={channel.id}
                                    data-testid={`channel-option-${channel.id}`}
                                  >
                                    {channel.name} ({channel.productCount} products)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-sm text-muted-foreground mt-1">
                              Choose which product channel to connect
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tipio Livestream Section */}
              <div className="space-y-4 pt-6 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Radio className="w-5 h-5 text-primary" />
                    <div>
                      <h3 className="text-lg font-semibold">Tipio Livestream</h3>
                      <p className="text-sm text-muted-foreground">Configure live streaming event</p>
                    </div>
                  </div>
                  <Switch
                    checked={enableTipio}
                    onCheckedChange={setEnableTipio}
                    data-testid="switch-tipio"
                  />
                </div>

                {enableTipio && (
                  <div className="space-y-4 pl-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="tipio-title">Title *</Label>
                        <Input
                          id="tipio-title"
                          value={tipioLivestream.title}
                          onChange={(e) => setTipioLivestream({ ...tipioLivestream, title: e.target.value })}
                          placeholder="Livestream title"
                          className="mt-2"
                          data-testid="input-tipio-title"
                        />
                      </div>

                      <div>
                        <Label htmlFor="tipio-live-stream-id">Live Stream ID (Vimeo) *</Label>
                        <Input
                          id="tipio-live-stream-id"
                          value={tipioLivestream.liveStreamId}
                          onChange={(e) => setTipioLivestream({ ...tipioLivestream, liveStreamId: e.target.value })}
                          placeholder="e.g. 5404404"
                          className="mt-2"
                          data-testid="input-tipio-stream-id"
                        />
                      </div>

                      <div>
                        <Label htmlFor="tipio-video-id">Video ID *</Label>
                        <Input
                          id="tipio-video-id"
                          value={tipioLivestream.videoId}
                          onChange={(e) => setTipioLivestream({ ...tipioLivestream, videoId: e.target.value })}
                          placeholder="e.g. 1091391964"
                          className="mt-2"
                          data-testid="input-tipio-video-id"
                        />
                      </div>

                      <div>
                        <Label htmlFor="tipio-player">Player URL *</Label>
                        <Input
                          id="tipio-player"
                          value={tipioLivestream.player}
                          onChange={(e) => setTipioLivestream({ ...tipioLivestream, player: e.target.value })}
                          placeholder="https://vimeo.com/..."
                          className="mt-2"
                          data-testid="input-tipio-player"
                        />
                      </div>

                      <div>
                        <Label htmlFor="tipio-thumbnail">Thumbnail URL *</Label>
                        <Input
                          id="tipio-thumbnail"
                          value={tipioLivestream.thumbnail}
                          onChange={(e) => setTipioLivestream({ ...tipioLivestream, thumbnail: e.target.value })}
                          placeholder="https://..."
                          className="mt-2"
                          data-testid="input-tipio-thumbnail"
                        />
                      </div>

                      <div>
                        <Label htmlFor="tipio-hls">HLS URL (optional)</Label>
                        <Input
                          id="tipio-hls"
                          value={tipioLivestream.hls || ''}
                          onChange={(e) => setTipioLivestream({ ...tipioLivestream, hls: e.target.value || null })}
                          placeholder="https://live-ak2.vimeocdn.com/..."
                          className="mt-2"
                          data-testid="input-tipio-hls"
                        />
                      </div>

                      <div>
                        <Label htmlFor="tipio-start-date">Start Date *</Label>
                        <Input
                          id="tipio-start-date"
                          type="datetime-local"
                          value={tipioLivestream.date}
                          onChange={(e) => setTipioLivestream({ ...tipioLivestream, date: e.target.value })}
                          className="mt-2"
                          data-testid="input-tipio-start-date"
                        />
                      </div>

                      <div>
                        <Label htmlFor="tipio-end-date">End Date *</Label>
                        <Input
                          id="tipio-end-date"
                          type="datetime-local"
                          value={tipioLivestream.end_date}
                          onChange={(e) => setTipioLivestream({ ...tipioLivestream, end_date: e.target.value })}
                          className="mt-2"
                          data-testid="input-tipio-end-date"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={tipioLivestream.broadcasting || false}
                        onCheckedChange={(checked) => setTipioLivestream({ ...tipioLivestream, broadcasting: checked })}
                        data-testid="switch-tipio-broadcasting"
                      />
                      <Label>Broadcasting Active</Label>
                    </div>
                  </div>
                )}
              </div>

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
