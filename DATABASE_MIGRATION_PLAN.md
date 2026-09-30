# Uptrail database migration planning report

> Implementation update (2026-09-30): the newer dry-run authorization
> supersedes this document where they differ. The implemented lineage is in
> `drizzle-v2/`; its imported baseline is verification-only and does not issue
> `CREATE TABLE` for legacy tables. Verified execution evidence is recorded in
> `DRY_RUN_MIGRATION_EVIDENCE.md`.

This document is a plan only. It does not authorize or execute schema changes. The verified Aiven `defaultdb`, the legacy `__drizzle_migrations` ledger, and migrations `0005` and `0006` remain unchanged.

## Evidence and classification

### Verified facts

- `backups/` is ignored by `.gitignore`. No backup, export, dump, checksum, or SQL file outside `drizzle/` is tracked or appears in reachable Git history.
- Both files currently under `backups/` are 1,382-byte empty-destination dumps with zero `CREATE TABLE` and zero `INSERT` statements. They contain no application rows.
- The sensitive Manus original and sanitized restore copy are outside the repository and both still match their SHA-256 sidecars.
- Aiven is MySQL 8.4.8, requires primary keys, uses `utf8mb4_0900_ai_ci` as the database default, and currently contains eight restored tables using InnoDB and `utf8mb4_unicode_ci`.
- The five tables shared by the restored database and `drizzle/meta/0006_snapshot.json` match in columns, types, nullability, defaults, primary keys, indexes, unique constraints, foreign keys, enum definitions, timestamp behavior, and auto-increment behavior.
- The restored database additionally contains `careerAssessmentAttempts`, `skillAssessmentAttempts`, and the legacy `__drizzle_migrations` ledger.
- The current Drizzle schema additionally expects `authCredentials`, `authSessions`, and `passwordResetTokens`; those three tables do not yet exist.
- The legacy ledger has one row. Its ID, timestamp `1787045175561`, and SHA-256 hash match `0000_flat_daimon_hellstrom.sql` exactly.
- `0001_organic_silver_surfer.sql` and `0001_snapshot.json` do not exist in the working tree, any reachable Git tree, or any unreachable Git object found by `git fsck`.
- The one legacy user has one non-empty, distinct external subject in `users.openId` and is not yet marked for password login. No identifier or personal field was printed.

### Evidence-based conclusions

- `0000` created only `users`.
- The restored common schema is structurally equivalent to the end state represented by existing `0002`, `0003`, and `0004`, but their SQL was not recorded in the legacy ledger. That is schema equivalence, not proof that those migrations ran.
- The two assessment tables are verified legacy schema not represented by any surviving Drizzle snapshot.
- `pnpm db:migrate` is unsafe today: Drizzle reads every journal entry before connecting and fails when it cannot read the missing `0001` file. Removing that entry alone would then cause it to try `0002` against already-existing tables.

### Unresolved history

- What SQL `0001` contained.
- Whether the common learner tables and assessment tables were created by a schema-push operation, an external deploy tool, manual SQL, or an absent migration lineage.
- Why only `0000` was recorded in the source migration ledger.

None of these unknowns should be filled with a fabricated file, hash, timestamp, or ledger record.

## Existing migration analysis

### `0000_flat_daimon_hellstrom.sql`

- One `CREATE TABLE users` statement.
- Creates the legacy user identity table, primary key, unique `openId`, role enum, timestamps, and auto-increment ID.
- Verified SHA-256: `814a08e40d7fc2bcfd458759d18319198ca8ae394f2fa15617a78678e9c9c93b`.

### `0005_clear_sunspot.sql`

Verified SHA-256: `657bbb82f9bc9fa751715d7eb43bffad4197dabf8f1ec2c0dafd02d0b68dd35b`; journal timestamp: `1790696516872`.

