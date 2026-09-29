# Backup and recovery

## Database backup

Install MySQL client tools so `mysqldump` and `mysql` are on `PATH`. Set `DATABASE_URL`, then run:

```powershell
pnpm db:verify
pnpm db:backup
```

`db:backup` creates a timestamped file under ignored `backups/`, uses a transaction-consistent dump, includes routines/triggers, keeps the password out of command arguments, and refuses to overwrite a file. Set `BACKUP_FILE` for a controlled destination. Encrypt backups at rest and transfer them to access-controlled, versioned storage.

Before every release migration, record the backup path, SHA-256 checksum, creation time, database server identity, and retention expiry. A backup is not accepted until it restores successfully into an isolated database.

## Guarded restore drill

Never point a drill at production. Create an empty isolated database and use a distinct URL:

```powershell
$env:RESTORE_DATABASE_URL = "mysql://restore-user:secret@127.0.0.1:3306/uptrail_restore_test"
$env:RESTORE_FILE = "C:\secure-backups\uptrail.sql"
$env:RESTORE_CONFIRM_DATABASE = "uptrail_restore_test"
$env:ALLOW_RESTORE = "true"
pnpm db:restore
$env:DATABASE_URL = $env:RESTORE_DATABASE_URL
pnpm db:integrity
```

The restore script verifies the source exists, requires exact target-name confirmation, and creates a mandatory backup of the target before importing. It never drops or creates a database. If the target URL equals `DATABASE_URL`, an approved emergency recovery must additionally set `ALLOW_PRIMARY_RESTORE=true`. Remove all temporary environment variables after the drill.

## Object storage

Enable bucket versioning, server-side encryption, retention/lifecycle policy, and access logging. `pnpm storage:migrate` defaults to inventory-only mode. Configure `SOURCE_S3_*` and destination `S3_*`; inspect the ignored JSON manifest. Only then set `STORAGE_MIGRATION_EXECUTE=true`. Execution preserves keys/metadata, does not delete source objects, and downloads the destination to verify SHA-256 and size.

Keep the source read-only for the agreed retention window. A successful manifest requires `failed: 0` and `verified` equal to `total`. Retain the manifest with the release record.

## Recovery strategy

- Application rollback: redeploy the preceding immutable image and configuration.
- Database rollback: migration `0006` is additive. Prefer application rollback; restore the database only for verified data corruption, not ordinary code failure.
- Storage rollback: point reads to the retained source only through a reviewed configuration/code rollback. Never bulk-delete the destination during an incident.
- Identity rollback: local sessions are independent of legacy OAuth. Do not re-enable legacy bearer/OAuth acceptance; use verified credential linking or recovery.

The owner must set acceptable RPO/RTO, backup frequency, geographic redundancy, encryption-key custody, and retention before launch. Recommended baseline: daily full logical backup plus provider point-in-time recovery, quarterly restore drills, and a restore drill before the first cutover.
