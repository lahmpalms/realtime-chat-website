import * as functions from 'firebase-functions/v1';
import * as logger from 'firebase-functions/logger';
import { runRetention } from './retention';

export const scheduledRetention = functions.runWith({ maxInstances: 1, timeoutSeconds: 60, memory: '256MB' })
  .pubsub.schedule('every 5 minutes').timeZone('UTC').onRun(async () => {
    const started = Date.now();
    try {
      const stats = await runRetention();
      logger.info('Chat retention completed', { event: 'chat.retention', outcome: 'ok', durationMs: Date.now() - started, ...stats });
    } catch {
      logger.error('Chat retention failed', { event: 'chat.retention', outcome: 'error', durationMs: Date.now() - started });
      throw new Error('Chat retention failed');
    }
  });
