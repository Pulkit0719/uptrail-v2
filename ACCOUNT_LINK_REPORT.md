# Legacy Account Link Report

## Scope

- Target database: `defaultdb`
- Existing legacy user ID: `1`
- `OWNER_USER_ID` at account-link completion: **NOT CONFIGURED**
- Subsequent separately authorized owner configuration: user ID `1`, **PASS**
- Rollback: **NOT REQUIRED**

## Previous failure

The previous report-only phase explicitly prohibited database writes. No
write-capable link command was invoked, so no credential transaction ran. The
first retry then stopped before backup or database writes because the private
password failed the required length validation. After that private value was
corrected, the guarded retry resumed from configuration validation.

## Configuration and identity preflight

- Private account-link file loaded: **PASS**
- Required private values present and structurally valid: **PASS**
- Private file ignored and untracked: **PASS**
- Live database target and TLS: **PASS**
- Exact legacy identity resolved once to user ID `1`: **PASS**
- Users before linking: `1`
- Credentials before linking: `0`
- Credential/email conflicts: none
- Expected learner-data relationships: **PASS**
- Migration-ledger preflight: **PASS**

## Dedicated pre-link backup

- Filename: `defaultdb-pre-account-link-20261001-033624.sql`
- Created at: `2026-09-30T22:06:45.247Z`
- SHA-256: `dd65c9e02151f42c665fb699ca6a0127af662e542fd48ea7c3748761c12d90a9`
- Independent checksum verification: **PASS**
- Storage: ignored and untracked `backups/` directory

## Transaction and preservation

- Guarded transactional credential creation: **PASS**
- Users after linking: `1`
- Credentials after linking: `1`
- Credential belongs to user ID `1`: **PASS**
- Scrypt verification and random-salt shape: **PASS**
- Plaintext password absent from stored credential material: **PASS**
- Numeric user ID preserved: **PASS**
- Legacy openId preserved: **PASS**
- Duplicate user or credential: none

| Application data           | Before | After | Fingerprint |
| -------------------------- | -----: | ----: | ----------- |
| `learnerProfiles`          |      1 |     1 | unchanged   |
| `learnerSkills`            |      2 |     2 | unchanged   |
| `roadmapProgress`          |      2 |     2 | unchanged   |
| `learnerAchievements`      |      0 |     0 | unchanged   |
| `careerAssessmentAttempts` |      1 |     1 | unchanged   |
| `skillAssessmentAttempts`  |      1 |     1 | unchanged   |

- `__drizzle_migrations`: unchanged
- `__uptrail_v2_migrations`: unchanged

## Authentication and session verification

- Correct-password login returned user ID `1`: **PASS**
- Wrong-password rejection: **PASS**
- Database-backed session creation: **PASS**
- Authenticated-session recognition: **PASS**
- Protected profile identity resolved to user ID `1`: **PASS**
- Profile, skills, roadmap, and achievements readable: **PASS**
- Career and skill assessment records remain bound to user ID `1`: **PASS**
- Anonymous and protected CSRF rejection: **PASS**
- Login rate limiting: **PASS**
- Session cookie `HttpOnly` and `SameSite=Lax`: **PASS**
- Session expiration configured: **PASS**
- Logout and cookie clearing: **PASS**
- Server-side revocation: **PASS**
- Revoked-session rejection: **PASS**
- Active disposable verification sessions after cleanup: `0`

## Quality checks

- `pnpm check`: **PASS**
- `pnpm test` at account-link completion: **PASS** — 12 files, 33 tests
- Latest storage-free regression suite: **PASS** — 13 files, 35 tests
- `pnpm build`: **PASS**
- Safe owner-candidate lookup: user ID `1`

## Secret handling

- No secret values are included in this report.
- Exact-value scan of tracked files, Git diff, Git history, reports, logs, and
  generated artifacts: **PASS**
- Credential fields were not returned to the frontend.
- Dedicated backup and private environment files remain ignored and untracked.
- `LOCAL_AUTH_PASSWORD` was removed from the private account-link file after
  successful verification.
- The disposable verification session was revoked.

## Decision

**PASS — legacy account successfully linked and verified**
