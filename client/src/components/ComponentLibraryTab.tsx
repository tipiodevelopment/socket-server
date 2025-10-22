import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { ImageUploadWithPreview } from '@/components/ImageUploadWithPreview';
import type { Component, ComponentType } from '@shared/schema';
import { Plus, Code, Trash2, Edit, Copy, Check } from 'lucide-react';
import { useState } from 'react';

const componentTypes: { value: ComponentType; label: string }[] = [
  { value: 'banner', label: 'Banner' },
  { value: 'countdown', label: 'Countdown Timer' },
  { value: 'carousel_auto', label: 'Auto Carousel' },
  { value: 'carousel_manual', label: 'Manual Carousel' },
  { value: 'product_spotlight', label: 'Product Spotlight' },
  { value: 'offer_badge', label: 'Offer Badge' },
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
          </>
        );
      case 'countdown':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-gray-300">End Date</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={config.endDate || ''}
                onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                data-testid="input-endDate"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title" className="text-gray-300">Title</Label>
              <Input
                id="title"
                placeholder="Sale Ends In"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                data-testid="input-title"
                className="bg-gray-700 border-0 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="style" className="text-gray-300">Style</Label>
              <Select
                value={config.style || 'full'}
                onValueChange={(value) => setConfig({ ...config, style: value })}
              >
                <SelectTrigger data-testid="select-style" className="bg-gray-700 border-0 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="full">Full</SelectItem>
                </SelectContent>
              </Select>
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
