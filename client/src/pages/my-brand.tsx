import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VioLogo } from '@/components/VioLogo';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Layers,
  Megaphone,
  MapPin,
  Send,
  ShoppingCart,
  Radio,
  LogOut,
  Sun,
  Moon,
  CheckCircle2,
  Store,
} from 'lucide-react';

// Brand-facing dashboard (role `sponsor`). Everything here is SELF-SCOPED by
// the server to the logged-in sponsor's users.sponsor_id — the client never
// passes a sponsor id, so a sponsor can only ever see its own footprint.

interface SponsorMe {
  id: number;
  name: string;
  logoUrl: string | null;
  avatarUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  hasCommerce: boolean;
}

interface SponsorUsage {
  campaigns: Array<{
    id: number;
    name: string;
    role: 'primary' | 'secondary';
    surface: { id: number; name: string } | null;
  }>;
  surfaces: Array<{ id: number; name: string }>;
  placements: number;
}

interface SponsorStats {
  dispatches: number;
  cartIntents: number;
  sponsorSlots: number;
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Layers;
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold mt-1" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>
              {value}
            </p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#3d8b7a]/10 flex items-center justify-center text-[#3d8b7a]">
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MyBrandPage() {
  const { email, logout } = useUser();
  const { theme, toggleTheme } = useTheme();

  const meQ = useQuery<SponsorMe>({ queryKey: ['/api/sponsor/me'] });
  const usageQ = useQuery<SponsorUsage>({ queryKey: ['/api/sponsor/me/usage'] });
  const statsQ = useQuery<SponsorStats>({ queryKey: ['/api/sponsor/me/stats'] });

  const brand = meQ.data;
  const usage = usageQ.data;
  const stats = statsQ.data;
  const brandColor = brand?.primaryColor || '#3d8b7a';

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#141824]/80 backdrop-blur-xl border-b border-gray-200 dark:border-[#2a3142]">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <VioLogo className="h-5" />
            <span className="text-sm text-muted-foreground">Brand portal</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-sm text-muted-foreground">{email}</span>
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-[#3d8b7a] hover:bg-[#3d8b7a]/10 transition-all"
              data-testid="button-theme-toggle"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <Button variant="outline" size="sm" onClick={logout} data-testid="button-logout">
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Brand hero */}
        {meQ.isLoading ? (
          <div className="h-24 rounded-xl bg-muted animate-pulse" />
        ) : meQ.isError ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              We couldn't load your brand. This account may not be linked to a sponsor yet — contact your Vio
              administrator.
            </CardContent>
          </Card>
        ) : brand ? (
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-200 dark:border-[#2a3142]"
              style={{ backgroundColor: `${brandColor}1a` }}
            >
              {brand.avatarUrl || brand.logoUrl ? (
                <img
                  src={brand.avatarUrl || brand.logoUrl || ''}
                  alt={brand.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-2xl font-bold" style={{ color: brandColor }}>
                  {brand.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate" data-testid="text-brand-name">
                {brand.name}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: brandColor }} />
                  {brandColor}
                </span>
                {brand.hasCommerce && (
                  <span className="inline-flex items-center gap-1 text-sm text-[#3d8b7a]">
                    <CheckCircle2 className="w-4 h-4" />
                    Commerce connected
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Footprint */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Your footprint
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Layers} label="Surfaces" value={usage?.surfaces.length ?? '—'} hint="Apps showing your brand" />
            <StatCard icon={Megaphone} label="Campaigns" value={usage?.campaigns.length ?? '—'} hint="Campaigns using your brand" />
            <StatCard icon={MapPin} label="Placements" value={usage?.placements ?? '—'} hint="Component placements" />
          </div>
        </section>

        {/* Activity */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Activity
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={Send} label="Ad dispatches" value={stats?.dispatches ?? '—'} />
            <StatCard icon={ShoppingCart} label="Cart intents" value={stats?.cartIntents ?? '—'} />
            <StatCard icon={Radio} label="Broadcast slots" value={stats?.sponsorSlots ?? '—'} />
          </div>
        </section>

        {/* Surfaces */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Where your brand appears
          </h2>
          {usageQ.isLoading ? (
            <div className="h-16 rounded-xl bg-muted animate-pulse" />
          ) : usage && usage.surfaces.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {usage.surfaces.map((s) => (
                <span
                  key={s.id}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#1e2433] border border-gray-200 dark:border-[#2a3142] text-sm"
                  data-testid={`surface-${s.id}`}
                >
                  <Store className="w-4 h-4 text-[#3d8b7a]" />
                  {s.name}
                </span>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground text-sm">
                Your brand isn't placed on any surface yet.
              </CardContent>
            </Card>
          )}
        </section>

        {/* Campaigns */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Campaigns
          </h2>
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="text-base">Campaigns using your brand</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {usageQ.isLoading ? (
                <div className="h-24 m-4 rounded-xl bg-muted animate-pulse" />
              ) : usage && usage.campaigns.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-[#2a3142] text-left text-muted-foreground">
                        <th className="font-medium px-4 py-3">Campaign</th>
                        <th className="font-medium px-4 py-3">Role</th>
                        <th className="font-medium px-4 py-3">Surface</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usage.campaigns.map((c) => (
                        <tr
                          key={c.id}
                          className="border-b border-gray-50 dark:border-[#1e2433] last:border-0"
                          data-testid={`campaign-row-${c.id}`}
                        >
                          <td className="px-4 py-3 font-medium">{c.name}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                c.role === 'primary'
                                  ? 'bg-[#3d8b7a]/10 text-[#3d8b7a]'
                                  : 'bg-gray-100 dark:bg-[#1e2433] text-muted-foreground'
                              }`}
                            >
                              {c.role === 'primary' ? 'Primary' : 'Secondary'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{c.surface?.name ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  No campaigns use your brand yet.
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
