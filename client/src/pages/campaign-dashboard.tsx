import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Zap, Calendar, Settings as SettingsIcon, Activity, Radio } from "lucide-react";
import { Campaign, ClientApp } from "@shared/schema";
import { OverviewTab } from "@/components/dashboard/OverviewTab";
import { EventsTab } from "@/components/dashboard/EventsTab";
import { ScheduledTab } from "@/components/dashboard/ScheduledTab";
import { ComponentsTab } from "@/components/dashboard/ComponentsTab";
import { IntegrationsTab } from "@/components/dashboard/IntegrationsTab";
import { SettingsTab } from "@/components/dashboard/SettingsTab";
import { AppLayout } from "@/components/AppLayout";
import type { BreadcrumbItem } from "@/components/AppLayout";
import { useUser } from "@/contexts/UserContext";

export default function CampaignDashboard() {
  const params = useParams();
  const { userId } = useUser();
  const appId = params.appId ? parseInt(params.appId) : null;
  const campaignId = params.campaignId ? parseInt(params.campaignId) : (params.id ? parseInt(params.id) : null);

  const { data: campaign, isLoading } = useQuery<Campaign>({
    queryKey: ['/api/campaigns', campaignId],
    enabled: !!campaignId
  });

  const { data: app } = useQuery<ClientApp>({
    queryKey: ['/api/client-apps', appId, userId],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps/${appId}?userId=${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!appId && !!userId
  });

  const breadcrumbs: BreadcrumbItem[] = [
    { label: 'My Apps', href: '/apps' },
  ];
  if (app) {
    breadcrumbs.push({ label: app.name, href: `/apps/${appId}` });
  }
  if (campaign) {
    breadcrumbs.push({ label: campaign.name });
  } else {
    breadcrumbs.push({ label: 'Loading...' });
  }

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading campaign...</p>
        </div>
      </AppLayout>
    );
  }

  if (!campaign) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <div className="text-center py-12">
          <p className="text-foreground">Campaign not found</p>
        </div>
      </AppLayout>
    );
  }

  const backHref = appId ? `/apps/${appId}` : '/apps';

  return (
    <AppLayout
      breadcrumbs={breadcrumbs}
    >
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {campaign.logo && (
              <img
                src={campaign.logo}
                alt={campaign.name}
                className="w-16 h-16 object-contain mb-4 rounded-lg"
              />
            )}
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2" data-testid="text-campaign-name">
              {campaign.name}
            </h1>
            {campaign.description && (
              <p className="text-muted-foreground">{campaign.description}</p>
            )}
          </div>

          <div className="flex gap-2">
            <Link href={`/campaign/${campaign.name}/${campaign.id}`}>
              <Button variant="outline" size="sm" data-testid="button-view-live">
                <Activity className="w-4 h-4 mr-2" />
                View Live
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-7 mb-6">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="broadcasts" data-testid="tab-broadcasts">
            <Radio className="w-4 h-4 mr-2" />
            Broadcasts
          </TabsTrigger>
          <TabsTrigger value="events" data-testid="tab-events">
            <Zap className="w-4 h-4 mr-2" />
            Events
          </TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">
            <Calendar className="w-4 h-4 mr-2" />
            Scheduled
          </TabsTrigger>
          <TabsTrigger value="components" data-testid="tab-components">
            <Activity className="w-4 h-4 mr-2" />
            Components
          </TabsTrigger>
          <TabsTrigger value="integrations" data-testid="tab-integrations">
            Integrations
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <SettingsIcon className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab campaignId={campaignId!} campaign={campaign} />
        </TabsContent>

        <TabsContent value="broadcasts">
          <BroadcastsTab campaignId={campaignId!} appId={appId} />
        </TabsContent>

        <TabsContent value="events">
          <EventsTab campaignId={campaignId!} campaign={campaign} />
        </TabsContent>

        <TabsContent value="scheduled">
          <ScheduledTab campaignId={campaignId!} />
        </TabsContent>

        <TabsContent value="components">
          <ComponentsTab campaignId={campaignId!} />
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationsTab campaignId={campaignId!} campaign={campaign} />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab campaignId={campaignId!} campaign={campaign} />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { Broadcast } from '@shared/schema';
import { Plus, Trash2, Clock, Filter } from 'lucide-react';

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

function BroadcastsTab({ campaignId, appId }: { campaignId: number; appId: number | null }) {
  const { toast } = useToast();
  const { userId } = useUser();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    broadcastName: '',
    startTime: '',
    endTime: '',
    metadata: '',
  });

  const { data: broadcasts = [], isLoading } = useQuery<Broadcast[]>({
    queryKey: ['/api/broadcasts', campaignId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('campaignId', String(campaignId));
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/broadcasts?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch broadcasts');
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return await apiRequest('POST', '/api/broadcasts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', campaignId] });
      toast({ title: 'Broadcast Created', description: 'The broadcast has been created.' });
      setCreateOpen(false);
      setFormData({ broadcastName: '', startTime: '', endTime: '', metadata: '' });
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
      queryClient.invalidateQueries({ queryKey: ['/api/broadcasts', campaignId] });
      toast({ title: 'Broadcast Deleted', description: 'The broadcast has been deleted.' });
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
      campaignId,
      startTime: formData.startTime || undefined,
      endTime: formData.endTime || undefined,
      metadata,
      createdBy: userId,
    });
  };

  const filterOptions = [
    { value: 'all', label: 'All' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'live', label: 'Live' },
    { value: 'ended', label: 'Ended' },
  ];

  const broadcastDetailHref = (broadcastId: string) => {
    if (appId) return `/apps/${appId}/campaigns/${campaignId}/broadcasts/${broadcastId}`;
    return `/broadcasts/${broadcastId}`;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <div className="flex gap-2 flex-wrap">
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

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-broadcast" className="gap-2">
              <Plus className="w-4 h-4" />
              New Broadcast
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Broadcast</DialogTitle>
              <DialogDescription>Create a new broadcast for this campaign.</DialogDescription>
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
              <Button variant="outline" onClick={() => setCreateOpen(false)} data-testid="button-cancel-create">Cancel</Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending} data-testid="button-submit-broadcast">
                {createMutation.isPending ? 'Creating...' : 'Create Broadcast'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading broadcasts...</p>
        </div>
      ) : broadcasts.length === 0 ? (
        <Card className="border-0">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Radio className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No broadcasts yet</h3>
            <p className="text-muted-foreground mb-4">Create your first broadcast for this campaign</p>
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
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        data-testid={`button-delete-broadcast-${broadcast.broadcastId}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Broadcast?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{broadcast.broadcastName}"? All polls and contests will be permanently deleted.
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
                <Link href={broadcastDetailHref(broadcast.broadcastId)}>
                  <Button variant="default" size="sm" className="w-full" data-testid={`button-manage-broadcast-${broadcast.broadcastId}`}>
                    <Radio className="w-4 h-4 mr-1" />
                    Manage Broadcast
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
