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
import { ImageUploadWithPreview } from "@/components/ImageUploadWithPreview";
import { useSponsorCatalog } from "@/hooks/use-sponsor-catalog";

interface ComponentsTabProps {
  campaignId: number;
}

export function ComponentsTab({ campaignId }: ComponentsTabProps) {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedComponentId, setSelectedComponentId] = useState<string>('');
  const [instanceName, setInstanceName] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  // Multi-sponsor: every placement instance must declare which sponsor owns
  // the slot (drives commerce key routing on the SDK + branding). Required.
  const [selectedSponsorId, setSelectedSponsorId] = useState<string>('');
  // Per-sponsor product picker for `product_*` types. Stores the productIds
  // the operator picked from the chosen sponsor's commerce catalog. Sent in
  // customConfig.productIds so the SDK component reads them via existing
  // config plumbing.
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [editingConfigFor, setEditingConfigFor] = useState<(CampaignComponent & { component: Component }) | null>(null);

  const { data: campaign } = useQuery<Campaign>({
    queryKey: ['/api/campaigns', campaignId],
  });

  const { data: campaignComponents = [], isLoading } = useQuery<Array<CampaignComponent & { component: Component }>>({
    queryKey: ['/api/campaigns', campaignId, 'components'],
  });

  // Component picker is scoped to the campaign's clientApp. Falls back to the
  // global /api/components catalog if the campaign isn't linked to any app
  // (legacy data, edge case). The placements registry PR #29 ensures any
  // newly-registered app sees an empty list until the SDK uploads a manifest;
  // the dashboard surfaces an empty state in that case (further down).
  const clientAppId = (campaign as any)?.clientAppId as number | null | undefined;
  const { data: allComponents = [] } = useQuery<Component[]>({
    queryKey: clientAppId
      ? ['/api/client-apps', clientAppId, 'components']
      : ['/api/components'],
    queryFn: async () => {
      if (clientAppId) {
        const res = await fetch(`/api/client-apps/${clientAppId}/components`);
        if (!res.ok) return [];
        // The endpoint returns Array<AppComponent & { component: Component }>;
        // we want the inner Component for the picker shape.
        const rows = (await res.json()) as Array<any>;
        return rows.map((r) => r.component).filter(Boolean);
      }
      const res = await fetch('/api/components');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: clientAppId !== undefined, // wait until campaign loads
  });

  // Locations registered by the SDK manifest upload (POST /v2/mobile/components/manifest).
  // When clientAppId is null or the app has no locations yet, the picker shows
  // an empty state with a hint to register slots from the SDK.
  const { data: registeredLocations = [] } = useQuery<Array<{ id: number; locationId: string; displayName: string | null }>>({
    queryKey: clientAppId ? ['/api/client-apps', clientAppId, 'component-locations'] : [],
    queryFn: async () => {
      if (!clientAppId) return [];
      const res = await fetch(`/api/client-apps/${clientAppId}/component-locations`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!clientAppId,
  });

  // Campaign sponsors: primary + secondaries merged into one array. Returned
  // shape: { sponsorId, name, role, logoUrl, primaryColor, ... } per sponsor.
  // Mandatory picker — submit is blocked until the operator picks one.
  const { data: campaignSponsors = [] } = useQuery<Array<{
    sponsorId: number;
    name: string;
    role: string;
    logoUrl: string | null;
    primaryColor: string | null;
  }>>({
    queryKey: ['/api/campaigns', campaignId, 'sponsors'],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/sponsors`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Per-sponsor product catalog. Only relevant when a sponsor is selected AND
  // the picked component is a `product_*` type (the only kinds that bind
  // products). Reuses the existing useSponsorCatalog hook (already wired to
  // /v2/commerce/sponsors/:id/catalog with pagination + cache).
  const isProductComponent = (() => {
    const comp = allComponents.find((c) => c.id === selectedComponentId);
    return !!comp?.type && comp.type.startsWith('product_');
  })();
  const sponsorCatalog = useSponsorCatalog(
    selectedSponsorId && isProductComponent ? selectedSponsorId : null,
    { limit: 100 }
  );

  const isPaused = campaign?.isPaused === 'true';

  const addComponentMutation = useMutation({
    mutationFn: async (params: {
      componentId: string;
      instanceName?: string;
      locationId?: string;
      sponsorId: number;
      productIds?: string[];
    }) => {
      // customConfig.productIds is the convention the SDK product views read
      // when rendering. Empty array → fall back to component template's
      // baseline config (legacy behavior). Only set when the operator picked
      // products, so the SDK can distinguish "operator left default" from
      // "operator explicitly chose 0 products".
      const customConfig =
        params.productIds && params.productIds.length > 0
          ? { productIds: params.productIds }
          : undefined;
      return await apiRequest('POST', `/api/campaigns/${campaignId}/components`, {
        componentId: params.componentId,
        instanceName: params.instanceName || undefined,
        locationId: params.locationId || undefined,
        sponsorId: params.sponsorId,
        customConfig,
        status: 'inactive',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'components'] });
      queryClient.invalidateQueries({ queryKey: ['/api/components/usage'] });
      setIsAddDialogOpen(false);
      setSelectedComponentId('');
      setInstanceName('');
      setLocationId('');
      setSelectedSponsorId('');
      setSelectedProductIds(new Set());
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

  // Show all template components, allowing multiple instances of the same template
  // (e.g., Countdown 1, Countdown 2, etc. with different instanceNames).
  // Accepts both boolean true (current `components.is_template` column type) and
  // the legacy string 'true' that older API paths sometimes returned.
  const availableComponents = allComponents.filter(
    (comp) => (comp.isTemplate as unknown) === true || (comp.isTemplate as unknown) === 'true'
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
                      <div className="space-y-2">
                        <Label htmlFor="instance-name">Instance Name (Optional)</Label>
                        <Input
                          id="instance-name"
                          placeholder="e.g., RProductCarousel 1"
                          value={instanceName}
                          onChange={(e) => setInstanceName(e.target.value)}
                          data-testid="input-instance-name"
                        />
                        <p className="text-xs text-muted-foreground">
                          Leave empty to auto-generate a name using SDK conventions
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Location Slot {registeredLocations.length === 0 ? '(none registered yet)' : '(Optional)'}</Label>
                        <Select
                          value={locationId === '' ? '__none__' : locationId}
                          onValueChange={(v) => setLocationId(v === '__none__' ? '' : v)}
                        >
                          <SelectTrigger data-testid="select-location-id">
                            <SelectValue placeholder={registeredLocations.length === 0 ? 'No slots registered by the SDK yet' : 'None (manual activation)'} />
                          </SelectTrigger>
                          <SelectContent>
                            {/* Radix forbids value="" on SelectItem, so use a sentinel and
                                translate in onValueChange (above) → keeps the
                                campaign_components.location_id stored as NULL/empty. */}
                            <SelectItem value="__none__">None (manual activation)</SelectItem>
                            {registeredLocations.map((loc) => (
                              <SelectItem key={loc.locationId} value={loc.locationId}>
                                {loc.displayName ? `${loc.displayName} — ${loc.locationId}` : loc.locationId}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {registeredLocations.length === 0
                            ? 'The partner SDK declares slots at app boot via Vio.registerPlacementLocation(...). Run the demo once to populate this list.'
                            : 'The SDK renders the active component for this slot at runtime.'}
                        </p>
                      </div>

                      {/* Sponsor picker — required. Drives commerce-key routing
                          + branding for this placement instance at runtime. */}
                      <div className="space-y-2">
                        <Label>
                          Sponsor <span className="text-red-400">*</span>
                        </Label>
                        <Select value={selectedSponsorId} onValueChange={(v) => { setSelectedSponsorId(v); setSelectedProductIds(new Set()); }}>
                          <SelectTrigger data-testid="select-sponsor-id">
                            <SelectValue placeholder="Pick the sponsor that owns this slot" />
                          </SelectTrigger>
                          <SelectContent>
                            {campaignSponsors.map((s) => (
                              <SelectItem key={s.sponsorId} value={String(s.sponsorId)}>
                                {s.name} <span className="text-muted-foreground">({s.role})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Required. The SDK uses this to load the product via the sponsor's commerce key.
                        </p>
                      </div>

                      {/* Product picker — only shown for product_* component types.
                          Multi-select from the chosen sponsor's commerce catalog.
                          Stored as customConfig.productIds. */}
                      {isProductComponent && selectedSponsorId && (
                        <div className="space-y-2">
                          <Label>Products from {campaignSponsors.find(s => String(s.sponsorId) === selectedSponsorId)?.name}'s catalog</Label>
                          {sponsorCatalog.isLoading ? (
                            <p className="text-xs text-muted-foreground">Loading catalog…</p>
                          ) : sponsorCatalog.isError ? (
                            <p className="text-xs text-red-400">Failed to load catalog: {(sponsorCatalog.error as any)?.message}</p>
                          ) : !sponsorCatalog.data?.products?.length ? (
                            <p className="text-xs text-muted-foreground">No products in this sponsor's catalog yet.</p>
                          ) : (
                            <>
                              <div className="max-h-48 overflow-y-auto space-y-1 rounded border border-white/10 p-2">
                                {sponsorCatalog.data.products.map((p) => {
                                  const idStr = String(p.id);
                                  const checked = selectedProductIds.has(idStr);
                                  return (
                                    <label
                                      key={idStr}
                                      className="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-1 py-0.5 rounded"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                          setSelectedProductIds((prev) => {
                                            const next = new Set(prev);
                                            if (e.target.checked) next.add(idStr); else next.delete(idStr);
                                            return next;
                                          });
                                        }}
                                        data-testid={`checkbox-product-${idStr}`}
                                      />
                                      {p.imageUrl && (
                                        <img src={p.imageUrl} alt="" className="w-8 h-8 object-contain rounded bg-white/5" />
                                      )}
                                      <span className="text-sm flex-1 line-clamp-1">{p.name || `Product ${p.id}`}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {p.price != null ? `${p.price} ${p.currency}` : '—'}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {selectedProductIds.size === 0
                                  ? 'No products selected — placement will use the component template default.'
                                  : `${selectedProductIds.size} product${selectedProductIds.size > 1 ? 's' : ''} selected.`}
                              </p>
                            </>
                          )}
                        </div>
                      )}

                      <Button
                        onClick={() => selectedComponentId && selectedSponsorId && addComponentMutation.mutate({
                          componentId: selectedComponentId,
                          instanceName: instanceName.trim() || undefined,
                          locationId: locationId || undefined,
                          sponsorId: parseInt(selectedSponsorId, 10),
                          productIds: Array.from(selectedProductIds),
                        })}
                        disabled={!selectedComponentId || !selectedSponsorId || addComponentMutation.isPending}
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
                        {cc.instanceName || cc.component.name}
                      </span>
                      <Badge variant="outline" data-testid={`type-${cc.id}`}>
                        {getComponentTypeLabel(cc.component.type)}
                      </Badge>
                      {cc.customConfig !== null && cc.customConfig !== undefined && (
                        <Badge variant="secondary" data-testid={`badge-customized-${cc.id}`}>
                          Customized
                        </Badge>
                      )}
                      {(cc as any).locationId && (
                        <Badge variant="outline" className="text-[10px] font-mono text-gray-400 dark:text-white/40 border-gray-300 dark:border-white/20" data-testid={`badge-location-${cc.id}`}>
                          {(cc as any).locationId}
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
                          removeComponentMutation.mutate(cc.id.toString());
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

export interface CampaignComponentConfigFormProps {
  campaignComponent: CampaignComponent & { component: Component };
  onSubmit: (customConfig: any) => void;
  onRevertToDefault: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function CampaignComponentConfigForm({ 
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
            <ImageUploadWithPreview
              label="Banner Image"
              value={config.imageUrl || ''}
              onChange={(url) => setConfig({ ...config, imageUrl: url })}
              placeholder="https://example.com/banner.jpg"
              testId="input-imageUrl"
            />
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
                value={config.endDate ? (() => {
                  const date = new Date(config.endDate);
                  const offset = date.getTimezoneOffset();
                  const localDate = new Date(date.getTime() - offset * 60 * 1000);
                  return localDate.toISOString().slice(0, 16);
                })() : ''}
                onChange={(e) => {
                  const dateValue = e.target.value ? new Date(e.target.value).toISOString() : '';
                  setConfig({ ...config, endDate: dateValue });
                }}
                data-testid="input-endDate"
              />
              <p className="text-xs text-muted-foreground">Select date and time in your local timezone</p>
            </div>

            {/* Visual Fields */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">Visual Customization (Optional)</h4>
            </div>

            <ImageUploadWithPreview
              label="Logo URL"
              value={config.logoUrl || ''}
              onChange={(url) => setConfig({ ...config, logoUrl: url })}
              placeholder="https://example.com/logo.png"
              testId="input-logoUrl"
            />

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

            <ImageUploadWithPreview
              label="Background Image URL"
              value={config.backgroundImageUrl || ''}
              onChange={(url) => setConfig({ ...config, backgroundImageUrl: url })}
              placeholder="https://example.com/background.jpg"
              testId="input-backgroundImageUrl"
            />

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
            <ImageUploadWithPreview
              label="Logo URL *"
              value={config.logoUrl || ''}
              onChange={(url) => setConfig({ ...config, logoUrl: url })}
              placeholder="/objects/uploads/... or https://..."
              testId="input-logoUrl"
            />

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

            <ImageUploadWithPreview
              label="Background Image URL *"
              value={config.backgroundImageUrl || ''}
              onChange={(url) => setConfig({ ...config, backgroundImageUrl: url })}
              placeholder="/objects/uploads/... or https://..."
              testId="input-backgroundImageUrl"
            />

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

      case 'product_spotlight':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="productId">Product ID *</Label>
              <Input
                id="productId"
                value={config.productId || ''}
                onChange={(e) => setConfig({ ...config, productId: e.target.value })}
                placeholder="408841"
                data-testid="input-productId"
              />
              <p className="text-xs text-muted-foreground">Reachu product ID. The SDK will fetch product details.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="highlightText">Highlight Text (Optional)</Label>
              <Input
                id="highlightText"
                value={config.highlightText || ''}
                onChange={(e) => setConfig({ ...config, highlightText: e.target.value })}
                placeholder="e.g., Featured Product"
                data-testid="input-highlightText"
              />
              <p className="text-xs text-muted-foreground">Text to highlight the product</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="durationSeconds">Display Duration (seconds)</Label>
              <Input
                id="durationSeconds"
                type="number"
                min="1"
                value={config.durationSeconds || 30}
                onChange={(e) => setConfig({ ...config, durationSeconds: parseInt(e.target.value) || 30 })}
                data-testid="input-durationSeconds"
              />
              <p className="text-xs text-muted-foreground">How long to display the product spotlight (default: 30s)</p>
            </div>
          </>
        );

      case 'product_banner':
        return (
          <>
            {/* Required Fields */}
            <div className="space-y-2">
              <Label htmlFor="productId">Product ID *</Label>
              <Input
                id="productId"
                value={config.productId || ''}
                onChange={(e) => setConfig({ ...config, productId: e.target.value })}
                placeholder="408895"
                data-testid="input-productId"
              />
              <p className="text-xs text-muted-foreground">ID del producto en Commerce. El título del banner es editorial (no se toma del producto).</p>
            </div>

            <ImageUploadWithPreview
              label="Background Image"
              value={config.backgroundImageUrl || ''}
              onChange={(url) => setConfig({ ...config, backgroundImageUrl: url })}
              placeholder="Upload banner background image"
              testId="input-backgroundImageUrl"
            />

            <div className="space-y-2">
              <Label htmlFor="title">Title (Optional)</Label>
              <Input
                id="title"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                placeholder="Producto Destacado"
                data-testid="input-title"
              />
              <p className="text-xs text-muted-foreground">Leave empty to use product name</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtitle (Optional)</Label>
              <Input
                id="subtitle"
                value={config.subtitle || ''}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                placeholder="40% OFF"
                data-testid="input-subtitle"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaText">Button Text</Label>
              <Input
                id="ctaText"
                value={config.ctaText || ''}
                onChange={(e) => setConfig({ ...config, ctaText: e.target.value })}
                placeholder="Ver producto"
                data-testid="input-ctaText"
              />
            </div>

            {/* Optional Fields */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">Optional Fields</h4>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaLink">Button Link (URL)</Label>
              <Input
                id="ctaLink"
                value={config.ctaLink || ''}
                onChange={(e) => setConfig({ ...config, ctaLink: e.target.value })}
                placeholder="https://tienda.com/producto/408841"
                data-testid="input-ctaLink"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deeplink">Deeplink (optional, takes priority)</Label>
              <Input
                id="deeplink"
                value={config.deeplink || ''}
                onChange={(e) => setConfig({ ...config, deeplink: e.target.value })}
                placeholder="pregnancy://product/408841"
                data-testid="input-deeplink"
              />
              <p className="text-xs text-muted-foreground">For in-app navigation. Takes priority over Button Link.</p>
            </div>

            {/* Visual Customization */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">Visual Customization (Optional)</h4>
            </div>

            <div className="space-y-2">
              <Label htmlFor="titleColor">Title Color (hex)</Label>
              <Input
                id="titleColor"
                value={config.titleColor || '#FFFFFF'}
                onChange={(e) => setConfig({ ...config, titleColor: e.target.value })}
                placeholder="#FFFFFF"
                data-testid="input-titleColor"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtitleColor">Subtitle Color (hex)</Label>
              <Input
                id="subtitleColor"
                value={config.subtitleColor || '#F0F0F0'}
                onChange={(e) => setConfig({ ...config, subtitleColor: e.target.value })}
                placeholder="#F0F0F0"
                data-testid="input-subtitleColor"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="buttonBackgroundColor">Button Background Color (hex)</Label>
              <Input
                id="buttonBackgroundColor"
                value={config.buttonBackgroundColor || '#007AFF'}
                onChange={(e) => setConfig({ ...config, buttonBackgroundColor: e.target.value })}
                placeholder="#007AFF"
                data-testid="input-buttonBackgroundColor"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="buttonTextColor">Button Text Color (hex)</Label>
              <Input
                id="buttonTextColor"
                value={config.buttonTextColor || '#FFFFFF'}
                onChange={(e) => setConfig({ ...config, buttonTextColor: e.target.value })}
                placeholder="#FFFFFF"
                data-testid="input-buttonTextColor"
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
                value={config.overlayOpacity ?? 0.5}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  setConfig({ ...config, overlayOpacity: val !== undefined && !isNaN(val) ? val : 0.5 });
                }}
                data-testid="input-overlayOpacity"
              />
              <p className="text-xs text-muted-foreground">Dark overlay on background image. Default: 0.5</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backgroundColor">Background Color (rgba)</Label>
              <Input
                id="backgroundColor"
                value={config.backgroundColor || 'rgba(0, 0, 0, 0.3)'}
                onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                placeholder="rgba(0, 0, 0, 0.3)"
                data-testid="input-backgroundColor"
              />
              <p className="text-xs text-muted-foreground">Content area background with transparency</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bannerHeight">Banner Height (px)</Label>
              <Input
                id="bannerHeight"
                type="number"
                value={config.bannerHeight || 200}
                onChange={(e) => setConfig({ ...config, bannerHeight: parseInt(e.target.value) || 200 })}
                placeholder="200"
                data-testid="input-bannerHeight"
              />
              <p className="text-xs text-muted-foreground">Height in pixels. Default: 200</p>
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
