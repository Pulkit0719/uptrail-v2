# Independent deployment guide

## Reference topology

Run the immutable Uptrail container behind an HTTPS reverse proxy/load balancer and attach it to independently managed MySQL 8. Inject `DATABASE_URL`, `AI_*`, `EMAIL_*`, and optional webhook values from a secret manager. No object-storage service or durable upload volume is required. Send application logs to stdout/stderr and monitor `GET /healthz`.

For multiple app replicas, replace the process-local authentication limiter with a shared gateway/Redis-backed limiter. Sessions are already shared through MySQL.

## Build and release

```bash
docker build --pull -t registry.example.com/uptrail:<git-sha> .
docker push registry.example.com/uptrail:<git-sha>
```

Pin deployments to an immutable digest or Git SHA, not `latest`. Run the same image in staging with staging-only credentials. The container listens on port 3000, runs as non-root, validates production configuration at startup, and drains connections on SIGTERM.

Before release:

```powershell
pnpm install --frozen-lockfile
pnpm config:check
pnpm check
pnpm test
pnpm build
pnpm audit --audit-level high
```

## Database backup and migration

On Windows, install MySQL client tools, then run:

```powershell
pnpm db:verify
pnpm db:backup
pnpm db:migrate
pnpm db:integrity
```

Review every generated SQL file before applying it. Never generate schema changes against production. Migrations `0005` and `0006` are additive and preserve existing user/profile/progress relationships. Test every backup by restoring into a separate database using the guarded process in BACKUP_AND_RECOVERY.md.

For an existing Manus database, do not initialize an empty replacement with the full Drizzle history first. Restore the authorized legacy schema and data into an empty isolated target, inspect its `__drizzle_migrations` ledger, and reconcile that ledger with the reviewed repository migrations. Only then apply the additive independence migrations `0005` and `0006`. The repository journal references `0001_organic_silver_surfer`, but that SQL file was not present in the original repository; never fabricate or mark that migration as applied without comparing the restored schema.

## Existing identity cutover

1. Export the existing `users` table and retain the old external subject (`openId`) mapping.
2. Establish an identity-proofing process outside this codebase. Do not use email equality or a password-reset email alone to prove ownership of a legacy external identity.
3. For each verified person, run `pnpm auth:link-legacy` with the exact old subject and a new local email/password.
4. Test the existing profile, skills, roadmap, and achievements using the linked account.
5. Use `pnpm auth:find-user-id` to locate the intended owner, verify it independently, then set `OWNER_USER_ID`.

All old remote sessions become invalid at cutover because the independent server accepts only opaque sessions stored in `authSessions`.

## Storage-free deployment

The current schema contains no file URL/object-key columns, and the verified
database contains no `/manus-storage/`, `/storage/`, S3, R2, MinIO, or file-like
references. The current UI has no upload control or storage request. Do not
provision a bucket or persistent upload volume for this release. Any future
binary-file feature requires a separate design, threat model, persistence
decision, and explicit approval.

## Secrets and network controls

- Never bake `.env` into an image or commit it.
- Rotate every credential ever exposed to the original runtime.
- Permit MySQL access only from application/release networks.
- Use HTTPS for public/provider traffic.
- When one trusted proxy terminates TLS, forward `X-Forwarded-Proto` and set `TRUST_PROXY=true`; otherwise leave it false.
- Separate application DML and migration DDL database identities where the platform supports it.

## Scheduling, opportunities, maps, and notifications

No active feature used the old scheduler, generic data/search API, or maps proxy, so they were removed. Add future scheduled work through an independently controlled scheduler calling a narrowly scoped authenticated endpoint. Live opportunities use attributed Remotive data. Owner notifications are optional and use `NOTIFICATION_WEBHOOK_URL`.

## Cutover and rollback

Use PRODUCTION_CUTOVER.md for staging evidence, go/no-go gates, canary rollout, monitoring, and approval. Keep the previous image digest/configuration, final database backup, and DNS/load-balancer state.

For application failure, stop traffic shifting and restore the previous immutable image/config. Do not drop additive authentication tables during an incident. Restore the database only for demonstrated data-integrity failure, not ordinary application behavior.
