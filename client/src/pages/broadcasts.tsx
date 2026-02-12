import { Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import type { Broadcast, Campaign } from '@shared/schema';
import { Plus, Radio, Trash2, ChevronRight, Clock, Calendar, Filter, Megaphone } from 'lucide-react';

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    live: 'bg-green-500/20 text-green-400',
    upcoming: 'bg-yellow-500/20 text-yellow-400',
    ended: 'bg-gray-500/20 text-gray-400',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.ended}`}>
      {status}
    </span>
  );
}

export default function BroadcastsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { userId } = useUser();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [campaignFilter, setCampaignFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    broadcastName: '',
    campaignId: '',
    startTime: '',
    endTime: '',
    metadata: '',
  });

  const { data: broadcasts = [], isLoading } = useQuery<Broadcast[]>({
    queryKey: ['/api/broadcasts', 'all', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/broadcasts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns', userId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?userId=${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
  });

  const campaignMap = new Map<number, Campaign>();
  campaigns.forEach(c => campaignMap.set(c.id, c));

  const filteredBroadcasts = campaignFilter === 'all'
    ? broadcasts
    : broadcasts.filter(b => b.campaignId === parseInt(campaignFilter));

  const campaignsWithBroadcasts = Array.from(new Set(broadcasts.map(b => b.campaignId).filter((id): id is number => id !== null)));

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return await apiRequest('POST', '/api/broadcasts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
      toast({ title: 'Broadcast Created' });
      setCreateOpen(false);
      setFormData({ broadcastName: '', campaignId: '', startTime: '', endTime: '', metadata: '' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create broadcast', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (broadcastId: string) => apiRequest('DELETE', `/api/broadcasts/${broadcastId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
      toast({ title: 'Broadcast Deleted' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete broadcast', variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    if (!formData.broadcastName.trim() || !formData.campaignId) {
      toast({ title: 'Required', description: 'Name and campaign are required.', variant: 'destructive' });
      return;
    }
    let metadata = undefined;
    if (formData.metadata.trim()) {
      try { metadata = JSON.parse(formData.metadata); }
      catch { toast({ title: 'Error', description: 'Metadata must be valid JSON.', variant: 'destructive' }); return; }
    }
    createMutation.mutate({
      broadcastName: formData.broadcastName,
      campaignId: parseInt(formData.campaignId),
      startTime: formData.startTime || undefined,
      endTime: formData.endTime || undefined,
      metadata,
      createdBy: userId,
    });
  };

  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'live', label: 'Live' },
    { value: 'ended', label: 'Ended' },
  ];

  return (
    <AppLayout
      breadcrumbs={[{ label: 'Broadcasts' }]}
      title="Broadcasts"
      subtitle={`${broadcasts.length} broadcast${broadcasts.length !== 1 ? 's' : ''} total`}
      actions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-broadcast" className="gap-2" disabled={campaigns.length === 0}>
              <Plus className="w-4 h-4" /> New Broadcast
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Broadcast</DialogTitle>
              <DialogDescription>Create a new broadcast and assign it to a campaign.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Broadcast Name *</Label>
                <Input
                  data-testid="input-broadcast-name"
                  value={formData.broadcastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, broadcastName: e.target.value }))}
                  placeholder="Enter broadcast name"
                />
              </div>
              <div className="grid gap-2">
                <Label>Campaign *</Label>
                <Select value={formData.campaignId} onValueChange={(v) => setFormData(prev => ({ ...prev, campaignId: v }))}>
                  <SelectTrigger data-testid="select-campaign">
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Start Time</Label>
                  <Input
                    type="datetime-local"
                    data-testid="input-start-time"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>End Time</Label>
                  <Input
                    type="datetime-local"
                    data-testid="input-end-time"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Metadata (JSON)</Label>
                <Textarea
                  data-testid="input-metadata"
                  value={formData.metadata}
                  onChange={(e) => setFormData(prev => ({ ...prev, metadata: e.target.value }))}
                  placeholder='{"key": "value"}'
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-submit-broadcast">
                {createMutation.isPending ? 'Creating...' : 'Create Broadcast'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Status:</span>
          {statusOptions.map((opt) => (
            <Button
              key={opt.value}
              size="sm"
              variant={statusFilter === opt.value ? 'default' : 'outline'}
              onClick={() => setStatusFilter(opt.value)}
              data-testid={`filter-status-${opt.value}`}
            >
              {opt.label}
            </Button>
          ))}
        </div>

        {campaignsWithBroadcasts.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Campaign:</span>
            <div className="flex gap-1.5 flex-wrap">
              <Button
                size="sm"
                variant={campaignFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setCampaignFilter('all')}
                data-testid="filter-campaign-all"
              >
                All
              </Button>
              {campaignsWithBroadcasts.map((cId) => {
                const c = campaignMap.get(cId);
                return (
                  <Button
                    key={cId}
                    size="sm"
                    variant={campaignFilter === String(cId) ? 'default' : 'outline'}
                    onClick={() => setCampaignFilter(String(cId))}
                    data-testid={`filter-campaign-${cId}`}
                  >
                    {c?.name || `Campaign #${cId}`}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading broadcasts...</p>
        </div>
      ) : filteredBroadcasts.length === 0 ? (
        <Card className="border-0">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Radio className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No broadcasts found</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              {statusFilter !== 'all' || campaignFilter !== 'all'
                ? 'No broadcasts match your filters.'
                : campaigns.length === 0
                  ? 'Create a campaign first, then add broadcasts to it.'
                  : 'Create your first broadcast to get started.'}
            </p>
            {campaigns.length > 0 && statusFilter === 'all' && campaignFilter === 'all' && (
              <Button onClick={() => setCreateOpen(true)} data-testid="button-create-first-broadcast">
                <Plus className="w-4 h-4 mr-2" /> Create Broadcast
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBroadcasts.map((broadcast) => {
            const campaign = broadcast.campaignId ? campaignMap.get(broadcast.campaignId) : undefined;
            return (
              <Card
                key={broadcast.broadcastId}
                className="border border-white/10 hover:border-white/20 transition-all group"
                data-testid={`card-broadcast-${broadcast.broadcastId}`}
              >
                <Link href={`/broadcasts/${broadcast.broadcastId}`}>
                  <CardHeader className="cursor-pointer">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg truncate">{broadcast.broadcastName}</CardTitle>
                          {getStatusBadge(broadcast.status)}
                        </div>
                        <CardDescription className="text-xs font-mono">
                          ID: {broadcast.broadcastId}
                        </CardDescription>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                    </div>
                  </CardHeader>
                </Link>
                <CardContent>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Megaphone className="w-3.5 h-3.5" />
                      <span className="text-xs">
                        {campaign ? campaign.name : `Campaign #${broadcast.campaignId}`}
                      </span>
                    </div>
                    {broadcast.startTime && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="text-xs">Start: {new Date(broadcast.startTime).toLocaleString()}</span>
                      </div>
                    )}
                    {broadcast.endTime && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span className="text-xs">End: {new Date(broadcast.endTime).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <Link href={`/broadcasts/${broadcast.broadcastId}`}>
                      <Button variant="default" size="sm" className="gap-1.5" data-testid={`button-manage-broadcast-${broadcast.broadcastId}`}>
                        <Radio className="w-3.5 h-3.5" />
                        Manage
                      </Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                          data-testid={`button-delete-broadcast-${broadcast.broadcastId}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Broadcast?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Delete "{broadcast.broadcastName}"? All polls and contests will be permanently deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(broadcast.broadcastId)}
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
