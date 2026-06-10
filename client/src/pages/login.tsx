import { useState } from "react";
import { useLocation } from "wouter";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type UserCredential,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUser } from "@/contexts/UserContext";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

// Operator login (ADR-0007): signs in against the shared Commerce Firebase
// project, then exchanges the ID token for the dashboard session cookie.
// Only allowlisted accounts get a session — anyone else sees the 403 message.
export default function LoginPage() {
  const { loginWithIdToken, userId } = useUser();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (userId) {
    setLocation("/");
    return null;
  }

  const completeLogin = async (credential: Promise<UserCredential>) => {
    setBusy(true);
    setError(null);
    try {
      const { user } = await credential;
      const idToken = await user.getIdToken();
      await loginWithIdToken(idToken);
      setLocation("/");
    } catch (e) {
      // Leave no half-session behind when the account is not allowlisted.
      await signOut(getFirebaseAuth()).catch(() => undefined);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const loginEmail = () =>
    completeLogin(signInWithEmailAndPassword(getFirebaseAuth(), email, password));

  const loginGoogle = () =>
    completeLogin(signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider()));

  if (!isFirebaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Missing client config. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN and
              VITE_FIREBASE_PROJECT_ID in .env, then restart the dev server.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Use your Vio Commerce account — both products share the same login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              loginEmail();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                data-testid="input-login-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                data-testid="input-login-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={busy || !email || !password}
              data-testid="button-login-email"
            >
              Sign in
            </Button>
          </form>
          <Button
            variant="outline"
            className="w-full"
            onClick={loginGoogle}
            disabled={busy}
            data-testid="button-login-google"
          >
            Sign in with Google
          </Button>
          {error && (
            <p className="text-sm text-destructive" data-testid="text-login-error">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
