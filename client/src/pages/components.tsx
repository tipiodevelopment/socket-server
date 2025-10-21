import { Link } from 'wouter';
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
import { Plus, Code, Trash2, Edit, ArrowLeft, Copy, Check } from 'lucide-react';
import { useState } from 'react';

const componentTypes: { value: ComponentType; label: string }[] = [
  { value: 'banner', label: 'Banner' },
  { value: 'countdown', label: 'Countdown Timer' },
  { value: 'carousel_auto', label: 'Auto Carousel' },
  { value: 'carousel_manual', label: 'Manual Carousel' },
  { value: 'product_spotlight', label: 'Product Spotlight' },
  { value: 'offer_badge', label: 'Offer Badge' },
];

export default function ComponentsPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<Component | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: components = [], isLoading } = useQuery<Component[]>({
    queryKey: ['/api/components'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { type: string; name: string; config: any }) => {
      return await apiRequest('POST', '/api/components', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      setIsCreateOpen(false);
      toast({
        title: 'Componente creado',
        description: 'Tu componente ha sido creado exitosamente.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo crear el componente.',
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
      setEditingComponent(null);
      toast({
        title: 'Componente actualizado',
        description: 'Tu componente ha sido actualizado exitosamente.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el componente.',
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
      toast({
        title: 'Componente eliminado',
        description: 'El componente ha sido eliminado de la biblioteca.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el componente.',
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
      title: '¡Copiado!',
      description: 'Código iOS copiado al portapapeles.',
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Link href="/campaigns">
                <Button variant="ghost" size="sm" data-testid="button-back">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-foreground">Component Library</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  Reusable UI components for your iOS app
                </p>
              </div>
            </div>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-create-component" size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New Component</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create New Component</DialogTitle>
                  <DialogDescription>
                    Create a reusable component that can be integrated into your iOS app.
                  </DialogDescription>
                </DialogHeader>
                <ComponentForm
                  onSubmit={(data) => createMutation.mutate(data)}
                  isLoading={createMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading components...</p>
          </div>
        ) : components.length === 0 ? (
          <Card className="border-0">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Code className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No components yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first reusable component to get started
              </p>
              <Button
                onClick={() => setIsCreateOpen(true)}
                data-testid="button-create-first-component"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Component
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {components.map((component) => (
              <Card
                key={component.id}
                className="border border-white/10 hover:border-white/20 transition-all"
                data-testid={`card-component-${component.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="inline-block px-2 py-1 rounded text-xs font-medium bg-primary/20 text-primary mb-2">
                        {componentTypes.find((t) => t.value === component.type)?.label}
                      </div>
                      <CardTitle className="text-lg mb-1">{component.name}</CardTitle>
                      <CardDescription className="font-mono text-xs">
                        ID: {component.id.substring(0, 8)}...
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-muted/50 rounded p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">iOS Code</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(component.id)}
                        data-testid={`button-copy-${component.id}`}
                        className="h-6 px-2"
                      >
                        {copiedId === component.id ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                    <code className="text-xs block overflow-x-auto">
                      ReachuComponent(componentId: "{component.id}")
                    </code>
                  </div>

                  <div className="flex gap-2">
                    <Dialog open={editingComponent?.id === component.id} onOpenChange={(open) => !open && setEditingComponent(null)}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-0"
                          onClick={() => setEditingComponent(component)}
                          data-testid={`button-edit-${component.id}`}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                          <DialogTitle>Edit Component</DialogTitle>
                          <DialogDescription>
                            Update the component configuration.
                          </DialogDescription>
                        </DialogHeader>
                        {editingComponent && (
                          <ComponentForm
                            component={editingComponent}
                            onSubmit={(data) =>
                              updateMutation.mutate({ id: component.id, data })
                            }
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
                      className="border-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function ComponentForm({
  component,
  onSubmit,
  isLoading,
}: {
  component?: Component;
  onSubmit: (data: { type: string; name: string; config: any }) => void;
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
              label="Imagen del Banner"
              value={config.imageUrl || ''}
              onChange={(url) => setConfig({ ...config, imageUrl: url })}
              placeholder="https://example.com/banner.jpg"
              testId="input-imageUrl"
            />
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                placeholder="50% OFF en Todo"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                data-testid="input-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtítulo (Opcional)</Label>
              <Input
                id="subtitle"
                placeholder="Oferta por tiempo limitado"
                value={config.subtitle || ''}
                onChange={(e) => setConfig({ ...config, subtitle: e.target.value })}
                data-testid="input-subtitle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctaText">Texto del Botón (Opcional)</Label>
              <Input
                id="ctaText"
                placeholder="Comprar Ahora"
                value={config.ctaText || ''}
                onChange={(e) => setConfig({ ...config, ctaText: e.target.value })}
                data-testid="input-ctaText"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ctaLink">Enlace del Botón (Opcional)</Label>
              <Input
                id="ctaLink"
                placeholder="https://example.com/sale"
                value={config.ctaLink || ''}
                onChange={(e) => setConfig({ ...config, ctaLink: e.target.value })}
                data-testid="input-ctaLink"
              />
            </div>
          </>
        );
      case 'countdown':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="datetime-local"
                value={config.endDate || ''}
                onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
                data-testid="input-endDate"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Sale Ends In"
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                data-testid="input-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="style">Style</Label>
              <Select
                value={config.style || 'full'}
                onValueChange={(value) => setConfig({ ...config, style: value })}
              >
                <SelectTrigger data-testid="select-style">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
              <Label htmlFor="channelId">Reachu Channel ID</Label>
              <Input
                id="channelId"
                placeholder="ch_123"
                value={config.channelId || ''}
                onChange={(e) => setConfig({ ...config, channelId: e.target.value })}
                data-testid="input-channelId"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayCount">Display Count</Label>
              <Input
                id="displayCount"
                type="number"
                placeholder="5"
                value={config.displayCount || 5}
                onChange={(e) => setConfig({ ...config, displayCount: parseInt(e.target.value) })}
                data-testid="input-displayCount"
              />
            </div>
          </>
        );
      case 'carousel_manual':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="productIds">Product IDs (comma-separated)</Label>
              <Textarea
                id="productIds"
                placeholder="prod_1, prod_2, prod_3"
                value={config.productIds?.join(', ') || ''}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    productIds: e.target.value.split(',').map((id) => id.trim()),
                  })
                }
                data-testid="input-productIds"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayCount">Display Count</Label>
              <Input
                id="displayCount"
                type="number"
                placeholder="5"
                value={config.displayCount || 5}
                onChange={(e) => setConfig({ ...config, displayCount: parseInt(e.target.value) })}
                data-testid="input-displayCount"
              />
            </div>
          </>
        );
      case 'product_spotlight':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="productId">Product ID</Label>
              <Input
                id="productId"
                placeholder="prod_123"
                value={config.productId || ''}
                onChange={(e) => setConfig({ ...config, productId: e.target.value })}
                data-testid="input-productId"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="highlightText">Highlight Text (Optional)</Label>
              <Input
                id="highlightText"
                placeholder="Featured Product"
                value={config.highlightText || ''}
                onChange={(e) => setConfig({ ...config, highlightText: e.target.value })}
                data-testid="input-highlightText"
              />
            </div>
          </>
        );
      case 'offer_badge':
        return (
          <>
            <div className="space-y-2">
              <Label htmlFor="text">Text</Label>
              <Input
                id="text"
                placeholder="SALE"
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
      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="type">Component Type</Label>
        <Select value={type} onValueChange={(value) => setType(value as ComponentType)} disabled={!!component}>
          <SelectTrigger data-testid="select-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {componentTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Component Name</Label>
        <Input
          id="name"
          placeholder="My Banner"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          data-testid="input-name"
        />
      </div>

      {renderConfigFields()}

      <Button type="submit" disabled={isLoading} className="w-full" data-testid="button-submit">
        {isLoading ? 'Saving...' : component ? 'Update Component' : 'Create Component'}
      </Button>
    </form>
  );
}
