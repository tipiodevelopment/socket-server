import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { User, LogOut, LogIn, Sun, Moon } from "lucide-react";
import { VioLogo } from "@/components/VioLogo";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";

export default function UserSessionPage() {
  const { reachuUserId: currentUser, login, logout, isLoading } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [reachuUserId, setReachuUserId] = useState("");
  const [showForm, setShowForm] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && currentUser && !showForm) {
      setLocation('/apps');
    }
  }, [isLoading, currentUser, showForm, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0e1a] flex items-center justify-center transition-colors">
        <div className="animate-pulse">
          <div className="w-10 h-10 bg-white rounded-xl mx-auto" />
          <p className="text-gray-500 dark:text-white/50 text-sm mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  const handleLogin = async () => {
    if (!reachuUserId.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await login(reachuUserId.trim());
      setReachuUserId("");
      setLocation('/apps');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0e1a] flex flex-col transition-colors">
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-400 dark:text-white/40 hover:text-gray-600 dark:hover:text-white/70 hover:bg-gray-200 dark:hover:bg-white/5 transition-all"
          data-testid="button-theme-toggle"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <VioLogo className="h-10" />
            </div>
            <p className="text-sm text-gray-500 dark:text-white/40 mt-1">
              Real-time event management platform
            </p>
          </div>

          {currentUser && !showForm ? (
            <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-white/5">
                <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 dark:text-white/30">Signed in as</p>
                  <p className="text-base font-semibold text-gray-900 dark:text-white" data-testid="text-current-user">{currentUser}</p>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <Link href="/apps">
                  <Button className="w-full bg-white hover:bg-gray-200 text-[#0a0e1a] h-11" data-testid="button-apps">
                    Go to My Apps
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full border-gray-200 dark:border-white/10 text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 h-11"
                  onClick={() => setShowForm(true)}
                  data-testid="button-switch-user"
                >
                  <User className="h-4 w-4 mr-2" />
                  Switch User
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 h-11"
                  onClick={handleLogout}
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          ) : null}

          {showForm && (
            <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-none">
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sign In</h2>
                <p className="text-sm text-gray-500 dark:text-white/40 mt-1">
                  Enter your User ID to start a session
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 dark:text-white/40 uppercase tracking-wider mb-1.5 block">
                    User ID
                  </label>
                  <Input
                    placeholder="e.g., reachu-admin, user-123"
                    value={reachuUserId}
                    onChange={(e) => setReachuUserId(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isSubmitting && handleLogin()}
                    disabled={isSubmitting}
                    className="h-11 bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/30 focus:border-gray-500"
                    data-testid="input-user-id"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <Button
                  onClick={handleLogin}
                  disabled={!reachuUserId.trim() || isSubmitting}
                  className="w-full bg-white hover:bg-gray-200 text-[#0a0e1a] h-11 font-medium"
                  data-testid="button-start-session"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </Button>

                {currentUser && (
                  <Button
                    variant="ghost"
                    onClick={() => setShowForm(false)}
                    className="w-full text-gray-500 dark:text-white/40"
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100 dark:border-white/5">
                <p className="text-xs text-gray-400 dark:text-white/30 mb-2 uppercase tracking-wider font-medium">
                  Quick Access
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setReachuUserId("vio-admin")}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-xs font-medium text-gray-600 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors border border-gray-200 dark:border-white/10"
                    data-testid="button-demo-admin"
                  >
                    vio-admin
                  </button>
                  <button
                    onClick={() => setReachuUserId("user-test")}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-white/5 text-xs font-medium text-gray-600 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors border border-gray-200 dark:border-white/10"
                    data-testid="button-demo-user"
                  >
                    user-test
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 dark:text-white/20 mt-6">
            Vio Platform v2.0
          </p>
        </div>
      </div>
    </div>
  );
}
