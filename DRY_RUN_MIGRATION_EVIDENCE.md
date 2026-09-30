# Uptrail v2 dry-run migration evidence

Date: 2026-09-30

Protected database: `defaultdb` (read-only backup and verification only)

Migration target: `uptrail_migration_dryrun`

## Backups

- Source backup: `defaultdb-pre-v2-dryrun-20260930-225656.sql`
- Source backup SHA-256: `a8f0f9bca3e9a19815d5f0d56a25d966f451d79e1d152d8f8a121dbaa50fa7bc`
- Dry-run pre-migration backup: `uptrail_migration_dryrun-pre-v2-20260930-232101.sql`
- Dry-run pre-migration SHA-256: `72142beba62787d6abf99b678af03e32f0e6fed6216ee51b76aaefbf185f7291`

Both checksums were recomputed and verified. Backup files, checksum sidecars,
and manifests are stored under ignored `backups/` and are not committed.

## V2 lineage

- `0000_imported_legacy_baseline.sql`
  - SHA-256: `e1e25ea58359ba872ff6366450ff1667bff7241e956329c2ba1e9bccd1964c1d`
  - Verification-only marker; no executable SQL.
- `0001_add_independent_auth.sql`
  - SHA-256: `dad33ab996adaa021f6463c7b1a05b4754285448f4cfcca2211ee284cee02c37`
  - Creates only `authCredentials`, `authSessions`, and `passwordResetTokens`.

The separate `__uptrail_v2_migrations` ledger contains exactly those two real
records. The historical `__drizzle_migrations` ledger remains its original
single verified `0000_flat_daimon_hellstrom` record.

## Verified database results

Before and after legacy counts:

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

- Legacy row fingerprints: unchanged.
- Final table count: 12.
- Legacy foreign keys: 6; new auth foreign keys: 3.
- Orphan relationships: 0.
- TLS: `TLSv1.3 / TLS_AES_256_GCM_SHA384` with certificate verification.
- Auth tables use `utf8mb4_unicode_ci` and contain no retained test rows.

## Application and authentication evidence

- `pnpm check`: PASS.
- `pnpm test`: PASS (12 files, 33 tests).
- `pnpm build`: PASS.
- Built application `/healthz` against `.env.dryrun`: PASS.
- Legacy user/profile/skills/roadmap/achievement/assessment reads: PASS.
- Disposable credential creation and scrypt verification: PASS.
- Invalid password rejection: PASS.
- Session creation, expiration, and revocation: PASS.
- Password reset token and replacement-password behavior: PASS.
- CSRF, rate limiting, protected routes, and logout boundaries: PASS in the
  application test suite.
- Disposable database records were deleted and cleanup counts verified.

## Rollback status

A restore-based rollback into `uptrail_migration_recovery` was completed on
2026-10-01 and passed.

- Restore source: `uptrail_migration_dryrun-pre-v2-20260930-232101.sql`
- Restore source SHA-256: `72142beba62787d6abf99b678af03e32f0e6fed6216ee51b76aaefbf185f7291`
- Empty recovery pre-restore backup:
  `uptrail_migration_recovery-empty-pre-restore-20261001-015106.sql`
- Empty recovery backup SHA-256:
  `20ac59e1a21b8d6b4697d4e719968d33a854d95f545a50cd9128405d3e6eaa73`
- Recovered tables: exactly 8; no auth tables or v2 ledger.
- Recovered counts: `1 / 1 / 2 / 2 / 0 / 1 / 1 / 1` in the documented order.
- Foreign keys: 6; orphan relationships: 0.
- Historical ledger: authentic `0000` only.
- TLS: `TLSv1.3 / TLS_AES_256_GCM_SHA384` with certificate verification.

`defaultdb` and `uptrail_migration_dryrun` were not restore targets and received
no write operation during the rehearsal.

## Final decision

The dry-run migration and independent restore-based rollback evidence pass.
The technical evidence supports requesting a separate, explicit authorization
to migrate `defaultdb`; this evidence does not itself authorize that migration.
