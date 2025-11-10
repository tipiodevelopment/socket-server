import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { ImageUploadWithPreview } from '@/components/ImageUploadWithPreview';
import type { Component, ComponentType } from '@shared/schema';
import { Plus, Code, Trash2, Edit, Copy, Check, Palette, LayoutGrid } from 'lucide-react';
import { useState } from 'react';

const componentTypes: { value: ComponentType; label: string }[] = [
  { value: 'banner', label: 'Banner' },
  { value: 'countdown', label: 'Countdown Timer' },
  { value: 'carousel_auto', label: 'Auto Carousel' },
  { value: 'carousel_manual', label: 'Manual Carousel' },
  { value: 'product_spotlight', label: 'Product Spotlight' },
  { value: 'offer_badge', label: 'Offer Badge' },
  { value: 'offer_banner', label: 'Offer Banner (XXL)' },
  { value: 'product_carousel', label: 'Product Carousel' },
  { value: 'product_banner', label: 'Product Banner' },
  { value: 'product_store', label: 'Product Store' },
];

export function ComponentLibraryTab() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: components = [], isLoading } = useQuery<Component[]>({
    queryKey: ['/api/components'],
  });

  const { data: componentUsage = {} } = useQuery<Record<string, Array<{ campaignId: number; campaignName: string }>>>({
    queryKey: ['/api/components/usage'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { type: string; name: string; config: any }) => {
      return await apiRequest('POST', '/api/components', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      queryClient.invalidateQueries({ queryKey: ['/api/components/usage'] });
      setIsCreateOpen(false);
      toast({
        title: 'Component Created',
        description: 'Your component has been created successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create component.',
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Component> }) => {
      return await apiRequest('PATCH', `/api/components/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      queryClient.invalidateQueries({ queryKey: ['/api/components/usage'] });
      setEditingComponent(null);
      toast({
        title: 'Component Updated',
        description: 'Your component has been updated successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update component.',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/components/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      queryClient.invalidateQueries({ queryKey: ['/api/components/usage'] });
      toast({
        title: 'Component Deleted',
        description: 'The component has been removed from the library.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete component.',
        variant: 'destructive',
      });
    },
  });

  const copyToClipboard = (componentId: string) => {
    const code = `ReachuComponent(componentId: "${componentId}")`;
    navigator.clipboard.writeText(code);
    setCopiedId(componentId);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: 'Copied!',
      description: 'iOS code snippet copied to clipboard.',
    });
  };

  return (
    <Card className="bg-gray-800 border-0">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white">Component Library</CardTitle>
            <CardDescription className="text-gray-400">
              Create and manage reusable UI components for your iOS app.
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 border-0" data-testid="button-create-component">
                <Plus className="w-4 h-4 mr-2" />
                New Component
              </Button>
            </DialogTrigger>
            <DialogContent 
              className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-gray-800 text-white border-gray-700"
              onInteractOutside={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>Create New Component</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Create a reusable component that can be integrated into your iOS app.
                </DialogDescription>
              </DialogHeader>
              <ComponentForm
                onSubmit={(data) => createMutation.mutate(data)}
                onCancel={() => setIsCreateOpen(false)}
                isLoading={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">
            <p>Loading components...</p>
          </div>
        ) : components.length === 0 ? (
          <div className="text-center py-12">
            <Code className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No components yet</h3>
            <p className="text-gray-400 mb-4">
              Create your first reusable component to get started
            </p>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-create-first-component"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Component
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {components.map((component) => (
              <Card
                key={component.id}
                className="bg-gray-700 border-gray-600 hover:border-gray-500 transition-all"
                data-testid={`card-component-${component.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="inline-block px-2 py-1 rounded text-xs font-medium bg-primary/20 text-primary mb-2">
                        {componentTypes.find((t) => t.value === component.type)?.label}
                      </div>
                      <CardTitle className="text-lg mb-1 text-white">{component.name}</CardTitle>
                      <CardDescription className="font-mono text-xs mb-2">
                        ID: {component.id.substring(0, 8)}...
                      </CardDescription>
                      
                      {/* Config preview based on component type */}
                      {(() => {
                        const config = component.config as any;
                        
                        // Safe helper to access config properties
                        const getConfigValue = (key: string): string | undefined => {
                          try {
                            return config?.[key];
                          } catch {
                            return undefined;
                          }
                        };
                        
                        return (
                          <div className="text-xs text-gray-400 space-y-0.5 mb-2">
                            {component.type === 'banner' && getConfigValue('title') && (
                              <div>Title: <span className="text-gray-300">{getConfigValue('title')}</span></div>
                            )}
                            {component.type === 'countdown' && getConfigValue('title') && (
                              <div>Title: <span className="text-gray-300">{getConfigValue('title')}</span></div>
                            )}
                            {component.type === 'carousel_auto' && getConfigValue('channelId') && (
                              <div>Channel: <span className="text-gray-300">{getConfigValue('channelId')}</span></div>
                            )}
                            {component.type === 'carousel_manual' && config?.productIds?.length && (
                              <div>Products: <span className="text-gray-300">{config.productIds.length} items</span></div>
                            )}
                            {component.type === 'product_spotlight' && getConfigValue('productId') && (
                              <div>Product: <span className="text-gray-300">{getConfigValue('productId')}</span></div>
                            )}
                            {component.type === 'offer_badge' && getConfigValue('text') && (
                              <div>Text: <span className="text-gray-300">{getConfigValue('text')}</span></div>
                            )}
                            {component.type === 'offer_banner' && (
                              <>
                                {getConfigValue('title') && (
                                  <div>Title: <span className="text-gray-300">{getConfigValue('title')}</span></div>
                                )}
                                {getConfigValue('discountBadgeText') && (
                                  <div>Discount: <span className="text-gray-300">{getConfigValue('discountBadgeText')}</span></div>
                                )}
                                {(() => {
                                  const endDate = getConfigValue('countdownEndDate');
                                  if (!endDate) return null;
                                  try {
                                    const date = new Date(endDate);
                                    if (isNaN(date.getTime())) return null;
                                    return <div>Ends: <span className="text-gray-300">{date.toLocaleDateString()}</span></div>;
                                  } catch {
                                    return null;
                                  }
                                })()}
                              </>
                            )}
                            {component.type === 'product_carousel' && config?.productIds?.length && (
                              <div>Products: <span className="text-gray-300">{config.productIds.length} items</span></div>
                            )}
                            {component.type === 'product_banner' && getConfigValue('productId') && (
                              <div>Product: <span className="text-gray-300">{getConfigValue('productId')}</span></div>
                            )}
                            {component.type === 'product_store' && (
                              <>
                                <div>Mode: <span className="text-gray-300">{getConfigValue('mode') === 'all' ? 'All Products' : 'Filtered'}</span></div>
                                {config?.mode === 'filtered' && config?.productIds?.length && (
                                  <div>Products: <span className="text-gray-300">{config.productIds.length} items</span></div>
                                )}
                                <div>Layout: <span className="text-gray-300">{getConfigValue('displayType') || 'grid'}</span></div>
                              </>
                            )}
                          </div>
                        );
                      })()}
                      
                      {componentUsage[component.id] && componentUsage[component.id].length > 0 && (
                        <div className="text-xs text-gray-400">
                          Used in <span className="font-semibold text-white">{componentUsage[component.id].length}</span> campaign{componentUsage[component.id].length !== 1 ? 's' : ''}:
                          <div className="mt-1 flex flex-wrap gap-1">
                            {componentUsage[component.id].map((usage) => (
                              <span key={usage.campaignId} className="inline-block px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-300">
                                {usage.campaignName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-gray-800 rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-400">iOS Code</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(component.id)}
                        data-testid={`button-copy-${component.id}`}
                        className="h-6 px-2 hover:bg-gray-700"
                      >
                        {copiedId === component.id ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-300" />
                        )}
                      </Button>
                    </div>
                    <code className="text-xs block overflow-x-auto text-gray-300">
                      ReachuComponent(componentId: "{component.id}")
                    </code>
                  </div>

                  <div className="flex gap-2">
                    <Dialog open={editingComponent?.id === component.id} onOpenChange={(open) => !open && setEditingComponent(null)}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-600"
                          onClick={() => setEditingComponent(component)}
                          data-testid={`button-edit-${component.id}`}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent 
                        className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-gray-800 text-white border-gray-700"
                        onInteractOutside={(e) => e.preventDefault()}
                      >
                        <DialogHeader>
                          <DialogTitle>Edit Component</DialogTitle>
                          <DialogDescription className="text-gray-400">
                            Update the component configuration.
                          </DialogDescription>
                        </DialogHeader>
                        {editingComponent && (
                          <ComponentForm
                            component={editingComponent}
                            onSubmit={(data) =>
                              updateMutation.mutate({ id: component.id, data })
                            }
                            onCancel={() => setEditingComponent(null)}
                            isLoading={updateMutation.isPending}
                          />
                        )}
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this component?')) {
                          deleteMutation.mutate(component.id);
                        }
                      }}
                      data-testid={`button-delete-${component.id}`}
                      className="border-gray-600 text-gray-300 hover:bg-gray-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ComponentForm({
  component,
  onSubmit,
  onCancel,
  isLoading,
}: {
  component?: Component;
  onSubmit: (data: { type: string; name: string; config: any }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [type, setType] = useState<ComponentType>(component?.type as ComponentType || 'banner');
  const [name, setName] = useState(component?.name || '');
  const [config, setConfig] = useState<Record<string, any>>(component?.config || {});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ type, name, config });
  };

  const renderConfigFields = () => {
    switch (type) {
      case 'banner':
        return (
          <>
            <ImageUploadWithPreview
              label="Banner Image"
              value={config.imageUrl || ''}
              onChange={(url) => setConfig({ ...config, imageUrl: url })}
              placeholder="https://example.com/banner.jpg"
              testId="input-imageUrl"
            />
            <div className="space-y-2">
              <Label htmlFor="title" className="text-gray-300">Title</Label>
              <Input
                id="title"
                placeholder="50% OFF Everything"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                data-testid="input-title"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle" className="text-gray-300">Subtitle (Optional)</Label>
              <Input
                id="subtitle"
                placeholder="Limited time offer"
                value={config.subtitle || ''}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                data-testid="input-subtitle"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctaText" className="text-gray-300">Button Text (Optional)</Label>
              <Input
                id="ctaText"
                placeholder="Shop Now"
                value={config.ctaText || ''}
                onChange={(e) => setConfig({ ...config, ctaText: e.target.value })}
                data-testid="input-ctaText"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctaLink" className="text-gray-300">Button Link (Optional)</Label>
              <Input
                id="ctaLink"
                placeholder="https://example.com/sale"
                value={config.ctaLink || ''}
                onChange={(e) => setConfig({ ...config, ctaLink: e.target.value })}
                data-testid="input-ctaLink"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deeplink" className="text-gray-300">Deeplink (Optional)</Label>
              <Input
                id="deeplink"
                placeholder="myapp://sale/flash"
                value={config.deeplink || ''}
                onChange={(e) => setConfig({ ...config, deeplink: e.target.value })}
                data-testid="input-deeplink"
                className="bg-gray-700 border-0 text-white"
              />
              <p className="text-xs text-gray-400">iOS app URL scheme or universal link. If provided, takes priority over Button Link.</p>
            </div>
          </>
        );
      case 'countdown':
        return (
          <>
            {/* Core Fields */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-gray-300">Title *</Label>
              <Input
                id="title"
                placeholder="Black Friday Ends In:"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                data-testid="input-title"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-gray-300">End Date *</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={config.endDate || ''}
                onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                data-testid="input-endDate"
                className="bg-gray-700 border-0 text-white"
              />
            </div>

            {/* Visual Fields */}
            <div className="pt-4 border-t border-gray-600">
              <h4 className="text-sm font-semibold mb-3 text-gray-200">Visual Customization (Optional)</h4>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logoUrl" className="text-gray-300">Logo URL</Label>
              <Input
                id="logoUrl"
                placeholder="https://example.com/logo.png"
                value={config.logoUrl || ''}
                onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                data-testid="input-logoUrl"
                className="bg-gray-700 border-0 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtitle" className="text-gray-300">Subtitle</Label>
              <Textarea
                id="subtitle"
                placeholder="Get 20% off on all products"
                value={config.subtitle || ''}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                data-testid="input-subtitle"
                className="bg-gray-700 border-0 text-white"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountBadgeText" className="text-gray-300">Discount Badge Text</Label>
              <Input
                id="discountBadgeText"
                placeholder="20% OFF"
                value={config.discountBadgeText || ''}
                onChange={(e) => setConfig({ ...config, discountBadgeText: e.target.value })}
                data-testid="input-discountBadgeText"
                className="bg-gray-700 border-0 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="backgroundImageUrl" className="text-gray-300">Background Image URL</Label>
              <Input
                id="backgroundImageUrl"
                placeholder="https://example.com/background.jpg"
                value={config.backgroundImageUrl || ''}
                onChange={(e) => setConfig({ ...config, backgroundImageUrl: e.target.value })}
                data-testid="input-backgroundImageUrl"
                className="bg-gray-700 border-0 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="backgroundColor" className="text-gray-300">Background Color (hex)</Label>
              <Input
                id="backgroundColor"
                placeholder="#FF6F61"
                value={config.backgroundColor || '#FF6F61'}
                onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                data-testid="input-backgroundColor"
                className="bg-gray-700 border-0 text-white"
              />
              <p className="text-xs text-gray-400">Used if no background image. Default: #FF6F61</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="overlayOpacity" className="text-gray-300">Overlay Opacity (0-1)</Label>
              <Input
                id="overlayOpacity"
                type="number"
                step="0.1"
                min="0"
                max="1"
                placeholder="0.6"
                value={config.overlayOpacity ?? 0.6}
                onChange={(e) => {
                  const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                  setConfig({ ...config, overlayOpacity: val !== undefined && !isNaN(val) ? val : undefined });
                }}
                data-testid="input-overlayOpacity"
                className="bg-gray-700 border-0 text-white"
              />
              <p className="text-xs text-gray-400">Dark overlay opacity. Default: 0.6</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaText" className="text-gray-300">CTA Button Text</Label>
              <Input
                id="ctaText"
                placeholder="Shop Now"
                value={config.ctaText || ''}
                onChange={(e) => setConfig({ ...config, ctaText: e.target.value })}
                data-testid="input-ctaText"
                className="bg-gray-700 border-0 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaLink" className="text-gray-300">CTA Link (URL)</Label>
              <Input
                id="ctaLink"
                placeholder="https://example.com/shop"
                value={config.ctaLink || ''}
                onChange={(e) => setConfig({ ...config, ctaLink: e.target.value })}
                data-testid="input-ctaLink"
                className="bg-gray-700 border-0 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deeplink" className="text-gray-300">Deeplink (optional, takes priority)</Label>
              <Input
                id="deeplink"
                placeholder="pregnancy://offers/black-friday"
                value={config.deeplink || ''}
                onChange={(e) => setConfig({ ...config, deeplink: e.target.value })}
                data-testid="input-deeplink"
                className="bg-gray-700 border-0 text-white"
              />
              <p className="text-xs text-gray-400">For in-app navigation. Takes priority over CTA Link.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="buttonColor" className="text-gray-300">Button Color (hex)</Label>
              <Input
                id="buttonColor"
                placeholder="#FFFFFF"
                value={config.buttonColor || '#FFFFFF'}
                onChange={(e) => setConfig({ ...config, buttonColor: e.target.value })}
                data-testid="input-buttonColor"
                className="bg-gray-700 border-0 text-white"
              />
              <p className="text-xs text-gray-400">Button text color. Default: #FFFFFF</p>
            </div>
          </>
        );
      case 'carousel_auto':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="channelId" className="text-gray-300">Reachu Channel ID</Label>
              <Input
                id="channelId"
                placeholder="ch_123"
                value={config.channelId || ''}
                onChange={(e) => setConfig({ ...config, channelId: e.target.value })}
                data-testid="input-channelId"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayCount" className="text-gray-300">Display Count</Label>
              <Input
                id="displayCount"
                type="number"
                placeholder="5"
                value={config.displayCount || 5}
                onChange={(e) => setConfig({ ...config, displayCount: parseInt(e.target.value) })}
                data-testid="input-displayCount"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
          </>
        );
      case 'carousel_manual':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="productIds" className="text-gray-300">Product IDs (comma-separated)</Label>
              <Textarea
                id="productIds"
                placeholder="prod_1, prod_2, prod_3"
                value={config.productIds?.join(', ') || ''}
                onChange={(e) => setConfig({ 
                  ...config, 
                  productIds: e.target.value.split(',').map(id => id.trim()).filter(id => id) 
                })}
                data-testid="input-productIds"
                className="bg-gray-700 border-0 text-white"
              />
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
                data-testid="input-productId"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="highlightText" className="text-gray-300">Highlight Text (Optional)</Label>
              <Input
                id="highlightText"
                placeholder="Featured Product"
                value={config.highlightText || ''}
                onChange={(e) => setConfig({ ...config, highlightText: e.target.value })}
                data-testid="input-highlightText"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
          </>
        );
      case 'offer_badge':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="text" className="text-gray-300">Text</Label>
              <Input
                id="text"
                placeholder="SALE"
                value={config.text || ''}
                onChange={(e) => setConfig({ ...config, text: e.target.value })}
                className="bg-gray-700 border-0 text-white"
                data-testid="input-text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color" className="text-gray-300">Color</Label>
              <Select
                value={config.color || 'red'}
                onValueChange={(value) => setConfig({ ...config, color: value })}
              >
                <SelectTrigger className="bg-gray-700 border-0 text-white" data-testid="select-color">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="red">Red</SelectItem>
                  <SelectItem value="blue">Blue</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        );
      case 'offer_banner':
        return (
          <>
            <ImageUploadWithPreview
              label="Logo URL"
              value={config.logoUrl || ''}
              onChange={(url) => setConfig({ ...config, logoUrl: url })}
              placeholder="https://example.com/logo.png"
              testId="input-logoUrl"
            />
            <div className="space-y-2">
              <Label htmlFor="title" className="text-gray-300">Title</Label>
              <Input
                id="title"
                placeholder="Ukens tilbud"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                data-testid="input-title"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle" className="text-gray-300">Subtitle (Optional)</Label>
              <Input
                id="subtitle"
                placeholder="Se denne ukes beste tilbud"
                value={config.subtitle || ''}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                data-testid="input-subtitle"
                className="bg-gray-700 border-0 text-white"
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
              <Label htmlFor="countdownEndDate" className="text-gray-300">Countdown End Date</Label>
              <Input
                id="countdownEndDate"
                type="datetime-local"
                value={config.countdownEndDate || ''}
                onChange={(e) => setConfig({ ...config, countdownEndDate: e.target.value })}
                data-testid="input-countdownEndDate"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discountBadgeText" className="text-gray-300">Discount Badge Text</Label>
              <Input
                id="discountBadgeText"
                placeholder="Opp til 30%"
                value={config.discountBadgeText || ''}
                onChange={(e) => setConfig({ ...config, discountBadgeText: e.target.value })}
                data-testid="input-discountBadgeText"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctaText" className="text-gray-300">Button Text</Label>
              <Input
                id="ctaText"
                placeholder="Se alle tilbud"
                value={config.ctaText || ''}
                onChange={(e) => setConfig({ ...config, ctaText: e.target.value })}
                data-testid="input-ctaText"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctaLink" className="text-gray-300">Button Link (Optional)</Label>
              <Input
                id="ctaLink"
                placeholder="https://example.com/offers"
                value={config.ctaLink || ''}
                onChange={(e) => setConfig({ ...config, ctaLink: e.target.value })}
                data-testid="input-ctaLink"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deeplink" className="text-gray-300">Deeplink (Optional)</Label>
              <Input
                id="deeplink"
                placeholder="myapp://offers/black-friday"
                value={config.deeplink || ''}
                onChange={(e) => setConfig({ ...config, deeplink: e.target.value })}
                data-testid="input-deeplink"
                className="bg-gray-700 border-0 text-white"
              />
              <p className="text-xs text-gray-400">iOS app URL scheme or universal link. If provided, takes priority over Button Link.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="overlayOpacity" className="text-gray-300">Overlay Opacity (Optional, 0-1)</Label>
              <Input
                id="overlayOpacity"
                type="number"
                step="0.1"
                min="0"
                max="1"
                placeholder="0.4"
                value={config.overlayOpacity || ''}
                onChange={(e) => setConfig({ ...config, overlayOpacity: e.target.value ? parseFloat(e.target.value) : undefined })}
                data-testid="input-overlayOpacity"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
          </>
        );
      case 'product_carousel':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="productIds" className="text-gray-300">Product IDs (optional, comma-separated)</Label>
              <Textarea
                id="productIds"
                placeholder="Leave empty for all channel products, or: 408727, 408728, 408729"
                value={config.productIds?.join(', ') || ''}
                onChange={(e) => {
                  const ids = e.target.value.split(',').map(id => id.trim()).filter(id => id);
                  setConfig({ 
                    ...config, 
                    productIds: ids.length > 0 ? ids : undefined
                  });
                }}
                data-testid="input-productIds"
                className="bg-gray-700 border-0 text-white"
                rows={3}
              />
              <p className="text-xs text-gray-400">
                {config.productIds && config.productIds.length > 0 
                  ? `Showing ${config.productIds.length} specific products. The SDK will fetch details for these IDs.`
                  : "Empty = SDK will fetch ALL products from your Reachu channel."}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.autoPlay || false}
                  onChange={(e) => setConfig({ ...config, autoPlay: e.target.checked })}
                  data-testid="checkbox-autoPlay"
                  className="rounded"
                />
                Auto Play
              </Label>
            </div>
            {config.autoPlay && (
              <div className="space-y-2">
                <Label htmlFor="interval" className="text-gray-300">Interval (milliseconds)</Label>
                <Input
                  id="interval"
                  type="number"
                  placeholder="3000"
                  value={config.interval || 3000}
                  onChange={(e) => setConfig({ ...config, interval: parseInt(e.target.value) })}
                  data-testid="input-interval"
                  className="bg-gray-700 border-0 text-white"
                />
              </div>
            )}
          </>
        );
      case 'product_banner':
        return (
          <>
            {/* Live Preview */}
            <div className="space-y-2 mb-6">
              <Label className="text-gray-300 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4" />
                Live Preview
              </Label>
              <div 
                className="relative rounded-lg overflow-hidden border border-gray-700"
                style={{
                  height: `${config.bannerHeight || 200}px`,
                  backgroundImage: config.backgroundImageUrl ? `url(${config.backgroundImageUrl})` : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {/* Overlay */}
                <div 
                  className="absolute inset-0 bg-black transition-opacity"
                  style={{ opacity: config.overlayOpacity ?? 0.5 }}
                />
                
                {/* Content */}
                <div 
                  className="relative h-full flex flex-col px-6 py-4"
                  style={{
                    justifyContent: config.contentVerticalAlignment === 'top' ? 'flex-start' : config.contentVerticalAlignment === 'bottom' ? 'flex-end' : 'center',
                    alignItems: config.textAlignment === 'left' ? 'flex-start' : config.textAlignment === 'right' ? 'flex-end' : 'center',
                    textAlign: config.textAlignment || 'center',
                    backgroundColor: config.backgroundColor || 'rgba(0, 0, 0, 0.3)',
                  }}
                >
                  {(config.title || 'Product Title') && (
                    <h3 
                      className="font-bold mb-1"
                      style={{ 
                        color: config.titleColor || '#FFFFFF',
                        fontSize: `${config.titleFontSize || 24}px`,
                      }}
                    >
                      {config.title || 'Product Title'}
                    </h3>
                  )}
                  {(config.subtitle || 'Special offer description') && (
                    <p 
                      className="mb-3"
                      style={{ 
                        color: config.subtitleColor || '#F0F0F0',
                        fontSize: `${config.subtitleFontSize || 16}px`,
                      }}
                    >
                      {config.subtitle || 'Special offer description'}
                    </p>
                  )}
                  <button
                    className="px-4 py-2 rounded-lg font-medium"
                    style={{
                      backgroundColor: config.buttonBackgroundColor || '#007AFF',
                      color: config.buttonTextColor || '#FFFFFF',
                      fontSize: `${config.buttonFontSize || 14}px`,
                    }}
                  >
                    {config.ctaText || 'Ver producto'}
                  </button>
                </div>
              </div>
            </div>

            {/* Content Fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="productId" className="text-gray-300">Product ID</Label>
                <Input
                  id="productId"
                  placeholder="408841"
                  value={config.productId || ''}
                  onChange={(e) => setConfig({ ...config, productId: e.target.value })}
                  data-testid="input-productId"
                  className="bg-gray-700 border-0 text-white"
                  required
                />
                <p className="text-xs text-gray-400">Reachu product ID. The SDK will fetch product details.</p>
              </div>

              <ImageUploadWithPreview
                label="Background Image"
                value={config.backgroundImageUrl || ''}
                onChange={(url) => setConfig({ ...config, backgroundImageUrl: url })}
                placeholder="Upload banner background image"
                testId="input-backgroundImageUrl"
              />

              <div className="space-y-2">
                <Label htmlFor="title" className="text-gray-300">Title (Optional)</Label>
                <Input
                  id="title"
                  placeholder="Producto Destacado"
                  value={config.title || ''}
                  onChange={(e) => setConfig({ ...config, title: e.target.value })}
                  data-testid="input-title"
                  className="bg-gray-700 border-0 text-white"
                />
                <p className="text-xs text-gray-400">Leave empty to use product name</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subtitle" className="text-gray-300">Subtitle (Optional)</Label>
                <Input
                  id="subtitle"
                  placeholder="40% OFF"
                  value={config.subtitle || ''}
                  onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                  data-testid="input-subtitle"
                  className="bg-gray-700 border-0 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ctaText" className="text-gray-300">Button Text</Label>
                <Input
                  id="ctaText"
                  placeholder="Ver producto"
                  value={config.ctaText || ''}
                  onChange={(e) => setConfig({ ...config, ctaText: e.target.value })}
                  data-testid="input-ctaText"
                  className="bg-gray-700 border-0 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ctaLink" className="text-gray-300">Button Link (Optional)</Label>
                <Input
                  id="ctaLink"
                  placeholder="https://tienda.com/producto/408841"
                  value={config.ctaLink || ''}
                  onChange={(e) => setConfig({ ...config, ctaLink: e.target.value })}
                  data-testid="input-ctaLink"
                  className="bg-gray-700 border-0 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deeplink" className="text-gray-300">Deeplink (Optional)</Label>
                <Input
                  id="deeplink"
                  placeholder="pregnancy://product/408841"
                  value={config.deeplink || ''}
                  onChange={(e) => setConfig({ ...config, deeplink: e.target.value })}
                  data-testid="input-deeplink"
                  className="bg-gray-700 border-0 text-white"
                />
                <p className="text-xs text-gray-400">If provided, takes priority over Button Link</p>
              </div>
            </div>

            {/* Visual Customization - Collapsible Sections */}
            <Accordion type="multiple" className="w-full mt-6">
              {/* Colors Section */}
              <AccordionItem value="colors" className="border-gray-700">
                <AccordionTrigger className="text-gray-300 hover:text-white">
                  <span className="flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    Colors & Styling
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="titleColor" className="text-gray-300 text-xs">Title Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="titleColor"
                          type="color"
                          value={config.titleColor || '#FFFFFF'}
                          onChange={(e) => setConfig({ ...config, titleColor: e.target.value })}
                          className="w-12 h-10 p-1 bg-gray-700 border-0"
                        />
                        <Input
                          value={config.titleColor || '#FFFFFF'}
                          onChange={(e) => setConfig({ ...config, titleColor: e.target.value })}
                          placeholder="#FFFFFF"
                          className="flex-1 bg-gray-700 border-0 text-white text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subtitleColor" className="text-gray-300 text-xs">Subtitle Color</Label>
                      <div className="flex gap-2">
                        <Input
                          id="subtitleColor"
                          type="color"
                          value={config.subtitleColor || '#F0F0F0'}
                          onChange={(e) => setConfig({ ...config, subtitleColor: e.target.value })}
                          className="w-12 h-10 p-1 bg-gray-700 border-0"
                        />
                        <Input
                          value={config.subtitleColor || '#F0F0F0'}
                          onChange={(e) => setConfig({ ...config, subtitleColor: e.target.value })}
                          placeholder="#F0F0F0"
                          className="flex-1 bg-gray-700 border-0 text-white text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="buttonBackgroundColor" className="text-gray-300 text-xs">Button Background</Label>
                      <div className="flex gap-2">
                        <Input
                          id="buttonBackgroundColor"
                          type="color"
                          value={config.buttonBackgroundColor || '#007AFF'}
                          onChange={(e) => setConfig({ ...config, buttonBackgroundColor: e.target.value })}
                          className="w-12 h-10 p-1 bg-gray-700 border-0"
                        />
                        <Input
                          value={config.buttonBackgroundColor || '#007AFF'}
                          onChange={(e) => setConfig({ ...config, buttonBackgroundColor: e.target.value })}
                          placeholder="#007AFF"
                          className="flex-1 bg-gray-700 border-0 text-white text-xs"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="buttonTextColor" className="text-gray-300 text-xs">Button Text</Label>
                      <div className="flex gap-2">
                        <Input
                          id="buttonTextColor"
                          type="color"
                          value={config.buttonTextColor || '#FFFFFF'}
                          onChange={(e) => setConfig({ ...config, buttonTextColor: e.target.value })}
                          className="w-12 h-10 p-1 bg-gray-700 border-0"
                        />
                        <Input
                          value={config.buttonTextColor || '#FFFFFF'}
                          onChange={(e) => setConfig({ ...config, buttonTextColor: e.target.value })}
                          placeholder="#FFFFFF"
                          className="flex-1 bg-gray-700 border-0 text-white text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Background Color with Alpha */}
                  <div className="space-y-3 pt-4 border-t border-gray-700">
                    <div className="flex justify-between items-center">
                      <Label className="text-gray-300 text-sm">Background Color with Transparency</Label>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const rgba = config.backgroundColor || 'rgba(0, 0, 0, 0.3)';
                          const match = rgba.match(/,\s*([\d.]+)\)$/);
                          const alpha = match ? parseFloat(match[1]) : 0.3;
                          return alpha === 0 && (
                            <span className="text-xs text-green-400 px-2 py-0.5 bg-green-400/10 rounded">
                              Transparente
                            </span>
                          );
                        })()}
                        <button
                          type="button"
                          onClick={() => {
                            console.log('Removiendo color de fondo...');
                            setConfig({ ...config, backgroundColor: 'rgba(0, 0, 0, 0)' });
                          }}
                          className="text-xs text-purple-400 hover:text-purple-300 underline"
                          data-testid="button-remove-background"
                        >
                          Quitar color de fondo
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="bgColor" className="text-gray-300 text-xs">Color</Label>
                        <div className="flex gap-2">
                          <Input
                            id="bgColor"
                            type="color"
                            value={(() => {
                              const rgba = config.backgroundColor || 'rgba(0, 0, 0, 0.3)';
                              const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                              if (match) {
                                const r = parseInt(match[1]);
                                const g = parseInt(match[2]);
                                const b = parseInt(match[3]);
                                return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
                              }
                              return '#000000';
                            })()}
                            onChange={(e) => {
                              const hex = e.target.value;
                              const r = parseInt(hex.slice(1, 3), 16);
                              const g = parseInt(hex.slice(3, 5), 16);
                              const b = parseInt(hex.slice(5, 7), 16);
                              const currentAlpha = (() => {
                                const rgba = config.backgroundColor || 'rgba(0, 0, 0, 0.3)';
                                const match = rgba.match(/,\s*([\d.]+)\)$/);
                                return match ? parseFloat(match[1]) : 0.3;
                              })();
                              setConfig({ ...config, backgroundColor: `rgba(${r}, ${g}, ${b}, ${currentAlpha})` });
                            }}
                            className="w-12 h-10 p-1 bg-gray-700 border-0"
                          />
                          <Input
                            value={config.backgroundColor || 'rgba(0, 0, 0, 0.3)'}
                            onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                            placeholder="rgba(0, 0, 0, 0.3)"
                            className="flex-1 bg-gray-700 border-0 text-white text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label className="text-gray-300 text-xs">Transparency</Label>
                          <span className="text-xs text-gray-400">
                            {Math.round(((() => {
                              const rgba = config.backgroundColor || 'rgba(0, 0, 0, 0.3)';
                              const match = rgba.match(/,\s*([\d.]+)\)$/);
                              return match ? parseFloat(match[1]) : 0.3;
                            })()) * 100)}%
                          </span>
                        </div>
                        <Slider
                          value={[((() => {
                            const rgba = config.backgroundColor || 'rgba(0, 0, 0, 0.3)';
                            const match = rgba.match(/,\s*([\d.]+)\)$/);
                            return match ? parseFloat(match[1]) * 100 : 30;
                          })())]}
                          onValueChange={([value]) => {
                            const rgba = config.backgroundColor || 'rgba(0, 0, 0, 0.3)';
                            const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                            if (match) {
                              const r = parseInt(match[1]);
                              const g = parseInt(match[2]);
                              const b = parseInt(match[3]);
                              setConfig({ ...config, backgroundColor: `rgba(${r}, ${g}, ${b}, ${value / 100})` });
                            }
                          }}
                          min={0}
                          max={100}
                          step={5}
                          className="w-full mt-2"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-400">Color de fondo del contenido con transparencia (overlays sobre la imagen)</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Layout Section */}
              <AccordionItem value="layout" className="border-gray-700">
                <AccordionTrigger className="text-gray-300 hover:text-white">
                  <span className="flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4" />
                    Layout & Sizing
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-4 pt-4">
                  {/* Banner Height */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-gray-300 text-xs">Banner Height</Label>
                      <span className="text-xs text-gray-400">{config.bannerHeight || 200}px</span>
                    </div>
                    <Slider
                      value={[config.bannerHeight || 200]}
                      onValueChange={([value]) => setConfig({ ...config, bannerHeight: value })}
                      min={120}
                      max={400}
                      step={10}
                      className="w-full"
                    />
                  </div>

                  {/* Overlay Opacity */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-gray-300 text-xs">Overlay Opacity</Label>
                      <span className="text-xs text-gray-400">{Math.round((config.overlayOpacity ?? 0.5) * 100)}%</span>
                    </div>
                    <Slider
                      value={[(config.overlayOpacity ?? 0.5) * 100]}
                      onValueChange={([value]) => setConfig({ ...config, overlayOpacity: value / 100 })}
                      min={0}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>

                  {/* Font Sizes */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-col">
                        <Label className="text-gray-300 text-xs">Title Size</Label>
                        <span className="text-xs text-gray-400">{config.titleFontSize || 24}px</span>
                      </div>
                      <Slider
                        value={[config.titleFontSize || 24]}
                        onValueChange={([value]) => setConfig({ ...config, titleFontSize: value })}
                        min={16}
                        max={40}
                        step={2}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-col">
                        <Label className="text-gray-300 text-xs">Subtitle Size</Label>
                        <span className="text-xs text-gray-400">{config.subtitleFontSize || 16}px</span>
                      </div>
                      <Slider
                        value={[config.subtitleFontSize || 16]}
                        onValueChange={([value]) => setConfig({ ...config, subtitleFontSize: value })}
                        min={12}
                        max={24}
                        step={1}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-col">
                        <Label className="text-gray-300 text-xs">Button Size</Label>
                        <span className="text-xs text-gray-400">{config.buttonFontSize || 14}px</span>
                      </div>
                      <Slider
                        value={[config.buttonFontSize || 14]}
                        onValueChange={([value]) => setConfig({ ...config, buttonFontSize: value })}
                        min={12}
                        max={20}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* Alignment */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-gray-300 text-xs">Text Alignment</Label>
                      <Select
                        value={config.textAlignment || 'center'}
                        onValueChange={(value) => setConfig({ ...config, textAlignment: value })}
                      >
                        <SelectTrigger className="bg-gray-700 border-0 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-gray-300 text-xs">Vertical Position</Label>
                      <Select
                        value={config.contentVerticalAlignment || 'center'}
                        onValueChange={(value) => setConfig({ ...config, contentVerticalAlignment: value })}
                      >
                        <SelectTrigger className="bg-gray-700 border-0 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="top">Top</SelectItem>
                          <SelectItem value="center">Center</SelectItem>
                          <SelectItem value="bottom">Bottom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </>
        );
      case 'product_store':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="mode" className="text-gray-300">Display Mode</Label>
              <Select
                value={config.mode || 'all'}
                onValueChange={(value) => setConfig({ ...config, mode: value })}
              >
                <SelectTrigger className="bg-gray-700 border-0 text-white" data-testid="select-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="all">All Products (from Channel)</SelectItem>
                  <SelectItem value="filtered">Filtered Products (specific IDs)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">
                {config.mode === 'all' 
                  ? 'Shows all products from the campaign\'s Reachu channel' 
                  : 'Shows only specified product IDs'}
              </p>
            </div>
            {config.mode === 'filtered' && (
              <div className="space-y-2">
                <Label htmlFor="productIds" className="text-gray-300">Product IDs (comma-separated)</Label>
                <Textarea
                  id="productIds"
                  placeholder="408841, 408842, 408843"
                  value={config.productIds?.join(', ') || ''}
                  onChange={(e) => setConfig({ 
                    ...config, 
                    productIds: e.target.value.split(',').map(id => id.trim()).filter(id => id) 
                  })}
                  data-testid="input-productIds"
                  className="bg-gray-700 border-0 text-white"
                  rows={4}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="displayType" className="text-gray-300">Layout</Label>
              <Select
                value={config.displayType || 'grid'}
                onValueChange={(value) => setConfig({ ...config, displayType: value })}
              >
                <SelectTrigger className="bg-gray-700 border-0 text-white" data-testid="select-displayType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="list">List</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {config.displayType === 'grid' && (
              <div className="space-y-2">
                <Label htmlFor="columns" className="text-gray-300">Grid Columns</Label>
                <Input
                  id="columns"
                  type="number"
                  min="1"
                  max="4"
                  placeholder="2"
                  value={config.columns || 2}
                  onChange={(e) => setConfig({ ...config, columns: parseInt(e.target.value) })}
                  data-testid="input-columns"
                  className="bg-gray-700 border-0 text-white"
                />
              </div>
            )}
          </>
        );
      
      case 'offer_banner':
        return (
          <>
            {/* Required Fields */}
            <div className="space-y-2">
              <Label htmlFor="logoUrl" className="text-gray-300">Logo URL *</Label>
              <Input
                id="logoUrl"
                value={config.logoUrl || ''}
                onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                placeholder="/objects/uploads/... or https://..."
                data-testid="input-logoUrl"
                className="bg-gray-700 border-0 text-white"
              />
              <p className="text-xs text-gray-400">Upload to Object Storage and paste the URL here</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-gray-300">Title *</Label>
              <Input
                id="title"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                placeholder="Black Friday Sale"
                data-testid="input-title"
                className="bg-gray-700 border-0 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="backgroundImageUrl" className="text-gray-300">Background Image URL *</Label>
              <Input
                id="backgroundImageUrl"
                value={config.backgroundImageUrl || ''}
                onChange={(e) => setConfig({ ...config, backgroundImageUrl: e.target.value })}
                placeholder="/objects/uploads/... or https://..."
                data-testid="input-backgroundImageUrl"
                className="bg-gray-700 border-0 text-white"
              />
              <p className="text-xs text-gray-400">Upload to Object Storage and paste the URL here</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="countdownEndDate" className="text-gray-300">Countdown End Date *</Label>
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
                className="bg-gray-700 border-0 text-white"
              />
              <p className="text-xs text-gray-400">Select date and time in your local timezone</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="discountBadgeText" className="text-gray-300">Discount Badge Text *</Label>
              <Input
                id="discountBadgeText"
                value={config.discountBadgeText || ''}
                onChange={(e) => setConfig({ ...config, discountBadgeText: e.target.value })}
                placeholder="50% OFF"
                data-testid="input-discountBadgeText"
                className="bg-gray-700 border-0 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaText" className="text-gray-300">CTA Button Text *</Label>
              <Input
                id="ctaText"
                value={config.ctaText || ''}
                onChange={(e) => setConfig({ ...config, ctaText: e.target.value })}
                placeholder="Shop Now"
                data-testid="input-ctaText"
                className="bg-gray-700 border-0 text-white"
              />
            </div>

            {/* Optional Fields */}
            <div className="pt-4 border-t border-gray-700">
              <h4 className="text-sm font-semibold mb-3 text-gray-300">Optional Fields</h4>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtitle" className="text-gray-300">Subtitle</Label>
              <Input
                id="subtitle"
                value={config.subtitle || ''}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                placeholder="Up to 50% off on selected products"
                data-testid="input-subtitle"
                className="bg-gray-700 border-0 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ctaLink" className="text-gray-300">CTA Link (URL)</Label>
              <Input
                id="ctaLink"
                value={config.ctaLink || ''}
                onChange={(e) => setConfig({ ...config, ctaLink: e.target.value })}
                placeholder="https://example.com/black-friday"
                data-testid="input-ctaLink"
                className="bg-gray-700 border-0 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="overlayOpacity" className="text-gray-300">Overlay Opacity (0-1)</Label>
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
                className="bg-gray-700 border-0 text-white"
              />
              <p className="text-xs text-gray-400">Dark overlay on background image. Default: 0.4</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backgroundColor" className="text-gray-300">Background Color (hex)</Label>
              <Input
                id="backgroundColor"
                value={config.backgroundColor || '#FF6F61'}
                onChange={(e) => setConfig({ ...config, backgroundColor: e.target.value })}
                placeholder="#FF6F61"
                data-testid="input-backgroundColor"
                className="bg-gray-700 border-0 text-white"
              />
              <p className="text-xs text-gray-400">Fallback color if image fails to load</p>
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
        <Select value={type} onValueChange={(value) => setType(value as ComponentType)} disabled={!!component}>
          <SelectTrigger className="bg-gray-700 border-0 text-white" data-testid="select-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-800 border-gray-700">
            {componentTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name" className="text-gray-300">Component Name</Label>
        <Input
          id="name"
          placeholder="My Banner"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="bg-gray-700 border-0 text-white"
          data-testid="input-name"
        />
      </div>

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
          {isLoading ? 'Saving...' : component ? 'Update Component' : 'Create Component'}
        </Button>
      </div>
    </form>
  );
}
