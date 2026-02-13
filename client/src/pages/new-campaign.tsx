import { useState } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/contexts/UserContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppLayout } from '@/components/AppLayout';
import type { Campaign, ClientApp } from '@shared/schema';
import { Megaphone, Calendar, ImageIcon } from 'lucide-react';

export default function NewCampaignPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { userId } = useUser();

  const searchParams = new URLSearchParams(window.location.search);
  const preselectedAppId = searchParams.get('appId');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState('');
  const [selectedAppId, setSelectedAppId] = useState<string>(preselectedAppId || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: clientApps = [] } = useQuery<ClientApp[]>({
    queryKey: ['/api/client-apps', userId],
    queryFn: async () => {
      const res = await fetch(`/api/client-apps?userId=${userId}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!userId,
  });

  const preselectedApp = clientApps.find(a => a.id === parseInt(preselectedAppId || ''));

  const createMutation = useMutation<Campaign, Error, any>({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', '/api/campaigns', data);
      return response.json();
    },
    onSuccess: (newCampaign) => {
      toast({ title: 'Campaign Created', description: 'Your new campaign is ready.' });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key === '/api/campaigns' || key === '/api/client-apps';
        }
      });
      setLocation(`/campaigns/${newCampaign.id}`);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Could not create campaign', variant: 'destructive' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userId) return;

    const data: any = {
      name: name.trim(),
      description: description.trim() || undefined,
      logo: logo.trim() || undefined,
      userId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    };

    if (selectedAppId && selectedAppId !== 'none') {
      data.clientAppId = parseInt(selectedAppId);
    }

    createMutation.mutate(data);
  };

  const breadcrumbs = preselectedApp
    ? [
        { label: 'Apps', href: '/apps' },
        { label: preselectedApp.name, href: `/apps/${preselectedApp.id}` },
        { label: 'New Campaign' },
      ]
    : [
        { label: 'Campaigns', href: '/campaigns' },
        { label: 'New Campaign' },
      ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100" data-testid="text-page-title">
              Create New Campaign
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Set up a new campaign to manage broadcasts and events.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Basic Information
            </h2>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">Campaign Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Summer Sale 2026"
                required
                data-testid="input-campaign-name"
                className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-gray-700 dark:text-gray-300">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the campaign"
                rows={3}
                data-testid="input-campaign-description"
                className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo" className="text-gray-700 dark:text-gray-300">
                <span className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Logo URL
                </span>
              </Label>
              <Input
                id="logo"
                value={logo}
                onChange={(e) => setLogo(e.target.value)}
                placeholder="https://example.com/logo.png"
                data-testid="input-campaign-logo"
                className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-6 space-y-5">
            <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              App & Schedule
            </h2>

            <div className="space-y-2">
              <Label className="text-gray-700 dark:text-gray-300">Assign to App</Label>
              <Select value={selectedAppId} onValueChange={setSelectedAppId}>
                <SelectTrigger
                  data-testid="select-app"
                  className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                >
                  <SelectValue placeholder="Select an app (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No app</SelectItem>
                  {clientApps.map((app) => (
                    <SelectItem key={app.id} value={String(app.id)} data-testid={`option-app-${app.id}`}>
                      {app.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Link this campaign to an app to share components and branding.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-gray-700 dark:text-gray-300">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Start Date
                  </span>
                </Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                  className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-gray-700 dark:text-gray-300">
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> End Date
                  </span>
                </Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                  className="bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation(preselectedAppId ? `/apps/${preselectedAppId}` : '/campaigns')}
              data-testid="button-cancel"
              className="border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !name.trim()}
              data-testid="button-create-campaign"
              className="bg-purple-600 hover:bg-purple-700 text-white gap-2"
            >
              <Megaphone className="w-4 h-4" />
              {createMutation.isPending ? 'Creating...' : 'Create Campaign'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
