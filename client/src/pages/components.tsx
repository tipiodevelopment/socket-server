import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { AppLayout } from '@/components/AppLayout';
import type { Component, ComponentType } from '@shared/schema';
import { Plus, Image, Timer, Layers, Star, Percent, Video, HelpCircle, Trophy, Share2, Search, Megaphone } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { ComponentForm } from '@/components/ComponentLibraryTab';

const componentTypes: { value: ComponentType; label: string }[] = [
  { value: 'banner', label: 'Banner' },
  { value: 'countdown', label: 'Countdown' },
  { value: 'carousel_auto', label: 'Auto Carousel' },
  { value: 'carousel_manual', label: 'Manual Carousel' },
  { value: 'product_spotlight', label: 'Product Spotlight' },
  { value: 'offer_badge', label: 'Offer Badge' },
  { value: 'offer_banner', label: 'Offer Banner' },
  { value: 'product_carousel', label: 'Product Carousel' },
  { value: 'product_banner', label: 'Product Banner' },
  { value: 'product_store', label: 'Product Store' },
];

const filterOptions = ['All', 'Banner', 'Countdown', 'Carousel', 'Spotlight', 'Badge', 'Products'];

function getComponentIcon(type: string) {
  switch (type) {
    case 'banner':
    case 'offer_banner':
    case 'product_banner':
      return <Image className="w-5 h-5" />;
    case 'countdown':
      return <Timer className="w-5 h-5" />;
    case 'carousel_auto':
    case 'carousel_manual':
    case 'product_carousel':
      return <Layers className="w-5 h-5" />;
    case 'product_spotlight':
      return <Star className="w-5 h-5" />;
    case 'offer_badge':
      return <Percent className="w-5 h-5" />;
    case 'product_store':
      return <Share2 className="w-5 h-5" />;
    default:
      return <HelpCircle className="w-5 h-5" />;
  }
}

function getTypeLabel(type: string): string {
  return componentTypes.find(t => t.value === type)?.label || type;
}

function matchesFilter(type: string, filter: string): boolean {
  if (filter === 'All') return true;
  const lowerFilter = filter.toLowerCase();
  const lowerType = type.toLowerCase();
  if (lowerFilter === 'banner') return lowerType === 'banner' || lowerType === 'offer_banner' || lowerType === 'product_banner';
  if (lowerFilter === 'countdown') return lowerType === 'countdown';
  if (lowerFilter === 'carousel') return lowerType.includes('carousel');
  if (lowerFilter === 'spotlight') return lowerType.includes('spotlight');
  if (lowerFilter === 'badge') return lowerType.includes('badge');
  if (lowerFilter === 'products') return lowerType.startsWith('product_') || lowerType === 'offer_badge' || lowerType === 'offer_banner';
  return false;
}

