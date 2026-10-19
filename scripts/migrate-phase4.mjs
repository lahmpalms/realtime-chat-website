import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const { values } = parseArgs({ options: { source: { type: 'string' }, output: { type: 'string' }, project: { type: 'string' } } });
if (!values.source || !values.output || !values.project) throw new Error('Use --source RAW_EXPORT --output NEW_BACKUP --project PROJECT');
const source = JSON.parse(await readFile(values.source, 'utf8'));
if (!source.chatRoom || typeof source.chatRoom !== 'object') throw new Error('Expected a Firebase root export with chatRoom');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { pruneRoom } = require('../functions/lib/retention.js');
const messages = source.chatMessages || source.chatRoom.messages || {};
for (const [id, message] of Object.entries(messages)) {
  if (message.id !== id || typeof message.userId !== 'string' || typeof message.userName !== 'string' || typeof message.userColor !== 'string' || typeof message.text !== 'string' || message.text.length > 500 || !Number.isFinite(message.timestamp)) throw new Error('Invalid historical message; review the source export');
}
// A schema migration never imports client-era admissions or trusts offline profiles.
const chatRoom = pruneRoom({ users: {}, rateLimits: source.chatRoom.rateLimits || {},
  messageIndex: Object.fromEntries(Object.values(messages).map(message => [message.id, message.timestamp])), metadata: { schemaVersion: 4 } });
// The new archive already excludes evicted records; no live deletion backlog is needed.
chatRoom.deleteQueue = {};
const chatMessages = Object.fromEntries(Object.entries(messages).filter(([id]) => chatRoom.messageIndex[id]));
const content = { chatRoom, chatMessages };
const envelope = { format: 1, projectId: values.project, createdAt: new Date().toISOString(), sha256: createHash('sha256').update(JSON.stringify(content)).digest('hex'), ...content };
await writeFile(values.output, JSON.stringify(envelope, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ project: values.project, retainedMessages: Object.keys(chatMessages).length, profilesImported: 0 }));
