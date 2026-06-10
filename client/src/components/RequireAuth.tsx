import { useUser } from '@/contexts/UserContext';
import { Redirect } from 'wouter';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { userId, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!userId) {
    return <Redirect to="/login" />;
  }

  return <>{children}</>;
}
