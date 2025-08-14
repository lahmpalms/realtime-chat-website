import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, setPersistence, browserLocalPersistence, Auth } from 'firebase/auth';
import { getFunctions, Functions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only if it hasn't been initialized and we have valid config
let app: FirebaseApp | null;
let database: Database | null;
let auth: Auth | null;
let functions: Functions | null;

if (typeof window !== 'undefined' && firebaseConfig.projectId && firebaseConfig.databaseURL) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  database = getDatabase(app);
  auth = getAuth(app);
  
  // Persist auth session in the browser
  setPersistence(auth, browserLocalPersistence).catch(() => {
    // Ignore persistence errors; auth will fallback to in-memory
  });
  functions = getFunctions(app);
} else {
  // Create null objects for server-side rendering
  app = null;
  database = null;
  auth = null;
  functions = null;
}

export { database, auth, functions };
export default app;