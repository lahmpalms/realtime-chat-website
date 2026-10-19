# Phase 0 — build and dependency baseline

Date: 2026-10-16. Scope: local build readiness; no cloud deployment.

## Changes

- Next.js and eslint-config-next 15.5.28; React/react-dom 19.1.10. The Next.js version follows the [2026-10-14 security release](https://nextjs.org/blog/nextjs-security-update-october-14-2026).
- Node 22 declared in `.nvmrc`, package engines, CI and Firebase runtime configuration.
- Added the missing Autoprefixer dependency; refreshed the frontend lockfile and added a Functions lockfile for reproducible installs.
- Firebase Admin 14.5.0 and Functions 7.4.0. Functions explicitly import the v1 API, Admin uses modular imports, and `functions/src/index.ts` exports both existing handlers.
- Added npm commands for lint, separate FE/BE typechecks, Functions build and an aggregate check. Frontend typechecking generates Next.js route types first and excludes the backend project.
- Fixed strict type errors and lint errors/warnings in existing source without disabling lint or TypeScript build checks.
- Added `.env.example`, production build config validation, Firebase config, generated-file ignores and basic GitHub Actions checks.
- Added a database predeploy guard because the existing root write rule remains unsafe until Phase 1.

## Dependency overrides

Two temporary, explicit overrides keep patched transitive dependencies while retaining Next.js 15 and the Firebase 12 API:

- `next -> postcss@8.5.30`: replaces the pinned 8.4.31 dependency to address the reported PostCSS source-map disclosure and CSS stringification advisories. [PostCSS upstream advisory](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp).
- `@grpc/grpc-js@1.14.6`: replaces Firebase Firestore's older 1.x gRPC dependency to address the certificate authorization and error disclosure advisories. Firestore is installed by Firebase but this application uses Realtime Database. [gRPC upstream advisory](https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j).

Review and remove these overrides once the corresponding upstream dependency ranges include the fixed versions. A fresh lockfile resolution was needed because updating the old npm lockfile retained an invalid nested PostCSS version despite the override.

## Validation

Validation uses Node 22.22.3, sample build-only Firebase values from `.env.example`, and a clean temporary copy of the source with no `node_modules`, `.next`, `next-env.d.ts` or TypeScript build cache.

- `npm ci` and `npm ci --prefix functions`.
- `npm run check`: lint with zero warnings, FE/BE typechecks and FE/BE production builds.
- Functions entry point loads and exports `validateMessage` and `onMessageWrite`.
- Production frontend starts; `GET /` returns HTTP 200 and the app HTML. This checks server startup, not browser hydration or a live chat session.
- Production build rejects missing Firebase configuration.
- Database deployment guard rejects the current permissive root write rule.
- `git diff --check`.
- `npm audit --omit=dev`: zero reported vulnerabilities for both frontend and Functions production dependency trees at the time of verification.

The full frontend audit including development dependencies still reports 10 advisories (7 high, 3 moderate) in the Tailwind 3/ESLint tooling dependency chains, including braces and postcss-selector-parser. The available automatic fixes either require incompatible toolchain changes or report no fix; `npm audit fix --force` was not used. Track a tooling migration/replacement in Phase 4 and reassess before release. Production dependency audit results do not establish application security.

## Remaining phases

Phase 0 completes the build baseline. Next is **Phase 1 — authorization and server-enforced rules**. Five phases remain (1–5):

1. Fix database rules, move message validation/writes to the server, make rate limits and room admission atomic, and add emulator tests. The predeploy root-rule guard alone is not sufficient authorization coverage.
2. Fix presence cleanup, reconnect, multiple tabs and reliable message send/retry behavior.
3. Improve Thai-name support, composer/error states, scrolling, mobile layout and accessibility.
4. Bound queries, add indexes/pagination, retention, monitoring, cost alerts, backup/restore and address remaining tooling advisories.
5. Validate staging, E2E/security regression, actual cloud configuration and rollout/rollback.

Real Firebase credentials, cloud permissions, deployed rules and browser behavior have not been validated in Phase 0. The application is not yet ready for a public production release.
