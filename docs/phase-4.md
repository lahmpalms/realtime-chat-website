# Phase 4 — bounded data, performance and operations

Date: 2026-10-19. Local implementation only. Actual deployment, cloud notifications/billing and a real backup drill remain Phase 5 release gates.

## Data and query bounds

- History is now `chatMessages`, outside the membership/quota coordinator. Realtime history reads are indexed by timestamp and limited to 50 messages on the server. Rules reject unbounded/wrongly ordered queries and requests above that limit. Own profile reads remain available for session restoration; shared presence requires an indexed `accessUntil` query limited to 20 UIDs.
- “Load earlier messages” uses an exclusive `(timestamp, key)` cursor. Equal timestamps do not skip/duplicate messages. The visible window is capped at 200 while pagination can reach the entire retained history; older paging drops the newest part of that window. Reading history keeps its scroll anchor. A separate bounded live window collects new-message notifications, and Return to latest/own sends restore the current window. Disconnect/leave generations prevent stale page responses from restoring old data.
- The coordinator retains at most 1000 message indexes and the archive retains their message bodies. TTL is 24 hours, with scheduled cleanup/recovery every five minutes when idle. Count/TTL eviction queues durable deletions; publication/deletion acknowledgements live outside the transaction subtree and are compacted on subsequent work. Physical deletion can lag during failures; monitoring and the recovery job are necessary. Already delivered client copies and backups have separate retention behavior.
- Profiles are a cache of at most 200, expiring after seven days without activity and evicting oldest inactive profiles under capacity pressure. Live/retired connections are protected. When the cache is full of protected entries, new admissions back off instead of growing storage. A returning cached UID keeps identity/color; an evicted UID receives a fresh profile. Admission remains 20 active UIDs/eight live connections per UID.
- Private UID quotas expire after their 60-second window. A room-wide 100-messages/minute quota bounds anonymous-UID churn independently of the per-UID five/minute quota. The outbox has a 100-pending-message bound; a deletion backlog also applies backpressure. These are application limits, not a billing cap or a substitute for upstream abuse controls.

## Atomic submission and recovery

Membership, quota, compact retry receipt, message index and full pending outbox intent commit in one RTDB transaction. Normal send then publishes the immutable message body outside that subtree and acknowledges success only after publication. Failed/interrupted delivery stays in the outbox and can be confirmed by the same request or repaired by scheduled retention. There is no database publication trigger invocation for every message.

Recent receipts store a text hash, creation time and server commit time. Delivered receipts compact after 60 seconds; undelivered outbox receipts remain until delivery/expiry recovery. A retained original history message can confirm an older retry even after leaving. New request IDs contain a server-time-adjusted timestamp plus UUID. Unknown requests below the compacted creation-time floor, older than 24 hours or over five minutes in the future fail with `request-expired`; the draft is retained and the user must intentionally edit/restart it. Legacy UUID requests can confirm retained originals but cannot silently become new messages after eviction.

A private short lease serializes room coordination across handlers, alongside per-process sequencing and one-instance caps per first-generation entry point. It expires after ten seconds if a worker disappears, has an eight-second acquisition budget, and only its owner can release it. A missing local SDK cache value during release is resolved through a compare-and-set rather than an immediate abort. Atomic RTDB transactions remain the correctness boundary if a worker outlives the lease. Client connection activity can still cause transaction retries; deployed tests must include typing, background tabs and actual database-region latency.

The first bounded-history prototype still transacted full message bodies and failed concurrent stress. The final design removes them and avoids publisher acknowledgement/deletion writes inside the coordinator, which would invalidate its transactions.

## Monitoring, budget and recovery assets

`functions/src/observability.ts` emits structured operation/outcome/code/duration logs without arbitrary payloads, tokens, user IDs, names or text. `scheduledRetention` emits aggregate success/error counts and size/duration measurements.

`ops/main.tf` and its provider lock define log metrics, email routing, error/latency/quota-pressure/missing-retention alerts, a scoped project budget and a private backup bucket. Terraform format/validation can run without cloud credentials, and CI validates them. They have not been applied to any project. The budget and recipient must be chosen by the deployment owner, and alerts/actual automated backups must be enabled and verified in Phase 5.

`scripts/database-backup.mjs` exports a consistent snapshot of the application nodes, verifies a project/version/checksum envelope, uses private non-overwriting local files and creates a mandatory safety backup before restore. Restore atomically replaces control/history, clears acknowledgement state and strips live sessions. The offline migration tool transforms a Phase 3 raw export into the new schema and discards legacy admissions. Both are exercised against emulators. See [the operations and recovery runbook](operations.md) for commands, IAM/cloud activation, retention, maintenance and rollback requirements.

## Toolchain

Migrated Tailwind 3 to Tailwind 4.3.3, its PostCSS plugin and `tw-animate-css`, removing the old Tailwind/PostCSS selector dependency chain. Existing theme configuration is explicitly loaded and browser/accessibility regressions exercise the resulting UI. Tailwind 4 requires modern browsers; see the [official upgrade guide](https://tailwindcss.com/docs/upgrade-guide). Actual Safari/Firefox and device verification is still Phase 5.

The full development dependency audit fell from 15 to 11 advisories (seven high/four moderate), in remaining Firebase CLI/ESLint dependency chains. Several propose incompatible downgrades or have no patched upstream version. No force downgrade or unreviewed transitive major override was applied. The runtime trees are audited separately; release owners must review remaining development-tool exposure and track upstream fixes before release.

## Verification and limits

Run `npm run test:phase4` with Node 22, Java 21+ and installed Chromium. It builds Functions, uses local Auth/RTDB/Functions emulators, then runs integration/security/retention/recovery tests, the load scenario and all browser scenarios. All destructive fixtures are demo/emulator-only.

The load fixture has 20 logical clients, 200 profiles, 1000 retained messages initially containing 500 Thai characters each, 100 accepted sends and interleaved heartbeats. The installed Firebase emulator creates extra workers and does not enforce first-gen `maxInstances`; the benchmark therefore models the configured one-instance FIFO per callable, counting queue and retry time in latency. It is **not** a measurement of 20 simultaneous function executions or a deployed performance guarantee. Unrestricted emulator bursts exceeded the intended configuration and caused timeouts; raising the instance cap requires new contention/load tests. The local regression ceiling is p95 below ten seconds. Production gates must test actual Cloud queueing, cold starts, typing writes, region latency and billed egress.

Automated coverage includes query-limit authorization, concurrent capacity/quota/idempotency, expired retry rejection, pending receipt recovery, profile/message/quota compaction, outbox replay, checksum/target protections, session-free restore, offline schema migration, timestamp-tied pagination, bounded rendering/anchor preservation and all Phase 2–3 browser/accessibility regressions.

`npm run check` passed frontend/backend lint, typechecks and production builds with build-only sample configuration. Lockfile consistency, production layout CSS, database predeploy guard and `git diff --check` passed.

Local results: **25/25 integration/security/recovery tests and 14/14 Chromium browser tests passed (39 total)**. The load fixture accepted all **100/100 sends without retries**, with queue-inclusive p50 **1074ms**, p95 **2627ms**, maximum **2734ms**, and a compact coordinator snapshot of **151,447 bytes**. See [the exact fixture/result](phase-4-load-result.json). Terraform format/validation passed with Terraform 1.16.6 and locked Google provider 7.46.1. Frontend and Functions runtime-only audits each reported **0 vulnerabilities**; the full development audit remains at **11** advisories.

Next: **Phase 5 — staging verification, cloud activation and rollout/rollback**. One phase remains. Do not treat local completion as approval for a public production launch.
