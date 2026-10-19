import { spawn } from 'node:child_process';
if (!process.env.FIREBASE_DATABASE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Browser tests must run inside the local Firebase emulator suite');
}
const production = process.env.CHAT_TEST_PRODUCTION === 'true';
const environment = { ...process.env,
  NEXT_PUBLIC_APP_ENV: 'development', NEXT_PUBLIC_USE_FIREBASE_EMULATORS: 'true',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-key', NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-realtime-chat',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-realtime-chat.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_DATABASE_URL: 'https://demo-realtime-chat-default-rtdb.firebaseio.com',
  NEXT_PUBLIC_FIREBASE_APP_ID: 'demo-app',
};
let child;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child?.kill(signal));
if (production) {
  const code = await new Promise(resolve => {
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { stdio: 'inherit', env: environment });
    child.on('exit', resolve);
  });
  if (code !== 0) process.exit(code ?? 1);
}
child = spawn(process.execPath, ['node_modules/next/dist/bin/next', production ? 'start' : 'dev', '--hostname', '127.0.0.1', '--port', '3189'], {
  stdio: 'inherit', env: environment,
});
child.on('exit', code => process.exit(code ?? 0));
