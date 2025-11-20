import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { Campaign, User } from '@shared/schema';
import { Plus, Rocket, Calendar, Settings, Trash2, ShoppingBag, User as UserIcon } from 'lucide-react';
import { useState, useEffect } from 'react';

const USER_SESSION_KEY = "reachu_simulated_user_id";

export default function CampaignsPage() {
  const { toast } = useToast();
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [currentUserData, setCurrentUserData] = useState<User | null>(null);

  // Load userId from localStorage
  useEffect(() => {
    const storedUserId = localStorage.getItem(USER_SESSION_KEY);
    if (storedUserId) {
      // Ensure user exists (create if not, return if exists)
      fetch('/api/users/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reachuUserId: storedUserId })
      })
        .then(res => res.json())
        .then(user => {
          setCurrentUserId(user.id);
          setCurrentUserData(user);
        })
        .catch(() => {
          // Failed to create/fetch user, clear localStorage
          localStorage.removeItem(USER_SESSION_KEY);
        });
    }
  }, []);
  
  // Fetch campaigns (filtered by userId if logged in)
  // IMPORTANT: Only fetch when we have a userId to ensure proper multi-tenant scoping
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns', currentUserId],
    queryFn: async () => {
      const url = `/api/campaigns?userId=${currentUserId}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      return res.json();
    },
    enabled: !!currentUserId // Only fetch when userId is loaded from localStorage
  });

  // Delete campaign mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/campaigns/${id}`);
    },
    onSuccess: () => {
      // Invalidate tenant-scoped cache to refresh campaigns list
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', currentUserId] });
      toast({
        title: 'Campaign Deleted',
        description: 'The campaign has been deleted successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete campaign.',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary rounded-lg flex items-center justify-center">
                <Rocket className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-foreground">Campaign Manager</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Manage your event campaigns</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Link href="/components">
                <Button variant="default" size="sm" data-testid="link-components" className="text-xs sm:text-sm gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Components
                </Button>
              </Link>
              <Link href="/docs">
                <Button variant="ghost" size="sm" data-testid="link-docs" className="text-xs sm:text-sm">
                  Docs
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">My Campaigns</h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Select a campaign to send events, or create a new one
            </p>
          </div>
          
          <Link href="/campaigns/new" className="w-full sm:w-auto">
            <Button data-testid="button-create-campaign" className="gap-2 w-full sm:w-auto">
              <Plus className="w-4 h-4" />
              New Campaign
            </Button>
          </Link>
        </div>

        {/* Campaigns Grid */}
        {!currentUserId ? (
          <Card className="border-0">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <UserIcon className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">User Session Required</h3>
              <p className="text-muted-foreground mb-4 text-center max-w-md">
                Please select a user to view campaigns. This simulates multi-tenant isolation until full authentication is integrated.
              </p>
              <Link href="/user-session">
                <Button data-testid="button-goto-user-session">
                  <UserIcon className="w-4 h-4 mr-2" />
                  Select User Session
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading campaigns...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <Card className="border-0">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Rocket className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first campaign
              </p>
              <Link href="/campaigns/new">
                <Button data-testid="button-create-first-campaign">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Campaign
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((campaign) => (
              <Card 
                key={campaign.id} 
                className="border border-white/10 hover:border-white/20 transition-all"
                data-testid={`card-campaign-${campaign.id}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      {campaign.logo && (
                        <div className="mb-3">
                          <img 
                            src={campaign.logo} 
                            alt={campaign.name}
                            className="w-12 h-12 object-contain rounded"
                          />
                        </div>
                      )}
                      <CardTitle className="text-lg mb-1">{campaign.name}</CardTitle>
                      {campaign.description && (
                        <CardDescription className="line-clamp-2">
                          {campaign.description}
                        </CardDescription>
                      )}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          data-testid={`button-delete-${campaign.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{campaign.name}"? This action cannot be undone. All events and associated data will be permanently deleted.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(campaign.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(campaign.createdAt).toLocaleDateString('en-US')}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/campaign/${campaign.id}/dashboard`} className="flex-1">
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full"
                        data-testid={`button-manage-${campaign.id}`}
                      >
                        <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                        Manage Campaign
                      </Button>
                    </Link>
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
