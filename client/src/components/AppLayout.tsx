import { Link, useLocation } from 'wouter';
import { useUser } from '@/contexts/UserContext';
import {
  Breadcrumb,
  BreadcrumbItem as BreadcrumbUIItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  Rocket,
  LayoutDashboard,
  Smartphone,
  Megaphone,
  Radio,
  ShoppingBag,
  FileText,
  LogOut,
  User as UserIcon,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface AppLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/apps', label: 'Apps', icon: Smartphone },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/broadcasts', label: 'Broadcasts', icon: Radio },
  { href: '/components', label: 'Components', icon: ShoppingBag },
  { href: '/docs', label: 'Docs', icon: FileText },
];

function isActive(itemHref: string, location: string, exact?: boolean) {
  if (exact) return location === itemHref;
  return location.startsWith(itemHref);
}

export function AppLayout({ children, breadcrumbs = [], title, subtitle, actions }: AppLayoutProps) {
  const { reachuUserId, logout } = useUser();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <Link href="/">
                <div className="flex items-center gap-2 cursor-pointer" data-testid="link-home">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <Rocket className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <span className="font-bold text-lg hidden sm:block">Reachu</span>
                </div>
              </Link>

              <nav className="hidden md:flex items-center gap-1">
                {NAV_ITEMS.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive(item.href, location, item.exact) ? 'secondary' : 'ghost'}
                      size="sm"
                      className="gap-1.5 text-sm"
                      data-testid={`nav-${item.label.toLowerCase()}`}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </Button>
                  </Link>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              {reachuUserId && (
                <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
                  <UserIcon className="w-4 h-4" />
                  <span data-testid="text-current-user">{reachuUserId}</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                data-testid="button-logout"
                className="gap-1.5 text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="button-mobile-menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-card px-4 py-2">
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive(item.href, location, item.exact) ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-2 mb-1"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid={`mobile-nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {breadcrumbs.length > 0 && (
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              {breadcrumbs.map((crumb, index) => (
                <BreadcrumbUIItem key={index}>
                  {index > 0 && <BreadcrumbSeparator />}
                  {crumb.href && index < breadcrumbs.length - 1 ? (
                    <BreadcrumbLink asChild>
                      <Link href={crumb.href}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  )}
                </BreadcrumbUIItem>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}

        {(title || actions) && (
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
            {title && (
              <div>
                <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">{title}</h1>
                {subtitle && (
                  <p className="text-sm sm:text-base text-muted-foreground mt-1">{subtitle}</p>
                )}
              </div>
            )}
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
