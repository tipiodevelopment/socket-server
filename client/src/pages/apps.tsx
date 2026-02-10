import { Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { useUser } from '@/contexts/UserContext';
import { AppLayout } from '@/components/AppLayout';
import type { ClientApp } from '@shared/schema';
import { Plus, LayoutGrid, Key, Trash2, ChevronRight, Smartphone } from 'lucide-react';
import { useState } from 'react';

const createClientAppSchema = z.object({
  name: z.string().min(1, 'App name is required').max(255, 'App name too long'),
  bundleId: z.string().min(1, 'Bundle ID is required').max(255, 'Bundle ID too long'),
});

type CreateClientAppForm = z.infer<typeof createClientAppSchema>;

export default function AppsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { userId } = useUser();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const form = useForm<CreateClientAppForm>({
    resolver: zodResolver(createClientAppSchema),
    defaultValues: { name: '', bundleId: '' },
  });

  const { data: clientApps = [], isLoading } = useQuery<ClientApp[]>({
    queryKey: ['/api/client-apps', userId],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch client apps');
      return res.json();
    },
    enabled: !!userId
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; bundleId: string; userId: number }) => {
      const response = await apiRequest('POST', '/api/client-apps', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', userId] });
      setCreateDialogOpen(false);
      form.reset();
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
      queryClient.invalidateQueries({ queryKey: ['/api/client-apps', userId] });
      toast({ title: 'App Deleted', description: 'The app has been deleted.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete app', variant: 'destructive' });
    }
  });

  const onSubmitCreateApp = (data: CreateClientAppForm) => {
    if (!userId) return;
    createMutation.mutate({ ...data, userId });
  };

  return (
    <AppLayout
      breadcrumbs={[{ label: 'My Apps' }]}
      title="My Apps"
      subtitle="Select an app to manage its campaigns and broadcasts"
      actions={
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-app" className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              New App
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                        <Input placeholder="e.g. XXL iOS App" data-testid="input-app-name" {...field} />
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
                        <Input placeholder="e.g. com.xxl.iosapp" data-testid="input-bundle-id" {...field} />
                      </FormControl>
                      <FormDescription>
                        The unique identifier for your app (iOS Bundle ID or Android Package Name)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-app">
                    {createMutation.isPending ? 'Creating...' : 'Create App'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      }
    >
      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading apps...</p>
        </div>
      ) : clientApps.length === 0 ? (
        <Card className="border-0">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Smartphone className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No apps yet</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              Create your first app to start managing campaigns and broadcasts
            </p>
            <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-first-app">
              <Plus className="w-4 h-4 mr-2" />
              Create App
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientApps.map((app) => (
            <Card
              key={app.id}
              className="border border-white/10 hover:border-white/20 transition-all cursor-pointer group"
              data-testid={`card-app-${app.id}`}
            >
              <Link href={`/apps/${app.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <Smartphone className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{app.name}</CardTitle>
                          <CardDescription className="text-xs font-mono">{app.bundleId}</CardDescription>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </CardHeader>
              </Link>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Key className="w-3 h-3" />
                    <span>API Key configured</span>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`button-delete-app-${app.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete App?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{app.name}"? This will remove all channels, campaigns, and broadcasts associated with this app.
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