export default function ComponentsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [templatesOnly, setTemplatesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: components = [], isLoading } = useQuery<Component[]>({
    queryKey: ['/api/components'],
  });

  const { data: componentUsage = {} } = useQuery<Record<string, Array<{ campaignId: number; campaignName: string }>>>({
    queryKey: ['/api/components/usage'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { type: string; name: string; config: Record<string, unknown> }) => {
      return await apiRequest('POST', '/api/components', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      queryClient.invalidateQueries({ queryKey: ['/api/components/usage'] });
      setIsCreateOpen(false);
      toast({ title: 'Component Created' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create component.', variant: 'destructive' });
    },
  });

  const filteredComponents = useMemo(() => {
    return components.filter(c => {
      if (!matchesFilter(c.type, activeFilter)) return false;
      if (templatesOnly && c.isTemplate !== 'true' && c.isTemplate !== true) return false;
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [components, activeFilter, templatesOnly, searchQuery]);

  return (
    <AppLayout
      breadcrumbs={[{ label: 'Components' }]}
      title="Component Library"
      subtitle="Reusable components for campaigns: banners, carousels, countdowns and more"
      actions={
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button
              className="gap-2 bg-[#3d8b7a] hover:bg-[#2f7365] dark:bg-white dark:hover:bg-gray-200 text-white dark:text-black"
              data-testid="button-create-component"
            >
              <Plus className="w-4 h-4" />
              New Component
            </Button>
          </DialogTrigger>
            <DialogContent
              className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
              onInteractOutside={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>Create New Component</DialogTitle>
                <DialogDescription>Create a reusable component for your campaigns.</DialogDescription>
              </DialogHeader>
              <ComponentForm
                onSubmit={(data) => createMutation.mutate(data)}
                onCancel={() => setIsCreateOpen(false)}
                isLoading={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
      }
    >
      <div className="flex items-center justify-between mb-8 mt-0">
          <div className="flex items-center space-x-2">
            <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 p-1 rounded-lg flex items-center">
              {filterOptions.map(filter => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                    activeFilter === filter
                      ? 'bg-[#3d8b7a] text-white dark:bg-white dark:text-black shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid={`filter-${filter.toLowerCase()}`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <button
              onClick={() => setTemplatesOnly(!templatesOnly)}
              className={`flex items-center space-x-2 px-3 py-2 bg-transparent border rounded-lg text-xs transition ml-2 ${
                templatesOnly
                  ? 'border-[#3d8b7a] dark:border-white/40 text-foreground'
                  : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/30 text-muted-foreground hover:text-foreground'
              }`}
              data-testid="filter-templates-only"
            >
              <div className={`w-3 h-3 rounded-sm border ${templatesOnly ? 'bg-[#3d8b7a] dark:bg-white border-[#3d8b7a] dark:border-white' : 'border-muted-foreground'}`}></div>
              <span>Templates only</span>
            </button>
          </div>

          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-3.5 h-3.5" />
            <input
              type="text"
              placeholder="Search components..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-gray-400 dark:focus:border-white/30 transition"
              data-testid="input-search"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Loading components...</p>
          </div>
        ) : filteredComponents.length === 0 ? (
          <div className="text-center py-16">
            <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-foreground mb-1">
              {components.length === 0 ? 'No components yet' : 'No matching components'}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {components.length === 0 ? 'Create your first reusable component to get started' : 'Try adjusting your filters or search'}
            </p>
            {components.length === 0 && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="px-4 py-2 bg-[#3d8b7a] text-white dark:bg-white dark:text-black rounded text-sm font-medium hover:bg-[#2f7365] dark:hover:bg-gray-200 transition"
                data-testid="button-create-first-component"
              >
                <Plus className="w-3.5 h-3.5 inline mr-1.5" />
                Create Component
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredComponents.map((component) => {
              const usage = componentUsage[component.id] || [];
              const isTemplate = component.isTemplate === true || component.isTemplate === 'true';
              return (
                <div
                  key={component.id}
                  onClick={() => setLocation(`/components/${component.id}`)}
                  className="group bg-white dark:bg-transparent border border-gray-200 dark:border-white/10 rounded-xl p-5 hover:border-gray-300 dark:hover:border-white/30 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition cursor-pointer flex flex-col h-48"
                  data-testid={`card-component-${component.id}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 bg-gray-100 dark:bg-white/5 rounded-lg flex items-center justify-center text-muted-foreground group-hover:text-foreground transition">
                      {getComponentIcon(component.type)}
                    </div>
                  </div>
                  <div className="mt-auto">
                    <h3 className="text-sm font-semibold text-foreground mb-1" data-testid={`text-component-name-${component.id}`}>{component.name}</h3>
                    <p className="text-xs text-muted-foreground mb-4">{getTypeLabel(component.type)}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 text-xs text-muted-foreground">
                        <Megaphone className="w-2.5 h-2.5" />
                        <span>Used in {usage.length} campaign{usage.length !== 1 ? 's' : ''}</span>
                      </div>
                      {isTemplate && (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-white/10 text-foreground/70 text-[10px] font-medium rounded">Template</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </AppLayout>
  );
}
