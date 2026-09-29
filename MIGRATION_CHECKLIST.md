# Migration checklist

## Completed locally

- [x] Created `migration/manus-independence` from a clean `main` working tree.
- [x] Recorded baseline type-check, test, and build results.
- [x] Traced runtime imports and classified active versus unused integrations.
- [x] Replaced OAuth/JWT preview authentication with local credentials and revocable database sessions.
- [x] Added CSRF protection and secure cookie defaults.
- [x] Added an explicit, non-email-merging legacy-account link command.
- [x] Replaced Forge chat, image, and transcription endpoints with a provider abstraction.
- [x] Replaced Forge storage with S3-compatible storage and short-lived signed downloads.
- [x] Replaced owner notifications with a configurable webhook.
- [x] Removed unused map, data API, heartbeat, dialog, debug collector, template, and runtime files.
- [x] Removed the Manus Vite plugin and obsolete dependencies.
- [x] Added an additive Drizzle auth migration.
- [x] Added Windows setup, environment examples, Docker assets, health checks, and deployment guidance.
- [x] Added auth and service-abstraction tests.
- [x] Upgraded vulnerable runtime/development dependencies; full and production audits report no known vulnerabilities.

## Operator actions requiring controlled credentials

- [ ] Create and back up the target MySQL database.
- [ ] Create a private S3 bucket and least-privilege application identity.
- [ ] Copy old storage objects by key and verify checksums before changing traffic.
- [ ] Obtain an AI provider key and validate the configured models.
- [ ] Decide whether to configure an owner-notification webhook.
- [ ] Link each imported user explicitly after identity verification.
- [ ] Set `OWNER_USER_ID` to the intended admin account.
- [ ] Store secrets in the deployment platform's secret manager.
- [ ] Configure TLS, the reverse proxy, and `TRUST_PROXY` correctly.
- [ ] Run staging smoke tests and create a rollback checkpoint.
- [ ] Approve and perform production cutover; no deployment was performed by this migration.
- [ ] After the retention window, approve removal of the `/manus-storage/*` compatibility alias.
- [ ] Confirm project/asset licenses before public or commercial distribution.
