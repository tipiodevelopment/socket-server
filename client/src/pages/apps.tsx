import { Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useUser } from '@/contexts/UserContext';
import { AppLayout } from '@/components/AppLayout';
import type { ClientApp } from '@shared/schema';
import { ImageUploadWithPreview } from '@/components/ImageUploadWithPreview';
import { Plus, Smartphone, Pencil, Settings, MoreVertical, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface ClientAppWithStats extends ClientApp {
  stats: {
    campaignCount: number;
    activeBroadcasts: number;
    totalViewers: number;
    channelCount: number;
    engagementPercent: number;
  };
}

const createClientAppSchema = z.object({
  name: z.string().min(1, 'App name is required').max(255, 'App name too long'),
  bundleId: z.string().min(1, 'Bundle ID is required').max(255, 'Bundle ID too long'),
  iconUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
});

type CreateClientAppForm = z.infer<typeof createClientAppSchema>;

function formatViewers(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return Math.round(num / 1000) + 'K';
  return num.toString();
}

const APP_GRADIENTS = [
  'from-gray-700 to-gray-800',
  'from-gray-600 to-gray-800',
  'from-gray-600 to-gray-700',
  'from-gray-500 to-gray-700',
  'from-gray-600 to-gray-700',
  'from-gray-600 to-gray-800',
];

function AppBanner({ bannerUrl, gradient, appId, appName }: { bannerUrl: string | null | undefined; gradient: string; appId: number; appName: string }) {
  const [bannerError, setBannerError] = useState(false);
  const showImage = bannerUrl && !bannerError;
  return (
    <div className={`h-24 w-full overflow-hidden ${!showImage ? `bg-gradient-to-br ${gradient}` : ''}`}>
      {showImage && (
        <img
          src={bannerUrl}
          alt={`${appName} banner`}
          className="w-full h-full object-cover"
          data-testid={`img-banner-${appId}`}
          onError={() => setBannerError(true)}
        />
      )}
    </div>
  );
}

function AppAvatar({ iconUrl, appId, appName }: { iconUrl: string | null | undefined; appId: number; appName: string }) {
  const [iconError, setIconError] = useState(false);
  const showIcon = iconUrl && !iconError;
  return (
    <div
      className="w-11 h-11 bg-gray-100 dark:bg-[#1e2433] border-2 border-white dark:border-[#141824] rounded-xl flex items-center justify-center shadow-lg overflow-hidden"
      data-testid={`img-logo-${appId}`}
    >
      {showIcon ? (
        <img
          src={iconUrl}
          alt={`${appName} logo`}
          className="w-full h-full object-cover"
          onError={() => setIconError(true)}
        />
      ) : (
        <Smartphone className="w-5 h-5 text-gray-500 dark:text-white/60" />
      )}
    </div>
  );
}



export default function AppsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { userId } = useUser();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appToDelete, setAppToDelete] = useState<ClientAppWithStats | null>(null);

  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');

  const form = useForm<CreateClientAppForm>({
    resolver: zodResolver(createClientAppSchema),
    defaultValues: { name: '', bundleId: '', iconUrl: '', bannerUrl: '' },
  });

  const { data: clientApps = [], isLoading } = useQuery<ClientAppWithStats[]>({
    queryKey: ['/api/client-apps/with-stats', userId],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps/with-stats?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch client apps');
      return res.json();
    },
    enabled: !!userId
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; bundleId: string; userId: number; iconUrl?: string; bannerUrl?: string }) => {
      const response = await apiRequest('POST', '/api/client-apps', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps/with-stats', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', userId] });
      setCreateDialogOpen(false);
      form.reset();
      setLogoUrl('');
      setBannerUrl('');
      toast({ title: 'App Created', description: 'Your new app is ready to use' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create app', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/client-apps/${id}?userId=${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps/with-stats', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', userId] });
      setDeleteDialogOpen(false);
      setAppToDelete(null);
      toast({ title: 'App Deleted', description: 'The app has been deleted.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete app', variant: 'destructive' });
    }
  });

  const onSubmitCreateApp = (data: CreateClientAppForm) => {
    if (!userId) return;
    createMutation.mutate({
      name: data.name,
      bundleId: data.bundleId,
      userId,
      iconUrl: logoUrl || undefined,
      bannerUrl: bannerUrl || undefined,
    });
  };

  return (
    <AppLayout
      title="Client Apps"
      subtitle="Manage your client applications and their campaigns"
    >
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New App</DialogTitle>
            <DialogDescription>
              Add a new mobile or web application to manage campaigns.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitCreateApp)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>App Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. LaLiga Fan App" data-testid="input-app-name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bundleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bundle ID</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. com.laliga.fanapp" data-testid="input-bundle-id" {...field} />
                    </FormControl>
                    <FormDescription>
                      The unique identifier for your app (iOS Bundle ID or Android Package Name)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ImageUploadWithPreview
                label="Logo"
                value={logoUrl}
                onChange={setLogoUrl}
                placeholder="Upload or paste logo URL"
                testId="input-app-logo"
              />
              <ImageUploadWithPreview
                label="Banner"
                value={bannerUrl}
                onChange={setBannerUrl}
                placeholder="Upload or paste banner URL"
                testId="input-app-banner"
              />
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-app" className="bg-[#3d8b7a] hover:bg-[#2f7365] dark:bg-white dark:hover:bg-gray-200 text-white dark:text-[#0a0e1a]">
                  {createMutation.isPending ? 'Creating...' : 'Create App'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">All Client Apps</h2>
          <p className="text-sm text-gray-500 dark:text-white/40">{clientApps.length} app{clientApps.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Button
          data-testid="button-create-app"
          onClick={() => setCreateDialogOpen(true)}
          className="gap-2 bg-[#3d8b7a] hover:bg-[#2f7365] dark:bg-white dark:hover:bg-gray-200 text-white dark:text-[#0a0e1a]"
        >
          <Plus className="w-4 h-4" />
          New App
        </Button>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden animate-pulse">
              <div className="h-24 bg-gray-200 dark:bg-white/5" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-gray-200 dark:bg-white/5 rounded w-1/2" />
                <div className="h-8 bg-gray-200 dark:bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : clientApps.length === 0 ? (
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl p-12 text-center">
          <Smartphone className="w-12 h-12 text-gray-300 dark:text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No apps yet</h3>
          <p className="text-gray-500 dark:text-white/40 mb-4 max-w-md mx-auto">
            Create your first app to start managing campaigns and broadcasts
          </p>
          <Button onClick={() => setCreateDialogOpen(true)} className="bg-[#3d8b7a] hover:bg-[#2f7365] dark:bg-white dark:hover:bg-gray-200 text-white dark:text-[#0a0e1a]" data-testid="button-create-first-app">
            <Plus className="w-4 h-4 mr-2" />
            Create App
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientApps.map((app, index) => {
            const gradient = APP_GRADIENTS[index % APP_GRADIENTS.length];

            return (
              <div
                key={app.id}
                className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden hover:border-gray-300 dark:hover:border-white/20 transition-all group"
                data-testid={`card-app-${app.id}`}
              >
                {/* Banner */}
                <div className="relative">
                  <AppBanner
                    bannerUrl={app.bannerUrl}
                    gradient={gradient}
                    appId={app.id}
                    appName={app.name}
                  />

                  {/* Avatar overlapping bottom of banner */}
                  <div className="absolute left-4 -bottom-5 z-10">
                    <AppAvatar
                      iconUrl={app.iconUrl}
                      appId={app.id}
                      appName={app.name}
                    />
                  </div>

                  {/* Campaign badge */}
                  <div className="absolute top-3 right-3 z-10">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-black/60 text-white backdrop-blur-sm" data-testid={`badge-campaigns-${app.id}`}>
                      {app.stats.campaignCount} Campaign{app.stats.campaignCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="p-4 pt-8">
                  <div className="mb-4">
                    <Link href={`/apps/${app.id}`}>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer truncate" data-testid={`text-app-name-${app.id}`}>
                        {app.name}
                      </h3>
                    </Link>
                    <p className="text-xs text-gray-400 dark:text-white/30 font-mono truncate" data-testid={`text-bundle-id-${app.id}`}>{app.bundleId}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/30 mb-0.5">Active Broadcasts</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white" data-testid={`text-broadcasts-${app.id}`}>{app.stats.activeBroadcasts}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/30 mb-0.5">Total Viewers</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white" data-testid={`text-viewers-${app.id}`}>{formatViewers(app.stats.totalViewers)}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-1.5">
                      <div
                        className="bg-gray-800 dark:bg-white h-1.5 rounded-full transition-all"
                        style={{ width: `${app.stats.engagementPercent}%` }}
                      />
                    </div>
                    <p className="text-right text-[10px] text-gray-400 dark:text-white/30 mt-1">{app.stats.engagementPercent}%</p>
                  </div>

                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-white/5">
                    <Link href={`/apps/${app.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80 h-8"
                        data-testid={`button-edit-app-${app.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </Button>
                    </Link>
                    <Link href={`/apps/${app.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80 h-8"
                        data-testid={`button-settings-app-${app.id}`}
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Settings
                      </Button>
                    </Link>
                    <div className="ml-auto">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/60"
                            data-testid={`button-more-app-${app.id}`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-red-500 focus:text-red-600"
                            onClick={() => {
                              setAppToDelete(app);
                              setDeleteDialogOpen(true);
                            }}
                            data-testid={`button-delete-app-${app.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete App
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete App?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{appToDelete?.name}"? This will remove all channels, campaigns, and broadcasts associated with this app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAppToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => appToDelete && deleteMutation.mutate(appToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
