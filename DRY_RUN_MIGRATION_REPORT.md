# Uptrail v2 final dry-run migration report

Dry-run completed: 2026-09-30

Protected database: `defaultdb`

Disposable migration database: `uptrail_migration_dryrun`

## Source backup

- Result: PASS
- File: `defaultdb-pre-v2-dryrun-20260930-225656.sql`
- SHA-256: `a8f0f9bca3e9a19815d5f0d56a25d966f451d79e1d152d8f8a121dbaa50fa7bc`
- Immediate checksum verification: PASS
- Source connection: verified TLS using `TLSv1.3 / TLS_AES_256_GCM_SHA384`

## Dry-run restore

- Result: PASS
- Restore target: `uptrail_migration_dryrun` only
- Restored tables: 8
- Existing foreign keys: 6
- Orphan relationships: 0
- Unexpected tables: 0
- TLS certificate verification: PASS

## Legacy row counts

| Table | Before | After |
|---|---:|---:|
| `users` | 1 | 1 |
| `learnerProfiles` | 1 | 1 |
| `learnerSkills` | 2 | 2 |
| `roadmapProgress` | 2 | 2 |
| `learnerAchievements` | 0 | 0 |
| `careerAssessmentAttempts` | 1 | 1 |
| `skillAssessmentAttempts` | 1 | 1 |
| `__drizzle_migrations` | 1 | 1 |

Legacy row fingerprints were unchanged. Both assessment tables and their rows
were preserved.

## V2 migration lineage and hashes

| Migration | Type | SHA-256 |
|---|---|---|
| `0000_imported_legacy_baseline.sql` | Verification-only baseline | `e1e25ea58359ba872ff6366450ff1667bff7241e956329c2ba1e9bccd1964c1d` |
| `0001_add_independent_auth.sql` | Additive authentication schema | `dad33ab996adaa021f6463c7b1a05b4754285448f4cfcca2211ee284cee02c37` |

The baseline contains no executable SQL. The authentication migration contains
only reviewed `CREATE TABLE` statements and no `DROP`, `DELETE`, `TRUNCATE`,
existing-user `UPDATE`, learner-data mutation, or assessment-data mutation.

## Authentication table verification

The following tables exist and passed schema verification:

- `authCredentials`
- `authSessions`
- `passwordResetTokens`

Verified properties include column types, nullability, defaults, primary keys,
user foreign keys, unique constraints, user/expiry indexes,
`ON DELETE CASCADE / ON UPDATE NO ACTION`, and `utf8mb4_unicode_ci` collation.
No disposable authentication rows remain after testing.

Final dry-run state contains 12 expected tables and 9 foreign keys: 6 legacy
and 3 authentication foreign keys.

## Migration ledgers

### Historical `__drizzle_migrations`

- Status: unchanged
- Records: 1
- Migration: `0000_flat_daimon_hellstrom.sql`
- Timestamp: `1787045175561`
- SHA-256: `814a08e40d7fc2bcfd458759d18319198ca8ae394f2fa15617a78678e9c9c93b`

No record was inserted for the missing legacy `0001` or for legacy migrations
`0002` through `0006`.

### New `__uptrail_v2_migrations`

- Status: consistent
- Records: 2
- `0000_imported_legacy_baseline` — timestamp `1790790000000`
- `0001_add_independent_auth` — timestamp `1790790060000`

Names, timestamps, hashes, order, and actual database schema agree. A repeat
runner invocation detected the already-applied lineage and performed no write.

## Application validation

- `pnpm check`: PASS
- `pnpm test`: PASS — 12 test files, 33 tests
- `pnpm build`: PASS
- Built application `/healthz` using `.env.dryrun`: PASS
- Legacy user, profile, skills, roadmap, achievements, and assessment reads: PASS

The build emitted only a non-blocking large-chunk warning.

## Authentication validation

- Disposable credential creation: PASS
- Scrypt password hashing and verification: PASS
- Invalid password rejection: PASS
- Session creation: PASS
- Session expiration behavior: PASS
- Logout/session revocation behavior: PASS
- Password-reset token and replacement-password behavior: PASS
- CSRF enforcement: PASS in the application test suite
- Rate limiting: PASS in the application test suite
- Protected-route authorization: PASS in the application test suite
- Disposable-record cleanup: PASS

The real legacy identity was not linked or modified.

## Rollback rehearsal

- Result: PASS
- Recovery target: `uptrail_migration_recovery`
- Verified pre-migration backup:
  `uptrail_migration_dryrun-pre-v2-20260930-232101.sql`
- SHA-256:
  `72142beba62787d6abf99b678af03e32f0e6fed6216ee51b76aaefbf185f7291`
- Empty recovery pre-restore backup:
  `uptrail_migration_recovery-empty-pre-restore-20261001-015106.sql`
- Empty recovery backup SHA-256:
  `20ac59e1a21b8d6b4697d4e719968d33a854d95f545a50cd9128405d3e6eaa73`
- Recovered tables: exactly 8
- Recovered counts: `1 / 1 / 2 / 2 / 0 / 1 / 1 / 1`
- Recovered foreign keys: 6
- Recovered orphan relationships: 0
- Recovered ledger: authentic `__drizzle_migrations` 0000 record only
- Auth tables and `__uptrail_v2_migrations`: absent
- TLS: `TLSv1.3 / TLS_AES_256_GCM_SHA384`, certificate verification PASS

The rehearsal did not use `defaultdb` or `uptrail_migration_dryrun` as a
restore target.

## Security and protected-database status

- `.env` and `.env.dryrun`: ignored by Git
- Backups and generated migration artifacts: ignored by Git
- Tracked database dumps: none
- Credential exposure in source, staged diff, generated logs, or Git history: none
- `defaultdb` write operations during the dry run: zero

`defaultdb` received only read-only verification and backup operations. Its
final verified state remained 8 tables, the original row counts, 6 foreign
keys, zero orphans, and the authentic single-record legacy ledger.

## GO / NO-GO

**GO to request separate explicit authorization to migrate `defaultdb`.**

The dry-run migration, application/authentication validation, and independent
restore-based rollback rehearsal passed. This report is evidence for an
authorization request; it does not itself authorize or execute migration of
`defaultdb`.

## Required next action

Review this report and, only if accepted, provide a separate explicit
authorization naming `defaultdb` and the two approved v2 migration hashes.
