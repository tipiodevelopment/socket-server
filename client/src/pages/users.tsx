import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { UserPlus, Trash2, Pencil, ShieldCheck, CircleSlash, Building2 } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';

type Role = OperatorProfile['role'];

// A Firebase identity the Commerce signup marked as a business/brand or a
// channel (claim `business`/`channel`) that has no Vio user yet. Served by
// GET /api/pending-brands.
interface BrandSignup {
  uid: string;
  email: string | null;
  displayName: string | null;
  brandName: string | null;
  kind: 'business' | 'channel';
}

const ROLES: { value: Role; label: string; help: string }[] = [
  { value: 'super_admin', label: 'Super admin', help: 'Everything, incl. user management' },
  { value: 'admin', label: 'Admin', help: 'Registers apps and sponsors' },
  { value: 'operator', label: 'Operator', help: 'Creates and runs campaigns' },
  { value: 'viewer', label: 'Viewer', help: 'Read-only, tied to a sponsor' },
  { value: 'sponsor', label: 'Sponsor', help: 'Brand-facing, sees only its own footprint' },
];

const ROLE_BADGE: Record<Role, 'default' | 'secondary' | 'outline'> = {
  super_admin: 'default',
  admin: 'default',
  operator: 'secondary',
  viewer: 'outline',
  sponsor: 'outline',
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

  const { data: pendingBrands = [] } = useQuery<BrandSignup[]>({
    queryKey: ['/api/pending-brands'],
    enabled: myRole === 'super_admin',
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<OperatorProfile | null>(null);
  const [deleting, setDeleting] = useState<OperatorProfile | null>(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('operator');
  const [sponsorId, setSponsorId] = useState<string>('');
  const [parentAdminId, setParentAdminId] = useState<string>('');
  const [createdInfo, setCreatedInfo] = useState<
    { email: string; role: Role; tempPassword: string | null; firebaseExisted: boolean; firebaseEnabled: boolean } | null
  >(null);
  const [deleteFirebase, setDeleteFirebase] = useState(false);

  // Admins are the tenant an operator/viewer belongs to (ADR-0007).
  const admins = operators.filter((o) => o.role === 'admin' || o.role === 'super_admin');
  const needsParent = role === 'operator' || role === 'viewer';
  // Both viewer and sponsor link to a brand. For a sponsor the link is required
  // (server enforces it); for a viewer it's optional for now (Fase 4 scoping).
  const linksSponsor = role === 'viewer' || role === 'sponsor';

  const resetForm = () => {
    setEmail(''); setName(''); setRole('operator'); setSponsorId(''); setParentAdminId('');
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/auth/users'] });
    queryClient.invalidateQueries({ queryKey: ['/api/pending-brands'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = { email, role, name: name || null };
      if (linksSponsor && sponsorId) body.sponsorId = Number(sponsorId);
      if ((role === 'operator' || role === 'viewer') && parentAdminId) body.parentAdminId = Number(parentAdminId);
      const res = await apiRequest('POST', '/api/auth/users', body);
      return res.json();
    },
    onSuccess: (data: { tempPassword?: string | null; firebaseExisted?: boolean; firebaseEnabled?: boolean }) => {
      invalidate();
      setCreateOpen(false);
      setCreatedInfo({
        email, role,
        tempPassword: data?.tempPassword ?? null,
        firebaseExisted: !!data?.firebaseExisted,
        firebaseEnabled: !!data?.firebaseEnabled,
      });
      resetForm();
    },
    onError: (e: Error) => toast({ title: 'Could not create user', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: async (vars: { id: number }) => {
      const body: Record<string, unknown> = { role };
      if (linksSponsor) body.sponsorId = sponsorId ? Number(sponsorId) : null;
      const res = await apiRequest('PATCH', `/api/auth/users/${vars.id}`, body);
      return res.json();
    },
    onSuccess: () => {
      invalidate(); setEditing(null);
      toast({ title: 'User updated' });
    },
    onError: (e: Error) => toast({ title: 'Could not update user', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (vars: { id: number; firebase: boolean }) =>
      apiRequest('DELETE', `/api/auth/users/${vars.id}?firebase=${vars.firebase}`),
    onSuccess: (_data, vars) => {
      invalidate(); setDeleting(null);
      toast({ title: vars.firebase ? 'User and Firebase account deleted' : 'User removed from the dashboard' });
    },
    onError: (e: Error) => toast({ title: 'Could not delete user', description: e.message, variant: 'destructive' }),
  });

  const openEdit = (op: OperatorProfile) => {
    setEditing(op); setRole(op.role); setSponsorId(op.sponsorId ? String(op.sponsorId) : '');
  };

  // Triage a pending brand signup: open the create dialog prefilled as a sponsor,
  // pre-selecting the Vio sponsor whose name matches the Commerce brand name.
  const assignBrand = (b: BrandSignup) => {
    setEmail(b.email ?? '');
    setName(b.brandName ?? b.displayName ?? '');
    setRole('sponsor');
    setParentAdminId('');
    const match = b.brandName
      ? sponsors.find((s) => s.name.trim().toLowerCase() === b.brandName!.trim().toLowerCase())
      : undefined;
    setSponsorId(match ? String(match.id) : '');
    setCreatedInfo(null);
    setCreateOpen(true);
  };

  if (myRole !== 'super_admin') {
    return (
      <AppLayout title="Users">
        <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
          <CircleSlash className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground">Only a super admin can manage users.</p>
        </div>
      </AppLayout>
    );
  }

  const sponsorName = (id: number | null) =>
    id ? (sponsors.find((s) => s.id === id)?.name ?? `#${id}`) : '—';

  return (
    <AppLayout
      title="Users"
      subtitle="Dashboard operators — allowlist of Firebase identities"
      actions={
        <Button onClick={() => { resetForm(); setCreateOpen(true); }} data-testid="button-add-operator">
          <UserPlus className="w-4 h-4 mr-2" /> Add user
        </Button>
      }
    >
      {pendingBrands.length > 0 && (
        <div className="mb-6 rounded-xl border border-border overflow-hidden" data-testid="pending-brands">
          <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border">
            <Building2 className="w-4 h-4 text-[#3d8b7a]" />
            <h2 className="text-sm font-semibold">Pending signups</h2>
            <Badge variant="secondary">{pendingBrands.length}</Badge>
            <span className="text-xs text-muted-foreground ml-1">Registered in Commerce — assign a Vio role</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingBrands.map((b) => (
                <TableRow key={b.uid} data-testid={`row-pending-${b.uid}`}>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{b.kind}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{b.brandName ?? b.displayName ?? '—'}</TableCell>
                  <TableCell>{b.email ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => assignBrand(b)} data-testid={`button-assign-${b.uid}`}>
                      <UserPlus className="w-4 h-4 mr-2" /> Assign
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No users yet.</TableCell></TableRow>
            ) : operators.map((op) => (
              <TableRow key={op.id} data-testid={`row-operator-${op.id}`}>
                <TableCell className="font-medium">{op.email ?? '—'}</TableCell>
                <TableCell>{op.name ?? '—'}</TableCell>
                <TableCell><Badge variant={ROLE_BADGE[op.role]}>{roleLabel(op.role)}</Badge></TableCell>
                <TableCell>{op.role === 'viewer' || op.role === 'sponsor' ? sponsorName(op.sponsorId) : '—'}</TableCell>
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
                      title={op.id === myId ? "You can't delete your own account" : undefined}
                      onClick={() => { setDeleting(op); setDeleteFirebase(false); }}
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
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              Creates the Firebase account with a temporary password (or links it if the email already exists).
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
            {needsParent && (
              <div className="space-y-2">
                <Label>Admin (tenant)</Label>
                <Select value={parentAdminId} onValueChange={setParentAdminId}>
                  <SelectTrigger data-testid="select-operator-parent"><SelectValue placeholder="Select the admin they belong to" /></SelectTrigger>
                  <SelectContent>
                    {admins.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.email} ({roleLabel(a.role)})</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Operators and viewers belong to an admin's tenant.</p>
              </div>
            )}
            {linksSponsor && (
              <div className="space-y-2">
                <Label>Sponsor{role === 'sponsor' && <span className="text-destructive"> *</span>}</Label>
                <Select value={sponsorId} onValueChange={setSponsorId}>
                  <SelectTrigger data-testid="select-operator-sponsor"><SelectValue placeholder="Select sponsor" /></SelectTrigger>
                  <SelectContent>
                    {sponsors.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {role === 'sponsor' && <p className="text-xs text-muted-foreground">The brand this user will see. Required.</p>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!email || (needsParent && !parentAdminId) || (role === 'sponsor' && !sponsorId) || createMutation.isPending} data-testid="button-submit-operator">
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!createdInfo} onOpenChange={(o) => !o && setCreatedInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User created</DialogTitle>
            <DialogDescription>
              {createdInfo?.email} — {createdInfo && roleLabel(createdInfo.role)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {createdInfo?.tempPassword ? (
              <>
                <p className="text-sm">Temporary password (shown <b>once</b> — share it with the user):</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm select-all">{createdInfo.tempPassword}</code>
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard?.writeText(createdInfo.tempPassword!); toast({ title: 'Copied' }); }}>Copy</Button>
                </div>
                <p className="text-xs text-muted-foreground">They sign in with their email and this password; they should change it on first login.</p>
              </>
            ) : createdInfo?.firebaseExisted ? (
              <p className="text-sm text-muted-foreground">A Firebase account already existed for this email — it was linked. They sign in with their current password (or Google).</p>
            ) : (
              <p className="text-sm text-muted-foreground">Firebase Admin isn't configured: only the authorization was created. This person needs a Firebase account to sign in.</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedInfo(null)} data-testid="button-close-created">Done</Button>
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
              {editing?.id === myId && <p className="text-xs text-muted-foreground">You can't change your own role.</p>}
            </div>
            {linksSponsor && (
              <div className="space-y-2">
                <Label>Sponsor</Label>
                <Select value={sponsorId} onValueChange={setSponsorId}>
                  <SelectTrigger data-testid="select-edit-sponsor"><SelectValue placeholder="Select sponsor" /></SelectTrigger>
                  <SelectContent>
                    {sponsors.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => editing && updateMutation.mutate({ id: editing.id })} disabled={updateMutation.isPending} data-testid="button-save-operator">
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
              By default this only removes dashboard access (allowlist); their Firebase/Commerce account is untouched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-start gap-2 rounded-md border border-border p-3 text-sm cursor-pointer">
            <Checkbox
              checked={deleteFirebase}
              onCheckedChange={(v) => setDeleteFirebase(v === true)}
              className="mt-0.5"
              data-testid="checkbox-delete-firebase"
            />
            <span>
              Also delete the Firebase account
              <span className="block text-xs text-muted-foreground">
                ⚠️ Affects their Commerce login (shared identity), not just Vio. Irreversible.
              </span>
            </span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMutation.mutate({ id: deleting.id, firebase: deleteFirebase })}
              data-testid="button-confirm-delete"
            >
              {deleteFirebase ? 'Delete everything' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
