import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ToggleLeft, ToggleRight, Pencil, Trash2, ExternalLink, Activity } from "lucide-react";
import { CampaignComponent, Component, Campaign } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Link } from "wouter";

interface ComponentsTabProps {
  campaignId: number;
}

export function ComponentsTab({ campaignId }: ComponentsTabProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState<string>('');
  const [editingConfigFor, setEditingConfigFor] = useState<(CampaignComponent & { component: Component }) | null>(null);

  const { data: campaign } = useQuery<Campaign>({
    queryKey: ['/api/campaigns', campaignId],
  });

  const { data: campaignComponents = [], isLoading } = useQuery<Array<CampaignComponent & { component: Component }>>({
    queryKey: ['/api/campaigns', campaignId, 'components'],
  });

  const { data: allComponents = [] } = useQuery<Component[]>({
    queryKey: ['/api/components'],
  });

  const isPaused = campaign?.isPaused === 'true';

  const addComponentMutation = useMutation({
    mutationFn: async (componentId: string) => {
      return await apiRequest('POST', `/api/campaigns/${campaignId}/components`, {
        componentId,
        status: 'inactive',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'components'] });
      queryClient.invalidateQueries({ queryKey: ['/api/components/usage'] });
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
    onSuccess: async () => {
      // Show toast immediately for responsive UI
      toast({
        title: 'Status Updated',
        description: 'The component status has been updated.',
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

  const removeComponentMutation = useMutation({
    mutationFn: async (componentId: string) => {
      return await apiRequest('DELETE', `/api/campaigns/${campaignId}/components/${componentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'components'] });
      queryClient.invalidateQueries({ queryKey: ['/api/components/usage'] });
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
      offer_banner: 'Offer Banner',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <Card className="border-0">
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Loading components...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Dynamic Components
              </CardTitle>
              <CardDescription>
                Reusable UI components that can be toggled on/off in real-time
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-component">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Component
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Component to Campaign</DialogTitle>
                  <DialogDescription>
                    Select a component from your library to add to this campaign.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {availableComponents.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No available components.</p>
                      <p className="text-sm mt-2">Create components in the Component Library.</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Select Component</Label>
                        <Select value={selectedComponentId} onValueChange={setSelectedComponentId}>
                          <SelectTrigger data-testid="select-component">
                            <SelectValue placeholder="Choose a component..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availableComponents.map((comp) => (
                              <SelectItem key={comp.id} value={comp.id}>
                                {comp.name} ({getComponentTypeLabel(comp.type)})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        onClick={() => selectedComponentId && addComponentMutation.mutate(selectedComponentId)}
                        disabled={!selectedComponentId || addComponentMutation.isPending}
                        className="w-full"
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
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No components added yet</p>
              <p className="text-sm mt-2">Add reusable components from your library</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaignComponents.map((cc) => (
                <div
                  key={cc.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-lg bg-muted/50 border"
                  data-testid={`component-${cc.id}`}
                >
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant={cc.status === 'active' ? 'default' : 'secondary'}
                        data-testid={`status-${cc.id}`}
                      >
                        {cc.status}
                      </Badge>
                      <span className="font-medium" data-testid={`name-${cc.id}`}>
                        {cc.component.name}
                      </span>
                      <Badge variant="outline" data-testid={`type-${cc.id}`}>
                        {getComponentTypeLabel(cc.component.type)}
                      </Badge>
                      {cc.customConfig !== null && cc.customConfig !== undefined && (
                        <Badge variant="secondary" data-testid={`badge-customized-${cc.id}`}>
                          Customized
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {(() => {
                        const config = (cc.customConfig || cc.component.config) as any;
                        if (cc.component.type === 'banner' && config?.title) {
                          return <div key="banner-title">Title: {config.title}</div>;
                        }
                        if (cc.component.type === 'countdown' && config?.title) {
                          return <div key="countdown-title">Title: {config.title}</div>;
                        }
                        if (cc.component.type === 'product_spotlight' && config?.productId) {
                          return <div key="spotlight-product">Product: {config.productId}</div>;
                        }
                        if (cc.component.type === 'carousel_auto' && config?.channelId) {
                          return <div key="carousel-channel">Channel: {config.channelId}</div>;
                        }
                        if (cc.component.type === 'offer_badge' && config?.text) {
                          return <div key="badge-text">Text: {config.text}</div>;
                        }
                        if (cc.component.type === 'offer_banner' && config?.title) {
                          return <div key="banner-title">Title: {config.title}</div>;
                        }
                        return <div key="component-id" className="font-mono text-xs">ID: {cc.componentId}</div>;
                      })()}
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingConfigFor(cc)}
                      data-testid={`button-customize-${cc.id}`}
                      title="Customize for this campaign"
                    >
                      <Pencil className="w-4 h-4" />
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
                      disabled={toggleStatusMutation.isPending || isPaused}
                      title={isPaused ? 'Campaign is paused - resume to toggle components' : cc.status === 'active' ? 'Deactivate' : 'Activate'}
                      data-testid={`button-toggle-${cc.id}`}
                    >
                      {cc.status === 'active' ? (
                        <ToggleRight className="w-4 h-4" />
                      ) : (
                        <ToggleLeft className="w-4 h-4" />
                      )}
                    </Button>
                    <Link href="/components">
                      <Button
                        variant="ghost"
                        size="sm"
                        data-testid={`button-view-library-${cc.id}`}
                        title="View in Component Library"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to remove this component from the campaign?')) {
                          removeComponentMutation.mutate(cc.componentId);
                        }
                      }}
                      disabled={removeComponentMutation.isPending}
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

      {/* Customize Config Dialog */}
      <Dialog open={!!editingConfigFor} onOpenChange={(open) => !open && setEditingConfigFor(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customize Component for This Campaign</DialogTitle>
            <DialogDescription>
              Personalize this component's configuration for this campaign only. Changes won't affect the original template or other campaigns.
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

interface CampaignComponentConfigFormProps {
  campaignComponent: CampaignComponent & { component: Component };
  onSubmit: (customConfig: any) => void;
  onRevertToDefault: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function CampaignComponentConfigForm({ 
  campaignComponent, 
  onSubmit, 
  onRevertToDefault,
  onCancel, 
  isLoading 
}: CampaignComponentConfigFormProps) {
  const currentConfig = (campaignComponent.customConfig || campaignComponent.component.config) as any;
  const [config, setConfig] = useState(currentConfig || {});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(config);
  };

  const renderConfigFields = () => {
    const type = campaignComponent.component.type;

    switch (type) {
      case 'banner':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                data-testid="input-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtitle</Label>
              <Input
                id="subtitle"
                value={config.subtitle || ''}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                data-testid="input-subtitle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageUrl">Image URL</Label>
              <Input
                id="imageUrl"
                value={config.imageUrl || ''}
                onChange={(e) => setConfig({ ...config, imageUrl: e.target.value })}
                data-testid="input-imageUrl"
              />
            </div>
          </>
        );

      case 'countdown':
        return (
          <>
            {/* Core Fields */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                placeholder="Black Friday Ends In:"
                data-testid="input-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={config.endDate ? new Date(config.endDate).toISOString().slice(0, 16) : ''}
                onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                data-testid="input-endDate"
              />
            </div>

            {/* Visual Fields */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">Visual Customization (Optional)</h4>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL</Label>
              <Input
                id="logoUrl"
                value={config.logoUrl || ''}
                onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png"
                data-testid="input-logoUrl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtitle</Label>
              <Input
                id="subtitle"
                value={config.subtitle || ''}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                placeholder="Get 20% off on all products"
                data-testid="input-subtitle"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="backgroundImageUrl">Background Image URL</Label>
              <Input
                id="backgroundImageUrl"
                value={config.backgroundImageUrl || ''}
                onChange={(e) => setConfig({ ...config, backgroundImageUrl: e.target.value })}
                placeholder="https://example.com/background.jpg"
                data-testid="input-backgroundImageUrl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="backgroundColor">Background Color (hex)</Label>
              <Input
                id="backgroundColor"
                value={config.backgroundColor || '#FF6F61'}
                onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                placeholder="#FF6F61"
                data-testid="input-backgroundColor"
              />
              <p className="text-xs text-muted-foreground">Used if no background image. Default: #FF6F61</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="overlayOpacity">Overlay Opacity (0-1)</Label>
              <Input
                id="overlayOpacity"
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={config.overlayOpacity ?? 0.6}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  setConfig({ ...config, overlayOpacity: val !== undefined && !isNaN(val) ? val : undefined });
                }}
                data-testid="input-overlayOpacity"
              />
              <p className="text-xs text-muted-foreground">Dark overlay opacity. Default: 0.6</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaText">CTA Button Text</Label>
              <Input
                id="ctaText"
                value={config.ctaText || ''}
                onChange={(e) => setConfig({ ...config, ctaText: e.target.value })}
                placeholder="Shop Now"
                data-testid="input-ctaText"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaLink">CTA Link (URL)</Label>
              <Input
                id="ctaLink"
                value={config.ctaLink || ''}
                onChange={(e) => setConfig({ ...config, ctaLink: e.target.value })}
                placeholder="https://example.com/shop"
                data-testid="input-ctaLink"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deeplink">Deeplink (optional, takes priority)</Label>
              <Input
                id="deeplink"
                value={config.deeplink || ''}
                onChange={(e) => setConfig({ ...config, deeplink: e.target.value })}
                placeholder="pregnancy://offers/black-friday"
                data-testid="input-deeplink"
              />
              <p className="text-xs text-muted-foreground">For in-app navigation. Takes priority over CTA Link.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buttonColor">Button Color (hex)</Label>
              <Input
                id="buttonColor"
                value={config.buttonColor || '#FFFFFF'}
                onChange={(e) => setConfig({ ...config, buttonColor: e.target.value })}
                placeholder="#FFFFFF"
                data-testid="input-buttonColor"
              />
              <p className="text-xs text-muted-foreground">Button text color. Default: #FFFFFF</p>
            </div>
          </>
        );

      case 'offer_badge':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="text">Badge Text</Label>
              <Input
                id="text"
                value={config.text || ''}
                onChange={(e) => setConfig({ ...config, text: e.target.value })}
                data-testid="input-text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Select
                value={config.color || 'red'}
                onValueChange={(value) => setConfig({ ...config, color: value })}
              >
                <SelectTrigger data-testid="select-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="red">Red</SelectItem>
                  <SelectItem value="blue">Blue</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );

      case 'product_carousel':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="productIds">Product IDs (optional, comma-separated)</Label>
              <Input
                id="productIds"
                value={config.productIds?.join(', ') || ''}
                onChange={(e) => {
                  const ids = e.target.value.split(',').map((id: string) => id.trim()).filter((id: string) => id);
                  setConfig({ 
                    ...config, 
                    productIds: ids.length > 0 ? ids : undefined
                  });
                }}
                placeholder="Leave empty for all channel products, or: 408727, 408728"
                data-testid="input-productIds"
              />
              <p className="text-xs text-muted-foreground">
                {config.productIds && config.productIds.length > 0 
                  ? `Showing ${config.productIds.length} specific products`
                  : "Will display all products from Reachu channel"}
              </p>
            </div>
            <div className="space-y-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="autoPlay"
                checked={config.autoPlay || false}
                onChange={(e) => setConfig({ ...config, autoPlay: e.target.checked })}
                data-testid="checkbox-autoPlay"
                className="rounded"
              />
              <Label htmlFor="autoPlay">Auto Play</Label>
            </div>
            {config.autoPlay && (
              <div className="space-y-2">
                <Label htmlFor="interval">Interval (milliseconds)</Label>
                <Input
                  id="interval"
                  type="number"
                  value={config.interval || 3000}
                  onChange={(e) => setConfig({ ...config, interval: parseInt(e.target.value) || 3000 })}
                  min={1000}
                  max={10000}
                  step={500}
                  data-testid="input-interval"
                />
                <p className="text-xs text-muted-foreground">Time between slides when auto-play is enabled (default: 3000ms)</p>
              </div>
            )}
          </>
        );

      case 'offer_banner':
        return (
          <>
            {/* Required Fields */}
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL *</Label>
              <Input
                id="logoUrl"
                value={config.logoUrl || ''}
                onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                placeholder="/objects/uploads/... or https://..."
                data-testid="input-logoUrl"
              />
              <p className="text-xs text-muted-foreground">Upload to Object Storage and paste the URL here</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                placeholder="Black Friday Sale"
                data-testid="input-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="backgroundImageUrl">Background Image URL *</Label>
              <Input
                id="backgroundImageUrl"
                value={config.backgroundImageUrl || ''}
                onChange={(e) => setConfig({ ...config, backgroundImageUrl: e.target.value })}
                placeholder="/objects/uploads/... or https://..."
                data-testid="input-backgroundImageUrl"
              />
              <p className="text-xs text-muted-foreground">Upload to Object Storage and paste the URL here</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="countdownEndDate">Countdown End Date *</Label>
              <Input
                id="countdownEndDate"
                type="datetime-local"
                value={config.countdownEndDate ? (() => {
                  const date = new Date(config.countdownEndDate);
                  const offset = date.getTimezoneOffset();
                  const localDate = new Date(date.getTime() - offset * 60 * 1000);
                  return localDate.toISOString().slice(0, 16);
                })() : ''}
                onChange={(e) => {
                  const dateValue = e.target.value ? new Date(e.target.value).toISOString() : '';
                  setConfig({ ...config, countdownEndDate: dateValue });
                }}
                data-testid="input-countdownEndDate"
              />
              <p className="text-xs text-muted-foreground">Select date and time in your local timezone</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountBadgeText">Discount Badge Text *</Label>
              <Input
                id="discountBadgeText"
                value={config.discountBadgeText || ''}
                onChange={(e) => setConfig({ ...config, discountBadgeText: e.target.value })}
                placeholder="50% OFF"
                data-testid="input-discountBadgeText"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaText">CTA Button Text *</Label>
              <Input
                id="ctaText"
                value={config.ctaText || ''}
                onChange={(e) => setConfig({ ...config, ctaText: e.target.value })}
                placeholder="Shop Now"
                data-testid="input-ctaText"
              />
            </div>

            {/* Optional Fields */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">Optional Fields</h4>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtitle</Label>
              <Input
                id="subtitle"
                value={config.subtitle || ''}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                placeholder="Up to 50% off on selected products"
                data-testid="input-subtitle"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaLink">CTA Link (URL)</Label>
              <Input
                id="ctaLink"
                value={config.ctaLink || ''}
                onChange={(e) => setConfig({ ...config, ctaLink: e.target.value })}
                placeholder="https://example.com/black-friday"
                data-testid="input-ctaLink"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="overlayOpacity">Overlay Opacity (0-1)</Label>
              <Input
                id="overlayOpacity"
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={config.overlayOpacity ?? 0.4}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  setConfig({ ...config, overlayOpacity: val !== undefined && !isNaN(val) ? val : 0.4 });
                }}
                data-testid="input-overlayOpacity"
              />
              <p className="text-xs text-muted-foreground">Dark overlay on background image. Default: 0.4</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backgroundColor">Background Color (hex)</Label>
              <Input
                id="backgroundColor"
                value={config.backgroundColor || '#FF6F61'}
                onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                placeholder="#FF6F61"
                data-testid="input-backgroundColor"
              />
              <p className="text-xs text-muted-foreground">Fallback color if image fails to load</p>
            </div>
          </>
        );

      default:
        return (
          <div className="text-sm text-muted-foreground">
            <p>Custom configuration for {type} components is not yet available.</p>
            <p className="mt-2">You can still use the component with its default configuration.</p>
          </div>
        );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {renderConfigFields()}
      
      <div className="flex gap-2 justify-between pt-4">
        {campaignComponent.customConfig ? (
          <Button
            type="button"
            variant="outline"
            onClick={onRevertToDefault}
            disabled={isLoading}
            data-testid="button-revert"
          >
            Revert to Default
          </Button>
        ) : null}
        <div className="flex gap-2 ml-auto">
          <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel">
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} data-testid="button-save">
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}
