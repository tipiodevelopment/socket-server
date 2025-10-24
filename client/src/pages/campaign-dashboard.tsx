import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BarChart3, Zap, Calendar, Settings as SettingsIcon, Activity } from "lucide-react";
import { Campaign } from "@shared/schema";
import { OverviewTab } from "@/components/dashboard/OverviewTab";
import { EventsTab } from "@/components/dashboard/EventsTab";
import { ScheduledTab } from "@/components/dashboard/ScheduledTab";
import { ComponentsTab } from "@/components/dashboard/ComponentsTab";
import { IntegrationsTab } from "@/components/dashboard/IntegrationsTab";
import { SettingsTab } from "@/components/dashboard/SettingsTab";

export default function CampaignDashboard() {
  const { id } = useParams();
  const campaignId = id ? parseInt(id) : null;

  const { data: campaign, isLoading } = useQuery<Campaign>({
    queryKey: ['/api/campaigns', campaignId],
    enabled: !!campaignId
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-foreground">Loading...</div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-foreground">Campaign not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/">
            <Button 
              variant="ghost" 
              className="mb-4" 
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to campaigns
            </Button>
          </Link>

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
            
            <Link href={`/campaign/${campaign.name}/${campaign.id}`}>
              <Button variant="outline" size="sm" data-testid="button-view-live">
                <Activity className="w-4 h-4 mr-2" />
                View Live
              </Button>
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 mb-6">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BarChart3 className="w-4 h-4 mr-2" />
              Overview
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
      </div>
    </div>
  );
}
