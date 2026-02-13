import { Link, useLocation } from 'wouter';
import { useUser } from '@/contexts/UserContext';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Breadcrumb,
  BreadcrumbItem as BreadcrumbUIItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Rocket,
  LayoutDashboard,
  Smartphone,
  Megaphone,
  Radio,
  ShoppingBag,
  FileText,
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  ChevronRight,
  Sun,
  Moon,
  Award,
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
  headerBreadcrumb?: string;
  headerBreadcrumbHref?: string;
}

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/apps', label: 'Apps', icon: Smartphone },
  { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { href: '/sponsors', label: 'Sponsors', icon: Award },
  { href: '/broadcasts', label: 'Broadcasts', icon: Radio },
  { href: '/components', label: 'Components', icon: ShoppingBag },
  { href: '/docs', label: 'Docs', icon: FileText },
];

function isActiveRoute(itemHref: string, location: string, exact?: boolean) {
  if (exact) return location === itemHref;
  return location.startsWith(itemHref);
}

export function AppLayout({ children, breadcrumbs = [], title, subtitle, actions, headerBreadcrumb, headerBreadcrumbHref }: AppLayoutProps) {
  const { reachuUserId, logout } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentPage = NAV_ITEMS.find(item => isActiveRoute(item.href, location, item.exact));
  const pageTitle = title || currentPage?.label || 'Dashboard';

  return (
    <div className="min-h-screen flex bg-background dark:bg-[#0d0b1a]">
      <aside className="hidden md:flex flex-col w-16 bg-white dark:bg-[#12101f] border-r border-gray-200 dark:border-white/5 fixed top-0 left-0 h-full z-50 shadow-sm dark:shadow-none">
        <div className="flex items-center justify-center h-16">
          <Link href="/">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center cursor-pointer" data-testid="link-home">
              <Rocket className="w-5 h-5 text-white" />
            </div>
          </Link>
        </div>

        <nav className="flex-1 flex flex-col items-center gap-1 py-4">
          {NAV_ITEMS.map((item) => {
            const active = isActiveRoute(item.href, location, item.exact);
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-all group relative ${
                    active
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5'
                  }`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="w-5 h-5" />
                  <div className="absolute left-full ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                    {item.label}
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col items-center gap-2 py-4 border-t border-gray-200 dark:border-white/5">
          <button
            onClick={toggleTheme}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5 transition-all group relative"
            data-testid="button-theme-toggle"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <div className="absolute left-full ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </div>
          </button>
          <button
            onClick={logout}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5 transition-all group relative"
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5" />
            <div className="absolute left-full ml-3 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Logout
            </div>
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
            {(reachuUserId || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      </aside>

      <div className="flex-1 md:ml-16 flex flex-col min-h-screen">
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0d0b1a]/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5">
          <div className="flex items-center justify-between h-14 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden text-gray-500 dark:text-white/60"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                data-testid="button-mobile-menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>

              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-gray-900 dark:text-white" data-testid="text-page-title">{pageTitle}</h1>
                {headerBreadcrumb && (
                  <>
                    <ChevronRight className="w-4 h-4 text-gray-300 dark:text-white/30" />
                    {headerBreadcrumbHref ? (
                      <Link href={headerBreadcrumbHref}>
                        <span className="text-sm text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/80 transition-colors cursor-pointer">{headerBreadcrumb}</span>
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-white/50">{headerBreadcrumb}</span>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center relative">
                <Search className="w-4 h-4 text-gray-400 dark:text-white/30 absolute left-3" />
                <Input
                  placeholder="Search..."
                  className="w-48 lg:w-64 pl-9 h-9 bg-gray-100 dark:bg-white/5 border-gray-200 dark:border-white/10 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-blue-500/50"
                  data-testid="input-search"
                />
              </div>
              <button className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5 transition-all relative" data-testid="button-notifications">
                <Bell className="w-5 h-5" />
              </button>
              <button
                onClick={toggleTheme}
                className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                data-testid="button-theme-toggle-mobile"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              {actions}
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden border-t border-gray-200 dark:border-white/5 bg-white dark:bg-[#12101f] px-3 py-2">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActiveRoute(item.href, location, item.exact) ? 'secondary' : 'ghost'}
                    className="w-full justify-start gap-2 mb-1 text-gray-700 dark:text-white/70"
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

        <main className="flex-1 px-4 sm:px-6 py-6 overflow-auto">
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

          {(title || subtitle) && !breadcrumbs.length && (
            <div className="mb-6">
              {subtitle && (
                <p className="text-sm text-gray-500 dark:text-white/50 mt-1">{subtitle}</p>
              )}
            </div>
          )}

          {children}
        </main>
      </div>
    </div>
  );
}
