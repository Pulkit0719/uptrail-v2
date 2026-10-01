# Security review

Review date: 2026-09-29. Scope: application source, configuration, migrations, container assets, dependency manifests, tests, and the two-commit Git history available locally. No live production systems or credentials were accessed.

## Implemented controls

- Passwords use Node scrypt with per-password random salts and timing-safe comparison. Credential records are separate from imported identity fields, so email equality never silently merges accounts.
- Sessions use 256-bit opaque random tokens. Only SHA-256 token hashes are stored. Sessions expire after seven days and can be revoked server-side.
- Cookies are `HttpOnly`, `SameSite=Lax`, path-scoped, and `Secure` when Express sees HTTPS. `TRUST_PROXY` trusts exactly one hop only when explicitly enabled.
- State-changing tRPC procedures require a matching CSRF header/cookie. Authenticated requests additionally bind the CSRF hash to the server-side session.
- Password reset tokens are random, stored only as hashes, expire after a configurable maximum of 120 minutes, are single-use, invalidate earlier reset requests, and revoke all sessions on success. Public responses do not reveal whether an email exists.
- Login, registration, and recovery paths have bounded in-process rate limits. Inputs have explicit size/type limits.
- Admin procedures require both an authenticated admin role and valid CSRF. `OWNER_USER_ID` grants the role only to one exact numeric user ID.
- Provider, database, email, and webhook credentials stay server-side. The configuration checker never prints values.
- Binary uploads and generated media are not enabled, eliminating object-store credential, upload-validation, and signed-download attack surfaces from the current release.
- AI requests have server-side model selection, timeout, retry, input history, and output-token bounds. Provider response shape is validated.
- Express removes its signature, limits request bodies, sets CSP, frame, MIME-sniffing, referrer and permissions policies, and enables HSTS on secure production requests.
- Database and provider error logging avoids credentials, reset tokens, email addresses, upstream bodies, and object names.
- CI runs frozen dependency install, configuration validation, TypeScript, tests, production build, audit, and migration-drift detection with read-only repository permissions.

## Secret and history audit

The current tree and all locally available commits were searched for common private-key, cloud-key, GitHub-token, OpenAI-key, Slack-token, and credential-bearing database URL patterns. Matches were limited to explicit `change-me`/`placeholder` examples in `.env.example` and Compose. Only `.env.example` is tracked; no dump/archive files were found. This is a targeted scan, not a substitute for a dedicated secret scanner over every remote ref and artifact registry.

Rotate any credential ever supplied to the original runtime, even if it is absent from this repository. Store production values in a secret manager and scope database identities to their minimum required permissions.

## Residual risks

| Severity                             | Risk                                                                                                                      | Required mitigation                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| High for multi-replica public launch | Rate limits are process-local and reset on restart.                                                                       | Put a shared gateway/Redis-backed limiter in front of all replicas.     |
| Medium                               | Registration has no mandatory email-verification gate and MFA is not implemented.                                         | Add verification/MFA if the threat model or regulated data requires it. |
| Medium                               | The generic email endpoint contract must be adapted to the chosen provider and has not been tested with live credentials. | Test in staging; restrict destination endpoint and rotate its token.    |
| Medium                               | External opportunity data comes from Remotive and availability/terms are outside Uptrail's control.                       | Monitor failures, preserve attribution, and review provider terms.      |
| Low                                  | No automated session cleanup job removes expired rows.                                                                    | Schedule a bounded database cleanup after launch.                       |
| Operational                          | Live DB restore, TLS, Docker build, and production rollout were not available for verification.                           | Complete `PRODUCTION_CUTOVER.md` in staging first.                      |

## Incident response minimum

1. Stop or reduce traffic and preserve logs without adding secrets to tickets.
2. Rotate affected provider/database/email credentials and revoke active sessions.
3. Record the release digest, configuration version, last verified backup, and first observed failure.
4. Restore only into an isolated database first; run `pnpm db:integrity` before any traffic.
5. Document root cause and add a regression test before retrying cutover.
