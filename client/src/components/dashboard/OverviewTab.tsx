import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Activity, 
  CheckCircle2, 
  Clock, 
  Zap,
  ExternalLink,
  PlayCircle
} from "lucide-react";
import { Campaign, CampaignComponent, Component, WebSocketEvent } from "@shared/schema";
import { Link } from "wouter";
import { format } from "date-fns";

interface OverviewTabProps {
  campaignId: number;
  campaign: Campaign;
}

export function OverviewTab({ campaignId, campaign }: OverviewTabProps) {
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

      {/* Quick Actions */}
      <Card className="border-0">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks for managing this campaign</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link href={`#events`}>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => {
                  const eventsTab = document.querySelector('[data-testid="tab-events"]') as HTMLElement;
                  eventsTab?.click();
                }}
                data-testid="button-trigger-events"
              >
                <Zap className="w-4 h-4 mr-2" />
                Trigger Events
              </Button>
            </Link>
            <Link href={`#components`}>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => {
                  const componentsTab = document.querySelector('[data-testid="tab-components"]') as HTMLElement;
                  componentsTab?.click();
                }}
                data-testid="button-manage-components"
              >
                <Activity className="w-4 h-4 mr-2" />
                Manage Components
              </Button>
            </Link>
            <Link href={`#scheduled`}>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => {
                  const scheduledTab = document.querySelector('[data-testid="tab-scheduled"]') as HTMLElement;
                  scheduledTab?.click();
                }}
                data-testid="button-view-schedule"
              >
                <Calendar className="w-4 h-4 mr-2" />
                View Schedule
              </Button>
            </Link>
          </div>
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
