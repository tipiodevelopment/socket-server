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
import type { Sponsor } from '@shared/schema';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import { useState } from 'react';

interface SponsorFormData {
  name: string;
  description: string;
  logoUrl: string;
  avatarUrl: string;
  primaryColor: string;
  secondaryColor: string;
}

const defaultFormData: SponsorFormData = {
  name: '',
  description: '',
  logoUrl: '',
  avatarUrl: '',
  primaryColor: '#3B82F6',
  secondaryColor: '#8B5CF6',
};

export default function SponsorsPage() {
  const { toast } = useToast();
  const { userId } = useUser();
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
      const response = await apiRequest('PATCH', `/api/sponsors/${id}`, data);
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
            placeholder="#3B82F6"
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
            placeholder="#8B5CF6"
            data-testid="input-secondary-color"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          type="button"
          disabled={isEdit ? updateMutation.isPending : createMutation.isPending}
          onClick={isEdit ? handleEdit : handleCreate}
          data-testid="button-submit-sponsor"
          className="bg-white hover:bg-gray-200 text-[#0a0e1a]"
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
      title="Sponsors"
      subtitle="Manage sponsor profiles for campaigns"
      actions={
        <Dialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) setFormData(defaultFormData);
          }}
        >
          <DialogTrigger asChild>
            <Button data-testid="button-create-sponsor" className="gap-2 bg-white hover:bg-gray-200 text-[#0a0e1a]">
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
            className="bg-white hover:bg-gray-200 text-[#0a0e1a]"
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
                    {sponsor.description && (
                      <p
                        className="text-xs text-gray-500 dark:text-white/40 line-clamp-2"
                        data-testid={`text-sponsor-description-${sponsor.id}`}
                      >
                        {sponsor.description}
                      </p>
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

                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-white/30">Colors</span>
                  <div
                    className="w-6 h-6 rounded-full border border-gray-200 dark:border-white/10"
                    style={{ backgroundColor: sponsor.primaryColor || '#3B82F6' }}
                    title={`Primary: ${sponsor.primaryColor || '#3B82F6'}`}
                    data-testid={`swatch-primary-${sponsor.id}`}
                  />
                  <div
                    className="w-6 h-6 rounded-full border border-gray-200 dark:border-white/10"
                    style={{ backgroundColor: sponsor.secondaryColor || '#8B5CF6' }}
                    title={`Secondary: ${sponsor.secondaryColor || '#8B5CF6'}`}
                    data-testid={`swatch-secondary-${sponsor.id}`}
                  />
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-white/5">
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
