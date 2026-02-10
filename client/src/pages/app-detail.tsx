import { useParams, Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useUser } from '@/contexts/UserContext';
import { AppLayout } from '@/components/AppLayout';
import type { ClientApp, Campaign, Channel } from '@shared/schema';
import {
  Plus,
  Key,
  Copy,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  Settings,
  Calendar,
  Rocket,
  ChevronRight,
  Radio,
  Megaphone,
} from 'lucide-react';
import { useState } from 'react';

export default function AppDetailPage() {
  const { appId } = useParams();
  const appIdNum = appId ? parseInt(appId) : null;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { userId } = useUser();
  const [visibleApiKey, setVisibleApiKey] = useState(false);
  const [editingReachuKey, setEditingReachuKey] = useState('');
  const [reachuKeyInitialized, setReachuKeyInitialized] = useState(false);
  const [createCampaignOpen, setCreateCampaignOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDescription, setNewCampaignDescription] = useState('');

  const { data: app, isLoading: appLoading } = useQuery<ClientApp>({
    queryKey: ['/api/client-apps', appIdNum, userId],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps/${appIdNum}?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch app');
      return res.json();
    },
    enabled: !!appIdNum && !!userId
  });

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['/api/channels', userId],
    queryFn: async () => {
      const res = await fetch(`/api/channels?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch channels');
      return res.json();
    },
    enabled: !!userId
  });

  const appChannelIds = new Set(channels.filter(ch => ch.clientAppId === appIdNum).map(ch => ch.id));

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns', userId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      return res.json();
    },
    enabled: !!userId
  });

  const appCampaigns = campaigns.filter(c => {
    if (!app) return false;
    return c.channelId ? appChannelIds.has(c.channelId) : false;
  });

  if (!reachuKeyInitialized && app) {
    setEditingReachuKey(app.reachuApiKey || '');
    setReachuKeyInitialized(true);
  }

  const regenerateKeyMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/client-apps/${appIdNum}/regenerate-key`, { userId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', appIdNum] });
      toast({ title: 'API Key Regenerated', description: 'The new API key is now active.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to regenerate API key', variant: 'destructive' });
    }
  });

  const updateReachuKeyMutation = useMutation({
    mutationFn: async (reachuApiKey: string) => {
      const response = await apiRequest('PATCH', `/api/client-apps/${appIdNum}`, { userId, reachuApiKey });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', appIdNum] });
      toast({ title: 'Reachu API Key Updated', description: 'The key has been saved.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update key', variant: 'destructive' });
    }
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; userId: number }) => {
      const response = await apiRequest('POST', '/api/campaigns', data);
      return response.json();
    },
    onSuccess: (newCampaign) => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', userId] });
      setCreateCampaignOpen(false);
      setNewCampaignName('');
      setNewCampaignDescription('');
      toast({ title: 'Campaign Created', description: 'Your new campaign is ready.' });
      setLocation(`/apps/${appIdNum}/campaigns/${newCampaign.id}`);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create campaign', variant: 'destructive' });
    }
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', userId] });
      toast({ title: 'Campaign Deleted', description: 'The campaign has been deleted.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete campaign.', variant: 'destructive' });
    },
  });

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copied!', description: `${label} copied to clipboard` });
    } catch {
      toast({ title: 'Error', description: 'Failed to copy', variant: 'destructive' });
    }
  };

  if (appLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: 'My Apps', href: '/apps' }, { label: 'Loading...' }]}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading app...</p>
        </div>
      </AppLayout>
    );
  }

  if (!app) {
    return (
      <AppLayout breadcrumbs={[{ label: 'My Apps', href: '/apps' }, { label: 'Not Found' }]}>
        <div className="text-center py-12">
          <p className="text-foreground">App not found</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: 'My Apps', href: '/apps' },
        { label: app.name },
      ]}
      title={app.name}
      subtitle={app.bundleId}
      actions={
        <Dialog open={createCampaignOpen} onOpenChange={setCreateCampaignOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-campaign" className="gap-2">
              <Plus className="w-4 h-4" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
              <DialogDescription>Create a new campaign for {app.name}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="e.g. Summer Sale 2026"
                  data-testid="input-campaign-name"
                />
              </div>
              <div>
                <Label htmlFor="campaign-desc">Description (optional)</Label>
                <Input
                  id="campaign-desc"
                  value={newCampaignDescription}
                  onChange={(e) => setNewCampaignDescription(e.target.value)}
                  placeholder="Brief description"
                  data-testid="input-campaign-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  if (!newCampaignName.trim() || !userId) return;
                  createCampaignMutation.mutate({
                    name: newCampaignName,
                    description: newCampaignDescription,
                    userId,
                  });
                }}
                disabled={createCampaignMutation.isPending || !newCampaignName.trim()}
                data-testid="button-submit-campaign"
              >
                {createCampaignMutation.isPending ? 'Creating...' : 'Create Campaign'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <Tabs defaultValue="campaigns" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="campaigns" data-testid="tab-campaigns">
            <Megaphone className="w-4 h-4 mr-2" />
            Campaigns
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="w-4 h-4 mr-2" />
            App Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          {campaignsLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading campaigns...</p>
            </div>
          ) : appCampaigns.length === 0 ? (
            <Card className="border-0">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Megaphone className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
                <p className="text-muted-foreground mb-4 text-center max-w-md">
                  Create your first campaign to start broadcasting events
                </p>
                <Button onClick={() => setCreateCampaignOpen(true)} data-testid="button-create-first-campaign">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Campaign
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {appCampaigns.map((campaign) => (
                <Card
                  key={campaign.id}
                  className="border border-white/10 hover:border-white/20 transition-all group"
                  data-testid={`card-campaign-${campaign.id}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {campaign.logo && (
                          <div className="mb-2">
                            <img
                              src={campaign.logo}
                              alt={campaign.name}
                              className="w-10 h-10 object-contain rounded"
                            />
                          </div>
                        )}
                        <CardTitle className="text-lg mb-1">{campaign.name}</CardTitle>
                        {campaign.description && (
                          <CardDescription className="line-clamp-2">{campaign.description}</CardDescription>
                        )}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            data-testid={`button-delete-campaign-${campaign.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{campaign.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteCampaignMutation.mutate(campaign.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(campaign.createdAt).toLocaleDateString('en-US')}</span>
                      </div>
                    </div>
                    <Link href={`/apps/${appIdNum}/campaigns/${campaign.id}`}>
                      <Button variant="default" size="sm" className="w-full gap-2" data-testid={`button-manage-campaign-${campaign.id}`}>
                        <Settings className="w-4 h-4" />
                        Manage Campaign
                        <ChevronRight className="w-4 h-4 ml-auto" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings">
          <div className="space-y-6 max-w-2xl">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">API Key</CardTitle>
                <CardDescription>Use this key in your SDK to authenticate requests</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted/50 px-3 py-2 rounded text-sm font-mono overflow-hidden" data-testid="text-api-key">
                    {visibleApiKey ? app.apiKey : '•'.repeat(Math.min(app.apiKey.length, 40))}
                  </code>
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => setVisibleApiKey(!visibleApiKey)} data-testid="button-toggle-key">
                    {visibleApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(app.apiKey, 'API Key')} data-testid="button-copy-key">
                    <Copy className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon" className="shrink-0" data-testid="button-regenerate-key">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Regenerate API Key?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will invalidate the current key. Any SDK using the old key will stop working.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => regenerateKeyMutation.mutate()}>
                          Regenerate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="bg-muted/30 rounded-lg p-3">
                  <pre className="text-xs overflow-x-auto">
{`// Swift SDK
ReachuSDK.configure(
    apiKey: "${app.apiKey}",
    environment: .production
)`}
                  </pre>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Reachu Integration</CardTitle>
                <CardDescription>External API key for Reachu integration (optional)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Enter Reachu API key..."
                    value={editingReachuKey}
                    onChange={(e) => setEditingReachuKey(e.target.value)}
                    className="flex-1 font-mono text-sm"
                    data-testid="input-reachu-key"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={updateReachuKeyMutation.isPending}
                    onClick={() => updateReachuKeyMutation.mutate(editingReachuKey)}
                    data-testid="button-save-reachu-key"
                  >
                    {updateReachuKeyMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">App Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bundle ID</span>
                  <span className="font-mono">{app.bundleId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(app.createdAt).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
