import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

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

if (typeof window !== 'undefined' && firebaseConfig.projectId && firebaseConfig.databaseURL) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  database = getDatabase(app);
  
  console.log('🔥 Firebase initialized with projectId:', firebaseConfig.projectId);
  console.log('🔗 Database URL:', firebaseConfig.databaseURL);
  console.log('🔓 Using unauthenticated access (demo mode)');
} else {
  // Create null objects for server-side rendering
  console.log('⚠️ Firebase not initialized - missing config or running on server');
  app = null;
  database = null;
}

export { database };
export default app;