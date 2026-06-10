import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { UserPlus, Trash2, Pencil, ShieldCheck, CircleSlash } from 'lucide-react';
import type { Sponsor } from '@shared/schema';
import { AppLayout } from '@/components/AppLayout';
import { useUser, type OperatorProfile } from '@/contexts/UserContext';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type Role = OperatorProfile['role'];

const ROLES: { value: Role; label: string; help: string }[] = [
  { value: 'super_admin', label: 'Super admin', help: 'Todo, incl. gestión de usuarios' },
  { value: 'admin', label: 'Admin', help: 'Registra apps y sponsors' },
  { value: 'operator', label: 'Operator', help: 'Crea y opera campañas' },
  { value: 'viewer', label: 'Viewer', help: 'Solo lectura, ligado a un sponsor' },
];

const ROLE_BADGE: Record<Role, 'default' | 'secondary' | 'outline'> = {
  super_admin: 'default',
  admin: 'default',
  operator: 'secondary',
  viewer: 'outline',
};

function roleLabel(role: Role) {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

export default function UsersPage() {
  const { role: myRole, userId: myId } = useUser();
  const { toast } = useToast();

  const { data: operators = [], isLoading } = useQuery<OperatorProfile[]>({
    queryKey: ['/api/auth/users'],
    enabled: myRole === 'super_admin',
  });

  const { data: sponsors = [] } = useQuery<Sponsor[]>({
    queryKey: ['/api/sponsors'],
    enabled: myRole === 'super_admin',
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OperatorProfile | null>(null);
  const [deleting, setDeleting] = useState<OperatorProfile | null>(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('operator');
  const [sponsorId, setSponsorId] = useState<string>('');

  const resetForm = () => {
    setEmail(''); setName(''); setRole('operator'); setSponsorId('');
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/auth/users'] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { email, role, name: name || null };
      if (role === 'viewer' && sponsorId) body.sponsorId = Number(sponsorId);
      const res = await apiRequest('POST', '/api/auth/users', body);
      return res.json();
    },
    onSuccess: () => {
      invalidate(); setCreateOpen(false); resetForm();
      toast({ title: 'Operador creado', description: `${email} dado de alta como ${roleLabel(role)}.` });
    },
    onError: (e: Error) => toast({ title: 'No se pudo crear', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { role };
      if (role === 'viewer') body.sponsorId = sponsorId ? Number(sponsorId) : null;
      const res = await apiRequest('PATCH', `/api/auth/users/${editing!.id}`, body);
      return res.json();
    },
    onSuccess: () => {
      invalidate(); setEditing(null);
      toast({ title: 'Operador actualizado' });
    },
    onError: (e: Error) => toast({ title: 'No se pudo actualizar', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiRequest('DELETE', `/api/auth/users/${deleting!.id}`),
    onSuccess: () => {
      invalidate(); setDeleting(null);
      toast({ title: 'Operador eliminado de la allowlist' });
    },
    onError: (e: Error) => toast({ title: 'No se pudo eliminar', description: e.message, variant: 'destructive' }),
  });

  const openEdit = (op: OperatorProfile) => {
    setEditing(op); setRole(op.role); setSponsorId(op.sponsorId ? String(op.sponsorId) : '');
  };

  if (myRole !== 'super_admin') {
    return (
      <AppLayout title="Users">
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <CircleSlash className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground">Solo un super admin puede gestionar operadores.</p>
        </div>
      </AppLayout>
    );
  }

  const sponsorName = (id: number | null) =>
    id ? (sponsors.find((s) => s.id === id)?.name ?? `#${id}`) : '—';

  return (
    <AppLayout
      title="Users"
      subtitle="Operadores del dashboard — allowlist de identidades Firebase"
      actions={
        <Button onClick={() => { resetForm(); setCreateOpen(true); }} data-testid="button-add-operator">
          <UserPlus className="w-4 h-4 mr-2" /> Add operator
        </Button>
      }
    >
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Sponsor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : operators.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No operators yet.</TableCell></TableRow>
            ) : operators.map((op) => (
              <TableRow key={op.id} data-testid={`row-operator-${op.id}`}>
                <TableCell className="font-medium">{op.email ?? '—'}</TableCell>
                <TableCell>{op.name ?? '—'}</TableCell>
                <TableCell><Badge variant={ROLE_BADGE[op.role]}>{roleLabel(op.role)}</Badge></TableCell>
                <TableCell>{op.role === 'viewer' ? sponsorName(op.sponsorId) : '—'}</TableCell>
                <TableCell>
                  {op.linked ? (
                    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                      <ShieldCheck className="w-3.5 h-3.5" /> linked
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">invited</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(op)} data-testid={`button-edit-${op.id}`} aria-label="Edit">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      disabled={op.id === myId}
                      title={op.id === myId ? 'No puedes eliminar tu propia cuenta' : undefined}
                      onClick={() => setDeleting(op)}
                      data-testid={`button-delete-${op.id}`} aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add operator</DialogTitle>
            <DialogDescription>
              El email debe existir en el proyecto Firebase de Commerce. Se vincula en su primer login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="op-email">Email</Label>
              <Input id="op-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-operator-email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="op-name">Name (optional)</Label>
              <Input id="op-name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-operator-name" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger data-testid="select-operator-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label} — {r.help}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {role === 'viewer' && (
              <div className="space-y-2">
                <Label>Sponsor</Label>
                <Select value={sponsorId} onValueChange={setSponsorId}>
                  <SelectTrigger data-testid="select-operator-sponsor"><SelectValue placeholder="Selecciona sponsor" /></SelectTrigger>
                  <SelectContent>
                    {sponsors.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!email || createMutation.isPending} data-testid="button-submit-operator">
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={editing?.id === myId}>
                <SelectTrigger data-testid="select-edit-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label} — {r.help}</SelectItem>)}
                </SelectContent>
              </Select>
              {editing?.id === myId && <p className="text-xs text-muted-foreground">No puedes cambiar tu propio rol.</p>}
            </div>
            {role === 'viewer' && (
              <div className="space-y-2">
                <Label>Sponsor</Label>
                <Select value={sponsorId} onValueChange={setSponsorId}>
                  <SelectTrigger data-testid="select-edit-sponsor"><SelectValue placeholder="Selecciona sponsor" /></SelectTrigger>
                  <SelectContent>
                    {sponsors.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-save-operator">
              {updateMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {deleting?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              Pierde acceso al dashboard. Su cuenta de Firebase/Commerce NO se toca — solo se quita de la allowlist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} data-testid="button-confirm-delete">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
