import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, ShoppingBag, Radio, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Campaign, ScheduledComponent } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function AdvancedCampaign() {
  const { id } = useParams();
  const campaignId = id ? parseInt(id) : null;

  const { data: campaign, isLoading } = useQuery<Campaign>({
    queryKey: ['/api/campaigns', campaignId],
    enabled: !!campaignId
  });

  const { data: components = [] } = useQuery<ScheduledComponent[]>({
    queryKey: ['/api/campaigns', campaignId, 'components'],
    enabled: !!campaignId
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-white">Loading...</div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-white">Campaign not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="w-full sm:w-auto">
          <Button variant="ghost" className="mb-6 text-white hover:text-white/80 w-full sm:w-auto" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to campaigns
          </Button>
        </Link>

        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2" data-testid="text-campaign-name">{campaign.name}</h1>
              <p className="text-sm sm:text-base text-gray-400">{campaign.description}</p>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 bg-gray-800 border-0">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="integration" data-testid="tab-integration">Integrations</TabsTrigger>
              <TabsTrigger value="components" data-testid="tab-components">Scheduled Components</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <Card className="bg-gray-800 border-0">
                <CardHeader>
                  <CardTitle className="text-white">Campaign Information</CardTitle>
                  <CardDescription className="text-gray-400">Basic details and scheduling</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300">Name</Label>
                      <Input 
                        value={campaign.name} 
                        className="bg-gray-700 border-0 text-white"
                        disabled
                        data-testid="input-campaign-name"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300">Logo URL</Label>
                      <Input 
                        value={campaign.logo || ''} 
                        placeholder="No logo configured"
                        className="bg-gray-700 border-0 text-white"
                        disabled
                        data-testid="input-campaign-logo"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-300">Description</Label>
                    <Textarea 
                      value={campaign.description || ''} 
                      className="bg-gray-700 border-0 text-white"
                      disabled
                      data-testid="textarea-campaign-description"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Start Date
                      </Label>
                      <Input 
                        type="datetime-local"
                        value={campaign.startDate ? new Date(campaign.startDate).toISOString().slice(0, 16) : ''} 
                        className="bg-gray-700 border-0 text-white"
                        disabled
                        data-testid="input-start-date"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        End Date
                      </Label>
                      <Input 
                        type="datetime-local"
                        value={campaign.endDate ? new Date(campaign.endDate).toISOString().slice(0, 16) : ''} 
                        className="bg-gray-700 border-0 text-white"
                        disabled
                        data-testid="input-end-date"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Integration Tab */}
            <TabsContent value="integration" className="space-y-4">
              <Card className="bg-gray-800 border-0">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" />
                    Reachu.io Channel
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Connect a Reachu channel to fetch products in real-time
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300">Channel ID</Label>
                      <Input 
                        value={campaign.reachuChannelId || ''} 
                        placeholder="No channel configured"
                        className="bg-gray-700 border-0 text-white"
                        disabled
                        data-testid="input-reachu-channel-id"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300">API Key</Label>
                      <Input 
                        type="password"
                        value={campaign.reachuApiKey || ''} 
                        placeholder="No API key configured"
                        className="bg-gray-700 border-0 text-white"
                        disabled
                        data-testid="input-reachu-api-key"
                      />
                    </div>
                  </div>
                  {campaign.reachuChannelId && (
                    <Badge className="bg-green-600 border-0" data-testid="badge-reachu-connected">
                      ✓ Connected to Reachu
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-gray-800 border-0">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Radio className="w-5 h-5" />
                    Tipio.no Liveshow
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Connect this campaign to a Tipio liveshow
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-gray-300">Liveshow ID</Label>
                    <Input 
                      value={campaign.tipioLiveshowId || ''} 
                      placeholder="No liveshow configured"
                      className="bg-gray-700 border-0 text-white"
                      disabled
                      data-testid="input-tipio-liveshow-id"
                    />
                  </div>
                  {campaign.tipioLiveshowId && (
                    <Badge className="bg-purple-600 border-0" data-testid="badge-tipio-connected">
                      ✓ Connected to Tipio
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Components Tab */}
            <TabsContent value="components" className="space-y-4">
              <Card className="bg-gray-800 border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-white">Scheduled Components</CardTitle>
                      <CardDescription className="text-gray-400">
                        Components that will automatically display at specific times
                      </CardDescription>
                    </div>
                    <Button 
                      className="bg-blue-600 hover:bg-blue-700 border-0"
                      data-testid="button-add-component"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Component
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {components.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No scheduled components</p>
                      <p className="text-sm mt-2">Add components to display content at specific times</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {components.map((component) => (
                        <ComponentCard key={component.id} component={component} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Component Types Info */}
              <Card className="bg-gray-800 border-0">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Available Component Types</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <ComponentTypeCard 
                    type="carousel"
                    title="Carousel"
                    description="Display Reachu products in automatic rotation"
                    icon={<ShoppingBag className="w-4 h-4" />}
                  />
                  <ComponentTypeCard 
                    type="store_view"
                    title="Store View"
                    description="Grid/list of products from a category"
                    icon={<ShoppingBag className="w-4 h-4" />}
                  />
                  <ComponentTypeCard 
                    type="product_spotlight"
                    title="Product Spotlight"
                    description="Highlight a specific product for limited time"
                    icon={<ShoppingBag className="w-4 h-4" />}
                  />
                  <ComponentTypeCard 
                    type="liveshow_trigger"
                    title="Start Liveshow"
                    description="Automatically start Tipio liveshow"
                    icon={<Radio className="w-4 h-4" />}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function ComponentCard({ component }: { component: ScheduledComponent }) {
  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      carousel: "Carousel",
      store_view: "Store View",
      product_spotlight: "Product Spotlight",
      liveshow_trigger: "Start Liveshow"
    };
    return types[type] || type;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-600",
      sent: "bg-green-600",
      cancelled: "bg-red-600"
    };
    return colors[status] || "bg-gray-600";
  };

  return (
    <div 
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-gray-700 rounded-lg border-0"
      data-testid={`component-${component.id}`}
    >
      <div className="flex-1 w-full">
        <div className="flex items-center gap-3 mb-2">
          <Badge className={`${getStatusColor(component.status)} border-0`} data-testid={`status-${component.id}`}>
            {component.status}
          </Badge>
          <span className="text-white font-medium text-sm sm:text-base" data-testid={`type-${component.id}`}>
            {getTypeLabel(component.type)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400">
          <Clock className="w-4 h-4" />
          <span data-testid={`time-${component.id}`}>
            {new Date(component.scheduledTime).toLocaleString('en-US')}
          </span>
        </div>
      </div>
      <Button 
        variant="ghost" 
        size="sm" 
        className="text-red-400 hover:text-red-300 hover:bg-red-950 w-full sm:w-auto"
        data-testid={`button-delete-${component.id}`}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
}

function ComponentTypeCard({ 
  type, 
  title, 
  description, 
  icon 
}: { 
  type: string; 
  title: string; 
  description: string; 
  icon: React.ReactNode;
}) {
  return (
    <div 
      className="p-3 bg-gray-700 rounded-lg border-0"
      data-testid={`info-${type}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="text-blue-400">{icon}</div>
        <span className="text-white font-medium text-sm">{title}</span>
      </div>
      <p className="text-gray-400 text-xs">{description}</p>
    </div>
  );
}
