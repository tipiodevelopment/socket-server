import { useUser } from '@/contexts/UserContext';
import { Redirect } from 'wouter';

function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}

// Admin surface. Sponsors have no access to the operator dashboard — they are
// bounced to their own brand view. The API gate enforces this server-side too.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { userId, role, isLoading } = useUser();

  if (isLoading) return <Loading />;
  if (!userId) return <Redirect to="/login" />;
  if (role === 'sponsor') return <Redirect to="/my-brand" />;

  return <>{children}</>;
}

// Brand-facing surface (role `sponsor`). Everyone else is sent back to the
// dashboard; the login flow already routes sponsors straight here.
export function RequireSponsor({ children }: { children: React.ReactNode }) {
  const { userId, role, isLoading } = useUser();

  if (isLoading) return <Loading />;
  if (!userId) return <Redirect to="/login" />;
  if (role !== 'sponsor') return <Redirect to="/" />;

  return <>{children}</>;
}
