# Real-time Chat

Next.js App Router, React, TypeScript, Firebase Anonymous Authentication and Realtime Database.

## Local setup

Use Node.js 22 (also specified in `.nvmrc` and the Firebase Functions runtime):

```sh
nvm use
npm ci
npm ci --prefix functions
cp .env.example .env.local
```

Replace the sample values in `.env.local` with your Firebase web app configuration. Enable Anonymous Authentication and create a Realtime Database in that project. `NEXT_PUBLIC_*` values are embedded in the browser bundle; never put service account credentials or server secrets in them. Builds and frontend route type generation require the API key, auth domain, project ID, database URL and app ID, and fail early if any are missing. These checks validate presence, not Firebase connectivity or credentials.

```sh
npm run dev
```

Open http://localhost:3000. Firebase Functions credentials come from the Firebase/Google Cloud runtime or local Application Default Credentials, not the browser environment file.

## Verification

```sh
npm run lint                 # Frontend and Functions source, zero warnings
npm run typecheck            # Generate Next.js route types, then check frontend TypeScript
npm run typecheck:functions  # Backend TypeScript
npm run build:functions      # Emits functions/lib/index.js
npm run build                # Next.js production build
npm run check                # All checks above, sequentially
npm run test:security        # Auth + RTDB + Functions emulator integration tests (Java 21+)
npm run test:phase2          # Emulator tests plus all current Chromium scenarios
npm run test:phase3          # Security/session regressions plus current browser scenarios
npm run test:phase4          # Full security/retention/recovery, bounded-load and browser suite
npm run test:phase5          # Release checks against a production build on three browser engines
npm run db:backup -- ...     # Explicit project/output; see docs/operations.md
npm run db:restore -- ...    # Guarded target plus mandatory safety backup
npx playwright install chromium firefox webkit # One-time installation for the release suite
```

Run `npm run start` after a successful build to serve the production frontend locally. The Google font in `src/app/layout.tsx` requires network access during builds.

GitHub Actions runs the same checks on Node 22 after installing both lockfiles, plus security/retention/recovery integration tests, a bounded-load scenario and Chromium/Firefox/WebKit scenarios against a production build on local Firebase emulators and production dependency audits that reject high/critical advisories. CI uses `.env.example` only to compile the app; it does not test a live Firebase project or deploy anything. Configure actual environment values in the hosting provider before building a release. `NEXT_PUBLIC_APP_ENV` should be `staging` or `production` for the corresponding environment.

## Firebase configuration

`firebase.json` declares the Node 22 Functions source, a predeploy build, database rules and local emulator ports. Functions use the `firebase-functions/v1` callable API; the entry point exports `joinRoom`, `leaveRoom`, `sendMessage`, the `onSessionDisconnected` cleanup trigger and `scheduledRetention` for cleanup/outbox recovery. Frontend hosting uses a Next.js-capable provider, such as Vercel; Firebase Hosting for Next.js is not configured here.

Use the installed Firebase CLI with an explicit demo project (Node 22 and Java 21+):

```sh
npm run build:functions
npx firebase emulators:start --project demo-realtime-chat --only auth,database,functions
```

For a browser connected only to local emulators, set these values in `.env.local`, then run `npm run dev` in a second terminal:

```env
NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
NEXT_PUBLIC_FIREBASE_API_KEY=demo-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-realtime-chat.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-realtime-chat
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://demo-realtime-chat-default-rtdb.firebaseio.com
NEXT_PUBLIC_FIREBASE_APP_ID=demo-app
```

Auth, RTDB and callable Functions connect to localhost ports 9099, 9000 and 5001 respectively. Emulator mode requires a `demo-` project ID. The backend selects the same `-default-rtdb` namespace as the CLI rules and browser configuration. Set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false` when configuring a real staging/production build. The automated security suite configures emulators itself and uses no live credentials.

`joinRoom({ name, connectionId })` admits or renews a 90-second connection lease, enforcing up to 20 active UIDs and eight active connections per UID. The browser renews every 20 seconds and registers `onDisconnect` removal before admission. Each physical reconnection gets a new connection ID. Leaving removes only this tab's connection. Offline profiles retain their server-controlled identity, and expired connections cannot keep capacity reserved.

`sendMessage({ text, requestId, connectionId })` atomically checks live membership, enforces five messages per UID/minute plus 100 room messages/minute and records a durable outbox intent. It then publishes to `chatMessages` outside that coordinator and acknowledges delivery. Retrying a retained original confirms it without charging again, even after the connection ends. Interrupted outbox work can be retried or repaired by scheduled retention. New IDs include a server-time-adjusted timestamp; expired unknown requests fail safely and keep the draft.

History queries are indexed/limited to 50 records, with timestamp/key pagination and at most 200 rendered messages. The coordinator/archive retain at most 1000 message indexes, subject to a 24-hour TTL and five-minute scheduled cleanup. The profile cache retains at most 200 profiles, with seven-day expiry and inactive eviction. See `docs/phase-4.md` for semantics and limits.

The composer stores text and the pending request ID in per-tab `sessionStorage`, retains them on errors/offline/reload, and clears them only on acknowledgement. Duplicate submits are blocked while a request is in flight. Editing the text creates a new request ID on the next send. Local storage availability is required for recovery across reload; in-memory drafts still work if storage is blocked.

Database rules deny client profile creation/deletion, identity or lease changes, message writes and private quota reads. Clients may update typing/visibility on their own live connection or delete that connection. Shared reads require an unexpired server admission lease and a connection. The database predeploy guard checks that root read/write are both false; the full emulator/browser suite verifies the granular behavior.

See `docs/phase-4.md` for the current data/submission protocol and verification, and `docs/operations.md` for monitoring, budget, migration and backup/restore activation. Earlier phase reports describe historical baselines.

Cloud deployment, authentication setup, billing and the real deployed rules have not been verified by the local build checks. The owner will test the real environment; no cloud deployment is included in this handoff. See `docs/phase-5.md`.

## Production roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Reproducible installs, patched dependencies, FE/BE build, types, lint, env example, deployment configuration and basic CI | Complete; see `docs/phase-0.md` for verification |
| 1 | Database authorization, server message flow, atomic rate limits/capacity, emulator rules tests | Complete; see `docs/phase-1.md` |
| 2 | Presence lifecycle, reconnect, multiple tabs, send result and retry correctness | Complete; see `docs/phase-2.md` |
| 3 | Thai names, composer UX, scroll, mobile layout, accessibility and error states | Complete locally; see `docs/phase-3.md` |
| 4 | Bounded queries, pagination/indexes, retention, monitoring, cost alerts and backup/restore | Complete locally; cloud activation/validation in Phase 5. See `docs/phase-4.md` |
| 5 | Release regression, security hardening and owner test handoff | Complete locally; cloud/device acceptance remains with the owner. See `docs/phase-5.md` |

All six code phases (0–5) are complete locally. The owner requested a push to `main` and will test the real environment; this does not certify a public production launch. Remaining acceptance work includes actual cloud configuration, monitoring/budget/backup activation, deployed load/cost measurements, physical mobile devices and native screen readers. Local Chromium, Firefox and WebKit checks cover desktop browser engines, not those physical-device checks. Remaining development-tool advisories are recorded in `docs/phase-5.md`.
