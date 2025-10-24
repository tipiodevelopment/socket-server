import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  Activity, 
  CheckCircle2, 
  Clock, 
  Zap,
  ExternalLink,
  ShoppingBag,
  BarChart2,
  Trophy
} from "lucide-react";
import { Campaign, CampaignComponent, Component, WebSocketEvent } from "@shared/schema";
import { Link } from "wouter";
import { format } from "date-fns";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface OverviewTabProps {
  campaignId: number;
  campaign: Campaign;
}

export function OverviewTab({ campaignId, campaign }: OverviewTabProps) {
  const { toast } = useToast();
  const { data: campaignComponents = [] } = useQuery<Array<CampaignComponent & { component: Component }>>({
    queryKey: ['/api/campaigns', campaignId, 'components'],
  });

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

  return (
    <div className="space-y-6">
      {/* Campaign Status Banner */}
      <Card className="border-0 bg-gradient-to-r from-primary/10 to-primary/5">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Campaign Status</h3>
                <Badge variant={isCampaignActive() ? "default" : "secondary"}>
                  {isCampaignActive() ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {campaign.startDate && `Started: ${format(new Date(campaign.startDate), 'PPP')}`}
                {campaign.endDate && ` • Ends: ${format(new Date(campaign.endDate), 'PPP')}`}
              </p>
            </div>
            <Link href={`/campaign/${campaign.name}/${campaign.id}`}>
              <Button variant="outline" data-testid="button-view-live-overview">
                <ExternalLink className="w-4 h-4 mr-2" />
                View Live
              </Button>
            </Link>
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

      {/* Quick Event Trigger */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Quick Event Trigger
          </CardTitle>
          <CardDescription>Send events instantly to your viewers</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="product" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="product" data-testid="quick-tab-product">
                <ShoppingBag className="w-4 h-4 mr-2" />
                Product
              </TabsTrigger>
              <TabsTrigger value="poll" data-testid="quick-tab-poll">
                <BarChart2 className="w-4 h-4 mr-2" />
                Poll
              </TabsTrigger>
              <TabsTrigger value="contest" data-testid="quick-tab-contest">
                <Trophy className="w-4 h-4 mr-2" />
                Contest
              </TabsTrigger>
            </TabsList>

            <TabsContent value="product" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="quick-product-name">Product Name</Label>
                <Input
                  id="quick-product-name"
                  value={quickProduct.name}
                  onChange={(e) => setQuickProduct({ ...quickProduct, name: e.target.value })}
                  placeholder="Product name"
                  data-testid="input-quick-product-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-product-price">Price</Label>
                <Input
                  id="quick-product-price"
                  value={quickProduct.price}
                  onChange={(e) => setQuickProduct({ ...quickProduct, price: e.target.value })}
                  placeholder="$99"
                  data-testid="input-quick-product-price"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-product-desc">Description</Label>
                <Input
                  id="quick-product-desc"
                  value={quickProduct.description}
                  onChange={(e) => setQuickProduct({ ...quickProduct, description: e.target.value })}
                  placeholder="Product description"
                  data-testid="input-quick-product-desc"
                />
              </div>
              <Button 
                onClick={() => productMutation.mutate()}
                disabled={productMutation.isPending}
                className="w-full"
                data-testid="button-send-quick-product"
              >
                <Zap className="w-4 h-4 mr-2" />
                {productMutation.isPending ? 'Sending...' : 'Send Product Event'}
              </Button>
            </TabsContent>

            <TabsContent value="poll" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="quick-poll-question">Question</Label>
                <Input
                  id="quick-poll-question"
                  value={quickPoll.question}
                  onChange={(e) => setQuickPoll({ ...quickPoll, question: e.target.value })}
                  placeholder="What do you think?"
                  data-testid="input-quick-poll-question"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="quick-poll-opt1">Option 1</Label>
                  <Input
                    id="quick-poll-opt1"
                    value={quickPoll.option1}
                    onChange={(e) => setQuickPoll({ ...quickPoll, option1: e.target.value })}
                    placeholder="Option A"
                    data-testid="input-quick-poll-opt1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quick-poll-opt2">Option 2</Label>
                  <Input
                    id="quick-poll-opt2"
                    value={quickPoll.option2}
                    onChange={(e) => setQuickPoll({ ...quickPoll, option2: e.target.value })}
                    placeholder="Option B"
                    data-testid="input-quick-poll-opt2"
                  />
                </div>
              </div>
              <Button 
                onClick={() => pollMutation.mutate()}
                disabled={pollMutation.isPending}
                className="w-full"
                data-testid="button-send-quick-poll"
              >
                <Zap className="w-4 h-4 mr-2" />
                {pollMutation.isPending ? 'Sending...' : 'Send Poll Event'}
              </Button>
            </TabsContent>

            <TabsContent value="contest" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="quick-contest-name">Contest Name</Label>
                <Input
                  id="quick-contest-name"
                  value={quickContest.name}
                  onChange={(e) => setQuickContest({ ...quickContest, name: e.target.value })}
                  placeholder="Grand Prize Contest"
                  data-testid="input-quick-contest-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-contest-prize">Prize</Label>
                <Input
                  id="quick-contest-prize"
                  value={quickContest.prize}
                  onChange={(e) => setQuickContest({ ...quickContest, prize: e.target.value })}
                  placeholder="Amazing prizes!"
                  data-testid="input-quick-contest-prize"
                />
              </div>
              <Button 
                onClick={() => contestMutation.mutate()}
                disabled={contestMutation.isPending}
                className="w-full"
                data-testid="button-send-quick-contest"
              >
                <Zap className="w-4 h-4 mr-2" />
                {contestMutation.isPending ? 'Sending...' : 'Send Contest Event'}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Scheduled Components */}
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Upcoming Scheduled
            </CardTitle>
            <CardDescription>Components scheduled to activate soon</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingScheduled.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No upcoming scheduled components
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingScheduled.map((cc) => (
                  <div 
                    key={cc.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`upcoming-component-${cc.id}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">{cc.component.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(cc.scheduledTime!), 'PPp')}
                      </p>
                    </div>
                    <Badge variant="outline">{cc.component.type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card className="border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Recent Events
            </CardTitle>
            <CardDescription>Latest events broadcasted</CardDescription>
          </CardHeader>
          <CardContent>
            {recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No events yet
              </p>
            ) : (
              <div className="space-y-3">
                {recentEvents.slice(0, 5).map((event, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`recent-event-${index}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm capitalize">{event.type}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.timestamp ? format(new Date(event.timestamp), 'PPp') : 'Just now'}
                      </p>
                    </div>
                    <Badge variant="secondary">{event.type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
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
