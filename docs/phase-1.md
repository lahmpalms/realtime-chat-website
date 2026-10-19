# Phase 1 — database authorization and server enforcement

Historical baseline: the session/connection protocol is superseded by [Phase 2](phase-2.md).

Date: 2026-10-19. Scope: application code, rules and local emulator integration; no cloud deployment.

## Server API

- `joinRoom({ name })` requires authenticated Firebase context. It validates a printable trimmed name of 1–20 UTF-16 code units and rejects unknown request fields. A transaction on `chatRoom/users` creates the member with the authenticated UID, server-selected color and server timestamps only if fewer than 20 members exist. Joining again with the same UID returns its existing profile, including when the room is full.
- `sendMessage({ text, requestId })` requires authentication and room membership. It validates the request shape, trimmed message length (1–500 code units), request ID and the existing profanity filter before persistence. User ID, display name, color and timestamp come from authenticated/server state, not the caller's payload.
- One transaction on `chatRoom` checks membership, enforces five messages per UID in a sliding 60-second window, and commits the message and quota together. A concurrent membership deletion causes the transaction to retry. A rejected message does not consume quota. Quota state is private under `chatRoom/rateLimits` and remains after leave/rejoin.
- Request IDs are scoped to the UID. Concurrent identical retries return the same saved message and consume one quota slot. Reusing an ID with different text fails with `already-exists`. A quota error returns `resource-exhausted` with `details.retryAfterMs`.
- Transaction callbacks may initially see null from an empty local cache. Denial paths return unchanged state instead of aborting on that initial cache value; the committed snapshot determines the response after conflict resolution.

## Database rules

Root reads/writes default to false. Clients cannot create members, write/update/delete messages, change identity fields, write metadata, or access private quota/moderation/unrecognized paths. Shared collection reads require membership; a user can also read their own profile path.

Clients can update only activity fields on their existing profile, write validated presence/typing for themselves while admitted, or delete their own member/presence/typing entries. Identity fields remain equal to their prior server values. Unknown fields and invalid state/timestamps are rejected. Deletes of one's own transient entries remain allowed after leaving so cleanup can complete. A timestamp index is declared for future bounded message queries.

## Frontend integration

The frontend now calls the two server endpoints and uses server timestamps for activity/typing. Client-only capacity and rate-limit enforcement were removed; errors propagate back from the server. Client cleanup of other people's records was removed because authorization no longer permits it.

A necessary lifecycle correction prevents renders/React Strict Mode cleanup from deleting membership: component cleanup stops typing, while explicit Leave removes the member and transient records atomically. Connection drop cleanup still uses `onDisconnect`. Broader reconnect and multiple-tab behavior remains Phase 2 work.

Emulator mode connects the browser to Auth/RTDB/Functions and requires a demo project ID. The Admin SDK explicitly selects the same demo RTDB namespace as browser/rules configuration; the Functions emulator otherwise defaults to a different bare-project namespace.

## Verification

Run `npm run test:security` with Node 22 and Java 21+. It builds the backend and starts local Auth, RTDB and Functions emulators under `demo-realtime-chat`. Tests refuse to run unless emulator host variables exist. The fixture namespace is explicitly shared with the emulated backend.

Coverage:

1. Unauthenticated/unjoined users cannot read shared collections or root; members cannot read private quota state.
2. Root/collection deletes, deleting another member, forging messages, creating members and tampering with quota/metadata are denied, including atomic multi-path attacks.
3. Identity fields, extra fields and invalid activity values cannot be changed by clients.
4. Presence/typing requires ownership, membership, valid shape/timestamps and the registered display name; departure revokes shared reads and prevents ghost profile creation.
5. Real Auth emulator tokens are required by callable HTTP endpoints; invalid/forged inputs and profanity are rejected before persistence.
6. Concurrent duplicate message requests persist one server-authored message and one quota entry; conflicting reuse fails.
7. Twelve simultaneous send requests accept exactly five; all others receive quota errors; leave/rejoin does not reset quota.
8. Expired quota entries are pruned using server time.
9. Twenty-four simultaneous admissions yield exactly twenty members; an existing member can rejoin and a departure frees a slot.
10. The actual Firebase client SDK can anonymously authenticate, register onDisconnect before joining, call join/send, read the committed message, update activity and leave under the real rules.

Local verification passed all 10 tests on Node 22.22.3 and Java 22. `npm run check` passed lint with zero warnings, both typechecks and both production builds using sample build-only configuration. Production dependency audits reported zero vulnerabilities for both frontend and backend at verification time; the previously documented development-tool advisories remain. `git diff --check` and the database predeploy guard passed.

The CI workflow runs the emulator suite with Java 21 as well as lint, frontend/backend typechecks/builds and production dependency audits. This does not verify cloud deployment or browser hydration.

## Rollout and remaining work

- Before deploying to a real project, back up and migrate/clear legacy membership and quota data with Admin access. Old member records were client-writable and must not be treated as trusted server-created profiles. Decide explicitly how to preserve prior message history. No live data has been modified here.
- Coordinate frontend, callable endpoint and rule deployment in staging. Old frontend clients that write messages/members directly will be rejected by the new rules and must refresh. Retire the old `validateMessage` and `onMessageWrite` endpoints during the controlled rollout if they were ever deployed.
- The room-wide message transaction provides atomic membership/quota/message semantics, but reads and rewrites the room snapshot and contends with activity updates. Phase 4 must bound history, expire old quota state and load-test/revisit this boundary before production. The current cap is 20 members, not an unlimited-throughput design.
- The cap counts admitted records; stale-session recovery and per-connection/multiple-tab membership need Phase 2. A transient presence initialization failure after server admission can currently leave a reserved seat until disconnect/cleanup.
- UID limits do not prevent a bot from creating new anonymous accounts. Abuse protection/App Check, global budgets and operational alerts must be assessed before release. The existing profanity filter is limited to its dictionary and is not comprehensive multilingual moderation.
- The server supports idempotent retries; the composer still clears its draft immediately and does not retain the request ID across retries. Fix this in Phase 2. Thai display-name UX and remaining accessibility/layout work are Phase 3.

Next: **Phase 2 — presence, reconnect, multiple tabs and reliable send/retry behavior**. Four phases remain: 2, 3, 4 and 5.
