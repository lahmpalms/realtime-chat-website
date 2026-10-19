# Chat operations and recovery

These are reviewable configuration and runbooks. No cloud resources have been applied. Local emulator tests do not verify Cloud IAM, email delivery, billing or Cloud Scheduler execution.

## Monitoring and cost controls

`ops/main.tf` defines logs-based metrics, email notification routing, alerts for unexpected errors, elevated p95 operation duration, sustained quota/admission rejection and missing retention runs. It also defines a project billing budget (50%, 90%, 100% thresholds) and a private backup bucket with object versioning and a 30-day lifecycle. Terraform is validated without cloud credentials; planning/applying and verifying notifications are Phase 5 staging tasks.

1. Copy `ops/terraform.tfvars.example` to an ignored `.tfvars` file. Choose the real project, billing account, region/location, operations mailbox and approved monthly budget. The example USD 10 is a placeholder, not an estimate or spending authorization.
2. Use an authenticated operator identity with the necessary project monitoring/logging, billing-budget and bucket permissions. Review `terraform -chdir=ops plan` before applying. Use a controlled remote Terraform state backend in the deployment environment.
3. After applying, verify the email channel, invoke/test each alert in staging and record recipients. The absence alert needs an initial successful retention run to establish its time series. Check Cloud Scheduler/Pub/Sub delivery and alert on failures; the function is scheduled every five minutes.
4. Set `CHAT_MAINTENANCE_MODE=true` in the backend environment and deploy it when a pause is required. All callable operations return unavailable and drafts remain local. Let in-flight calls drain before data maintenance. Remove the setting and deploy to resume.

Backend logs contain operation/outcome/code/duration and aggregate retention counts, not tokens, UIDs, names or message text. Do not add payloads to log fields. Log retention and access policy must be reviewed in the deployed project.

The app limits 20 active UIDs, eight connections per UID, five messages per UID/minute, 100 room messages/minute, 100 outstanding outbox messages, 1000 retained message indexes and 200 cached profiles. Callables and database handlers have one maximum instance each; RTDB transactions remain authoritative between entry points. This is a deliberately small single-room system.

Budgets are notifications, **not a hard spending cap**. Max instances and room quotas also do not stop Auth/RTDB egress, repeated allowed reads, rejected request traffic or other services from incurring costs. Before public release, enable/test App Check or appropriate upstream abuse controls and alerts in staging. Price/estimate the actual deployed region, retry rate and billed network traffic; do not infer cost from JSON size or emulator latency alone.

At 20 continuously online UIDs, heartbeats alone are about 86,400 join/renew calls per day (more with multiple tabs). A fully utilized room quota permits 144,000 messages/day, each with publication work and multiple database operations. The cron adds 288 scheduled runs/day. These are upper-bound workload examples, not currency estimates.

## Backup and restore

Enable [Firebase automated database backups](https://firebase.google.com/docs/database/backups) for the actual database in its Firebase console, using the dedicated private bucket and appropriate access/lifecycle settings. Creating the Terraform bucket does not enable Firebase backups. Keep the bucket dedicated to this service; Firebase's own backup retention behavior also applies. Inspect an actual scheduled backup in staging and test a download/restore before launch.

The repository tool exports the application nodes from a consistent database snapshot, writes a project/version/checksum envelope with file mode 0600 and refuses to overwrite an existing file. It omits unrelated project data and Auth accounts. Protect/encrypt exports in storage and grant least-privilege operator access.

```sh
npm run build:functions
# Local emulator; requires FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000
npm run db:backup -- --project demo-realtime-chat --output backups/room.json
npm run db:restore -- --project demo-realtime-chat --confirm-project demo-realtime-chat \
  --source backups/room.json --before backups/before-restore.json
```

For a live export, unset emulator variables, authenticate with application-default credentials and explicitly pass `--project` and `--database-url`. A live restore additionally requires `--allow-live-restore`. The project must match the backup envelope and database hostname. Always rehearse in an isolated staging database with the corresponding Auth identities; the tool intentionally refuses cross-project restores. It creates the required `--before` backup before changing data and validates integrity before writing.

Live restore procedure:

1. Announce/enable maintenance, pause scheduled cleanup if needed and drain in-flight operations. Export a fresh safety backup and preserve the deployed rules/functions/frontend versions. A checksum detects accidental corruption; it does not authenticate an untrusted backup.
2. Download the chosen backup; verify project, time and checksum. If using a raw Firebase export, first convert the application schema to the repository envelope with the migration tool below. Restore a copy in staging first.
3. Run the restore tool against the paused target. It atomically replaces the application control/history nodes, clears publication acknowledgements, removes all active connections/retirement markers and applies current TTL/count retention. It keeps valid cached identities/quotas but never revives old admission leases. A backup older than message TTL will intentionally lose expired history on restore.
4. Run/check retention and outbox recovery; compare message/index counts, quotas and sample historical messages. Check private paths are denied to an unjoined client. Resume functions/scheduler, rejoin from two clients, send/retry a message and verify monitoring/notifications.
5. On failure, stay in maintenance and restore the automatically created safety backup. Reapply the matching application schema/rules if rolling back code. Log the incident, affected backup interval and recovery time.

Suggested initial recovery objectives: daily automated exports (up to 24 hours of data loss) and a 60-minute recovery exercise. These are targets pending the first measured cloud restore drill. Auth, rules, code/configuration and Terraform state have separate recovery procedures; a chat-room export does not recover them.

## Phase 3 to Phase 4 migration

History moves from `chatRoom/messages` to `chatMessages`; compact coordination remains under `chatRoom`. Updated clients must issue bounded timestamp/accessUntil queries. Deploy frontend, callables, scheduled retention/outbox recovery and rules together during a staged maintenance window. Older clients' unbounded reads will be denied.

```sh
node scripts/migrate-phase4.mjs --source raw-root-export.json \
  --output migrated-room.json --project TARGET_PROJECT
```

This offline transform retains at most 1000 non-expired messages, builds the compact index and discards legacy profiles/admissions. Review the result and restore it only into the explicitly matching paused target. It does not authenticate legacy client-writable history; review the source's trust and provenance before importing. Everyone must rejoin after migration. Saved legacy UUID requests can confirm an original retained message; missing/expired requests fail safely instead of silently becoming a new send. New requests use a server-time-adjusted timestamp plus UUID.

Sources: [query-based authorization](https://firebase.google.com/docs/database/security/rules-conditions), [first-generation scheduling](https://firebase.google.com/docs/functions/1st-gen/schedule-functions-1st), [function instance limits](https://firebase.google.com/docs/functions/1st-gen/manage-functions-1st), [Google billing budgets](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/billing_budget).
