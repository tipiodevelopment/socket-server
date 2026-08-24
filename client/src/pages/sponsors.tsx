import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useUser } from '@/contexts/UserContext';
import { AppLayout } from '@/components/AppLayout';
import { ImageUploadWithPreview } from '@/components/ImageUploadWithPreview';
import type { Sponsor, Campaign } from '@shared/schema';
import { Plus, Pencil, Trash2, Users, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'wouter';

interface SponsorFormData {
  name: string;
  description: string;
  logoUrl: string;
  avatarUrl: string;
  primaryColor: string;
  secondaryColor: string;
  commerceApiKey: string;
  commerceChannelId: string;
}

const defaultFormData: SponsorFormData = {
  name: '',
  description: '',
  logoUrl: '',
  avatarUrl: '',
  primaryColor: '#3d8b7a',
  secondaryColor: '#141824',
  commerceApiKey: '',
  commerceChannelId: '',
};

export default function SponsorsPage() {
  const { toast } = useToast();
  const { userId } = useUser();
  const [, setLocation] = useLocation();
  const [expandedDescs, setExpandedDescs] = useState<Set<number>>(new Set());
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sponsorToDelete, setSponsorToDelete] = useState<Sponsor | null>(null);
  const [sponsorToEdit, setSponsorToEdit] = useState<Sponsor | null>(null);
  const [formData, setFormData] = useState<SponsorFormData>(defaultFormData);

  const { data: sponsors = [], isLoading } = useQuery<Sponsor[]>({
    queryKey: ['/api/sponsors', userId],
    queryFn: async () => {
      const res = await fetch(`/api/sponsors?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch sponsors');
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: campaigns = [] } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns', userId],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns?userId=${userId}`);
      if (!res.ok) throw new Error('Failed to fetch campaigns');
      return res.json();
    },
    enabled: !!userId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: SponsorFormData & { userId: number }) => {
      const response = await apiRequest('POST', '/api/sponsors', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sponsors', userId] });
      setCreateDialogOpen(false);
      setFormData(defaultFormData);
      toast({ title: 'Sponsor Created', description: 'Your new sponsor profile is ready' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create sponsor', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SponsorFormData> }) => {
      // Backend requires `userId` in the body for ownership check (same
      // pattern as DELETE which already includes it). Without it the
      // handler short-circuits with 400 "userId is required".
      const response = await apiRequest('PATCH', `/api/sponsors/${id}`, { ...data, userId });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sponsors', userId] });
      setEditDialogOpen(false);
      setSponsorToEdit(null);
      setFormData(defaultFormData);
      toast({ title: 'Sponsor Updated', description: 'Sponsor profile has been updated' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update sponsor', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest('DELETE', `/api/sponsors/${id}?userId=${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sponsors', userId] });
      setDeleteDialogOpen(false);
      setSponsorToDelete(null);
      toast({ title: 'Sponsor Deleted', description: 'The sponsor has been deleted.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete sponsor', variant: 'destructive' });
    },
  });

  const handleCreate = () => {
    if (!userId || !formData.name.trim()) return;
    createMutation.mutate({ ...formData, userId });
  };

  const handleEdit = () => {
    if (!sponsorToEdit) return;
    updateMutation.mutate({ id: sponsorToEdit.id, data: formData });
  };

  const openEditDialog = (sponsor: Sponsor) => {
    setSponsorToEdit(sponsor);
    setFormData({
      name: sponsor.name,
      description: sponsor.description || '',
      logoUrl: sponsor.logoUrl || '',
      avatarUrl: sponsor.avatarUrl || '',
      primaryColor: sponsor.primaryColor || '#3B82F6',
      secondaryColor: sponsor.secondaryColor || '#8B5CF6',
      commerceApiKey: (sponsor as any).commerceApiKey || '',
      commerceChannelId: (sponsor as any).commerceChannelId || '',
    });
    setEditDialogOpen(true);
  };

  const renderFormFields = (isEdit: boolean) => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Name</Label>
        <Input
          placeholder="e.g. Acme Corp"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          data-testid="input-sponsor-name"
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          placeholder="Brief description of the sponsor"
          value={formData.description}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          data-testid="input-sponsor-description"
        />
      </div>
      <ImageUploadWithPreview
        label="Logo"
        value={formData.logoUrl}
        onChange={(url) => setFormData((prev) => ({ ...prev, logoUrl: url }))}
        placeholder="Upload or paste logo URL"
        testId="input-sponsor-logo"
      />
      <ImageUploadWithPreview
        label="Avatar"
        value={formData.avatarUrl}
        onChange={(url) => setFormData((prev) => ({ ...prev, avatarUrl: url }))}
        placeholder="Upload or paste avatar URL"
        testId="input-sponsor-avatar"
      />
      <div className="space-y-2">
        <Label>Primary Color</Label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={formData.primaryColor}
            onChange={(e) => setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))}
            className="w-10 h-10 rounded cursor-pointer border-0"
            data-testid="input-primary-color-picker"
          />
          <Input
            value={formData.primaryColor}
            onChange={(e) => setFormData((prev) => ({ ...prev, primaryColor: e.target.value }))}
            placeholder="#3d8b7a"
            data-testid="input-primary-color"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Secondary Color</Label>
        <div className="flex gap-2 items-center">
          <input
            type="color"
            value={formData.secondaryColor}
            onChange={(e) => setFormData((prev) => ({ ...prev, secondaryColor: e.target.value }))}
            className="w-10 h-10 rounded cursor-pointer border-0"
            data-testid="input-secondary-color-picker"
          />
          <Input
            value={formData.secondaryColor}
            onChange={(e) => setFormData((prev) => ({ ...prev, secondaryColor: e.target.value }))}
            placeholder="#141824"
            data-testid="input-secondary-color"
          />
        </div>
      </div>
      <div className="border-t border-gray-100 dark:border-white/10 pt-4 space-y-4">
        <p className="text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">Commerce Integration</p>
        <div className="space-y-2">
          <Label>Commerce API Key</Label>
          <Input
            type="password"
            placeholder="e.g. KCXF10Y-W5T4PCR-GG5119A-Z64SQ9S"
            value={formData.commerceApiKey}
            onChange={(e) => setFormData((prev) => ({ ...prev, commerceApiKey: e.target.value }))}
            data-testid="input-sponsor-commerce-api-key"
            autoComplete="off"
          />
          <p className="text-[10px] text-gray-400 dark:text-gray-500">API key for the Commerce integration. Products will be fetched using this key.</p>
        </div>
        <div className="space-y-2">
          <Label>Commerce Channel ID <span className="text-gray-400 font-normal">(optional)</span></Label>
          <Input
            placeholder="e.g. ch_123456"
            value={formData.commerceChannelId}
            onChange={(e) => setFormData((prev) => ({ ...prev, commerceChannelId: e.target.value }))}
            data-testid="input-sponsor-commerce-channel-id"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          type="button"
          disabled={isEdit ? updateMutation.isPending : createMutation.isPending}
          onClick={isEdit ? handleEdit : handleCreate}
          data-testid="button-submit-sponsor"
          className="bg-[#3d8b7a] hover:bg-[#2f7365] text-white dark:bg-white dark:hover:bg-gray-200 dark:text-[#0a0e1a]"
        >
          {isEdit
            ? updateMutation.isPending
              ? 'Updating...'
              : 'Update Sponsor'
            : createMutation.isPending
              ? 'Creating...'
              : 'Create Sponsor'}
        </Button>
      </DialogFooter>
    </div>
  );

  return (
    <AppLayout
      breadcrumbs={[{ label: 'Sponsors' }]}
      title="Sponsors"
      actions={
        <Dialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) setFormData(defaultFormData);
          }}
        >
          <DialogTrigger asChild>
            <Button data-testid="button-create-sponsor" className="gap-2 bg-[#3d8b7a] hover:bg-[#2f7365] text-white dark:bg-white dark:hover:bg-gray-200 dark:text-[#0a0e1a]">
              <Plus className="w-4 h-4" />
              New Sponsor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Sponsor</DialogTitle>
              <DialogDescription>Add a new sponsor profile for your campaigns.</DialogDescription>
            </DialogHeader>
            {renderFormFields(false)}
          </DialogContent>
        </Dialog>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden animate-pulse"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-200 dark:bg-white/10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 dark:bg-white/5 rounded w-1/2" />
                  </div>
                </div>
                <div className="h-3 bg-gray-200 dark:bg-white/5 rounded" />
                <div className="flex gap-2">
                  <div className="w-6 h-6 bg-gray-200 dark:bg-white/10 rounded-full" />
                  <div className="w-6 h-6 bg-gray-200 dark:bg-white/10 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : sponsors.length === 0 ? (
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl p-12 text-center">
          <Users className="w-12 h-12 text-gray-300 dark:text-white/20 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2" data-testid="text-empty-state">
            No sponsors yet
          </h3>
          <p className="text-gray-500 dark:text-white/40 mb-4 max-w-md mx-auto">
            Create your first sponsor profile to associate with campaigns
          </p>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-[#3d8b7a] hover:bg-[#2f7365] text-white dark:bg-white dark:hover:bg-gray-200 dark:text-[#0a0e1a]"
            data-testid="button-create-first-sponsor"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Sponsor
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sponsors.map((sponsor) => (
            <div
              key={sponsor.id}
              className="bg-white dark:bg-[#141824] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden hover:border-gray-300 dark:hover:border-white/20 transition-all group"
              data-testid={`card-sponsor-${sponsor.id}`}
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                    {sponsor.logoUrl ? (
                      <img
                        src={sponsor.logoUrl}
                        alt={`${sponsor.name} logo`}
                        className="w-full h-full object-cover"
                        data-testid={`img-logo-${sponsor.id}`}
                      />
                    ) : (
                      <Users className="w-6 h-6 text-gray-400 dark:text-white/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className="text-sm font-semibold text-gray-900 dark:text-white truncate"
                      data-testid={`text-sponsor-name-${sponsor.id}`}
                    >
                      {sponsor.name}
                    </h3>
                    {/* A sponsor sells through its commerce channel: without that
                        key Vio cannot fetch a single product, so the brand is
                        inert. Surfacing it here stops silent, empty campaigns. */}
                    {!(sponsor as any).commerceApiKey && (
                      <span
                        className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        title="Paste the commerce channel API key to activate this sponsor"
                        data-testid={`badge-not-connected-${sponsor.id}`}
                      >
                        Not connected
                      </span>
                    )}
                    {sponsor.description && (
                      <div>
                        <p
                          className={`text-xs text-gray-500 dark:text-white/40 ${expandedDescs.has(sponsor.id) ? '' : 'line-clamp-2'}`}
                          data-testid={`text-sponsor-description-${sponsor.id}`}
                        >
                          {sponsor.description}
                        </p>
                        {sponsor.description.length > 80 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedDescs(prev => {
                                const next = new Set(prev);
                                if (next.has(sponsor.id)) next.delete(sponsor.id);
                                else next.add(sponsor.id);
                                return next;
                              });
                            }}
                            className="text-[10px] text-gray-400 dark:text-white/30 hover:text-gray-600 dark:hover:text-white/50 mt-0.5"
                            data-testid={`button-expand-desc-${sponsor.id}`}
                          >
                            {expandedDescs.has(sponsor.id) ? 'show less' : 'show more'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {sponsor.avatarUrl && (
                    <img
                      src={sponsor.avatarUrl}
                      alt={`${sponsor.name} avatar`}
                      className="w-8 h-8 rounded-full object-cover border border-gray-200 dark:border-white/10 shrink-0"
                      data-testid={`img-avatar-${sponsor.id}`}
                    />
                  )}
                </div>

                {(() => {
                  const activeCampaignCount = campaigns.filter(c => (c as any).sponsorId === sponsor.id && (c as any).isPaused !== 'true').length;
                  return activeCampaignCount > 0 ? (
                    <div className="mb-3">
                      <span className="text-[10px] text-[#3d8b7a] dark:text-[#3d8b7a] font-medium" data-testid={`text-active-campaigns-${sponsor.id}`}>
                        {activeCampaignCount} active campaign{activeCampaignCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ) : null;
                })()}

                <div className="flex items-center gap-3 mb-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-gray-400 font-medium">Primary</span>
                    <div className="flex items-center gap-1.5" data-testid={`swatch-primary-${sponsor.id}`}>
                      <div
                        className="w-5 h-5 rounded border border-gray-200 dark:border-white/10 shrink-0"
                        style={{ backgroundColor: sponsor.primaryColor || '#3d8b7a' }}
                      />
                      <span className="text-[10px] text-gray-400 dark:text-white/30 font-mono">{sponsor.primaryColor || '#3d8b7a'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-gray-400 font-medium">Secondary</span>
                    <div className="flex items-center gap-1.5" data-testid={`swatch-secondary-${sponsor.id}`}>
                      <div
                        className="w-5 h-5 rounded border border-gray-200 dark:border-white/10 shrink-0"
                        style={{ backgroundColor: sponsor.secondaryColor || '#141824' }}
                      />
                      <span className="text-[10px] text-gray-400 dark:text-white/30 font-mono">{sponsor.secondaryColor || '#141824'}</span>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <span className="text-[10px] text-gray-400 font-medium block mb-1.5">SDK Badge Preview</span>
                  <div 
                    className="h-8 rounded-full px-3 flex items-center gap-2 w-fit"
                    style={{ backgroundColor: sponsor.primaryColor || '#3d8b7a' }}
                    data-testid={`sdk-badge-preview-${sponsor.id}`}
                  >
                    {sponsor.logoUrl ? (
                      <img src={sponsor.logoUrl} className="w-4 h-4 object-contain" alt="" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[8px] text-white font-bold">
                        {sponsor.name.substring(0, 1)}
                      </div>
                    )}
                    <span className="text-[10px] font-bold text-white whitespace-nowrap">
                      {sponsor.name}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-white/5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80 h-8"
                    onClick={() => setLocation(`/sponsors/${sponsor.id}`)}
                    data-testid={`button-view-sponsor-${sponsor.id}`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-xs text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80 h-8"
                    onClick={() => openEditDialog(sponsor)}
                    data-testid={`button-edit-sponsor-${sponsor.id}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </Button>
                  <div className="ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-xs text-red-500 hover:text-red-600 h-8"
                      onClick={() => {
                        setSponsorToDelete(sponsor);
                        setDeleteDialogOpen(true);
                      }}
                      data-testid={`button-delete-sponsor-${sponsor.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setSponsorToEdit(null);
            setFormData(defaultFormData);
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Sponsor</DialogTitle>
            <DialogDescription>Update the sponsor profile details.</DialogDescription>
          </DialogHeader>
          {renderFormFields(true)}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sponsor?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{sponsorToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSponsorToDelete(null)} data-testid="button-cancel-delete">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => sponsorToDelete && deleteMutation.mutate(sponsorToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
