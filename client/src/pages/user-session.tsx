import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "wouter";
import { User, LogOut, LogIn, Home } from "lucide-react";

const USER_SESSION_KEY = "reachu_simulated_user_id";

export default function UserSessionPage() {
  const [reachuUserId, setReachuUserId] = useState("");
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load current user from localStorage
    const storedUserId = localStorage.getItem(USER_SESSION_KEY);
    setCurrentUser(storedUserId);
    setShowForm(!storedUserId);
  }, []);

  const handleLogin = async () => {
    if (!reachuUserId.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Call backend to ensure user exists (create if not, return if exists)
      const response = await fetch('/api/users/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reachuUserId: reachuUserId.trim() })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create/fetch user');
      }
      
      const user = await response.json();
      
      // Save to localStorage and update state
      localStorage.setItem(USER_SESSION_KEY, reachuUserId.trim());
      setCurrentUser(reachuUserId.trim());
      setReachuUserId("");
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(USER_SESSION_KEY);
    setCurrentUser(null);
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            User Session Simulator
          </h1>
          <Link href="/">
            <Button variant="outline" size="sm" data-testid="button-home">
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
          </Link>
        </div>

        <Alert>
          <AlertDescription>
            This is a temporary simulation system for multi-user testing. Enter your Reachu User ID to simulate a login session.
            When user authentication is integrated, this page will be replaced with real login.
          </AlertDescription>
        </Alert>

        {currentUser ? (
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Current Session</p>
                  <p className="text-lg font-semibold" data-testid="text-current-user">{currentUser}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Link href="/campaigns">
                  <Button className="w-full" data-testid="button-campaigns">
                    View My Campaigns
                  </Button>
                </Link>
                
                <Link href="/client-apps">
                  <Button variant="outline" className="w-full" data-testid="button-client-apps">
                    Manage Client Apps
                  </Button>
                </Link>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowForm(true)}
                  data-testid="button-switch-user"
                >
                  <User className="h-4 w-4 mr-2" />
                  Switch User
                </Button>

                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleLogout}
                  data-testid="button-logout"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </Card>
        ) : null}

        {showForm && (
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold mb-2">Simulate User Session</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enter your Reachu User ID to start a session
                </p>
              </div>

              <div className="space-y-3">
                <Input
                  placeholder="e.g., reachu-admin, user-123, etc."
                  value={reachuUserId}
                  onChange={(e) => setReachuUserId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleLogin()}
                  disabled={isLoading}
                  data-testid="input-user-id"
                />

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleLogin}
                  disabled={!reachuUserId.trim() || isLoading}
                  className="w-full"
                  data-testid="button-start-session"
                >
                  <LogIn className="h-4 w-4 mr-2" />
                  {isLoading ? 'Starting Session...' : 'Start Session'}
                </Button>

                {currentUser && (
                  <Button
                    variant="ghost"
                    onClick={() => setShowForm(false)}
                    className="w-full"
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                )}
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Demo User IDs:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReachuUserId("reachu-admin")}
                    data-testid="button-demo-admin"
                  >
                    reachu-admin
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReachuUserId("user-test")}
                    data-testid="button-demo-user"
                  >
                    user-test
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
