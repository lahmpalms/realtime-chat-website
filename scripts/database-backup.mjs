import { createRequire } from 'node:module';
import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  project: { type: 'string' }, 'database-url': { type: 'string' }, output: { type: 'string' }, source: { type: 'string' },
  before: { type: 'string' }, 'confirm-project': { type: 'string' }, 'allow-live-restore': { type: 'boolean' },
} });
const [command] = positionals;
if (!['backup', 'restore'].includes(command) || !values.project) throw new Error('Usage: database-backup.mjs backup|restore --project PROJECT [options]');
const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if (host && (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || !values.project.startsWith('demo-'))) throw new Error('Emulator operations require localhost and a demo- project');
const url = host ? `https://${values.project}-default-rtdb.firebaseio.com` : values['database-url'];
if (!url) throw new Error('Live operations require an explicit --database-url');
const target = new URL(url);
if (target.protocol !== 'https:' || !/\.(firebaseio\.com|firebasedatabase\.app)$/.test(target.hostname) ||
    !(target.hostname.startsWith(`${values.project}-`) || target.hostname.startsWith(`${values.project}.`))) throw new Error('Database URL must match the explicit project');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getDatabaseWithUrl } = require('firebase-admin/database');
const { pruneRoom } = require('../functions/lib/retention.js');
const app = initializeApp({ projectId: values.project });
const database = getDatabaseWithUrl(url, app);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function backup(file) {
  if (!file) throw new Error('Backup output path is required');
  const snapshot = await database.ref().get();
  const content = { chatRoom: snapshot.child('chatRoom').val(), chatMessages: snapshot.child('chatMessages').val() };
  const envelope = { format: 1, projectId: values.project, createdAt: new Date().toISOString(), sha256: hash(content), ...content };
  await mkdir(dirname(resolve(file)), { recursive: true, mode: 0o700 });
  await writeFile(file, JSON.stringify(envelope, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ operation: 'backup', project: values.project, file: resolve(file), sha256: envelope.sha256 }));
}
try {
  if (command === 'backup') await backup(values.output);
  else {
    if (values['confirm-project'] !== values.project || (!host && !values['allow-live-restore'])) throw new Error('Restore requires --confirm-project and live restores additionally require --allow-live-restore');
    if (!values.source || !values.before || resolve(values.source) === resolve(values.before)) throw new Error('Restore requires separate --source and --before safety-backup paths');
    if ((await stat(values.source)).size > 20 * 1024 * 1024) throw new Error('Backup is larger than the supported 20 MiB room snapshot');
    const saved = JSON.parse(await readFile(values.source, 'utf8'));
    if (saved.format !== 1 || saved.projectId !== values.project || saved.sha256 !== hash({ chatRoom: saved.chatRoom, chatMessages: saved.chatMessages })) throw new Error('Backup version, project or checksum mismatch');
    const room = saved.chatRoom;
    if (!room || typeof room !== 'object' || Array.isArray(room) || Object.keys(room).some(key => !['users', 'messageIndex', 'outbox', 'receipts', 'deleteQueue', 'rateLimits', 'roomRateLimit', 'metadata'].includes(key))) throw new Error('Invalid room snapshot');
    for (const [id, message] of Object.entries({ ...saved.chatMessages, ...room.outbox })) {
      if (message.id !== id || typeof message.text !== 'string' || message.text.length > 500 || !Number.isFinite(message.timestamp) || typeof message.userId !== 'string' || typeof message.userName !== 'string' || typeof message.userColor !== 'string') throw new Error('Invalid saved message');
    }
    // Never restore live admissions, typing or retired connection IDs from a point-in-time backup.
    room.users = Object.fromEntries(Object.entries(room.users || {}).map(([uid, profile]) => {
      if (profile.id !== uid || typeof profile.name !== 'string' || typeof profile.color !== 'string' || !Number.isFinite(profile.lastSeen)) throw new Error('Invalid saved profile');
      return [uid, { ...profile, connections: {}, retired: {}, accessUntil: 0, isOnline: false, isTyping: false, connectionState: 'offline' }];
    }));
    const restored = pruneRoom(room);
    await backup(values.before);
    const archive = Object.fromEntries(Object.entries(saved.chatMessages || {}).filter(([id]) => restored.messageIndex?.[id]));
    await database.ref().update({ chatRoom: restored, chatMessages: archive, chatMessageAcks: null, chatDeletionAcks: null });
    console.log(JSON.stringify({ operation: 'restore', project: values.project, messages: Object.keys(restored.messageIndex || {}).length, sessionsRestored: 0 }));
  }
} finally { await deleteApp(app); }
