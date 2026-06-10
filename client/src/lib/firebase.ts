import { initializeApp, getApps } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

// Same Firebase project as the Commerce webapp (ADR-0007): one identity
// pool shared by both products. These are public client-config values,
// injected per environment via Vite env vars.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

export function getFirebaseAuth(): Auth {
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  return getAuth(app);
}
