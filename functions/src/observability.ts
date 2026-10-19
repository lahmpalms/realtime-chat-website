import * as functions from 'firebase-functions/v1';
import * as logger from 'firebase-functions/logger';

// Bounded instances limit callable/trigger fan-out; quotas and storage bounds are separate controls.
export const runtime = functions.runWith({ maxInstances: 1, timeoutSeconds: 30, memory: '256MB' });
export function callable<T>(operation: string, handler: (data: unknown, context: functions.https.CallableContext) => Promise<T>) {
  return runtime.https.onCall(async (data: unknown, context) => {
    const started = Date.now();
    try {
      if (process.env.CHAT_MAINTENANCE_MODE === 'true') throw new functions.https.HttpsError('unavailable', 'Chat is temporarily paused for maintenance. Your draft is saved.');
      const result = await handler(data, context);
      logger.info('Chat operation completed', { event: 'chat.operation', operation, outcome: 'ok', durationMs: Date.now() - started });
      return result;
    } catch (error) {
      const known = error instanceof functions.https.HttpsError;
      const fields = { event: 'chat.operation', operation, outcome: known ? 'rejected' : 'error', code: known ? error.code : 'internal', durationMs: Date.now() - started };
      // Never log tokens, IDs, names, text, request payloads or arbitrary exception messages.
      if (known) logger.warn('Chat operation rejected', fields); else logger.error('Chat operation failed', fields);
      throw error;
    }
  });
}
