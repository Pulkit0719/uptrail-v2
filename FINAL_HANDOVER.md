# Final handover

## Repository state

- Migration branch: `migration/manus-independence`.
- Preserved initial independence checkpoint: `d21c6e5`.
- Baseline: clean `main` at `944da93`; baseline TypeScript/tests/build passed before migration.
- Production deployment, DNS changes, live data migration, identity proofing, and source deletion were not performed.

Use `git status --short`, `git diff --check`, and `git log --oneline -10` before continuing. Never discard unrelated work. The expected final verification results belong in the release/PR record for the exact commit, not copied from a different build.

Latest local verification: frozen install passed; TypeScript passed; 10 test files/26 tests passed; production build passed; full audit reported no known vulnerabilities; Drizzle reported no schema drift; built-server `/` and CSRF smoke checks passed. Docker was unavailable. The workstation's Node 20.11.1 is below the declared 20.19 minimum, so CI/staging must repeat the gates on a supported runtime.

## Manual validation checklist

### Authentication and authorization

- [ ] Register a new account; confirm a new numeric user ID and no merge with an imported matching email.
- [ ] Sign out; confirm the old session cannot call a protected procedure.
- [ ] Sign in with correct credentials and reject an incorrect password with the same generic message.
- [ ] Confirm secure/HTTP-only/SameSite cookie attributes behind the staging TLS proxy.
- [ ] Tamper with/remove the CSRF header and confirm mutations are rejected.
- [ ] Request recovery for known and unknown emails; confirm identical UI/API response and no token/email in logs.
- [ ] Use a reset link once, reject reuse/expiry, and confirm every prior session is revoked.
- [ ] Verify rate-limit responses; verify the shared limiter when running multiple replicas.
- [ ] Find and independently verify the intended owner ID, configure it, and confirm only that account can call admin operations.
- [ ] Explicitly link one imported test user and verify their existing profile/progress remains attached.

### Product flows

- [ ] Complete onboarding and edit profile, skills, achievements, and roadmap progress; reload and verify persistence.
- [ ] Navigate every desktop and mobile route; verify direct-link refresh and not-found behavior.
- [ ] Exercise the AI mentor with normal, oversized, failed, throttled, and timed-out provider responses; confirm bounded output and safe errors.
- [ ] Load opportunities and verify source attribution/unavailable-provider behavior.
- [ ] Upload every allowed media type and reject disallowed type, traversal key, oversize body, unauthenticated download, and missing object.
- [ ] Generate/read representative media and verify private signed URLs expire.
- [ ] Send an owner notification as admin and reject it as a normal user.

### Operations

- [ ] Run frozen install, configuration check, type check, tests, build, audit, and migration drift check on the release commit.
- [ ] Build/run the container as non-root; confirm health status and SIGTERM drain.
- [ ] Restore the final database backup in isolation and run integrity validation.
- [ ] Require zero failures in the executed storage migration manifest.
- [ ] Verify monitoring, alert delivery, log redaction, TLS/HSTS/CSP, database pool limits, and secret-manager injection.
- [ ] Record landing-page and route-chunk sizes plus critical user-flow latency on representative mobile hardware.
- [ ] Exercise application, database, storage, and DNS/load-balancer rollback checkpoints.

## Known limitations

- No live infrastructure was available in this workstation, and Docker was not installed during the initial migration verification.
- Public multi-replica service needs a shared rate limiter.
- Mandatory email verification, MFA, malware scanning, and automatic expired-session cleanup are not implemented.
- Source storage and imported identity ownership require operator-controlled credentials and human identity verification.
- The legacy storage compatibility route remains intentionally until post-cutover cleanup approval.
- Google Fonts and the attributed Remotive feed remain explicit external dependencies.
- The remaining Vite size warning is an on-demand Mermaid chunk (about 509.9 kB); the eager JavaScript bundle is about 421.1 kB after route splitting.
- License ownership and third-party asset notices require owner/legal confirmation before public distribution.

## Operator next actions

1. Review `SECURITY_REVIEW.md` and accept or remediate every residual risk.
2. Provision isolated staging and secret-manager entries; run `pnpm config:check`.
3. Prove database restore and integrity, then migrate staging.
4. Inventory/copy/verify storage and explicitly link test identities.
5. Complete the manual checklist and `PRODUCTION_CUTOVER.md` evidence record.
6. Obtain explicit production approval; deploy canary-first with rollback checkpoints intact.
