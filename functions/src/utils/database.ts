import * as admin from 'firebase-admin';

let app: admin.app.App | null = null;
export function getAdmin() {
  if (!app) {
    app = admin.initializeApp();
  }
  return app;
}

export function getDb() {
  return getAdmin().database();
}


