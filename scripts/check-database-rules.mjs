import { readFileSync } from 'node:fs';

const { rules } = JSON.parse(readFileSync(new URL('../firebase-rules.json', import.meta.url), 'utf8'));

// Reject broad root grants. Granular authorization is verified by emulator tests.
if (rules['.read'] !== false || rules['.write'] !== false) {
  console.error('Database deploy blocked: root .read and .write must both be false.');
  process.exitCode = 1;
}
