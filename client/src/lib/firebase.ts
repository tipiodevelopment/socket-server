import { initializeApp, getApps } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

// Shared Commerce Firebase identity (ADR-0007), one project PER ENVIRONMENT:
//   local / development / staging → Commerce STAGING project (reachu-qa)
//   production                    → separate Commerce PRODUCTION project
// Never point prod at the staging project. Public client-config values,
// injected per environment via build-time VITE_ vars (see vite envDir).
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
