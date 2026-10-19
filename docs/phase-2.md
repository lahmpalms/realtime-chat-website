# Phase 2 — per-tab sessions and reliable message submission

Date: 2026-10-19. Local implementation and verification only; no cloud deployment.

## Session protocol

- A user profile is server-owned and survives disconnects, preserving UID, color and join identity across reload/reconnect. A new display name can be chosen on admission when that UID has no other active connections. Presence is derived from its active `connections/{connectionId}` entries. Offline profiles do not count toward the 20-active-UID capacity limit.
- `joinRoom({ name, connectionId })` is also the heartbeat. It atomically prunes expired connections and renews the selected connection's 90-second lease. Only the server can create connections or modify `lastSeen`, `joinedAt`, profile identity or `accessUntil`. A maximum of eight active connections per UID prevents unbounded tab records.
- The client renews every 20 seconds and stops treating a connection as ready after 75 seconds without an acknowledgement, allowing margin for a slow callable response. Browser offline/online events explicitly suspend/resume this tab's database transport. Firebase `.info/connected` drives recovery when the physical connection changes independently of browser events.
- Each physical connection receives a new random ID. Server `onDisconnect().remove()` is registered before admission, and client cleanup targets only the old ID. The connection ID is never stored/reused across reloads or cloned tabs. Late callable responses check the current attempt object; they cannot restore a stopped/replaced controller and trigger compensating cleanup for their old ID.
- Closed connection IDs are retired for up to two minutes so a delayed join/heartbeat cannot revive them. The client allocates a fresh ID if recovery encounters a retired ID. New connections are throttled after 64 recent closures per UID, while existing live heartbeats remain allowed; at most 72 retirement markers are retained per profile. Explicit leave, trigger cleanup and TTL pruning all preserve replacement connections.
- `leaveRoom({ connectionId })` removes only that connection. Explicit Leave stops local monitoring immediately and performs both an own-connection removal and a best-effort server reconciliation. If transport is unavailable, onDisconnect or lease expiry frees the seat; a delayed leave cannot remove a replacement tab/session.
- `onSessionDisconnected` reconciles server aggregate flags/access after a connection is deleted. New admissions also prune expired leases, so cleanup-trigger delays do not reserve seats indefinitely. Typing and visibility writes occur only on the caller's existing live connection. Typing expires in the client view even when no subsequent database event arrives.
- A single `ChatSession` controller owned by `UserProvider` replaces the old independent presence, multi-tab, cleanup and typing hooks. Only a ready session starts protected chat listeners. Auth is initialized directly with shared browser-local persistence (rather than migrating persistence whenever a new tab opens), waits for restoration and shares concurrent anonymous-sign-in requests, including React Strict Mode mounts. A saved per-tab join intent restores the chat after refresh without sharing tabs' connection IDs.

The retired-ID cache is a short recovery safeguard, not an indefinite revocation list: it expires after two minutes and is capped at 72 entries. After extreme churn/eviction or a missing cleanup event, the 90-second server lease remains the fallback bound for abandoned admissions.

The design follows Firebase's guidance to [store each connection separately and register disconnect operations before online writes](https://firebase.google.com/docs/database/web/offline-capabilities).

## Reliable sends and drafts

- The caller persists `{ text, requestId }` in `sessionStorage` before sending. A lost HTTP response, rejection, offline event or reload does not clear the draft. Drafts are scoped to the authenticated UID and browser tab; explicit Leave preserves the draft for a later rejoin.
- The form uses an immediate in-flight ref as well as a disabled control to prevent two submissions in the same event turn. It awaits the server acknowledgement and clears text/pending ID only on success.
- Unchanged trimmed text retries the same request ID. Edited text gets a new ID. A response belonging to an unmounted composer cannot clear a newer draft after leaving/rejoining. The server's saved-message lookup allows the same authenticated sender to confirm an already committed message even if that connection has since expired/left; new messages still require a live lease. Different text for an existing ID is rejected.
- A `resource-exhausted` response with `retryAfterMs` retains the draft, shows a countdown and disables submission until the cooldown ends. There is no automatic message retry. An intentional retry is required after connection recovery.
- Offline users can continue editing drafts. Storage failures fall back to memory; recovery after reload cannot be guaranteed when sessionStorage is blocked or cleared. A pending draft is plain local browser storage, so shared-device policies and retention remain part of the release/privacy review.

## Verification

- `npm run test:security`: authorization, concurrent quota/admission, idempotency, per-tab leave/late cleanup, stale lease reclamation, tab bounds and actual Firebase client SDK integration against Auth/RTDB/Functions emulators.
- `npm run test:phase2`: the same emulator tests followed by Chromium/Playwright tests using the real Next.js application and Firebase emulators. Scenarios cover multiple tabs, offline editing/reconnect/reload, lost acknowledgement with the same ID after reload, leaving during a delayed restore, duplicate immediate submits, quota cooldown feedback and a delayed send response after leave/rejoin. The cooldown UI test injects a short controlled 429 response; actual server quotas are separately verified by concurrent emulator requests.
- `npm run check`: lint with zero warnings, frontend/backend typechecks and both production builds with sample build-only configuration.
- Local verification: emulator integration/security tests passed **15/15** and Chromium browser scenarios passed **7/7** (22 checks in total), including lost acknowledgement after reload and a late acknowledgement after leave/rejoin. Frontend/backend lint (zero warnings), typechecks and production builds passed on Node 22.22.3 with sample build-only configuration. Production dependency audits reported **0 vulnerabilities** in both trees at verification time; development-tool advisories from earlier phases remain. `git diff --check`, configuration/lockfile checks and the database predeploy guard passed.
- CI installs Chromium and Java 21 and runs the full Phase 2 suite; local emulator verification uses Java 22. No actual cloud deployment or mobile/Safari test is claimed.

## Rollout and limits

The request schema and database paths changed: callables now require `connectionId`, presence/typing are nested inside the user's connections, and profile deletion is denied to clients. Coordinate frontend, functions (including the database cleanup trigger) and rules in staging. Migrate legacy member/presence/typing records rather than treating old client-writable profiles as trusted. No live data has been migrated or deleted here.

A truly abandoned server admission can remain until its lease expires if the browser disappears between the server write and client cleanup. Capacity checks ignore expired leases; this bound is intentional. Background tabs may have timers throttled; they reacquire admission when visible/connected and may encounter a full room if their lease expired in the meantime. Lease time is server-controlled; UI presence uses the Firebase server-time offset.

Heartbeat and send transactions still inspect room/member snapshots. Before public release, Phase 4 must bound history/profile/quota retention, load-test contention, assess function invocation costs and add operational/abuse controls. Tests cover Chromium locally; broader device/browser/accessibility testing remains in Phases 3 and 5.

Next: **Phase 3 — UX/UI, Thai names, scrolling, mobile layout and accessibility**. Three phases remain: 3, 4 and 5.
