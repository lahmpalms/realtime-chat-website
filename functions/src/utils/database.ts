import { App, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getDatabase, getDatabaseWithUrl } from 'firebase-admin/database';

let app: App | null = null;
export function getAdmin() {
  if (!app) {
    app = getApps().length ? getApp() : initializeApp();
  }
  return app;
}

export function getDb() {
  const adminApp = getAdmin();
  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
    const projectId = adminApp.options.projectId;
    if (!projectId?.startsWith('demo-')) {
      throw new Error('Local emulators require a demo- Firebase project ID');
    }
    // Use the same namespace as the CLI's rules database and the browser emulator config.
    // Without this, the Functions emulator may default to the bare project ID namespace.
    return getDatabaseWithUrl(`https://${projectId}-default-rtdb.firebaseio.com`, adminApp);
  }
  return getDatabase(adminApp);
}