| # | Classification | Effect |
|---|---|---|
| 1 | CREATE | Creates `authCredentials` with a primary key and unique `userId` and `emailNormalized`. |
| 2 | CREATE | Creates `authSessions` with primary key and unique token hash. |
| 3 | CONSTRAINT | Adds `authCredentials.userId -> users.id` with cascade delete. |
| 4 | CONSTRAINT | Adds `authSessions.userId -> users.id` with cascade delete. |
| 5 | INDEX | Adds `authSessions_user_idx`. |
| 6 | INDEX | Adds `authSessions_expiry_idx`. |

It contains no `INSERT`, `UPDATE`, `DELETE`, `DROP`, or migration-ledger SQL. It does not reference profiles, roadmaps, skills, achievements, or assessment tables. It assumes only that `users(id)` exists. It is additive but not idempotent because none of its DDL uses `IF NOT EXISTS`. Direct execution against the current restored schema is structurally compatible, but a failure after an early DDL statement could leave a partial result because MySQL DDL commits implicitly.

### `0006_foamy_nitro.sql`

Verified SHA-256: `7d69dfab9c358160db64ec358f8fec37ad75b2417c8ed11108a1167626d5009c`; journal timestamp: `1790702932414`.

| # | Classification | Effect |
|---|---|---|
| 1 | CREATE | Creates `passwordResetTokens` with primary key and unique token hash. |
| 2 | CONSTRAINT | Adds `passwordResetTokens.userId -> users.id` with cascade delete. |
| 3 | INDEX | Adds `passwordResetTokens_user_idx`. |
| 4 | INDEX | Adds `passwordResetTokens_expiry_idx`. |

It contains no `INSERT`, `UPDATE`, `DELETE`, `DROP`, or migration-ledger SQL. It assumes only that `users(id)` exists. It is additive but not idempotent and has the same partial-DDL risk as `0005`.

## Exact schema differences

The machine-readable evidence is in ignored files:

- `migration-artifacts/restored-schema-snapshot-complete.json`
- `migration-artifacts/schema-diff.json`

Actual-only objects:

- `__drizzle_migrations` — verified historical ledger; leave frozen.
- `careerAssessmentAttempts` — one row and a user foreign key.
- `skillAssessmentAttempts` — one row and a user foreign key.

Expected-only objects:

- `authCredentials`
- `authSessions`
- `passwordResetTokens`

The existing restored tables use `utf8mb4_unicode_ci`. The current migration SQL does not set a table collation, so direct execution would give new tables the Aiven database default `utf8mb4_0900_ai_ci`. There are no textual foreign keys between the old and new tables, so this is not immediately incompatible, but the new migration lineage should set an explicit collation to avoid unmanaged drift.

## Strategy evaluation

### Strategy A — execute `0005`/`0006` and insert their old ledger records

Rejected. The SQL itself is additive, but the original journal remains unreadable because `0001` is missing. Inserting `0005`/`0006` records would not explain or safely baseline `0002`–`0004`, and future `pnpm db:migrate` would still fail while reading the missing file.

### Strategy B — create one new additive difference migration in the old lineage

Rejected as the primary solution. The old lineage cannot be made trustworthy without either removing history or backfilling records for migrations not proven to have run.

### Strategy C — new verified v2 lineage and separate ledger

Recommended.

1. Preserve the old migrations and `__drizzle_migrations` as read-only historical evidence.
2. Add both legacy assessment tables to `drizzle/schema.ts`, so the managed schema describes every data-bearing application table and future tooling cannot casually treat them as disposable drift.
3. Create a new migration directory and a new real ledger named `__uptrail_v2_migrations`.
4. Add a new baseline migration containing `CREATE TABLE IF NOT EXISTS` definitions for the seven verified legacy application tables. A strict preflight must compare every existing table before the baseline runs; `IF NOT EXISTS` is not accepted as proof of compatibility.
5. Add new v2 auth migrations that express the intended final schema of `0005` and `0006` using complete table definitions with constraints and indexes inline. These are new migrations with new names, timestamps, and hashes—not claims that the old migrations ran.
6. Replace the package migration command with a guarded custom Drizzle runner using `migrationsFolder` for the new lineage and `migrationsTable: "__uptrail_v2_migrations"`.
7. Prohibit `drizzle-kit push` against imported databases. Future changes must be reviewed migration files.

