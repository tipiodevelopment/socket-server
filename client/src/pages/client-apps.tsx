import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { ClientApp, Channel } from '@shared/schema';
import { Plus, Rocket, Key, Copy, RefreshCw, Trash2, ArrowLeft, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';

const USER_SESSION_KEY = "reachu_simulated_user_id";

const createClientAppSchema = z.object({
  name: z.string().min(1, 'App name is required').max(255, 'App name too long'),
  bundleId: z.string().min(1, 'Bundle ID is required').max(255, 'Bundle ID too long'),
});

type CreateClientAppForm = z.infer<typeof createClientAppSchema>;

interface ClientAppWithChannels extends ClientApp {
  channels?: Channel[];
}

export default function ClientAppsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [expandedApps, setExpandedApps] = useState<Set<number>>(new Set());
  const [visibleApiKeys, setVisibleApiKeys] = useState<Set<number>>(new Set());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const form = useForm<CreateClientAppForm>({
    resolver: zodResolver(createClientAppSchema),
    defaultValues: {
      name: '',
      bundleId: '',
    },
  });

  useEffect(() => {
    const storedUserId = localStorage.getItem(USER_SESSION_KEY);
    if (storedUserId) {
      fetch('/api/users/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reachuUserId: storedUserId })
      })
        .then(res => res.json())
        .then(user => setCurrentUserId(user.id))
        .catch(() => setLocation('/user-session'));
    } else {
      setLocation('/user-session');
    }
  }, [setLocation]);

  const { data: clientApps = [], isLoading } = useQuery<ClientApp[]>({
    queryKey: ['/api/client-apps', currentUserId],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps?userId=${currentUserId}`);
      if (!res.ok) throw new Error('Failed to fetch client apps');
      return res.json();
    },
    enabled: !!currentUserId
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; bundleId: string; userId: number }) => {
      const response = await apiRequest('POST', '/api/client-apps', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', currentUserId] });
      setCreateDialogOpen(false);
      form.reset();
      toast({
        title: 'Client App Created',
        description: 'Your new client app is ready to use',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create client app',
        variant: 'destructive',
      });
    }
  });

  const regenerateKeyMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/client-apps/${id}/regenerate-key`, { userId: currentUserId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', currentUserId] });
      toast({
        title: 'API Key Regenerated',
        description: 'The new API key is now active. Update your SDK configuration.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to regenerate API key',
        variant: 'destructive',
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/client-apps/${id}?userId=${currentUserId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', currentUserId] });
      toast({
        title: 'Client App Deleted',
        description: 'The client app has been deleted successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete client app',
        variant: 'destructive',
      });
    }
  });

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: `${label} copied to clipboard`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const toggleExpand = (appId: number) => {
    const newExpanded = new Set(expandedApps);
    if (newExpanded.has(appId)) {
      newExpanded.delete(appId);
    } else {
      newExpanded.add(appId);
    }
    setExpandedApps(newExpanded);
  };

  const toggleApiKeyVisibility = (appId: number) => {
    const newVisible = new Set(visibleApiKeys);
    if (newVisible.has(appId)) {
      newVisible.delete(appId);
    } else {
      newVisible.add(appId);
    }
    setVisibleApiKeys(newVisible);
  };

  const onSubmitCreateApp = (data: CreateClientAppForm) => {
    if (!currentUserId) return;
    createMutation.mutate({ ...data, userId: currentUserId });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-lg flex items-center justify-center">
                <Rocket className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-foreground">Client Apps</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Manage your SDK integrations</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Link href="/campaigns">
                <Button variant="ghost" size="sm" data-testid="link-campaigns" className="text-xs sm:text-sm gap-1.5">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Campaigns
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">My Client Apps</h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Manage your mobile and web applications
            </p>
          </div>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-app" className="gap-2 w-full sm:w-auto">
                <Plus className="w-4 h-4" />
                New Client App
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Client App</DialogTitle>
                <DialogDescription>
                  Add a new mobile or web application to integrate with your campaigns.
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
                          <Input
                            placeholder="e.g. XXL iOS App"
                            data-testid="input-app-name"
                            {...field}
                          />
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
                          <Input
                            placeholder="e.g. com.xxl.iosapp"
                            data-testid="input-bundle-id"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          The unique identifier for your app (iOS Bundle ID or Android Package Name)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button 
                      type="submit" 
                      disabled={createMutation.isPending}
                      data-testid="button-submit-app"
                    >
                      {createMutation.isPending ? 'Creating...' : 'Create App'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading client apps...</p>
          </div>
        ) : clientApps.length === 0 ? (
          <Card className="border-0">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Key className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No client apps yet</h3>
              <p className="text-muted-foreground mb-4 text-center max-w-md">
                Create a client app to get an API key for your SDK integration
              </p>
              <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-app">
                <Plus className="w-4 h-4 mr-2" />
                Create Client App
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {clientApps.map((app) => (
              <Card 
                key={app.id} 
                className="border border-white/10"
                data-testid={`card-app-${app.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="p-0 h-auto"
                          onClick={() => toggleExpand(app.id)}
                          data-testid={`button-expand-${app.id}`}
                        >
                          {expandedApps.has(app.id) ? (
                            <ChevronDown className="w-5 h-5" />
                          ) : (
                            <ChevronRight className="w-5 h-5" />
                          )}
                        </Button>
                        <CardTitle className="text-lg">{app.name}</CardTitle>
                      </div>
                      <CardDescription className="ml-7">
                        {app.bundleId}
                      </CardDescription>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          data-testid={`button-delete-${app.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Client App?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{app.name}"? This will invalidate the API key and break any SDK integrations using it.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(app.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                
                {expandedApps.has(app.id) && (
                  <CardContent className="pt-4 border-t border-white/10 ml-7">
                    <div className="space-y-4">
                      <div>
                        <Label className="text-muted-foreground text-sm">API Key</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="flex-1 bg-muted/50 px-3 py-2 rounded text-sm font-mono overflow-hidden">
                            {visibleApiKeys.has(app.id) 
                              ? app.apiKey 
                              : '•'.repeat(Math.min(app.apiKey.length, 40))}
                          </code>
                          <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0 border-0"
                            onClick={() => toggleApiKeyVisibility(app.id)}
                            data-testid={`button-toggle-visibility-${app.id}`}
                          >
                            {visibleApiKeys.has(app.id) ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0 border-0"
                            onClick={() => copyToClipboard(app.apiKey, 'API Key')}
                            data-testid={`button-copy-key-${app.id}`}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                className="shrink-0 border-0"
                                data-testid={`button-regenerate-${app.id}`}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Regenerate API Key?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will create a new API key and invalidate the current one. Any SDK using the old key will stop working.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => regenerateKeyMutation.mutate(app.id)}
                                >
                                  Regenerate
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Use this key in your SDK configuration to authenticate API requests
                        </p>
                      </div>

                      <div className="pt-2">
                        <Label className="text-muted-foreground text-sm">SDK Configuration</Label>
                        <div className="bg-muted/30 rounded-lg p-3 mt-1">
                          <pre className="text-xs overflow-x-auto">
{`// Swift SDK
ReachuSDK.configure(
    apiKey: "${app.apiKey}",
    environment: .production
)`}
                          </pre>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Created: {new Date(app.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
