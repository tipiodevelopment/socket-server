import { Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { Campaign, Broadcast, User } from '@shared/schema';
import { Plus, Radio, Trash2, Clock, Calendar, ArrowLeft, Filter, User as UserIcon, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';

const USER_SESSION_KEY = "reachu_simulated_user_id";

function getStatusBadge(status: string) {
  switch (status) {
    case 'live':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400" data-testid="badge-status-live">Live</span>;
    case 'ended':
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-400" data-testid="badge-status-ended">Ended</span>;
    case 'upcoming':
    default:
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400" data-testid="badge-status-upcoming">Upcoming</span>;
  }
}

export default function BroadcastsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    broadcastName: '',
    campaignId: '',
    startTime: '',
    endTime: '',
    metadata: '',
  });

  useEffect(() => {
    const storedUserId = localStorage.getItem(USER_SESSION_KEY);
    if (storedUserId) {
      fetch('/api/users/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reachuUserId: storedUserId })
      })
        .then(res => res.json())
        .then(user => {
          setCurrentUserId(user.id);
          setCurrentUserData(user);
        })
        .catch(() => {
          localStorage.removeItem(USER_SESSION_KEY);
        });
    }
  }, []);

  const { data: broadcasts = [], isLoading } = useQuery<Broadcast[]>({
    queryKey: ['/api/broadcasts', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/broadcasts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch broadcasts');
      return res.json();
    },
    enabled: !!currentUserId,
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns', currentUserId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?userId=${currentUserId}`);
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      return res.json();
    },
    enabled: !!currentUserId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return await apiRequest('POST', '/api/broadcasts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
      toast({ title: 'Broadcast Created', description: 'The broadcast has been created successfully.' });
      setCreateOpen(false);
      setFormData({ broadcastName: '', campaignId: '', startTime: '', endTime: '', metadata: '' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create broadcast.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (broadcastId: string) => {
      return await apiRequest('DELETE', `/api/broadcasts/${broadcastId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts'] });
      toast({ title: 'Broadcast Deleted', description: 'The broadcast has been deleted successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete broadcast.', variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    if (!formData.broadcastName.trim()) {
      toast({ title: 'Validation Error', description: 'Broadcast name is required.', variant: 'destructive' });
      return;
    }
    let metadata = undefined;
    if (formData.metadata.trim()) {
      try {
        metadata = JSON.parse(formData.metadata);
      } catch {
        toast({ title: 'Validation Error', description: 'Metadata must be valid JSON.', variant: 'destructive' });
        return;
      }
    }
    createMutation.mutate({
      broadcastName: formData.broadcastName,
      campaignId: formData.campaignId ? parseInt(formData.campaignId) : undefined,
      startTime: formData.startTime || undefined,
      endTime: formData.endTime || undefined,
      metadata,
      createdBy: currentUserId,
    });
  };

  const handleLogout = () => {
    localStorage.removeItem(USER_SESSION_KEY);
    setCurrentUserId(null);
    setCurrentUserData(null);
    toast({ title: 'Logged Out', description: 'You have been logged out successfully.' });
    setLocation('/user-session');
  };

  const getCampaignName = (campaignId: number | null) => {
    if (!campaignId) return null;
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign?.name || `Campaign #${campaignId}`;
  };

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'live', label: 'Live' },
    { value: 'ended', label: 'Ended' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-lg flex items-center justify-center">
                <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-foreground">Broadcast Manager</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Manage your live broadcasts</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/campaigns">
                <Button variant="ghost" size="sm" data-testid="link-campaigns" className="text-xs sm:text-sm gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Campaigns
                </Button>
              </Link>
              <Link href="/client-apps">
                <Button variant="ghost" size="sm" data-testid="link-client-apps" className="text-xs sm:text-sm">
                  Client Apps
                </Button>
              </Link>
              {currentUserId && (
                <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-logout" className="text-xs sm:text-sm gap-1.5">
                  <LogOut className="w-3.5 h-3.5" />
                  Logout
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">My Broadcasts</h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Manage live broadcasts and engagement
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-broadcast" className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                New Broadcast
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create Broadcast</DialogTitle>
                <DialogDescription>Create a new live broadcast for your campaign.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="broadcastName">Broadcast Name *</Label>
                  <Input
                    id="broadcastName"
                    data-testid="input-broadcast-name"
                    value={formData.broadcastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, broadcastName: e.target.value }))}
                    placeholder="Enter broadcast name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="campaignId">Campaign</Label>
                  <Select
                    value={formData.campaignId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, campaignId: value }))}
                  >
                    <SelectTrigger data-testid="select-campaign">
                      <SelectValue placeholder="Select a campaign (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={String(campaign.id)} data-testid={`option-campaign-${campaign.id}`}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="startTime">Start Time</Label>
                    <Input
                      id="startTime"
                      type="datetime-local"
                      data-testid="input-start-time"
                      value={formData.startTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="endTime">End Time</Label>
                    <Input
                      id="endTime"
                      type="datetime-local"
                      data-testid="input-end-time"
                      value={formData.endTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="metadata">Metadata (JSON)</Label>
                  <Textarea
                    id="metadata"
                    data-testid="input-metadata"
                    value={formData.metadata}
                    onChange={(e) => setFormData(prev => ({ ...prev, metadata: e.target.value }))}
                    placeholder='{"key": "value"}'
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)} data-testid="button-cancel-create">
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-submit-broadcast">
                  {createMutation.isPending ? 'Creating...' : 'Create Broadcast'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {currentUserId && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                variant={statusFilter === option.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(option.value)}
                data-testid={`filter-${option.value}`}
                className="gap-1.5"
              >
                {option.value === 'all' && <Filter className="w-3.5 h-3.5" />}
                {option.label}
              </Button>
            ))}
          </div>
        )}

        {!currentUserId ? (
          <Card className="border-0">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <UserIcon className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">User Session Required</h3>
              <p className="text-muted-foreground mb-4 text-center max-w-md">
                Please select a user to view broadcasts.
              </p>
              <Link href="/user-session">
                <Button data-testid="button-goto-user-session">
                  <UserIcon className="w-4 h-4 mr-2" />
                  Select User Session
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading broadcasts...</p>
          </div>
        ) : broadcasts.length === 0 ? (
          <Card className="border-0">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Radio className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No broadcasts yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first broadcast
              </p>
              <Button onClick={() => setCreateOpen(true)} data-testid="button-create-first-broadcast">
                <Plus className="w-4 h-4 mr-2" />
                Create Broadcast
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {broadcasts.map((broadcast) => (
              <Card
                key={broadcast.broadcastId}
                className="border border-white/10 hover:border-white/20 transition-all"
                data-testid={`card-broadcast-${broadcast.broadcastId}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">{broadcast.broadcastName}</CardTitle>
                        {getStatusBadge(broadcast.status)}
                      </div>
                      <CardDescription className="text-xs font-mono">
                        ID: {broadcast.broadcastId}
                      </CardDescription>
                      {broadcast.campaignId && (
                        <CardDescription className="mt-1">
                          Campaign: {getCampaignName(broadcast.campaignId)}
                        </CardDescription>
                      )}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          data-testid={`button-delete-${broadcast.broadcastId}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Broadcast?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{broadcast.broadcastName}"? This action cannot be undone. All polls and contests will be permanently deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(broadcast.broadcastId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            data-testid={`button-confirm-delete-${broadcast.broadcastId}`}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground mb-4">
                    {broadcast.startTime && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        <span>Start: {new Date(broadcast.startTime).toLocaleString()}</span>
                      </div>
                    )}
                    {broadcast.endTime && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>End: {new Date(broadcast.endTime).toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  <Link href={`/broadcasts/${broadcast.broadcastId}`}>
                    <Button variant="default" size="sm" className="w-full" data-testid={`button-manage-${broadcast.broadcastId}`}>
                      <Radio className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      Manage Broadcast
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
