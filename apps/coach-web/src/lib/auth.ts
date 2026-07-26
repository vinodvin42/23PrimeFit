import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  type Auth,
  type UserCredential,
} from 'firebase/auth';

const enabled = process.env.NEXT_PUBLIC_FIREBASE_ENABLED === 'true';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function firebaseEnabled() {
  return enabled;
}

export function ensureFirebase() {
  if (!enabled) return null;
  if (!getApps().length) {
    app = initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  } else {
    app = getApps()[0]!;
  }
  auth = getAuth(app);
  return auth;
}

export async function coachSignIn(
  email: string,
  password: string,
): Promise<{ token: string; mode: 'firebase' | 'dev' }> {
  if (!enabled) {
    return { token: 'dev:coach-demo', mode: 'dev' };
  }
  const a = ensureFirebase();
  if (!a) return { token: 'dev:coach-demo', mode: 'dev' };
  const cred: UserCredential = await signInWithEmailAndPassword(
    a,
    email,
    password,
  );
  const token = await cred.user.getIdToken();
  return { token, mode: 'firebase' };
}
