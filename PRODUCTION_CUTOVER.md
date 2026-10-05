# Production cutover runbook

> **Status Update**: Production cutover was successfully completed and verified for release [`v2.0.1-independent`](https://github.com/Pulkit0719/uptrail-v2/releases/tag/v2.0.1-independent) (Commit: `81fb092c0b849a58d7605515cec0975185b9282f`) deployed on Render at [https://uptrail-v2.onrender.com](https://uptrail-v2.onrender.com). The procedures below serve as the ongoing operational standard for subsequent cutover and disaster recovery events.

## Staging gate

1. Create isolated staging MySQL, email, AI, webhook, DNS, and TLS resources. Never reuse production credentials.
2. Build the exact Git commit into an immutable image and record its digest and SBOM/dependency audit result.
3. Run `pnpm config:check`, `pnpm db:verify`, a verified backup/restore drill, `pnpm db:migrate`, and `pnpm db:integrity`.
4. Create a staging user, locate its ID with `pnpm auth:find-user-id`, set `OWNER_USER_ID`, restart, and prove that a different user cannot access admin operations.
5. Complete every manual test in `FINAL_HANDOVER.md`, including recovery email, session revocation, AI unavailable states, and mobile routes.
6. Confirm browser and API traffic makes no request to removed storage endpoints.
7. Exercise SIGTERM and confirm requests drain within the 20-second container grace period.
8. Record performance results, logs/metrics/alerts, rollback image digest, database backup checksum, and approver.

## Go/no-go requirements

- CI green on the exact commit; no high-severity known dependency vulnerability.
- Production backup restored and integrity-checked in isolation.
- Migration SQL reviewed as additive; no unexpected row-count changes.
- TLS and proxy behavior verified, including secure cookies and `TRUST_PROXY`.
- Shared rate limiter installed if more than one public application process is used.
- Password recovery email tested without exposing tokens in logs.
- Owner/admin account and emergency access are independently verified.
- Monitoring covers health, 5xx, login failures, email failures, AI latency/cost, and DB saturation.

## Cutover

1. Freeze schema/content changes and take the final verified database backup.
2. Apply reviewed migrations once using a migration identity; run integrity checks.
3. Start one new replica with no public traffic. Verify `/healthz`, login, database, email, and provider logs.
4. Shift a small traffic percentage. Watch errors, latency, authentication, and provider metrics for the agreed soak time.
5. Increase gradually. Keep the previous image/config, database backup, and DNS/load-balancer state available.
6. Record completion time and evidence.

## Rollback triggers and actions

Rollback immediately for data-integrity failure, widespread login/session failure, unauthorized access, unbounded provider cost, migration mismatch, or sustained health/5xx breach. Stop traffic shifting, restore the prior image/config, and keep additive tables in place. Restore data only when integrity evidence requires it. Preserve logs, rotate exposed secrets, and require a new staging pass before retrying.
