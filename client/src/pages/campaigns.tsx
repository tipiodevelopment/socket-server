import { Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useUser } from '@/contexts/UserContext';
import { AppLayout } from '@/components/AppLayout';
import type { Campaign, ClientApp, Channel } from '@shared/schema';
import { Plus, Megaphone, Trash2, ChevronRight, Filter, Smartphone } from 'lucide-react';

export default function CampaignsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { userId } = useUser();
  const [createOpen, setCreateOpen] = useState(false);
  const [appFilter, setAppFilter] = useState<string>('all');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns', userId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?userId=${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: clientApps = [] } = useQuery<ClientApp[]>({
    queryKey: ['/api/client-apps', userId],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps?userId=${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: channels = [] } = useQuery<Channel[]>({
    queryKey: ['/api/channels', userId],
    queryFn: async () => {
      const res = await fetch(`/api/channels?userId=${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
  });

  const channelToAppMap = new Map<number, number>();
  channels.forEach(ch => { if (ch.clientAppId) channelToAppMap.set(ch.id, ch.clientAppId); });

  const getAppForCampaign = (campaign: Campaign): ClientApp | undefined => {
    if (!campaign.channelId) return undefined;
    const appId = channelToAppMap.get(campaign.channelId);
    if (!appId) return undefined;
    return clientApps.find(a => a.id === appId);
  };

  const filteredCampaigns = appFilter === 'all'
    ? campaigns
    : appFilter === 'unassigned'
      ? campaigns.filter(c => !c.channelId || !channelToAppMap.has(c.channelId))
      : campaigns.filter(c => {
          if (!c.channelId) return false;
          const appId = channelToAppMap.get(c.channelId);
          return appId === parseInt(appFilter);
        });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; userId: number }) => {
      const response = await apiRequest('POST', '/api/campaigns', data);
      return response.json();
    },
    onSuccess: (newCampaign) => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', userId] });
      setCreateOpen(false);
      setNewName('');
      setNewDescription('');
      toast({ title: 'Campaign Created' });
      setLocation(`/campaigns/${newCampaign.id}`);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create campaign', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest('DELETE', `/api/campaigns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', userId] });
      toast({ title: 'Campaign Deleted' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete campaign', variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    if (!newName.trim() || !userId) return;
    createMutation.mutate({ name: newName, description: newDescription, userId });
  };

  return (
    <AppLayout
      breadcrumbs={[{ label: 'Campaigns' }]}
      title="Campaigns"
      subtitle={`${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} total`}
      actions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-campaign" className="gap-2">
              <Plus className="w-4 h-4" /> New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
              <DialogDescription>Create a new campaign to manage broadcasts and events.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Campaign Name *</Label>
                <Input
                  data-testid="input-campaign-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Summer Sale 2026"
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea
                  data-testid="input-campaign-description"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending || !newName.trim()} data-testid="button-submit-campaign">
                {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {clientApps.length > 1 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter by app:</span>
          <div className="flex gap-1.5 flex-wrap">
            <Button
              size="sm"
              variant={appFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setAppFilter('all')}
              data-testid="filter-all-apps"
            >
              All
            </Button>
            {clientApps.map((app) => (
              <Button
                key={app.id}
                size="sm"
                variant={appFilter === String(app.id) ? 'default' : 'outline'}
                onClick={() => setAppFilter(String(app.id))}
                data-testid={`filter-app-${app.id}`}
              >
                {app.name}
              </Button>
            ))}
            <Button
              size="sm"
              variant={appFilter === 'unassigned' ? 'default' : 'outline'}
              onClick={() => setAppFilter('unassigned')}
              data-testid="filter-unassigned"
            >
              Unassigned
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading campaigns...</p>
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <Card className="border-0">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Megaphone className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No campaigns found</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              {appFilter !== 'all' ? 'No campaigns match this filter.' : 'Create your first campaign to get started.'}
            </p>
            {appFilter === 'all' && (
              <Button onClick={() => setCreateOpen(true)} data-testid="button-create-first-campaign">
                <Plus className="w-4 h-4 mr-2" /> Create Campaign
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCampaigns.map((campaign) => {
            const app = getAppForCampaign(campaign);
            return (
              <Card
                key={campaign.id}
                className="border border-white/10 hover:border-white/20 transition-all group"
                data-testid={`card-campaign-${campaign.id}`}
              >
                <Link href={`/campaigns/${campaign.id}`}>
                  <CardHeader className="cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${campaign.isPaused ? 'bg-yellow-400' : 'bg-green-400'}`} />
                          <CardTitle className="text-lg truncate">{campaign.name}</CardTitle>
                        </div>
                        {campaign.description && (
                          <CardDescription className="text-xs truncate">{campaign.description}</CardDescription>
                        )}
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </div>
                  </CardHeader>
                </Link>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {app ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-white/5 px-2 py-1 rounded-md">
                          <Smartphone className="w-3 h-3" />
                          {app.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No app</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${campaign.isPaused ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
                        {campaign.isPaused ? 'Paused' : 'Active'}
                      </span>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`button-delete-campaign-${campaign.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
                            onClick={() => deleteMutation.mutate(campaign.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
