# Phase 5 — release verification and owner handoff

The owner requested pushing the accumulated Phase 0–5 changes to `main` for their own testing, without deploying a real production environment. This phase completes the local release checks and prepares that handoff. No Firebase project, hosting service, Terraform resources or production data were changed.

## Release changes

- Run the full emulator security/retention/recovery suite and load fixture, then test a compiled Next.js production build on Chromium, Firefox and WebKit. CI installs all three engines and runs `npm run test:phase5` without cloud credentials or deployment steps.
- Return 404 for the `/test` design preview outside development. Disable `X-Powered-By`; add frame embedding, content sniffing, referrer and browser permission headers, plus CSP directives for frame ancestors, objects and base URLs. This is not a full script-source CSP.
- Reject connection IDs matching inherited Object prototype properties so crafted IDs cannot bypass the eight-connection admission limit. An authenticated emulator regression fills all eight connections and checks rejection of those IDs.
- Load the existing Tailwind theme through an explicit `.mjs` configuration, removing the Node module-format warning.
- Use Option+Tab for full keyboard navigation in macOS WebKit tests; other platforms use Tab. Automated accessibility scans cover the tested light/dark/dialog states.

## Local verification

Use Node 22, Java 21+ and both dependency lockfiles:

```sh
npm ci
npm ci --prefix functions
npx playwright install --with-deps chromium firefox webkit
cp .env.example .env.local
npm run check
npm run test:phase5
npm audit --omit=dev --audit-level=high
npm audit --prefix functions --omit=dev --audit-level=high
```

The sample environment is build-only. The release suite supplies its own `demo-realtime-chat` emulator configuration and cannot exercise real Firebase credentials. See the README for an interactive local emulator setup.

Results: lint, frontend/backend type checks and production builds passed. Integration/security/retention/recovery coverage is 26 tests; browser coverage is 15 scenarios per engine (45 total). The initial browser run passed 44 tests; the macOS WebKit keyboard-navigation scenario was then corrected and verified separately. The 26 backend tests were rerun after the connection-ID fix. Together these runs verify all 71 cases; CI runs the combined final suite.

The load fixture accepted 100/100 sends with zero retries, p50 1054 ms, p95 2331 ms and maximum 2452 ms. The coordinator snapshot was 151,447 bytes. See [the exact result](phase-5-load-result.json). This is a FIFO model of configured single-instance callable execution, including queue latency; it is not a deployed concurrency or latency guarantee. Phase 4 documents the emulator worker limitation.

Both runtime dependency audits reported zero vulnerabilities. The full frontend development tree still reports 11 advisories (seven high, four moderate), in Firebase CLI/ESLint chains. Review development/CI exposure and upstream fixes; no forced downgrade or speculative transitive major upgrade was applied.

## Owner acceptance and release

1. Review `.env.example`, enable anonymous authentication, and configure the actual Firebase project, database URL, region and frontend build environment. Keep emulator mode disabled for a real environment. Evaluate and verify App Check/enforcement before public access.
2. Follow [operations.md](operations.md) for migration, rules/Functions/frontend deployment, scheduled retention, monitoring, budget and backup activation. History has moved to `chatMessages`; the schema change requires coordinated deployment and migration. First back up real data and test recovery in an isolated environment. No deployment is performed by this repository's CI.
3. Test two users, multiple tabs, offline/reconnect, duplicate submission/retry and leaving one tab. Check anonymous identity, live capacity, rules denial for forged/direct writes, history pagination and expired admissions against the deployed configuration.
4. Verify mobile keyboard/rotation on physical iOS/Android devices, native screen-reader navigation and actual browser versions used by the audience. Desktop engine emulation is insufficient for those checks.
5. Measure cold starts, real Cloud queueing/contention, typing activity, regional latency and cost. Exercise alerts, scheduled cleanup/outbox repair and a real backup/restore drill before public release.

## Rollback

The pre-change repository baseline is `5c3508c`. After pulling, use `git log --oneline` to identify the release commit. For code rollback, create a normal `git revert <release-commit>` and push it; preserve shared history rather than force resetting `main`.

A code revert does not restore database schema or data. If the release has been deployed, stop writes/admissions and follow the coordinated rollback/restore procedure in [operations.md](operations.md), with a mandatory safety backup and matching rules, Functions and frontend versions. Do not restore old code against the new schema in isolation.

All six code phases are complete locally. Real-environment and physical-device acceptance remains with the owner; no additional implementation phase is assumed, and production readiness is not certified by these local checks.
