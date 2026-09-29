# Independent deployment guide

## Reference topology

Run the immutable Uptrail container behind an HTTPS reverse proxy/load balancer. Attach it to independently managed MySQL 8 and a private S3-compatible bucket. Inject `DATABASE_URL`, `AI_*`, `S3_*`, and optional webhook values from a secret manager. Send application logs to stdout/stderr and monitor `GET /healthz`.

For multiple app replicas, move login throttling to a shared rate limiter. Sessions themselves are already shared through MySQL.

## Build and release

```bash
docker build --pull -t registry.example.com/uptrail:<git-sha> .
docker push registry.example.com/uptrail:<git-sha>
```

Pin deployments to an immutable digest or Git SHA, not `latest`. Run the same image in staging with staging-only credentials. The container listens on port 3000 and runs as the non-root `node` user.

## Database backup and migration

Before any production migration:

```bash
mysqldump --single-transaction --routines --triggers --set-gtid-purged=OFF "$DATABASE_NAME" > uptrail-before-auth.sql
```

Test restoration into a separate database. Review `drizzle/0005_clear_sunspot.sql`; it is additive. Apply migrations once as a release job, before increasing new application replicas:

```bash
pnpm db:migrate
```

Never run schema generation against production. Generation changes repository files; migration applies reviewed files.

## Existing identity cutover

1. Export the existing `users` table and retain the old external subject (`openId`) mapping.
2. Establish an identity-proofing process outside this codebase.
3. For each verified person, run `pnpm auth:link-legacy` with the exact old subject and a new local email/password.
4. Do not bulk-match by email. A provider's verified-email semantics may differ and could cause account takeover.
5. Test access to the existing profile, skills, roadmap, and achievements using the linked account.
6. Set `OWNER_USER_ID` only after confirming the intended numeric user ID.

All old remote sessions become invalid at cutover because the independent server accepts only opaque sessions created in `authSessions`.

## Object-storage cutover

1. Inventory old object keys and all persisted `/manus-storage/` URLs. Do not delete or rename the source.
2. Create a private destination bucket with versioning, server-side encryption, lifecycle policy, access logging, and a least-privilege identity limited to that bucket.
3. Copy each object under the same key using provider export tools, `rclone`, or `aws s3 cp` with an S3-compatible endpoint.
4. Compare object counts, sizes, content types, and checksums. Randomly download and open representative files.
5. Configure `S3_*` and deploy. Both `/storage/<key>` and the temporary legacy path will resolve from the new bucket for authenticated users.
6. Monitor 404/403 rates. Keep the source read-only through the agreed retention window.
7. Remove the compatibility route only in a separately approved release after all persisted URLs are rewritten and verified.

## Secrets and network controls

- Never bake `.env` into an image or commit it.
- Rotate any credential that was ever exposed to the original runtime.
- Permit MySQL and S3 access only from application/release networks.
- Use TLS for all public and provider traffic. When a trusted proxy terminates TLS, forward `X-Forwarded-Proto` and set `TRUST_PROXY=true`; otherwise leave it false.
- Grant the app database identity DML rights and only the migration job schema-change rights when your platform supports separate users.

## Scheduling, search, maps, and notifications

No active feature used the old scheduler, generic data/search API, or maps proxy, so they were removed. Add future scheduled work through your cloud scheduler or GitHub Actions calling a narrowly scoped authenticated endpoint. Live opportunities already use Remotive. Owner notifications are optional and post to `NOTIFICATION_WEBHOOK_URL`; restrict that URL and rotate it like a secret.

## Cutover runbook

1. Freeze schema/content changes and take verified database and object-storage backups.
2. Deploy the release to staging, apply migrations, link test users, and run login/logout, profile, roadmap, mentor, opportunity, notification, and storage smoke tests.
3. Record the previous image digest, configuration version, database backup, and DNS/load-balancer state.
4. Apply the reviewed migration production job.
5. Deploy one canary replica with new secrets and no public traffic; verify `/healthz` and logs.
6. Shift a small percentage of traffic, watch error/login/storage metrics, then increase gradually.
7. Keep old infrastructure read-only during the retention window. Do not delete old assets during cutover.

## Rollback

Stop traffic shifting and redeploy the previous immutable image/config. Because migration `0005` is additive, the old application can ignore the new tables; do not drop them during an incident. Restore the database only if data integrity—not application behavior—requires it. Point object reads back to the old service only if credentials and the previous code are still controlled and verified. Document the failure before retrying cutover.
