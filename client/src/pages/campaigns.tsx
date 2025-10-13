import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { Campaign } from '@shared/schema';
import { Plus, Rocket, Calendar, Image } from 'lucide-react';

export default function CampaignsPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    logo: '',
    description: ''
  });

  // Fetch campaigns
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
  });

  // Create campaign mutation
  const createMutation = useMutation<Campaign, Error, typeof formData>({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', '/api/campaigns', data);
      return response.json();
    },
    onSuccess: (newCampaign) => {
      toast({
        title: "Kampanje opprettet",
        description: "Den nye kampanjen er klar til bruk",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      setIsDialogOpen(false);
      setFormData({ name: '', logo: '', description: '' });
      
      // Navigate to the new campaign's admin page
      setLocation(`/campaign/${newCampaign.id}/admin`);
    },
    onError: () => {
      toast({
        title: "Feil",
        description: "Kunne ikke opprette kampanje",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const navigateToCampaign = (campaign: Campaign) => {
    // Navigate to campaign admin page
    setLocation(`/campaign/${campaign.id}/admin`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Rocket className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Kampanjestyring</h1>
                <p className="text-sm text-muted-foreground">Administrer dine hendelseskampanjer</p>
              </div>
            </div>
            
            <Link href="/docs">
              <Button variant="ghost" size="sm" data-testid="link-docs">
                Dokumentasjon
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold">Mine Kampanjer</h2>
            <p className="text-muted-foreground mt-1">
              Velg en kampanje for å sende hendelser, eller opprett en ny
            </p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-campaign" className="gap-2">
                <Plus className="w-4 h-4" />
                Ny kampanje
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Opprett ny kampanje</DialogTitle>
                <DialogDescription>
                  Fyll ut informasjonen for din nye hendelseskampanje
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Navn *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="F.eks. Champions League 2024"
                    required
                    data-testid="input-campaign-name"
                  />
                </div>
                <div>
                  <Label htmlFor="logo">Logo URL</Label>
                  <Input
                    id="logo"
                    value={formData.logo}
                    onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    data-testid="input-campaign-logo"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Beskrivelse</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Kort beskrivelse av kampanjen"
                    rows={3}
                    data-testid="input-campaign-description"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Avbryt
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending}
                    data-testid="button-submit-campaign"
                  >
                    {createMutation.isPending ? 'Oppretter...' : 'Opprett kampanje'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Campaigns Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Laster kampanjer...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Rocket className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Ingen kampanjer ennå</h3>
              <p className="text-muted-foreground mb-4">
                Kom i gang ved å opprette din første kampanje
              </p>
              <Button 
                onClick={() => setIsDialogOpen(true)}
                data-testid="button-create-first-campaign"
              >
                <Plus className="w-4 h-4 mr-2" />
                Opprett kampanje
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((campaign) => (
              <Card 
                key={campaign.id} 
                className="hover:border-primary transition-colors cursor-pointer"
                onClick={() => navigateToCampaign(campaign)}
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
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {new Date(campaign.createdAt).toLocaleDateString('nb-NO')}
                      </span>
                    </div>
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
