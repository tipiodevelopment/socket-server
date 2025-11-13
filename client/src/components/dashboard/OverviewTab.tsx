import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Calendar, 
  Activity, 
  CheckCircle2, 
  Clock, 
  Zap,
  ExternalLink,
  ShoppingBag,
  BarChart2,
  Trophy,
  ToggleLeft,
  ToggleRight,
  Pencil
} from "lucide-react";
import { Campaign, CampaignComponent, Component, WebSocketEvent } from "@shared/schema";
import { Link } from "wouter";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CampaignComponentConfigForm } from "./ComponentsTab";

interface OverviewTabProps {
  campaignId: number;
  campaign: Campaign;
}

export function OverviewTab({ campaignId, campaign }: OverviewTabProps) {
  const { toast } = useToast();
  const [editingConfigFor, setEditingConfigFor] = useState<(CampaignComponent & { component: Component }) | null>(null);

  const { data: campaignComponents = [] } = useQuery<Array<CampaignComponent & { component: Component }>>({
    queryKey: ['/api/campaigns', campaignId, 'components'],
    refetchInterval: 5000, // Auto-refresh every 5 seconds to keep UI in sync
  });

  // Debug: Log component statuses
  console.log('[OverviewTab] Campaign components:', campaignComponents.map(cc => ({
    name: cc.instanceName || cc.component.name,
    status: cc.status,
    id: cc.id
  })));

  const { data: recentEvents = [] } = useQuery<WebSocketEvent[]>({
    queryKey: ['/api/events', campaignId],
  });

  const activeComponents = campaignComponents.filter(cc => cc.status === 'active');
  const scheduledComponents = campaignComponents.filter(cc => cc.scheduledTime);
  const upcomingScheduled = scheduledComponents
    .filter(cc => cc.scheduledTime && new Date(cc.scheduledTime) > new Date())
    .sort((a, b) => new Date(a.scheduledTime!).getTime() - new Date(b.scheduledTime!).getTime())
    .slice(0, 3);

  const isCampaignActive = () => {
    const now = new Date();
    if (campaign.startDate && new Date(campaign.startDate) > now) return false;
    if (campaign.endDate && new Date(campaign.endDate) < now) return false;
    return true;
  };

  // Quick event states
  const [quickProduct, setQuickProduct] = useState({
    name: 'Flash Sale Item',
    price: '$99',
    description: 'Limited time offer - Act now!'
  });

  const [quickPoll, setQuickPoll] = useState({
    question: 'What do you think?',
    option1: 'Option A',
    option2: 'Option B'
  });

  const [quickContest, setQuickContest] = useState({
    name: 'Grand Prize Contest',
    prize: 'Amazing prizes to be won!'
  });

  // Mutations for quick events
  const productMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/events/${campaignId}`, {
        type: 'product',
        data: {
          productId: `quick-${Date.now()}`,
          name: quickProduct.name,
          description: quickProduct.description,
          price: quickProduct.price,
          imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', campaignId] });
      toast({
        title: '🎉 Product Event Sent!',
        description: `"${quickProduct.name}" broadcasted to viewers`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send product event',
        variant: 'destructive',
      });
    }
  });

  const pollMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/events/${campaignId}`, {
        type: 'poll',
        data: {
          question: quickPoll.question,
          options: [
            { text: quickPoll.option1 },
            { text: quickPoll.option2 }
          ],
          duration: 60
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', campaignId] });
      toast({
        title: '📊 Poll Event Sent!',
        description: `"${quickPoll.question}" is now live`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send poll event',
        variant: 'destructive',
      });
    }
  });

  const contestMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/events/${campaignId}`, {
        type: 'contest',
        data: {
          name: quickContest.name,
          prize: quickContest.prize,
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          maxParticipants: 100
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', campaignId] });
      toast({
        title: '🏆 Contest Event Sent!',
        description: `"${quickContest.name}" is now active`,
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to send contest event',
        variant: 'destructive',
      });
    }
  });

  // Toggle component mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ componentId, status }: { componentId: string; status: 'active' | 'inactive' }) => {
      return await apiRequest('PATCH', `/api/campaigns/${campaignId}/components/${componentId}`, { status });
    },
    onSuccess: async () => {
      // Show toast immediately for responsive UI
      toast({
        title: 'Status Updated',
        description: 'Component status has been updated.',
      });
      
      // Invalidate to trigger refetch (provides fallback if WebSocket fails)
      // In React Query v5, invalidateQueries automatically refetches active queries
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/campaigns', campaignId, 'components'],
        refetchType: 'active'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update component status.',
        variant: 'destructive',
      });
    },
  });

  // Update component configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async ({ componentId, customConfig }: { componentId: string; customConfig: any }) => {
      return await apiRequest('PATCH', `/api/campaigns/${campaignId}/components/${componentId}/config`, { customConfig });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'components'] });
      setEditingConfigFor(null);
      toast({
        title: 'Configuration Updated',
        description: 'The component configuration has been personalized for this campaign.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update component configuration.',
        variant: 'destructive',
      });
    },
  });

  // Master toggle mutation - activate/deactivate all components
  const toggleAllMutation = useMutation({
    mutationFn: async (targetStatus: 'active' | 'inactive') => {
      // Filter components that need status change
      const componentsToToggle = campaignComponents.filter(cc => cc.status !== targetStatus);
      
      if (componentsToToggle.length === 0) {
        return { succeeded: 0, failed: 0, total: 0 };
      }

      // Toggle all components to target status using Promise.allSettled
      const promises = componentsToToggle.map(cc => 
        apiRequest('PATCH', `/api/campaigns/${campaignId}/components/${cc.componentId}`, { 
          status: targetStatus 
        })
      );
      const results = await Promise.allSettled(promises);
      
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      return { succeeded, failed, total: componentsToToggle.length };
    },
    onSuccess: async (result, targetStatus) => {
      // Show toast immediately for responsive UI
      if (result.failed === 0) {
        toast({
          title: targetStatus === 'active' ? 'All Components Activated' : 'All Components Deactivated',
          description: `${result.succeeded} component(s) updated successfully.`,
        });
      } else if (result.succeeded > 0) {
        toast({
          title: 'Partial Success',
          description: `${result.succeeded} succeeded, ${result.failed} failed. Check campaign lifecycle.`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Failed',
          description: `Failed to update ${result.failed} component(s). Campaign may not be active.`,
          variant: 'destructive',
        });
      }
      
      // Invalidate to trigger refetch (provides fallback if WebSocket fails)
      // In React Query v5, invalidateQueries automatically refetches active queries
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/campaigns', campaignId, 'components'],
        refetchType: 'active'
      });
    },
    onError: async (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle components.',
        variant: 'destructive',
      });
      
      // Always invalidate even on error to show actual state
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/campaigns', campaignId, 'components'],
        refetchType: 'active'
      });
    },
  });

  // Campaign pause/resume toggle mutation
  const toggleCampaignPauseMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('PATCH', `/api/campaigns/${campaignId}/toggle-pause`, {});
    },
    onSuccess: async (data: any) => {
      const isPaused = data.isPaused === 'true';
      toast({
        title: isPaused ? '⏸️ Campaign Paused' : '▶️ Campaign Resumed',
        description: isPaused 
          ? 'All components are now hidden from viewers'
          : 'Campaign is now active and broadcasting',
      });
      
      // Invalidate campaign query to update UI
      await queryClient.invalidateQueries({ 
        queryKey: ['/api/campaigns', campaignId],
        refetchType: 'active'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle campaign state.',
        variant: 'destructive',
      });
    },
  });

  // Re-broadcast event mutation
  const rebroadcastEventMutation = useMutation({
    mutationFn: async (event: WebSocketEvent) => {
      return await apiRequest('POST', `/api/events/${campaignId}`, {
        type: event.type,
        data: event.data
      });
    },
    onSuccess: (_, event) => {
      queryClient.invalidateQueries({ queryKey: ['/api/events', campaignId] });
      const eventNames: Record<string, string> = {
        product: '🛍️ Product',
        poll: '📊 Poll',
        contest: '🏆 Contest'
      };
      toast({
        title: `${eventNames[event.type] || event.type} Re-broadcasted!`,
        description: 'Event sent to all viewers',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to re-broadcast event',
        variant: 'destructive',
      });
    }
  });

  const getComponentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      banner: 'Banner',
      countdown: 'Countdown',
      carousel_auto: 'Auto Carousel',
      carousel_manual: 'Manual Carousel',
      product_spotlight: 'Product Spotlight',
      offer_badge: 'Offer Badge',
      offer_banner: 'Offer Banner',
      product_carousel: 'Product Carousel',
      product_banner: 'Product Banner',
      product_store: 'Product Store',
    };
    return labels[type] || type;
  };

  const getEventTitle = (event: WebSocketEvent) => {
    if (event.type === 'product' && event.data.name) return event.data.name;
    if (event.type === 'poll' && event.data.question) return event.data.question;
    if (event.type === 'contest' && event.data.name) return event.data.name;
    return event.type;
  };

  const getEventIcon = (type: string) => {
    if (type === 'product') return <ShoppingBag className="w-4 h-4" />;
    if (type === 'poll') return <BarChart2 className="w-4 h-4" />;
    if (type === 'contest') return <Trophy className="w-4 h-4" />;
    return <Zap className="w-4 h-4" />;
  };

  const isPaused = campaign.isPaused === 'true';

  return (
    <div className="space-y-6">
      {/* Campaign Control Panel */}
      <Card className="border-0 bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            {/* Campaign Toggle - Primary Control */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-background/50 border">
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  isPaused ? 'bg-yellow-500/20' : 'bg-green-500/20'
                }`}>
                  {isPaused ? (
                    <ToggleLeft className="w-5 h-5 text-yellow-400" />
                  ) : (
                    <ToggleRight className="w-5 h-5 text-green-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    Campaign
                    <Badge variant={isPaused ? "secondary" : "default"} className="text-xs">
                      {isPaused ? "Paused" : "Active"}
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {campaign.startDate && `${format(new Date(campaign.startDate), 'MMM d')} - ${campaign.endDate ? format(new Date(campaign.endDate), 'MMM d, yyyy') : 'Ongoing'}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/campaign/${campaign.name}/${campaign.id}`}>
                  <Button variant="ghost" size="sm" data-testid="button-view-live-overview">
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant={isPaused ? "default" : "outline"}
                  onClick={() => toggleCampaignPauseMutation.mutate()}
                  disabled={toggleCampaignPauseMutation.isPending}
                  className={isPaused 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'border-yellow-500/50 text-yellow-400 hover:bg-yellow-950'}
                  data-testid="button-toggle-campaign"
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={<Activity className="w-5 h-5" />}
          label="Active Components"
          value={activeComponents.length}
          color="green"
          testId="stat-active-components"
        />
        <StatCard
          icon={<Calendar className="w-5 h-5" />}
          label="Scheduled"
          value={scheduledComponents.length}
          color="blue"
          testId="stat-scheduled-components"
        />
        <StatCard
          icon={<Zap className="w-5 h-5" />}
          label="Total Events"
          value={recentEvents.length}
          color="purple"
          testId="stat-total-events"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label="Components"
          value={campaignComponents.length}
          color="cyan"
          testId="stat-total-components"
        />
      </div>

      {/* Active Components with Toggle */}
      <Card className="border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-4 h-4" />
              Components
            </CardTitle>
            {campaignComponents.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAllMutation.mutate('active')}
                  disabled={toggleAllMutation.isPending || !isCampaignActive() || isPaused || activeComponents.length === campaignComponents.length}
                  className="text-green-400 hover:text-green-300 hover:bg-green-950 h-8 px-2"
                  data-testid="button-activate-all"
                  title={
                    isPaused
                      ? 'Campaign is paused - resume to toggle components'
                      : !isCampaignActive() 
                      ? 'Campaign is not active' 
                      : 'Activate all components'
                  }
                >
                  <ToggleRight className="w-3 h-3 mr-1" />
                  All On
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleAllMutation.mutate('inactive')}
                  disabled={toggleAllMutation.isPending || isPaused || activeComponents.length === 0}
                  className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-950 h-8 px-2"
                  data-testid="button-deactivate-all"
                  title={
                    isPaused
                      ? 'Campaign is paused - resume to toggle components'
                      : 'Deactivate all components'
                  }
                >
                  <ToggleLeft className="w-3 h-3 mr-1" />
                  All Off
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {campaignComponents.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No components added yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {campaignComponents.map((cc) => (
                <div
                  key={cc.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                  data-testid={`overview-component-${cc.id}`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge
                      variant={cc.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs"
                      data-testid={`overview-status-${cc.id}`}
                    >
                      {cc.status}
                    </Badge>
                    <span className="font-medium text-sm truncate">{cc.instanceName || cc.component.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingConfigFor(cc)}
                      className="h-8 px-2 text-purple-400 hover:text-purple-300 hover:bg-purple-950"
                      data-testid={`overview-customize-${cc.id}`}
                      title="Customize for this campaign"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        toggleStatusMutation.mutate({
                          componentId: cc.componentId,
                          status: cc.status === 'active' ? 'inactive' : 'active',
                        })
                      }
                      disabled={toggleStatusMutation.isPending || !isCampaignActive() || isPaused}
                      className={`h-8 px-2 ${
                        cc.status === 'active'
                          ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-950'
                          : 'text-green-400 hover:text-green-300 hover:bg-green-950'
                      }`}
                      data-testid={`overview-toggle-${cc.id}`}
                      title={
                        isPaused 
                          ? 'Campaign is paused - resume to toggle components' 
                          : !isCampaignActive() 
                          ? 'Campaign is not active' 
                          : cc.status === 'active' ? 'Deactivate' : 'Activate'
                      }
                    >
                      {cc.status === 'active' ? (
                        <ToggleRight className="w-4 h-4" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved Events - Re-broadcast */}
      {recentEvents.length > 0 && (
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="w-4 h-4" />
              Saved Events
            </CardTitle>
            <CardDescription>Re-broadcast events to viewers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {recentEvents.map((event) => (
                <div
                  key={event.id || `${event.type}-${event.timestamp}`}
                  className="p-4 rounded-lg bg-muted/50 border flex flex-col gap-3"
                  data-testid={`saved-event-${event.id || event.timestamp}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getEventIcon(event.type)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{getEventTitle(event)}</p>
                        <p className="text-xs text-muted-foreground capitalize">{event.type}</p>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => rebroadcastEventMutation.mutate(event)}
                    disabled={rebroadcastEventMutation.isPending}
                    className="w-full h-8"
                    data-testid={`button-rebroadcast-${event.id || event.timestamp}`}
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    {rebroadcastEventMutation.isPending ? 'Sending...' : 'Broadcast'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Event Trigger - Moved to bottom */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="w-4 h-4" />
            Create New Event
          </CardTitle>
          <CardDescription>Create and send new events</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="product" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="product" data-testid="quick-tab-product" className="text-xs">
                <ShoppingBag className="w-3 h-3 mr-1" />
                Product
              </TabsTrigger>
              <TabsTrigger value="poll" data-testid="quick-tab-poll" className="text-xs">
                <BarChart2 className="w-3 h-3 mr-1" />
                Poll
              </TabsTrigger>
              <TabsTrigger value="contest" data-testid="quick-tab-contest" className="text-xs">
                <Trophy className="w-3 h-3 mr-1" />
                Contest
              </TabsTrigger>
            </TabsList>

            <TabsContent value="product" className="space-y-3 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="quick-product-name" className="text-xs">Product Name</Label>
                <Input
                  id="quick-product-name"
                  value={quickProduct.name}
                  onChange={(e) => setQuickProduct({ ...quickProduct, name: e.target.value })}
                  placeholder="Product name"
                  className="h-8"
                  data-testid="input-quick-product-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quick-product-price" className="text-xs">Price</Label>
                <Input
                  id="quick-product-price"
                  value={quickProduct.price}
                  onChange={(e) => setQuickProduct({ ...quickProduct, price: e.target.value })}
                  placeholder="$99"
                  className="h-8"
                  data-testid="input-quick-product-price"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quick-product-desc" className="text-xs">Description</Label>
                <Input
                  id="quick-product-desc"
                  value={quickProduct.description}
                  onChange={(e) => setQuickProduct({ ...quickProduct, description: e.target.value })}
                  placeholder="Product description"
                  className="h-8"
                  data-testid="input-quick-product-desc"
                />
              </div>
              <Button 
                onClick={() => productMutation.mutate()}
                disabled={productMutation.isPending}
                className="w-full h-8"
                data-testid="button-send-quick-product"
              >
                <Zap className="w-3 h-3 mr-1" />
                {productMutation.isPending ? 'Sending...' : 'Send Event'}
              </Button>
            </TabsContent>

            <TabsContent value="poll" className="space-y-3 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="quick-poll-question" className="text-xs">Question</Label>
                <Input
                  id="quick-poll-question"
                  value={quickPoll.question}
                  onChange={(e) => setQuickPoll({ ...quickPoll, question: e.target.value })}
                  placeholder="What do you think?"
                  className="h-8"
                  data-testid="input-quick-poll-question"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="quick-poll-opt1" className="text-xs">Option 1</Label>
                  <Input
                    id="quick-poll-opt1"
                    value={quickPoll.option1}
                    onChange={(e) => setQuickPoll({ ...quickPoll, option1: e.target.value })}
                    placeholder="Option A"
                    className="h-8"
                    data-testid="input-quick-poll-opt1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="quick-poll-opt2" className="text-xs">Option 2</Label>
                  <Input
                    id="quick-poll-opt2"
                    value={quickPoll.option2}
                    onChange={(e) => setQuickPoll({ ...quickPoll, option2: e.target.value })}
                    placeholder="Option B"
                    className="h-8"
                    data-testid="input-quick-poll-opt2"
                  />
                </div>
              </div>
              <Button 
                onClick={() => pollMutation.mutate()}
                disabled={pollMutation.isPending}
                className="w-full h-8"
                data-testid="button-send-quick-poll"
              >
                <Zap className="w-3 h-3 mr-1" />
                {pollMutation.isPending ? 'Sending...' : 'Send Event'}
              </Button>
            </TabsContent>

            <TabsContent value="contest" className="space-y-3 mt-4">
              <div className="space-y-1.5">
                <Label htmlFor="quick-contest-name" className="text-xs">Contest Name</Label>
                <Input
                  id="quick-contest-name"
                  value={quickContest.name}
                  onChange={(e) => setQuickContest({ ...quickContest, name: e.target.value })}
                  placeholder="Grand Prize Contest"
                  className="h-8"
                  data-testid="input-quick-contest-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quick-contest-prize" className="text-xs">Prize</Label>
                <Input
                  id="quick-contest-prize"
                  value={quickContest.prize}
                  onChange={(e) => setQuickContest({ ...quickContest, prize: e.target.value })}
                  placeholder="Amazing prizes!"
                  className="h-8"
                  data-testid="input-quick-contest-prize"
                />
              </div>
              <Button 
                onClick={() => contestMutation.mutate()}
                disabled={contestMutation.isPending}
                className="w-full h-8"
                data-testid="button-send-quick-contest"
              >
                <Zap className="w-3 h-3 mr-1" />
                {contestMutation.isPending ? 'Sending...' : 'Send Event'}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Customize Config Dialog */}
      <Dialog open={!!editingConfigFor} onOpenChange={(open) => !open && setEditingConfigFor(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customize Component</DialogTitle>
            <DialogDescription>
              Edit this component's configuration for this campaign. Changes broadcast in real-time via WebSocket.
            </DialogDescription>
          </DialogHeader>
          {editingConfigFor && (
            <CampaignComponentConfigForm
              campaignComponent={editingConfigFor}
              onSubmit={(customConfig) =>
                updateConfigMutation.mutate({ 
                  componentId: editingConfigFor.componentId, 
                  customConfig 
                })
              }
              onRevertToDefault={() => {
                updateConfigMutation.mutate({ 
                  componentId: editingConfigFor.componentId, 
                  customConfig: null 
                });
              }}
              onCancel={() => setEditingConfigFor(null)}
              isLoading={updateConfigMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "green" | "blue" | "purple" | "cyan";
  testId?: string;
}

function StatCard({ icon, label, value, color, testId }: StatCardProps) {
  const colorClasses = {
    green: "bg-green-500/10 text-green-500",
    blue: "bg-blue-500/10 text-blue-500",
    purple: "bg-purple-500/10 text-purple-500",
    cyan: "bg-cyan-500/10 text-cyan-500",
  };

  return (
    <Card className="border-0" data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            {icon}
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