This strategy leaves the legacy ledger untouched, does not invent `0001`, preserves both assessment tables, gives fresh installations a complete schema, and makes future migrations use one internally consistent lineage.

## Planned v2 SQL shape

The future baseline will use the verified definitions for these tables:

```sql
CREATE TABLE IF NOT EXISTS `users` (...verified columns..., PRIMARY KEY (`id`), UNIQUE KEY `users_openId_unique` (`openId`)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `learnerProfiles` (...verified columns..., PRIMARY KEY (`id`), UNIQUE KEY `learnerProfiles_userId_unique` (`userId`), CONSTRAINT `learnerProfiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `learnerSkills` (...verified columns..., PRIMARY KEY (`id`), UNIQUE KEY `learnerSkills_user_skill_idx` (`userId`,`name`), CONSTRAINT `learnerSkills_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `roadmapProgress` (...verified columns..., PRIMARY KEY (`id`), UNIQUE KEY `roadmapProgress_user_milestone_idx` (`userId`,`milestoneId`), CONSTRAINT `roadmapProgress_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `learnerAchievements` (...verified columns..., PRIMARY KEY (`id`), KEY `learnerAchievements_user_created_idx` (`userId`,`createdAt`), CONSTRAINT `learnerAchievements_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `careerAssessmentAttempts` (`id` int NOT NULL AUTO_INCREMENT, `userId` int NOT NULL, `answersJson` text NOT NULL, `recommendationsJson` text NOT NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`), KEY `careerAssessmentAttempts_userId_users_id_fk` (`userId`), KEY `careerAssessmentAttempts_user_created_idx` (`userId`,`createdAt`), CONSTRAINT `careerAssessmentAttempts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS `skillAssessmentAttempts` (`id` int NOT NULL AUTO_INCREMENT, `userId` int NOT NULL, `skillName` varchar(120) NOT NULL, `answersJson` text NOT NULL, `score` int NOT NULL, `breakdownJson` text NOT NULL, `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`), KEY `skillAssessmentAttempts_userId_users_id_fk` (`userId`), KEY `skillAssessmentAttempts_user_skill_created_idx` (`userId`,`skillName`,`createdAt`), CONSTRAINT `skillAssessmentAttempts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

The omitted core column lists must be copied mechanically from the verified schema artifact and reviewed before a migration file is created. Execution is blocked until the final SQL contains no ellipses.

The planned auth migrations must create exactly the definitions already reviewed in `drizzle/0005_clear_sunspot.sql` and `drizzle/0006_foamy_nitro.sql`, but with constraints/indexes inline, explicit InnoDB/charset/collation, and new lineage metadata. They must contain no DML and no `DROP`.

## Ledger reconciliation plan

- Do not add anything to `__drizzle_migrations`.
- Do not insert hashes for `0002`, `0003`, `0004`, `0005`, or `0006` there.
- Do not delete its verified `0000` row.
- The new custom migrator creates `__uptrail_v2_migrations` and records only migrations it actually executes.
- The new baseline record is truthful: its real SQL is executed after exact preflight. On the imported database its `IF NOT EXISTS` statements are no-ops; on a fresh empty database they create the baseline.
- The auth records use newly computed hashes and timestamps from the new files after those files actually execute.
- Future migration status is read only from `__uptrail_v2_migrations`; the old ledger remains historical evidence.

## Identity transition procedure

1. Keep public registration closed until the imported account is linked; otherwise a same-email registration could create a separate user before linking.
2. After the auth tables exist, independently verify the person against the retained legacy subject in `users.openId`. Email equality is not identity proof.
3. Harden `scripts/link-legacy-account.ts` so credential insertion and the guarded `users.email/loginMethod` update occur in one transaction.
4. Privately set `LEGACY_USER_OPEN_ID`, `LOCAL_AUTH_EMAIL`, and a new 12–128 character `LOCAL_AUTH_PASSWORD`. The legacy password is not migrated.
5. Run `pnpm auth:link-legacy` once. It must select by exact `openId`, reject credential conflicts, and preserve the existing numeric `users.id`.
6. Verify that the same user ID still owns the profile, skills, roadmap, achievements, and both assessment-attempt records.
7. Sign in with the new local credential and verify a database-backed session.
8. Run `pnpm auth:find-user-id`, independently confirm the intended owner, then set `OWNER_USER_ID` to that numeric ID in the secret manager. The owner setting does not mutate the stored role.

## Dry-run environment

Create an additional database named `uptrail_migration_dryrun` in the same Aiven service. Aiven supports additional isolated databases within a MySQL service. Configure an ignored `.env.dryrun` with its database-specific service URI and the existing CA-file path. Do not point experimental commands at `defaultdb`.

Dry-run order:

1. Create a fresh, checksum-recorded backup of the verified restored `defaultdb` outside the repository.
2. Restore it into empty `uptrail_migration_dryrun` using `.env.dryrun` and verified TLS.
3. Run the restored-state verifier and require exact eight-table/count/FK/ledger parity.
4. Run the new guarded v2 migration command against `.env.dryrun` only.
5. Require the post-migration assertions below.
6. Start the application against `.env.dryrun`; test database reads and the authentication flow with a disposable linked copy.
7. Preserve all logs, schema snapshots, checksums, and test results.
8. Delete the disposable database only after evidence is accepted and explicit deletion approval is given.

## Pre/post assertions

Before migration:

- Exactly eight restored tables.
- Counts: users 1, profiles 1, skills 2, roadmap 2, achievements 0, career attempts 1, skill attempts 1, legacy ledger 1.
- Exactly six legacy user foreign keys and zero orphans.
- Legacy ledger exactly matches `0000`.
- TLS certificate and hostname verification pass.

After migration, before identity linking:

- Every pre-migration count is unchanged.
- `careerAssessmentAttempts` and `skillAssessmentAttempts` remain byte-for-byte structurally equivalent and retain their rows.
- `authCredentials`, `authSessions`, and `passwordResetTokens` exist with zero rows.
- All intended primary, unique, foreign-key, user, token, and expiry indexes exist.
- `__uptrail_v2_migrations` exists with only the real new-lineage records.
- `__drizzle_migrations` remains exactly one verified `0000` row.
- Exactly twelve tables exist: the original eight, three auth tables, and the new v2 ledger.
- No legacy row, foreign key, auto-increment high-water mark, or timestamp changed unexpectedly.
- `pnpm config:check`, `pnpm check`, `pnpm test`, and `pnpm build` pass.
- Application startup, `/healthz`, legacy-data reads, registration isolation, explicit linking, login, session creation/revocation, and owner authorization pass.

## Future execution plan — not authorized

| Step | Command/action | Purpose | Writes? | Expected result | Rollback point / verification |
|---|---|---:|---:|---|---|
| 1 | `pnpm config:check` | Validate redacted configuration. | No | Configuration passes. | Stop on any error. |
| 2 | `pnpm db:verify && pnpm db:verify-restored` | Reconfirm TLS and legacy baseline. | No | Exact verified pre-state. | Stop on drift. |
| 3 | `pnpm db:backup` with `BACKUP_FILE` outside the repo | Capture exact pre-migration database. | Reads DB; writes local backup | Backup completes. | Compute and recheck SHA-256. |
| 4 | Create/verify `.env.dryrun` for `uptrail_migration_dryrun` | Isolate the experiment. | Local secret file only | Target name is not `defaultdb`. | Stop if target identity differs. |
| 5 | `DOTENV_CONFIG_PATH=.env.dryrun pnpm db:restore` with guarded restore flags | Restore the verified backup into the empty dry-run database. | Yes, dry-run only | Eight-table baseline reproduced. | Recreate dry-run DB from backup if needed. |
| 6 | `DOTENV_CONFIG_PATH=.env.dryrun pnpm db:verify-restored` | Prove parity before migration. | No | Exact counts/FKs/ledger. | Stop on mismatch. |
| 7 | Review final v2 migration files and hashes | Ensure planned SQL has no ellipses, DML, or drops. | No | Human approval record. | No migration without approval. |
| 8 | `DOTENV_CONFIG_PATH=.env.dryrun pnpm db:migrate` after it has been replaced by the guarded v2 runner | Execute only the new v2 lineage. | Yes, dry-run only | Baseline marker plus three auth tables. | Restore dry-run from backup on any failure. |
| 9 | Run post-migration schema/count/FK/ledger verifier | Detect partial DDL or data drift. | No | All postconditions pass. | Failure triggers dry-run rebuild. |
| 10 | `pnpm check`, `pnpm test`, `pnpm build` and app smoke tests against `.env.dryrun` | Validate application compatibility. | Test auth may write dry-run rows | All gates pass. | Rebuild dry-run after evidence. |
| 11 | Produce execution evidence and request separate staging authorization | Gate any write to `defaultdb`. | No | Explicit approval or stop. | `defaultdb` remains unchanged. |

No existing generic migration command may be used until Step 8's guarded replacement has been implemented, reviewed, and proven to execute only the new lineage.

### Exact PowerShell command templates — not authorized

The dry-run restore command sequence will be the following after `.env.dryrun` exists and the backup placeholder has been replaced with the checksum-verified absolute path. `ALLOW_PRIMARY_RESTORE` is required by the guard because `.env.dryrun` deliberately makes the disposable database the command's configured primary target; `RESTORE_CONFIRM_DATABASE` still prevents a name mismatch.

```powershell
$env:DOTENV_CONFIG_PATH = (Resolve-Path ".env.dryrun").Path
$env:RESTORE_USE_DATABASE_URL = "true"
$env:RESTORE_FILE = "C:\secure-uptrail-backups\uptrail-pre-v2-<timestamp>.sql"
$env:RESTORE_CONFIRM_DATABASE = "uptrail_migration_dryrun"
$env:ALLOW_RESTORE = "true"
$env:ALLOW_PRIMARY_RESTORE = "true"
pnpm db:restore
pnpm db:verify-restored
Remove-Item Env:ALLOW_PRIMARY_RESTORE, Env:ALLOW_RESTORE, Env:RESTORE_CONFIRM_DATABASE, Env:RESTORE_FILE, Env:RESTORE_USE_DATABASE_URL, Env:DOTENV_CONFIG_PATH
```

The future migration command in Step 8 is intentionally not shown as executable yet: the current `pnpm db:migrate` still points at the broken legacy lineage. Before any authorization request, that script must be replaced with the reviewed guarded v2 runner, and every complete v2 SQL file plus its SHA-256 must be added to this plan. The existing `drizzle/0005_clear_sunspot.sql` and `drizzle/0006_foamy_nitro.sql` are precise references for intent only and must not be executed.

## Rollback procedure

Do not rely on reverse SQL.

1. Stop application writes and preserve logs.
2. Verify the pre-migration backup SHA-256.
3. Create a new empty recovery database, for example `uptrail_migration_recovery`, in the same Aiven service.
4. Configure an ignored `.env.recovery` pointing only to that database with the CA file.
5. Restore the verified backup with the guarded restore command and exact database-name confirmation.
6. Run TLS verification, schema snapshot, eight-table verification, exact row counts, six-FK verification, zero-orphan checks, and the `0000` ledger-hash check.
7. Point the staging application to the verified recovery database and restart it.
8. Smoke-test legacy reads before reopening traffic.
9. Preserve the failed database for investigation. Do not drop it or delete auth tables during the incident.

Expected recovered state is exactly eight tables and counts `1/1/2/2/0/1/1/1` in the order documented above, with only the original `__drizzle_migrations` ledger. Deleting or repurposing any failed database requires separate approval.

After the recovery database has been created and `.env.recovery` privately configured, the exact guarded restore command template is:

```powershell
$env:DOTENV_CONFIG_PATH = (Resolve-Path ".env.recovery").Path
$env:RESTORE_USE_DATABASE_URL = "true"
$env:RESTORE_FILE = "C:\secure-uptrail-backups\uptrail-pre-v2-<timestamp>.sql"
$env:RESTORE_CONFIRM_DATABASE = "uptrail_migration_recovery"
$env:ALLOW_RESTORE = "true"
$env:ALLOW_PRIMARY_RESTORE = "true"
pnpm db:restore
pnpm db:verify
pnpm db:verify-restored
Remove-Item Env:ALLOW_PRIMARY_RESTORE, Env:ALLOW_RESTORE, Env:RESTORE_CONFIRM_DATABASE, Env:RESTORE_FILE, Env:RESTORE_USE_DATABASE_URL, Env:DOTENV_CONFIG_PATH
```

Before either restore, run `Get-FileHash -Algorithm SHA256 -LiteralPath "C:\secure-uptrail-backups\uptrail-pre-v2-<timestamp>.sql"` and compare it with the separately retained checksum. The placeholder is deliberately execution-blocking; it must be replaced by the actual verified backup path without putting credentials in the command or document.

## Risk assessment

| Risk | Level | Reason / mitigation |
|---|---|---|
| Incomplete legacy migration history | HIGH | Current migration command is unusable and history cannot be reconstructed. Mitigate with a new verified lineage and frozen old ledger. |
| Testing against the only restored database | HIGH | A partial DDL failure would contaminate the verified baseline. Require a separate Aiven database first. |
| Legacy tables absent from current schema | HIGH | Schema-push tooling could classify them as drift. Add them to the managed schema and prohibit `drizzle-kit push` until reviewed. |
| MySQL implicit DDL commits | MEDIUM | Multi-statement migrations are not atomically reversible. Use complete-table DDL, strict pre/post checks, and restore-based rollback. |
| Identity linking | MEDIUM | Wrong subject or premature same-email registration could split/attach identity incorrectly. Require external proof, exact `openId`, transactional link, and keep registration closed until linked. |
| Backup confidentiality | MEDIUM | Sensitive Manus dumps are outside Git but their encryption/access-control status is unverified. Store future backups in an encrypted, access-controlled directory outside the repo. |
| Mixed collation defaults | LOW | Existing tables are `unicode_ci`; Aiven defaults to `0900_ai_ci`. Use explicit collation in the new lineage. No textual FK currently crosses the boundary. |
| Aiven transient connectivity | LOW | One read-only metadata query timed out and succeeded on retry. Migration tooling must fail closed and never retry DDL blindly. |

## Go / no-go

Current status: **dry-run migration PASS; NO-GO for `defaultdb` execution until the separate recovery-database rollback rehearsal passes**.

Execution authorization should not be considered until all of these are true:

1. An isolated `uptrail_migration_dryrun` database exists and is confirmed empty.
2. A fresh encrypted/access-controlled pre-migration backup outside the repository has a verified SHA-256 checksum.
3. The legacy assessment tables are represented in the managed Drizzle schema.
4. The new v2 migration folder, real files, journal, guarded runner, and separate ledger name are implemented and reviewed.
5. The planned baseline contains complete SQL with no placeholders.
6. Dry-run restore parity passes before migration.
7. Dry-run migration and every postcondition pass.
8. Application build/tests and authentication smoke tests pass on the migrated dry-run copy.
9. Rollback into a separate recovery database is rehearsed successfully.
10. A separate explicit authorization names the target database and approved migration hashes.

## Exact next action

Create one empty Aiven database named `uptrail_migration_recovery`, privately
configure ignored `.env.recovery` with its database URI and the existing CA-file
path, and explicitly authorize restore writes to that database for the rollback
rehearsal. Do not paste either value into chat and do not authorize migration of
`defaultdb` yet.
