import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";

// Spike page for ADR-0007: sign in against the shared Commerce Firebase
// project and prove the Vio backend accepts the resulting ID token.
// Not linked from the nav on purpose — reach it at /firebase-login.
export default function FirebaseLoginPage() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [meResult, setMeResult] = useState<string | null>(null);

  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured) return;
    return onIdTokenChanged(getFirebaseAuth(), setUser);
  }, [configured]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setMeResult(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const loginEmail = () =>
    run(() => signInWithEmailAndPassword(getFirebaseAuth(), email, password));

  const loginGoogle = () =>
    run(() => signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider()));

  const callMe = () =>
    run(async () => {
      const token = await user!.getIdToken();
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      setMeResult(`HTTP ${res.status}\n${JSON.stringify(body, null, 2)}`);
    });

  if (!configured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Firebase login (spike)</CardTitle>
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
          <CardTitle>Firebase login (spike)</CardTitle>
          <CardDescription>
            Shared identity with Commerce — ADR-0007. Sign in with the same account you use on the
            Commerce webapp.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user ? (
            <>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">uid:</span> {user.uid}</p>
                <p><span className="text-muted-foreground">email:</span> {user.email ?? "—"}</p>
                <p>
                  <span className="text-muted-foreground">provider:</span>{" "}
                  {user.providerData[0]?.providerId ?? "—"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={callMe} disabled={busy}>Test /api/auth/me</Button>
                <Button variant="outline" onClick={() => run(() => signOut(getFirebaseAuth()))} disabled={busy}>
                  Sign out
                </Button>
              </div>
              {meResult && (
                <pre className="text-xs bg-muted rounded-md p-3 overflow-auto whitespace-pre-wrap">
                  {meResult}
                </pre>
              )}
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="fb-email">Email</Label>
                <Input
                  id="fb-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fb-password">Password</Label>
                <Input
                  id="fb-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={loginEmail} disabled={busy || !email || !password}>
                  Sign in
                </Button>
                <Button variant="outline" onClick={loginGoogle} disabled={busy}>
                  Sign in with Google
                </Button>
              </div>
            </>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
