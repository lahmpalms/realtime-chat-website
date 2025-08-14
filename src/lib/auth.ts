'use client';

import { auth } from '@/lib/firebase';
import { signInAnonymously, onAuthStateChanged, User as FirebaseUser, updateProfile } from 'firebase/auth';

export interface AuthState {
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  error: string | null;
}

export async function ensureAnonymousAuth(): Promise<FirebaseUser> {
  if (!auth) throw new Error('Firebase not initialized');

  if (auth.currentUser) {
    return auth.currentUser;
  }

  const cred = await signInAnonymously(auth);
  return cred.user;
}

export function subscribeAuthState(
  onChange: (user: FirebaseUser | null) => void,
  onError?: (err: Error) => void
): () => void {
  if (!auth) {
    const error = new Error('Firebase not initialized');
    if (onError) onError(error);
    // no-op unsubscribe
    return () => {};
  }
  const unsub = onAuthStateChanged(auth, onChange, (e) => onError && onError(e as Error));
  return unsub;
}

export async function setDisplayName(name: string): Promise<void> {
  if (!auth || !auth.currentUser) return;
  try {
    await updateProfile(auth.currentUser, { displayName: name });
  } catch {
    // ignore optional failure
  }
}


