import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Campaign } from '@shared/schema';
import { Plus, Rocket, Calendar, Settings } from 'lucide-react';

export default function CampaignsPage() {
  // Fetch campaigns
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
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
            
            <Link href="/docs">
              <Button variant="ghost" size="sm" data-testid="link-docs" className="text-xs sm:text-sm">
                Docs
              </Button>
            </Link>
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
        {isLoading ? (
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
                  <div className="flex items-start justify-between">
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
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Link href={`/campaign/${campaign.id}/admin`} className="flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-0"
                        data-testid={`button-admin-${campaign.id}`}
                      >
                        Admin
                      </Button>
                    </Link>
                    <Link href={`/campaign/${campaign.id}/advanced`} className="flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-0"
                        data-testid={`button-advanced-${campaign.id}`}
                      >
                        <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                        Advanced
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
