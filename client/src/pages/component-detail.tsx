import { useParams, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { AppLayout } from '@/components/AppLayout';
import type { BreadcrumbItem } from '@/components/AppLayout';
import { ComponentForm } from '@/components/ComponentLibraryTab';
import type { Component, ComponentType } from '@shared/schema';
import { ArrowLeft, Copy, Check, Trash2, Edit, Image, Timer, Layers, Star, Percent, Share2, HelpCircle, Megaphone } from 'lucide-react';
import { useState } from 'react';

const componentTypeLabels: Record<string, string> = {
  banner: 'Banner',
  countdown: 'Countdown',
  carousel_auto: 'Auto Carousel',
  carousel_manual: 'Manual Carousel',
  product_spotlight: 'Product Spotlight',
  offer_badge: 'Offer Badge',
  offer_banner: 'Offer Banner',
  product_carousel: 'Product Carousel',
  product_banner: 'Product Banner',
  product_store: 'Product Store',
};

function getComponentIcon(type: string) {
  switch (type) {
    case 'banner':
    case 'offer_banner':
    case 'product_banner':
      return <Image className="w-6 h-6" />;
    case 'countdown':
      return <Timer className="w-6 h-6" />;
    case 'carousel_auto':
    case 'carousel_manual':
    case 'product_carousel':
      return <Layers className="w-6 h-6" />;
    case 'product_spotlight':
      return <Star className="w-6 h-6" />;
    case 'offer_badge':
      return <Percent className="w-6 h-6" />;
    case 'product_store':
      return <Share2 className="w-6 h-6" />;
    default:
      return <HelpCircle className="w-6 h-6" />;
  }
}

export default function ComponentDetailPage() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const componentId = params.id;
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: component, isLoading } = useQuery<Component>({
    queryKey: ['/api/components', componentId],
    enabled: !!componentId,
  });

  const { data: componentUsage = {} } = useQuery<Record<string, Array<{ campaignId: number; campaignName: string }>>>({
    queryKey: ['/api/components/usage'],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Component>) => {
      return await apiRequest('PATCH', `/api/components/${componentId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/components', componentId] });
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      queryClient.invalidateQueries({ queryKey: ['/api/components/usage'] });
      setEditOpen(false);
      toast({ title: 'Component Updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update component.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', `/api/components/${componentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      toast({ title: 'Component Deleted' });
      setLocation('/components');
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete component.', variant: 'destructive' });
    },
  });

  const copyToClipboard = () => {
    if (!componentId) return;
    const code = `ReachuComponent(componentId: "${componentId}")`;
    navigator.clipboard.writeText(code);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
    toast({ title: 'Copied!', description: 'iOS code snippet copied to clipboard.' });
  };

  const copyId = () => {
    if (!componentId) return;
    navigator.clipboard.writeText(componentId);
    toast({ title: 'ID Copied!' });
  };

  const buildBreadcrumbs = (): BreadcrumbItem[] => {
    const crumbs: BreadcrumbItem[] = [{ label: 'Components', href: '/components' }];
    if (component) crumbs.push({ label: component.name });
    else crumbs.push({ label: 'Loading...' });
    return crumbs;
  };

  if (isLoading) {
    return (
      <AppLayout breadcrumbs={buildBreadcrumbs()}>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading component...</p>
        </div>
      </AppLayout>
    );
  }

  if (!component) {
    return (
      <AppLayout breadcrumbs={buildBreadcrumbs()}>
        <div className="text-center py-12">
          <p className="text-foreground">Component not found</p>
        </div>
      </AppLayout>
    );
  }

  const usage = componentUsage[component.id] || [];
  const isTemplate = component.isTemplate === 'true';
  const config = component.config as Record<string, unknown>;

  return (
    <AppLayout breadcrumbs={buildBreadcrumbs()}>
      <div className="-mt-2">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setLocation('/components')}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="w-10 h-10 bg-white/5 dark:bg-white/5 rounded-lg flex items-center justify-center text-foreground">
              {getComponentIcon(component.type)}
            </div>
            <div>
              <div className="flex items-center space-x-3 mb-1">
                <h1 className="text-xl font-bold text-foreground" data-testid="text-component-name">{component.name}</h1>
                {isTemplate && (
                  <span className="px-2 py-0.5 bg-white/10 dark:bg-white/10 text-foreground/70 text-[10px] font-medium rounded">Template</span>
                )}
              </div>
              <div className="flex items-center text-xs text-muted-foreground space-x-2">
                <span>{componentTypeLabels[component.type] || component.type}</span>
                <span className="text-muted-foreground/30">/</span>
                <button onClick={copyId} className="font-mono hover:text-foreground transition cursor-pointer" data-testid="button-copy-id">
                  {component.id.substring(0, 12)}...
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <button
                  className="px-3 py-1.5 bg-transparent border border-white/20 dark:border-white/20 hover:border-white/40 dark:hover:border-white/40 text-foreground rounded text-xs font-medium transition"
                  data-testid="button-edit-component"
                >
                  <Edit className="w-3 h-3 inline mr-1.5" />
                  Edit
                </button>
              </DialogTrigger>
              <DialogContent
                className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
                onInteractOutside={(e) => e.preventDefault()}
              >
                <DialogHeader>
                  <DialogTitle>Edit Component</DialogTitle>
                  <DialogDescription>Update the component configuration.</DialogDescription>
                </DialogHeader>
                <ComponentForm
                  component={component}
                  onSubmit={(data) => updateMutation.mutate(data)}
                  onCancel={() => setEditOpen(false)}
                  isLoading={updateMutation.isPending}
                />
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="px-3 py-1.5 bg-transparent border border-red-500/30 hover:border-red-500/60 text-red-400 rounded text-xs font-medium transition"
                  data-testid="button-delete-component"
                >
                  <Trash2 className="w-3 h-3 inline mr-1.5" />
                  Delete
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Component?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this component. Components currently used in campaigns will be affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-transparent border border-white/10 dark:border-white/10 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">iOS Integration</h2>
              <div className="bg-black/30 dark:bg-black/30 rounded-lg p-4 flex items-center justify-between">
                <code className="text-xs text-foreground font-mono" data-testid="text-ios-code">
                  ReachuComponent(componentId: "{component.id}")
                </code>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center space-x-1.5 px-2.5 py-1 bg-white/10 dark:bg-white/10 rounded text-xs text-foreground hover:bg-white/20 dark:hover:bg-white/20 transition"
                  data-testid="button-copy-code"
                >
                  {copiedId ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="bg-transparent border border-white/10 dark:border-white/10 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Configuration</h2>
              {config && Object.keys(config).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(config).map(([key, value]) => (
                    <div key={key} className="flex items-start justify-between py-2 border-b border-white/5 dark:border-white/5 last:border-0">
                      <span className="text-xs text-muted-foreground font-mono">{key}</span>
                      <span className="text-xs text-foreground text-right max-w-[60%] truncate" data-testid={`config-${key}`}>
                        {typeof value === 'object' ? JSON.stringify(value) : String(value || '—')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No configuration set.</p>
              )}
            </div>

            {config && (component.type === 'product_banner' || component.type === 'banner') && (config as Record<string, string>).imageUrl && (
              <div className="bg-transparent border border-white/10 dark:border-white/10 rounded-lg p-5">
                <h2 className="text-sm font-semibold text-foreground mb-4">Preview</h2>
                <div className="rounded-lg overflow-hidden border border-white/10 dark:border-white/10">
                  <img
                    src={String((config as Record<string, string>).backgroundImageUrl || (config as Record<string, string>).imageUrl)}
                    alt={component.name}
                    className="w-full h-48 object-cover"
                    data-testid="img-preview"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-transparent border border-white/10 dark:border-white/10 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Details</h2>
              <div className="space-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Component ID</div>
                  <div className="text-xs text-foreground font-mono break-all" data-testid="text-full-id">{component.id}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Type</div>
                  <div className="text-sm text-foreground" data-testid="text-type">{componentTypeLabels[component.type] || component.type}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Template</div>
                  <div className="text-sm text-foreground">{isTemplate ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Created</div>
                  <div className="text-sm text-foreground" data-testid="text-created">
                    {component.createdAt ? new Date(component.createdAt).toLocaleDateString() : '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-transparent border border-white/10 dark:border-white/10 rounded-lg p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Campaign Usage</h2>
              {usage.length === 0 ? (
                <div className="text-center py-4">
                  <Megaphone className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Not used in any campaigns</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {usage.map((u) => (
                    <button
                      key={u.campaignId}
                      onClick={() => setLocation(`/campaigns/${u.campaignId}`)}
                      className="w-full text-left px-3 py-2 rounded bg-white/5 dark:bg-white/5 hover:bg-white/10 dark:hover:bg-white/10 transition text-xs text-foreground"
                      data-testid={`link-campaign-${u.campaignId}`}
                    >
                      <Megaphone className="w-3 h-3 inline mr-2 text-muted-foreground" />
                      {u.campaignName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
