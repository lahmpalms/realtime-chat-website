import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator, Database } from 'firebase/database';
import { initializeAuth, connectAuthEmulator, browserLocalPersistence, Auth } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, Functions } from 'firebase/functions';

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
  auth = initializeAuth(app, { persistence: browserLocalPersistence });
  functions = getFunctions(app);

  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true') {
    if (!firebaseConfig.projectId.startsWith('demo-')) {
      throw new Error('Local emulators require a demo- Firebase project ID');
    }
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectDatabaseEmulator(database, '127.0.0.1', 9000);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }

} else {
  // Create null objects for server-side rendering
  app = null;
  database = null;
  auth = null;
  functions = null;
}

export { database, auth, functions };
export default app;
