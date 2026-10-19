import * as functions from 'firebase-functions/v1';

export function assertAuthedContext(context: functions.https.CallableContext) {
  const uid = context.auth?.uid;
  if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid) ||
      ['__proto__', 'constructor', 'prototype'].includes(uid)) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required');
  }
  return uid;
}


