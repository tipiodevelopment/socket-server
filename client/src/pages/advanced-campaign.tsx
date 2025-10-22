import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, ShoppingBag, Radio, ArrowLeft, Plus, Trash2, ToggleLeft, ToggleRight, Pencil } from "lucide-react";
import { Campaign, ScheduledComponent, Component, CampaignComponent } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";

export default function AdvancedCampaign() {
  const { toast } = useToast();
  const { id } = useParams();
  const campaignId = id ? parseInt(id) : null;
  const [isAddScheduledOpen, setIsAddScheduledOpen] = useState(false);

  const { data: campaign, isLoading } = useQuery<Campaign>({
    queryKey: ['/api/campaigns', campaignId],
    enabled: !!campaignId
  });

  const { data: scheduledComponents = [] } = useQuery<ScheduledComponent[]>({
    queryKey: ['/api/campaigns', campaignId, 'scheduled-components'],
    enabled: !!campaignId
  });

  const { data: campaignComponents = [] } = useQuery<Array<CampaignComponent & { component: Component }>>({
    queryKey: ['/api/campaigns', campaignId, 'components'],
    enabled: !!campaignId
  });

  const { data: allComponents = [] } = useQuery<Component[]>({
    queryKey: ['/api/components'],
  });

  const createScheduledMutation = useMutation({
    mutationFn: async (data: { type: string; scheduledTime: string; endTime?: string; data: any }) => {
      return await apiRequest('POST', `/api/campaigns/${campaignId}/scheduled-components`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'scheduled-components'] });
      setIsAddScheduledOpen(false);
      toast({
        title: 'Scheduled Component Created',
        description: 'The component has been scheduled successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create scheduled component.',
        variant: 'destructive',
      });
    },
  });

  const updateScheduledMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { type: string; scheduledTime: string; endTime?: string; data: any } }) => {
      return await apiRequest('PATCH', `/api/scheduled-components/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'scheduled-components'] });
      toast({
        title: 'Scheduled Component Updated',
        description: 'The component has been updated successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update scheduled component.',
        variant: 'destructive',
      });
    },
  });

  const deleteScheduledMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/scheduled-components/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'scheduled-components'] });
      toast({
        title: 'Scheduled Component Deleted',
        description: 'The scheduled component has been removed.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete scheduled component.',
        variant: 'destructive',
      });
    },
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
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-gray-800 border-0">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="integration" data-testid="tab-integration">Integrations</TabsTrigger>
              <TabsTrigger value="components" data-testid="tab-components">Scheduled</TabsTrigger>
              <TabsTrigger value="dynamic" data-testid="tab-dynamic">Components</TabsTrigger>
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
                    <Dialog open={isAddScheduledOpen} onOpenChange={setIsAddScheduledOpen}>
                      <DialogTrigger asChild>
                        <Button 
                          className="bg-blue-600 hover:bg-blue-700 border-0"
                          data-testid="button-add-component"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Component
                        </Button>
                      </DialogTrigger>
                      <DialogContent 
                        className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-gray-800 border-0"
                        onInteractOutside={(e) => e.preventDefault()}
                      >
                        <DialogHeader>
                          <DialogTitle className="text-white">Schedule Component</DialogTitle>
                          <DialogDescription className="text-gray-400">
                            Create a component that will automatically display at a specific time
                          </DialogDescription>
                        </DialogHeader>
                        <ScheduledComponentForm
                          onSubmit={(data) => createScheduledMutation.mutate(data)}
                          onCancel={() => setIsAddScheduledOpen(false)}
                          isLoading={createScheduledMutation.isPending}
                          campaign={campaign}
                        />
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {scheduledComponents.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                      <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No scheduled components</p>
                      <p className="text-sm mt-2">Add components to display content at specific times</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {scheduledComponents.map((component: ScheduledComponent) => (
                        <ScheduledComponentCard 
                          key={component.id} 
                          component={component}
                          campaign={campaign}
                          onEdit={(data) => updateScheduledMutation.mutate({ id: component.id, data })}
                          onDelete={() => deleteScheduledMutation.mutate(component.id)}
                        />
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

            {/* Dynamic Components Tab */}
            <TabsContent value="dynamic" className="space-y-4">
              <DynamicComponentsTab campaignId={campaignId!} campaignComponents={campaignComponents} allComponents={allComponents} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function ScheduledComponentCard({ 
  component, 
  campaign,
  onDelete,
  onEdit
}: { 
  component: ScheduledComponent & { componentDetails?: Component }; 
  campaign: Campaign;
  onDelete: () => void;
  onEdit: (data: { type: string; scheduledTime: string; endTime?: string; data: any }) => void;
}) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const getTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      carousel: "Carousel",
      store_view: "Store View",
      product_spotlight: "Product Spotlight",
      liveshow_trigger: "Start Liveshow",
      custom_component: "Custom Component"
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
    <>
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
              {component.type === 'custom_component' && component.componentDetails 
                ? component.componentDetails.name 
                : getTypeLabel(component.type)}
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              <span data-testid={`time-${component.id}`}>
                Start: {new Date(component.scheduledTime).toLocaleString('en-US')}
              </span>
            </div>
            {component.endTime && (
              <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                <span data-testid={`endtime-${component.id}`}>
                  End: {new Date(component.endTime).toLocaleString('en-US')}
                </span>
              </div>
            )}
            {!component.endTime && (
              <div className="text-xs text-gray-500">
                Duration: Until manually stopped
              </div>
            )}
          </div>
          {component.type === 'custom_component' && component.componentDetails && (
            <div className="text-xs text-gray-500 mt-1">
              Type: {component.componentDetails.type}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditOpen(true)}
            className="text-blue-400 hover:text-blue-300 hover:bg-blue-950"
            data-testid={`button-edit-${component.id}`}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-400 hover:text-red-300 hover:bg-red-950"
            data-testid={`button-delete-${component.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent 
          className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-gray-800 border-0"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-white">Edit Scheduled Component</DialogTitle>
            <DialogDescription className="text-gray-400">
              Update the scheduled component settings
            </DialogDescription>
          </DialogHeader>
          <ScheduledComponentForm
            initialData={component}
            onSubmit={(data) => {
              onEdit(data);
              setIsEditOpen(false);
            }}
            onCancel={() => setIsEditOpen(false)}
            isLoading={false}
            campaign={campaign}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function DynamicComponentsTab({
  campaignId,
  campaignComponents,
  allComponents,
}: {
  campaignId: number;
  campaignComponents: Array<CampaignComponent & { component: Component }>;
  allComponents: Component[];
}) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState<string>('');

  const addComponentMutation = useMutation({
    mutationFn: async (componentId: string) => {
      return await apiRequest('POST', `/api/campaigns/${campaignId}/components`, {
        componentId,
        status: 'inactive',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'components'] });
      setIsAddDialogOpen(false);
      setSelectedComponentId('');
      toast({
        title: 'Component Added',
        description: 'The component has been added to this campaign.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add component.',
        variant: 'destructive',
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ componentId, status }: { componentId: string; status: 'active' | 'inactive' }) => {
      return await apiRequest('PATCH', `/api/campaigns/${campaignId}/components/${componentId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'components'] });
      toast({
        title: 'Status Updated',
        description: 'The component status has been updated.',
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

  const removeComponentMutation = useMutation({
    mutationFn: async (componentId: string) => {
      return await apiRequest('DELETE', `/api/campaigns/${campaignId}/components/${componentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'components'] });
      toast({
        title: 'Component Removed',
        description: 'The component has been removed from this campaign.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to remove component.',
        variant: 'destructive',
      });
    },
  });

  const availableComponents = allComponents.filter(
    (comp) => !campaignComponents.some((cc) => cc.componentId === comp.id)
  );

  const getComponentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      banner: 'Banner',
      countdown: 'Countdown',
      carousel_auto: 'Auto Carousel',
      carousel_manual: 'Manual Carousel',
      product_spotlight: 'Product Spotlight',
      offer_badge: 'Offer Badge',
    };
    return labels[type] || type;
  };

  return (
    <Card className="bg-gray-800 border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white">Dynamic Components</CardTitle>
            <CardDescription className="text-gray-400">
              Reusable UI components that can be toggled on/off in real-time
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 border-0" data-testid="button-add-dynamic-component">
                <Plus className="w-4 h-4 mr-2" />
                Add Component
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-800 text-white border-gray-700">
              <DialogHeader>
                <DialogTitle>Add Component to Campaign</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Select a component from your library to add to this campaign.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {availableComponents.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p>No available components.</p>
                    <Link href="/components">
                      <Button variant="link" className="mt-2">
                        Create a component in the library
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>Select Component</Label>
                      <Select value={selectedComponentId} onValueChange={setSelectedComponentId}>
                        <SelectTrigger className="bg-gray-700 border-0">
                          <SelectValue placeholder="Choose a component..." />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          {availableComponents.map((comp) => (
                            <SelectItem key={comp.id} value={comp.id} className="text-white">
                              {comp.name} ({getComponentTypeLabel(comp.type)})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={() => selectedComponentId && addComponentMutation.mutate(selectedComponentId)}
                      disabled={!selectedComponentId || addComponentMutation.isPending}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      data-testid="button-confirm-add"
                    >
                      {addComponentMutation.isPending ? 'Adding...' : 'Add to Campaign'}
                    </Button>
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {campaignComponents.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No components added yet</p>
            <p className="text-sm mt-2">Add reusable components from your library</p>
          </div>
        ) : (
          <div className="space-y-3">
            {campaignComponents.map((cc) => (
              <div
                key={cc.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-gray-700 rounded-lg border-0"
                data-testid={`dynamic-component-${cc.id}`}
              >
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge
                      className={`${cc.status === 'active' ? 'bg-green-600' : 'bg-gray-600'} border-0`}
                      data-testid={`status-${cc.id}`}
                    >
                      {cc.status}
                    </Badge>
                    <span className="text-white font-medium text-sm sm:text-base" data-testid={`name-${cc.id}`}>
                      {cc.component.name}
                    </span>
                    <Badge className="bg-blue-600 border-0 text-xs" data-testid={`type-${cc.id}`}>
                      {getComponentTypeLabel(cc.component.type)}
                    </Badge>
                  </div>
                  <div className="text-xs sm:text-sm text-gray-400 font-mono">
                    ID: {cc.componentId}
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toggleStatusMutation.mutate({
                        componentId: cc.componentId,
                        status: cc.status === 'active' ? 'inactive' : 'active',
                      })
                    }
                    disabled={toggleStatusMutation.isPending}
                    className={`flex-1 sm:flex-none ${
                      cc.status === 'active'
                        ? 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-950'
                        : 'text-green-400 hover:text-green-300 hover:bg-green-950'
                    }`}
                    data-testid={`button-toggle-${cc.id}`}
                  >
                    {cc.status === 'active' ? (
                      <ToggleRight className="w-4 h-4" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (confirm('Are you sure you want to remove this component from the campaign?')) {
                        removeComponentMutation.mutate(cc.componentId);
                      }
                    }}
                    disabled={removeComponentMutation.isPending}
                    className="text-red-400 hover:text-red-300 hover:bg-red-950"
                    data-testid={`button-remove-${cc.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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

function ScheduledComponentForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  campaign,
}: {
  initialData?: ScheduledComponent & { componentDetails?: Component };
  onSubmit: (data: { type: string; scheduledTime: string; endTime?: string; data: any }) => void;
  onCancel: () => void;
  isLoading: boolean;
  campaign?: Campaign;
}) {
  type ComponentType = 'carousel' | 'store_view' | 'product_spotlight' | 'liveshow_trigger' | 'custom_component';
  type EndTimeMode = 'none' | 'specific' | 'duration';
  
  // Initialize from initialData if provided
  const [type, setType] = useState<ComponentType>((initialData?.type as ComponentType) || 'carousel');
  const [scheduledTime, setScheduledTime] = useState(
    initialData?.scheduledTime 
      ? new Date(initialData.scheduledTime).toISOString().slice(0, 16) 
      : ''
  );
  const [endTimeMode, setEndTimeMode] = useState<EndTimeMode>(
    initialData?.endTime ? 'specific' : 'none'
  );
  const [endTime, setEndTime] = useState(
    initialData?.endTime 
      ? new Date(initialData.endTime).toISOString().slice(0, 16) 
      : ''
  );
  const [durationDays, setDurationDays] = useState(0);
  const [durationHours, setDurationHours] = useState(1);
  const [config, setConfig] = useState<Record<string, any>>(
    initialData?.data ? (typeof initialData.data === 'object' ? initialData.data as Record<string, any> : {}) : {}
  );

  // Fetch available components from library
  const { data: availableComponents, isLoading: componentsLoading } = useQuery<Component[]>({
    queryKey: ['/api/components'],
    enabled: type === 'custom_component'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Calculate endTime based on mode
    let calculatedEndTime: string | undefined;
    
    if (endTimeMode === 'specific' && endTime) {
      calculatedEndTime = endTime;
    } else if (endTimeMode === 'duration' && scheduledTime) {
      const startDate = new Date(scheduledTime);
      const totalHours = (durationDays * 24) + durationHours;
      const endDate = new Date(startDate.getTime() + (totalHours * 60 * 60 * 1000));
      calculatedEndTime = endDate.toISOString();
    }
    
    onSubmit({ 
      type, 
      scheduledTime, 
      endTime: calculatedEndTime,
      data: config 
    });
  };

  const renderConfigFields = () => {
    switch (type) {
      case 'carousel':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="productIds" className="text-gray-300">Product IDs (comma-separated)</Label>
              <Input
                id="productIds"
                placeholder="prod_1, prod_2, prod_3"
                value={config.productIds?.join(', ') || ''}
                onChange={(e) => setConfig({ ...config, productIds: e.target.value.split(',').map(id => id.trim()) })}
                className="bg-gray-700 border-0 text-white"
                data-testid="input-productIds"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="intervalSeconds" className="text-gray-300">Interval (seconds)</Label>
                <Input
                  id="intervalSeconds"
                  type="number"
                  placeholder="5"
                  value={config.intervalSeconds || 5}
                  onChange={(e) => setConfig({ ...config, intervalSeconds: parseInt(e.target.value) })}
                  className="bg-gray-700 border-0 text-white"
                  data-testid="input-intervalSeconds"
                />
              </div>
            </div>
          </>
        );
      case 'store_view':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="categoryId" className="text-gray-300">Category ID (optional)</Label>
              <Input
                id="categoryId"
                placeholder="cat_123"
                value={config.categoryId || ''}
                onChange={(e) => setConfig({ ...config, categoryId: e.target.value })}
                className="bg-gray-700 border-0 text-white"
                data-testid="input-categoryId"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="layout" className="text-gray-300">Layout</Label>
                <Select
                  value={config.layout || 'grid'}
                  onValueChange={(value) => setConfig({ ...config, layout: value })}
                >
                  <SelectTrigger className="bg-gray-700 border-0 text-white" data-testid="select-layout">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grid">Grid</SelectItem>
                    <SelectItem value="list">List</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxItems" className="text-gray-300">Max Items</Label>
                <Input
                  id="maxItems"
                  type="number"
                  placeholder="20"
                  value={config.maxItems || 20}
                  onChange={(e) => setConfig({ ...config, maxItems: parseInt(e.target.value) })}
                  className="bg-gray-700 border-0 text-white"
                  data-testid="input-maxItems"
                />
              </div>
            </div>
          </>
        );
      case 'product_spotlight':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="productId" className="text-gray-300">Product ID</Label>
              <Input
                id="productId"
                placeholder="prod_123"
                value={config.productId || ''}
                onChange={(e) => setConfig({ ...config, productId: e.target.value })}
                required
                className="bg-gray-700 border-0 text-white"
                data-testid="input-productId"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="highlightText" className="text-gray-300">Highlight Text (optional)</Label>
              <Input
                id="highlightText"
                placeholder="Featured Product"
                value={config.highlightText || ''}
                onChange={(e) => setConfig({ ...config, highlightText: e.target.value })}
                className="bg-gray-700 border-0 text-white"
                data-testid="input-highlightText"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationSeconds" className="text-gray-300">Duration (seconds)</Label>
              <Input
                id="durationSeconds"
                type="number"
                placeholder="30"
                value={config.durationSeconds || 30}
                onChange={(e) => setConfig({ ...config, durationSeconds: parseInt(e.target.value) })}
                className="bg-gray-700 border-0 text-white"
                data-testid="input-durationSeconds"
              />
            </div>
          </>
        );
      case 'liveshow_trigger':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="liveshowId" className="text-gray-300">Liveshow ID</Label>
              <Input
                id="liveshowId"
                placeholder={campaign?.tipioLiveshowId || 'liveshow_123'}
                value={config.liveshowId || campaign?.tipioLiveshowId || ''}
                onChange={(e) => setConfig({ ...config, liveshowId: e.target.value })}
                required
                className="bg-gray-700 border-0 text-white"
                data-testid="input-liveshowId"
              />
              {campaign?.tipioLiveshowId && (
                <p className="text-xs text-gray-400">Using campaign's Tipio liveshow ID by default</p>
              )}
            </div>
          </>
        );
      case 'custom_component':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="componentId" className="text-gray-300">Select Component</Label>
              {componentsLoading ? (
                <div className="text-gray-400 text-sm">Loading components...</div>
              ) : !availableComponents || availableComponents.length === 0 ? (
                <div className="text-gray-400 text-sm">
                  No components available. Create components in the Components Library first.
                </div>
              ) : (
                <Select
                  value={config.componentId || ''}
                  onValueChange={(value) => setConfig({ ...config, componentId: value })}
                >
                  <SelectTrigger className="bg-gray-700 border-0 text-white" data-testid="select-componentId">
                    <SelectValue placeholder="Choose a component" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableComponents.map((comp) => (
                      <SelectItem key={comp.id} value={comp.id}>
                        {comp.name} ({comp.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-gray-400">
                The component will be activated at the scheduled time with its configured settings.
              </p>
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="type" className="text-gray-300">Component Type</Label>
        <Select value={type} onValueChange={(value) => setType(value as ComponentType)}>
          <SelectTrigger className="bg-gray-700 border-0 text-white" data-testid="select-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="carousel">Carousel</SelectItem>
            <SelectItem value="store_view">Store View</SelectItem>
            <SelectItem value="product_spotlight">Product Spotlight</SelectItem>
            <SelectItem value="liveshow_trigger">Start Liveshow</SelectItem>
            <SelectItem value="custom_component">Custom Component</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="scheduledTime" className="text-gray-300">Start Time</Label>
        <Input
          id="scheduledTime"
          type="datetime-local"
          value={scheduledTime}
          onChange={(e) => setScheduledTime(e.target.value)}
          required
          className="bg-gray-700 border-0 text-white"
          data-testid="input-scheduledTime"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="endTimeMode" className="text-gray-300">End Time</Label>
        <Select value={endTimeMode} onValueChange={(value) => setEndTimeMode(value as EndTimeMode)}>
          <SelectTrigger className="bg-gray-700 border-0 text-white" data-testid="select-endTimeMode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No End Time (Until manually stopped)</SelectItem>
            <SelectItem value="specific">Specific Date/Time</SelectItem>
            <SelectItem value="duration">Duration</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {endTimeMode === 'specific' && (
        <div className="space-y-2">
          <Label htmlFor="endTime" className="text-gray-300">End Date/Time</Label>
          <Input
            id="endTime"
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
            className="bg-gray-700 border-0 text-white"
            data-testid="input-endTime"
          />
        </div>
      )}

      {endTimeMode === 'duration' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="durationDays" className="text-gray-300">Days</Label>
            <Input
              id="durationDays"
              type="number"
              min="0"
              value={durationDays}
              onChange={(e) => setDurationDays(parseInt(e.target.value) || 0)}
              className="bg-gray-700 border-0 text-white"
              data-testid="input-durationDays"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="durationHours" className="text-gray-300">Hours</Label>
            <Input
              id="durationHours"
              type="number"
              min="0"
              value={durationHours}
              onChange={(e) => setDurationHours(parseInt(e.target.value) || 0)}
              className="bg-gray-700 border-0 text-white"
              data-testid="input-durationHours"
            />
          </div>
        </div>
      )}

      {renderConfigFields()}

      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
          data-testid="button-cancel"
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading} 
          className="flex-1 bg-blue-600 hover:bg-blue-700" 
          data-testid="button-submit"
        >
          {isLoading ? 'Scheduling...' : 'Schedule Component'}
        </Button>
      </div>
    </form>
  );
}
