import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId
);

const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth: Auth | null = app ? getAuth(app) : null;
export const googleProvider = app ? new GoogleAuthProvider() : null;

export async function loginWithGoogle() {
  if (!auth || !googleProvider) {
    throw new Error('Firebase Web nao configurado');
  }
  const result = await signInWithPopup(auth, googleProvider);
  return result.user.getIdToken();
}

export async function logout() {
  if (!auth) {
    return;
  }
  await signOut(auth);
}

