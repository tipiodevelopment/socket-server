import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ToggleLeft, ToggleRight, Pencil, Trash2, ExternalLink, Activity, Pause, Play, RefreshCw } from "lucide-react";
import { CampaignComponent, Component, Campaign } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Link } from "wouter";
import { ImageUploadWithPreview } from "@/components/ImageUploadWithPreview";
import { SponsorProductPicker } from "@/components/dashboard/SponsorProductPicker";
import { OfferBannerPreview } from "@/components/dashboard/OfferBannerPreview";
import { ProductBannerPreview } from "@/components/dashboard/ProductBannerPreview";
import { BrandColorPicker } from "@/components/dashboard/BrandColorPicker";

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
  // Operator-typed customConfig fields filled in DURING the Add dialog
  // (Sprint 2026-04-28 PM Phase 2 polish). Today wired for `offer_banner`
  // — when the operator picks an offer_banner placement we surface the
  // banner content fields inline so creation + first-edit are one
  // step. Other templates can opt in by adding their own block in the
  // Add dialog body that reads/writes this state.
  const [addExtraConfig, setAddExtraConfig] = useState<Record<string, any>>({});
  const [editingConfigFor, setEditingConfigFor] = useState<(CampaignComponent & { component: Component }) | null>(null);

  const { data: campaign } = useQuery<Campaign>({
    queryKey: ['/api/campaigns', campaignId],
  });

  const { data: campaignComponents = [], isLoading } = useQuery<Array<CampaignComponent & { component: Component }>>({
    queryKey: ['/api/campaigns', campaignId, 'components'],
  });

  // Placement picker reads from the campaign's clientApp. Each row has
  // `{id, name, locationId, component:{type,...}, deprecatedAt, ...}`.
  // Operator picks one; backend uses the FK to resolve template + slot
  // when creating the campaign_components instance.
  const clientAppId = (campaign as any)?.clientAppId as number | null | undefined;
  const { data: appPlacements = [] } = useQuery<Array<any>>({
    queryKey: clientAppId ? ['/api/client-apps', clientAppId, 'placements'] : [],
    queryFn: async () => {
      if (!clientAppId) return [];
      const res = await fetch(`/api/client-apps/${clientAppId}/placements`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!clientAppId,
  });

  // Campaign sponsors: primary + secondaries merged into one array. Returned
  // shape: { sponsorId, name, role, logoUrl, primaryColor, secondaryColor, ... }
  // per sponsor. Mandatory picker — submit is blocked until the operator picks one.
  // Both color fields are surfaced so the BrandColorPicker can offer them as
  // quick-pick swatches when the operator is configuring banner colors.
  const { data: campaignSponsors = [] } = useQuery<Array<{
    sponsorId: number;
    name: string;
    role: string;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
  }>>({
    queryKey: ['/api/campaigns', campaignId, 'sponsors'],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/sponsors`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Per-sponsor product catalog. Now lives inside <SponsorProductPicker>
  // — kept the helper variables here only because the JSX guards still
  // need them for "should we show the picker?" decisions.
  const selectedPlacement = appPlacements.find((p: any) => String(p.id) === String(selectedComponentId));
  const isProductComponent = !!selectedPlacement?.component?.type && selectedPlacement.component.type.startsWith('product_');

  const isPaused = campaign?.isPaused === 'true';

  const addComponentMutation = useMutation({
    mutationFn: async (params: {
      appPlacementId: number;
      instanceName?: string;
      sponsorId: number;
      productIds?: string[];
      /** Operator-typed customConfig keys from the Add dialog (e.g.
       *  offer_banner title / countdown / CTA / deeplink). Merged
       *  with the picker-derived productId/productIds so creation +
       *  customization happen in a single dialog. */
      extraCustomConfig?: Record<string, unknown>;
    }) => {
      // Customize config shape per template type.
      //
      //   product_spotlight  → single `productId: string`     (1 hero product)
      //   product_carousel,
      //   product_banner,
      //   product_store,
      //   product_slider     → array `productIds: string[]`   (N products)
      //
      // The dashboard product picker is multi-select today, so for
      // single-product templates (spotlight) we pick the FIRST id and
      // drop the array semantics. Mismatched shapes silently break the
      // SDK decoder (Component renders empty), so guarding here.
      // product_spotlight + product_banner both decode `productId: String`
      // (singular). Carousel/store/slider take `productIds: string[]`.
      const SINGLE_PRODUCT_TEMPLATES = new Set(['product_spotlight', 'product_banner']);
      const targetPlacement = appPlacements.find((p: any) => p.id === params.appPlacementId);
      const templateType = targetPlacement?.component?.type as string | undefined;
      const isSingleProductTemplate = templateType ? SINGLE_PRODUCT_TEMPLATES.has(templateType) : false;

      // Start from operator-typed extras, then layer the product
      // selection on top so picker changes always win.
      const customConfig: Record<string, unknown> = { ...(params.extraCustomConfig ?? {}) };
      if (params.productIds && params.productIds.length > 0) {
        if (isSingleProductTemplate) {
          customConfig.productId = params.productIds[0];
        } else {
          customConfig.productIds = params.productIds;
        }
      }
      const finalCustomConfig = Object.keys(customConfig).length > 0 ? customConfig : undefined;

      return await apiRequest('POST', `/api/campaigns/${campaignId}/components`, {
        appPlacementId: params.appPlacementId,
        instanceName: params.instanceName || undefined,
        sponsorId: params.sponsorId,
        customConfig: finalCustomConfig,
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
      setAddExtraConfig({});
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

  // Sprint 2026-04-28 PM (Phase 5): explicit pause / activate verbs that
  // hit the new outbox-backed endpoints. The mutations replace the
  // toggle-button UX so the operator sees the right verb per state and
  // multi-sponsor swap is handled implicitly by /activate (the backend
  // atomically deactivates whichever row currently holds the slot).
  const pauseComponentMutation = useMutation({
    mutationFn: async (componentId: string) => {
      return await apiRequest('POST', `/api/campaigns/${campaignId}/components/${componentId}/pause`, {});
    },
    onSuccess: async () => {
      toast({
        title: 'Pausado en vivo',
        description: 'El componente desaparece del SDK en <1s.',
      });
      await queryClient.invalidateQueries({
        queryKey: ['/api/campaigns', campaignId, 'components'],
        refetchType: 'active',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al pausar',
        description: error?.message || 'No se pudo pausar el placement.',
        variant: 'destructive',
      });
    },
  });

  const activateComponentMutation = useMutation({
    mutationFn: async ({ appPlacementId, campaignComponentId }: { appPlacementId: number; campaignComponentId: number }) => {
      return await apiRequest(
        'POST',
        `/api/campaigns/${campaignId}/placements/${appPlacementId}/activate`,
        { campaignComponentId },
      );
    },
    onSuccess: async (_data, variables) => {
      const meta = (_data as any)?._meta;
      toast({
        title: meta?.swap ? 'Sponsor cambiado en vivo' : 'Activado en vivo',
        description: meta?.swap
          ? 'El SDK reemplaza el sponsor anterior y carga el nuevo catálogo.'
          : 'El componente aparece en el SDK en <1s.',
      });
      await queryClient.invalidateQueries({
        queryKey: ['/api/campaigns', campaignId, 'components'],
        refetchType: 'active',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al activar',
        description: error?.message || 'No se pudo activar el placement.',
        variant: 'destructive',
      });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async ({
      componentId,
      customConfig,
      sponsorId,
    }: {
      componentId: string;
      customConfig: any;
      sponsorId?: number;
    }) => {
      // Body is forwarded as-is; backend treats sponsorId as optional
      // and only validates / updates when provided. Customize dialog
      // sends it when the operator picks a different sponsor on an
      // existing binding (in-place sponsor swap, no row recreation).
      return await apiRequest('PATCH', `/api/campaigns/${campaignId}/components/${componentId}/config`, {
        customConfig,
        ...(sponsorId !== undefined ? { sponsorId } : {}),
      });
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

  // Active (non-deprecated) named placements available to bind in this
  // campaign. Empty when the operator hasn't created any from /apps/:id
  // — the dashboard surfaces an empty state with a hint to go set them up.
  const availablePlacements = appPlacements.filter((p: any) => !p.deprecatedAt);

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
                  <DialogTitle>Add placement to campaign</DialogTitle>
                  <DialogDescription>
                    Pick one of the app's named placements + a sponsor + (for product placements) products.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {availablePlacements.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>No placements available for this app.</p>
                      <p className="text-sm mt-2">
                        Go to the app detail page (<code className="text-gray-400">/apps/{clientAppId}</code>)
                        and use "Add from library" to declare placements first.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Placement</Label>
                        <Select value={selectedComponentId} onValueChange={setSelectedComponentId}>
                          <SelectTrigger data-testid="select-component">
                            <SelectValue placeholder="Choose a placement..." />
                          </SelectTrigger>
                          <SelectContent>
                            {availablePlacements.map((pl: any) => (
                              <SelectItem key={pl.id} value={String(pl.id)}>
                                {pl.name} <span className="text-muted-foreground">({getComponentTypeLabel(pl.component?.type ?? 'unknown')} · {pl.locationId})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="instance-name">Instance label (Optional)</Label>
                        <Input
                          id="instance-name"
                          placeholder="e.g. Carrusel home — XXL drop"
                          value={instanceName}
                          onChange={(e) => setInstanceName(e.target.value)}
                          data-testid="input-instance-name"
                        />
                        <p className="text-xs text-muted-foreground">
                          Optional override of the placement's name for this campaign run (e.g. for dashboard reporting). Auto-generated if blank.
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
                          Single-select for product_spotlight, multi-select for
                          carousel/banner/store/slider. Stored as customConfig.productIds
                          (or productId for spotlight, normalized in addComponentMutation). */}
                      {isProductComponent && selectedSponsorId && (() => {
                        const tmpl = selectedPlacement?.component?.type as string | undefined;
                        const mode: "single" | "multi" = tmpl === "product_spotlight" ? "single" : "multi";
                        const sponsorName = campaignSponsors.find(s => String(s.sponsorId) === selectedSponsorId)?.name;
                        return (
                          <SponsorProductPicker
                            sponsorId={selectedSponsorId}
                            sponsorName={sponsorName}
                            mode={mode}
                            selectedIds={selectedProductIds}
                            onChange={setSelectedProductIds}
                          />
                        );
                      })()}

                      {/* Inline content fields for offer_banner — operator
                          fills the banner content during creation so they
                          don't have to click pencil afterward to customize.
                          Sprint 2026-04-28 PM Phase 2. Other templates
                          stay on the Add → Customize flow until extracted
                          into a shared component. */}
                      {selectedSponsorId && selectedPlacement?.component?.type === 'offer_banner' && (
                        <div className="space-y-4 pt-4 border-t">
                          <h4 className="text-sm font-semibold">Banner content</h4>

                          <div className="space-y-2">
                            <Label htmlFor="add-ob-title">Title <span className="text-red-400">*</span></Label>
                            <Input
                              id="add-ob-title"
                              placeholder="Ukens tilbud"
                              value={addExtraConfig.title || ''}
                              onChange={(e) => setAddExtraConfig({ ...addExtraConfig, title: e.target.value })}
                              data-testid="input-add-ob-title"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="add-ob-subtitle">Subtitle</Label>
                            <Input
                              id="add-ob-subtitle"
                              placeholder="Se denne ukes beste tilbud"
                              value={addExtraConfig.subtitle || ''}
                              onChange={(e) => setAddExtraConfig({ ...addExtraConfig, subtitle: e.target.value || undefined })}
                              data-testid="input-add-ob-subtitle"
                            />
                          </div>

                          <ImageUploadWithPreview
                            label="Background image"
                            value={addExtraConfig.backgroundImageUrl || ''}
                            onChange={(url) => setAddExtraConfig({ ...addExtraConfig, backgroundImageUrl: url || undefined })}
                            placeholder="Soccer pitch / promo bg"
                            testId="input-add-ob-bg"
                          />

                          <div className="space-y-2">
                            <Label htmlFor="add-ob-countdown">Countdown end date <span className="text-red-400">*</span></Label>
                            <Input
                              id="add-ob-countdown"
                              type="datetime-local"
                              value={addExtraConfig.countdownEndDate ? (() => {
                                const d = new Date(addExtraConfig.countdownEndDate);
                                const offset = d.getTimezoneOffset();
                                return new Date(d.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
                              })() : ''}
                              onChange={(e) => setAddExtraConfig({
                                ...addExtraConfig,
                                countdownEndDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                              })}
                              data-testid="input-add-ob-countdown"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="add-ob-badge">Discount badge text <span className="text-red-400">*</span></Label>
                            <Input
                              id="add-ob-badge"
                              placeholder="Opp til 30%"
                              value={addExtraConfig.discountBadgeText || ''}
                              onChange={(e) => setAddExtraConfig({ ...addExtraConfig, discountBadgeText: e.target.value })}
                              data-testid="input-add-ob-badge"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="add-ob-cta">CTA text <span className="text-red-400">*</span></Label>
                            <Input
                              id="add-ob-cta"
                              placeholder="Se alle tilbud →"
                              value={addExtraConfig.ctaText || ''}
                              onChange={(e) => setAddExtraConfig({ ...addExtraConfig, ctaText: e.target.value })}
                              data-testid="input-add-ob-cta"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="add-ob-deeplink">Deeplink URL (optional)</Label>
                            <Input
                              id="add-ob-deeplink"
                              placeholder="tv2://offers/special — leave empty to use sponsor.logoUrl callback"
                              value={addExtraConfig.deeplinkUrl || ''}
                              onChange={(e) => setAddExtraConfig({ ...addExtraConfig, deeplinkUrl: e.target.value || undefined })}
                              data-testid="input-add-ob-deeplink"
                            />
                            <p className="text-xs text-muted-foreground">
                              Logo not shown — auto-resolved from the sponsor's <code>logoUrl</code> at runtime.
                              Add a custom override later from the Customize dialog if needed.
                            </p>
                          </div>

                          {/* Brand-aware color pickers. Each surfaces
                              the selected sponsor's primary +
                              secondary color as one-click swatches so
                              the operator can lock the banner to the
                              sponsor's branding without hand-typing
                              hex. Empty = SDK fallback. */}
                          {(() => {
                            const sponsor = campaignSponsors.find(s => String(s.sponsorId) === selectedSponsorId);
                            return (
                              <>
                                <BrandColorPicker
                                  label="Button color (CTA)"
                                  value={addExtraConfig.buttonColor}
                                  onChange={(next) => setAddExtraConfig({ ...addExtraConfig, buttonColor: next })}
                                  sponsorPrimaryColor={sponsor?.primaryColor}
                                  sponsorSecondaryColor={sponsor?.secondaryColor}
                                  sponsorName={sponsor?.name}
                                  emptyPlaceholder="#FF6B6B"
                                  helperText="Click a sponsor swatch to brand the CTA, or leave unset for SDK default."
                                  testId="picker-add-ob-buttonColor"
                                />
                                <BrandColorPicker
                                  label="Background color (image fallback)"
                                  value={addExtraConfig.backgroundColor}
                                  onChange={(next) => setAddExtraConfig({ ...addExtraConfig, backgroundColor: next })}
                                  sponsorPrimaryColor={sponsor?.primaryColor}
                                  sponsorSecondaryColor={sponsor?.secondaryColor}
                                  sponsorName={sponsor?.name}
                                  emptyPlaceholder="#1a1a1a"
                                  helperText="Used when there's no background image, or while it's loading."
                                  testId="picker-add-ob-backgroundColor"
                                />
                              </>
                            );
                          })()}

                          {/* Live preview — updates as the operator types
                              so they see the banner before saving. Uses
                              the selected sponsor's logoUrl as fallback
                              when addExtraConfig.logoUrl is empty (mirrors
                              VOfferBanner's resolvedLogoUrl logic on iOS). */}
                          {(() => {
                            const sponsor = campaignSponsors.find(s => String(s.sponsorId) === selectedSponsorId);
                            return (
                              <OfferBannerPreview
                                config={addExtraConfig}
                                sponsorLogoUrl={sponsor?.logoUrl ?? null}
                                sponsorPrimaryColor={sponsor?.primaryColor ?? null}
                                sponsorSecondaryColor={sponsor?.secondaryColor ?? null}
                              />
                            );
                          })()}
                        </div>
                      )}

                      {/* Inline content fields for product_banner. Same
                          pattern as the offer_banner block above —
                          operator fills banner content + colors + layout
                          during creation so they don't have to click
                          pencil afterward. Required: title, ctaText.
                          Optional: subtitle / image / ctaLink / deeplink
                          / colors / layout. Sprint 2026-04-28 PM Phase 2
                          step A.3. */}
                      {selectedSponsorId && selectedPlacement?.component?.type === 'product_banner' && (
                        <div className="space-y-4 pt-4 border-t">
                          <h4 className="text-sm font-semibold">Banner content</h4>

                          <div className="space-y-2">
                            <Label htmlFor="add-pb-layout">Layout</Label>
                            <Select
                              value={addExtraConfig.layout || 'standard'}
                              onValueChange={(value) =>
                                setAddExtraConfig({ ...addExtraConfig, layout: value === 'standard' ? undefined : value })
                              }
                            >
                              <SelectTrigger data-testid="select-add-pb-layout">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="compact">Compact (120pt — small inline)</SelectItem>
                                <SelectItem value="standard">Standard (200pt — default)</SelectItem>
                                <SelectItem value="large">Large (280pt — hero)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="add-pb-title">Title</Label>
                            <Input
                              id="add-pb-title"
                              placeholder="Producto destacado"
                              value={addExtraConfig.title || ''}
                              onChange={(e) => setAddExtraConfig({ ...addExtraConfig, title: e.target.value || undefined })}
                              data-testid="input-add-pb-title"
                            />
                            <p className="text-xs text-muted-foreground">Editorial heading on the banner image. Empty → product name fallback.</p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="add-pb-subtitle">Subtitle (optional)</Label>
                            <Input
                              id="add-pb-subtitle"
                              placeholder="40% OFF"
                              value={addExtraConfig.subtitle || ''}
                              onChange={(e) => setAddExtraConfig({ ...addExtraConfig, subtitle: e.target.value || undefined })}
                              data-testid="input-add-pb-subtitle"
                            />
                          </div>

                          <ImageUploadWithPreview
                            label="Background image"
                            value={addExtraConfig.backgroundImageUrl || ''}
                            onChange={(url) => setAddExtraConfig({ ...addExtraConfig, backgroundImageUrl: url || undefined })}
                            placeholder="/objects/uploads/... or https://..."
                            testId="input-add-pb-bg"
                          />

                          <div className="space-y-2">
                            <Label htmlFor="add-pb-cta">CTA button text <span className="text-red-400">*</span></Label>
                            <Input
                              id="add-pb-cta"
                              placeholder="Ver producto"
                              value={addExtraConfig.ctaText || ''}
                              onChange={(e) => setAddExtraConfig({ ...addExtraConfig, ctaText: e.target.value })}
                              data-testid="input-add-pb-cta"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="add-pb-deeplink">Deeplink URL (optional)</Label>
                            <Input
                              id="add-pb-deeplink"
                              placeholder="tv2://product/408895"
                              value={addExtraConfig.deeplink || ''}
                              onChange={(e) => setAddExtraConfig({ ...addExtraConfig, deeplink: e.target.value || undefined })}
                              data-testid="input-add-pb-deeplink"
                            />
                            <p className="text-xs text-muted-foreground">In-app routing. Falls back to <code>ctaLink</code> if empty.</p>
                          </div>

                          {/* Brand color pickers — sponsor swatches */}
                          {(() => {
                            const sponsor = campaignSponsors.find(s => String(s.sponsorId) === selectedSponsorId);
                            return (
                              <>
                                <BrandColorPicker
                                  label="Title color"
                                  value={addExtraConfig.titleColor}
                                  onChange={(next) => setAddExtraConfig({ ...addExtraConfig, titleColor: next })}
                                  sponsorPrimaryColor={sponsor?.primaryColor}
                                  sponsorSecondaryColor={sponsor?.secondaryColor}
                                  sponsorName={sponsor?.name}
                                  emptyPlaceholder="#FFFFFF"
                                  testId="picker-add-pb-titleColor"
                                />
                                <BrandColorPicker
                                  label="Button background"
                                  value={addExtraConfig.buttonBackgroundColor}
                                  onChange={(next) => setAddExtraConfig({ ...addExtraConfig, buttonBackgroundColor: next })}
                                  sponsorPrimaryColor={sponsor?.primaryColor}
                                  sponsorSecondaryColor={sponsor?.secondaryColor}
                                  sponsorName={sponsor?.name}
                                  emptyPlaceholder="#007AFF"
                                  helperText="Click a sponsor swatch to brand the CTA."
                                  testId="picker-add-pb-buttonBgColor"
                                />
                              </>
                            );
                          })()}

                          {/* Live preview — same component as the
                              Customize dialog, mirrors VProductBanner. */}
                          {(() => {
                            const sponsor = campaignSponsors.find(s => String(s.sponsorId) === selectedSponsorId);
                            return (
                              <ProductBannerPreview
                                config={addExtraConfig}
                                sponsorLogoUrl={sponsor?.logoUrl ?? null}
                                sponsorPrimaryColor={sponsor?.primaryColor ?? null}
                              />
                            );
                          })()}
                        </div>
                      )}

                      <Button
                        onClick={() => {
                          if (!selectedComponentId || !selectedSponsorId) return;
                          // Offer-banner basic validation: required fields
                          // must have something so the SDK doesn't render
                          // an empty banner. Other templates skip this
                          // until they get inline forms too.
                          if (selectedPlacement?.component?.type === 'offer_banner') {
                            const required = ['title', 'countdownEndDate', 'discountBadgeText', 'ctaText'];
                            const missing = required.filter(k => !addExtraConfig[k]);
                            if (missing.length > 0) {
                              toast({
                                title: 'Missing required banner fields',
                                description: `Fill: ${missing.join(', ')}`,
                                variant: 'destructive',
                              });
                              return;
                            }
                          }
                          // product_banner basic validation — must have
                          // ctaText so the button renders. title is
                          // optional (falls back to product name on SDK
                          // side).
                          if (selectedPlacement?.component?.type === 'product_banner') {
                            if (!addExtraConfig.ctaText) {
                              toast({
                                title: 'Missing CTA button text',
                                description: 'Fill `ctaText` so the banner button has a label.',
                                variant: 'destructive',
                              });
                              return;
                            }
                          }
                          addComponentMutation.mutate({
                            appPlacementId: parseInt(selectedComponentId, 10),
                            instanceName: instanceName.trim() || undefined,
                            sponsorId: parseInt(selectedSponsorId, 10),
                            productIds: Array.from(selectedProductIds),
                            extraCustomConfig:
                              Object.keys(addExtraConfig).length > 0 ? addExtraConfig : undefined,
                          });
                        }}
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
                        return <div key="component-id" className="font-mono text-xs">ID: {(cc as any).componentId}</div>;
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
                    {/*
                      Sprint 2026-04-28 PM (Phase 5): explicit Pausar /
                      Hacer activo verbs replace the legacy toggle.

                      - Active row → "Pausar" calls POST /pause →
                        SDK hides the placement in <1s.
                      - Inactive row → "Hacer activo" calls POST
                        /placements/:appPlacementId/activate, which on
                        the backend atomically deactivates whichever
                        row currently holds the slot (multi-sponsor
                        rotation) and emits a single
                        placement_activation_swapped event so the SDK
                        cleanly replaces the old sponsor with the new
                        one (logo + title + catalog).
                      - When >1 row exists for the same appPlacement,
                        a small "→ reemplaza a Sponsor X" hint shows
                        below the inactive row so the operator knows
                        a swap is about to happen.
                    */}
                    {cc.status === 'active' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => pauseComponentMutation.mutate(String(cc.id))}
                        disabled={pauseComponentMutation.isPending || isPaused}
                        title={isPaused ? 'Campaign is paused — resume to toggle components' : 'Pausar (desaparece del SDK en vivo)'}
                        data-testid={`button-pause-${cc.id}`}
                      >
                        <Pause className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          activateComponentMutation.mutate({
                            appPlacementId: Number((cc as any).appPlacementId),
                            campaignComponentId: Number(cc.id),
                          })
                        }
                        disabled={activateComponentMutation.isPending || isPaused}
                        title={(() => {
                          if (isPaused) return 'Campaign is paused — resume to toggle components';
                          const otherActive = campaignComponents.find(
                            (other: any) =>
                              other.id !== cc.id &&
                              other.appPlacementId === (cc as any).appPlacementId &&
                              other.status === 'active',
                          ) as any;
                          if (otherActive) {
                            const otherSponsorName =
                              campaignSponsors.find(s => s.sponsorId === otherActive.sponsorId)?.name
                              ?? `sponsor ${otherActive.sponsorId}`;
                            return `Hacer activo (reemplaza a ${otherSponsorName} en vivo)`;
                          }
                          return 'Hacer activo (aparece en el SDK en vivo)';
                        })()}
                        data-testid={`button-activate-${cc.id}`}
                      >
                        {(() => {
                          const otherActive = campaignComponents.find(
                            (other: any) =>
                              other.id !== cc.id &&
                              other.appPlacementId === (cc as any).appPlacementId &&
                              other.status === 'active',
                          );
                          return otherActive
                            ? <RefreshCw className="w-4 h-4" />
                            : <Play className="w-4 h-4" />;
                        })()}
                      </Button>
                    )}
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
              campaignSponsors={campaignSponsors}
              onSubmit={(customConfig, sponsorId) =>
                updateConfigMutation.mutate({
                  componentId: String(editingConfigFor.id),
                  customConfig,
                  sponsorId,
                })
              }
              onRevertToDefault={() => {
                updateConfigMutation.mutate({
                  componentId: String(editingConfigFor.id),
                  customConfig: null,
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
  /** Allowed sponsors for this campaign (primary + secondaries). The
   *  customize dialog renders a select so the operator can swap the
   *  binding's sponsor in place without first pausing the row. */
  campaignSponsors: Array<{
    sponsorId: number;
    name: string;
    role: string;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
  }>;
  onSubmit: (customConfig: any, sponsorId?: number) => void;
  onRevertToDefault: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

export function CampaignComponentConfigForm({
  campaignComponent,
  campaignSponsors,
  onSubmit,
  onRevertToDefault,
  onCancel,
  isLoading,
}: CampaignComponentConfigFormProps) {
  const currentConfig = (campaignComponent.customConfig || campaignComponent.component.config) as any;
  const [config, setConfig] = useState(currentConfig || {});

  // Sponsor swap state. Defaults to the row's current sponsor; when
  // the operator picks a different one and saves, the dialog
  // forwards it through onSubmit so the parent's PATCH includes
  // `sponsorId` in the body. Backend validates against
  // campaign_sponsors and emits placement_config_updated atomically.
  const initialSponsorId = (campaignComponent as any).sponsorId
    ? Number((campaignComponent as any).sponsorId)
    : undefined;
  const [selectedSponsorId, setSelectedSponsorId] = useState<string>(
    initialSponsorId !== undefined ? String(initialSponsorId) : ''
  );

  // Product picker state for product_* templates. Mode (single vs multi)
  // is derived from the template type:
  //   product_spotlight                                    → single
  //   product_carousel | product_banner | _store | _slider → multi
  // Initialized from the current customConfig (productId for single,
  // productIds[] for multi). On submit we serialize back to whichever
  // shape the template expects so the SDK decoder doesn't break.
  const componentType = campaignComponent.component.type;
  const isProductTemplate = componentType.startsWith('product_');
  // product_spotlight + product_banner both decode `productId: String`
  // (singular). Other product_* templates use `productIds: string[]`.
  const isSingleProduct = componentType === 'product_spotlight' || componentType === 'product_banner';
  const initialProductIds: Set<string> = (() => {
    if (!isProductTemplate) return new Set();
    if (isSingleProduct) {
      const pid = (currentConfig as any)?.productId;
      return pid ? new Set([String(pid)]) : new Set();
    }
    const pids = (currentConfig as any)?.productIds;
    return Array.isArray(pids) ? new Set(pids.map(String)) : new Set();
  })();
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(initialProductIds);

  // When the operator swaps sponsor, clear the product picker so the
  // catalog list reflects the new sponsor's products. Keeps the
  // operator from accidentally writing a product id from sponsor A's
  // catalog onto a row owned by sponsor B (where it wouldn't exist).
  const handleSponsorChange = (next: string) => {
    if (next !== selectedSponsorId) {
      setSelectedProductIds(new Set());
    }
    setSelectedSponsorId(next);
  };

  const sponsorName = campaignSponsors.find(s => String(s.sponsorId) === selectedSponsorId)?.name;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedSponsor = selectedSponsorId ? parseInt(selectedSponsorId, 10) : undefined;
    const sponsorChanged = parsedSponsor !== undefined && parsedSponsor !== initialSponsorId;

    // Marry the picker's selection back into config under the field
    // shape expected by the template. Empty selection clears the
    // field so the SDK falls back to template defaults rather than
    // sending an empty array (carousel SDK treats empty array as
    // "load all channel products").
    let outConfig: any = { ...config };
    if (isProductTemplate) {
      const ids = Array.from(selectedProductIds);
      if (isSingleProduct) {
        outConfig.productId = ids[0] || undefined;
        delete outConfig.productIds;
      } else {
        outConfig.productIds = ids.length > 0 ? ids : undefined;
        delete outConfig.productId;
      }
    }
    onSubmit(outConfig, sponsorChanged ? parsedSponsor : undefined);
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
            {/* Product picker (multi-select) — replaces the legacy
                comma-separated productIds text input. Catalog comes
                from the currently-selected sponsor in the form. When
                the operator swaps sponsor, the picker resets so the
                operator picks fresh from the new sponsor's catalog. */}
            <SponsorProductPicker
              sponsorId={selectedSponsorId}
              sponsorName={sponsorName}
              mode="multi"
              selectedIds={selectedProductIds}
              onChange={setSelectedProductIds}
              helperText={
                selectedProductIds.size === 0
                  ? "No products selected — carousel will show all products from the sponsor's channel."
                  : `${selectedProductIds.size} product${selectedProductIds.size > 1 ? 's' : ''} selected.`
              }
            />
            <p className="text-xs text-muted-foreground">
              The carousel renders these in order. Leave empty to fetch all of the sponsor's channel.
            </p>

            {/* Header section opt-ins. Both default off — when off, the
                carousel renders without a header band (legacy behavior).
                Operator turns them on per-placement so the same template
                can serve "Ukens tilbud", "Featured", or no-header variants. */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">Header (optional)</h4>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value || undefined })}
                placeholder="e.g. Ukens tilbud — leave empty to hide header"
                data-testid="input-carousel-title"
              />
              <p className="text-xs text-muted-foreground">Renders above the carousel. Empty → no header.</p>
            </div>
            <div className="space-y-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="showSponsorLogo"
                checked={config.showSponsorLogo === true}
                onChange={(e) => setConfig({ ...config, showSponsorLogo: e.target.checked || undefined })}
                data-testid="checkbox-showSponsorLogo"
                className="rounded"
              />
              <Label htmlFor="showSponsorLogo">Show sponsor logo in header</Label>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">Auto-play (optional)</h4>
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
              label="Logo URL (optional — leave empty to use the sponsor logo)"
              value={config.logoUrl || ''}
              onChange={(url) => setConfig({ ...config, logoUrl: url || undefined })}
              placeholder="Leave empty to use sponsor.logoUrl, or paste a custom URL"
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

            {/* Color pickers — operator can either use the native
                browser color picker, or one-click pick the selected
                sponsor's primary/secondary brand color (sourced from
                sponsors.primary_color / secondary_color). Empty
                value = SDK fallback. Sprint 2026-04-28 PM Phase 2. */}
            {(() => {
              const sponsor = campaignSponsors.find(s => String(s.sponsorId) === selectedSponsorId);
              return (
                <>
                  <BrandColorPicker
                    label="Background color"
                    value={config.backgroundColor}
                    onChange={(next) => setConfig({ ...config, backgroundColor: next })}
                    sponsorPrimaryColor={sponsor?.primaryColor}
                    sponsorSecondaryColor={sponsor?.secondaryColor}
                    sponsorName={sponsor?.name}
                    emptyPlaceholder="#FF6F61"
                    helperText="Fallback when the background image fails to load. Click a sponsor swatch to brand it."
                    testId="picker-backgroundColor"
                  />
                  <BrandColorPicker
                    label="Button color (CTA)"
                    value={config.buttonColor}
                    onChange={(next) => setConfig({ ...config, buttonColor: next })}
                    sponsorPrimaryColor={sponsor?.primaryColor}
                    sponsorSecondaryColor={sponsor?.secondaryColor}
                    sponsorName={sponsor?.name}
                    emptyPlaceholder="#FF6B6B"
                    helperText="CTA button background. Leave unset → SDK uses the brand primary color."
                    testId="picker-buttonColor"
                  />
                </>
              );
            })()}

            {/* Deeplink section — Path A3 hybrid resolution (host
                callback > operator-set deeplinkUrl > ctaLink external). */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">Deeplink (optional, in-app navigation)</h4>
              <p className="text-xs text-muted-foreground mb-3">
                When the user taps the CTA, the SDK first asks the host app's
                callback (if any). If the host doesn't intercept, the SDK opens
                <code className="px-1">deeplinkUrl</code> via <code>UIApplication.shared.open</code>;
                if that's also empty, it falls back to <code>ctaLink</code> as a regular URL.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deeplinkUrl">Deeplink URL</Label>
              <Input
                id="deeplinkUrl"
                value={config.deeplinkUrl || ''}
                onChange={(e) => setConfig({ ...config, deeplinkUrl: e.target.value || undefined })}
                placeholder="tv2://offers/special  or  https://xxlsports.no/offers"
                data-testid="input-deeplinkUrl"
              />
              <p className="text-xs text-muted-foreground">
                Custom URL scheme for in-app routing or any URL the SDK should open externally.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deeplinkAction">Deeplink Action (semantic tag)</Label>
              <Input
                id="deeplinkAction"
                value={config.deeplinkAction || ''}
                onChange={(e) => setConfig({ ...config, deeplinkAction: e.target.value || undefined })}
                placeholder="navigate_to_offers"
                data-testid="input-deeplinkAction"
              />
              <p className="text-xs text-muted-foreground">
                Free-form tag the host-app callback can switch on (e.g. <code>navigate_to_offers</code>).
                Use when you want in-app routing without URL parsing.
              </p>
            </div>
          </>
        );

      case 'product_spotlight':
        return (
          <>
            {/* Product picker (single-select) — replaces the legacy
                free-text productId input. Catalog scoped to the
                currently-selected sponsor in the form. */}
            <SponsorProductPicker
              sponsorId={selectedSponsorId}
              sponsorName={sponsorName}
              mode="single"
              selectedIds={selectedProductIds}
              onChange={setSelectedProductIds}
              label={`Featured product ${sponsorName ? `from ${sponsorName}` : ''}`}
              helperText={
                selectedProductIds.size === 0
                  ? "Pick a product — the spotlight needs exactly one."
                  : `Selected: ${Array.from(selectedProductIds)[0]}`
              }
            />
            <div className="space-y-2">
              <Label htmlFor="highlightText">Highlight Text (Optional)</Label>
              <Input
                id="highlightText"
                value={config.highlightText || ''}
                onChange={(e) => setConfig({ ...config, highlightText: e.target.value })}
                placeholder="e.g., Featured Product"
                data-testid="input-highlightText"
              />
              <p className="text-xs text-muted-foreground">Capsule badge above the product card (hero variant only).</p>
            </div>

            {/* Layout — operator picks visual variant. Default `hero`
                (legacy big card). `list` is the compact horizontal
                version (image left, info right). `minimal` is the
                smallest. `grid` is vertical compact. Maps onto
                VProductCard.Variant on the SDK side. */}
            <div className="space-y-2">
              <Label htmlFor="layout">Layout</Label>
              <Select
                value={config.layout || 'hero'}
                onValueChange={(value) =>
                  setConfig({ ...config, layout: value === 'hero' ? undefined : value })
                }
              >
                <SelectTrigger data-testid="select-spotlight-layout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hero">Hero (large featured card — default)</SelectItem>
                  <SelectItem value="list">List (horizontal compact)</SelectItem>
                  <SelectItem value="minimal">Minimal (small)</SelectItem>
                  <SelectItem value="grid">Grid (vertical compact)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Controls how the SDK renders the spotlight card.
              </p>
            </div>

            {/* Header section opt-ins. Same opt-in pattern as the
                carousel — both default off. When off, the spotlight
                renders without a header band (legacy layout
                preserved). Operator turns them on per-placement. */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">Header (optional)</h4>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value || undefined })}
                placeholder="e.g. Producto destacado — leave empty to hide header"
                data-testid="input-spotlight-title"
              />
              <p className="text-xs text-muted-foreground">Renders above the product card. Empty → no header.</p>
            </div>
            <div className="space-y-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="spotlight-showSponsorLogo"
                checked={config.showSponsorLogo === true}
                onChange={(e) => setConfig({ ...config, showSponsorLogo: e.target.checked || undefined })}
                data-testid="checkbox-spotlight-showSponsorLogo"
                className="rounded"
              />
              <Label htmlFor="spotlight-showSponsorLogo">Show sponsor logo in header</Label>
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
            {/* Layout preset — single-pick UX shortcut that adjusts
                banner height + font sizes. Granular fields below
                still win when the operator wants pixel-perfect
                control. Sprint 2026-04-28 PM Phase 2. */}
            <div className="space-y-2">
              <Label htmlFor="banner-layout">Layout</Label>
              <Select
                value={config.layout || 'standard'}
                onValueChange={(value) =>
                  setConfig({ ...config, layout: value === 'standard' ? undefined : value })
                }
              >
                <SelectTrigger data-testid="select-banner-layout">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compact (120pt — small inline banner)</SelectItem>
                  <SelectItem value="standard">Standard (200pt — default)</SelectItem>
                  <SelectItem value="large">Large (280pt — hero-style)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Sets banner height + font sizes in one pick. Granular fields below override.
              </p>
            </div>

            {/* Required Fields — product picker (single, scoped to
                the form's selected sponsor). Title is editorial copy
                rendered ON the banner image (not the placement
                header), so it stays a free-text input below. */}
            <SponsorProductPicker
              sponsorId={selectedSponsorId}
              sponsorName={sponsorName}
              mode="single"
              selectedIds={selectedProductIds}
              onChange={setSelectedProductIds}
              label={`Product ${sponsorName ? `from ${sponsorName}` : ''}`}
              helperText={
                selectedProductIds.size === 0
                  ? "Pick the product the banner taps into."
                  : `Selected: ${Array.from(selectedProductIds)[0]}`
              }
            />

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
              <p className="text-xs text-muted-foreground">Editorial heading rendered on the banner image. Leave empty to use product name.</p>
            </div>

            {/* Sponsor logo overlay opt-in. Banner already has its
                own visible title/subtitle, so the polish skips the
                separate header strip pattern (Carousel/Spotlight)
                and only stamps the placement's sponsor logo onto
                the banner top-right corner. */}
            <div className="space-y-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="banner-showSponsorLogo"
                checked={config.showSponsorLogo === true}
                onChange={(e) => setConfig({ ...config, showSponsorLogo: e.target.checked || undefined })}
                data-testid="checkbox-banner-showSponsorLogo"
                className="rounded"
              />
              <Label htmlFor="banner-showSponsorLogo">Stamp sponsor logo on banner (top-right)</Label>
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

            {/* Brand-aware color pickers — same component as the
                offer_banner forms. Each surfaces the selected
                sponsor's primary + secondary brand color as one-click
                swatches so the operator can match the banner to the
                sponsor's identity without typing hex. Empty = SDK
                fallback. Sprint 2026-04-28 PM Phase 2 step A.2. */}
            {(() => {
              const sponsor = campaignSponsors.find(s => String(s.sponsorId) === selectedSponsorId);
              return (
                <>
                  <BrandColorPicker
                    label="Title color"
                    value={config.titleColor}
                    onChange={(next) => setConfig({ ...config, titleColor: next })}
                    sponsorPrimaryColor={sponsor?.primaryColor}
                    sponsorSecondaryColor={sponsor?.secondaryColor}
                    sponsorName={sponsor?.name}
                    emptyPlaceholder="#FFFFFF"
                    helperText="Banner title text color. Empty → adaptive system text color."
                    testId="picker-pb-titleColor"
                  />
                  <BrandColorPicker
                    label="Subtitle color"
                    value={config.subtitleColor}
                    onChange={(next) => setConfig({ ...config, subtitleColor: next })}
                    sponsorPrimaryColor={sponsor?.primaryColor}
                    sponsorSecondaryColor={sponsor?.secondaryColor}
                    sponsorName={sponsor?.name}
                    emptyPlaceholder="#F0F0F0"
                    testId="picker-pb-subtitleColor"
                  />
                  <BrandColorPicker
                    label="Button background"
                    value={config.buttonBackgroundColor}
                    onChange={(next) => setConfig({ ...config, buttonBackgroundColor: next })}
                    sponsorPrimaryColor={sponsor?.primaryColor}
                    sponsorSecondaryColor={sponsor?.secondaryColor}
                    sponsorName={sponsor?.name}
                    emptyPlaceholder="#007AFF"
                    helperText="CTA button background. Click a sponsor swatch to brand it."
                    testId="picker-pb-buttonBgColor"
                  />
                  <BrandColorPicker
                    label="Button text color"
                    value={config.buttonTextColor}
                    onChange={(next) => setConfig({ ...config, buttonTextColor: next })}
                    sponsorPrimaryColor={sponsor?.primaryColor}
                    sponsorSecondaryColor={sponsor?.secondaryColor}
                    sponsorName={sponsor?.name}
                    emptyPlaceholder="#FFFFFF"
                    testId="picker-pb-buttonTextColor"
                  />
                </>
              );
            })()}

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

            {/* Background color — picker too. Banner accepts both hex
                and rgba(); the picker writes hex by default, operators
                that need transparent backgrounds can override via the
                advanced edit (or we extend BrandColorPicker with rgba
                support in a follow-up). For now, picker = hex; SDK
                still parses rgba() strings server-side. */}
            {(() => {
              const sponsor = campaignSponsors.find(s => String(s.sponsorId) === selectedSponsorId);
              return (
                <BrandColorPicker
                  label="Background color (content overlay)"
                  value={config.backgroundColor}
                  onChange={(next) => setConfig({ ...config, backgroundColor: next })}
                  sponsorPrimaryColor={sponsor?.primaryColor}
                  sponsorSecondaryColor={sponsor?.secondaryColor}
                  sponsorName={sponsor?.name}
                  emptyPlaceholder="#000000"
                  helperText="Solid color overlay on the content area. SDK also accepts rgba() strings if the operator pastes one (advanced)."
                  testId="picker-pb-backgroundColor"
                />
              );
            })()}

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

      case 'product_store':
        return (
          <>
            {/* Mode + product picker. "all" loads the entire sponsor
                channel; "filtered" uses the picker selection. The
                picker is multi-select scoped to the form's selected
                sponsor (same as Carousel). */}
            <div className="space-y-2">
              <Label htmlFor="store-mode">Mode</Label>
              <Select
                value={config.mode || 'all'}
                onValueChange={(value) => setConfig({ ...config, mode: value })}
              >
                <SelectTrigger data-testid="select-store-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All — load every product from the sponsor's channel</SelectItem>
                  <SelectItem value="filtered">Filtered — only the products picked below</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.mode === 'filtered' && (
              <SponsorProductPicker
                sponsorId={selectedSponsorId}
                sponsorName={sponsorName}
                mode="multi"
                selectedIds={selectedProductIds}
                onChange={setSelectedProductIds}
                helperText={
                  selectedProductIds.size === 0
                    ? "Filtered mode but no products picked — store will fall back to all products."
                    : `${selectedProductIds.size} product${selectedProductIds.size > 1 ? 's' : ''} selected.`
                }
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="store-displayType">Display</Label>
              <Select
                value={config.displayType || 'grid'}
                onValueChange={(value) => setConfig({ ...config, displayType: value })}
              >
                <SelectTrigger data-testid="select-store-displayType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.displayType === 'grid' && (
              <div className="space-y-2">
                <Label htmlFor="store-columns">Columns</Label>
                <Input
                  id="store-columns"
                  type="number"
                  min="1"
                  max="4"
                  value={config.columns || 2}
                  onChange={(e) => setConfig({ ...config, columns: parseInt(e.target.value) || 2 })}
                  data-testid="input-store-columns"
                />
              </div>
            )}

            {/* Header section opt-ins — same pattern as carousel. */}
            <div className="pt-4 border-t">
              <h4 className="text-sm font-semibold mb-3">Header (optional)</h4>
            </div>
            <div className="space-y-2">
              <Label htmlFor="store-title">Title</Label>
              <Input
                id="store-title"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value || undefined })}
                placeholder="e.g. Tienda — leave empty to hide header"
                data-testid="input-store-title"
              />
              <p className="text-xs text-muted-foreground">Renders above the grid. Empty → no header.</p>
            </div>
            <div className="space-y-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="store-showSponsorLogo"
                checked={config.showSponsorLogo === true}
                onChange={(e) => setConfig({ ...config, showSponsorLogo: e.target.checked || undefined })}
                data-testid="checkbox-store-showSponsorLogo"
                className="rounded"
              />
              <Label htmlFor="store-showSponsorLogo">Show sponsor logo in header</Label>
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
      {/* Sponsor swap. Operator picks a different sponsor → on save
          the dialog includes sponsorId in the PATCH body. Backend
          validates membership in campaign_sponsors and emits a single
          placement_config_updated event covering both the customConfig
          edit and the sponsor change so the SDK applies them atomically
          (header logo + per-sponsor commerce key both update in one
          render pass). */}
      {campaignSponsors.length > 0 && (
        <div className="space-y-2 pb-4 border-b">
          <Label htmlFor="customize-sponsor">Sponsor</Label>
          <Select value={selectedSponsorId} onValueChange={handleSponsorChange}>
            <SelectTrigger data-testid="select-customize-sponsor">
              <SelectValue placeholder="Select a sponsor" />
            </SelectTrigger>
            <SelectContent>
              {campaignSponsors.map((s) => (
                <SelectItem key={s.sponsorId} value={String(s.sponsorId)}>
                  {s.name} {s.role !== 'primary' ? `· ${s.role}` : '· primary'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Changing the sponsor updates the header logo + routes products to the new
            sponsor's commerce catalog. Update productId/productIds below if the new
            sponsor doesn't carry the same product.
          </p>
        </div>
      )}

      {renderConfigFields()}

      {/* Live preview — per-template. Each template that has a
          dedicated preview opts in by checking its `componentType`
          here. Add new templates by adding a branch + dropping in
          their preview component. */}
      {componentType === 'offer_banner' && (() => {
        const sponsor = campaignSponsors.find(s => String(s.sponsorId) === selectedSponsorId);
        return (
          <OfferBannerPreview
            config={config}
            sponsorLogoUrl={sponsor?.logoUrl ?? null}
            sponsorPrimaryColor={sponsor?.primaryColor ?? null}
            sponsorSecondaryColor={sponsor?.secondaryColor ?? null}
          />
        );
      })()}
      {componentType === 'product_banner' && (() => {
        const sponsor = campaignSponsors.find(s => String(s.sponsorId) === selectedSponsorId);
        return (
          <ProductBannerPreview
            config={config}
            sponsorLogoUrl={sponsor?.logoUrl ?? null}
            sponsorPrimaryColor={sponsor?.primaryColor ?? null}
          />
        );
      })()}

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
